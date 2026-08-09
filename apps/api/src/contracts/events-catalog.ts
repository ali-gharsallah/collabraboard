/**
 * CATALOGUE D'ÉVÉNEMENTS AU WRITE (P-L5-2, dette C6 · R339/EV). Le catalogue régit l'ÉCRITURE :
 * emitEvent (common/domain-event.ts) valide le payload contre le schéma zod AVANT insertion —
 * échec = exception typée, JAMAIS d'écriture partielle — et pose eventVersion depuis le catalogue.
 * Les événements DÉJÀ stockés ne sont jamais touchés (R49) : la lecture reste régie par les
 * upcasters (modules/events/upcasters.ts).
 *
 * MIGRATION DOUCE (docs/notes/L5-events-todo.md) : les types listés dans TYPES_EN_ATTENTE (inventaire
 * généré des littéraux émis au code) passent SANS validation (eventVersion défaut 1) tant qu'ils
 * n'ont pas reçu leur schéma. Un type ABSENT des deux listes est REFUSÉ — un événement ne s'invente
 * pas au write. Faire évoluer un payload = nouvelle version ici + upcaster à la lecture, jamais un
 * UPDATE des lignes existantes.
 */
import { z } from "zod";

export type EntreeCatalogue = { version: number; schema: z.ZodTypeAny };

