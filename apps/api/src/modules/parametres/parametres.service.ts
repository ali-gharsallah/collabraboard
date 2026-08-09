import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";
import { AML_GAP_RQ } from "./aml-gap.rq.gen";

/**
 * Gouvernance des paramètres tenant — R125→R128 (RQ-01..06). Écrit APRÈS l'amendement, APRÈS les tests.
 * Le questionnaire R-Q devient EXÉCUTABLE : le registre est le seul chemin d'écriture (typé,
 * rattaché aux règles — R125) ; tout changement est motivé (R7), daté, append-only, à effet
 * immédiat ou différé — jamais rétroactif (R126/R29/R48) ; la config se rejoue à date (R127/R49) ;
 * l'activation exige le questionnaire complet ET signé (R128, gate structurel type R13).
 * Tenant.settings = VUE COURANTE matérialisée ; la VÉRITÉ = tenant_param_changes.
 */

type Ctx = { tenantId: string; userId: string; role: string };
type Entree = { cle: string; type: "int" | "bool" | "json" | "string"; defaut: any;
  regle: string; requis: boolean; exemple?: any; description: string };

/** LE registre — s'enrichit par amendement, comme le catalogue. Généré → questionnaire R-Q. */
export const REGISTRE_RQ: Entree[] = [
  { cle: "cumulRolesAutorise", type: "bool", defaut: false, regle: "R31", requis: true,
    description: "Une personne peut-elle cumuler plusieurs rôles sur un même client ?" },
  { cle: "depepDelaiJours", type: "int", defaut: 365, regle: "R33", requis: false,
    description: "Délai de revue après perte de statut PEP (grandfathering)" },
  { cle: "goldenRecordMapping", type: "json", defaut: ["riskLevel"], regle: "R104", requis: false,
    description: "Champs propagés du KYC validé vers le client (liste fermée)" },
  { cle: "pmsDriftToleranceBp", type: "int", defaut: 200, regle: "R105", requis: false,
    description: "Tolérance (points de base) avant qu'un écart d'allocation devienne un drift" },
  { cle: "pmsBreachDelaiJours", type: "int", defaut: 30, regle: "R108", requis: false,
    description: "Délai de régularisation d'un breach avant escalade" },
  { cle: "crmEntretiens", type: "json", defaut: [], regle: "R188", requis: false,
    description: "Types d'entretiens client et champs obligatoires par type — la trace du conseil (LSFin). Un champ obligatoire manquant est un refus explicite : la documentation du conseil n'est pas optionnelle." },
  { cle: "workloadResponsables", type: "json", defaut: [], regle: "R183", requis: false,
    description: "Qui chapeaute qui : liste {responsableRole, equipeRole}. Le responsable déclaré voit la charge de son équipe ; chaque collaborateur voit toujours ses propres mesures (transparence structurelle, art. 26 OLT 3)." },
  { cle: "workloadBareme", type: "json", defaut: [], regle: "R185", requis: false,
    description: "Barème de bonification versionné par date d'effet : [{depuisLe, points{TYPE: pts}}]. Un accomplissement garde à vie les points du barème de son jour — jamais rétroactif. Alimente le module RH, ne calcule aucun bonus." },
  { cle: "workloadCapacite", type: "json", defaut: { standardParSemaine: 10, seuilSurchargePct: 80 }, regle: "R183/R184", requis: false,
    description: "Capacité standard (pondération hebdomadaire) et seuil de surcharge (%). La surcharge est un signal au responsable — le système ne déplace jamais une tâche lui-même." },
  { cle: "docStorage", type: "json", defaut: { adaptateur: "COFFRE_INTERNE" }, regle: "R180", requis: false,
    description: "Hébergeur documentaire de l'établissement : coffre interne O-Live, stockage objet suisse, ou GED existante de la banque (adaptateur déclaré). Le changer est un acte motivé, jamais rétroactif — les invariants de preuve ne bougent pas (R181)." },
  { cle: "gedDocTypes", type: "json", defaut: null, regle: "R110/R112", requis: true,
    exemple: [{ code: "PASSEPORT", validiteMois: 120, requisPour: ["KYC_VALIDATION"], rolesAutorises: ["RM", "CO", "CF"] }],
    description: "Référentiel des types de documents : validité, exigences par passage, rôles autorisés, retentionAnnees (R170 : la rétention naît au classement) · chaque type peut porter son gabarit d'extraction OCR versionné (champs, contrôles, mapping — R174)" },
  { cle: "onboardingSlaJours", type: "json", defaut: { COLLECTE: 30, KYC_EN_COURS: 45, DECISION: 10 },
    regle: "R120", requis: false, description: "SLA par étape du funnel d'onboarding (jours)" },
  { cle: "champsObligatoiresParSection", type: "json", defaut: {}, regle: "R78", requis: false,
    exemple: { "KYC/IDENT": ["Dénomination / raison sociale", "Statut PEP (combo : Non-PEP / PEP / Near-PEP / Ex-PEP)"] },
    description: "Champs marqués OBLIGATOIRES par section (contexte KYC/AR/GAR). R78 : la section est un objet complet — le caractère obligatoire d'un champ est un acte de paramétrage MOTIVÉ, jamais implicite ; un champ obligatoire manquant est un refus explicite au dépôt du dossier, jamais un blocage silencieux. Structure : { \"CTX/SECTION_CODE\": [\"Libellé du champ\", …] }." },
  { cle: "iaPrerevueTraitementRequis", type: "bool", defaut: false, regle: "R123", requis: false,
    description: "Exiger le traitement de tous les points de pré-revue IA avant visa ?" },
  { cle: "iaPseudonymise", type: "bool", defaut: true, regle: "R124", requis: false,
    description: "Pseudonymiser les identités avant transmission au port IA ?" },
  { cle: "screeningSeuil", type: "int", defaut: 85, regle: "R100", requis: false,
    description: "Seuil de similarité du screening (0-100)" },
  { cle: "workflowRoles", type: "json", defaut: ["CO", "ADMIN"], regle: "R173", requis: false,
    description: "Rôles habilités à éditer et publier les définitions de workflow (l'atelier gouverné)" },
  { cle: "coreMapping", type: "json", defaut: [], regle: "R169", requis: false,
    description: "Correspondances compteCore ↔ clientId, versionnées à date de mise en vigueur (depuisLe) — l'inconnu va en quarantaine" },
  { cle: "coreSystemeRef", type: "string", defaut: null, regle: "R167", requis: false,
    description: "Référence contractuelle du connecteur core banking (port déclaré : système, version, périmètre)" },
  { cle: "vueRoles", type: "json", defaut: ["CO", "CF", "ADMIN"], regle: "R164", requis: false,
    description: "Rôles habilités à créer/retirer des dossiers-vues (la vue est une requête, jamais une copie)" },
  { cle: "iaResidence", type: "string", defaut: "CH", regle: "R163", requis: false,
    description: "Résidence exigée du prestataire IA — un document bancaire suisse ne part pas n'importe où" },
  { cle: "iaProviderRef", type: "string", defaut: null, regle: "R163", requis: false,
    description: "Référence contractuelle du prestataire IA (port)" },
  { cle: "annotationRoles", type: "json", defaut: ["CO", "CF", "RM"], regle: "R157", requis: false,
    description: "Rôles habilités à annoter (le calque — jamais l'original)" },
  { cle: "caviardageRoles", type: "json", defaut: ["CO", "CF"], regle: "R158", requis: false,
    description: "Rôles habilités à produire un dérivé caviardé (zones motivées, base légale)" },
  { cle: "lienRolesOfficiels", type: "json", defaut: ["CO", "CF", "RM"], regle: "R152", requis: false,
    description: "Rôles habilités à poser/retirer un lien OFFICIEL (settlor, PoA, signataire…)" },
  { cle: "lienRolesNonOfficiels", type: "json", defaut: ["RM", "CO", "CF"], regle: "R152", requis: false,
    description: "Rôles habilités à poser/retirer une relation NON officielle (père de, époux de…)" },
  { cle: "lienTypes", type: "json", defaut: null, regle: "R153", requis: false,
    description: "Référentiel des types de liens (null = référentiel semé spec §6.2/6.3, avec inverses R154)" },
  { cle: "storageRegion", type: "string", defaut: "ch-gva-2", regle: "R144/R146", requis: false,
    description: "Région de résidence du coffre (Exoscale SOS — engagement contractuel suisse)" },
  { cle: "storageChiffrement", type: "string", defaut: null, regle: "R146", requis: false,
    description: "Référence d'enveloppe de chiffrement par tenant, transmise au coffre" },
  { cle: "txGardes", type: "json", defaut: {}, regle: "R141", requis: false,
    description: "Sévérité par garde du portail transactionnel (BLOQUANT|SUSPENSIF|INFORMATIF)" },
  { cle: "txRevueRoles", type: "json", defaut: ["CO", "MLRO"], regle: "R143", requis: false,
    description: "Rôles habilités sur la file de revue des transactions suspendues" },
  { cle: "txRevueSlaHeures", type: "int", defaut: 24, regle: "R143", requis: false,
    description: "SLA de revue des suspensions (heures) — alerte, jamais de libération auto" },
  { cle: "txComportement", type: "json", defaut: { fenetreHeures: 48, maxTxFenetre: 3, multiplicateurVolumetrie: 3, typesSensibles: ["CONVERSION_CRYPTO"] },
    regle: "R142", requis: false, description: "Garde comportement : fenêtres et multiplicateurs PAR PROFIL (réponse FINMA 02/2026)" },
  // ── Bloc WD (Q-WD-1..5) — Workflow Designer : import IA gouverné ──
  { cle: "wdRolesImport", type: "json", defaut: ["CO", "ADMIN"], regle: "R432 (Q-WD-1)",
    requis: false, description: "Rôles habilités à importer un workflow (image/dessin/texte)" },
  { cle: "wdRoleRatifieur", type: "string", defaut: "CO_SR", regle: "R435 (Q-WD-2)",
    requis: false, description: "Rôle qui ratifie un WIR (importeur ≠ ratifieur, R435)" },
  { cle: "wdSeuilConfiance", type: "int", defaut: 0.6, regle: "R438 (Q-WD-3)",
    requis: false, description: "Seuil de confiance sous lequel un nœud extrait est « à vérifier » (R438)" },
  { cle: "wdFormats", type: "json", defaut: ["image/png", "image/jpeg", "application/pdf"], regle: "R432 (Q-WD-4)",
    requis: false, description: "Formats d'import acceptés" },
  { cle: "wdTailleMaxMo", type: "int", defaut: 10, regle: "R432 (Q-WD-4)",
    requis: false, description: "Taille maximale d'un fichier importé (Mo)" },
  { cle: "wdRolesTenant", type: "json", defaut: ["ARM", "RM", "CO", "CO_SR", "CF", "DIR", "ADMIN", "HPB", "CEO", "SECU", "Système"], regle: "R434 (Q-WD-5)",
    requis: false, description: "Référentiel des rôles mappables dans un WIR (R434/R437)" },
  // ── Bloc 62 (repo R439–R445) — §Offboarding : résolution PAR DATE D'INITIATION (R29),
  //    modification via pop-up d'engagement R445 (PATCH /v1/offboarding-moteur/params) ──
  { cle: "offboardingWorkflow.chains.LOW", type: "json", defaut: ["RM", "CO"], regle: "R441 (offboarding)",
    requis: false, description: "Chaîne de visas — niveau LOW (chaque maillon = visa R15, exclusion R13)" },
  { cle: "offboardingWorkflow.chains.MEDIUM", type: "json", defaut: ["RM", "CO", "CO_SR"], regle: "R441 (offboarding)",
    requis: false, description: "Chaîne de visas — niveau MEDIUM" },
  { cle: "offboardingWorkflow.chains.HIGH", type: "json", defaut: ["RM", "CO_SR", "MLRO", "DIR"], regle: "R441 (offboarding)",
    requis: false, description: "Chaîne de visas — niveau HIGH" },
  { cle: "offboardingWorkflow.chains.PEP", type: "json", defaut: ["RM", "CO_SR", "MLRO", "DIR"], regle: "R441 (offboarding)",
    requis: false, description: "Chaîne de visas — niveau PEP" },
  { cle: "offboardingWorkflow.forcageParMotif", type: "json", defaut: { "Sanctions": "HIGH", "Risque AML élevé": "HIGH" }, regle: "R441 (offboarding)",
    requis: false, description: "Forçage de niveau MINIMUM par motif — l'emporte sur le niveau calculé, jamais l'inverse" },
  { cle: "offboardingWorkflow.motifs", type: "json", defaut: ["Demande du client", "Décision de la banque", "Risque AML élevé", "Sanctions", "Inactivité prolongée", "Fusion/acquisition", "Décès / succession", "Transfert d'établissement"], regle: "R442 (offboarding)",
    requis: false, description: "Référentiel des motifs de sortie (8 motifs standard)" },
  { cle: "offboardingWorkflow.rolesParMotif", type: "json", defaut: { "Sanctions": ["CO_SR", "MLRO"], "Risque AML élevé": ["CO_SR", "MLRO"], "*": ["RM", "CO"] }, regle: "R442 (offboarding)",
    requis: false, description: "Rôles habilités à initier PAR MOTIF (ADMIN toujours, tracé)" },
  { cle: "offboardingWorkflow.checklistPP", type: "json", defaut: "checklist standard PP (4 items)", regle: "R443 (offboarding)",
    requis: false, description: "Checklist de sortie personne physique — item obligatoire non coché = guard bloquant" },
  { cle: "offboardingWorkflow.checklistPM", type: "json", defaut: "checklist standard PM (4 items)", regle: "R443 (offboarding)",
    requis: false, description: "Checklist de sortie personne morale" },
  { cle: "offboardingWorkflow.guards", type: "json", defaut: { AR: "BLOQUANT", AML: "BLOQUANT", SCREENING: "BLOQUANT", MROS: "BLOQUANT", CORE: "BLOQUANT", CHECKLIST: "BLOQUANT" }, regle: "R440 (offboarding)",
    requis: false, description: "Sévérité PAR GUARD (BLOQUANT|AVERTISSEMENT|DÉSACTIVÉ) — 100 % tenant, pop-up R445 obligatoire" },
  { cle: "offboardingWorkflow.retentionAnnees", type: "int", defaut: 10, regle: "R444 (offboarding)",
    requis: false, description: "Rétention post-clôture (art. 7 LBA) — échéance = tâche de revue, jamais de destruction automatique (R39/R44)" },
  { cle: "offboardingWorkflow.slaJoursParEtape", type: "json", defaut: { "Création": 1, "Collecte": 3, "Review": 3, "Validation": 2 }, regle: "R439 (offboarding)",
    requis: false, description: "SLA par étape du workflow OFFBOARDING (moteur standard)" },
  // ── Bloc 63 — §BusinessTrip (R452) : registre gouverné par date, pop-up R445 exigé côté API ──
  { cle: "businessTrip.chains.LOW", type: "json", defaut: ["MGR"], regle: "R446 (business trip)",
    requis: false, description: "Chaîne de visas voyage — risque LOW (le RM demandeur ouvre, ne vise jamais — R13)" },
  { cle: "businessTrip.chains.MEDIUM", type: "json", defaut: ["MGR", "XB"], regle: "R446 (business trip)",
    requis: false, description: "Chaîne de visas voyage — risque MEDIUM" },
  { cle: "businessTrip.chains.HIGH", type: "json", defaut: ["MGR", "XB", "HPB"], regle: "R446 (business trip)",
    requis: false, description: "Chaîne de visas voyage — risque HIGH" },
  { cle: "businessTrip.seuilBudgetHPB", type: "int", defaut: 5000, regle: "R446 (business trip)",
    requis: false, description: "Budget CHF au-delà duquel HPB est ajouté à la chaîne, quel que soit le risque" },
  { cle: "businessTrip.risqueDestinations", type: "json", defaut: {}, regle: "R446 (business trip)",
    requis: false, description: "Niveau de risque cross-border par destination (LOW/MEDIUM/HIGH)" },
  { cle: "businessTrip.quotas", type: "json", defaut: {}, regle: "R449 (business trip)",
    requis: false, description: "Plafond banque de jours bancables par destination (année glissante, projection)" },
  { cle: "businessTrip.quotasOverridesRM", type: "json", defaut: {}, regle: "R449 (business trip)",
    requis: false, description: "Overrides RM×destination — le plafond effectif prime le plafond banque, pose via pop-up R445" },
  { cle: "businessTrip.guards", type: "json", defaut: { certifValide: "BLOQUANT", quotaDepasse: "AVERTISSEMENT", verdictNON: "BLOQUANT", paysSanctions: "BLOQUANT", certificatPrecedentManquant: "BLOQUANT", destinationHorsRegistre: "BLOQUANT" }, regle: "R447 (business trip)",
    requis: false, description: "Sévérités des guards pré-départ — 100 % tenant, recalculés à chaque transition" },
  { cle: "businessTrip.paysSanctions", type: "json", defaut: [], regle: "R447 (business trip)",
    requis: false, description: "Destinations sous politique sanctions — clearance Compliance requise" },
  { cle: "businessTrip.certificat.slaJoursOuvres", type: "int", defaut: 5, regle: "R450 (business trip)",
    requis: false, description: "SLA de soumission du certificat de trip après la date de fin (jours ouvrés)" },
  { cle: "businessTrip.certificat.validateurDefaut", type: "string", defaut: "MGR", regle: "R450 (business trip)",
    requis: false, description: "Validateur du certificat sans écart" },
  { cle: "businessTrip.certificat.validateurSiEcart", type: "string", defaut: "XB", regle: "R450 (business trip)",
    requis: false, description: "Validateur du certificat si écart déclaré ou risque HIGH (routage automatique)" },
  // ── Bloc 64 — §CrossBorder (R462) : registre gouverné par date, pop-up R445 exigé côté API ──
  { cle: "crossBorder.fournisseur", type: "string", defaut: "INTERNE", regle: "R453 (cross-border)",
    requis: false, description: "Port fournisseur de la matrice : INDIGITA_API | APIAX_API | IMPORT_BRP | INTERNE" },
  { cle: "crossBorder.syncFrequenceHeures", type: "int", defaut: 24, regle: "R453 (cross-border)",
    requis: false, description: "Fréquence de synchronisation du port matrice" },
  { cle: "crossBorder.syncAlerteEchecJours", type: "int", defaut: 2, regle: "R453 (cross-border)",
    requis: false, description: "Jours d'échec de sync avant tâche Compliance (la dernière version reste servie)" },
  { cle: "crossBorder.acteDistant.severiteNON", type: "string", defaut: "AVERTISSEMENT", regle: "R454 (cross-border)",
    requis: false, description: "Comportement d'un verdict NON sur acte distant : BLOQUANT | AVERTISSEMENT" },
  { cle: "crossBorder.acteDistant.mappingEntretienActivites", type: "json", defaut: { "Conseil en placement": ["ADVICE"], "Conseil": ["ADVICE"], "Envoi documentation": ["MKT"], "Prise d'ordre": ["ORDER"], "Courtoisie": ["MEET"] }, regle: "R454 (cross-border)",
    requis: false, description: "Type d'entretien → activités cross-border évaluées" },
  { cle: "crossBorder.preActe.severites", type: "json", defaut: { MKT: "BLOQUANT", ADVICE: "BLOQUANT", ORDER: "BLOQUANT" }, regle: "R455 (cross-border)",
    requis: false, description: "Sévérités des checks pré-acte embarqués (diffusion GED, proposition, ordre)" },
  { cle: "crossBorder.reverseSolicitation.validiteMois", type: "int", defaut: 12, regle: "R456 (cross-border)",
    requis: false, description: "Validité d'une preuve de reverse solicitation (mois)" },
  { cle: "crossBorder.reverseSolicitation.rolesEnregistrement", type: "json", defaut: ["RM", "CO", "CO_SR"], regle: "R456 (cross-border)",
    requis: false, description: "Rôles habilités à enregistrer une preuve (le visa reste un second regard R13)" },
  { cle: "crossBorder.localisationTemporaire.dureeMaxJours", type: "int", defaut: 90, regle: "R457 (cross-border)",
    requis: false, description: "Durée maximale d'une localisation temporaire — au-delà, revue de résidence" },
  { cle: "crossBorder.certifications.juridictionsExigees", type: "json", defaut: [], regle: "R458 (cross-border)",
    requis: false, description: "Juridictions exigeant une certification RM (codes XB-<pays> au catalogue MOD-43)" },
  { cle: "crossBorder.certifications.severiteAbsence", type: "string", defaut: "BLOQUANT", regle: "R458 (cross-border)",
    requis: false, description: "Comportement en absence de certification pour la juridiction" },
  { cle: "crossBorder.entites", type: "json", defaut: {}, regle: "R461 (cross-border)",
    requis: false, description: "Régimes/exemptions par entité de booking et par juridiction — jamais transférables" },
  // ── Bloc 65 Volet A (repo R466–R473) — §Review : harmonisation KYC·AR·GAR.
  //    Résolution par date (R29), modification via pop-up d'engagement R445
  //    (PATCH /v1/revues/params/modifier, aggregate "review-params") ──
  { cle: "review.periodiciteMois", type: "json", defaut: { HIGH: 12, MEDIUM: 24, LOW: 36, PEP: 12 }, regle: "R468 (revues)",
    requis: false, description: "Périodicité de revue par niveau de risque (mois) — nextReviewDate est CALCULÉE, jamais saisie ; recalcul tracé à tout changement de risque" },
  { cle: "review.verdictConsequences", type: "json", defaut: { RESERVES: ["TACHES_REMEDIATION"], NON_CONFORME: ["PROPOSER_EDD", "PROPOSER_COC", "PROPOSER_OFFBOARDING"] }, regle: "R468 (revues)",
    requis: false, description: "Conséquences PROPOSÉES par verdict (tâches/propositions, jamais exécutées seules — R44) ; la décision d'aiguillage est un événement humain distinct" },
  { cle: "review.visaEnBlocSectionsInchangees", type: "bool", defaut: true, regle: "R467 (revues)",
    requis: false, description: "Autoriser le visa en bloc « revu, inchangé » des sections sans modification (le delta reste visé changement par changement)" },
  { cle: "review.groupe.criteres", type: "json", defaut: ["UBO_COMMUN"], regle: "R469 (revues)",
    requis: false, description: "Critères de composition des groupes de revue (UBO_COMMUN | GROUPE_CORPORATE_DECLARE | FAMILLE) — le groupe est une PROJECTION des liens, jamais une table" },
  { cle: "review.groupe.enabled", type: "bool", defaut: true, regle: "R471 (revues)",
    requis: false, description: "Activer les revues de groupe (GAR) — désactiver n'éteint aucune obligation de revue individuelle" },
  { cle: "review.groupe.cascadeGroupToMembers", type: "bool", defaut: true, regle: "R471 (revues)",
    requis: false, description: "Cascade GAR → membres : déclencher les revues membres à l'ouverture du groupe (anti-boucle : une cascade ne re-cascade pas)" },
  { cle: "review.groupe.cascadeMemberToGroup", type: "bool", defaut: true, regle: "R471 (revues)",
    requis: false, description: "Cascade membre → GAR : un déclencheur sur un membre propose la revue du groupe (anti-boucle : une cascade ne re-cascade pas)" },
  { cle: "review.groupe.guardMembresNonClotures", type: "string", defaut: "BLOQUANT", regle: "R470 (revues)",
    requis: false, description: "Sévérité du guard « membres non clôturés » à la décision de groupe (BLOQUANT|AVERTISSEMENT) — assouplir passe par le pop-up R445" },
  { cle: "review.affichageParType", type: "json", defaut: { KYC: { panneaux: [] }, ACCOUNT_REVIEW: { panneaux: ["delta"] }, GROUP_ACCOUNT_REVIEW: { panneaux: ["vue-consolidee"] } }, regle: "R472 (revues)",
    requis: false, description: "Gabarit d'affichage UNIQUE, panneaux additionnels par type de revue (delta pour AR, vue consolidée pour GAR) — trois types d'un même dossier, pas trois écrans" },
  // ── Bloc 65 Volet B (repo R474–R479) — §Decision : la barre de décision unifiée.
  //    Modification via pop-up R445 (PATCH /v1/decisions/params/modifier, aggregate "decision-params") ──
  { cle: "decision.libelles", type: "json", defaut: { valider: "✓ Valider", refuser: "✕ Refuser", renvoyer: "↩ Renvoyer", deleguer: "⇄ Déléguer" }, regle: "R474 (décision)",
    requis: false, description: "Libellés de la barre de décision, par type ou communs — les LIBELLÉS se paramètrent, le comportement JAMAIS (mêmes issues, même ordre, mêmes règles partout)" },
  { cle: "decision.motifsRefus", type: "json", defaut: ["DOCS_INSUFFISANTS", "RISQUE_INACCEPTABLE", "INFOS_CONTRADICTOIRES", "AUTRE"], regle: "R476 (décision)",
    requis: false, description: "Référentiel des codes de motif de refus — le motif est STRUCTURÉ : code du référentiel + texte libre obligatoire ; pas de motif, pas de décision" },
  { cle: "decision.issueRefusParEtape", type: "json", defaut: {}, regle: "R476 (décision)",
    exemple: { Review: { issue: "RENVOI", cible: "Collecte" }, Validation: { issue: "TERMINAL" } },
    description: "Issue du refus PAR ÉTAPE : TERMINAL (REJECTED R16) | RENVOI (mêmes effets que R475) | CLOTURE_MOTIVEE — défaut structurel : étape finale=TERMINAL, intermédiaires=RENVOI vers l'étape précédente", requis: false },
  { cle: "decision.renvoi.seuilBoucles", type: "int", defaut: 3, regle: "R475 (décision)",
    requis: false, description: "Seuil de boucles de renvoi au-delà duquel un signal AVERTISSEMENT est levé vers le manager — jamais de blocage automatique (R39)" },
  { cle: "decision.apresDecision", type: "json", defaut: "SUIVANT", regle: "R479 (décision)",
    requis: false, description: "Comportement après décision : SUIVANT (le prochain dossier de la corbeille s'ouvre, bandeau réversible) | RESTER — paramétrable PAR UTILISATEUR (map userId→mode) ; jamais de modal de confirmation" },
  { cle: "decision.corbeille.tri", type: "string", defaut: "SLA", regle: "R478 (décision)",
    requis: false, description: "Tri de la corbeille « À décider » : SLA (défaut — l'échu en tête, badge rouge) | DATE | TYPE" },
  { cle: "gedCanauxIngestion", type: "json", defaut: ["SCAN", "EMAIL", "UPLOAD", "API"], regle: "R137",
    requis: false, description: "Canaux d'entrée autorisés des documents (default-deny)" },
  { cle: "gedInboxRoles", type: "json", defaut: ["CO", "CF"], regle: "R139", requis: false,
    description: "Rôles habilités sur la boîte d'arrivée GED (default-deny tracé)" },
  { cle: "gedInboxSlaJours", type: "int", defaut: 2, regle: "R139", requis: false,
    description: "SLA de classement de la boîte d'arrivée (jours) — alerte, jamais d'auto-classement" },
  { cle: "slaKycJours", type: "int", defaut: 30, regle: "R39", requis: false,
    description: "SLA indicatif de traitement d'un dossier KYC (mesure, jamais coercition)" },
  { cle: "riskCaseSlaJours", type: "json", defaut: { NOUVELLE: 2, EN_ANALYSE: 15, CLARIFICATION: 10 },
    regle: "R135", requis: false, description: "SLA d'instruction des risk cases par état (jours)" },
  { cle: "mrosRolesHabilites", type: "json", defaut: ["MLRO"], regle: "R129/R132", requis: false,
    description: "Rôles habilités à décider et lire une communication MROS (art. 9/10a LBA)" },
  { cle: "mrosGelJoursOuvrables", type: "int", defaut: 5, regle: "R131", requis: false,
    description: "Échéance de surveillance du gel des avoirs (jours ouvrables, art. 10 LBA)" },
  { cle: "rqRepondant", type: "string", defaut: null, regle: "R128", requis: true,
    exemple: "compliance@banque.ch", description: "Répondant bancaire du questionnaire R-Q (contact contractuel)" },
  // ── Surveillance AML private banking — R189→R206 (Bloc 48). Chaque seuil est une règle :
  //    le régler passe par LE registre (motivé, daté, jamais rétroactif). L'onglet
  //    « Paramétrages AML » est la vue filtrée de ces clés (préfixe `aml`). ──
  { cle: "amlStructuringAlertCount", type: "int", defaut: 5, regle: "R189", requis: false,
    description: "Nombre de virements sous le seuil qui déclenche un signal de structuring" },
  { cle: "amlStructuringSeuilChf", type: "int", defaut: 100000, regle: "R189", requis: false,
    description: "Seuil (CHF) sous lequel un fractionnement devient suspect" },
  { cle: "amlStructuringFenetreH", type: "int", defaut: 48, regle: "R189", requis: false,
    description: "Fenêtre (heures) d'agrégation du pattern de structuring" },
  { cle: "amlCrossBorderFenetreH", type: "int", defaut: 48, regle: "R190", requis: false,
    description: "Fenêtre (heures) des mouvements cross-border circulaires même UBO" },
  { cle: "amlCrossBorderMinPays", type: "int", defaut: 2, regle: "R190", requis: false,
    description: "Nombre minimum de juridictions distinctes pour un signal cross-border" },
  { cle: "amlVelocityDormantMois", type: "int", defaut: 18, regle: "R191", requis: false,
    description: "Ancienneté (mois) au-delà de laquelle un compte est réputé dormant" },
  { cle: "amlVelocityMultiplicateur", type: "int", defaut: 5, regle: "R191", requis: false,
    description: "Multiplicateur de la moyenne au-delà duquel la vélocité devient inhabituelle" },
  { cle: "amlInOutFenetreH", type: "int", defaut: 6, regle: "R194", requis: false,
    description: "Fenêtre (heures) entrée→sortie ≈montant (layering même jour)" },
  { cle: "amlCircularFenetreJours", type: "int", defaut: 10, regle: "R196", requis: false,
    description: "Fenêtre (jours) d'un cycle A→B→C→A entre comptes du même UBO" },
  { cle: "amlHriPays", type: "json", defaut: ["Iran", "Syrie", "Corée du Nord", "Cuba"], regle: "R197", requis: false,
    description: "Juridictions à haut risque (blocage en attente d'approbation CO)" },
  { cle: "amlRoundSeuilPct", type: "int", defaut: 70, regle: "R198", requis: false,
    description: "Part (%) de montants ronds au-delà de laquelle le pattern est signalé" },
  { cle: "amlCashWirePct", type: "int", defaut: 80, regle: "R199", requis: false,
    description: "Part (%) d'un dépôt espèces re-virée qui déclenche le signal cash→wire" },
  { cle: "amlCashWireFenetreH", type: "int", defaut: 24, regle: "R199", requis: false,
    description: "Fenêtre (heures) dépôt espèces → virement sortant" },
  { cle: "amlCounterpartyFacteurPct", type: "int", defaut: 150, regle: "R202", requis: false,
    description: "Facteur (%) sur (moyenne + σ) au-delà duquel un montant contrepartie explose" },
  { cle: "amlCrsResidences", type: "json", defaut: ["France", "Allemagne", "Italie", "Espagne", "USA", "FR", "DE", "US"], regle: "R203", requis: false,
    description: "Résidences fiscales dans le périmètre CRS/FATCA" },
  { cle: "amlCrsSeuilChf", type: "int", defaut: 1000000, regle: "R203", requis: false,
    description: "Seuil de solde (CHF) au-delà duquel l'absence d'auto-certification bloque" },
  { cle: "amlFiduciaireSeuilPct", type: "int", defaut: 10, regle: "R204", requis: false,
    description: "Part (%) des dépôts clients au-delà de laquelle un retrait personnel est un abus" },
  { cle: "amlConcentrationSeuilPct", type: "int", defaut: 80, regle: "R206", requis: false,
    description: "Part (%) du patrimoine sur ≤2 comptes courants qui signale une concentration" },
  { cle: "amlTaxHavens", type: "json", defaut: ["Luxembourg", "Jersey", "Guernesey", "Îles Caïmans", "Cayman"], regle: "R205", requis: false,
    description: "Paradis fiscaux d'un circuit d'optimisation CH→paradis→CH" },
  { cle: "amlListesReglementaires", type: "json", defaut: ["OFAC", "EU", "UN", "SECO"], regle: "R192", requis: false,
    description: "Listes réglementaires de sanctions synchronisées (matching → refus immédiat)" },
  // ── Couche de conformité Shariah — R207→R221 (Bloc 49). Nisab, taux Zakat et référentiels
  //    de secteurs/contrats illicites sont des règles : réglés par le registre (R7/R125). ──
  { cle: "islamicNisabChf", type: "int", defaut: 100000, regle: "R211", requis: false,
    description: "Nisab (CHF) — seuil de patrimoine au-delà duquel la Zakat est due" },
  { cle: "islamicZakatTauxBps", type: "int", defaut: 250, regle: "R211", requis: false,
    description: "Taux de Zakat en points de base (250 = 2,5%)" },
  { cle: "islamicSecteursHaram", type: "json", defaut: ["ALCOOL", "JEUX", "CASINO", "PORC", "TABAC", "ARMES", "ADULTE", "PORNOGRAPHIE"], regle: "R207", requis: false,
    description: "Secteurs illicites (haram) — screening client R207 et contrepartie R213" },
  { cle: "islamicGhararTypes", type: "json", defaut: ["DERIVE", "HEDGING", "OPTION", "FUTURE", "SWAP"], regle: "R210", requis: false,
    description: "Familles de contrats à incertitude excessive (gharar)" },
  { cle: "islamicMaysirVolatilitePct", type: "int", defaut: 80, regle: "R209", requis: false,
    description: "Volatilité (%) au-delà de laquelle une plateforme relève de la spéculation maysir (blocage auto)" },
  // ── Formations & Certifications — MOD-43 (R231→R238, lot 50). Le référentiel de formation,
  //    les rappels et le mode de validation sont des règles : réglés par le registre (R7/R125). ──
  { cle: "trainingCatalog", type: "json", defaut: [], regle: "R231", requis: false,
    exemple: [{ code: "AML_ANNUELLE", libelle: "AML annuelle", validiteMois: 12, rolesCibles: ["RM", "CO"], periodicite: "ANNUELLE" }],
    description: "Référentiel tenant des formations : code, libellé, validité (mois), rôles cibles, périodicité. Aucun type codé en dur (R231)." },
  { cle: "trainingReminderDays", type: "json", defaut: [30, 7], regle: "R233", requis: false,
    description: "Jours avant expiration où un rappel de certification est émis (informatif, R39)." },
  { cle: "trainingCompletionValidation", type: "json", defaut: { mode: "AUTO" }, regle: "R235", requis: false,
    exemple: { mode: "VALIDATED", role: "CF" },
    description: "Mode de validation de complétion : { mode: AUTO } (attestation suffit) ou { mode: VALIDATED, role } (visa uniforme R15 ; l'auteur ne valide pas sa propre complétion, R13)." },
  { cle: "trainingVisibiliteRoles", type: "json", defaut: ["CO", "CF", "ADMIN"], regle: "R236", requis: false,
    description: "Rôles qui voient TOUS les dossiers formation du tenant (Compliance/RH). Les autres voient leur périmètre (soi + équipe si responsable — R236)." },
  // ── Business Trip — MOD-75 (R222→R230, lot 51). Le référentiel cross-border, la matrice
  //    d'approbation et les sévérités sont des règles : réglés par le registre (R7/R125). ──
  { cle: "tripCrossBorderReferentiel", type: "json", defaut: [], regle: "R223", requis: false,
    exemple: [{ jurisdiction: "SA", activite: "sollicitation", verdict: "INTERDITE", depuisLe: "2026-01-01" }],
    description: "LE country manual (R293 : enrichi — jamais un second référentiel) : verdict AUTORISEE|INTERDITE|SOUMISE_A_LICENCE par (juridiction, activité), versionné par date d'effet (R229), avec licence/source/dateAvis (référence du mémo juridique — la banque assume sa position, O-Live la structure). Juridiction absente = NON DÉTERMINÉ (default-deny). L'avis ne décide pas — l'approbation reste humaine (R223)." },
  { cle: "tripKycCheckSeverity", type: "string", defaut: "INFORMATIF", regle: "R224", requis: false,
    description: "Sévérité si un client visité n'a pas de KYC approuvé : INFORMATIF ou BLOQUANT_APPROBATION (R224)." },
  { cle: "tripApprovalMatrix", type: "json", defaut: ["DIR"], regle: "R225", requis: false,
    description: "Rôles approbateurs d'un voyage (visa uniforme R15). Une destination à risque ajoute un visa COMPLIANCE (R225)." },
  { cle: "tripJuridictionsRisque", type: "json", defaut: [], regle: "R225", requis: false,
    description: "Juridictions à risque : une destination listée ajoute un visa COMPLIANCE à l'approbation (R225)." },
  { cle: "tripContactReportDeadlineDays", type: "int", defaut: 5, regle: "R226", requis: false,
    description: "Délai (jours) après le voyage pour produire un contact report par visite (mesuré, jamais coercitif — R226/R39)." },
  { cle: "tripCertificationRequise", type: "json", defaut: [], regle: "R228", requis: false,
    exemple: [{ jurisdiction: "AE", code: "CROSS_BORDER_AE" }],
    description: "Certifications exigées par juridiction (résolues depuis MOD-43 à la date du voyage, R228/R237)." },
  { cle: "tripCertificationCheckSeverity", type: "string", defaut: "INFORMATIF", regle: "R228", requis: false,
    description: "Sévérité si une certification requise est absente/expirée à la date du voyage (R228)." },
  // ── Service Tâches — MOD (R239→R242, lot 52). Création manuelle, visibilité et habilitation
  //    de complétion sont des règles : réglées par le registre (R7/R125). ──
  { cle: "taskManualCreation", type: "bool", defaut: false, regle: "R239", requis: false,
    description: "La création manuelle de tâche est-elle autorisée ? (sinon une tâche naît uniquement d'un événement, R239)." },
  { cle: "taskVisibiliteRoles", type: "json", defaut: ["CO", "CF", "ADMIN"], regle: "R240", requis: false,
    description: "Rôles qui voient TOUTES les tâches du tenant. Les autres voient leur périmètre (soi + équipe si responsable — R240)." },
  { cle: "taskCompleteRoles", type: "json", defaut: [], regle: "R241", requis: false,
    description: "Rôles habilités à compléter une tâche EN PLUS de l'assignee (contrôle exclusivement serveur, R241)." },
  // ── Décision NBA — MOD (R243→R246, lot 53). TTL et exigence de motif de rejet sont des règles. ──
  { cle: "nbaTtlDays", type: "int", defaut: 30, regle: "R243", requis: false,
    description: "Durée de vie (jours) d'une suggestion NBA — au-delà elle expire et n'est plus décidable (R243)." },
  { cle: "nbaRejectRationaleRequired", type: "bool", defaut: false, regle: "R244", requis: false,
    description: "Un rejet de suggestion NBA exige-t-il un motif ? (R244)." },
  // ── Cross-border — R293-R295 (canon triage final, ratifié 2026-07-28). ──
  { cle: "visa_derogation_xb", type: "string", defaut: "DIR", regle: "R294", requis: false,
    description: "Rôle qui vise une dérogation cross-border (R13 : l'initiateur exclu). Le canon dit LEGAL — rôle absent du RBAC tenant : mappé DIR (consigné)." },
  { cle: "preuve_reverse_solicitation", type: "string", defaut: "declaration", regle: "R295", requis: false,
    description: "Exigence de preuve pour la reverse solicitation : declaration (tracée, suffit) ou preuve (référence GED toujours obligatoire). En EDD, la preuve est TOUJOURS exigée." },
  // ── Extension MOD-30 / SSO — R290 (ratifié 2026-07-28). ──
  { cle: "ssoOidc", type: "json", defaut: null, regle: "R290", requis: false,
    exemple: { issuer: "https://login.banque.ch/realms/olive", audience: "olive-app", roleMapping: { "grp-co": "CO" }, defaultRole: "RM" },
    description: "Config OIDC DÉCLARÉE du tenant (issuer, audience, mapping claims→rôles) — JAMAIS de secret ici : le client_secret vit au coffre/env, l'état ne dit que « configuré/absent » (IM-01)." },
  { cle: "sso_mode", type: "string", defaut: "jwt", regle: "R290", requis: false,
    description: "Mode d'authentification du tenant (jwt | sso). NE S'ÉCRIT QUE par la bascule four-eyes (POST /v1/admin/sso/mode + visa d'un second, R13) — versionnée à date (R68/R126)." },
  { cle: "sso_bascule_coupe_sessions", type: "bool", defaut: false, regle: "R290", requis: false,
    description: "La bascule de mode coupe-t-elle les sessions ouvertes ? Défaut faux : les jetons émis restent vérifiables jusqu'à expiration (grâce JWKS — structurel, IM-04)." },
  // ── Solde 4 écarts — R326/R327 i18n (ratifié 2026-07-29). ──
  { cle: "tenant_langue_defaut", type: "string", defaut: "FR", regle: "R327", requis: false,
    description: "Langue par défaut du tenant (FR|DE|EN|IT) : préférence UI par défaut des utilisateurs et repli de `corrLang` pour les documents générés (LN-05 : le courrier suit le DESTINATAIRE, jamais la locale de l'opérateur)." },
  { cle: "langues_actives_ui", type: "json", defaut: ["FR", "DE", "EN", "IT"], regle: "R327", requis: false,
    description: "Langues d'interface proposées aux utilisateurs du tenant. La DONNÉE métier n'est JAMAIS traduite (LN-03) ; le paramétrage du tenant se traduit par le tenant lui-même (LN-04, colonnes multilingues fr obligatoire)." },
  // ── Solde 4 écarts — R324/R325 CONTRAT DORMANT (étape 0 ratifiée 2026-07-29) : le
  //    snapshot/cache ne s'ACTIVENT que si la jauge R250 refranchit cpsi_replay_warn_ms
  //    (état au jour de ratification : 103.7 ms pour 10 001 evts). Les clés portent le
  //    contrat ; le mécanisme viendra avec PC-21..25. ──
  { cle: "snapshot_interval_events", type: "int", defaut: 1000, regle: "R324", requis: false,
    description: "CONTRAT DORMANT R324 : période (en événements) de production d'un snapshot — projection JETABLE du journal (état + watermark seq + version de config + contract_version), jamais une source. Équivalence prouvée en continu (PC-20), invalidation automatique, purge indolore. Sans effet tant que l'optimisation n'est pas déclenchée par la jauge R250." },
  { cle: "engine_cache_actif", type: "bool", defaut: false, regle: "R325", requis: false,
    description: "CONTRAT DORMANT R325 : cache d'instance moteur par tenant — commodité RÉVOCABLE (watermark comparé À CHAQUE lecture, jamais une lecture en retard) ; le chemin utilisé est déclaré dans les meta R250 (replay_complet | snapshot+queue | cache). Défaut FAUX ; sans effet tant que l'optimisation n'est pas déclenchée." },
  { cle: "engine_cache_ttl_s", type: "int", defaut: 300, regle: "R325", requis: false,
    description: "CONTRAT DORMANT R325 : TTL (secondes) du cache d'instance. Un cache invalide ou absent = retour au chemin R324/rejeu — aucun chemin de code distinct pour le RÉSULTAT, seulement pour la latence." },
  // ── Dégel vague 9 — Octopulse OpRisk R321-R323 (ratifié 2026-07-28). ──
  { cle: "oprisk_taxonomie", type: "json", regle: "R321", requis: false,
    defaut: ["FRAUDE_INTERNE", "FRAUDE_EXTERNE", "PRATIQUES_EMPLOI", "CLIENTS_PRODUITS_PRATIQUES",
      "DOMMAGES_ACTIFS", "INTERRUPTION_SYSTEMES", "EXECUTION_PROCESSUS"],
    description: "Taxonomie Bâle des incidents opérationnels (paramètre TENANT — défaut : les 7 catégories de niveau 1). La classification est OBLIGATOIRE à la déclaration ; hors taxonomie = refus typé (default-deny). La heatmap R322 se calcule PAR catégorie de cette liste." },
  { cle: "oprisk_escalade_jours", type: "int", defaut: 7, regle: "R323", requis: false,
    description: "Jours de retard d'une action du plan au-delà desquels la notification owner (R274) s'ESCALADE à DIR. Le retard est un fait calculé — mesuré, notifié, jamais bloquant (R39)." },
  // ── Dégel vague 7 — Mobile Banking R316-R318 (GO Ali 2026-07-28). ──
  { cle: "mobile_actif", type: "bool", defaut: false, regle: "R316", requis: false,
    description: "Le canal mobile du tenant. OFF par défaut : TOUTE la surface mobile répond 404 (existence cachée — jamais un 403). L'activation d'un client reste un acte du RM + code hors bande, tracé (MB-02)." },
  { cle: "mobile_partage_defaut", type: "json", defaut: [], regle: "R318", requis: false,
    exemple: ["RELEVE"],
    description: "Catégories de pièces (typeCode GED) partagées PAR DÉFAUT au client mobile. VIDE par défaut : RIEN n'est visible sans acte de marquage explicite tracé (mobile.partage.marque). Aucune donnée compliance ne peut y figurer — la projection mobile est minimale (OL-34/R270)." },
  // ── Dégel vague 6 — BI libre R314-R315 (ratifié 2026-07-28). ──
  { cle: "bi_seuil_export", type: "int", defaut: 10000, regle: "R315", requis: false,
    description: "Seuil de lignes au-delà duquel un export BI devient un ACTE D'AUDIT : AUDIT_ACCESS (qui, quelle requête, combien) notifié SO — l'export reste SERVI, jamais bloqué (R39)." },
  // ── Dégel vague 4 — Regwatch R309-R311 (ratifié 2026-07-28). ──
  { cle: "regwatch_sources", type: "json", defaut: [], regle: "R309", requis: false,
    exemple: [{ code: "FINMA", libelle: "Communications FINMA", credentials: true }],
    description: "Sources de veille réglementaire (PORTS déclarés) : sans credentials (coffre), la source est ÉTEINTE — affichée, jamais cassée (R167). Chaque item collecté est un événement dédupliqué par empreinte." },
  // ── Dégel vague 3 — Builder R304-R308 (GO Ali 2026-07-28). ──
  { cle: "roles_publication_builder", type: "json", defaut: ["ADMIN", "CO_SR"], regle: "R307", requis: false,
    description: "Rôles habilités à PUBLIER un artefact du Builder (section, questionnaire, workflow). L'auteur du brouillon ne publie jamais le sien (R13) ; la publication exige la simulation du contenu exact (R305) et grave une version datée (R304)." },
  // ── Dégel vague 2 — R302 registre nominatif (ratifié 2026-07-28). ──
  { cle: "ta_visas_par_type", type: "json", defaut: {}, regle: "R302", requis: false,
    exemple: { NANTISSEMENT: "CO", RADIATION: "CO_SR" },
    description: "Visa exigé PAR TYPE de mouvement nominatif (rôle) : un mouvement en attente de visa n'est PAS au registre ; l'initiateur ne vise jamais (R13). Vide = aucun visa exigé." },
  // ── Login deux temps — R296 (canon triage final, ratifié 2026-07-28). ──
  { cle: "loginDomaines", type: "json", defaut: [], regle: "R296", requis: false,
    exemple: ["gwb.ch", "gwb-private.ch"],
    description: "Domaines e-mail du tenant pour la résolution AU LOGIN (temps 1 : email → méthode). Un domaine inconnu répond la MÊME forme que LOCAL (indistinguable, pattern OL-34) — jamais une existence révélée." },
  { cle: "sso_fallback_local", type: "bool", defaut: false, regle: "R296", requis: false,
    description: "Repli mot de passe local quand l'IdP est indisponible ? Défaut FAUX : l'indisponibilité est une ERREUR TYPÉE, jamais un repli silencieux. Le changement se motive au registre (four-eyes du changement = extension consignée v1)." },
  // ── Dégel vague 1 — R299 FX / R300 SWIFT (ratifiés 2026-07-28). ──
  { cle: "fx_seuils_exposition", type: "json", defaut: {}, regle: "R299", requis: false,
    exemple: { USD: 1000000, EUR: 2000000 },
    description: "Seuils d'attention d'exposition PAR DEVISE : franchi = événement fx.seuil.franchi NOTIFIÉ (R39) — l'exposition reste servie, rien n'est jamais bloqué. Aucune opération de change n'existe." },
  { cle: "swift_types_actifs", type: "json", defaut: ["MT103", "MT202", "pacs.008"], regle: "R300", requis: false,
    description: "Bibliothèque de types de messages SWIFT que le laboratoire PARSE (MT/MX). Un type hors liste part en quarantaine motivée (pattern R169) — jamais deviné. L'émission n'existe pas, structurellement." },
  { cle: "breakGlassComptes", type: "json", defaut: [], regle: "R296", requis: false,
    exemple: ["secours@gwb.ch"],
    description: "Comptes de secours (break-glass) : login LOCAL possible même en mode SSO — MFA OBLIGATOIRE, chaque usage audité (BREAK_GLASS_LOGIN) et notifié SO/DIR. Jamais une dégradation de sécurité silencieuse." },
  // ── Command Center — R289 (canon triage écrans HTML, ratifié 2026-07-28). ──
  { cle: "command_seuils", type: "json", defaut: {}, regle: "R289", requis: false,
    exemple: { sla_en_retard: 5 },
    description: "Seuils d'attention du Command Center, par indicateur : atteint = la tuile se COLORE (ambre/rouge) — jamais un blocage (R39). Les notifications restent celles des modules ratifiés." },
  // ── Barèmes de scoring KYC — R288 (ratifié 2026-07-28). ──
  { cle: "kycScoringBareme", type: "json", defaut: [], regle: "R288", requis: false,
    exemple: [{ depuisLe: "2026-08-01", structurePts: { PP: 0, HOLDING: 35 }, accountPts: { CURRENT: 0, ADVISORY: 5 },
      paysRisque: ["IR", "KP"], paysRisquePts: 40, seuilEdd: 40, seuilCdd: 25 }],
    description: "Barème de scoring KYC versionné par date d'effet (pattern workloadBareme) : points par structure/compte, pays à risque, seuils EDD/CDD. Vide = barème par défaut du moteur. Un dossier garde à vie le score du barème de SA création (R29) — jamais rétroactif ; le bac sbbrm simule un barème hypothétique sans rien écrire (BS-08)." },
  // ── Transport asynchrone — R286 (canon SO + transport async, ratifié 2026-07-28). ──
  { cle: "retry_max", type: "int", defaut: 5, regle: "R286", requis: false,
    description: "Tentatives de consommation d'un événement avant dead-letter (retry borné — jamais un exactly-once prétendu)." },
  { cle: "backoff_base_s", type: "int", defaut: 10, regle: "R286", requis: false,
    description: "Base (secondes) du backoff exponentiel entre tentatives de consommation." },
  { cle: "dead_letter_alerte_seuil", type: "int", defaut: 1, regle: "R286", requis: false,
    description: "Nombre d'événements en souffrance à partir duquel l'alerte est émise (défaut 1 : notifié dès la première — R39, notifie sans jamais bloquer)." },
  { cle: "cumul_so_admin_interdit", type: "bool", defaut: true, regle: "R284", requis: false,
    description: "Refuser qu'un même utilisateur cumule SO (surveille les journaux) et ADMIN (paramètre) — séparation structurelle des regards. Une petite banque peut assouplir : le cumul devient accepté ET tracé (événement iam.cumul_so_admin.autorise)." },
  // ── Questionnaires de review — R283 (canon écarts anciens, ratifié 2026-07-28). ──
  { cle: "reviewProfiles", type: "json", defaut: [], regle: "R283", requis: false,
    exemple: [{ type: "AR", niveau: "CDD", sectionsActives: ["SOF", "AML"],
      questionsRequises: ["SOF-Q2"], sectionsReconfirmation: ["IDENTITY"] }],
    description: "Profils de review (AR|GAR × SDD|CDD|EDD) : la review N'A PAS son propre questionnaire — elle SÉLECTIONNE dans le gabarit KYC (sections actives, questions requises ajoutées, sections en re-confirmation simple). Versionné par le registre, figé au lancement (R29) ; droits = matrice R282, jamais une matrice parallèle." },
  // ── AML gap waves 1+2 (R340→R403) — 80 paramètres tenant des 64 règles (action 5 du journal
  //    2026-08-04). GÉNÉRÉS du référentiel par tools/aml-gap/gen_aml_gap.py : le questionnaire
  //    d'onboarding se génère, jamais saisi à la main. `tenant` = requis, pas de défaut silencieux. ──
  ...AML_GAP_RQ,
];

