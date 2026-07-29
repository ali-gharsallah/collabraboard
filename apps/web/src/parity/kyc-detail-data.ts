import { T } from "./tokens";

// Données KycDetailScreen — PORT VERBATIM (olive-demo.html : QUESTIONS_TEMPLATE 16323,
// KYC_SECTION_LIST 16315, SECTIONS_STATIC 16672, SECTION_VISA 16733, kycMatrixRole 16265,
// SECTION_ROLE_VIS_DEFAULT 16294). Le KYC de démo « Zhang Wei Family Office » (kyc.answers
// non fourni par la fixture) → gabarit QUESTIONS_TEMPLATE (règle « pas de prefill » inverse :
// ici c'est LE dossier de référence rempli de la maquette).

export type Question = { id: string; q: string; a: string; right: "EDIT" | "VIEW" | "REQUIRED" | "HIDDEN"; by: string | null; at: string | null; changed: boolean };

export const SECTIONS_STATIC = [
  { id: "identity", label: "Identité du client", icon: "◑", filled: 9, total: 11 },
  { id: "ubo", label: "Ayants droit & contrôle", icon: "◆", filled: 4, total: 7 },
  { id: "persons", label: "Personnes liées", icon: "☺", filled: 4, total: 5 },
  { id: "relation", label: "Relation d'affaires", icon: "⇆", filled: 6, total: 8 },
  { id: "sofsow", label: "Origine fonds & fortune", icon: "◫", filled: 4, total: 9 },
  { id: "mandat", label: "Mandat & portefeuilles", icon: "▦", filled: 4, total: 5 },
  { id: "screening", label: "Screening (sanctions/PEP)", icon: "◬", filled: 6, total: 7 },
  { id: "risk", label: "Profil de risque", icon: "▲", filled: 5, total: 6 },
  { id: "aml", label: "AML / LBA", icon: "⚠", filled: 3, total: 8 },
  { id: "tax", label: "Fiscalité (FATCA/CRS)", icon: "▦", filled: 4, total: 7 },
  { id: "crossborder", label: "Cross-border", icon: "🌐", filled: 1, total: 4 },
  { id: "esg", label: "ESG", icon: "🌿", filled: 1, total: 5 },
  { id: "docs", label: "Documents (CDB)", icon: "▤", filled: 6, total: 12 },
  { id: "workflow", label: "Workflow & validation", icon: "✓", filled: 1, total: 6 },
];

export const SECTION_STATUS_STYLE: Record<string, [string, string]> = {
  "Vide": [T.inkSoft, T.lineSoft], "En cours": [T.amber, T.amberSoft], "Complète": [T.blue, T.blueSoft],
  "Vérifiée": [T.olive700, T.oliveSoft], "Approuvée": [T.green, T.greenSoft],
};
export const RIGHT_STYLE: Record<string, [string, string, string]> = {
  EDIT: [T.olive700, T.oliveSoft, "Modifiable"], VIEW: [T.inkSoft, T.lineSoft, "Lecture seule"],
  REQUIRED: [T.amber, T.amberSoft, "Contribution requise"], HIDDEN: [T.inkSoft, T.lineSoft, "Masquée"],
};

export const SECTION_VISA: Record<string, { role: string; who: string; status: string; at?: string }[]> = {
  identity: [{ role: "ARM", who: "A. Gharsallah", status: "signed", at: "06 jan" }],
  ubo: [{ role: "Compliance", who: "S. Marchand", status: "pending" }],
  persons: [{ role: "ARM", who: "A. Gharsallah", status: "signed", at: "06 jan" }],
  relation: [{ role: "ARM", who: "A. Gharsallah", status: "signed", at: "06 jan" }],
  sofsow: [{ role: "Compliance", who: "S. Marchand", status: "pending" }],
  screening: [{ role: "Compliance", who: "S. Marchand", status: "signed", at: "hier" }],
  risk: [{ role: "BRM", who: "—", status: "pending" }],
  aml: [{ role: "Responsable AML", who: "—", status: "pending" }],
  tax: [{ role: "ARM", who: "A. Gharsallah", status: "signed", at: "06 jan" }],
  crossborder: [{ role: "Legal", who: "—", status: "pending" }],
  esg: [{ role: "ESG Officer", who: "—", status: "pending" }],
  docs: [{ role: "Central File", who: "—", status: "pending" }],
  workflow: [{ role: "Head of PB", who: "—", status: "pending" }, { role: "CEO", who: "—", status: "pending" }],
};

