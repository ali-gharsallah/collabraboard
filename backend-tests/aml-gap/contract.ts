// Contrat du moteur d'évaluation AML gap — À IMPLÉMENTER (les tests sont ROUGES par construction)
// Invariants : le moteur n'exécute rien (R44) — il retourne un résultat que l'appelant transforme en événement appendEvent.
export interface Facts { clientId: string; asOf: string; tenantId: string; [k: string]: unknown }
export interface ScenarioResult {
  scenarioId: string; ruleRef: string; raised: boolean; niveau: number; blocking: boolean;
  payload: Record<string, unknown>;            // faits déclencheurs explicables (R44)
  explanation: string;                          // toujours renseigné si raised
}
// Point d'entrée unique — src/aml/engine.ts à créer :
export declare function evaluateScenario(scenarioId: string, facts: Facts, params?: Record<string, unknown>): Promise<ScenarioResult>;
