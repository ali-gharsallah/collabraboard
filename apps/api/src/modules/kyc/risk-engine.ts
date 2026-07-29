// Scoring déterministe et TRAÇABLE : chaque décision produit sa trace (exigence
// d'auditabilité : pouvoir rejouer un score des années plus tard).
//
// ═══ R288 (ratifié 2026-07-28) : le barème est une RÈGLE — gouverné par le registre R-Q
// (`kycScoringBareme`, versionné par date d'effet, pattern workloadBareme), jamais par le code.
// La fonction reste PURE : le barème s'INJECTE ; sans argument, le barème par défaut (les
// valeurs historiques du moteur — aucun changement de comportement). Un dossier garde à vie
// le score de SON barème (R29 — score + trace stockés à la création) ; la trace mentionne la
// date d'effet du barème appliqué (BS-07). INTERDITS : second moteur ; recopie du barème sur
// les dossiers (résolution PAR DATES) ; mutation hors registre.
const HIGH_RISK_CC = new Set(["IR","KP","MM","SY","YE","HT","ML","RU","BY","PA","KY","BS","AE","TR"]);
const STRUCTURE_PTS: Record<string, number> = {
  PP: 0, SA: 10, SARL: 10, HOLDING: 20, DOMICILE: 30, TRUST: 35, FOUNDATION: 25, FUND: 15 };
const ACCOUNT_PTS: Record<string, number> = {
  CURRENT: 0, ADVISORY: 5, DISCRETIONARY: 5, LOMBARD: 15 };

export type Bareme = { depuisLe?: string;
  structurePts: Record<string, number>; accountPts: Record<string, number>;
  paysRisque: string[]; paysRisquePts: number; seuilEdd: number; seuilCdd: number };

export const BAREME_DEFAUT: Bareme = {
  structurePts: STRUCTURE_PTS, accountPts: ACCOUNT_PTS,
  paysRisque: [...HIGH_RISK_CC], paysRisquePts: 40, seuilEdd: 50, seuilCdd: 25 };

/** R288/R127 : le barème EN VIGUEUR à une date — la version la plus récente dont depuisLe ≤ date,
 *  sinon le défaut moteur. Résolution PAR DATES, aucun champ recopié sur les dossiers. */
export function baremeEnVigueur(versions: Partial<Bareme>[] | null | undefined, at: Date): Bareme {
  const applicables = (versions ?? [])
    .filter((v) => v?.depuisLe && new Date(v.depuisLe).getTime() <= at.getTime())
    .sort((a, b) => new Date(a.depuisLe!).getTime() - new Date(b.depuisLe!).getTime());
  const v = applicables[applicables.length - 1];
  return v ? { ...BAREME_DEFAUT, ...v } : BAREME_DEFAUT;
}

export interface RiskTraceLine { rule: string; points: number; detail: string; }
export function computeRisk(input: { structure: string; accountType: string; countryCode: string },
  bareme: Bareme = BAREME_DEFAUT) {
  const trace: RiskTraceLine[] = [];
  const add = (rule: string, points: number, detail: string) => { trace.push({ rule, points, detail }); };
  add("STRUCTURE", bareme.structurePts[input.structure] ?? 15, input.structure);
  add("ACCOUNT_TYPE", bareme.accountPts[input.accountType] ?? 5, input.accountType);
  add("COUNTRY", bareme.paysRisque.includes(input.countryCode) ? bareme.paysRisquePts : 0, input.countryCode);
  // BS-07 : la trace MENTIONNE le barème appliqué — seul un barème GOUVERNÉ se signale
  // (le défaut moteur n'ajoute rien : les corpus historiques restent identiques).
  if (bareme.depuisLe) add("BAREME", 0, `barème gouverné du ${bareme.depuisLe} (R288)`);
  const score = trace.reduce((a, l) => a + l.points, 0);
  const level = score >= bareme.seuilEdd ? "HIGH" : score >= bareme.seuilCdd ? "MEDIUM" : "LOW";
  const workflow = level === "HIGH" ? "EDD" : level === "MEDIUM" ? "CDD" : "SDD";
  return { score, level, workflow, trace };
}