export const MESSAGES_SEED = [
  { who: "A. Gharsallah", role: "ARM", at: "06 jan 10:24", text: "Dossier complété pour les sections Identité, Relation et Personnes. Je passe la main à la compliance pour SOF/SOW et AML." },
  { who: "S. Marchand", role: "Compliance", at: "hier 16:50", text: "Reçu. Il manque les justificatifs SOF — peux-tu relancer le client via l'apporteur ? Je bloque mon visa AML tant qu'on n'a pas la cohérence patrimoine/activité." },
  { who: "A. Gharsallah", role: "ARM", at: "aujourd'hui 09:15", text: "Relance envoyée. Organigramme de détention ajouté entre-temps — le score est repassé à 61 (EDD)." },
];

export const WF_STEPS = [
  { ph: "SAISIE", label: "Saisie RM", role: "Relationship Manager", icon: "✎" },
  { ph: "COMPLIANCE", label: "Revue Compliance", role: "Compliance Officer", icon: "◑" },
  { ph: "AML", label: "Clarifications AML", role: "Responsable AML", icon: "◬" },
  { ph: "COMITE", label: "Validation comité", role: "BRM + Comité", icon: "⚖" },
];
export const WF_ORDER = ["SAISIE", "COMPLIANCE", "AML", "COMITE", "APPROBATION"];

// kycMatrixRole (16265) + visibilité section×rôle (SECTION_ROLE_VIS_DEFAULT 16294) — verbatim.
export function kycMatrixRole(user: any): string | null {
  const r = user && user.role;
  if (!r) return "CO";
  if (r === "ARM") return "RM";
  if (r === "CO_SR") return "CO";
  if (r === "DIR" || r === "CEO") return "HPB";
  if (["RM", "BRM", "CO", "AML", "ESG", "LEGAL", "CF", "HPB"].indexOf(r) >= 0) return r;
  return null; // ADMIN / SECU / AUDIT / FINMA → voient tout
}
const HIDE: Record<string, string[]> = {
  RM: ["screening", "aml"],
  BRM: ["ubo", "persons", "sofsow", "screening", "aml", "tax", "crossborder", "esg", "docs"],
  AML: ["esg", "crossborder"],
  ESG: ["ubo", "persons", "relation", "sofsow", "screening", "risk", "aml", "tax", "crossborder", "docs"],
  LEGAL: ["ubo", "persons", "sofsow", "screening", "risk", "aml", "tax", "esg", "docs"],
  CF: ["ubo", "persons", "relation", "sofsow", "screening", "risk", "aml", "tax", "crossborder", "esg"],
};
export const sectionVisibleTo = (sectionId: string, role: string | null) =>
  !role || !HIDE[role] || HIDE[role].indexOf(sectionId) < 0;

export const KYC_SECTION_LIST = [
  { id: "identity", label: "Identité" }, { id: "ubo", label: "UBO" }, { id: "persons", label: "Personnes" }, { id: "relation", label: "Relation d'affaires" },
  { id: "sofsow", label: "Origine fonds & fortune" }, { id: "mandat", label: "Mandat & portefeuilles" }, { id: "screening", label: "Screening" }, { id: "risk", label: "Risque" },
  { id: "aml", label: "AML" }, { id: "tax", label: "Fiscalité" }, { id: "crossborder", label: "Cross-border" }, { id: "esg", label: "ESG" }, { id: "docs", label: "Documents" }, { id: "workflow", label: "Workflow & validation" },
];

