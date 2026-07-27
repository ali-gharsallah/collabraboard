# ÉCARTS-FRONT — SPEC-FRONT-CÂBLAGE v2 confrontée au backend ratifié

**Date : 2026-07-26.** Ce document confronte, **route par route**, la spec `SPEC-FRONT-CÂBLAGE v2`
au backend **réellement ratifié** dans `apps/api`. Doctrine du projet : *le front affiche et explique,
le serveur décide ; on ne fabrique JAMAIS de canon ; tout écart est signalé avant d'écrire du code.*

**Conclusion en une ligne** : les 4 blocs front dits « constructibles immédiatement » (Ports, Workflow
Instances, Tâches, Next Best Action) ciblent des endpoints qui **n'existent pas** sous cette forme dans
le backend ratifié. Deux invariants de plateforme (préfixe d'URL, mode d'authentification) divergent aussi.

**Suite (Vague 10, décisions §4 actées)** : sur les 4 blocs, seuls **Ports** (porte mince réelle) et **NBA**
(lecture R187) sont buildables sans inventer ; **WFI** et **Tasks** restent **gelés** (aucun service ratifié).
FE-CORE (`api.ts`) livré en incrémental (JWT défaut, `/v1`). Détail de la recette : `docs/tests/FAT/FAT-VAGUE10.md`.

---

## 1. Écarts d'invariants de plateforme

