# PROJECT-INDEX — O-Live (index maître de la documentation)

**Mis à jour le 2026-07-22.** Point d'entrée unique vers les documents de référence. En cas de
divergence entre deux documents, **cet index désigne la source de vérité**.

## État & vérité terrain

| Document | Objet | Date |
|---|---|---|
| `docs/ETAT-REEL-VERIFIE.md` | État réel du code prouvé par commandes (volume, modules, tests, capacités) | 2026-07-22 |
| `docs/DECALAGE-FRONT-BACK.md` | Cartographie prouvée frontend ↔ backend (5 écrans / 75 routes) | 2026-07-22 |
| `docs/RUNBOOK-OPS.md` | Chaîne de vérification, comptes de tests, notes par lot | courant |

## Recette & tests (Vague 1)

| Document | Objet | Date |
|---|---|---|
| `docs/tests/PLAN-DE-TEST.md` | Plan de test stratégique (niveaux, critères, rôles, environnements) | 2026-07-22 |
| `docs/tests/FAT/FAT-VAGUE1.md` | 8 tests d'acceptation fonctionnelle métier (personas) + statuts | 2026-07-22 |
| `docs/tests/CAHIER-DE-TESTS.md` | Procédure reproductible pour rejouer la recette | 2026-07-22 |
| `docs/tests/COUVERTURE-REGLES.md` | Matrice de traçabilité exigences → FAT + tests techniques (10/10) | 2026-07-22 |
| `docs/tests/PREUVES/fat-vague1-run.txt` | Sortie brute horodatée de l'exécution des FAT (8/8 PASS) | 2026-07-22 |
| `docs/tests/RAPPORT-RECETTE.md` | Rapport de recette signable (100 % FAT, 0 régression) | 2026-07-22 |

## Spécifications & catalogues

| Document | Objet |
|---|---|
| `docs/CATALOGUE-REGLES-R1-R206.md` | Catalogue des règles (⚠ le **code** va jusqu'à **R221** — cf. en-tête du fichier) |
| `spec/` | Amendements ratifiés par règle (R89→R188), errata, scénarios AML/Islamic (`.feature`) |

## Architecture & plan

| Document | Objet |
|---|---|
| `ARCHITECTURE.md` · `ARCHITECTURE-ENTERPRISE.md` | Architecture (cible enterprise corrigée au 22.07) |
| `PLAN-EXECUTION.md` | Plan d'exécution & priorisation (AML/Islamic désormais en code) |

## Chiffres de référence (2026-07-22, prouvés)

- **Règles moteur** : 425/425 (50 suites) — `apps/api` `pnpm run test:rules`.
- **e2e (Postgres réel)** : 14/14 (`kyc-rules` 6 + `fat-vague1` 8) — `pnpm run test:e2e`.
- **FAT recette Vague 1** : 8/8 PASS (100 %).
- **Périmètre règles** : R1 → R221.
