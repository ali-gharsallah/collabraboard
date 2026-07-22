# Cahier de tests — comment rejouer la recette Vague 1

**2026-07-22.** Procédure reproductible pour ré-exécuter l'ensemble et régénérer les preuves.

## Prérequis

- Postgres 16 local sur :5433, base `olive_test`, rôles `olive` (owner) + `olive_app` (RLS).
- Secrets au boot : `AUDIT_HMAC_SECRET`, `MFA_ENC_KEY` (fail-fast volontaire).
- Dépendances installées (`pnpm install`).

## Étapes

```bash
cd apps/api

# 1. Base propre + RLS FORCE + triggers d'immuabilité
npx prisma migrate reset --force --skip-seed --skip-generate
pnpm run prisma:post

# 2. Tests de règles (unitaire) — attendu 425/425
pnpm run test:rules

# 3. e2e intégration + FAT (backend réel) — attendu 14/14
pnpm run test:e2e                      # tout
pnpm run test:e2e -- fat-vague1        # les 8 FAT seuls

# 4. Recette RLS (isolation) — 0 ligne sans GUC
psql "postgresql://olive_app:olive_app@localhost:5433/olive_test" -tAc "SELECT count(*) FROM clients;"   # → 0
```

## Cas de test FAT (résumé)

| ID | Fichier | Ligne d'exécution |
|---|---|---|
| FAT-CLIENT-01 · FAT-KYC-01/02 · FAT-AML-01/02 · FAT-ALERTE-01/02 · FAT-REJEU-01 | `apps/api/test/e2e/fat-vague1.e2e-spec.ts` | `pnpm --filter api test:e2e -- fat-vague1` |

Détail métier de chaque cas : `docs/tests/FAT/FAT-VAGUE1.md`.
Preuve d'exécution horodatée : `docs/tests/PREUVES/fat-vague1-run.txt`.

## Note technique (erratum E4)

La suite `kyc-rules.e2e-spec.ts` contenait une sous-requête SQL **tenant-aveugle**
(`WHERE code = …`). Le `code` KYC n'étant unique **que par tenant**, l'ajout de la suite FAT
(qui crée aussi des dossiers) provoquait `21000 (more than one row)`. Corrigé en scopant la
sous-requête au tenant (`AND tenant_id = …`). Correction stricte, sans impact fonctionnel —
les deux suites passent désormais ensemble (14/14).
