// Moteur de score AML explicable — PORT VERBATIM de docs/reference/olive-demo.html
// (AML_PARAMS 15091, AML_SCORING_RULES 15100, evalAmlRules 15147). Source unique de la
// colonne « facteurs » du ScorePopover / RiskFactorsList.
//
// NOTE DE PARITÉ (consignée) : les règles transactionnelles S31–S36 interrogent TX_DATA /
// AML_ALERTS, non extraits en fixtures → ici tableaux vides ⇒ ces règles restent inertes.
// Le SCORE AFFICHÉ dans la table vient de `c.score` (fixture, calculé par la maquette AVEC
// ces données) — donc exact ; seul le détail transactionnel du popover est absent.
const TX_DATA: any[] = [];
const AML_ALERTS: any[] = [];

export const AML_PARAMS: Record<string, { value: number; label: string; unit: string; rule: string }> = {
  UBO_CONTROL_PCT: { value: 25, label: "Seuil de contrôle UBO (%)", unit: "%", rule: "S17" },
  AUM_VERY_HIGH_M: { value: 100, label: "AUM très élevé (CHF M)", unit: "CHF M", rule: "S7" },
  MASS_AFFLUENT_MAX_M: { value: 5, label: "Plafond cohérence Mass Affluent (CHF M)", unit: "CHF M", rule: "S22" },
  TX_VOLUME_30D_M: { value: 5, label: "Volume transactionnel 30 j (CHF M)", unit: "CHF M", rule: "S33" },
  ALERT_CUMUL_MIN: { value: 2, label: "Cumul d'alertes déclencheur (nb typologies)", unit: "nb", rule: "S35" },
};