| Élément spec v2 | Réalité backend ratifié | Écart | Impact |
|---|---|---|---|
| Préfixe `/api/v1/...` | `main.ts` pose `setGlobalPrefix("v1")` → routes en **`/v1/...`** (sans `/api`) | **Préfixe** | Toute URL de la spec doit perdre `/api`. À trancher : aligner la spec sur `/v1`, ou ajouter `/api` au backend. |
| Auth **headers-mode** `x-tenant-id` / `x-user-id` / `x-user-role` (transitoire) | `TenantMiddleware` exige un **JWT RS256** (résolution de clé par `kid`, JWKS `.well-known`). Le front actuel envoie `Authorization: Bearer <olive_jwt>`. | **Auth** | Un front headers-mode **échoue en 401** contre le backend réel. Le `OLIVE_AUTH_MODE='headers'|'jwt'` de la spec suppose un backend qui accepte les headers — non ratifié. |
| `src/lib/api.ts` : `apiGet(path,{asOf})` / `apiPost(path,body)` / `useApiOrSeed` | `api.ts` actuel : `apiGetSourced<T>(path, seed)` + `isDemoMode()` (fallback seed signalé par bandeau). Pas de `apiPost`, pas de `asOf`, pas de `useApiOrSeed`. | **Contrat API** | Adoption des nouvelles signatures = refonte de la couche réseau (compatible, mais touche les 29 écrans existants s'ils migrent). |
| `?asOf=` sur écrans audités (R48/R49) | Backend : rejeu à date **partiel** — `GET /v1/parametres/valeur/:cle?date=`, `GET /v1/kyc/:code/a-date?date=`, `GET /v1/parametres/config?date=`, `GET /v1/workflow/resoudre?date=`. **Pas de `?asOf=` générique** sur tasks/ports/instances. | **Rejeu partiel** | Le rejeu à date n'est disponible que là où une route dédiée existe ; pas de paramètre transverse `asOf`. |
| `src/theme/tokens.ts` + « zéro style inline nouveau » | **Aucun** `src/theme/` ; les 29 écrans sont **intégralement en styles inline**. | **Thème** | « Zéro style inline » contredit tout le front existant ⇒ refonte thème = chantier transverse (à décider : big-bang ou incrémental). |
| Tests front **Vitest + Testing Library + MSW** | `apps/web` n'a **aucun** de ces outils (`vitest`/`@testing-library`/`msw` absents de `package.json`). Seul test : `scripts/test-demo-banner.sh` (bash). | **Outillage de test** | Les DoD front (`FE-xx` verts en Vitest+RTL+MSW) exigent d'abord d'installer et configurer cette pile. |
| SPA « canon consolidé, un seul arbre, pas de fork » | Front actuel = `router.tsx` (tab-switcher, 29 écrans). | **Shell** | À décider : la v2 refond-elle le shell (routing, layout, tokens) ou s'y ajoute-t-elle ? |

---

## 2. Écarts par bloc « constructible immédiatement »

### 2.1 FE-PORT — `GET /api/v1/ports`, `GET /ports/:portId/health`
- **Réalité** : **aucun** registre `/v1/ports`. Seul port ratifié : **core banking** — `GET /v1/corebanking/etat` (R168, lecture seule) + `POST /v1/corebanking/importer` (R167, refuse sans port configuré).
- **Écart** : les ports **fx / custody / mobile** n'existent pas comme routes. Le registre unifié `[{portId,status,lastCheckAt}]` et `/ports/:id/health` n'existent pas.
- **Ce qui est vrai de la spec** : l'écran « Intégrations core » (fallback Avaloq/Temenos/Olympic) correspond à `corebanking` — mais l'ordre de fallback n'est pas exposé par une route dédiée à ce jour (à vérifier dans `core-sync.service.ts`).
- **Options** : (a) construire une **porte `PortsModule`** qui projette un registre à partir des ports réellement ratifiés (aujourd'hui : corebanking + IA `iaProviderRef` + coffre `docStorage`), statut dérivé de la présence du secret/config tenant — **sans jamais toucher un secret côté navigateur** ; (b) écran seed-only signalé ; (c) attendre canon `fx/custody/mobile`.

### 2.2 FE-WFI — `GET /api/v1/workflow-instances`, `/:id`, `/:id/events`
- **Réalité** : le module `workflow` est celui des **DÉFINITIONS** de workflow (R171-173) : `POST /v1/workflow/definitions`, `PATCH …/:id`, `POST …/:id/publier`, `GET …/definitions`, `GET …/resoudre`. **Aucune notion d'instance** en cours (steps/visas/events par client) exposée.
- **Écart** : **workflow-instances n'existe pas**. La chaîne `kyc-workflow.chaine.ts` orchestre le KYC mais n'est pas exposée comme ressource « instance » interrogeable avec timeline append-only.
- **Options** : (a) exposer une **projection instance** à partir des `DomainEvent` d'un agrégat (KYC/onboarding/riskcase) — mais « instance de workflow » comme objet de premier ordre n'est pas ratifié ; (b) attendre canon MOD-instances.

### 2.3 FE-TASK — `GET /api/v1/tasks`, `POST /tasks/:id/complete`, `/reassign`
- **Réalité** : **aucun** contrôleur `tasks`. Le seul objet « tâche » est dans `workload` : `POST /v1/workload/taches/:id/reassigner` (R184). **Pas** de `GET /tasks` (liste filtrable), **pas** de `complete`.
- **Écart** : la ressource **tâches unifiée** (liste par assignee/statut/échéance, complétion événementielle `TASK_COMPLETED`) n'existe pas. `workload` gère la **charge/réassignation**, pas un backlog de tâches actionnables.
- **Options** : (a) construire une porte `TasksModule` **si** un service de tâches ratifié existe (à ce stade : non trouvé) ; (b) attendre canon.

### 2.4 FE-NBA — `GET /api/v1/nba`, `POST /nba/:id/decision`
- **Réalité** : CRM expose `GET /v1/crm/clients/:id/gestes` = `prochainsGestes` (**R187** — « prochains gestes proposés » par client). C'est l'esprit NBA, mais **par client**, et **sans** endpoint de décision (Accepter/Ajuster/Rejeter).
- **Écart** : pas de `/nba` global multi-contexte, pas de `POST /nba/:id/decision` traçant `ACCEPT|ADJUST|REJECT`. Le geste CRM est une **suggestion en lecture** ; la « décision NBA tracée » (R44 strict) n'a pas de route.
- **Options** : (a) écran NBA branché sur `crm/clients/:id/gestes` en **lecture** (contexte=client), en signalant l'absence de route de décision ; (b) construire une porte de décision **si** un service ratifié la porte (non trouvé) ; (c) attendre canon.

---

## 3. Zone gelée (PROPOSÉE — R222..R238) et zone canon manquant

- **Business Trip (MOD-75, R222..R230)** et **Formations (MOD-43, R231..R238)** : règles **PROPOSÉES**. Par consigne, **aucun code front ni back** avant « OK pour R222..R238 » d'Ali. Gherkin d'abord — livré gelé dans `spec/proposed-R222-R238/` (fichiers `.feature` étiquetés `@proposed`, non exécutés).
- **Canon manquant (zéro code)** : Command Center, Investigation, SWIFT, Legal, Octopulse, CPSI-Nest, Olivia/BI, écrans IAM/SSO, Audit, Sandboxes dry-run autres que AML. Aucune route, aucun placeholder.

---

## 4. Décisions ACTÉES (Ali, 2026-07-26) et suite

1. **Backends absents** → **portes minces là où un service ratifié existe**. Livré Vague 10 : `PortsModule`
   (projection des ports ratifiés core/IA/coffre) ; FE-NBA branché en **lecture** sur `crm/gestes` (R187).
   **WFI et Tasks GELÉS** (aucun service ratifié — ni instances de workflow, ni backlog de tâches) : non codés.
2. **Auth** → **JWT par défaut** ; headers-mode câblé mais **inerte** (`OLIVE_AUTH_MODE`) — livré dans `api.ts`.
3. **Architecture front** → **incrémentale** : `apiGetSourced` et les écrans existants conservés ; `apiPost`,
   `asOf`, `useApiOrSeed`, **Vitest** introduits au fil des nouveaux blocs. `theme/tokens.ts` + MSW : différés
   (pas requis par les blocs livrés ; à introduire quand un bloc les exige).
4. **Préfixe** → **`/v1`** (réalité backend). La spec est lue en `/v1`, le routing ratifié n'est pas touché.

**Reste ouvert (attente canon / validation)** : FE-TASK (backlog list/complete — canon backend dédié) ; route de **décision NBA**
(`POST /nba/:id/decision`) ; ports **fx/custody/mobile** ; R222..R238 (Business Trip / Formations, **PROPOSÉES** —
attente « OK pour R222..R238 ») ; zone canon manquant (Command Center, Investigation, SWIFT, Legal, Octopulse,
CPSI-Nest, Olivia/BI, écrans IAM/SSO, Audit).

## 5. AMENDEMENT A1 (ratifié) — application (Vague 11)

A1 ratifie les 4 arbitrages (D1 portes minces / D2 JWT défaut / D3 incrémental / D4 `/v1`) et fournit le
**scénario FE-05** : « écran sans service ratifié → seed lecture seule, aucun endpoint fictif ». Application :

| Bloc | Service ratifié ? | Résolution A1 |
|---|---|---|
| **Ports** | oui (core R167 + config tenant) | Porte mince livrée (Vague 10). PT-01 ≡ FAT-PORT-01/02 (relaie/projette, ne décide pas). |
| **Workflow Instances** | **oui (V12)** — projection du **dossier KYC** (workflow gouverné ratifié : `KycFile`+`KycVisa` R15 + `DomainEvent` timeline) | **Porte mince réelle** `WorkflowInstancesModule` (liste/détail/events). L'instance = le dossier KYC. FAT-WFI-01/02/03. Les autres types de workflow s'ajouteront avec leur canon. |
| **Tâches** | **partiel** — `workload.reassigner` (R184) + lectures internes ; **pas** de service backlog list/complete | **FE-05** (`Tasks.tsx`) ; bouton « Compléter » **absent** (capacité non ratifiée, D1). |
| **NBA** | oui (per-client `crm/gestes` R187) ; **pas** de route de décision | Lecture livrée (Vague 10) ; décision **désactivée** (D1 : capacité absente → action absente). |

**Auth (D2)** : `authMode()` défaut `jwt` ; `isDevAuthMode()` pilote le bandeau « Mode dev — auth simulée » quand
`OLIVE_AUTH_MODE='headers'` (dev/tests MSW). **Préfixe (D4)** : `/v1`, base = racine, un seul point de concat (FE-06).
**Incrémental (D3)** : `theme/tokens.ts` créé ; Vitest+Testing Library+MSW installés ; boy-scout tracé dans
`docs/MIGRATION-FRONT.md` (aucun écran existant migré à ce jour). **Aucune résolution silencieuse** : les FE-05
ci-dessus appliquent la règle A1, ils n'inventent pas de canon ; un service backend WFI/Tasks/décision-NBA
relève d'un futur amendement (A2).

## A3 — Reconnaissance workflow (lecture) — verdict **CAS A**

Reconnaissance factuelle du moteur workflow ratifié (intouchable). L'instance = le **dossier KYC**
(`kyc-workflow.chaine`, R171-173), déjà projeté en lecture par `WorkflowInstancesModule` (Vague 12).

| # | Question | Réponse factuelle | Preuve |
|---|---|---|---|
| **Q1** | État courant d'instance persisté & requêtable (statut, étape) ? | **OUI** | `KycFile.status` (enum `KycStatus`), `handoffPhase` (étape R85), `workflow` (type) — colonnes persistées, pas seulement des événements (`schema.prisma`). |
| **Q2** | Lister toutes les instances d'un tenant filtrées sans rejouer les événements ? | **OUI** | `prisma.kycFile.findMany({ where: { tenantId, status } })` — `WorkflowInstancesService.lister`. |
| **Q3** | Événements par instance, ordonnés, avec acteur + horodatage + type ? | **OUI (avec nuance)** | `DomainEvent` par `aggregateId` (=kyc.id), ordonné par `at`, `type` + `at` de premier ordre. **Acteur** : présent dans le **payload** des événements (`by`/`holder`/`par`/`validatedBy`/`signedBy` = `ctx.userId`), **pas une colonne uniforme** ; certains événements (`kyc.created`) ne le portent pas en payload (l'entité porte `createdBy`). → surfacé depuis le payload (donnée moteur), `null` quand le moteur ne l'a pas écrit — **jamais synthétisé**. |
| **Q4** | Rejeu à date (R48/R49) exposé côté lecture ? | **OUI** | `GET /v1/kyc/:code/a-date?date=` → `KycService.etatADate` reconstruit l'état depuis les événements ≤ date. La porte le relaie via `asOf` (délégation au ratifié). |
| **Q5** | Visas joignables à la lecture au format uniforme R15 ? | **OUI** | `KycVisa` (`sectionCode`/`requiredRole`/`status`/`signedBy`/`signedAt`/`verdict`) — déjà exposé par la porte (V12). |

**VERDICT : CAS A** (Q1 et Q2 = OUI ; état requêtable existant). Q5 = OUI. Q4 = OUI (rejeu read-side ratifié).
Q3 = OUI, avec la **nuance acteur** (donnée dans le payload moteur, non colonne uniforme) — non bloquant :
les événements sont requêtables/ordonnés/typés/horodatés et l'acteur est **lu** (jamais fabriqué).

→ **Action A3.4 : porte mince A3.2 construite immédiatement** (aucune validation Ali requise). Zéro endpoint
d'écriture sur les instances ; filtrage tenant + `asOf` dans la porte ; visas au format R15 exact ; l'acteur
provient du payload moteur (`null` si absent). Le read model R247 (CAS B) **ne s'applique pas** : l'état est
déjà persisté et requêtable, aucune projection dérivée n'est nécessaire.

## A2 — Tâches & NBA (R239→R246, ratifié « OK pour R239..R246 »)

Amendement A2 : canon backend pour les deux capacités restées en démonstration après A1.

- **Tâches (R239→R242) — IMPLÉMENTÉ (Vague 16).** `TasksModule` ; l'écran `Tasks.tsx` **sort du mode FE-05**.
  Réassignation = ratifié `WorkloadService.reassigner` (inchangé). **Écart de vocabulaire signalé** : le statut
  R239 (OPEN|COMPLETED|CANCELLED) est mappé sur le vocabulaire ratifié `Task` (OUVERTE|FAITE|ANNULEE) — workload
  R183 inchangé, mapping DTO, aucun canon changé. Gherkin : `spec/vague16-scenarios/TASKS-MOD.feature`.
- **Décision NBA (R243→R246) — IMPLÉMENTÉ (Vague 17).** `NbaModule` ; l'écran NBA décide (Accepter/Ajuster/Rejeter câblés). NB-05 : la tâche naît de l'événement
  `NBA_DECIDED` consommé par le service Tâches). Jusque-là, l'écran NBA reste en **lecture** (gestes R187,
  décision désactivée) — inchangé depuis A1.

## Écart canon — R78 réservé / inexistant (CPSI)

**Constat vérifié (2026-07-27)** : `R78` n'existe **nulle part** — ni dans `spec/`, ni dans
`services/cpsi-server-py`, ni dans `apps/api`/`apps/web` (grep `.md`/`.py`/`.ts` = 0 occurrence).
Gap de numérotation entre **R77** (séparation Screening/AML) et **R79** (catalogue de conformité).

**Décision** : documenté comme **RÉSERVÉ** (ni inventé, ni comblé). À ratifier explicitement si un jour
un besoin s'y loge. Référence : `docs/CPSI-CATALOGUE-R63-R86.md`. Aucun code ne présuppose R78.
