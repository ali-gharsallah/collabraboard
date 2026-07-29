# Plan de migration — <slug> (phase N, expand-only)

> Gabarit OBLIGATOIRE (R334/MG-02). Un plan sans les trois sections ci-dessous est refusé par
> le harnais. La migration de phase N n'AJOUTE que ; la suppression (contract) est planifiée en
> N+1, après qu'aucun code ne lit plus l'ancien schéma. Aucun UPDATE sur une table append-only.

## Objet
<ce que la migration ajoute (colonne/table/index), et pourquoi — un lecteur doit comprendre sans le code>

## Pré-vérification
<!-- Requêtes à exécuter AVANT (comptages, invariants) — copiez le résultat attendu. -->
```sql
-- ex. SELECT count(*) FROM clients;                       -- attendu : N (noter)
-- ex. SELECT count(*) FROM clients WHERE nouveau_champ IS NOT NULL;  -- attendu : 0 (colonne absente)
```

## Backfill (si nécessaire — idempotent, à filigrane)
<!-- Rejouable sans doublon ; reprend au filigrane. Voir tools/migrations/lib.mjs::backfillIdempotent. -->
```sql
-- ex. UPDATE clients SET nouveau_champ = <calcul> WHERE id > :filigrane AND id <= :borne;
-- (JAMAIS sur une table append-only.)
```

## Post-vérification
<!-- Requêtes APRÈS prouvant l'invariant tenu (le backfill a couvert tout, rien de cassé). -->
```sql
-- ex. SELECT count(*) FROM clients;                        -- attendu : N (inchangé)
-- ex. SELECT count(*) FROM clients WHERE nouveau_champ IS NULL;      -- attendu : 0 (backfill complet)
```

## Contract différé (N+1)
<!-- Ce qui sera SUPPRIMÉ/rétréci en N+1, et la condition (plus aucun lecteur de l'ancien). -->
- ex. `DROP COLUMN ancien_champ` — après déploiement du code ne lisant plus `ancien_champ`.

## Rollback
<!-- Comment revenir si la post-vérification échoue (expand-only ⇒ rollback = ne rien contracter). -->
