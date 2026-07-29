// Feature flags — ROBUSTESSE (Bloc 0, R335/RB). Lus de l'environnement, DÉFAUT = comportement
// LEGACY (OFF). Chaque flag est TEMPORAIRE et retiré une fois son bloc stabilisé
// (# REMOVE-AFTER: bloc X). Voir docs/feature-flags.md pour la procédure d'activation/retour.
//
//   FF_OPTIMISTIC_LOCKING (Bloc A) — OFF : append sans vérif de version (legacy), warning si un
//                                    conflit aurait eu lieu (shadow mode d'observation).
//   FF_IDEMPOTENCY        (Bloc B) — OFF : l'en-tête Idempotency-Key est ignoré (loggé seulement).
//   FF_READ_FROM_PROJECTIONS (Bloc C) — OFF : lectures par l'ancien chemin ; projections en
//                                    double-write pour comparer avant bascule.
//   FF_RLS_ENFORCED       (Bloc D) — OFF : le MIDDLEWARE HTTP n'exige pas le tenant (400). Les
//                                    policies SQL, elles, sont pilotées par migration, pas par ce flag.

export const FLAGS_ROBUSTESSE = [
  "FF_OPTIMISTIC_LOCKING",
  "FF_IDEMPOTENCY",
  "FF_READ_FROM_PROJECTIONS",
  "FF_RLS_ENFORCED",
] as const;

export type FlagRobustesse = (typeof FLAGS_ROBUSTESSE)[number];

type Env = Record<string, string | undefined>;

// ON seulement pour on/1/true (insensible à la casse). Tout le reste (absent, off, valeur
// inconnue) = OFF : le défaut sûr est TOUJOURS le comportement legacy.
export function flagActif(flag: FlagRobustesse, env: Env = process.env): boolean {
  const v = (env[flag] ?? "").trim().toLowerCase();
  return v === "on" || v === "1" || v === "true";
}

export function snapshotFlags(env: Env = process.env): Record<FlagRobustesse, boolean> {
  return Object.fromEntries(FLAGS_ROBUSTESSE.map((f) => [f, flagActif(f, env)])) as Record<FlagRobustesse, boolean>;
}