export const QUESTIONS_TEMPLATE: Record<string, Question[]> = {
  mandat: [
    { id: "MAN-Q1", q: "Type de mandat de gestion (référentiel paramétrable)", a: "Discrétionnaire", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "MAN-Q2", q: "Portefeuilles rattachés (multi)", a: "PF-2026-001 · CHF Balanced — CHF 12.4M ; PF-2026-002 · USD Growth — USD 8.1M ; PF-2026-003 · Private Markets — CHF 4.0M", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "MAN-Q3", q: "Profil de risque investisseur (LSFin)", a: "Équilibré — questionnaire signé le 05.01.2026", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "MAN-Q4", q: "Restrictions d'investissement", a: "Exclusion armement & tabac ; max 10% marchés privés", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: true },
    { id: "MAN-Q5", q: "Benchmark / objectif de rendement", a: "— à compléter —", right: "REQUIRED", by: null, at: null, changed: false },
  ],
  identity: [
    { id: "ID-Q1", q: "Type de cocontractant", a: "Personne morale — Family Office", right: "EDIT", by: "A. Gharsallah", at: "05 jan 2026", changed: false },
    { id: "ID-Q2", q: "Dénomination / raison sociale", a: "Zhang Wei Family Office Pte Ltd", right: "EDIT", by: "A. Gharsallah", at: "05 jan 2026", changed: false },
    { id: "ID-Q3", q: "Forme juridique", a: "Private Limited (Pte Ltd)", right: "EDIT", by: "A. Gharsallah", at: "05 jan 2026", changed: false },
    { id: "ID-Q4", q: "Société de domicile ou opérationnelle ?", a: "Opérationnelle → formulaire K", right: "VIEW", by: "Système", at: "05 jan 2026", changed: true },
    { id: "ID-Q5", q: "Pays de constitution", a: "Singapour", right: "EDIT", by: "A. Gharsallah", at: "05 jan 2026", changed: false },
    { id: "ID-Q6", q: "N° registre du commerce", a: "201834521K", right: "EDIT", by: "A. Gharsallah", at: "05 jan 2026", changed: false },
    { id: "ID-Q7", q: "Date de constitution", a: "14 août 2018", right: "EDIT", by: "A. Gharsallah", at: "05 jan 2026", changed: false },
    { id: "ID-Q8", q: "Secteur d'activité (code NOGA/NACE)", a: "Négoce matières premières, immobilier", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "ID-Q9", q: "Pays d'activité principal", a: "Singapour, Hong Kong", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "ID-Q10", q: "Entité cotée en bourse ?", a: "Non", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "ID-Q11", q: "Entité financière régulée ? (autorité)", a: "— à confirmer —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
    { id: "IDE-QN1", q: "Nationalité principale (combo pays)", a: "Suisse", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "IDE-QN2", q: "Deuxième nationalité (combo pays)", a: "Turquie", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "IDE-QN3", q: "Troisième nationalité (combo pays)", a: "Royaume-Uni", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "IDE-QF1", q: "Résidence fiscale principale (combo pays + canton)", a: "Suisse — Genève · TIN 756.1234.5678.97", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "IDE-QF2", q: "Résidences fiscales secondaires (multi — pays, TIN, quote-part)", a: "Émirats arabes unis — TRN 100123456700003 (résidence 90 j/an) ; Royaume-Uni — non-dom remittance basis, UTR 1234567890", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: true },
    { id: "IDE-QP1", q: "Statut PEP (combo : Non-PEP / PEP / Near-PEP / Ex-PEP)", a: "Ex-PEP", right: "REQUIRED", by: "I. Vernet", at: "08 jan 2026", changed: true },
    { id: "IDE-QP2", q: "Fonction publique exercée (si PEP/Ex-PEP)", a: "Ministre adjoint des finances — Turquie", right: "EDIT", by: "I. Vernet", at: "08 jan 2026", changed: false },
    { id: "IDE-QP3", q: "Période d'exercice (depuis / jusqu'à)", a: "03.2014 → 06.2019 — déclassement Ex-PEP validé par le Comité le 12.03.2025 (5 ans révolus, art. 2a al. 1 let. a LBA)", right: "EDIT", by: "I. Vernet", at: "08 jan 2026", changed: false },
    { id: "IDE-QP4", q: "Lien avec un PEP (si Near-PEP : nature du lien, identité, fonction)", a: "— non applicable —", right: "VIEW", by: "—", at: "—", changed: false },
  ],
  ubo: [
    { id: "UBO-Q1", q: "Ayant droit économique (formulaire A)", a: "Zhang Wei — 60% effectif", right: "REQUIRED", by: "A. Gharsallah", at: "06 jan 2026", changed: true },
    { id: "UBO-Q2", q: "Détenteur du contrôle (formulaire K)", a: "Zhang Wei (> 25% droits de vote)", right: "REQUIRED", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "UBO-Q3", q: "Chaîne de contrôle reconstituée ?", a: "Oui — 3 niveaux (SG→BVI→CH)", right: "VIEW", by: "Système", at: "hier", changed: true },
    { id: "UBO-Q4", q: "% de détention indirecte", a: "40% via holding BVI", right: "EDIT", by: "A. Gharsallah", at: "hier", changed: false },
    { id: "UBO-Q5", q: "Structure de domicile interposée ?", a: "Oui — holding BVI", right: "VIEW", by: "Système", at: "hier", changed: true },
    { id: "UBO-Q6", q: "Un UBO est-il PEP ?", a: "— à vérifier screening —", right: "REQUIRED", by: "— en attente CO —", at: "—", changed: false },
    { id: "UBO-Q7", q: "Bénéficiaires additionnels", a: "— à confirmer —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
  ],
  persons: [
    { id: "PER-Q1", q: "Signataires autorisés", a: "3 personnes (voir Signataires)", right: "VIEW", by: "Système", at: "hier", changed: false },
    { id: "PER-Q2", q: "Mandataires / procurations", a: "Li Mei (épouse), Cabinet Tan & Co", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "PER-Q3", q: "Représentants légaux", a: "David Chen (directeur)", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: true },
    { id: "PER-Q4", q: "Conseillers externes (avocat/fiduciaire)", a: "Étude Tan & Co (SG)", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "PER-Q5", q: "Apporteur d'affaires identifié & KYC ?", a: "— KYC apporteur à joindre —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
  ],
  relation: [
    { id: "REL-Q1", q: "Objet de la relation d'affaires", a: "Gestion de fortune discrétionnaire", right: "EDIT", by: "A. Gharsallah", at: "05 jan 2026", changed: true },
    { id: "REL-Q2", q: "Origine de la mise en relation", a: "Apporteur — Étude Tan & Co (SG)", right: "EDIT", by: "A. Gharsallah", at: "05 jan 2026", changed: false },
    { id: "REL-Q3", q: "Volume d'avoirs attendu (CHF)", a: "45 000 000 – 50 000 000", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: true },
    { id: "REL-Q4", q: "Produits & services souhaités", a: "Mandat discrétionnaire, crédit lombard", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "REL-Q5", q: "Durée de relation envisagée", a: "Long terme (> 10 ans)", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "REL-Q6", q: "Canal d'entrée en relation", a: "À distance (visio + apporteur)", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "REL-Q7", q: "Motivation du choix de la Suisse", a: "— à documenter —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
    { id: "REL-Q8", q: "Comptes détenus dans d'autres banques", a: "— à confirmer —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
  ],
  sofsow: [
    { id: "SOF-Q1", q: "Origine des fonds (SOF)", a: "Cession d'actifs immobiliers (2023)", right: "REQUIRED", by: "— en attente CO —", at: "—", changed: false },
    { id: "SOW-Q1", q: "Origine de la fortune (SOW)", a: "Négoce de matières premières", right: "REQUIRED", by: "— en attente CO —", at: "—", changed: false },
    { id: "SOF-Q2", q: "Justificatifs SOF fournis ?", a: "Partiels — relances en cours", right: "EDIT", by: "A. Gharsallah", at: "aujourd'hui", changed: true },
    { id: "SOW-Q2", q: "Cohérence patrimoine / activité", a: "— à évaluer —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
    { id: "SOF-Q3", q: "Montant de l'apport initial (CHF)", a: "12 000 000", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "SOF-Q4", q: "Origine & fréquence des apports futurs", a: "Dividendes négoce — trimestriels", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "SOW-Q3", q: "Patrimoine total estimé (CHF)", a: "~ 180 000 000", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "SOW-Q4", q: "Revenus annuels estimés (CHF)", a: "— à documenter —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
    { id: "SOW-Q5", q: "Corroboration documentaire de la SOW", a: "— à évaluer CO —", right: "REQUIRED", by: "— en attente CO —", at: "—", changed: false },
  ],
  screening: [
    { id: "SCR-Q1", q: "Hit sanctions (OFAC/SECO/UE/ONU)", a: "Aucun", right: "VIEW", by: "Système", at: "hier", changed: false },
    { id: "SCR-Q2", q: "Statut PEP", a: "PEP indirect (2e degré)", right: "VIEW", by: "Système", at: "hier", changed: true },
    { id: "SCR-Q3", q: "Adverse media", a: "Aucun signalement", right: "VIEW", by: "Système", at: "hier", changed: false },
    { id: "SCR-Q4", q: "Qualification des hits", a: "1 hit PEP confirmé, 0 faux positif", right: "EDIT", by: "S. Marchand", at: "hier", changed: true },
    { id: "SCR-Q5", q: "Listes secondaires vérifiées ?", a: "Oui — World-Check, Dow Jones", right: "VIEW", by: "Système", at: "hier", changed: false },
    { id: "SCR-Q6", q: "Date du dernier screening", a: "hier", right: "VIEW", by: "Système", at: "hier", changed: false },
    { id: "SCR-Q7", q: "Fréquence de re-screening", a: "Continue (perpetual)", right: "EDIT", by: "S. Marchand", at: "hier", changed: false },
  ],
  risk: [
    { id: "RSK-Q1", q: "Score de risque calculé", a: "61 / 100", right: "VIEW", by: "Système", at: "aujourd'hui", changed: true },
    { id: "RSK-Q2", q: "Classification", a: "ÉLEVÉ (HIGH)", right: "VIEW", by: "Système", at: "aujourd'hui", changed: true },
    { id: "RSK-Q3", q: "Niveau de due diligence", a: "EDD (Enhanced Due Diligence)", right: "VIEW", by: "Système", at: "aujourd'hui", changed: false },
    { id: "RSK-Q4", q: "Facteurs aggravants identifiés", a: "PEP + structure offshore + cash", right: "EDIT", by: "S. Marchand", at: "aujourd'hui", changed: true },
    { id: "RSK-Q5", q: "Pays à risque dans la structure", a: "BVI (offshore)", right: "VIEW", by: "Système", at: "aujourd'hui", changed: false },
    { id: "RSK-Q6", q: "Override manuel du score ? (justifié)", a: "— non —", right: "REQUIRED", by: "— en attente BRM —", at: "—", changed: false },
  ],
  aml: [
    { id: "AML-Q1", q: "Clarifications particulières (OBA Art.6)", a: "Requises — structure complexe + PEP", right: "REQUIRED", by: "— en attente CO —", at: "—", changed: false },
    { id: "AML-Q2", q: "Pays à risque impliqués ?", a: "Singapour, BVI — surveillance", right: "EDIT", by: "S. Marchand", at: "hier", changed: true },
    { id: "AML-Q3", q: "Plan de surveillance (KYT)", a: "— à définir —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
    { id: "AML-Q4", q: "Activité attendue (volume/nb transactions)", a: "— à documenter —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
    { id: "AML-Q5", q: "Contreparties & pays de flux attendus", a: "— à documenter —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
    { id: "AML-Q6", q: "Activité à forte intensité cash ?", a: "Non", right: "EDIT", by: "S. Marchand", at: "hier", changed: false },
    { id: "AML-Q7", q: "Recours à des espèces / crypto-actifs ?", a: "— à clarifier —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
    { id: "AML-Q8", q: "Déclaration MROS envisagée ?", a: "Non à ce stade", right: "HIDDEN", by: "—", at: "—", changed: false },
  ],
  tax: [
    { id: "TAX-Q1", q: "Résidence fiscale", a: "Singapour", right: "EDIT", by: "A. Gharsallah", at: "05 jan 2026", changed: false },
    { id: "TAX-Q2", q: "Numéro d'identification fiscale (TIN)", a: "•••••••• (tokenisé)", right: "EDIT", by: "A. Gharsallah", at: "05 jan 2026", changed: false },
    { id: "TAX-Q3", q: "Statut FATCA (US person ?)", a: "Non — Non-US", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: true },
    { id: "TAX-Q4", q: "Auto-certification CRS signée ?", a: "— en attente signature —", right: "REQUIRED", by: "— client —", at: "—", changed: false },
    { id: "TAX-Q5", q: "Autres résidences fiscales", a: "— à confirmer —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
    { id: "TAX-Q6", q: "Indices US (US indicia) détectés ?", a: "Aucun", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "TAX-Q7", q: "Juridictions CRS à déclarer", a: "Singapour", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
  ],
  crossborder: [
    { id: "XB-Q1", q: "Restrictions de solicitation (pays) ?", a: "Singapour — règles applicables vérifiées", right: "EDIT", by: "S. Marchand", at: "hier", changed: false },
    { id: "XB-Q2", q: "Licence requise pour la juridiction ?", a: "— à confirmer legal —", right: "REQUIRED", by: "— en attente legal —", at: "—", changed: false },
    { id: "XB-Q3", q: "Signature des documents hors Suisse ?", a: "— à confirmer —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
    { id: "XB-Q4", q: "Déplacement du banquier (Business Trip) ?", a: "— à déclarer —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
  ],
  esg: [
    { id: "ESG-Q1", q: "Secteur sensible ESG ?", a: "Matières premières — vigilance", right: "EDIT", by: "S. Marchand", at: "hier", changed: false },
    { id: "ESG-Q2", q: "Exposition risque climatique", a: "— à évaluer —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
    { id: "ESG-Q3", q: "Secteurs controversés (armes, charbon…) ?", a: "— à évaluer —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
    { id: "ESG-Q4", q: "Politique d'exclusion applicable ?", a: "— à confirmer —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
    { id: "ESG-Q5", q: "Controverses publiques connues ?", a: "— à évaluer —", right: "HIDDEN", by: "—", at: "—", changed: false },
  ],
  docs: [
    { id: "DOC-Q1", q: "Pièce d'identité UBO", a: "Fournie — passeport SG", right: "EDIT", by: "A. Gharsallah", at: "05 jan 2026", changed: false },
    { id: "DOC-Q2", q: "Formulaire A (ayant droit éco.)", a: "Signé", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: true },
    { id: "DOC-Q3", q: "Formulaire K (détenteur contrôle)", a: "Signé", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "DOC-Q4", q: "Justificatif de domicile", a: "Fourni", right: "EDIT", by: "A. Gharsallah", at: "05 jan 2026", changed: false },
    { id: "DOC-Q5", q: "Documents de structure (organigramme)", a: "Fourni", right: "EDIT", by: "A. Gharsallah", at: "aujourd'hui", changed: true },
    { id: "DOC-Q6", q: "Justificatifs SOF/SOW", a: "Partiels — relances", right: "EDIT", by: "A. Gharsallah", at: "aujourd'hui", changed: false },
    { id: "DOC-Q7", q: "Auto-certification CRS", a: "— manquant —", right: "REQUIRED", by: "— client —", at: "—", changed: false },
    { id: "DOC-Q8", q: "Statuts de la société", a: "— manquant —", right: "REQUIRED", by: "— client —", at: "—", changed: false },
    { id: "DOC-Q9", q: "Formulaire FATCA (W-8BEN-E)", a: "— manquant —", right: "REQUIRED", by: "— client —", at: "—", changed: false },
    { id: "DOC-Q10", q: "Extrait du registre du commerce (< 3 mois)", a: "— manquant —", right: "REQUIRED", by: "— client —", at: "—", changed: false },
    { id: "DOC-Q11", q: "Procuration / mandat de gestion", a: "Fourni", right: "EDIT", by: "A. Gharsallah", at: "06 jan 2026", changed: false },
    { id: "DOC-Q12", q: "KYC de l'apporteur d'affaires", a: "— manquant —", right: "REQUIRED", by: "— en attente —", at: "—", changed: false },
  ],
  workflow: [
    { id: "WF-Q1", q: "Revue 1er niveau (RM)", a: "Validé — A. Gharsallah", right: "VIEW", by: "A. Gharsallah", at: "08 jan", changed: true },
    { id: "WF-Q2", q: "Revue compliance (CO)", a: "En cours — S. Marchand", right: "REQUIRED", by: "S. Marchand", at: "—", changed: false },
    { id: "WF-Q3", q: "Validation EDD (comité)", a: "— en attente —", right: "REQUIRED", by: "— comité —", at: "—", changed: false },
    { id: "WF-Q4", q: "Contrôle four-eyes (créateur ≠ valideur)", a: "— en attente —", right: "REQUIRED", by: "— système —", at: "—", changed: false },
    { id: "WF-Q5", q: "Motivation de la décision", a: "— à documenter —", right: "REQUIRED", by: "— comité —", at: "—", changed: false },
    { id: "WF-Q6", q: "Décision finale", a: "— en attente —", right: "HIDDEN", by: "—", at: "—", changed: false },
  ],
};
