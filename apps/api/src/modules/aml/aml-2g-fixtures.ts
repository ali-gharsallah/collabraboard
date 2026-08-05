/**
 * Fixtures d'observation Analytique 2G (bloc 61, R399–R403) — matière de BACKTEST du corpus GT.
 *
 * Le corpus GT porte le narratif d'un cas 2G mais PAS l'observation statistique (distribution de
 * pairs, séries baseline/récente, dimensions…) que le détecteur CPSI mesure. Ces fixtures
 * fournissent une observation DÉTERMINISTE et DÉCLENCHANTE par scénario AN — l'analogue, côté 2G,
 * du `detector.trigger()` des blocs 50–60. Elles servent UNIQUEMENT le backtest (mesure de rappel) :
 * la détection réelle passe par `POST /v1/aml/signals/evaluate-2g` avec l'observation du client.
 *
 * Les détecteurs vivent dans le service CPSI Python (jamais réécrits en Nest — décision 4) ; ici on
 * ne fait que produire l'ENTRÉE passée au pont. Les seuils tenant (R-Q) numériques sont résolus par
 * la porte ; les paramètres `list`/`tenant` (chaînes) retombent sur le défaut du détecteur.
 */
export const OBSERVATIONS_2G: Record<string, () => Record<string, unknown>> = {
  // AN-01 PEER_DEVIATION — un client à ~20σ (médiane/MAD) de son groupe de pairs.
  "AN-01": () => ({ value: 40, group_values: [10, 11, 9, 10, 12, 8, 11, 10, 9, 11] }),
  // AN-02 BEHAVIOR_SHIFT — volumétrie récente ×3 de la baseline 12 mois (≥ sensibilité défaut ×2).
  "AN-02": () => ({ baseline_series: Array.from({ length: 12 }, () => 100), recent_series: [300, 320, 310] }),
  // AN-03 FIRST_TIME — première occurrence « HRJ » (dimension sensible) au-dessus de la matérialité.
  "AN-03": () => ({ dimension: "HRJ", amount: 80000, seen_dimensions: ["domestique"] }),
  // AN-04 SEGMENT_REACTIVATION — segment cash dormant 36 mois (≥ dormance 24) puis réactivé.
  "AN-04": () => ({ months_since_last_segment_activity: 36, has_current_activity: true }),
  // AN-05 INCOME_MISMATCH — « salaire » entrant 45k vs 12k déclaré au KYC (écart 275 % > 50 %).
  "AN-05": () => ({ observed_income: 45000, declared_income: 12000 }),
};
