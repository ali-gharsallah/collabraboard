// Moteur d'évaluation AML gap — src/aml/engine.ts (blocs 50–60, R340–R398).
// INVARIANT R44 : le moteur n'exécute rien et ne décide rien. Il MESURE des faits contre les
// paramètres tenant (registre R-Q) et retourne un résultat EXPLICABLE ; l'appelant en fait un
// événement (aml.gap.signal) qu'un humain qualifie (TP/FP). Aucune contamination de statut client.
//
// Bloc 61 (Analytique 2G, R399–R403) : REFUSÉ ici (meta.deferred). Les détecteurs statistiques
// (z-score, rupture, dormance) s'exécutent dans le service CPSI Python — jamais réécrits en Nest
// (décision 4 du journal 2026-08-04). Les suites bloc61 restent rouges tant que le pont CPSI
// (Postgres/Redis/CPSI) n'est pas livré : c'est voulu, pas un oubli.

import { AML_GAP_META } from "./aml-gap.meta.gen";
import { DETECTORS } from "./detectors";

export interface Facts {
  clientId: string;
  asOf: string;
  tenantId: string;
  [k: string]: unknown;
}

export interface ScenarioResult {
  scenarioId: string;
  ruleRef: string;
  raised: boolean;
  niveau: number;
  blocking: boolean;
  payload: Record<string, unknown>;
  explanation: string;
}

/** Détecteur statistique délégué au service CPSI Python (Analytique 2G) — non implémenté en Nest. */
export class CpsiDeferredError extends Error {
  constructor(scenarioId: string) {
    super(
      `Scénario ${scenarioId} (Analytique 2G, bloc 61) : détecteur statistique exécuté dans le ` +
      `service CPSI Python — jamais réécrit en Nest (décision 4). Pont CPSI requis.`,
    );
    this.name = "CpsiDeferredError";
  }
}

/**
 * Évalue un scénario AML gap contre des faits. `params` surcharge les défauts du registre R-Q
 * (valeurs tenant effectives à la date, résolues en amont). Retourne un ScenarioResult — n'émet
 * aucun événement, ne mute rien (R44).
 */
export async function evaluateScenario(
  scenarioId: string,
  facts: Facts,
  params?: Record<string, unknown>,
): Promise<ScenarioResult> {
  const meta = AML_GAP_META[scenarioId];
  if (!meta) throw new Error(`Scénario AML gap inconnu : ${scenarioId}`);
  if (meta.deferred) throw new CpsiDeferredError(scenarioId);

  const detector = DETECTORS[scenarioId];
  if (!detector) throw new Error(`Détecteur non implémenté pour ${scenarioId} (bloc ${meta.bloc}).`);

  // Paramètres effectifs : défauts du registre R-Q, surchargés par les valeurs tenant fournies.
  const effective: Record<string, unknown> = { ...meta.params, ...(params ?? {}) };
  const { raised, payload, explanation } = detector.evaluate(facts, effective);

  return {
    scenarioId,
    ruleRef: meta.ruleRef,
    raised,
    niveau: meta.niveau,
    blocking: raised && meta.blocking, // un signal non levé ne bloque rien
    payload: { signal: meta.signal, clientId: facts.clientId, asOf: facts.asOf, ...payload },
    explanation: raised ? explanation : "",
  };
}
