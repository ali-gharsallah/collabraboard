# Rollback runbook — ROBUSTESSE (Bloc 0, R335/RB)

Ordre de sévérité **assumé** : **flag → revert code → migration → restore données**. On
n'escalade au niveau suivant que si le précédent ne suffit pas.

## Point de retour ultime
- Tag Git **`baseline-pre-robustness`** (état stable, 336 e2e verts) — point de retour du chantier.
- Tag **`robustness-bloc-X-done`** après chaque bloc mergé → `git revert` du merge = rollback propre.

## Adaptation au stack réel (NestJS/Prisma)
La spec suppose Alembic (`downgrade`, roundtrip). Le dépôt est **Prisma** (migrations forward).
La discipline migration est assurée par le **cadre expand/contract déjà livré (R334/MG)** :
aucune migration destructive en phase N, contract reporté, backfill idempotent, répétition hebdo
restore→migrate→FAT. Le « downgrade » est donc remplacé par : **expand-only garanti** (rien à
défaire de destructif) + **restauration de backup** si corruption de données.

## Procédure par niveau

### 1. Flag (réflexe immédiat — minutes, sans redéploiement)
Passer le flag du bloc à `off` (`FF_OPTIMISTIC_LOCKING` / `FF_IDEMPOTENCY` /
`FF_READ_FROM_PROJECTIONS` / `FF_RLS_ENFORCED`) + redémarrer → comportement legacy.
Voir `docs/feature-flags.md`.

### 2. Revert code (si bug structurel, le flag ne suffit pas)
`git revert <merge-commit-du-bloc>` + redéploiement. Traçable, jamais de `reset --force` sur la
branche par défaut.

### 3. Migration (si le schéma est en cause)
Les migrations sont **expand-only** (R334) : une phase N n'ajoute que, donc il n'y a rien de
destructif à défaire — le revert du code suffit généralement. Une colonne/table ajoutée et
inutilisée est inerte (nettoyage = bloc de contract ultérieur, jamais dans l'urgence).

### 4. Restore données (dernier recours, si corruption)
`infra/scripts/restore-test.sh` (WAL-G) restaure le dernier backup chronométré. Un backup est
pris AVANT toute migration sur base à données (hook déploiement). RTO mesuré = critère (guide C.1,
phase 2 : répétition de restauration bloquante).

## Post-mortem obligatoire
Après tout rollback : ajouter un **test de régression** reproduisant le bug AVANT toute nouvelle
tentative (le bug ne revient jamais silencieusement).
