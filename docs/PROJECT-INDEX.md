# PROJECT-INDEX — O-Live (index maître de la documentation)

**Mis à jour le 2026-07-22.** Point d'entrée unique. En cas de divergence entre deux documents,
**cet index désigne la source de vérité**. Un seul certificat, un seul cahier, zéro doublon.

## Source de vérité (à lire en premier)

| Document | Objet | Date |
|---|---|---|
| **`docs/CERTIFICAT-ETAT.md`** | **Certificat d'état unique** : écrans réels, routes, tests, taux de réussite, rejeu à date, régressions | 2026-07-22 |
| `docs/ETAT-REEL-VERIFIE.md` | Diagnostic prouvé par commandes (volume, modules, capacités) + addendum Vague 1 | 2026-07-22 |
| `docs/DECALAGE-FRONT-BACK.md` | Cartographie frontend ↔ backend + addendum Vague 1 (6 écrans) | 2026-07-22 |

## Recette & tests

| Document | Objet |
|---|---|
| `docs/tests/PLAN-DE-TEST.md` | Plan de test stratégique (niveaux, critères, rôles, environnements) |
| `docs/tests/CAHIER-DE-TESTS.md` | **Cahier global évolutif** (section par vague) — par écran / route / résultat |
| `docs/tests/FAT/FAT-VAGUE1.md` | 10 FAT métier (personas) + statuts |
| `docs/tests/COUVERTURE-REGLES.md` | Matrice traçabilité exigences → FAT + tests (12/12) |
| `docs/tests/PREUVES/` | Sorties brutes horodatées (`fat-vague1-run.txt`, `e2e-complet.txt`) |
| `docs/RUNBOOK-OPS.md` | Chaîne de vérification + notes par lot |

*(L'ancien `docs/tests/RAPPORT-RECETTE.md` a été **fusionné** dans `docs/CERTIFICAT-ETAT.md` et supprimé — une seule source.)*

## Spécifications & catalogues

| Document | Objet |
|---|---|
| `docs/CATALOGUE-REGLES-R1-R206.md` | Catalogue (⚠ le **code** va jusqu'à **R221** — cf. en-tête) |
| `spec/` | Amendements ratifiés par règle, errata, scénarios (`.feature`) dont `spec/vague1-scenarios/` |

## Architecture & plan

| Document | Objet |
|---|---|
| `ARCHITECTURE.md` · `ARCHITECTURE-ENTERPRISE.md` | Architecture (cible enterprise, corrigée) |
| `PLAN-EXECUTION.md` | Plan d'exécution & priorisation |

## Chiffres de référence (2026-07-22, prouvés)

- **Règles moteur** : 425/425 (50 suites).
- **e2e (Postgres réel)** : 16/16 (kyc-rules 6 + FAT Vague 1 10).
- **FAT recette Vague 1** : 10/10 PASS (100 %). Bandeau démo front : 9/9.
- **Écrans réels** : 6 (Clients, KYC, Règles AML, File d'alertes, Rejeu KYC à date, Finance Islamique).
- **Rejeu à date** : paramètres (R127) **ET** dossier KYC (`/kyc/:code/a-date`) — **OUI**.
- **Périmètre règles** : R1 → R221 · **75 routes backend**.
