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

## Audit architecture — écarts perf/pagination (A4)

Fixes de l'audit `docs/AUDIT-ARCHITECTURE.md`, appliqués behavior-preserving (suite verte = équivalence).

- **A4 — pagination keyset (`common/pagination.ts`).** Les portes de LISTE récentes (tasks, trips, nba,
  workflow-instances) sont bornées par défaut (`DEFAULT_PAGE=200`, > toute fixture ⇒ aucune liste testée
  tronquée) et exposent `?limit=&cursor=` (keyset `createdAt desc, id desc`), ADDITIF.
  **Écart signalé** : pour les `createdAt` de type DateTime (trips, kycFile) le curseur est à granularité
  MILLISECONDE — l'ORM restitue la Date JS (ms), le µs Postgres est perdu. Ces agrégats étant créés à cadence
  humaine (jamais deux dans la même ms d'un tenant), le keyset est exact en pratique ; pour tasks/nba
  (`createdAt` String) il est exact par construction. La borne par défaut, elle, est exacte en toutes circonstances.

- **A6 — code-splitting front (`app/router.tsx`).** Les 35 imports eager du routeur passent en
  `React.lazy` + `<Suspense>` : le chunk initial `index-*.js` tombe de **252 KB → 152 KB** (gzip 49 KB),
  chaque écran devient un chunk 1–5 KB chargé à l'ouverture. Comportement identique (mêmes écrans, même
  aiguillage ; Vitest 13/13). **Reste à faire (suivi)** : virtualisation des tables (react-window) au-delà
  d'un seuil de lignes — valeur marginale désormais faible, les listes serveur étant bornées par A4
  (défaut 200) ; sera fait au fil des écrans touchés (règle boy-scout, comme la migration `theme/tokens`).

- **A3 — typage `tx` (`common/tx.ts`).** Alias cible `Tx = Prisma.TransactionClient` / `DbClient =
  TransactionClient | PrismaService`. Appliqué aux 4 helpers partagés (A2) et aux 3 modules de la session
  (businesstrip, tasks, nba) : `$transaction(async (tx: Tx) => …)`. Un seul cast nécessaire (champ Json
  `trip.clients`). **Reste (suivi, ratifié incrémental)** : propager `Tx` aux ~30 autres services, fichier
  par fichier, sans toucher la logique. Comportement identique — la suite verte le prouve.
## Écart canon — R78 réservé / inexistant (CPSI)

**Constat vérifié (2026-07-27)** : `R78` n'existe **nulle part** — ni dans `spec/`, ni dans
`services/cpsi-server-py`, ni dans `apps/api`/`apps/web` (grep `.md`/`.py`/`.ts` = 0 occurrence).
Gap de numérotation entre **R77** (séparation Screening/AML) et **R79** (catalogue de conformité).

**Décision** : documenté comme **RÉSERVÉ** (ni inventé, ni comblé). À ratifier explicitement si un jour
un besoin s'y loge. Référence : `docs/CPSI-CATALOGUE-R63-R86.md`. Aucun code ne présuppose R78.

## Écart canon — réconciliation machines à états R83 (CPSI) ↔ R133–R136 (riskcases)

