# CANON — ROBUSTESSE O-Live (adaptation étape 0, PROPOSÉ — en attente de ratification)

Spec source : « Évolution Robustesse O-Live & OctoPulse » (collée 2026-07-29). Écrite pour une
O-Live **Python/FastAPI/SQLAlchemy/Alembic/Pydantic event-sourcée (64 tests)**. Le dépôt réel
est **NestJS 10 (TypeScript) + Prisma 5.22 + PostgreSQL (336 e2e)**. Décision PO : **adapter
l'INTENT de chaque bloc au stack réel** (jamais forcer la spec contre le code — règle #6 de la
spec ; gel R1-R51 workflow-engine-py et cpsi-server-py INTOUCHABLES).

## Écart maître (consigné)

| Hypothèse spec | Réalité repo | Adaptation |
|----------------|--------------|-----------|
| FastAPI, dépendances | NestJS (contrôleurs/guards/services) | idem via Nest |
| SQLAlchemy + Alembic (`downgrade`, roundtrip) | Prisma (migrations forward) | cadre expand/contract **déjà livré** (R334) tient lieu de discipline migration ; roundtrip adapté (voir Bloc 0) |
| Pydantic events + upcasters | `payload Json` + DTO zod | upcasters en TS, désérialisation centralisée |
| Event store à `version`/`UNIQUE(aggregate_id,version)` | `domain_events` append-only (trigger) + hash-chain `record_hash/prev_hash`, **sans version d'agrégat** | ajouter le verrou optimiste **à côté** du hash-chain, sans réécrire l'existant |
| 64 tests | 336 e2e + harnais règles + Python | les 336 e2e = filet de caractérisation existant |

## Mapping bloc → canon (PROPOSÉ, +étape 0 : aucune collision, R334 = dernier pris)

| Bloc spec | Objet | État réel | Canon proposé · famille |
|-----------|-------|-----------|--------------------------|
| **0** | Baseline + rollback + feature flags | backups/CI/e2e existants ; **pas de module flags** | **R335 · RB** |
| **A** | Locking optimiste (version + 409) | **ABSENT** (hash-chain ≠ locking) | **R336 · LK** |
| **B** | Idempotence commandes (`Idempotency-Key`) | **ABSENT** | **R337 · IDM** |
| **C** | Projections reconstructibles | **PRÉSENT mais outbox ASYNC** (GoldenRecordProjector) — contredit « sync » | **R338 · PJ** (réconcilier : documenter l'async OU offrir un projecteur sync opt-in) |
| **D** | Multi-tenancy RLS | **DÉJÀ LIVRÉ** (FORCE RLS, olive_app non-owner, SET LOCAL, recette 4b, numérotation KYC par tenant) | **aucun nouveau numéro** — vérifier + `docs/multi-tenancy.md` |
| **E** | Versioning/upcasting événements | **ABSENT** (`event_version` absent) | **R339 · EV** |

## Interdits repris (gel + doctrine)

- Moteur workflow **R1-R51** et **cpsi-server-py** INTOUCHABLES (les Blocs A/C touchent l'event
  store/projections — prouver le non-entame du gel).
- Event store **append-only** : jamais réécrire un événement stocké (upcast = à la LECTURE seule).
- Migration **expand-only** en phase N (déjà verrouillé R334/MG-01) ; contract reporté.
- TDD strict ; suite complète verte à chaque frontière ; réversibilité (flags → revert → migration).

## Branche

La spec veut `robustness/bloc-*`. Contrainte de session : branche désignée
`claude/olive-mvp-bootstrap-m02v1x`. **Proposé** : une PR par bloc sur la branche désignée +
un tag `robustness-bloc-X-done` (traçabilité/rollback équivalents), sauf autre consigne.
