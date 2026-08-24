// Source : docs/reference/olive-demo.html 42658-42701 — Questionnaire Builder (KYC + Account Review).
// Référentiels verbatim : métadonnées de types de question, droits, rôles responsables et
// modèles standard KYC / Account Review. Portés à l'identique (invent NOTHING).

export type QbType = "SECTION" | "TEXT" | "NUMBER" | "BOOL" | "SINGLE" | "MULTI" | "DATE" | "FILE";
export type QbQuestion = { id: string; label: string; type: string; right: string; role: string; required: boolean; options: string[]; _fileName?: string };
export type QbSection = { id: string; label: string; questions: QbQuestion[] };

export const QTYPE_META: Record<string, { icon: string; label: string }> = {
  SECTION: { icon: "▦", label: "Section / titre" },
  TEXT: { icon: "📝", label: "Texte" },
  NUMBER: { icon: "#", label: "Nombre" },
  BOOL: { icon: "◐", label: "Oui / Non" },
  SINGLE: { icon: "◉", label: "Choix unique" },
  MULTI: { icon: "☑", label: "Choix multiple" },
  DATE: { icon: "📅", label: "Date" },
  FILE: { icon: "📎", label: "Document" },
};

export const QB_RIGHTS = ["EDIT", "VIEW", "REQUIRED", "HIDDEN"];
export const QB_ROLES = ["RM / ARM", "Compliance", "Responsable AML", "BRM", "ESG Officer", "Legal", "Central File", "Comité"];

export const QB_TEMPLATE_KYC: QbSection[] = [
  { id: "s1", label: "Identité du client", questions: [
    { id: "q1", label: "Type de cocontractant", type: "SINGLE", right: "REQUIRED", role: "RM / ARM", required: true, options: ["Personne physique", "Société opérationnelle", "Société de domicile", "Trust", "Fondation", "Family Office"] },
    { id: "q2", label: "Dénomination / raison sociale", type: "TEXT", right: "EDIT", role: "RM / ARM", required: true, options: [] },
    { id: "q3", label: "Pays de constitution", type: "TEXT", right: "EDIT", role: "RM / ARM", required: true, options: [] },
    { id: "q4", label: "Entité financière régulée ?", type: "BOOL", right: "EDIT", role: "RM / ARM", required: false, options: [] },
  ] },
  { id: "s2", label: "Ayants droit & contrôle", questions: [
    { id: "q5", label: "Ayant droit économique (formulaire A)", type: "TEXT", right: "REQUIRED", role: "RM / ARM", required: true, options: [] },
    { id: "q6", label: "Un UBO est-il PEP ?", type: "BOOL", right: "REQUIRED", role: "Compliance", required: true, options: [] },
    { id: "q7", label: "% de détention", type: "NUMBER", right: "EDIT", role: "RM / ARM", required: true, options: [] },
  ] },
  { id: "s3", label: "Origine fonds & fortune", questions: [
    { id: "q8", label: "Origine des fonds (SOF)", type: "TEXT", right: "REQUIRED", role: "Compliance", required: true, options: [] },
    { id: "q9", label: "Origine de la fortune (SOW)", type: "TEXT", right: "REQUIRED", role: "Compliance", required: true, options: [] },
    { id: "q10", label: "Justificatif SOF/SOW", type: "FILE", right: "REQUIRED", role: "Central File", required: true, options: [] },
    { id: "q11", label: "Patrimoine total estimé (CHF)", type: "NUMBER", right: "EDIT", role: "RM / ARM", required: false, options: [] },
  ] },
];

export const QB_TEMPLATE_AR: QbSection[] = [
  { id: "a1", label: "Revue périodique du compte", questions: [
    { id: "r1", label: "Déclencheur de la revue", type: "SINGLE", right: "REQUIRED", role: "Compliance", required: true, options: ["Révision annuelle programmée", "Changement de profil de risque", "Alerte AML", "Transaction inhabituelle", "Hit PEP", "Demande FINMA", "Expiration documents"] },
    { id: "r2", label: "Changement de situation depuis la dernière revue ?", type: "BOOL", right: "REQUIRED", role: "RM / ARM", required: true, options: [] },
    { id: "r3", label: "Le profil de risque est-il toujours adéquat ?", type: "BOOL", right: "REQUIRED", role: "BRM", required: true, options: [] },
    { id: "r4", label: "Activité du compte conforme au profil attendu ?", type: "BOOL", right: "REQUIRED", role: "Compliance", required: true, options: [] },
    { id: "r5", label: "Transactions inhabituelles détectées (détail)", type: "TEXT", right: "EDIT", role: "Responsable AML", required: false, options: [] },
    { id: "r6", label: "Screening re-exécuté (sanctions/PEP/adverse) ?", type: "BOOL", right: "REQUIRED", role: "Responsable AML", required: true, options: [] },
    { id: "r7", label: "Documents toujours valides ?", type: "SINGLE", right: "EDIT", role: "Central File", required: true, options: ["À jour", "Expiration proche", "Expiré"] },
    { id: "r8", label: "Issue de la revue", type: "SINGLE", right: "REQUIRED", role: "Compliance", required: true, options: ["Risque inchangé", "Risque relevé", "Risque abaissé", "EDD déclenchée", "Escalade requise", "Clôture"] },
    { id: "r9", label: "Prochaine date de revue", type: "DATE", right: "EDIT", role: "Compliance", required: true, options: [] },
  ] },
];
