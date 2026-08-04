import type { Facts } from "./contract";
import gt from "../../data/aml-gap-dataset-gt.json";
// Chaque cas GT doit avoir sa fixture de faits synthétiques déterministes (pattern du dataset screening).
// ROUGE par construction : implémenter cas par cas pendant le développement du bloc.
export function gtFixture(caseId: string): Facts {
  const c = (gt as any).cases.find((x: any) => x.caseId === caseId);
  if (!c) throw new Error("Cas GT inconnu : " + caseId);
  throw new Error("Fixture non implémentée pour " + caseId + " — " + c.narrative.slice(0, 80));
}
export const gtCases: any[] = (gt as any).cases;