type Rule = { id: string; cat: string; label: string; pts: number; on?: boolean; test: (c: any, k: any) => boolean };
export const AML_SCORING_RULES: Rule[] = [
  { id: "S1", cat: "Personne", label: "Exposition politique (PEP)", pts: 25, test: (c, k) => !!(c && c.pep) || !!(k && k.screening && k.screening.pep === "HIT") },
  { id: "S9", cat: "Personne", label: "Proche / associé de PEP (RCA) — hit sans statut déclaré", pts: 15, test: (c) => { const tags = (c && c.tags) || []; return tags.indexOf("PEP-Hit") >= 0 && !(c && c.pep); } },
  { id: "S10", cat: "Personne", label: "Fonction publique ou secteur étatique", pts: 10, test: (c, k) => { const sec = ((c && c.sector) || (k && k.sector) || "").toLowerCase(); return /public|état|etat|gouvernement|administration/.test(sec); } },
  { id: "S2", cat: "Screening", label: "Hit screening sanctions (OFAC/SECO)", pts: 30, test: (c, k) => { const sc = (k && k.screening) || {}; return sc.ofac === "HIT" || sc.seco === "HIT"; } },
  { id: "S3", cat: "Screening", label: "Presse négative (adverse media)", pts: 20, test: (c, k) => !!(k && k.screening && k.screening.adverse === "HIT") },
  { id: "S11", cat: "Screening", label: "Pays sous embargo complet (IR/KP/SY/CU)", pts: 40, test: (c, k) => { const cc = (c && c.countryCode) || (k && k.countryCode) || ""; return ["IR", "KP", "SY", "CU"].indexOf(cc) >= 0; } },
  { id: "S12", cat: "Screening", label: "Incohérence déclarative — hit PEP screening vs statut déclaré", pts: 15, test: (c, k) => !!(k && k.screening && k.screening.pep === "HIT") && !(c && c.pep) },
  { id: "S4", cat: "Géographie", label: "Juridiction à risque / offshore", pts: 20, test: (c, k) => { const cc = (c && c.countryCode) || (k && k.countryCode) || ""; const tags = (c && c.tags) || (k && k.tags) || []; return ["RU", "KY", "PA", "VG", "BS", "IR", "KP", "SY"].indexOf(cc) >= 0 || tags.indexOf("Offshore") >= 0; } },
  { id: "S13", cat: "Géographie", label: "Pays sous surveillance GAFI (liste grise)", pts: 15, test: (c, k) => { const cc = (c && c.countryCode) || (k && k.countryCode) || ""; return ["PA", "AE", "TR", "NG", "PH", "VN", "ZA", "MC"].indexOf(cc) >= 0; } },
  { id: "S14", cat: "Géographie", label: "Résidence hors UE/AELE sans lien suisse", pts: 8, test: (c, k) => { const cc = (c && c.countryCode) || (k && k.countryCode) || ""; const eu = ["CH", "LI", "FR", "DE", "IT", "AT", "BE", "NL", "LU", "ES", "PT", "GB", "IE", "DK", "SE", "FI", "NO", "IS", "PL", "CZ", "GR", "MC"]; return !!cc && eu.indexOf(cc) < 0; } },
  { id: "S15", cat: "Géographie", label: "Empreinte multi-juridictionnelle (CRS ≠ pays de résidence)", pts: 8, test: (c) => { const cc = (c && c.countryCode) || ""; const tags = (c && c.tags) || []; return tags.some((t: string) => t.indexOf("CRS-") === 0 && t.slice(4) !== cc); } },
  { id: "S5", cat: "Structure", label: "Structure complexe (Trust/Holding/Fondation)", pts: 10, test: (c) => { const t = (c && c.type) || ""; return ["TRUST", "HOLD", "FOND"].indexOf(t) >= 0; } },
  { id: "S16", cat: "Structure", label: "Société de domicile (CDB 20 — form. K requis)", pts: 15, test: (c, k) => ((c && c.type) || (k && k.structCode)) === "DOM" },
  { id: "S17", cat: "Structure", label: "UBO sous le seuil de contrôle (chaîne à clarifier)", pts: 12, test: (c, k) => { const sh = (k && k.uboShare) || ""; const m = String(sh).match(/(\d+)/); return !!(m && parseInt(m[1]) < AML_PARAMS.UBO_CONTROL_PCT.value); } },
  { id: "S18", cat: "Structure", label: "UBO est une entité (structure en cascade)", pts: 15, test: (c, k) => { const u = (k && k.uboName) || (c && c.uboName) || ""; return /SA$|Ltd|GmbH|Invest|Group|Groupe|Trust$|Management|Associates|Wealth/.test(u); } },
  { id: "S8", cat: "Structure", label: "UBO ≠ titulaire (détention indirecte)", pts: 10, test: (c, k) => { const u = (k && k.uboName) || (c && c.uboName) || ""; const n = (c && c.name) || (k && k.clientName) || ""; return !!(u && n && u !== n && u !== "—"); } },
  { id: "S6", cat: "Activité", label: "Secteur sensible (crypto, matières 1res, défense, jeux)", pts: 15, test: (c, k) => { const sec = ((c && c.sector) || (k && k.sector) || "").toLowerCase(); return /crypto|mati|défense|defense|jeux|gambling|armes/.test(sec); } },
  { id: "S19", cat: "Activité", label: "Secteur à forte intensité de cash (retail, restauration)", pts: 10, test: (c, k) => { const sec = ((c && c.sector) || (k && k.sector) || "").toLowerCase(); return /retail|distribution|restaur|commerce/.test(sec); } },
  { id: "S20", cat: "Activité", label: "Immobilier (vecteur classique de blanchiment)", pts: 8, test: (c, k) => { const sec = ((c && c.sector) || (k && k.sector) || "").toLowerCase(); return /immobilier/.test(sec); } },
  { id: "S21", cat: "Activité", label: "Private equity / véhicule non régulé", pts: 8, test: (c, k) => { const sec = ((c && c.sector) || (k && k.sector) || "").toLowerCase(); return /private equity/.test(sec); } },
  { id: "S7", cat: "Relation", label: "AUM très élevé (seuil paramétrable)", pts: 5, test: (c, k) => { const a = String((c && c.aum) || (k && k.aum) || ""); const m = a.match(/([\d.]+)\s*M/i); return !!(m && parseFloat(m[1]) > AML_PARAMS.AUM_VERY_HIGH_M.value); } },
  { id: "S22", cat: "Relation", label: "AUM incohérent avec le segment Mass Affluent", pts: 12, test: (c, k) => { const seg = (c && c.segment) || (k && k.segment) || ""; const a = String((c && c.aum) || (k && k.aum) || ""); const m = a.match(/([\d.]+)\s*M/i); return seg === "Mass Affluent" && !!(m && parseFloat(m[1]) > AML_PARAMS.MASS_AFFLUENT_MAX_M.value); } },
  { id: "S23", cat: "Relation", label: "Relation récente (< 12 mois — surveillance renforcée)", pts: 8, test: (c, k) => { const d = (c && c.onboardingDate) || (k && k.createdAt) || ""; return !!d && d >= "2025-07-11"; } },
  { id: "S24", cat: "Relation", label: "Revue périodique dépassée (next review échue)", pts: 10, test: (c, k) => { const nr = (k && k.nextReview) || ""; return !!nr && nr < "2026-07-11"; } },
  { id: "S25", cat: "Relation", label: "Révisions multiples (R3+ — re-remédiations)", pts: 8, test: (c, k) => !!(k && k.revision >= 3) },
  { id: "S26", cat: "Relation", label: "Dossier incomplet en phase avancée (< 50% en comité/approbation)", pts: 10, test: (c, k) => !!(k && k.totalPct < 50 && (k.wfPhase === "COMITE" || k.wfPhase === "APPROBATION")) },
  { id: "S27", cat: "Relation", label: "Refus antérieur (dossier rejeté)", pts: 15, test: (c, k) => !!(k && k.status === "REJECTED") },
  { id: "S28", cat: "Fiscalité", label: "Indice US person (FATCA)", pts: 8, test: (c, k) => { const tags = (c && c.tags) || (k && k.tags) || []; return tags.indexOf("FATCA") >= 0; } },
  { id: "S29", cat: "Fiscalité", label: "Formulaire CDB inadapté à la structure (K/T/S attendu)", pts: 12, test: (c, k) => { const t = (c && c.type) || (k && k.structCode) || ""; const f = (c && c.cdbForm) || (k && k.cdbForm) || ""; return ["TRUST", "FOND", "DOM", "HOLD"].indexOf(t) >= 0 && f === "A"; } },
  { id: "S30", cat: "Fiscalité", label: "Trust discrétionnaire (form. T — bénéficiaires à clarifier)", pts: 10, test: (c, k) => ((c && c.cdbForm) || (k && k.cdbForm)) === "T" },
  { id: "S31", cat: "Transactionnel", label: "Transaction SWIFT à haut risque détectée (Analyzer)", pts: 15, test: (c, k) => { const n = (c && c.name) || (k && k.clientName) || ""; return TX_DATA.some((t) => t.client === n && t.risk === "HIGH"); } },
  { id: "S32", cat: "Transactionnel", label: "Corridor offshore actif (Panama / Cayman / Dubaï)", pts: 12, test: (c, k) => { const n = (c && c.name) || (k && k.clientName) || ""; const hubs = ["Panama", "Cayman", "Dubaï"]; return TX_DATA.some((t) => t.client === n && (hubs.indexOf(t.from) >= 0 || hubs.indexOf(t.to) >= 0)); } },
  { id: "S33", cat: "Transactionnel", label: "Volume transactionnel cumulé élevé sur 30 jours", pts: 8, test: (c, k) => { const n = (c && c.name) || (k && k.clientName) || ""; const sum = TX_DATA.filter((t) => t.client === n).reduce((a, t) => a + t.amt, 0); return sum > AML_PARAMS.TX_VOLUME_30D_M.value; } },
  { id: "S34", cat: "Transactionnel", label: "Alerte AML ouverte non qualifiée", pts: 10, test: (c, k) => { const cid = (c && c.id) || (k && k.clientId) || ""; return AML_ALERTS.some((a) => a.clientId === cid && a.status === "NEW"); } },
  { id: "S35", cat: "Transactionnel", label: "Cumul d'alertes (typologies multiples sur le même client)", pts: 15, test: (c, k) => { const cid = (c && c.id) || (k && k.clientId) || ""; return AML_ALERTS.filter((a) => a.clientId === cid).length >= AML_PARAMS.ALERT_CUMUL_MIN.value; } },
  { id: "S36", cat: "Transactionnel", label: "Activité transactionnelle sans KYC approuvé", pts: 12, test: (c, k) => { const n = (c && c.name) || (k && k.clientName) || ""; const hasTx = TX_DATA.some((t) => t.client === n); const st = (k && k.status) || (c && c.currentKycStatus) || ""; return hasTx && st !== "APPROVED"; } },
];

const AML_RULE_GATES: Record<string, boolean> = {}; // ruleId -> true si gate « risque ≥ MEDIUM »

export function evalAmlRules(client: any, kyc: any) {
  const risk = (client && client.risk) || (kyc && kyc.risk) || "";
  const rules = AML_SCORING_RULES.filter((r) => r.on !== false).map((r) => {
    let hit = false;
    try { hit = !!r.test(client, kyc); } catch { /* données globales absentes → règle inerte */ }
    if (hit && AML_RULE_GATES[r.id] && risk === "LOW") hit = false;
    return { id: r.id, label: r.label, pts: r.pts, hit, gated: !!AML_RULE_GATES[r.id] };
  });
  const score = Math.min(100, rules.reduce((a, r) => a + (r.hit ? r.pts : 0), 0));
  return { score, rules };
}
