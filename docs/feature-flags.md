# Feature flags — ROBUSTESSE (Bloc 0, R335/RB)

Module : `apps/api/src/common/feature-flags.ts` — lus de l'environnement, **défaut = comportement
LEGACY (OFF)**. L'activation d'un bloc est un **acte explicite**, jamais implicite. Chaque flag
est **temporaire** : retiré une fois son bloc stabilisé.

| Flag | Bloc | OFF (défaut, legacy) | ON (nouveau comportement) | `# REMOVE-AFTER` |
|------|------|----------------------|---------------------------|------------------|
| `FF_OPTIMISTIC_LOCKING` | A (R336) | append sans vérif de version ; **shadow mode** : warning si un conflit aurait eu lieu | append refuse `expected_version` périmé → `ConcurrencyConflictError` → HTTP 409 | Bloc A stabilisé |
| `FF_IDEMPOTENCY` | B (R337) | en-tête `Idempotency-Key` ignoré (loggé) | rejeu d'un `command_id` → réponse snapshotée, zéro nouvel événement | Bloc B stabilisé |
| `FF_READ_FROM_PROJECTIONS` | C (R338) | lectures par l'ancien chemin ; projections en **double-write** pour comparer | lectures servies par les projections | Bloc C stabilisé |
| `FF_RLS_ENFORCED` | D (déjà livré) | le **middleware HTTP** n'exige pas le tenant | tenant non résolu → HTTP 400 avant tout accès DB | à statuer (RLS SQL déjà FORCE) |

**Important** — `FF_RLS_ENFORCED` ne pilote QUE le comportement HTTP applicatif. Les **policies
RLS SQL** (`FORCE ROW LEVEL SECURITY`) sont déjà actives en base (post-deploy) et pilotées par
migration, **jamais** par ce flag : couper le flag ne désarme pas l'isolation en base.

## Activation (par bloc, après stabilisation)
1. Passer le flag à `on` (env : `FF_X=on` — accepte aussi `1`/`true`, insensible à la casse).
2. Redémarrer le service (flags lus au boot ; pas de rechargement à chaud en v1).
3. Observer (les blocs A/C offrent un shadow/double-write pour comparer AVANT bascule).

## Retour arrière
Repasser le flag à `off` (ou le retirer de l'env) + redémarrer → comportement legacy immédiat,
**aucun redéploiement de code**. C'est le 1er réflexe du runbook (`docs/rollback-runbook.md`).

## Test
`feature-flags.spec.ts` (RB-01..05) est dans le harnais `pnpm test:rules` : défaut OFF, activation
explicite on/1/true, registre complet, snapshot, lecture `process.env`. Chaque bloc testera en
plus ses **deux modes** (on ET off) tant que son flag existe.
