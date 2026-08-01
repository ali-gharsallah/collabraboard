// Source : docs/reference/olive-demo.html 30294-30868 — données statiques de la GED (plan de classement,
// statuts, fonctionnalités, workflow, connexions, puissance). Porté verbatim.
// GED_DOCS (seed 30 clients) vit dans legal-support (référence partagée). GedVivant/GedOcrTab reposent sur
// le harnais backend OLIVE_PROOFS (services GED réels) — hors périmètre parité, consignés dans l'écran.

export const GED_PLAN: [string, string][] = [["01-IDENT", "Identité & pièces officielles"], ["02-CDB", "Formulaires CDB (A/K/S/T)"], ["03-FISC", "Fiscalité (FATCA/CRS/TIN)"], ["04-AML", "AML & clarifications"], ["05-CONTRAT", "Contrats & mandats"], ["06-CORR", "Correspondance client"]];
export const GED_STATUS: any = { A_VALIDER: ["À valider", "amber"], VALIDE: ["Validé", "green"], ARCHIVE: ["Archivé", "inkSoft"] };

export const GED_FONCTIONS: any[] = [
  { th: "Entrée & preuve", items: [
    ["Canaux d'entrée paramétrables (scan, e-mail, upload, core banking)", 1],
    ["Preuve d'intégrité à la naissance de chaque version + ancrage horodaté qualifié", 1],
    ["Extraction de texte en dérivé — l'original jamais modifié", 1],
    ["Boîte d'arrivée par profils, délai qui signale sans bloquer", 1]] },
  { th: "Classement & gouvernance", items: [
    ["Plan de classement par banque — accès par profil ET par type", 1],
    ["Conservation par type — échéance posée au classement, destruction proposée, humain décide", 1],
    ["Gouvernance depuis l'écran Paramètres — motivée, journalisée, effet immédiat", 1],
    ["Gel juridique (legal hold) à tout moment, motivé", 1]] },
  { th: "Conservation & sécurité", items: [
    ["Coffre objet suisse — contenu hors base, clé par banque, relecture vérifiée", 1],
    ["Adaptateur Exoscale (S3 suisse) écrit — activation par configuration", 2],
    ["Chiffrement au repos avec référence de clé par banque · TLS en transit", 1],
    ["Journal d'audit chaîné, non modifiable — gravé en base", 1],
    ["Réconciliation coffre↔index — toute dérive devient un fait d'audit", 1]] },
  { th: "Consultation & travail", items: [
    ["Recherche filtrée AU RÉSULTAT — l'existence d'un document est déjà une information", 1],
    ["Dossiers-vues — des requêtes nommées, jamais des copies · évalués à l'état vivant", 1],
    ["Annotations en calque · caviardage en dérivé chaîné · divulgation prouvée", 1],
    ["Assistance IA sous les mêmes droits — propose, ne dispose pas · résidence suisse", 1]] },
  { th: "Sortie & fin de vie", items: [
    ["Destruction certifiée — coffre purgé, index retiré, la preuve survit au document", 1],
    ["Restauration par construction — versions immuables, état rejouable, dérive détectée", 1],
    ["Restauration base à l'instant T (PITR) + exercice annuel", 3]] },
  { th: "Intégration & échelle", items: [
    ["API REST complète — mêmes gardes que l'écran (doc d'intégration fournie)", 1],
    ["Core banking en port — lots signés, lecture seule, inconnu en quarantaine", 1],
    ["Coexistence avec la GED existante de la banque — port de source documentaire", 3],
    ["Quotas & télémétrie de volumétrie par banque", 3],
    ["Banc de charge à 1M+ documents · index plein-texte", 3]] }];

export const GED_WORKFLOW_ETAGES: any[] = [
  { ic: "⬇", nom: "Arrivée", regles: "—", desc: "Tout entre par un canal du registre (gedCanauxIngestion), journal d'ingestion, boîte default-deny (gedInboxRoles), SLA qui signale sans bloquer." },
  { ic: "🔏", nom: "Preuve", regles: "—", desc: "Empreinte SHA-256 à la naissance de chaque version, ancrage Merkle + horodatage qualifié (TSA). L'original devient opposable dès la première seconde." },
  { ic: "👁", nom: "OCR", regles: "R138", desc: "L'extraction est un DÉRIVÉ versionné (moteur, empreinte) — l'original n'est jamais modifié. Pas de prestataire configuré = pas d'extraction simulée." },
  { ic: "🗂", nom: "Classement", regles: "R112 · R139 · R151", desc: "Doublement habilité (rôle d'arrivée ET rôle du type cible). Le classement DÉCLENCHE l'indexation — pas d'OCR, pas de classement cherchable (garde CB-06)." },
  { ic: "🏦", nom: "Coffre", regles: "—", desc: "Le contenu vit au coffre suisse (storageRegion ch-gva-2), clé préfixée tenant, relecture qui re-vérifie l'empreinte, réconciliation qui MESURE la dérive." },
  { ic: "🔍", nom: "Consultation", regles: "—", desc: "On n'indexe que des dérivés ; on cherche SOUS habilitation, filtrée AU RÉSULTAT — l'existence d'un document est déjà une information. Trace sans contenus." },
  { ic: "🗃", nom: "Dossiers-vues", regles: "—", desc: "La vue est une REQUÊTE nommée, jamais une copie. Évaluée au résultat : même vue, deux rôles, deux contenus. Le détruit disparaît partout — l'état fait foi." },
  { ic: "✍", nom: "Travail humain", regles: "—", desc: "Les annotations sont un CALQUE : l'original reste intact au bit près (empreinte identique avant/après). Cercles de visibilité PRIVÉE / DOSSIER." },
  { ic: "⚫", nom: "Sortie & oubli", regles: "R158 · R159 · R115", desc: "Caviardage = dérivé chaîné par empreintes, zones MOTIVÉES ; divulgation prouvée (destinataire + empreinte) qui REFUSE l'original ; destruction certifiée : coffre purgé, index retiré, l'EMPREINTE survit." }];