const bonType = (t: Entree["type"], v: any) =>
  t === "int" ? Number.isInteger(v)
  : t === "bool" ? typeof v === "boolean"
  : t === "string" ? typeof v === "string"
  : v !== null && typeof v === "object";

@Injectable()
export class ParametresService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async tenant(tx: Tx, ctx: Ctx) {
    const t = await tx.tenant.findFirst({ where: { id: ctx.tenantId } });
    if (!t) throw new NotFoundException("Tenant introuvable");
    return t;
  }

  // ── R125 / RQ-02 : le questionnaire se GÉNÈRE du registre ──
  async registre() { return REGISTRE_RQ; }

  // ── R125/R126 / RQ-01,03,04 : LE chemin d'écriture — typé, motivé, daté, jamais rétroactif ──
  async ecrire(ctx: Ctx, cle: string, valeur: any, motif: string, effetAt?: string) {
    const entree = REGISTRE_RQ.find((e) => e.cle === cle);
    if (!entree) throw new BadRequestException(`R125 : clé inconnue du registre — «${cle}»`);
    if (!bonType(entree.type, valeur))
      throw new BadRequestException(`R125 : type ${entree.type} attendu pour «${cle}»`);
    if (!motif || !motif.trim())
      throw new BadRequestException("R7 : changer un paramètre est changer une règle — motif obligatoire");
    const effet = effetAt ?? new Date().toISOString();
    if (new Date(effet).getTime() < Date.now() - 60_000)
      throw new BadRequestException("R126 : effet rétroactif refusé — on ne réécrit pas le passé (R48)");
    return this.prisma.$transaction(async (tx: Tx) => {
      const t = await this.tenant(tx, ctx);
      const avant = await this.valeurEffectiveTx(tx, ctx, cle, new Date());
      await tx.tenantParamChange.create({ data: { tenantId: ctx.tenantId, cle,
        avant, apres: valeur, motif: motif.trim(), par: ctx.userId,
        at: new Date().toISOString(), effetAt: effet } });                       // VÉRITÉ append-only
      if (new Date(effet).getTime() <= Date.now()) {                             // matérialisation immédiate
        const settings = { ...(t.settings as any), [cle]: valeur };
        await tx.tenant.update({ where: { id: t.id }, data: { settings } });
      }                                                                          // sinon : tickEffets
      await this.emit(tx, ctx.tenantId, "param.change", cle,
        { avant, apres: valeur, par: ctx.userId, motif: motif.trim(), effetAt: effet });
      await this.audit.log(ctx.tenantId, ctx.userId, "PARAM_CHANGED", `${cle}`);
    });
  }

  // ── R127 / RQ-05 : la valeur d'alors — reconstruite des changements, sinon le défaut ──
  private async valeurEffectiveTx(tx: Tx, ctx: Ctx, cle: string, date: Date) {
    const chgs = (await tx.tenantParamChange.findMany({ where: { tenantId: ctx.tenantId, cle } }))
      .filter((c: any) => new Date(c.effetAt) <= date)
      .sort((a: any, b: any) => new Date(a.effetAt).getTime() - new Date(b.effetAt).getTime());
    if (chgs.length) return chgs[chgs.length - 1].apres;
    return REGISTRE_RQ.find((e) => e.cle === cle)?.defaut ?? null;
  }
  async valeurEffective(ctx: Ctx, cle: string, date: Date) {
    await this.tenant(this.prisma, ctx);
    return this.valeurEffectiveTx(this.prisma, ctx, cle, date);
  }
  async configALaDate(ctx: Ctx, date: Date) {
    await this.tenant(this.prisma, ctx);
    const cfg: Record<string, any> = {};
    for (const e of REGISTRE_RQ) cfg[e.cle] = await this.valeurEffectiveTx(this.prisma, ctx, e.cle, date);
    return cfg;
  }

  // ── R126 : tick — applique les effets différés atteints (matérialise la vue courante) ──
  async tickEffets(ctx: Ctx, now: Date) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const t = await this.tenant(tx, ctx);
      const settings = { ...(t.settings as any) };
      let touche = false;
      for (const e of REGISTRE_RQ) {
        const v = await this.valeurEffectiveTx(tx, ctx, e.cle, now);
        if (v !== null && JSON.stringify(settings[e.cle]) !== JSON.stringify(v) && v !== e.defaut) {
          settings[e.cle] = v; touche = true;
          await this.emit(tx, ctx.tenantId, "param.effet.applique", e.cle, { valeur: v });
        }
      }
      if (touche) await tx.tenant.update({ where: { id: t.id }, data: { settings } });
    });
  }

  // ── R128 / RQ-06 : pas de go-live sur un questionnaire troué ──
  async activer(ctx: Ctx, signataire: string) {
    if (!signataire || !signataire.trim())
      throw new BadRequestException("R128 : signature du répondant bancaire obligatoire");
    return this.prisma.$transaction(async (tx: Tx) => {
      const t = await this.tenant(tx, ctx);
      const manquants: string[] = [];
      for (const e of REGISTRE_RQ.filter((x) => x.requis)) {
        const v = await this.valeurEffectiveTx(tx, ctx, e.cle, new Date());
        if (v === null || v === undefined) manquants.push(e.cle);
      }
      if (manquants.length)
        throw new BadRequestException(`R128 : questionnaire R-Q incomplet — requis manquants : ${manquants.join(", ")}`);
      await tx.tenant.update({ where: { id: t.id }, data: { statut: "ACTIF",
        rqSignePar: signataire.trim(), rqSigneAt: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "tenant.active", t.id, { signePar: signataire.trim(), par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "TENANT_ACTIVATED", t.id);
      return { statut: "ACTIF" };
    });
  }
}
