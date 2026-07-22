# PROJECT-INDEX — O-Live (index maître de la documentation)

**Mis à jour le 2026-07-22.** Point d'entrée unique. En cas de divergence entre deux documents,
**cet index désigne la source de vérité**. Un seul certificat, un seul cahier, zéro doublon.

## Source de vérité (à lire en premier)

| Document | Objet | Date |
|---|---|---|
| **`docs/CERTIFICAT-ETAT.md`** | **Certificat d'état unique** : écrans réels, routes, tests, taux de réussite, rejeu à date, régressions | 2026-07-22 |
| `docs/ETAT-REEL-VERIFIE.md` | Diagnostic prouvé par commandes (volume, modules, capacités) + addendum Vague 1 | 2026-07-22 |
| `docs/DECALAGE-FRONT-BACK.md` | Cartographie frontend ↔ backend + addendum Vague 1 (6 écrans) | 2026-07-22 |
| `spec/vague2-scenarios/VAGUE2-ECRANS.feature` | Gherkin spec-first Vague 2 (Dossiers · Pièces GED) | 2026-07-22 |
| `spec/vague3-scenarios/VAGUE3-ECRANS.feature` | Gherkin spec-first Vague 3 (Onboarding · Review · Screening · UBO · CoC · Dashboard) | 2026-07-22 |

## Recette & tests

| Document | Objet |
|---|---|
| `docs/tests/PLAN-DE-TEST.md` | Plan de test stratégique (niveaux, critères, rôles, environnements) |
| `docs/tests/CAHIER-DE-TESTS.md` | **Cahier global évolutif** (section par vague) — par écran / route / résultat |
| `docs/tests/FAT/FAT-VAGUE1.md` | 10 FAT métier (personas) + statuts |
| `docs/tests/FAT/FAT-VAGUE2.md` | 4 FAT métier Vague 2 (Dossiers · Pièces GED) + statuts |
| `docs/tests/FAT/FAT-VAGUE3.md` | 7 FAT métier Vague 3 (cycle de bout en bout) + statuts |
| `docs/tests/COUVERTURE-REGLES.md` | Matrice traçabilité exigences → FAT + tests (V1 12/12 · V2 6/6 · V3 11/11) |
| `docs/tests/PREUVES/` | Sorties brutes horodatées (`fat-vague1/2/3-run.txt`, `e2e-complet.txt`) |
| `docs/RUNBOOK-OPS.md` | Chaîne de vérification + notes par lot |

*(L'ancien `docs/tests/RAPPORT-RECETTE.md` a été **fusionné** dans `docs/CERTIFICAT-ETAT.md` et supprimé — une seule source.)*

## Spécifications & catalogues

| Document | Objet |
|---|---|
| `docs/CATALOGUE-REGLES-R1-R206.md` | Catalogue (⚠ le **code** va jusqu'à **R221** — cf. en-tête) |
| `spec/` | Amendements ratifiés par règle, errata, scénarios (`.feature`) dont `spec/vague1-scenarios/` et `spec/vague2-scenarios/` |

## Architecture & plan

| Document | Objet |
|---|---|
| `ARCHITECTURE.md` · `ARCHITECTURE-ENTERPRISE.md` | Architecture (cible enterprise, corrigée) |
| `PLAN-EXECUTION.md` | Plan d'exécution & priorisation |

## Chiffres de référence (2026-07-22, prouvés)

- **Règles moteur** : 425/425 (50 suites).
- **e2e (Postgres réel)** : 27/27 (kyc-rules 6 + FAT Vague 1 10 + FAT Vague 2 4 + FAT Vague 3 7).
- **FAT recette** : Vague 1 10/10 + Vague 2 4/4 + Vague 3 7/7 = **21/21 PASS (100 %)**. Bandeau démo front : 9/9.
- **Écrans réels** : 14 (V1 : Clients, KYC, Règles AML, File d'alertes, Rejeu KYC à date, Finance Islamique · V2 : Dossiers de risque, Pièces GED · V3 : Onboarding, Screening, Account Review, Personnes/UBO, Chgt circonstances, Dashboard).
- **Cycle client de bout en bout** (entrée→KYC→screening→revue→changement) prouvé sur Postgres réel (FAT-CYCLE-01).
- **Rejeu à date** : paramètres (R127) **ET** dossier KYC (`/kyc/:code/a-date`) — **OUI**.
- **Périmètre règles** : R1 → R221 · **29 modules backend**. Écarts signalés : `PersonneLienService` dormant (pas de modèle `Personne`), % détention non ratifié.
