// Source : docs/reference/olive-demo.html — OLIVIA_AGENTS (28085), OLIVIA_AGENT_SUITE (28191),
// OLIVIA_SUITES (28198), OLIVIA_AGENT_GUIDE (32197). Roster STATIQUE porté verbatim.
// Le moteur swarm (olivaSwarmRun / shariahScreen / chartes agents) relève du backend gouverné
// (OLIVE_PROOFS) : consigné dans l'écran, jamais recréé « de mémoire ».

export const OLIVIA_AGENTS: any[] = [
  { id: "KYC", name: "KYC Agent", icon: "◎", mission: "Complétude du dossier, structure légale, UBO, source de fonds/fortune.", poweredBy: "evalAmlRules() + complétude KYC (totalPct)" },
  { id: "AML", name: "AML Agent", icon: "⚠", mission: "Détection de schémas de blanchiment — structuration, montée en risque, activité inhabituelle.", poweredBy: "evalAmlRules() (règles AML) + AML_ALERTS" },
  { id: "SCREEN", name: "Screening Agent", icon: "◬", mission: "Sanctions, PEP, adverse media — jamais de décision automatique sur un hit.", poweredBy: "kyc.screening (OFAC/SECO/PEP/adverse)" },
  { id: "DOC", name: "Document Agent", icon: "▤", mission: "Extraction et vérification documentaire.", poweredBy: "OCR (simulation) + matrice documentaire" },
  { id: "RISK", name: "Risk Engine Agent", icon: "▲", mission: "Score de risque explicable, facteur par facteur.", poweredBy: "evalAmlRules() — détail des règles S1–S8" },
  { id: "COMP", name: "Compliance Officer Agent", icon: "⚖", mission: "Mémo de conformité — références réglementaires, contrôles requis. N'approuve jamais.", poweredBy: "Générateur de mémo (nouveau, déterministe)" },
  { id: "REG", name: "Regulatory Intelligence Agent", icon: "📚", mission: "Référentiel réglementaire suisse — FINMA, LBA/OBA, CDB 20, CRS/FATCA.", poweredBy: "Base de référence réglementaire (nouveau)" },
  { id: "RM", name: "RM Assistant Agent", icon: "✦", mission: "Préparation de rendez-vous, résumés client, emails de suivi.", poweredBy: "Copilot Olivia (widget existant, renommé)" },
  { id: "WF", name: "Workflow Agent", icon: "🗺", mission: "État des dossiers, SLA, escalades.", poweredBy: "Workflow Management (12 workflows nommés)" },
  { id: "ISLAMIC", name: "Islamic Finance Agent", icon: "☾", mission: "Compatibilité Sharia — secteurs prohibés, instruments à intérêt, zakat.", poweredBy: "shariahScreen() (nouveau)" },
  { id: "WEALTH", name: "Wealth Intelligence Agent", icon: "📈", mission: "Opportunités et risques de portefeuille.", poweredBy: "nbaSignalFor() (Prochaines meilleures actions)" },
  { id: "AUDIT", name: "Audit Agent", icon: "🔒", mission: "Traçabilité complète — qui, quoi, quand, pourquoi.", poweredBy: "PARAM_AUDIT (piste d'audit réelle de l'application)" },
];

export const OLIVIA_AGENT_SUITE: Record<string, string> = {
  KYC: "KYC Officer", DOC: "Documentation Officer",
  COMP: "Compliance Officer", REG: "Compliance Officer", AUDIT: "Compliance Officer",
  SCREEN: "Screening Officer", AML: "Screening Officer",
  RISK: "Risk Officer", WF: "Risk Officer",
  WEALTH: "Wealth Advisor", RM: "Wealth Advisor", ISLAMIC: "Wealth Advisor",
};

export const OLIVIA_SUITES = ["KYC Officer", "Compliance Officer", "Screening Officer", "Risk Officer", "Documentation Officer", "Wealth Advisor"];

export const OLIVIA_AGENT_GUIDE: any[] = [
  { name: "Pré-revue KYC", icon: "◎", what: "Analyse un dossier KYC et signale incohérences, pièces manquantes et points d'attention avant la revue humaine.", how: "« Pré-analyse le KYC de {client} »" },
  { name: "Triage AML", icon: "◬", what: "Priorise les alertes, regroupe les signaux liés et propose une qualification — à confirmer par un humain (R44).", how: "« Trie les alertes AML ouvertes »" },
  { name: "Routage CoC", icon: "⇆", what: "Classe un changement de circonstances par matérialité et propose l'action (rôle, révision KYC ou tâche).", how: "« Où router ce changement d'adresse ? »" },
  { name: "Veille réglementaire", icon: "📡", what: "Résume les évolutions FINMA/CDB/LBA pertinentes et leur impact sur les dossiers concernés.", how: "« Quoi de neuf côté FINMA cette semaine ? »" },
  { name: "Synthèse client 360°", icon: "👤", what: "Produit un snapshot d'un client (relations, risque, historique) pour préparer un entretien ou un comité.", how: "« Prépare le snapshot de {client} »" },
  { name: "Assistant rédaction", icon: "✍", what: "Rédige motifs, clarifications OBA et notes de dossier à partir d'éléments factuels — l'humain valide et décide.", how: "« Rédige la clarification SOF pour {client} »" },
];
