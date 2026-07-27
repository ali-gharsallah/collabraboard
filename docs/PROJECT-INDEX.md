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
| `spec/vague4-scenarios/VAGUE4-ECRANS.feature` | Gherkin spec-first Vague 4 (Transferts · Settlement · Screening avancé · MROS · GED/coffre · Registre LBA) | 2026-07-22 |
| `spec/vague5-scenarios/VAGUE5-ECRANS.feature` | Gherkin spec-first Vague 5 (CRM · Contact Reports · Workflow · Corroboration) | 2026-07-26 |
| `spec/vague6-scenarios/VAGUE6-ECRANS.feature` | Gherkin spec-first Vague 6 (Registre paramétrage · Config & Go-live) | 2026-07-26 |
| `spec/vague7-scenarios/VAGUE7-ECRANS.feature` | Gherkin spec-first Vague 7 (PMS : mandats, adéquation, breaches) | 2026-07-26 |
| `spec/vague8-scenarios/VAGUE8-ECRANS.feature` | Gherkin spec-first Vague 8 (Référentiel AML : scénarios & seuils) | 2026-07-26 |
| `spec/vague9-scenarios/VAGUE9-ECRANS.feature` | Gherkin spec-first Vague 9 (Bac à sable AML : dry-run d'un seuil, R94/B-02) | 2026-07-26 |
| `spec/vague13-scenarios/FORMATIONS-MOD43.feature` | Gherkin RATIFIÉ MOD-43 (FO-01..08) — implémenté Vague 13 | 2026-07-27 |
| `spec/proposed-R222-R238/BUSINESS-TRIP-MOD75.feature` | Gherkin RATIFIÉ MOD-75 (BT-01..10) — à implémenter Vague 14 | 2026-07-27 |
| `docs/ECARTS-FRONT.md` | Confrontation SPEC-FRONT-CÂBLAGE v2 ↔ backend ratifié + décisions actées + amendement A1 | 2026-07-26 |
| `docs/MIGRATION-FRONT.md` | Journal des migrations d'écrans (boy-scout A1/D3) | 2026-07-26 |
| `docs/DECALAGE-FRONT-DEMO.md` | Gap front React ↔ maquette `olive-demo.html` (couverture, ports, liste noire) | 2026-07-26 |

## Recette & tests

| Document | Objet |
|---|---|
| `docs/tests/PLAN-DE-TEST.md` | Plan de test stratégique (niveaux, critères, rôles, environnements) |
| `docs/tests/CAHIER-DE-TESTS.md` | **Cahier global évolutif** (section par vague) — par écran / route / résultat |
| `docs/tests/FAT/FAT-VAGUE1.md` | 10 FAT métier (personas) + statuts |
| `docs/tests/FAT/FAT-VAGUE2.md` | 4 FAT métier Vague 2 (Dossiers · Pièces GED) + statuts |
| `docs/tests/FAT/FAT-VAGUE3.md` | 7 FAT métier Vague 3 (cycle de bout en bout) + statuts |
| `docs/tests/FAT/FAT-VAGUE4.md` | 6 FAT métier Vague 4 (écrans plateforme) + statuts |
| `docs/tests/FAT/FAT-VAGUE5.md` | 4 FAT métier Vague 5 (CRM & Workflow) + statuts |
| `docs/tests/FAT/FAT-VAGUE6.md` | 2 FAT métier Vague 6 (Paramétrage & Gouvernance) + statuts |
| `docs/tests/FAT/FAT-VAGUE7.md` | 2 FAT métier Vague 7 (PMS) + statuts |
| `docs/tests/FAT/FAT-VAGUE8.md` | 2 FAT métier Vague 8 (Référentiel AML) + statuts |
| `docs/tests/FAT/FAT-VAGUE9.md` | 2 FAT métier Vague 9 (Bac à sable AML : dry-run) + statuts |
| `docs/tests/FAT/FAT-VAGUE10.md` | 2 FAT Ports (backend) + 5 tests FE-CORE (Vitest) + écarts front |
| `docs/tests/FAT/FAT-VAGUE12.md` | 3 FAT Workflow Instances (projection KYC) + composant FE-WFI |
| `docs/tests/FAT/FAT-VAGUE13.md` | 8 FAT MOD-43 Formations & Certifications (R231→R238) + FE-FORM |
| `docs/tests/COUVERTURE-REGLES.md` | Matrice traçabilité exigences → FAT + tests (… · V6 3/3 · V7 4/4 · V8 2/2) |
| `docs/tests/PREUVES/` | Sorties brutes horodatées (`fat-vague1..9-run.txt`, `e2e-complet.txt`) |
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
- **e2e (Postgres réel)** : 58/58 (kyc-rules 6 + … + V10 2 + V12 3 + V13 8). Front : 12/12 (Vitest — FE-CORE `api.ts` + composants FE-WFI/10/40 + FE-05).
- **FAT recette** : V1 10 + V2 4 + V3 7 + V4 6 + V5 4 + V6 2 + V7 2 + V8 2 = **37/37 PASS (100 %)**. Bandeau démo front : 9/9.
- **Écrans réels** : 34 (… V12 : Workflow Instances réel · **V13 : Formations & Certifications** · Tâches reste FE-05 seed). Gap vs maquette (73 écrans) : `docs/DECALAGE-FRONT-DEMO.md` ; écarts front + A1 : `docs/ECARTS-FRONT.md`.
- **Cycle client de bout en bout** (entrée→KYC→screening→revue→changement) prouvé sur Postgres réel (FAT-CYCLE-01).
- **Rejeu à date** : paramètres (R127) **ET** dossier KYC (`/kyc/:code/a-date`) — **OUI**.
- **Périmètre règles** : R1 → R221 · **34 modules backend**. Écarts signalés : `PersonneLienService` dormant (pas de modèle `Personne`), % détention non ratifié, fiche GED empreinte non restituée. Dette infra corrigée (Vague 4) : `PrismaService.$disconnect` + `connection_limit=3`.
