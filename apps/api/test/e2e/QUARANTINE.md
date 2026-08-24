# Quarantaine e2e — suites non hermétiques (dette suivie)

> **RÉSOLU le 2026-08-05.** Les **9** suites autrefois en quarantaine ont été **hermétisées** et
> **réintégrées** : `testPathIgnorePatterns` ne contient plus que `/node_modules/`. Le run complet
> sur base fraîche `olive_herm` (`migrate deploy` + `post-deploy-v2.sql`) est **62 suites / 411
> tests, tout vert**. Le détail des correctifs est en bas (« Sortie de quarantaine — résolutions »).
> La section historique ci-dessous est conservée pour la traçabilité du diagnostic initial.

La voie e2e (`pnpm --filter @olive/api test:e2e`) est désormais **branchée en CI** et **verte** sur
base fraîche. Neuf suites en étaient **exclues** (`jest-e2e.config.js` → `testPathIgnorePatterns`)
parce qu'elles échouaient de façon **pré-existante**, sans lien avec le travail récent.

## Preuve que ce n'est ni la dérive de migrations, ni la Phase 1 screening

| Contexte de run | Suites rouges | Tests rouges |
|---|---|---|
| Base **sale** (olive_test accumulée) | 9 | 21 |
| Base **fraîche**, migrations **avant** réconciliation | 22 | 74 |
| Base **fraîche**, migrations **après** réconciliation (`20260805000002`) | **9** | **21** |

La réconciliation de la dérive `db push` (colonnes/tables jamais versionnées : `screening_hits.channel/
match_script`, `aml_scenarios`, `aml_gap_signals`, `ground_truth_cases`, `ubo_groups`,
`doc_matrix_versions`) a **rendu reproductibles** les 13 suites AML/screening qui échouaient uniquement
sur base fraîche (colonne/table absente → 500). Les **9 restantes** échouent **identiquement** sur base
sale et sur base fraîche réconciliée : leur cause est ailleurs.

## Les 9 suites et leur cause

| Suite | Cas rouges | Cause racine (catégorie) |
|---|---|---|
| `kyc-rules` | R13, R2, R52, R84–R86 | `beforeAll` (POST /v1/kyc) non hermétique — 6/6 rouge en isolation. Dépend d'un état de séquence/référentiel qu'une autre suite installe. |
| `optimistic-lock` | LK-VISA-02 | Double signature de visa concurrente : les deux tentatives échouent (réussites=0). Timing/état partagé. |
| `fat-vague1` | FAT-KYC-01, FAT-REJEU-KYC-01 | Four-eyes 409 (validateur vu comme contributeur) ; `statutADate` attend VALIDE, obtient EN_COURS. |
| `fat-vague6` | FAT-GOLIVE-01 | Config reconstruite à date → 400 (go-live gouverné R127/R128). |
| `fat-canon-anciens` | VD-02, RW-01..05 | `Cannot read properties of null (reading 'payload')` — lectures d'événements chaînés absents hors ordre. |
| `fat-coc` | CC-04 | REVIEW_DEADLINE_ANTICIPEE dépend d'une échéance créée par `fat-reviews`. |
| `fat-reviews` | RV-01..08 | Échéances calculées/versionnées en chaîne — non hermétiques entre `it`. |
| `fat-degel-v3` | WB-06 | Exécution d'un workflow publié au Builder : dépend de l'état « atelier » d'une passe antérieure. |
| `fat-cloture-demo` | DM-03 | **Pas un problème de base** : grep de `apps/web/src` pour une branche `demo`. Le runtime de démo i18n a introduit un état d'AFFICHAGE `isDemoMode` (API absente), légitime selon le commentaire même du test. À raffiner : le grep doit distinguer l'affichage de la logique métier. |

## Sortie de quarantaine

Une suite quitte la liste dès qu'elle passe **en isolation** ET **dans le run complet** sur base
fraîche.

## Sortie de quarantaine — résolutions (2026-08-05)

Le diagnostic « dépendance d'ordre » s'est révélé **inexact** : à l'exécution isolée sur base fraîche
(avec `MFA_ENC_KEY` fourni par la CI), **8 suites sur 9 échouaient sur une garde de production
récente que les tests n'avaient pas suivie**, et la 9e sur un grep trop large. Aucune n'avait besoin
d'un ordre inter-suites. Chaque suite a déjà ses `randomUUID()` propres par module. Correctifs
(tous **côté test uniquement**, `apps/api/test/e2e/**` ; DM-03 aussi test-only) :

| Suite | Cause RÉELLE | Correctif |
|---|---|---|
| `kyc-rules` | R52 : la validation finale exige désormais `engagement:true` (R14), gardé **après** four-eyes/R52 — d'où le 409 sur le tiers. | Envoi `{ engagement: true }` sur la validation qui doit réussir. |
| `optimistic-lock` | LK-VISA-02 : `signed_by` est un **uuid** en base ; les deux écritures passaient `"premier"`/`"second"` → erreur uuid, `réussites=0`. | Deux `randomUUID()` distincts comme signataires. |
| `fat-vague1` | FAT-KYC-01 & FAT-REJEU-KYC-01 : mêmes validations finales sans `engagement` (409, event `kyc.validated` absent → `statutADate` EN_COURS). | `{ engagement: true }` sur les deux validations. |
| `fat-vague6` | FAT-GOLIVE-01 : le registre R-Q inclut désormais les **référentiels AML-gap requis** (R340→R403) ; le go-live refusait faute de les avoir seedés. | Seed **piloté par le registre** : POST de chaque clé `requis` (valeur = `exemple`) avant `activer`. |
| `fat-canon-anciens` | VD-02 / RW-01..05 : les validations `.expect(201)` sans `engagement` (409) cassaient la chaîne review → payloads null en aval. | `{ engagement: true }` sur les 3 validations de succès. |
| `fat-coc` | CC-04 : la validation KYC qui crée l'échéance PLANIFIEE n'envoyait pas `engagement`. | `{ engagement: true }`. |
| `fat-reviews` | RV-01..08 : le helper `approuverKyc` validait sans `engagement` → aucune échéance. | `{ engagement: true }` dans `approuverKyc`. |
| `fat-degel-v3` | WB-06 : validation bout-en-bout sans `engagement` (409 au lieu de 200/201). | `{ engagement: true }`. |
| `fat-cloture-demo` | DM-03 : le grep `=== "demo"` capturait les **onglets d'AFFICHAGE** (`ong === "demo"`, `tab === "demo"`) — état de vue, pas une branche métier. | Grep affiné : bloque `if (demo)` et `<identité métier> === "demo"` (tenant/mode/plan/…), ignore les sélecteurs de vue/onglet et `isDemoMode`. Vérifié : capte toujours une vraie branche `if (demo)` / `tenant === "demo"`. |

_Consigné le 2026-08-05. La garde CI « no-drift migrations ↔ schema » empêche désormais la dérive
`db push` de se reformer et de re-masquer ce genre d'écart._