**Enregistré 2026-07-27 (amendement R248–R252, critère d'acceptation 5).** Le moteur CPSI porte une
machine à états de risk case (bloc 14, R83) : NOUVELLE → EN_ANALYSE → (CLARIFICATION ↔ EN_ANALYSE) →
CLOTUREE | ESCALADEE. Le module plateforme `modules/riskcases` (R133–R136) porte sa PROPRE machine à
états d'instruction. R252 tranche la **direction** (CPSI émet `case_proposal`, riskcases instruit) mais
**la correspondance formelle des deux machines reste à ratifier** — divergence = écart de catalogue, pas
un détail d'implémentation. Tant que non réconciliées : le CPSI n'expose aucune surface risk-case (PC-11),
le `risk_cases` du moteur Python reste un outil de test (jamais produit), aucune route R133–R136 touchée.

## Écarts — bacs à sable restants (reconnaissance 2026-07-27, patron R94)

Le patron ratifié R94 exige un MOTEUR PUR + un PARAMÈTRE GOUVERNÉ au registre R-Q à simuler.
Reconnaissance faite moteur par moteur ; **seul `sbonb` était constructible sans nouveau canon**
(fait : `POST /v1/onboarding/sandbox` sur `onboardingSlaJours`, FAT-SBONB-01/02). Les 4 autres :

- **`sbkyc`** : `kyc/risk-engine.computeRisk` est PUR et tracé (idéal), mais ses barèmes
  (STRUCTURE_PTS, pays à risque, seuils 25/50) sont des **constantes codées en dur** — aucun
  paramètre KYC scoring gouverné au R-Q. Rien à « simuler » au sens R94 tant que ces barèmes ne
  sont pas ratifiés comme paramètres tenant. → amendement de catalogue requis d'abord.
- **`sbbrm`** : la capacité d'équipe (R183-185) est mesurée en DB (`WorkloadService`), aucun moteur
  pur isolé. Refactor d'isolation requis avant tout dry-run.
- **`sbcf`** : `transaction-gate.evaluer` a des **effets de bord** (gardes recevant prisma+emit,
  événements émis) — non isolable en l'état, bien que `txGardes` soit gouverné. Refactor requis.
- **`sbwf`** : le moteur workflow (R1-R51) est INTOUCHABLE et n'expose aucun `evaluer` pur ;
  l'objet même de la simulation (defs R171-173 ? matrice ?) n'est pas défini. Canon à ratifier.

Aucun de ces quatre n'a été construit — signalé, pas inventé.

## Écarts — bloc Olivia v1 (étape 0, 2026-07-27)

- **Rôle `SO` inexistant** : la spec Olivia (audit/santé/T9/mode audit SO) cite un rôle absent de
  l'enum ratifiée (`RM ARM CO CO_SR MLRO CF BRM DIR ADMIN`). Mapping sans nouvelle règle :
  Direction/Head PB/CEO → DIR, Central File → CF. **SO : aucun équivalent** — v1 se code avec ADMIN
  là où la spec dit « ADMIN, SO » ; SO reste un rôle à ratifier (ajout à l'enum = migration + canon).
- **Tuiles Home** — arbitrage Ali (2026-07-27) : critère « zéro endpoint nouveau » AMENDÉ →
  T1/T2 livrées (portes de lecture minces, périmètre serveur, e2e HO-01/03/05/06). **T7/T8 restent
  bloquées par les DONNÉES** : aucun modèle ratifié d'échéance de review (T7) ni de cycle de vie/
  matérialité CoC (T8 — événements sans statut). Canon à ratifier pour les débloquer. HO-02
  (licence R177 surfacée au front) : PARTIEL — visibilité v1 par rôle.

- **OL-07 (étape 4 Olivia)** : le scénario de la spec déclenche le refus périphérique via C3
  (« risk case lié » à une alerte) — or **aucun lien alerte→risk case n'est ratifié** (la seule
  passerelle est `case_proposal`, R252) et C3 n'ouvre qu'à l'étape 6. La MÉCANIQUE §3 (objet
  périphérique refusé ⇒ exclu + `OLIVIA_CONTEXT_DENIED` + « contexte partiel », le nombre jamais
  la nature) est implémentée et prouvée via les **références explicites C1** (chemin ratifié B.5-2).
  À re-prouver sur C3 quand elle ouvrira.

## Écarts — canon VAGUE ÉCRANS PILOTE (étape 0, 2026-07-27) — verdict complet en tête de `spec/canon-vague-ecrans-pilote.md`

- **Collision de famille `SB`** : SB-01..06 déjà pris (SecretBox `mfa_secret`, 2026-07-19).
  Renommage proposé **SB → BS** (BS-01..06, libre) — **STOP, validation requise** (partie 3 seule bloquée).
- **R267–R271 vérifiés LIBRES** (grep exhaustif post-renumérotation Olivia). À la ratification :
  `CATALOGUE_MAX_REGLE` 266 → 271 (R256, olivia.module.ts).