export const GED_WORKFLOW_TRANSVERSAUX: any[] = [
  { ic: "✨", nom: "L'IA sous les contrôles", regles: "—", desc: "Elle emprunte l'habilitation de qui la convoque, produit des dérivés signés, propose sans disposer, réside où le tenant l'exige (CH)." },
  { ic: "🏧", nom: "Le core banking est un port", regles: "—", desc: "Port déclaré (Avaloq, Temenos, Finnova, ERI = des adaptateurs), lots signés LECTURE SEULE, mapping versionné, l'inconnu en quarantaine." }];

export const GED_CONNEXIONS: any[] = [
  { ecran: "Tâches ✓", sens: "GED → Tâches", desc: "Chaque signal GED devient une tâche, jamais un blocage : SLA d'arrivée dépassé, destruction proposée à l'échéance (GD-11), quarantaine core à résoudre.",
    evts: "ged.inbox.sla · ged.retention.proposee · tache.core.resolution" },
  { ecran: "KYC ◎", sens: "KYC ↔ GED", desc: "La section Documents (CDB) du dossier KYC vit des types GED (FORM_A, PASSEPORT, JUSTIF_DOMICILE…) ; pièce manquante = tâche ; le dossier lit par les MÊMES droits R112 — un seul filtre pour toute la maison.",
    evts: "ged.classement · ged.ingest" },
  { ecran: "Change of Circumstances ⇆", sens: "CoC → GED", desc: "Une action KYC/TASK déclenchée par un changement exige ses justificatifs : demandés par type, déposés, indexés, opposables — la preuve du changement entre dans la même chaîne que tout le reste.",
    evts: "ged.ingest · ged.classement" },
  { ecran: "Account Review ↻", sens: "AccRev → GED", desc: "La revue périodique s'appuie sur les DOSSIERS-VUES : « tout le client X », « pièces expirant » — évaluées sur l'état VIVANT (le détruit n'y est plus, R166), au droit du regardeur.",
    evts: "ged.vue.evaluee" },
  { ecran: "AML Monitoring ◬", sens: "AML → GED", desc: "La clarification motivée réfère ses documents PAR EMPREINTE ; une communication MROS sort par le caviardage chaîné et la divulgation prouvée — jamais l'original.",
    evts: "annotation.caviardage · annotation.divulgation" },
  { ecran: "Onboarding 🌱", sens: "Onboarding → GED", desc: "Chaque étape du parcours exige ses types de pièces ; l'arrivée alimente la branche de vie du client — le document est un événement du cycle, pas une annexe.",
    evts: "ged.ingest · ged.classement" }];

export const GED_PUISSANCE: any[] = [
  { eux: "Ils indexent tout et cherchent partout", nous: "Nous indexons des DÉRIVÉS et cherchons SOUS HABILITATION, filtrée au résultat — l'existence est une information" },
  { eux: "Ils stockent des fichiers", nous: "Nous PROUVONS des documents : empreinte à la naissance → Merkle+TSA → destruction certifiée où l'empreinte SURVIT" },
  { eux: "Ils ont une corbeille", nous: "Nous avons l'OUBLI CERTIFIÉ COMPLET : statut, coffre purgé, index retiré, vues vidées — en une chaîne prouvée (CB-03)" },
  { eux: "Ils masquent des zones à l'image", nous: "Nous chaînons des EMPREINTES : zones motivées, dérivé signé shaSource→shaDerive, divulgation prouvée qui REFUSE l'original" },
  { eux: "Ils plaquent de l'IA à côté des contrôles", nous: "Notre IA est SOUS les contrôles — habilitée comme un employé, tracée comme un acte, désavouable comme une proposition" },
  { eux: "Ils vendent des connecteurs propriétaires", nous: "Le core banking est un PORT : lecture seule par construction, lots signés ligne à ligne, l'inconnu en quarantaine" }];

export const GED_PUISSANCE_INVARIANTS: string[] = [
  "Append-only : l'audit ne se réécrit pas — il se chaîne (HMAC déterministe + trigger d'immuabilité SQL)",
  "Default-deny structurel : sans règle explicite, rien — jusqu'à l'EXISTENCE des documents",
  "Tenant structurel : RLS PostgreSQL + clés de coffre préfixées — l'isolation n'est pas un filtre, c'est la forme des données",
  "L'original est intouchable : OCR, annotations, caviardage, IA — tout est DÉRIVÉ signé",
  "Rien n'échoue en silence : pas de port = refus explicite ; dérive du coffre = fait d'audit ; erreur d'écran = panneau",
  "Le système mesure et notifie, il ne coerce pas — SLA, écarts IA, quarantaines : des tâches, jamais des murs"];
