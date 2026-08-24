import type { Facts } from "./contract";
import gt from "../../data/aml-gap-dataset-gt.json";
import { DETECTORS } from "../../src/aml/detectors";

// Fixtures GT — faits synthétiques DÉTERMINISTES par cas (pattern du dataset screening). Les faits
// déclencheurs viennent du détecteur du scénario (src/aml/detectors.ts) : une seule source, moteur
// et fixtures ne peuvent pas diverger. TP ET FP produisent des faits qui DÉCLENCHENT — le FP est une
// alerte légitime écartée en investigation, pas une non-alerte (sémantique du corpus GT).
//
// Bloc 61 (Analytique 2G, AN-*) n'a pas de détecteur Nest (déféré au service CPSI Python) : la
// fixture échoue explicitement → suites bloc61 rouges par construction (décision 4, invariant tenu).

export function gtFixture(caseId: string): Facts {
  const c = (gt as any).cases.find((x: any) => x.caseId === caseId);
  if (!c) throw new Error("Cas GT inconnu : " + caseId);
  const detector = DETECTORS[c.scenarioId];
  if (!detector) {
    throw new Error(
      `Fixture ${caseId} (${c.scenarioId}) : détecteur Analytique 2G exécuté dans le service CPSI ` +
      `Python — non implémenté en Nest (décision 4). Suite bloc 61 rouge tant que le pont CPSI manque.`,
    );
  }
  return {
    clientId: c.clientId,
    asOf: "2026-08-04",
    tenantId: "gwb",
    ...detector.trigger(),
  };
}

export const gtCases: any[] = (gt as any).cases;