- **Partie 1** — endpoints MANQUANTS signalés avant code : onglet **Reporting** (volumétrie +
  délai hit→MROS — la query pont ex-CP-17 n'a plus de route HTTP depuis R252) ; **timeline client**
  CPSI rejouable `as_of` (aucune projection par client). Le graphe de corrélation, lui, peut rendre
  `alerts.correlations` (existant). C3 Olivia : dépendance temporelle (ouvre à l'étape 6 Olivia).
  AW-05 : idempotence du rattachement signal→case à PROUVER sur l'existant, pas à corriger en douce.
- **Partie 2** — `CpsiParam`/`CpsiGuide` EXISTENT déjà (extension, pas reconstruction). MANQUANTS :
  route **historique des versions** (journal `cpsi_events` non exposé) ; commande d'**application
  de barème** (`cpsi.param.applied`) avec date de mise en vigueur (PA-03) — aucune mutation directe
  des paramètres n'existe (seuls groupes/scénarios/propositions/FP/insider).
- **Partie 3** — `sbonb` : ÉCART DE LEVIERS (livré = seuils SLA ; canon = aiguillage
  structure→workflow, endpoint dry-run d'aiguillage inexistant). `sbkyc`/`sbbrm`/`sbcf`/`sbwf` :
  aucun endpoint dry-run (+ blocages sous-jacents déjà consignés ci-dessus : barèmes non gouvernés,
  moteurs non isolés, objet sbwf indéfini). Chaque endpoint à créer est signalé ICI, avant code.
- **Partie 4** — `sdkyc` : `KycAccessRule` existe en base mais AUCUNE route matrice, modèle par
  QUESTION (pas section×rôle), **aucun versionnage à date** (SD-04 impossible sans évolution de
  modèle), aucun garde-fou backend, pas de « Voir comme ». `sdar`/`sdgar` : aucun store de
  questionnaire de review. **`cocparam` : le store `COC_CONFIG` n'existe PAS** (le CoC est un
  événement brut sans typologie) — le canon le dit « existant » : divergence repo vs canon → STOP.
- **Partie 5** — exécutable dès ratification : dépendances vérifiées présentes (riskcases, gel MROS,
  port core banking, `KycFile.previousKycId`) ; l'état ACTIVE/CLOTUREE vivra dans
  `offboarding_files.statut` (le modèle `Client` n'a pas de champ statut — conforme au §5.2).

## Écarts — canon DÉBLOQUANTS HOME (étape 0, 2026-07-27) — verdict complet en tête de `spec/canon-debloquants-home.md`

- **Référence croisée (étape 0-d)** : les 3 écarts Home ci-dessus sont ADRESSÉS par ce canon —
  **T7** (échéances de review) ← partie 1 (R272–R275, RV-01..08) · **T8** (cycle de vie CoC)
  ← partie 2 (R276–R278, CC-01..08) · **HO-02** (licence surfacée) ← partie 3. Ils seront
  SOLDÉS ici à la livraison verte de chaque partie, pas avant.
- **Collision de famille `LC`** : LC-01..05 déjà pris par le corpus licence vendor
  (`vendor-license.service.ts`, R177→R179). Renommage proposé **LC → LS** (Licence Servie,
  libre) — validation requise.
- **R279 requalifié en APPLICATION** (prévu par le canon lui-même) : DEUX services de licence
  existent, codés et spécifiés, AUCUN branché — `LicenseService` (tenant, Ed25519 hors ligne,
  `assertModule`) et `VendorLicenseService` (instance, DB append-only R179, LC-01..05). Aucune
  route, aucun guard, `MODULE_INACTIF` nulle part. La partie 3 = endpoint + branchement sur
  l'existant, AUCUNE règle nouvelle ; le numéro R279 n'est pas consommé. **Arbitrage résiduel :
  laquelle des deux sources fait foi** (proposition : `VendorLicenseService`, DB + append-only ;
  l'autre consignée en écart de doublon).
- **STOP partie 2 (CoC)** : R276 copie matérialité/action depuis « COC_CONFIG EN VIGUEUR » —
  or le store **COC_CONFIG n'existe pas** dans le repo (CoC = événement brut sur la personne ;
  `coc_sensible` = simple poids dans le moteur CPSI Python, jamais émis depuis le CoC réel).
  Inexécutable sans créer le store : extension de R276 ou canon COC_CONFIG séparé, à trancher.
- 🟡 R273 « franchissement de bande CPSI à la hausse » : le déclencheur automatique
  d'anticipation (consommateur d'événement CPSI) est à câbler — signalé. RV-04/CC-04
  (anticipation par CoC Haute) ne se prouveront qu'à l'ouverture de la partie 2 (patron OL-07).

## Arbitrages Ali (2026-07-27, 2e ratification vague pilote) — exécutoires

- **BS ratifié** (famille bacs à sable, ex-SB).
- **P1** : timeline client + reporting = **commandes à AJOUTER au contrat de la porte CPSI**
  (extension du canon R248-R252, scénarios **PC-11+**, signalées — pas des routes inventées).
- **P2** : l'application d'un paramètre est un **événement du journal `cpsi_events`** (R68/R249),
  même extension de contrat.
- **P3** : endpoints dry-run à créer **sous le patron SandboxAml**, signalés comme application
  de R70 — zéro mutation prouvée (**BS-01** exécuté sur chacun des 5).
- **P4** : `sdkyc` rendu sur le modèle ACTUEL (par question) ; **SD-04 SUSPENDU** — écart
  « versionnage `kyc_access_rules` à ratifier » consigné ici ; **`sdar`/`sdgar` REPORTÉS**
  (écart : store de questionnaire de review inexistant) ; **`cocparam` séquencé APRÈS la PR CoC**
  du canon débloquants (R276 crée COC_CONFIG).
- Ordre : partie 5 (LIVRÉE) → P1 → P2 → P4 partiel → P3 ; **Olivia étapes 6-8 en parallèle (go)**.

## SOLDE — HO-02 (2026-07-27, canon débloquants Home partie 3 LIVRÉE)

- **HO-02 SOLDÉ** : la licence est SERVIE (`GET /v1/modules/actifs`, source ratifiée =
  `LicenseService`, licence par tenant signée vérifiable hors ligne) et APPLIQUÉE serveur
  (garde `ModuleLicencie("cpsi")` → 403 `MODULE_INACTIF` ; LS-01..03 e2e verts). Home : tuile
  d'un module inactif ABSENTE du DOM et AUCUN appel émis (Vitest, MSW onUnhandledRequest:error).
- Écarts résiduels consignés : (1) **aucune licence chargée = mode socle** (tous modules actifs,
  non-cassant — le défaut-refus strict R177 s'applique dès qu'une licence existe ; à re-durcir si
  exigé) ; (2) **`VendorLicenseService` = doublon non branché** (écart, décision Ali : LicenseService
  fait foi) ; (3) l'enforcement est branché sur le module **cpsi** (l'exemple du canon) — le
  branchement des autres contrôleurs suit le même patron, à étendre par vagues ; (4) lecture
  d'audit d'un module inactif : GET + ADMIN (écart SO connu).
- T7 ← partie 1 (reviews R272-R275) et T8 ← partie 2 (CoC R276-R278, **R276 ÉTENDU ratifié :
  le canon crée le store COC_CONFIG**) : à solder à leurs livraisons.

## SOLDE — T7 (2026-07-27, canon débloquants Home partie 1 LIVRÉE)

- **T7 SOLDÉ** : les échéances de review EXISTENT (R272-R275, `review_deadlines`, hook dans la
  transaction d'approbation KYC — pas un cron ; index partiel unique = UNE PLANIFIEE par client).
  `GET /v1/reviews/deadlines?horizonJours=` sert la tuile T7 (RM/ARM/CO, périmètre serveur,
  EN_RETARD calculé à la lecture) ET l'écran Review. RV-01..08 e2e verts.
- 🟡 Écarts résiduels : le déclencheur AUTOMATIQUE d'anticipation (CoC Haute RV-04/CC-04,
  franchissement de bande CPSI) reste un consommateur d'événement à câbler — l'anticipation est
  livrée avec `declencheur` tracé, appelable par la partie 2 CoC ; le tick préavis/escalade est
  une route ops (`POST /v1/reviews/tick`), pattern tickSla existant.
- Reste : **T8 ← partie 2** (CoC R276-R278 + création du store COC_CONFIG, ratifiée).

## SOLDE — T8 (2026-07-27, canon débloquants Home partie 2 LIVRÉE — R276 ÉTENDU exécuté)

- **T8 SOLDÉ** : le CoC est un DOSSIER (`coc_files`, OUVERT → EN_TRAITEMENT → {TRAITE|NON_RETENU}) ;
  le store **COC_CONFIG est CRÉÉ** (`coc_config_versions`, versionné à date append-only + table
  livrée de 12 types en repli — écart signalé : le canon citait ~40 types, l'extension est un acte
  de paramétrage). `GET /v1/coc` sert la tuile T8 (compteur + répartition par matérialité,
  périmètre serveur) ET l'écran CoC (qui consomme désormais coc_files). CC-01..08 e2e verts,
  CC-04 prouve RV-04 depuis le CoC (déclencheur `coc_haute`). Signal CPSI `coc_sensible`
  désormais ÉMIS et RATTACHÉ au dossier (l'échec est tracé COC_SIGNAL_NON_EMIS, jamais silencieux).
- Les 3 écarts Home d'origine (T7, T8, HO-02) sont TOUS SOLDÉS — le canon débloquants est livré
  (parties 3, 1, 2). Reste du canon : rien.

## CHANTIER #4 — sweep A3 `tx: Tx` COMPLET (2026-07-27, reliquat audit architecture)

- **Sweep livré** : les ~228 `tx: any` restants (39 fichiers de services) sont typés
  `Tx = Prisma.TransactionClient` (`common/tx.ts`). Iso-fonctionnel prouvé : tsc 0, lint 0,
  e2e 26 suites/190, harnais 425/425, CPSI 18/18, Vitest 41/41.
- ⚠️ **Écart de branche (signalé)** : l'audit A1–A6 (PR #45, `claude/audit-architecture`) n'est
  MERGÉ NI dans master ni dans cette branche. La fondation `common/tx.ts` est recréée ICI À
  L'IDENTIQUE (copie du commit e1668d0) — au merge de #45, la réconciliation est triviale
  (même fichier, même contenu) ; les amorces A3 de #45 (businesstrip/tasks/nba) convergeront.
- 🔴 **4 anomalies latentes SURFACÉES par le typage — casts iso-runtime posés, CORRECTION À
  RATIFIER** (les corriger change le comportement : requêtes/événements) :
  1. `prerevue.service.ts` (`demander`, R121-R124) : `kycSection` interrogé avec `tenantId`
     (colonne inexistante — Prisma réel lèverait) + `kyc.clientName` et `s.reponses` inexistants.
     Chemin NON couvert e2e (bloc 20 prouvé sur harnais/fake prisma uniquement).
  2. `personne-lien.service.ts` (R152-R155) : délégué `tx.personne` INEXISTANT (modèle `Person`,
     champs `statut/creePar/creeAt/type` absents du schéma) — 4 sites, crash à l'exécution ;
     chemins non couverts e2e.
  3. `personnes.service.ts` (divergence identité) : `kycFile.rmId` inexistant (Client.rmUserId
     existe) — l'événement `tache.corroboration` ne s'est JAMAIS émis (if toujours faux).
  4. `reviews.module.ts` : paramètre `scope` inutilisé (lint pré-existant sur HEAD) → `_scope`
     (le périmètre T7 est décidé SERVEUR, le paramètre client est volontairement ignoré).
- A6 (virtualisation des tables front) : ratifié « au fil des écrans » (valeur marginale, listes
  bornées) — inchangé.

## CHANTIER #3 — transport CPSI persistant (2026-07-27, perf pont)

- Le shell-out par appel (`execFile python3 bridge.py`) devient un **worker persistant NDJSON**
  (`bridge.py --serve`, FIFO, respawn auto, timeout ⇒ kill). CONTRAT R248 INCHANGÉ : `traiter()`
  reconstruit le moteur à chaque enveloppe (aucun état entre appels — le rejeu R48/R49 reste la
  seule source d'état) ; le moteur `olive_cpsi/` n'est PAS touché. Mode one-shot conservé.
- Mesure transport (30 appels, journal vide) : 32,3 ms → 0,2 ms/appel (×138) ; fat-cpsi 15,1 s → 13,4 s.
- Prouvé iso-fonctionnel : Python 18/18, e2e 26 suites/190 (PC-08 : CPSI_DIR invalide ⇒ 503 typé,
  worker invalidé/respawné), harnais 425/425, tsc 0, lint 0.

## OLIVIA v2 — ÉTAPE 0 DU DÉGEL (2026-07-27, décision Ali)

- **0a Numérotation** : le message de dégel citait R260–R267 / tests AG-xx. COLLISION avec
  l'existant (R267 = Offboarding R267-R271 livré ; AG-01..06 = pré-revue IA R121-R124 livrée).
  Mapping appliqué (STOP soumis à ratification) : décalage uniforme −1 vers la numérotation
  RATIFIÉE de l'en-tête du canon (v2 = R259–R266) et famille AG→SW (SW-01..18).
- **0b** : mention « CODE GELÉ » retirée de la Partie B, événement daté dans le canon.
- **0c Compatibilité B.2 ↔ v1 (divergence signalée AVANT code)** :
  - `olivia_proposals` : RÉUTILISABLE TEL QUEL — `messageId` (la sortie qui fonde) pointera le
    message-livrable du run ; aucun changement de schéma.
  - `olivia_messages` : réutilisable pour le livrable (`olivia_runs.livrable_message_id`) À UNE
    CONDITION : `conversation_id` est NOT NULL en v1 alors qu'un run n'a PAS de conversation.
    Résolution proposée (non destructive, aucune donnée altérée) : DROP NOT NULL sur
    `conversation_id` ; l'unicité `(conversation_id, seq)` reste inerte pour les lignes NULL,
    le chaînage record_hash du livrable s'ancre sur le journal du run. AUCUNE migration
    destructive requise.
  - `olivia_runs.ancrage_id UUID` (B.2) : compatible — les missions v2 n'ancrent que
    KYC_FILE/RISK_CASE (uuid) ; l'élargissement text de v1 ne concernait que les
    conversations C4/PARAM.

## OLIVIA v2 — ÉCARTS DE LIVRAISON (2026-07-27, au fil des étapes)

- 🟡 **« Propositions de clarification » (B.4)** : le type CLARIFICATION n'existe PAS au
  catalogue R254 v1 (TYPES_PROPOSITION figé : QUALIF_ALERTE_*, AIGUILLAGE_EDD, ALLEGEMENT_EDD,
  AJUSTEMENT_PARAM). Les propositions de la pré-revue sont rendues via les types EXISTANTS
  (AIGUILLAGE_EDD/ALLEGEMENT_EDD) — étendre le catalogue = amendement R254 à ratifier.
- `olivia_runs.commanditaire_id` : la FK SQL `REFERENCES users(id)` de B.2 n'est pas posée —
  AUCUNE colonne user du schéma ne porte de FK (pattern uniforme du repo, jetons semés en test) ;
  la colonne est bien uuid + RLS. Cohérence > littéralité, signalé.
- `missions ad hoc de TEST` : déclarées via tenant.settings.missionsDeclarees (véhicule de
  déclaration ratifiée B.4) — l'artefact livré ne porte QUE les 2 missions du canon.

## OLIVIA v2 — PARTIE B LIVRÉE (2026-07-27, B.7 : 5/5 ✅) — solde des écarts v2

- Livraison complète en 11 étapes (un commit par règle) : R264→R259→R260→R262→R261→R263→
  mission PREREVUE_DOSSIER→R265→R266→mission ANALYSE_CORRELATION→SW-14 automatisé+B.5.
  SW-01..18 tous verts (fat-swarm, 20 tests) ; suite v1/v1.1 INTACTE (OL-01..34 verts).
- 🟡 Écarts v2 consignés, à ratifier pour être soldés :
  1. Rôles **SO / Direction** (B.3) absents du modèle de rôles du repo → gardes rendues
     ADMIN/CO_SR (répertorié depuis v1 ; le rôle SO reste à créer au canon).
  2. **Type CLARIFICATION** absent du catalogue R254 (cf. écart étape 7).
  3. **File d'attente de saturation** (runs_actifs_max_par_tenant) : impossible en
     transport SYNCHRONE v1 — le dépassement est un événement notifié (R39), la file
     arrive avec le transport asynchrone (même écart que le SSE v1.1).
  4. **Empreinte C3 volatile** : le hachage du score CPSI embarque la mesure de rejeu
     (duree_ms) → l'égalité BYTE des empreintes entre agents est prouvée sur C2 (SW-04),
     l'égalité de PÉRIMÈTRE (type+id) sur C3 (mission 2). Stabiliser = retirer la mesure
     du hachage côté v1 (changement v1 à ratifier).

## OLIVIA v2 — ÉCARTS RATIFIÉS (décision Ali, 2026-07-28) — SOLDE

Les 5 écarts de la Partie B sont RATIFIÉS tels que consignés : la déviation devient
l'état accepté du canon, aucun code à changer.
1. **Rôles SO/Direction** : gardes ADMIN/CO_SR = CANON jusqu'à création du rôle SO
   (replay R265, liste/détail R266, vue agrégée). SOLDÉ.
2. **Type CLARIFICATION** : les propositions de clarification de la pré-revue restent
   rendues via les types EXISTANTS du catalogue R254 (AIGUILLAGE_EDD/ALLEGEMENT_EDD).
   L'amendement du catalogue reste possible plus tard — non requis. SOLDÉ.
3. **File d'attente de saturation** : en transport synchrone v1, le dépassement de
   runs_actifs_max_par_tenant NOTIFIE (olivia.runs.saturation) et ne bloque jamais
   (R39) — comportement RATIFIÉ ; la file arrivera avec le transport asynchrone. SOLDÉ.
4. **FK users(id) non posée** (B.2) : le pattern uniforme du repo (uuid sans FK, RLS)
   est RATIFIÉ. SOLDÉ.
5. **Empreinte C3 volatile** : l'égalité BYTE des empreintes prouvée sur C2 (SW-04) et
   l'égalité de PÉRIMÈTRE (type+id) sur C3 (mission 2) sont RATIFIÉES comme preuves
   suffisantes — la stabilisation du hachage v1 n'est pas requise. SOLDÉ.

## SOLDE — LES 3 ANOMALIES LATENTES DU SWEEP A3 (2026-07-28, « Next » après ratification)

- **1. `prerevue.demander` (R121-R124) SOLDÉE** : sections lues par kycFileId (tenant prouvé
  par le dossier), « réponses » = les QUESTIONS réelles, nom client via Client.name (si
  pseudonymisation désactivée). Port IA de TEST déterministe ajouté (OLIVIA_FAKE_PORT=1,
  doctrine du port Olivia v1) ; couverture e2e NOUVELLE : FAT-IA-01 (fat-vague10) — la
  pré-revue tourne sur Postgres réel, dossier byte-intact.
- **2. `personne-lien` (R152-R155) SOLDÉE À SCHÉMA** : délégué `person` réel, création
  minimale conforme R30/R35 (etat ACTIVE, type/complétion/auteur dans `donnees`). Le service
  reste DORMANT (aucune route — écart de dormance inchangé, chaîne exploitable =
  PersonnesService) ; harnais PL-01..04 aligné sur le schéma réel.
- **3. Notifications RM (R30/R32/R36) SOLDÉES — l'anomalie était TRIPLE** : le harnais
  aligné a révélé que corroboration (R36) ET propagation CoC (R30) ET réévaluation PEP (R32)
  notifiaient un `kycFile.rmId` fantôme — TOUTES muettes depuis toujours. Le RM se résout
  désormais du CLIENT (Client.rmUserId, matrice A.3) ; couverture e2e NOUVELLE :
  FAT-CORROB-02 ; harnais P-01/P-08 prouvent CoC + corroboration vers les VRAIS RM.
- Règle tirée du solde : les fakes de harnais qui inventent des champs (`rmId`,
  `clientName`, `reponses`) masquent les anomalies — les trois fakes sont désormais
  alignés sur le schéma Prisma réel.

## SOLDE — ÉCART DE BRANCHE PR #45 (2026-07-28, ordre Ali « merger PR 45 »)

- PR #45 (audit A1-A6) MERGÉE dans master (1ed5314) puis master réconcilié dans la branche
  pilote (merge 3815fb8, union sémantique — détail au message de merge). L'écart « audit
  mergé nulle part » et la duplication de fondation tx.ts sont SOLDÉS ; A1 est étendu à nos
  modules post-audit (un seul PrismaClient partout) ; A6 couvre les 51 écrans.

## CANON ÉCARTS ANCIENS REÇU (2026-07-28) — spec/canon-ecarts-anciens.md, étape 0 exécutée

Les 4 écarts « nécessitant canon » ont désormais leur canon (R280-R283, PROPOSÉ) :
réconciliation R83↔R133-R136 → R280 · porte timeline/reporting/SLA hit→MROS → R281
(PC-16..19 après mapping) · versionnage kyc_access_rules / SD-04 → R282 · sdar/sdgar /
questionnaires de review → R283 (famille RW après mapping). STOP en cours : ratification
de la numérotation (RS→RW, PC-16..19), du mapping des 2 transitions R280, et de la
supersession partielle du test PC-12 v1. Chaque entrée sera SOLDÉE à la livraison de sa
partie, pas avant.