// ── Schémas STRICTS (v-courante) — noyau KYC (verrou R84 · passage de main R85) + screening/PEP ──
export const SCHEMAS_EVENEMENTS: Record<string, EntreeCatalogue> = {
  "kyc.lock.acquired":     { version: 1, schema: z.object({ code: z.string(), holder: z.string() }).strict() },
  "kyc.lock.released":     { version: 1, schema: z.object({ code: z.string(), by: z.string() }).strict() },
  "kyc.handoff.next":      { version: 1, schema: z.object({ code: z.string(), to: z.string(), by: z.string(), message: z.string() }).strict() },
  "kyc.handoff.back":      { version: 1, schema: z.object({ code: z.string(), to: z.string(), by: z.string(), message: z.string() }).strict() },
  "kyc.handoff.validated": { version: 1, schema: z.object({ code: z.string(), by: z.string(), message: z.string() }).strict() },
  "kyc.handoff.rejected":  { version: 1, schema: z.object({ code: z.string(), by: z.string(), message: z.string() }).strict() },
  "olivia.curseur.change": { version: 1, schema: z.object({ capacite: z.string(), niveau: z.string(),
    precedent: z.string(), par: z.string() }).strict() },
  "mros.goaml.soumis": { version: 1, schema: z.object({ reference: z.string(), par: z.string() }).strict() },
  "mros.chrono.alerte": { version: 1, schema: z.object({ communicationId: z.string(), joursOuvres: z.number(), echeanceJours: z.number() }).strict() },
  // ── Vague 1 de schématisation (2026-08-08) : familles mros.* / trip.* / training.* —
  // schémas = payloads RÉELS des sites d'émission (mros.service, businesstrip, formations).
  "mros.decision": { version: 1, schema: z.object({ decision: z.string(), motif: z.string(),
    par: z.string(), riskCaseId: z.string(), dossierSha256: z.string() }).strict() },
  "mros.notification": { version: 1, schema: z.object({ notification: z.string(), par: z.string() }).strict() },
  "mros.gel.pose": { version: 1, schema: z.object({ motif: z.string(), echeance: z.string(),
    par: z.string() }).strict() },
  "mros.gel.leve": { version: 1, schema: z.object({ motif: z.string(), par: z.string() }).strict() },
  // gelEcheance sort de Prisma en instance Date (DateTime) — validé AVANT sérialisation JSON
  "mros.gel.echeance": { version: 1, schema: z.object({ echeance: z.union([z.string(), z.date()]) }).strict() },
  "mros.acces": { version: 1, schema: z.object({ par: z.string() }).strict() },
  "mros.acces.refuse": { version: 1, schema: z.object({ par: z.string(), role: z.string() }).strict() },
  // Bloc 63 (R446) : soumission ENRICHIE — chaîne résolue risque×budget FIGÉE dans l'événement
  // de création (grandfathering R29) ; champs optionnels, les événements historiques restent valides.
  "trip.submitted": { version: 1, schema: z.object({ destinations: z.array(z.string()),
    avis: z.number(), signaux: z.number(),
    chaine: z.array(z.string()).optional(), budget: z.number().nullish(),
    origineChaine: z.object({ risque: z.string(), budget: z.number().nullish(),
      seuilBudgetHPB: z.number(), hpbAjoute: z.boolean() }).optional() }).strict() },
  "trip.visa.signed": { version: 1, schema: z.object({ role: z.string(), par: z.string(),
    motivation: z.string().optional() }).strict() },      // Bloc 63 (R447) : dérogation motivée sur avertissement
  "trip.approved": { version: 1, schema: z.object({}).strict() },
  "trip.revised": { version: 1, schema: z.object({ depuis: z.string(), revision: z.number() }).strict() },
  "trip.contactreports.manquants": { version: 1, schema: z.object({ manquants: z.array(z.string()) }).strict() },
  // ── Bloc 63 (repo R446–R452 + R465) — business trip AU MOTEUR : check consigné/invalidé,
  //    certificat de trip, relances SLA, prospect né en voyage. Payloads RÉELS des sites d'émission.
  "trip.check.consigne": { version: 1, schema: z.object({ juridictions: z.array(z.string()),
    parActivite: z.array(z.any()), referentielVersion: z.string(), at: z.string() }).strict() },   // R448 : la preuve
  "trip.check.invalide": { version: 1, schema: z.object({ cause: z.string() }).strict() },          // R448 : invalidation tracée
  "trip.certificat.soumis": { version: 1, schema: z.object({ par: z.string(), role: z.string(),
    validateurResolu: z.string(), activitesParJuridiction: z.record(z.array(z.string())),
    rencontres: z.array(z.object({ clientId: z.string(), contactReportId: z.string() }).strict()),
    ecarts: z.array(z.any()), narratif: z.string(), prospectsNes: z.array(z.any()) }).strict() },   // R450
  "trip.certificat.vise": { version: 1, schema: z.object({ par: z.string(), role: z.string() }).strict() },
  "trip.certificat.qualification.demandee": { version: 1, schema: z.object({
    ecarts: z.array(z.any()), par: z.string() }).strict() },                                        // R450/R44 : analyse humaine
  "trip.certificat.relance": { version: 1, schema: z.object({ joursRetard: z.number(),
    notifie: z.string() }).strict() },                                                              // R450 : SLA tracé
  "trip.cloture": { version: 1, schema: z.object({ par: z.string() }).strict() },                   // R450 : le certificat clôt
  "trip.prospect.ne": { version: 1, schema: z.object({ clientId: z.string(), contactReportId: z.string(),
    nom: z.string(), verdictProsp: z.any() }).strict() },                                           // R465 : origine tracée
  // ── Bloc 64 (repo R453–R462) — matrice versionnée, checks au moment de l'acte, registre RS,
  //    localisation, impact. Payloads RÉELS des sites d'émission (xb.module.ts).
  "MATRIX_SYNCED": { version: 1, schema: z.object({ versionId: z.string(), source: z.string(),
    entrees: z.array(z.any()), diff: z.array(z.object({ jurisdiction: z.string(), activite: z.string(),
      ancien: z.string().nullable(), nouveau: z.string() }).strict()), at: z.string() }).strict() },  // R453
  "xb.matrice.sync.echec": { version: 1, schema: z.object({ source: z.string(), erreur: z.string(),
    at: z.string() }).strict() },                                                                    // R453 : jamais silencieux
  "xb.tache.creee": { version: 1, schema: z.object({ type: z.string(),
    voyageId: z.string().optional(), assigneRole: z.string().optional(), rm: z.string().optional(),
    contactReportId: z.string().optional(), clientId: z.string().optional(),
    perimetre: z.string().nullish() }).strict() },                                                   // R453/R454/R456/R459
  "xb.impact.notifie": { version: 1, schema: z.object({ versionId: z.string(),
    clientsAffectes: z.number(), voyagesARevoir: z.number(), preuvesInsuffisantes: z.number() }).strict() },   // R459
  "xb.preacte.verdict": { version: 1, schema: z.object({ type: z.string(), clientId: z.string(),
    juridiction: z.string(), verdict: z.string(), passe: z.boolean(), versionMatrice: z.string(),
    at: z.string(), perimetre: z.string().optional(), condition: z.string().optional(),
    preuveId: z.string().optional(), mention: z.string().optional(), motif: z.string().optional() }).strict() },   // R455
  "xb.rs.enregistree": { version: 1, schema: z.object({ clientId: z.string(), perimetre: z.string(),
    nature: z.string(), docId: z.string(), date: z.string(), par: z.string() }).strict() },          // R456
  "xb.rs.visee": { version: 1, schema: z.object({ par: z.string() }).strict() },
  "xb.localisation.declaree": { version: 1, schema: z.object({ juridiction: z.string(),
    du: z.string(), au: z.string(), par: z.string() }).strict() },                                   // R457
  // ── Vague 3 (C6, 2026-08-08) — aml.* + cpsi.* réellement émis via emitEvent. Schémas tirés
  //    des payloads RÉELS (aml.service, aml-gap.service, aml-eval.service, cpsi.module).
  //    NB : les 11 littéraux cpsi.* restants du scan vivent dans le journal JUMEAU cpsi_events
  //    (moteur pur, rejouable) — jamais écrits via emitEvent, ils restent en attente (sur-capture
  //    assumée, cf. docs/notes/L5-events-todo.md).
  "aml.signal.leve": { version: 1, schema: z.object({ clientId: z.string(), type: z.string(),
    regle: z.string(), niveau: z.number(), bloquant: z.boolean() }).strict() },                      // R189→R206
  "aml.operation.bloquee": { version: 1, schema: z.object({ regles: z.array(z.string()) }).strict() },   // niveau 1 = suspension
  "aml.signal.raised": { version: 1, schema: z.object({ scenarioCode: z.string(),
    scenarioVer: z.number(), ruleRef: z.string(), clientId: z.string().nullable(),
    niveau: z.number().nullish(), blocking: z.boolean() }).strict() },                               // AML Gap (R340+)
  "aml.block.requested": { version: 1, schema: z.object({ scenarioCode: z.string(),
    ruleRef: z.string(), clientId: z.string().nullable(), motif: z.string() }).strict() },           // R44 : demandé, jamais exécuté
  "aml.signal.qualified": { version: 1, schema: z.object({ scenarioCode: z.string(),
    outcome: z.enum(["TP", "FP"]), motif: z.string(), par: z.string() }).strict() },                 // R7 : motif obligatoire
  "aml.eval.version_compared": { version: 1, schema: z.object({ overrides: z.any(),
    recallBefore: z.number(), recallAfter: z.number(), degradation: z.boolean(),
    regressions: z.number(), par: z.string() }).strict() },                                          // R375 : rollback PROPOSÉ
  "aml.eval.completed": { version: 1, schema: z.object({ corpus: z.number(), evaluated: z.number(),
    raised: z.number(), recall: z.number(), via2G: z.number(), deferred2G: z.number(),
    par: z.string() }).strict() },                                                                   // backtest GT (R29)
  "cpsi.sla.depassement": { version: 1, schema: z.object({ cle: z.string(), jalon: z.string(),
    enAttenteMrosJours: z.number().nullable(), par: z.string() }).strict() },                        // R250
  "cpsi.case_proposal.emitted": { version: 1, schema: z.object({ cle: z.string(),
    par: z.string() }).strict() },                                                                   // R285/R286 : miroir outbox, at corrélé au jumeau
  // ── Vague 4 (C6, 2026-08-08) — ged.* intégral : ingestion (R137–R139), noyau documentaire
  //    (R108–R112), avancé (ancrage/QES/hold/destruction), vues (R164). Payloads RÉELS.
  "ged.ingest": { version: 1, schema: z.object({ canal: z.string(), source: z.string(),
    par: z.string(), nom: z.string() }).strict() },                                                  // R137 : l'arrivée est une pièce
  "ged.classement": { version: 1, schema: z.object({ typeCode: z.string(), clientId: z.string(),
    par: z.string(), retentionUntil: z.union([z.string(), z.date()]).nullable() }).strict() },       // R138
  "ged.ocr.derive": { version: 1, schema: z.object({ versionId: z.string(), moteur: z.string(),
    sha256Derive: z.string() }).strict() },                                                          // dérivé, jamais l'original
  "ged.inbox.acces.refuse": { version: 1, schema: z.object({ par: z.string(), role: z.string() }).strict() },   // R139
  "ged.inbox.sla": { version: 1, schema: z.object({ jours: z.number(), sla: z.number() }).strict() },   // R39 : mesuré, rien ne se classe seul
  "ged.version.creee": { version: 1, schema: z.object({ numero: z.number(), sha256: z.string(),
    deposant: z.string(), type: z.string() }).strict() },                                            // R108
  "ged.archive": { version: 1, schema: z.object({ motif: z.string(), par: z.string() }).strict() },
  "ged.acces": { version: 1, schema: z.object({ lecteur: z.string(), role: z.string(),
    version: z.number() }).strict() },                                                               // R112 : qui a vu quoi
  "ged.acces.refuse": { version: 1, schema: z.object({ lecteur: z.string(), role: z.string(),
    type: z.string() }).strict() },
  "ged.consultation.refusee": { version: 1, schema: z.object({ par: z.string(), role: z.string(),
    typeCode: z.string() }).strict() },                                                              // R110
  "ged.completude.verifiee": { version: 1, schema: z.object({ passage: z.string(), complet: z.boolean(),
    manquants: z.array(z.string()), expires: z.array(z.string()) }).strict() },                      // R110 : la GED constate
  // deposeAt/retentionUntil sortent de Prisma en instance Date — validés AVANT sérialisation JSON
  "ged.expiration.detectee": { version: 1, schema: z.object({ type: z.string(),
    deposeAt: z.union([z.string(), z.date()]), validiteMois: z.number() }).strict() },
  "ged.integrite.alerte": { version: 1, schema: z.object({ version: z.number(),
    attendu: z.string(), obtenu: z.string() }).strict() },                                           // altération = jamais authentique
  "ged.externe.indisponible": { version: 1, schema: z.object({ operation: z.string(),
    message: z.string() }).strict() },                                                               // R167 : le signal n'étouffe jamais le refus
  "ged.ancrage.cree": { version: 1, schema: z.object({ racine: z.string(), tsaToken: z.string(),
    versions: z.number() }).strict() },
  "ged.signature.qualifiee": { version: 1, schema: z.object({ version: z.number(),
    signataire: z.string(), evidenceId: z.string() }).strict() },
  "ged.classification.proposee": { version: 1, schema: z.object({ type: z.string(),
    expirationDetectee: z.any().nullish(), source: z.string() }).strict() },                         // R44 : rien n'est appliqué ici
  "ged.classification.confirmee": { version: 1, schema: z.object({ type: z.string(),
    par: z.string() }).strict() },
  "ged.destruction.proposee": { version: 1, schema: z.object({
    retentionUntil: z.union([z.string(), z.date()]).nullable(), type: z.string() }).strict() },      // R33/R44 : décision, jamais une échéance
  "ged.destruction.certifiee": { version: 1, schema: z.object({ motif: z.string(), par: z.string(),
    empreintes: z.array(z.string()) }).strict() },
  "ged.hold.pose": { version: 1, schema: z.object({ motif: z.string(), par: z.string(),
    docs: z.number() }).strict() },
  "ged.hold.leve": { version: 1, schema: z.object({ motif: z.string(), par: z.string(),
    docs: z.number() }).strict() },
  "ged.vue.creee": { version: 1, schema: z.object({ code: z.string(), par: z.string() }).strict() }, // R164
  "ged.vue.evaluee": { version: 1, schema: z.object({ code: z.string(), par: z.string(),
    role: z.string(), nbServis: z.number() }).strict() },
  "ged.vue.retiree": { version: 1, schema: z.object({ code: z.string(), par: z.string(),
    motif: z.string() }).strict() },
  "ged.vue.acces.refuse": { version: 1, schema: z.object({ par: z.string(), role: z.string() }).strict() },
  // ── Vague 5 (C6, 2026-08-08) — tache.* (signaux de travail R39/R44 : le système mesure et
  //    notifie, l'humain agit) + task.* (module Tâches R38). Payloads RÉELS des sites d'émission.
  "tache.aiguillage.edd": { version: 1, schema: z.object({ proposalId: z.string(),
    cibleType: z.string(), par: z.string() }).strict() },                                            // circuit R66 — la VOIE NORMALE
  "tache.allegement.edd": { version: 1, schema: z.object({ proposalId: z.string(),
    cibleType: z.string(), par: z.string() }).strict() },
  "tache.qualification.alerte": { version: 1, schema: z.object({ proposalId: z.string(),
    cibleType: z.string(), par: z.string() }).strict() },
  "tache.coffre.reconciliation": { version: 1, schema: z.object({ cle: z.string() }).strict() },     // R147 : l'écart est un FAIT d'audit
  "tache.core.resolution": { version: 1, schema: z.object({ compteCore: z.string().nullable() }).strict() },
  "tache.corroboration": { version: 1, schema: z.object({ dossier: z.string(), rm: z.string() }).strict() },
  "tache.ged.classement": { version: 1, schema: z.object({ nom: z.string() }).strict() },            // rien ne se classe seul (R39)
  "tache.ged.destruction": { version: 1, schema: z.object({ client: z.string().nullable() }).strict() },
  "tache.ged.renouvellement": { version: 1, schema: z.object({ type: z.string(),
    client: z.string().nullable() }).strict() },
  "tache.kyc.requalification": { version: 1, schema: z.object({ origine: z.string(),
    raisons: z.array(z.string()) }).strict() },
  "tache.legal.preavis": { version: 1, schema: z.object({ id: z.string(), reference: z.string(),
    dateFin: z.string(), tacite: z.boolean(), notifie: z.array(z.string()), par: z.string() }).strict() },
  "tache.maj_ged": { version: 1, schema: z.object({ document: z.string() }).strict() },
  "tache.onboarding.relance": { version: 1, schema: z.object({ etape: z.string(),
    rm: z.string().nullable() }).strict() },
  "tache.oprisk.action.retard": { version: 1, schema: z.object({ id: z.string(), incidentId: z.string(),
    titre: z.string(), echeance: z.string(), notifie: z.array(z.string()), par: z.string() }).strict() },
  "tache.personne.completion": { version: 1, schema: z.object({ nom: z.string() }).strict() },
  "tache.pms.regularisation": { version: 1, schema: z.object({ classe: z.string(),
    gerant: z.string() }).strict() },                                                                // jamais de rétrogradation auto
  "tache.pms.revue_mandat": { version: 1, schema: z.object({ client: z.string() }).strict() },
  "tache.reevaluation_pep": { version: 1, schema: z.object({ dossier: z.string() }).strict() },      // ADR-PEP-001 : l'humain décide
  "tache.regwatch.analyse": { version: 1, schema: z.object({ empreinte: z.string(), titre: z.string(),
    regles: z.array(z.string()), impact: z.any().nullish(), par: z.string() }).strict() },
  "tache.review.preavis": { version: 1, schema: z.object({ clientId: z.string(),
    dueDate: z.union([z.string(), z.date()]) }).strict() },
  "tache.review.escalade": { version: 1, schema: z.object({ clientId: z.string(),
    dueDate: z.union([z.string(), z.date()]), joursRetard: z.number(), vers: z.string() }).strict() },
  "tache.riskcase.relance": { version: 1, schema: z.object({ statut: z.string() }).strict() },       // jamais d'auto-clôture (R39)
  "task.created": { version: 1, schema: z.object({ origine: z.string(), type: z.string(),
    subjectId: z.string().nullable(), assignee: z.string().nullish() }).strict() },
  "task.created.manual": { version: 1, schema: z.object({ type: z.string(), par: z.string() }).strict() },
  "task.routed": { version: 1, schema: z.object({ role: z.string(), titulaire: z.string().nullish(),
    subjectId: z.string().nullable() }).strict() },
  "task.delegated": { version: 1, schema: z.object({ de: z.string().nullish(), vers: z.string(),
    par: z.string() }).strict() },                                                                   // R38 : de → vers, tracé
  "task.completed": { version: 1, schema: z.object({ acteur: z.string(),
    commentaire: z.string().nullable() }).strict() },                                                // append-only
  "task.sla.retard": { version: 1, schema: z.object({ dueAt: z.union([z.string(), z.date()]).nullable(),
    assignee: z.string().nullish() }).strict() },                                                    // R39 : signal, jamais coercition
  // ── Vague 6 (C6, 2026-08-08) — personne.* (fiche centrale R30→R36, liens R152, CoC/PEP
  //    propagés, ADR-PEP-001 : la dé-PEPisation est une DÉCISION humaine). Payloads RÉELS.
  "personne.creee": { version: 1, schema: z.object({ nom: z.string() }).strict() },
  "personne.creee.minimale": { version: 1, schema: z.object({ nom: z.string(), par: z.string() }).strict() },
  "personne.homonymie.signal": { version: 1, schema: z.object({ nom: z.string(),
    homonymeId: z.string() }).strict() },                                                            // R263 : signal, jamais fusion auto
  "personne.liee": { version: 1, schema: z.object({ dossier: z.string(), role: z.string() }).strict() },
  "personne.role.retire": { version: 1, schema: z.object({ dossier: z.string(), role: z.string() }).strict() },
  "personne.archivee": { version: 1, schema: z.object({ baseLegale: z.string() }).strict() },        // conservation LBA, jamais un effacement
  "personne.reactivee": { version: 1, schema: z.object({}).strict() },
  "personne.flag.pose": { version: 1, schema: z.object({ flag: z.string(), dossier: z.string(),
    cause: z.string() }).strict() },                                                                 // ex. insider par cumul de rôles
  "personne.coc.cree": { version: 1, schema: z.object({ champ: z.string() }).strict() },
  "personne.coc.propage": { version: 1, schema: z.object({ dossier: z.string(), champ: z.string() }).strict() },
  "personne.rescreening.declenche": { version: 1, schema: z.object({ cause: z.string() }).strict() },
  "personne.pep.propage": { version: 1, schema: z.object({ dossier: z.string() }).strict() },        // ADR-PEP-001
  "personne.alerte.depep": { version: 1, schema: z.object({}).strict() },                            // décision humaine ATTENDUE, jamais prise ici
  "personne.relation.declaree": { version: 1, schema: z.object({ b: z.string(), typeAb: z.string(),
    typeBa: z.string() }).strict() },
  "personne.relation.supprimee": { version: 1, schema: z.object({ b: z.string() }).strict() },
  "personne.lien.pose": { version: 1, schema: z.object({ par: z.string(), typeCode: z.string(),
    categorie: z.string(), cibleType: z.string(), cibleId: z.string() }).strict() },                 // R152
  "personne.lien.retrait": { version: 1, schema: z.object({ par: z.string(), typeCode: z.string(),
    motif: z.string() }).strict() },
  "personne.lien.acces.refuse": { version: 1, schema: z.object({ par: z.string(), role: z.string(),
    typeCode: z.string() }).strict() },
  // ── Vague 7 (C6, 2026-08-08) — ia.* (l'IA propose, l'humain décide R44/AI-04 : production
  // hachée R160, proposition sans écriture R161, décision humaine R162, résidence R163,
  // pré-revue R121) + islamic.* (signaux R207→R221 + calculateurs ledger AAOIFI) + pms.*
  // (drift/pré-trade/suitability R39 : le système mesure et alerte, jamais ne liquide).
  // Schémas tirés des payloads RÉELS (ia-ged.service.ts, prerevue.service.ts,
  // islamic.service.ts + islamic-screening.engine.ts, pms.service.ts).
  "ia.acces.refuse": { version: 1, schema: z.object({ motif: z.string(), exigee: z.string(),
    declaree: z.string(), par: z.string() }).strict() },
  "ia.production": { version: 1, schema: z.object({ par: z.string(), role: z.string(),
    docsServis: z.array(z.string()), shaContexte: z.string(), shaSortie: z.string(),
    modele: z.string() }).strict() },
  "ia.proposition": { version: 1, schema: z.object({ documentId: z.string(),
    confiance: z.number().nullable(), par: z.string() }).strict() },
  "ia.decision": { version: 1, schema: z.object({ decision: z.enum(["ACCEPTEE", "REJETEE"]),
    par: z.string(), motif: z.string().nullable() }).strict() },
  "ia.ecart": { version: 1, schema: z.object({ confiance: z.number().nullable(),
    motif: z.string() }).strict() },
  "ia.prerevue.produite": { version: 1, schema: z.object({ prerevueId: z.string(),
    points: z.number(), modele: z.string() }).strict() },
  "ia.point.traite": { version: 1, schema: z.object({ prerevueId: z.string(), index: z.number(),
    type: z.string(), motif: z.string().optional(), par: z.string() }).strict() },
  "ia.point.ecarte": { version: 1, schema: z.object({ prerevueId: z.string(), index: z.number(),
    type: z.string(), motif: z.string().optional(), par: z.string() }).strict() },
  "ia.prompt.versionne": { version: 1, schema: z.object({ numero: z.number(),
    par: z.string() }).strict() },
  "islamic.signal.leve": { version: 1, schema: z.object({ clientId: z.string(), type: z.string(),
    regle: z.string(), niveau: z.number(), bloquant: z.boolean() }).strict() },
  "islamic.operation.bloquee": { version: 1, schema: z.object({
    regles: z.array(z.string()) }).strict() },
  "islamic.zakat.calcule": { version: 1, schema: z.object({ clientId: z.string(),
    totalWealth: z.number(), nisab: z.number(), zakatDue: z.number(), taux: z.string(),
    status: z.string(), par: z.string() }).strict() },
  "islamic.mudaraba.distribue": { version: 1, schema: z.object({ clientId: z.string(),
    profit: z.number(), bankShare: z.number(), clientShare: z.number(), status: z.string(),
    par: z.string() }).strict() },
  "islamic.waqf.distribue": { version: 1, schema: z.object({ waqfId: z.string(),
    autorise: z.boolean(), income: z.number(), retrait: z.number(), source: z.string(),
    motif: z.string().optional(), par: z.string() }).strict() },
  "islamic.qard.suivi": { version: 1, schema: z.object({ principalOutstanding: z.number(),
    interet: z.number(), par: z.string() }).strict() },
  "islamic.takaful.suivi": { version: 1, schema: z.object({ premium: z.number(),
    destinataire: z.string(), partageProfit: z.string(), par: z.string() }).strict() },
  "islamic.sukuk.maturite": { version: 1, schema: z.object({ alerte: z.boolean(),
    joursAvantMaturite: z.number(), optionsRefinancement: z.array(z.string()),
    par: z.string() }).strict() },
  "islamic.audit.shariah": { version: 1, schema: z.object({ clientsIslamic: z.number(),
    transactions: z.number(), violations: z.number(), zakatDistribueChf: z.number(),
    compliancePct: z.number(), par: z.string() }).strict() },
  "pms.mandat.attache": { version: 1, schema: z.object({ client: z.string(),
    nom: z.string() }).strict() },
  "pms.drift.detecte": { version: 1, schema: z.object({ classe: z.string(), reelPct: z.number(),
    borne: z.tuple([z.number(), z.number()]), ecartBp: z.number() }).strict() },
  "pms.pretrade.bloque": { version: 1, schema: z.object({ instrument: z.string(),
    motif: z.string(), mandat: z.string() }).strict() },
  "pms.pretrade.ok": { version: 1, schema: z.object({ instrument: z.string(),
    resultantePct: z.number() }).strict() },
  "pms.suitability.alerte": { version: 1, schema: z.object({ client: z.string(),
    riskLevel: z.string(), profilRequis: z.string() }).strict() },
  "pms.breach.escalade": { version: 1, schema: z.object({ mandat: z.string(), detail: z.string(),
    destinataire: z.string() }).strict() },
  "pms.breach.clos": { version: 1, schema: z.object({ par: z.string(),
    motif: z.string() }).strict() },
  // ── Vague 8 (C6, 2026-08-09) — mobile.* (R316–R318 : identité hors bande, partage, messagerie)
  // + olivia.* (essaim R259–R266 : registres, portes humaines, saturation) + riskcase.*
  // (R133–R136/R280 : file d'alertes, transitions, SLA — jamais d'auto-clôture R39) + coffre.*
  // (R144–R147 : intégrité, purge certifiée, réconciliation = fait d'audit) + ocr.* (R174–R176 :
  // extraction typée, propositions — l'humain décide R44). Payloads RÉELS des sites d'émission.
  "mobile.identite.creee": { version: 1, schema: z.object({ identite: z.string(),
    clientId: z.string(), par: z.string() }).strict() },              // JAMAIS le code hors bande
  "mobile.identite.activee": { version: 1, schema: z.object({ identite: z.string(),
    clientId: z.string(), activeePar: z.string() }).strict() },       // JAMAIS le secret MFA
  "mobile.session.ouverte": { version: 1, schema: z.object({ identite: z.string(),
    clientId: z.string() }).strict() },
  "mobile.partage.marque": { version: 1, schema: z.object({ cible: z.string(), id: z.string(),
    clientId: z.string(), partage: z.boolean(), par: z.string() }).strict() },
  // deux émetteurs : banque (avec par) et client (sans par — l'auteur est l'identité mobile)
  "mobile.message": { version: 1, schema: z.object({ id: z.string(), clientId: z.string(),
    de: z.enum(["BANQUE", "CLIENT"]), texte: z.string(), par: z.string().optional() }).strict() },
  "mobile.message.traite": { version: 1, schema: z.object({ messageId: z.string(),
    clientId: z.string(), cocId: z.string(), par: z.string() }).strict() },
  "olivia.outil.declare": { version: 1, schema: z.object({ code: z.string(),
    endpointRef: z.string(), methode: z.string(), par: z.string() }).strict() },      // R264
  "olivia.agent.declare": { version: 1, schema: z.object({ code: z.string(),
    version: z.number(), gabaritRef: z.string(), par: z.string() }).strict() },       // R259
  "olivia.agent.retire": { version: 1, schema: z.object({ code: z.string(),
    version: z.number(), motif: z.string().nullable(), par: z.string() }).strict() },
  "olivia.runs.saturation": { version: 1, schema: z.object({ actifs: z.number(),
    plafond: z.number(), mission: z.string() }).strict() },                           // R262
  "olivia.run.porte": { version: 1, schema: z.object({ porte: z.string(),
    commanditaire: z.string() }).strict() },                                          // R263
  "olivia.run.porte.expiree": { version: 1, schema: z.object({ commanditaire: z.string(),
    timeoutH: z.number() }).strict() },
  // deux portes d'entrée : ouverture directe (signaux) et consommation d'une proposition CPSI (R280)
  "riskcase.ouvert": { version: 1, schema: z.object({ signaux: z.array(z.string()).optional(),
    depuisProposition: z.string().optional(), scenarios: z.array(z.string()).optional(),
    par: z.string() }).strict() },
  "riskcase.transition": { version: 1, schema: z.object({ de: z.string(), vers: z.string(),
    par: z.string(), motif: z.string().optional() }).strict() },
  "riskcase.note": { version: 1, schema: z.object({ noteId: z.string(),
    par: z.string() }).strict() },
  "riskcase.signal.rattache": { version: 1, schema: z.object({ signalId: z.string(),
    par: z.string() }).strict() },
  "riskcase.signal.detache": { version: 1, schema: z.object({ signalId: z.string(),
    motif: z.string(), par: z.string() }).strict() },
  "riskcase.sla.alerte": { version: 1, schema: z.object({ statut: z.string(),
    jours: z.number(), sla: z.number() }).strict() },                 // signale, ne clôt jamais (R39)
  "coffre.ecrit": { version: 1, schema: z.object({ versionId: z.string(), cle: z.string(),
    region: z.string(), par: z.string() }).strict() },
  "coffre.integrite.alerte": { version: 1, schema: z.object({ versionId: z.string(),
    cle: z.string(), attendu: z.string(), obtenu: z.string() }).strict() },           // R145
  "coffre.purge.certifiee": { version: 1, schema: z.object({ versionId: z.string(),
    motif: z.string(), empreinteConservee: z.string(), par: z.string() }).strict() },
  "coffre.reconciliation.orphelin": { version: 1, schema: z.object({
    cle: z.string() }).strict() },
  "coffre.reconciliation.manquant": { version: 1, schema: z.object({ cle: z.string(),
    severite: z.string() }).strict() },                               // écart = FAIT D'AUDIT (R147)
  // gabaritVersion Int? Prisma : null en mode BRUT (document sans gabarit d'extraction)
  "ocr.extraction.produite": { version: 1, schema: z.object({ documentId: z.string(),
    versionId: z.string(), gabaritVersion: z.number().nullable(),
    mode: z.enum(["BRUT", "TYPE"]), nbChamps: z.number() }).strict() },
  "ocr.controle.echec": { version: 1, schema: z.object({ documentId: z.string(),
    controle: z.string() }).strict() },
  // cible = mapping gouverné par le tenant ({form, section, question, dossierCode} aujourd'hui) —
  // shape non figé par le code, validé comme objet ouvert
  "ocr.proposition.creee": { version: 1, schema: z.object({ champ: z.string(),
    cible: z.record(z.any()) }).strict() },
  "ocr.proposition.acceptee": { version: 1, schema: z.object({ champ: z.string(),
    cible: z.record(z.any()), extractionId: z.string(), confiance: z.number(),
    par: z.string() }).strict() },
  "ocr.proposition.refusee": { version: 1, schema: z.object({ motif: z.string(),
    par: z.string() }).strict() },
  // ── Vague 9 (C6, 2026-08-09) — offboarding.* (clôture relation R267–R270, distinct du moteur
  // Bloc 62) + onboarding.* (R119 : pas d'ouverture sans KYC VALIDATED) + oprisk.* (R321–R323 :
  // taxonomie Bâle, jamais bloqué même en retard) + regwatch.* (R309–R311 : veille — l'humain
  // qualifie R44) + ta.* (R302–R303 : registre nominatif, second regard R13, contrepassation =
  // inverse exact tracé) + tx.* (R140–R143 : gate, revue humaine, jamais de libération
  // automatique R39). Payloads RÉELS des sites d'émission.
  "offboarding.demande": { version: 1, schema: z.object({ clientId: z.string(),
    type: z.string(), par: z.string() }).strict() },                  // SANS motif sensible (R270)
  "offboarding.transition": { version: 1, schema: z.object({ de: z.string(), vers: z.string(),
    par: z.string(), motif: z.string().optional() }).strict() },
  "offboarding.visa": { version: 1, schema: z.object({ role: z.string(),
    par: z.string() }).strict() },
  "offboarding.document": { version: 1, schema: z.object({ type: z.string(),
    par: z.string() }).strict() },
  "offboarding.attestation_avoirs": { version: 1, schema: z.object({ par: z.string(),
    at: z.string(), motif: z.string() }).strict() },                  // R269 : sans port core, motivée
  "onboarding.cree": { version: 1, schema: z.object({ prospect: z.string(),
    par: z.string() }).strict() },
  "onboarding.kyc.cree": { version: 1, schema: z.object({ kycFileId: z.string() }).strict() },
  "onboarding.transition": { version: 1, schema: z.object({ de: z.string(), vers: z.string(),
    par: z.string(), motif: z.string().optional() }).strict() },
  // kycFileId garanti non-nul par la porte R119 (pas d'OUVERT sans KYC VALIDATED)
  "onboarding.ouvert": { version: 1, schema: z.object({ kycFileId: z.string() }).strict() },
  "onboarding.sla.alerte": { version: 1, schema: z.object({ etape: z.string(),
    jours: z.number(), sla: z.number() }).strict() },
  // reference = objet libre fourni par le déclarant ({source, journal, detail} aujourd'hui) — non figé
  "oprisk.incident.declare": { version: 1, schema: z.object({ id: z.string(), titre: z.string(),
    categorie: z.string(), severite: z.number(), pertes: z.number().nullable(),
    description: z.string().nullable(), reference: z.record(z.any()).nullable(),
    par: z.string() }).strict() },
  "oprisk.incident.transition": { version: 1, schema: z.object({ id: z.string(), de: z.string(),
    vers: z.string(), motif: z.string().nullable(), par: z.string() }).strict() },
  "oprisk.action.creee": { version: 1, schema: z.object({ id: z.string(), incidentId: z.string(),
    titre: z.string(), owner: z.string(), echeance: z.string(), par: z.string() }).strict() },
  "oprisk.action.statut": { version: 1, schema: z.object({ id: z.string(), de: z.string(),
    vers: z.string(), par: z.string() }).strict() },                  // jamais bloqué, même en retard
  "oprisk.action.escalade": { version: 1, schema: z.object({ id: z.string(),
    incidentId: z.string(), titre: z.string(), echeance: z.string(), retardJours: z.number(),
    notifie: z.array(z.string()), par: z.string() }).strict() },
  "regwatch.item": { version: 1, schema: z.object({ source: z.string(), titre: z.string(),
    date: z.string(), reference: z.string(), empreinte: z.string() }).strict() },
  "regwatch.fetch": { version: 1, schema: z.object({ source: z.string(), livres: z.number(),
    nouveaux: z.number(), par: z.string() }).strict() },
  "regwatch.proposition": { version: 1, schema: z.object({ id: z.string(), empreinte: z.string(),
    statut: z.string(), regles: z.array(z.string()), justification: z.string(),
    par: z.string() }).strict() },                                    // propose — l'humain décide (R44)
  "regwatch.qualification": { version: 1, schema: z.object({ empreinte: z.string(),
    statut: z.string(), motif: z.string().nullable(), impact: z.string().nullable(),
    regles: z.array(z.string()), surProposition: z.string().nullable(),
    par: z.string() }).strict() },
  "regwatch.digest": { version: 1, schema: z.object({ parStatut: z.record(z.number()),
    notifie: z.array(z.string()), par: z.string() }).strict() },
  "ta.mouvement.enregistre": { version: 1, schema: z.object({ type: z.string(),
    titre: z.string(), titulaire: z.string(), versTitulaire: z.string().nullable(),
    quantite: z.number(), reference: z.string(), roleVisa: z.string().nullable(),
    par: z.string() }).strict() },
  "ta.mouvement.vise": { version: 1, schema: z.object({ reference: z.string(),
    visePar: z.string() }).strict() },                                // R13 : jamais l'initiateur
  // mouvement = le payload COMPLET de ta.mouvement.enregistre embarqué (l'inverse exact tracé)
  "ta.contrepassation": { version: 1, schema: z.object({ reference: z.string(),
    mouvement: z.record(z.any()), motif: z.string(), par: z.string() }).strict() },
  "ta.rapprochement": { version: 1, schema: z.object({ ecarts: z.number(), resolus: z.number(),
    par: z.string() }).strict() },
  "ta.ecart.resolu": { version: 1, schema: z.object({ cle: z.string(), voie: z.string(),
    motif: z.string(), par: z.string() }).strict() },
  "tx.verdict": { version: 1, schema: z.object({ txRef: z.string(), verdict: z.string(),
    gardes: z.array(z.string()) }).strict() },
  "tx.suspend": { version: 1, schema: z.object({ txRef: z.string(), verdict: z.string(),
    gardes: z.array(z.string()) }).strict() },
  "tx.revue.acces.refuse": { version: 1, schema: z.object({ par: z.string(),
    role: z.string() }).strict() },                                   // R143 : file de revue habilitée
  "tx.revue.decision": { version: 1, schema: z.object({ decision: z.string(), motif: z.string(),
    par: z.string() }).strict() },
  "tx.revue.sla": { version: 1, schema: z.object({ txRef: z.string(),
    slaHeures: z.number() }).strict() },                              // signale — jamais de libération auto (R39)
  // ── Vague 10 (C6, 2026-08-09) — familles 3-4 types : annotation.* (R157) + core.* (sync R167,
  // quarantaine = fait, résolution humaine) + legal.* (R312–R313 : la pièce d'abord) + licence.*
  // (R320 échéances J-60/J-30/expirée, même payload) + recherche.* (R148 : l'index n'est jamais
  // purgé en silence) + review.* (R283 : profil appliqué FIGÉ R29) + sso.* (IM-03/04 : bascule
  // demandée/visée R13) + workflow.def.* (R171/R173) + workload.* (R183) + xb.* reliquat
  // (check/dérogation R13/ordre RS). Payloads RÉELS des sites d'émission.
  "annotation.posee": { version: 1, schema: z.object({ annotationId: z.string(),
    par: z.string(), type: z.string(), cercle: z.string() }).strict() },
  "annotation.retiree": { version: 1, schema: z.object({ annotationId: z.string(),
    par: z.string(), motif: z.string() }).strict() },
  "annotation.acces.refuse": { version: 1, schema: z.object({ par: z.string(),
    role: z.string() }).strict() },
  "core.acces.refuse": { version: 1, schema: z.object({ motif: z.string(), demande: z.string(),
    declare: z.array(z.string()), par: z.string() }).strict() },      // R167 : refus, pas un silence
  "core.sync.lot": { version: 1, schema: z.object({ source: z.string(), type: z.string(),
    nbLignes: z.number(), shaLot: z.string(), rattaches: z.number(),
    enQuarantaine: z.number() }).strict() },
  "core.sync.quarantaine": { version: 1, schema: z.object({ compteCore: z.string().nullable(),
    lotId: z.string() }).strict() },
  "core.sync.resolution": { version: 1, schema: z.object({ compteCore: z.string().nullable(),
    clientId: z.string(), par: z.string() }).strict() },
  // rattachements = objet libre du déclarant ({clientId, juridiction} aujourd'hui) — non figé
  "legal.objet.cree": { version: 1, schema: z.object({ id: z.string(), type: z.string(),
    reference: z.string(), parties: z.array(z.string()), documentId: z.string(),
    dateEffet: z.string().nullable(), dateFin: z.string().nullable(),
    preavisJours: z.number().nullable(), tacite: z.boolean(), fournisseur: z.string().nullable(),
    rattachements: z.record(z.any()), par: z.string() }).strict() },  // R312 : la pièce d'abord
  "legal.objet.dates": { version: 1, schema: z.object({ id: z.string(),
    dateEffet: z.string().nullable(), dateFin: z.string().nullable(),
    preavisJours: z.number().nullable(), motif: z.string(), par: z.string() }).strict() },
  "legal.echeance.escalade": { version: 1, schema: z.object({ id: z.string(),
    reference: z.string(), dateFin: z.string(), notifie: z.array(z.string()),
    par: z.string() }).strict() },
  // les trois échéances portent le MÊME payload (une notification par état et par expiresAt)
  "licence.expiration.j60": { version: 1, schema: z.object({ expiresAt: z.string(),
    modules: z.array(z.string()), notifie: z.array(z.string()), par: z.string() }).strict() },
  "licence.expiration.j30": { version: 1, schema: z.object({ expiresAt: z.string(),
    modules: z.array(z.string()), notifie: z.array(z.string()), par: z.string() }).strict() },
  "licence.expiree": { version: 1, schema: z.object({ expiresAt: z.string(),
    modules: z.array(z.string()), notifie: z.array(z.string()), par: z.string() }).strict() },
  "recherche.index.entree": { version: 1, schema: z.object({ versionId: z.string(),
    shaDeriveSource: z.string() }).strict() },
  "recherche.index.retrait": { version: 1, schema: z.object({ entrees: z.number() }).strict() },
  "recherche.index.desync": { version: 1, schema: z.object({ entreeId: z.string(),
    motif: z.string() }).strict() },                                  // R148 : fait d'audit, pas un ménage
  "recherche.executee": { version: 1, schema: z.object({ par: z.string(), role: z.string(),
    requete: z.string(), nbServis: z.number() }).strict() },
  // profil = le profil de review APPLIQUÉ, figé dans l'événement (R29/R283) — objet gouverné
  "review.lancee": { version: 1, schema: z.object({ deadlineId: z.string(), clientId: z.string(),
    type: z.string(), niveau: z.string(), kycCode: z.string(), revision: z.number(),
    previousKycId: z.string().nullable(), profil: z.record(z.any()), par: z.string() }).strict() },
  "review.section.confirmee": { version: 1, schema: z.object({ kycCode: z.string(),
    section: z.string(), par: z.string(), visaSigne: z.boolean(), at: z.string() }).strict() },
  "review.changement.signale": { version: 1, schema: z.object({ kycCode: z.string(),
    cocId: z.string(), typeCode: z.string().optional(), par: z.string() }).strict() },
  "sso.test": { version: 1, schema: z.object({ par: z.string(), resultat: z.string(),
    at: z.string() }).strict() },
  "sso.jwks.rotation": { version: 1, schema: z.object({ par: z.string(), kidAvant: z.string(),
    kidApres: z.string(), motif: z.string() }).strict() },
  "sso.mode.bascule_demandee": { version: 1, schema: z.object({ vers: z.enum(["jwt", "sso"]),
    effetAt: z.string(), motif: z.string(), par: z.string(), at: z.string() }).strict() },
  "sso.mode.bascule_visee": { version: 1, schema: z.object({ vers: z.string(),
    effetAt: z.string(), demandePar: z.string(), visePar: z.string() }).strict() },  // R13
  "workflow.def.brouillon": { version: 1, schema: z.object({ code: z.string(),
    version: z.number(), par: z.string() }).strict() },
  "workflow.def.publiee": { version: 1, schema: z.object({ code: z.string(),
    version: z.number(), depuisLe: z.string(), par: z.string(),
    motif: z.string() }).strict() },                                  // R171 : porte sa mise en vigueur
  "workflow.def.acces.refuse": { version: 1, schema: z.object({ par: z.string(),
    role: z.string() }).strict() },
  "workload.acces.refuse": { version: 1, schema: z.object({ par: z.string(),
    role: z.string() }).strict() },
  "workload.surcharge.signalee": { version: 1, schema: z.object({ chargePct: z.number(),
    seuil: z.number(), suggestion: z.string() }).strict() },          // R183 : la décision vous appartient
  "workload.tache.reassignee": { version: 1, schema: z.object({ de: z.string(),
    vers: z.string(), motif: z.string(), par: z.string() }).strict() },
  "xb.check": { version: 1, schema: z.object({ juridiction: z.string(),
    activites: z.array(z.string()), verdict: z.string(), parActivite: z.array(z.any()),
    manualAt: z.string(), contexte: z.record(z.any()).nullable(), par: z.string() }).strict() },
  "xb.derogation.demandee": { version: 1, schema: z.object({ voyageId: z.string().nullable(),
    kycCode: z.string().nullable(), juridiction: z.string().nullable(), motif: z.string(),
    par: z.string() }).strict() },
  // visée = le payload de la demande REJOUÉ tel quel + visePar (R13 : jamais l'initiateur)
  "xb.derogation.visee": { version: 1, schema: z.object({ voyageId: z.string().nullable(),
    kycCode: z.string().nullable(), juridiction: z.string().nullable(), motif: z.string(),
    par: z.string(), visePar: z.string() }).strict() },
  "xb.ordre.enregistre": { version: 1, schema: z.object({ pays: z.string(),
    reverseSolicitation: z.boolean(), qualification: z.boolean(),
    preuveRef: z.string().nullable(), par: z.string() }).strict() },
  // ── Vague 11 (C6, 2026-08-09) — familles 1-2 types + singletons : la DERNIÈRE vague à points.
  // NOTE sur-capture : « fake-1.0 » (version de modèle factice olivia), « gwb.ch »/« gwb-private.ch »
  // (exemples de config loginDomaines) et « pacs.008 » (type de message SWIFT) sont des littéraux
  // capturés par le scan qui ne sont PAS des types d'événement — ils restent dans TYPES_EN_ATTENTE
  // (inventaire monotone, sur-capture assumée, même doctrine que cpsi.* jumeau).
  "auth.breakglass.utilise": { version: 1, schema: z.object({ email: z.string(),
    par: z.string(), notifie: z.array(z.string()) }).strict() },      // R296 : toujours notifié SO/DIR
  // rapport = le rapport d'impact JOINT à l'acte (WB-10) — projection gouvernée, objet non figé
  "builder.simulation": { version: 1, schema: z.object({ empreinte: z.string(),
    rapport: z.record(z.any()), par: z.string() }).strict() },        // R305 : publier sans simuler n'existe pas
  "builder.publication": { version: 1, schema: z.object({ type: z.string(), code: z.string(),
    version: z.number(), auteur: z.string(), publicateur: z.string(), depuisLe: z.string(),
    rapport: z.record(z.any()) }).strict() },                         // R304 : gravée, datée, rapport joint
  "cablage.caviarde.depose": { version: 1, schema: z.object({ cle: z.string(),
    shaDerive: z.string() }).strict() },                              // CB-05 : sert la sortie, pas l'index
  "caviardage.produit": { version: 1, schema: z.object({ caviardeId: z.string(),
    par: z.string(), zones: z.number(), shaSource: z.string(), shaDerive: z.string() }).strict() },
  "caviardage.refuse": { version: 1, schema: z.object({ par: z.string(),
    role: z.string() }).strict() },
  "central_file.dossier.ouvert": { version: 1, schema: z.object({ champ: z.string(),
    constats: z.record(z.any()) }).strict() },
  // corps REPRIS TEL QUEL du contrôleur (webhook CoC entrant) — gouverné mais volontairement ouvert
  "client.coc": { version: 1, schema: z.record(z.any()) },
  "crm.contact.cree": { version: 1, schema: z.object({ contactId: z.string(), type: z.string(),
    origine: z.string(), par: z.string() }).strict() },
  "crm.acces.refuse": { version: 1, schema: z.object({ par: z.string(),
    role: z.string() }).strict() },
  "deploiement.enregistre": { version: 1, schema: z.object({ version: z.string().nullable(),
    smokeOk: z.boolean(), readyz: z.any(), note: z.string().nullable(),
    par: z.string() }).strict() },                                    // RZ-04 : constat, readyz tel que servi
  "divulgation.executee": { version: 1, schema: z.object({ par: z.string(),
    caviardeId: z.string(), shaDerive: z.string(), destinataire: z.string() }).strict() },  // R159
  "divulgation.refusee": { version: 1, schema: z.object({ par: z.string(),
    motif: z.string() }).strict() },                                  // R159 : l'original ne sort pas
  "dq.degraded": { version: 1, schema: z.object({ champsDegrades: z.array(z.string()),
    scenariosDegrades: z.array(z.string()), completudeMin: z.number(),
    par: z.string() }).strict() },                                    // GV-03 : jamais silencieux
  "fx.seuil.franchi": { version: 1, schema: z.object({ devise: z.string(),
    exposition: z.number(), seuil: z.number(), par: z.string() }).strict() },  // R39 : notifié, jamais bloqué
  "iam.cumul_so_admin.autorise": { version: 1, schema: z.object({ de: z.string(),
    vers: z.string(), par: z.string() }).strict() },                  // SO-05
  "matrice_documentaire.publiee": { version: 1, schema: z.object({ version: z.number(),
    enVigueurLe: z.string() }).strict() },                            // R282 — la 1re prise de la garde C6
  "module.licence.chargee": { version: 1, schema: z.object({ modules: z.array(z.string()),
    issuedAt: z.string(), expiresAt: z.string(), par: z.string() }).strict() },
  "nba.decided": { version: 1, schema: z.object({ decision: z.enum(["ACCEPT", "ADJUST", "REJECT"]),
    acteur: z.string(), adjustment: z.any() }).strict() },            // R244/R245 : aucune exécution directe
  // avant/apres/valeur = valeurs de paramètre gouvernées (tout type JSON) — non figées
  "param.change": { version: 1, schema: z.object({ avant: z.any(), apres: z.any(),
    par: z.string(), motif: z.string(), effetAt: z.string() }).strict() },
  "param.effet.applique": { version: 1, schema: z.object({ valeur: z.any() }).strict() },
  "rh.bonification.snapshot": { version: 1, schema: z.object({ membres: z.array(z.any()),
    note: z.string() }).strict() },                                   // le moteur ne décide rien
  "risque.operationnel.incident": { version: 1, schema: z.object({ origine: z.string(),
    section: z.string(), requiredRole: z.string(), motif: z.string() }).strict() },  // R12
  "signal.aml.comportement": { version: 1, schema: z.object({ clientId: z.string(),
    raisons: z.array(z.string()) }).strict() },
  // extraction = shape PAR TYPE de message (MT/MX, bibliothèque gouvernée swift_types_actifs) — non figé
  "swift.message.parse": { version: 1, schema: z.object({ extraction: z.record(z.any()),
    transactionId: z.string().nullable(), clientId: z.string().nullable(),
    par: z.string() }).strict() },
  "swift.quarantaine": { version: 1, schema: z.object({ motif: z.string(),
    apercu: z.string(), par: z.string() }).strict() },                // R169 : jamais deviné
  "tenant.active": { version: 1, schema: z.object({ signePar: z.string(),
    par: z.string() }).strict() },
  "transport.deadletter": { version: 1, schema: z.object({ consumer: z.string(),
    seq: z.number(), enSouffrance: z.number() }).strict() },
  "transport.deadletter.rejouee": { version: 1, schema: z.object({ consumer: z.string(),
    par: z.string() }).strict() },
  "tuning.btl.campagne": { version: 1, schema: z.object({ scenarioCode: z.string(),
    seuilKey: z.string(), seuil: z.number(), bande: z.tuple([z.number(), z.number()]),
    bandePct: z.tuple([z.number(), z.number()]), taux: z.number(), populationInBand: z.number(),
    sampleSize: z.number(), par: z.string() }).strict() },
  "tuning.calibrage.annuel": { version: 1, schema: z.object({ matriceReference: z.string(),
    totalScenarios: z.number(), couverts: z.number(), sansMatiere: z.number(),
    tauxCouverture: z.number(), familles: z.number(), anglesMorts: z.number(),
    placeholders: z.number(), par: z.string() }).strict() },          // GV-04
  "vendor.licence.emise": { version: 1, schema: z.object({ version: z.string(),
    modules: z.array(z.string()), effetAt: z.string(), par: z.string(),
    motif: z.string() }).strict() },                                  // R177/R179
  "vendor.licence.acces.refuse": { version: 1, schema: z.object({ par: z.string(),
    role: z.string() }).strict() },
  // ── SANS_POINT tranche 1 (C6, 2026-08-09) — OLIVIA_* réellement émis via emitEvent (10 types,
  // module olivia R253–R258 : conversations hash-chaînées, contexte prouvé, propositions B.1-B.7).
  // NOTE sur-capture : les 14 autres littéraux OLIVIA_* du scan sont des CODES D'ACTION audit.log
  // (chaîne HMAC audit_logs, PAS domain_events : CONVERSATION_CREATED, MESSAGE, TOOL/AGENT_DECLARED,
  // AGENT_RETIRED, RUN_PORTE(_EXPIREE)/EPUISE/TERMINE/GATE/INTERROMPU/STOP/REPLAY) ou des MESSAGES
  // D'EXCEPTION (SCOPE_DENIED) — ils restent en attente par sur-capture monotone assumée.
  "OLIVIA_CONTEXT_DENIED": { version: 1, schema: z.object({ qui: z.string(), quoi: z.string(),
    pourquoi: z.string() }).strict() },                               // R255 : refus de contexte tracé
  "OLIVIA_CONVERSATION_FERMEE": { version: 1, schema: z.object({ motif: z.string(),
    roleFige: z.string(), roleCourant: z.string() }).strict() },      // le rôle est FIGÉ à l'ouverture
  "OLIVIA_MESSAGE_IN": { version: 1, schema: z.object({ messageId: z.string(),
    seq: z.number() }).strict() },
  // deux émetteurs : refus hors périmètre (horsPerimetre) et sortie fournisseur (provider/model/…)
  "OLIVIA_MESSAGE_OUT": { version: 1, schema: z.object({ messageId: z.string(), seq: z.number(),
    horsPerimetre: z.boolean().optional(), provider: z.string().optional(),
    model: z.string().optional(), latenceMs: z.number().optional(),
    echec: z.string().nullish(), empreinte: z.string().optional() }).strict() },
  "OLIVIA_INJECTION_SUSPECTEE": { version: 1, schema: z.object({ marqueur: z.string(),
    seq: z.number() }).strict() },                                    // A.5 : suspicion tracée, jamais silencieuse
  "OLIVIA_FEEDBACK": { version: 1, schema: z.object({ seq: z.number().nullable(),
    note: z.enum(["UTILE", "INUTILE"]), par: z.string() }).strict() },
  "OLIVIA_PROPOSAL_CREATED": { version: 1, schema: z.object({ type: z.string(),
    cibleType: z.string(), cibleId: z.string(), messageId: z.string() }).strict() },  // payload minimal (B.1)
  // decisionHumaine = la référence de l'acte humain {evenement, par?, le} (etatCible.refHumaine) — objet, nullable
  "OLIVIA_PROPOSAL_CADUQUE": { version: 1, schema: z.object({ etatFige: z.string().nullable(),
    etatCourant: z.string(), decisionHumaine: z.record(z.any()).nullable() }).strict() },  // B.7 : jugée contre l'état figé
  "OLIVIA_PROPOSAL_REJECTED": { version: 1, schema: z.object({ par: z.string(),
    motif: z.string() }).strict() },
  "OLIVIA_PROPOSAL_ADOPTED": { version: 1, schema: z.object({ par: z.string(),
    type: z.string() }).strict() },                                   // R44 : l'humain adopte
  // ── SANS_POINT tranche 2 (C6, 2026-08-09) — instruction COMPLÈTE du bloc : sur les 274 littéraux
  // MAJUSCULES restants, 13 seulement sont émis via emitEvent (schématisés ci-dessous). Les 261
  // autres sont des CODES D'ACTION audit.log (~140, chaîne HMAC audit_logs — pas domain_events),
  // des statuts/valeurs de payload/exemples de config/messages d'exception (~116, dont KYC_FILE/
  // RISK_CASE/CPSI_RULES/CPSI_SCORE = valeurs du champ `quoi` d'OLIVIA_CONTEXT_DENIED, et
  // COC_CONFIG_DEFINIE = code audit) — ils restent en attente par sur-capture monotone assumée.
  // AUDIT_ACCESS a TROIS émetteurs (export BI massif R315, vérification d'intégrité SO-07,
  // middleware surfaces sensibles SO) — champs par site optionnels sous strict.
  "AUDIT_ACCESS": { version: 1, schema: z.object({ par: z.string(), role: z.string(),
    vue: z.string().optional(), dimensions: z.array(z.string()).optional(),
    lignes: z.number().optional(), seuil: z.number().optional(),
    notifie: z.array(z.string()).optional(),
    chemin: z.string().optional(), methode: z.string().optional() }).strict() },
  "AUDIT_EXPORT": { version: 1, schema: z.object({ par: z.string(), role: z.string(),
    perimetre: z.object({ aggregateId: z.string().nullable(),
      type: z.string().nullable() }).strict(), n: z.number() }).strict() },  // SO-02 : at = génération
  // dueDate/ancienneDate/nouvelleDate sortent de Prisma en instance Date — même doctrine que
  // mros.gel.echeance (validées AVANT sérialisation JSON).
  "REVIEW_DEADLINE_SET": { version: 1, schema: z.object({ clientId: z.string(),
    ddlLevel: z.string(), cadenceMois: z.number(), dueDate: z.union([z.string(), z.date()]),
    sourceKycId: z.string().optional(), remplace: z.string().optional(),
    motif: z.string().optional(), par: z.string().optional() }).strict() },  // 2 émetteurs (pose/recalcul)
  "REVIEW_DEADLINE_REALISEE": { version: 1, schema: z.object({ clientId: z.string(),
    kycId: z.string(), par: z.string() }).strict() },
  "REVIEW_DEADLINE_ANTICIPEE": { version: 1, schema: z.object({ clientId: z.string(),
    declencheur: z.string(), ancienneDate: z.union([z.string(), z.date()]),
    nouvelleDate: z.union([z.string(), z.date()]), motif: z.string(),
    par: z.string() }).strict() },
  "REVIEW_DEADLINE_REPORT_DEMANDE": { version: 1, schema: z.object({ nouvelleDate: z.string(),
    motif: z.string(), par: z.string(), at: z.string() }).strict() },        // R273 : demandé…
  "REVIEW_DEADLINE_REPORTEE": { version: 1, schema: z.object({ clientId: z.string(),
    ancienneDate: z.union([z.string(), z.date()]), nouvelleDate: z.union([z.string(), z.date()]),
    motif: z.string(), demandePar: z.string(), visePar: z.string() }).strict() },  // …et VISÉ (R13)
  // configVersionAt : Date(0) pour la table livrée, DateTime Prisma pour les versions tenant
  "COC_OUVERT": { version: 1, schema: z.object({ clientId: z.string(), typeCode: z.string(),
    materialite: z.string(), actionRequise: z.string(),
    configVersionAt: z.union([z.string(), z.date()]),
    par: z.string() }).strict() },                                    // R29 : config à date FIGÉE
  "COC_SIGNAL_NON_EMIS": { version: 1, schema: z.object({ clientId: z.string(),
    pourquoi: z.string() }).strict() },                               // l'échec CPSI jamais silencieux
  "COC_TRAITEMENT_DEMANDE": { version: 1, schema: z.object({ par: z.string(), at: z.string(),
    revisionKycId: z.string().nullable(), majRefs: z.any(),
    sansMajMotif: z.string().nullable() }).strict() },
  "COC_TRAITE": { version: 1, schema: z.object({ par: z.string(),
    demandePar: z.string().optional() }).strict() },                  // R13 quand four-eyes actif
  // gabarit COC_${vers} (transitionner) — TRAITE y est interdit (route dédiée R277)
  "COC_EN_TRAITEMENT": { version: 1, schema: z.object({ par: z.string(),
    motif: z.string().optional() }).strict() },
  "COC_NON_RETENU": { version: 1, schema: z.object({ par: z.string(),
    motif: z.string() }).strict() },                                  // CC-07 : jamais une disparition silencieuse
  // ── Bloc 65 Volet A (repo R466–R473, 2026-08-09) — harmonisation des revues : l'AR est une
  // révision pré-remplie du dernier KYC approuvé (diff visé R467), verdicts normalisés à
  // conséquences PROPOSÉES (R468/R44), GAR = dossier parent projeté d'événements (R470),
  // cascades = événements anti-boucle (R471). Payloads RÉELS (revue-harmonisee.service.ts).
  // NOTE sur-capture : « review.groupe.criteres » et « review.groupe.enabled » sont des CLÉS DE
  // PARAMÈTRE R-Q (registre §Review, parametres.service.ts), pas des types d'événement — elles
  // restent dans TYPES_EN_ATTENTE (inventaire monotone, même doctrine que gwb.ch/pacs.008).
  "review.prerempli": { version: 1, schema: z.object({ kycCode: z.string(),
    depuisKyc: z.string(), reprises: z.number() }).strict() },        // R467 : origine REPRISE au socle
  "review.reponse.modifiee": { version: 1, schema: z.object({ kycCode: z.string(),
    section: z.string(), question: z.string(), ancien: z.string().nullable(),
    nouveau: z.string(), par: z.string() }).strict() },               // R467 : ancien/nouveau tracés
  "review.delta.vise": { version: 1, schema: z.object({ kycCode: z.string(),
    modifiees: z.number(), changements: z.array(z.any()), par: z.string(),
    role: z.string() }).strict() },                                   // R467 : le visa RÉFÉRENCE le delta
  "review.section.visee.bloc": { version: 1, schema: z.object({ kycCode: z.string(),
    section: z.string(), par: z.string() }).strict() },               // R467 : « revu, inchangé » (tenant)
  "review.verdict.pose": { version: 1, schema: z.object({ kycCode: z.string(),
    verdict: z.enum(["CONFORME", "RESERVES", "NON_CONFORME"]),
    motivation: z.string().nullable(), par: z.string(), role: z.string() }).strict() },  // R468 : art. 7 LBA
  "review.aiguillage.decide": { version: 1, schema: z.object({ kycCode: z.string(),
    option: z.string(), par: z.string(), role: z.string() }).strict() },   // R468/R44 : l'humain décide — événement distinct
  "review.membre.ouvert": { version: 1, schema: z.object({ garId: z.string(), kycId: z.string(),
    kycCode: z.string(), clientId: z.string(), origine: z.string(),
    par: z.string() }).strict() },                                    // R470 : chaque membre lié au parent, origine tracée
  "tache.review.remediation": { version: 1, schema: z.object({ kycCode: z.string(),
    motif: z.string(), par: z.string() }).strict() },                 // R468 : RÉSERVES → tâches proposées
  "tache.review.aiguillage": { version: 1, schema: z.object({ kycCode: z.string(),
    options: z.array(z.string()), verdict: z.string(), par: z.string() }).strict() },  // R468 : proposé, jamais exécuté
  "gar.ouverte": { version: 1, schema: z.object({ garId: z.string(), critere: z.string(),
    composition: z.array(z.string()), membres: z.array(z.string()), sections: z.array(z.string()),
    origine: z.record(z.any()).nullable(), par: z.string(),
    dateInitiation: z.string() }).strict() },                         // R470 : composition FIGÉE (R29/R48)
  "gar.decision.visee": { version: 1, schema: z.object({ garId: z.string(), par: z.string(),
    role: z.string(), motivation: z.string(),
    verdictsMembres: z.array(z.object({ kycCode: z.string(),
      verdict: z.string() }).strict()) }).strict() },                 // R470 : le visa référence TOUS les verdicts membres
  "gar.cloturee": { version: 1, schema: z.object({ garId: z.string(),
    par: z.string() }).strict() },
  "REVIEW_CASCADE_TRIGGERED": { version: 1, schema: z.object({ source: z.string(),
    parametre: z.string(), parent: z.string(), membres: z.array(z.string()),
    par: z.string() }).strict() },                                    // R471 : événement, anti-boucle invariant
  "training.completed": { version: 1, schema: z.object({ userId: z.string(), formationCode: z.string(),
    docId: z.string() }).strict() },
  "training.validated": { version: 1, schema: z.object({ userId: z.string(), formationCode: z.string(),
    par: z.string() }).strict() },
  "training.reminder": { version: 1, schema: z.object({ userId: z.string(), code: z.string(),
    joursRestants: z.number() }).strict() },
  "screening.hit.detecte": { version: 1, schema: z.object({ hitId: z.string(), clientId: z.string(),
    entreeUid: z.string(), score: z.number(), listeVersion: z.string() }).strict() },
  "screening.hit.qualifie": { version: 1, schema: z.object({ hitId: z.string(), verdict: z.string(),
    motif: z.string(), par: z.string() }).strict() },
  "screening.escalade.proposee": { version: 1, schema: z.object({ hitId: z.string(), clientId: z.string(), motif: z.string() }).strict() },
  "pep.proposition.creee": { version: 1, schema: z.object({ cle: z.string(), hitId: z.string(), personId: z.string(),
    liste: z.string(), listeVersion: z.string(), score: z.number(), decomposition: z.any() }).strict() },
  "pep.proposition.rejetee": { version: 1, schema: z.object({ cle: z.string(), motif: z.string(), par: z.string() }).strict() },
  // ── ES-8 : les 4 types consommés par surveillance-es montent au catalogue (fin des gardes
  // locales ES — docs/notes/ES-catalogue-gaps.md soldé). Schémas = payloads RÉELS des émetteurs.
  "tx.flux.importee": { version: 1, schema: z.object({ refExterne: z.string(), source: z.string(),
    compte: z.string(), clientId: z.string().nullish() }).strict() },
  "kyc.validated": { version: 1, schema: z.object({ code: z.string(), validatedBy: z.string() }).strict() },
  // ── Tranche C6 (2026-08-08) : kyc.service quitte les creates DIRECTS — ses 3 types
  // restants passent par emitEvent avec schéma strict (payloads RÉELS des sites d'émission).
  "kyc.created": { version: 1, schema: z.object({ code: z.string(), workflow: z.string(),
    // trace du moteur de risque : entrées STRUCTURÉES (objets) + chaînes appendées (ex. R271) — opaque ici
    riskTrace: z.array(z.any()).nullish() }).strict() },
  "prospect.retour.refuse.detecte": { version: 1, schema: z.object({ code: z.string(),
    dossiersRefuses: z.array(z.string()) }).strict() },
  "kyc.access.modifie": { version: 1, schema: z.object({ question: z.string(), role: z.string(),
    ancienne: z.string(), nouvelle: z.string(), par: z.string(), dateEffet: z.string(),
    portee: z.string(), dossiersTouches: z.number() }).strict() },
  // ── Vague 2 (C6, 2026-08-08) — kyc.* : schémas tirés des payloads réels de kyc.service.ts
  //    et kyc-workflow.chaine.ts (jamais déduits d'une doc). Un champ à deux formes selon le
  //    site d'émission est nullish/optional, jamais élargi en z.any() sans raison de config.
  "kyc.lock.requested": { version: 1, schema: z.object({ code: z.string(), requester: z.string(),
    holder: z.string() }).strict() },
  "kyc.lock.passed": { version: 1, schema: z.object({ code: z.string(), from: z.string(),
    to: z.string() }).strict() },
  "kyc.visa.invalide": { version: 1, schema: z.object({ section: z.string(), cause: z.string(),
    nb: z.number().optional() }).strict() },                         // nb absent au site R21/R22 (par section)
  "kyc.visa.validateur.reassigne": { version: 1, schema: z.object({ section: z.string(),
    requiredRole: z.string(), ancien: z.string().nullable(), nouveau: z.string() }).strict() },
  "kyc.visa.annule.vice": { version: 1, schema: z.object({ section: z.string(),
    requiredRole: z.string(), motif: z.string() }).strict() },
  "kyc.visas.geles": { version: 1, schema: z.object({ hit: z.string(), nb: z.number(),
    delaiAnalyseJours: z.number() }).strict() },                     // R46
  "kyc.comite.decision": { version: 1, schema: z.object({ hit: z.string(),
    decision: z.enum(["poursuite", "offboarding"]), membres: z.array(z.string()) }).strict() },   // R46
  "kyc.offboarding.propose": { version: 1, schema: z.object({ hit: z.string(),
    origine: z.string() }).strict() },                               // R44 : propose, ne décide jamais
  "kyc.dossier.suspendu": { version: 1, schema: z.object({ cause: z.string(),
    restrictions: z.record(z.any()).optional() }).strict() },        // restrictions = JSON tenant (R-Q), figé à date (S-09)
  "kyc.dossier.reactive": { version: 1, schema: z.object({}).strict() },
  "kyc.dossier.abandonne": { version: 1, schema: z.object({ motif: z.string() }).strict() },
  "kyc.dossier.mise_a_jour": { version: 1, schema: z.object({ description: z.string(),
    sections: z.array(z.string()) }).strict() },                     // R21/R22 : réouverture ciblée
  "kyc.effacement.refuse.lba": { version: 1, schema: z.object({ demandeur: z.string(),
    baseLegale: z.string() }).strict() },
  "kyc.process.ouvert": { version: 1, schema: z.object({ process: z.string(), type: z.string() }).strict() },
  "kyc.process.pause": { version: 1, schema: z.object({ cause: z.string(), nb: z.number() }).strict() },
  "kyc.process.repris": { version: 1, schema: z.object({ process: z.string(),
    sectionsAbsorbees: z.array(z.string()) }).strict() },
  "kyc.process.cloture": { version: 1, schema: z.object({ process: z.string(),
    sections: z.array(z.string()) }).strict() },
  "kyc.dossier.workflow": { version: 1, schema: z.object({ source: z.enum(["GOUVERNE", "TEMPLATE"]),
    workflowCode: z.string(), version: z.number().nullable(), depuisLe: z.string().nullable() }).strict() },   // R172 : le timbre
  "personne.pep.declare": { version: 1, schema: z.object({ source: z.string(), sourceHitId: z.string().nullish() }).strict() },
  "personne.pep.leve": { version: 1, schema: z.object({ decideur: z.string(), sourceHitId: z.string().nullish() }).strict() },
  // ── Bloc WD (R432/R436) : WorkflowIR — source → brut → éditions → visa, rejouable ──
  "wd.wir.importe": { version: 1, schema: z.object({ documentId: z.string(), hash: z.string(),
    modele: z.string(), wir: z.any(), zonesIllisibles: z.any() }).strict() },
  "wd.wir.edite": { version: 1, schema: z.object({ patch: z.object({ noeud: z.string(),
    label: z.string().optional(), ownerRole: z.string().optional(), slaHours: z.number().optional() }).strict(),
    par: z.string() }).strict() },
  "wd.wir.ratifie": { version: 1, schema: z.object({ par: z.string(), defId: z.string() }).strict() },
  // ── Bloc 62 — offboarding AU MOTEUR (repo R439–R445) : l'état est un REJEU de ces événements ──
  "WORKFLOW_STARTED": { version: 1, schema: z.object({ clientId: z.string(), motif: z.string(),
    par: z.string(), role: z.string(), niveau: z.string(), origineNiveau: z.string(),
    chaine: z.array(z.string()), checklist: z.array(z.object({ label: z.string(), obligatoire: z.boolean() })),
    guards: z.record(z.string()), dateInitiation: z.string() }).strict() },
  "TRANSITION_FIRED": { version: 1, schema: z.object({ from: z.string(), to: z.string(),
    visa: z.object({ validateur: z.string(), role: z.string(), at: z.string() }).strict().nullish() }).strict() },
  "VISA_APPOSE": { version: 1, schema: z.object({ validateur: z.string(), role: z.string(),
    at: z.string(), maillon: z.number() }).strict() },          // multi-visas R1 sur la clôture (chaînes > 3)
  "GUARD_BLOCKED": { version: 1, schema: z.object({ guard: z.string(), reason: z.string(),
    etape: z.string() }).strict() },
  "GUARD_WARNING": { version: 1, schema: z.object({ guard: z.string(), reason: z.string(),
    etape: z.string() }).strict() },
  "WORKFLOW_COMPLETED": { version: 1, schema: z.object({ par: z.string() }).strict() },
  "CHECKLIST_ITEM_CHECKED": { version: 1, schema: z.object({ label: z.string(), par: z.string() }).strict() },
  "PARAM_CHANGED": { version: 1, schema: z.object({ cle: z.string(), ancien: z.any(), nouveau: z.any(),
    enVigueurLe: z.string(), auteur: z.string(), engagementTexte: z.string(), portee: z.string() }).strict() },
  // ── Ingestion de listes versionnée (R409 · L6) ──
  "liste.version.importee":  { version: 1, schema: z.object({ source: z.string(), version: z.string(), hash: z.string(),
    nEntrees: z.number(), ajoutees: z.number(), modifiees: z.number(), retirees: z.number() }).strict() },
  "liste.rescreening.cible": { version: 1, schema: z.object({ source: z.string(), version: z.string(),
    entrees: z.number(), hits: z.number() }).strict() },
  "liste.delisting.revue":   { version: 1, schema: z.object({ source: z.string(), version: z.string(),
    uid: z.string(), hitId: z.string() }).strict() },
};

