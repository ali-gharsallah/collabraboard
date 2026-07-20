// Scoring déterministe et TRAÇABLE : chaque décision produit sa trace (exigence
// d'auditabilité : pouvoir rejouer un score des années plus tard).
const HIGH_RISK_CC = new Set(["IR","KP","MM","SY","YE","HT","ML","RU","BY","PA","KY","BS","AE","TR"]);
const STRUCTURE_PTS: Record<string, number> = {
  PP: 0, SA: 10, SARL: 10, HOLDING: 20, DOMICILE: 30, TRUST: 35, FOUNDATION: 25, FUND: 15 };
const ACCOUNT_PTS: Record<string, number> = {
  CURRENT: 0, ADVISORY: 5, DISCRETIONARY: 5, LOMBARD: 15 };

export interface RiskTraceLine { rule: string; points: number; detail: string; }
export function computeRisk(input: { structure: string; accountType: string; countryCode: string }) {
  const trace: RiskTraceLine[] = [];
  const add = (rule: string, points: number, detail: string) => { trace.push({ rule, points, detail }); };
  add("STRUCTURE", STRUCTURE_PTS[input.structure] ?? 15, input.structure);
  add("ACCOUNT_TYPE", ACCOUNT_PTS[input.accountType] ?? 5, input.accountType);
  add("COUNTRY", HIGH_RISK_CC.has(input.countryCode) ? 40 : 0, input.countryCode);
  const score = trace.reduce((a, l) => a + l.points, 0);
  const level = score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";
  const workflow = level === "HIGH" ? "EDD" : level === "MEDIUM" ? "CDD" : "SDD";
  return { score, level, workflow, trace };
}