// ── Types EN ATTENTE de schéma (inventaire des littéraux émis — migration douce, à réduire) ──
export const TYPES_EN_ATTENTE: ReadonlySet<string> = new Set([
  "ACTE_DECES",
  "ADDRESS_CHANGE",
  "AIGUILLAGE_EDD",
  "AI_DECIDE",
  "AI_QUERY",
  "AJUSTEMENT_PARAM",
  "ALLEGEMENT_EDD",
  "AMI_PROCHE_DE",
  "AML_ANNUELLE",
  "AML_BTL_CAMPAGNE",
  "AML_CALIBRAGE_ANNUEL",
  "AML_DQ_CONTROLE",
  "AML_EVALUATED",
  "AML_EVAL_BACKTEST",
  "AML_EVAL_CLIENT",
  "AML_EVAL_DRAIN",
  "AML_EVAL_VERSION",
  "AML_GAP_GT_SEED",
  "AML_GAP_QUALIFY",
  "AML_GAP_SIGNAL",
  "ASSOCIE_DE",
  "AUCUN_CHECK",
  "AUDIT_HMAC_SECRET",
  "BLOQUANT_APPROBATION",
  "BLOQUEE_REVUE",
  "BREAK_GLASS_LOGIN",
  "BUDGET_TICK",
  "BUILDER_PUBLISH",
  "CERTIFICATION_EXPIRED_AT_TRIP_DATE",
  "CERTIFICATION_ISSUED",
  "CHAMPS_OBLIGATOIRES",
  "CLIENTS_PRODUITS_PRATIQUES",
  "CLIENT_CREATED",
  "CLOTURE_ANNULEE",
  "CLOTURE_DEMANDEE",
  "COC_CONFIG_DEFINIE",
  "COFFRE_INTERNE",
  "CONSEILLER_EXTERNE",
  "CONSEIL_FONDATION",
  "CONVERSION_CRYPTO",
  "CORE_RESOLVE",
  "CORE_SYNC",
  "CO_SR",
  "CO_TITULAIRE",
  "CPSI_CASE_PROPOSAL_EMITTED",
  "CPSI_CLIENT_ALREADY_REGISTERED",
  "CPSI_CLIENT_REGISTERED",
  "CPSI_GROUP_DEFINED",
  "CPSI_PARAM_APPLIED",
  "CPSI_REPLAY_SLOW",
  "CPSI_RULES",
  "CPSI_SCENARIO_DEFINED",
  "CPSI_SCORE",
  "CPSI_SIGNAL_INGESTED",
  "CPSI_SLA_TICK",
  "CRASH_TEST",
  "CRM_CONTACT",
  "CROSS_BORDER_AE",
  "DECES_SUCCESSION",
  "DECISION_BANQUE",
  "DEMANDE_CLIENT",
  "DETENTEUR_CONTROLE",
  "DOMMAGES_ACTIFS",
  "EN_ANALYSE",
  "EN_ATTENTE",
  "EN_CLOTURE",
  "EN_COURS",
  "EN_MAJ",
  "EN_PAUSE",
  "EN_RETARD",
  "EN_TRAITEMENT",
  "EN_VIGUEUR",
  "EPOUX_DE",
  "ETAPE_AGENT",
  "ETAPE_OUTIL",
  "EXECUTION_PROCESSUS",
  "EXIT_COMPLIANCE",
  "EXPIRATION_FUTURE",
  "FAUX_POSITIF",
  "FF_RLS_ENFORCED",
  "FILS_FILLE_DE",
  "FORM_CDB",
  "FRAUDE_EXTERNE",
  "FRAUDE_INTERNE",
  "FRERE_SOEUR_DE",
  "GED_ANCHORED",
  "GED_ARCHIVED",
  "GED_CLASSIFIED",
  "GED_CLASSIFY",
  "GED_CONSULT_FICHE",
  "GED_DESTROYED",
  "GED_HOLD_LIFTED",
  "GED_INGEST",
  "GED_QES",
  "GED_READ",
  "GED_VERSION_CREATED",
  "IA_PREREVIEW",
  "IA_PROMPT_VERSIONED",
  "IA_VALIDEE",
  "IDENTITY_DIVERGENCE",
  "INSTRUCTION_TRANSFERT_SIGNEE",
  "INTERRUPTION_SYSTEMES",
  "IN_PROGRESS",
  "ISLAMIC_EVALUATED",
  "KYC_ACCESS_MODIFIE",
  "KYC_CREATED",
  "KYC_ENGAGEMENT_RESPONSABILITE",
  "KYC_EN_COURS",
  "KYC_FILE",
  "KYC_NOT_APPROVED",
  "KYC_QUESTION",
  "KYC_REVOCATION_REFUSEE",
  "KYC_SECTION",
  "KYC_VALIDATED",
  "KYC_VALIDATION",
  "KYC_VISA",
  "KYC_VISA_SIGNED",
  "LEGAL_OBJET_CREE",
  "LICENCE_CHARGEE",
  "LICENSE_ISSUED",
  "MAJ_CIBLEE",
  "MERE_DE",
  "MFA_ENC_KEY",
  "MOBILE_IDENTITE_CREEE",
  "MOBILE_MESSAGE_BANQUE",
  "MOBILE_PARTAGE_MARQUE",
  "MROS_DECISION",
  "MROS_FREEZE_LIFTED",
  "MROS_FREEZE_SET",
  "NBA_ADJUSTMENT_REQUIRED",
  "NBA_ALREADY_DECIDED",
  "NBA_DECIDED",
  "NBA_DECISION_HUMAN_ONLY",
  "NBA_REJECT_RATIONALE_REQUIRED",
  "NEAR_MISS",
  "NEVEU_NIECE_DE",
  "NE_PAS_COMMUNIQUER",
  "NON_DETERMINE",
  "NON_OFFICIEL",
  "NON_PERTINENT",
  "NON_QUALIFIEE",
  "NON_RETENU",
  "NON_TRAITE",
  "NON_TRANSMISSION",
  "OCR_ACCEPT",
  "OCR_EXTRACTION",
  "OFFBOARDING_ATTESTATION_AVOIRS",
  "OFFBOARDING_DEMANDE",
  "OFFBOARDING_TRANSITION",
  "OFFBOARDING_VISA",
  "OLIVIA_AGENT_DECLARED",
  "OLIVIA_AGENT_RETIRED",
  "OLIVIA_CONVERSATION_CREATED",
  "OLIVIA_MESSAGE",
  "OLIVIA_RUN_EPUISE",
  "OLIVIA_RUN_GATE",
  "OLIVIA_RUN_INTERROMPU",
  "OLIVIA_RUN_PORTE",
  "OLIVIA_RUN_PORTE_EXPIREE",
  "OLIVIA_RUN_REPLAY",
  "OLIVIA_RUN_STOP",
  "OLIVIA_RUN_TERMINE",
  "OLIVIA_SCOPE_DENIED",
  "OLIVIA_TOOL_DECLARED",
  "ONBOARDING_CREATED",
  "ONBOARDING_TRANSITION",
  "ONCLE_TANTE_DE",
  "OPRISK_INCIDENT_DECLARE",
  "OPRISK_INCIDENT_TRANSITION",
  "PAUSE_PORTE",
  "PENDING_APPROVAL",
  "PEP_LIFTED",
  "PEP_PROPOSITION",
  "PEP_PROPOSITION_REJECTED",
  "PEP_STATUS",
  "PERE_DE",
  "PERSON_COC",
  "PERSON_CREATED",
  "PERSON_LINK",
  "PMS_BREACH_CLOSED",
  "PMS_PRETRADE_BLOCK",
  "PMS_VALUATION",
  "PORTE_DECISION",
  "PORTE_OUVERTE",
  "POSITION_SANS_REGISTRE",
  "POWER_OF_ATTORNEY",
  "POWER_OF_INFORMATION",
  "PRATIQUES_EMPLOI",
  "PREAVIS_OUVERT",
  "PRISE_CONNAISSANCE",
  "QUALIF_ALERTE",
  "QUANTITES_DIVERGENTES",
  "RECO_PROSE_TEST",
  "REGISTRE_SANS_POSITION",
  "REGWATCH_COLLECTE",
  "REGWATCH_QUALIFIE",
  "REVIEW_ANTICIPEE",
  "REVIEW_LANCEE",
  "REVIEW_RECALCUL",
  "REVIEW_REPORTEE",
  "REVIEW_SECTION_CONFIRMEE",
  "REVISION_KYC",
  "RISKCASE_FROM_PROPOSAL",
  "RISKCASE_OPENED",
  "RISKCASE_TRANSITION",
  "RISK_CASE",
  "SANS_ECHEANCE",
  "SCOPE_DENIED",
  "SCREENING_CONFIG_PUBLIEE",
  "SCREENING_EXPORT",
  "SCREENING_QUALIFIED",
  "SCREENING_REPLAY",
  "SCREENING_RUN",
  "SSO_FALLBACK_LOCAL_UTILISE",
  "SSO_JWKS_ROTATION",
  "SSO_MODE_BASCULE",
  "SSO_TEST",
  "STREAM_INTERROMPU_TEST",
  "SWIFT_PARSE",
  "SWIFT_QUARANTAINE",
  "TASK_ALREADY_COMPLETED",
  "TASK_COMPLETED",
  "TASK_COMPLETE_FORBIDDEN",
  "TASK_CREATED",
  "TASK_CREATED_MANUAL",
  "TASK_DELEGATED",
  "TASK_MANUAL_CREATION_DISABLED",
  "TASK_ROUTED",
  "TA_CONTREPASSATION",
  "TA_ECART_RESOLU",
  "TA_MOUVEMENT",
  "TA_VISA",
  "TENANT_ACTIVATED",
  "TIMEOUT_TEST",
  "TRAINING_ASSIGNED",
  "TRAINING_COMPLETED",
  "TRAINING_SELF_VALIDATION_FORBIDDEN",
  "TRAINING_VALIDATED",
  "TRANSFERT_ETABLISSEMENT",
  "TRANSMISSION_AUTORITE",
  "TRANSPORT_DEADLETTER_REJOUEE",
  "TRIP_KYC_NOT_APPROVED",
  "TRIP_REVISED",
  "TRIP_SELF_APPROVAL_FORBIDDEN",
  "TRIP_SUBMITTED",
  "TRIP_VISA",
  "TXFLUX_IMPORT",
  "TX_GATE",
  "TX_REVIEW",
  "UBO_CHANGE",
  "UNDER_REVIEW",
  "VAULT_CERTIFIED_PURGE",
  "VAULT_WRITE",
  "VIEW_CREATE",
  "VRAI_POSITIF",
  "WORKFLOW_PUBLISH",
  "WORKLOAD_REASSIGN",
  "XB_DEROGATION_DEMANDEE",
  "XB_DEROGATION_VISEE",
  "XB_ORDRE_ENREGISTRE",
  "cpsi.client.registered",
  "cpsi.fp.declared",
  "cpsi.group.defined",
  "cpsi.insider.lifted",
  "cpsi.insider.tagged",
  "cpsi.param.adopted",
  "cpsi.param.applied",
  "cpsi.param.proposed",
  "cpsi.param.rejected",
  "cpsi.scenario.defined",
  "cpsi.signal.ingested",
  "fake-1.0",
  "gwb-private.ch",
  "gwb.ch",
  "notification",
  "pacs.008",
  "review.groupe.criteres",
  "review.groupe.enabled",
]);

export const versionDe = (type: string): number => SCHEMAS_EVENEMENTS[type]?.version ?? 1;
