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
- **Ce qui est vrai de la spec** : l'écran « Intégrations core » (fallback Avaloq/Temenos/Olympic) correspond à `corebanking` — VERDICT (vague de clôture, §4.b) : il n'y a PAS d'« ordre de fallback » à exposer. Le canon PORT (R167→R169) traite chaque cœur (Avaloq/Temenos/Finnova/ERI) comme une IMPLÉMENTATION d'un contrat unique, PAS comme une chaîne de repli ordonnée — le tenant déclare SON adaptateur, il n'y a pas de cascade. La formulation « fallback » de la maquette est un abus de langage (la maquette cède au canon PORT). Écart RÉSOLU, plus aucun « à vérifier ».
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

## SOLDE — RÉCONCILIATION R83↔R133-R136 (2026-07-28, partie 1 du canon écarts anciens LIVRÉE)

- **R280 LIVRÉ (UC-01..03 verts)** : la machine R133-R136 (produit) est LA canonique ; le
  modèle R83 du moteur s'y mappe via la table RATIFIÉE (5 états 1:1 + 2 deltas consignés :
  resserrement CLARIFICATION→CLOTUREE, extension ESCALADEE→CLOTUREE post-MROS). UC-02 est le
  test de conformité permanent (un orphelin = rouge) ; UC-01 = porte d'entrée case_proposal →
  NOUVELLE, référencée, idempotente ; UC-03 = un seul jeu de transitions. Moteur Python et
  routes R133-R136 INTOUCHÉS (Python 18/18). L'écart « double canon en sursis » est SOLDÉ.

## SOLDE — TIMELINE & SLA HIT→MROS VIA LA PORTE (2026-07-28, partie 2 du canon écarts anciens LIVRÉE)

- **R281 LIVRÉ (PC-16..19 verts)** : contrat d'enveloppe **1.1** (la 1.0 reste servie — PC-17 ;
  commande 1.1 en enveloppe 1.0 = erreur TYPÉE version) ; noms canon `timeline_client` /
  `reporting_volumetrie` = ALIAS des commandes livrées (ratifié — zéro duplication) ;
  `reporting_sla` NEUVE : t0 par rejeu CPSI (bridge), t1/t2 assemblés des journaux Nest
  riskcases/MROS — AUCUNE table SLA matérialisée, l'absence de maillon est une DONNÉE
  (« en attente MROS : N jours ») ; seuils tenant slaHitEscaladeJours/slaEscaladeMrosJours,
  tick idempotent qui NOTIFIE (R39). **PC-12 v1 AMENDÉ comme ratifié** (invariant conservé :
  zéro écriture riskcases via la porte) ; PC-01..03 re-passent en 1.1. Front : onglet
  Reporting du workspace rend la chaîne (AW-04 re-passé via PC-16). L'écart « porte de
  lecture riskcases / délai hit→MROS » est SOLDÉ.

## SOLDE — SD-04 / VERSIONNAGE kyc_access_rules (2026-07-28, partie 3 du canon écarts anciens LIVRÉE)

- **R282 LIVRÉ (VD-01..04 verts) — SD-04 LEVÉ** : `kyc_access_rules` versionnée à date
  (effective_from/effective_to, index partiel « une version en vigueur par question×rôle »,
  versions closes IMMUABLES par trigger SQL). Double règle de lecture : SÉCURITÉ = matrice
  COURANTE (jamais grandfathérée — HIDDEN immédiat sur tous les dossiers, portée « matrice »
  livrée sur PATCH access) ; COMPLÉTUDE = matrice À LA CRÉATION du dossier (R29 — REQUIRED
  ajouté n'atteint que les dossiers nés après sa date d'effet ; le refus de validation LISTE
  les contributions manquantes). Un dossier NAÎT sous la matrice courante (héritage à la
  création : gabarit ⊕ règles en vigueur, la plus récente fait foi). Lecture d'époque
  `?asOf=` (VD-03) ; événement kyc.access.modifie ÉTENDU (dateEffet, portée, dossiersTouches
  — VD-04, change tracker SD-01). Résolution PAR DATES, aucun champ version sur les dossiers.

## SOLDE — SDAR/SDGAR / QUESTIONNAIRES DE REVIEW (2026-07-28, partie 4 du canon écarts anciens LIVRÉE)

- **R283 LIVRÉ (RW-01..05 verts) — l'écart « sdar/sdgar reportés » est SOLDÉ** : la review
  N'A PAS son propre questionnaire — elle SÉLECTIONNE dans le KYC. `reviewProfiles` est un
  paramètre du registre R-Q (typé json, motivé, append-only — versionné comme toute règle) :
  profils {AR|GAR} × {SDD|CDD|EDD} = {sections actives, questions REQUISES ajoutées, sections
  en re-confirmation simple}. Lancer une review (`POST /v1/reviews/deadlines/:id/lancer`) crée
  LE KYC Rn+1 (R275) chaîné SANS clôture, FILTRÉ par le profil en vigueur — profil FIGÉ dans
  l'événement `review.lancee` (grandfathering R29, RW-03) ; niveau = celui de l'échéance (figé
  R272, le recalcul RV-03 reste LA voie de changement). Les REQUISES passent par la matrice
  R282 (les rôles éditeurs deviennent REQUIRED sur le dossier — AUCUNE matrice parallèle) ;
  les visas suivent les sections retenues (R15). Re-confirmation : « Confirmer » = LE visa de
  la section signé + événement tracé ; « Signaler un changement » ouvre LE CoC R276 (CC-01)
  qui suit son cycle — branchements tardifs KycModule/CocModule → ReviewsService (pas de cycle
  de modules). AUCUNE table parallèle (vérifié par RW-01 : `pg_tables LIKE 'review%'` =
  `review_deadlines` seule). RW-05 : chaîne complète lancer → instruire → valider → échéance
  REALISEE + suivante PLANIFIEE depuis le Rn+1 (RV-07 re-traversé). Front : `sdar`/`sdgar` =
  écrans de SÉLECTION sur le composant de grille commun extrait de `sdkyc` (`GrilleMatrice` —
  un composant, trois configurations, RW-04 vérifié à l'import et par MSW : la SEULE écriture
  est `POST /v1/parametres/valeur/reviewProfiles`, jamais `kyc_access_rules`). Gabarit servi
  par `GET /v1/reviews/profils` (source unique `kyc.templates`, jamais recopié front).
  Référence croisée : spec/canon-ecarts-anciens.md partie 4 · tests
  apps/api/test/e2e/fat-canon-anciens.e2e-spec.ts (Partie 4) + apps/web screens.test.tsx FE-RW.

## BILAN CANON ÉCARTS ANCIENS (R280-R283) — LES 4 PARTIES LIVRÉES, LES 4 ÉCARTS SOLDÉS

- R280 → écart « double machine risk cases » soldé (UC-01..03) · R281 → écart « porte de
  lecture riskcases / délai hit→MROS » soldé (PC-16..19, AW-04 re-passé) · R282 → écart
  « versionnage kyc_access_rules » soldé, SD-04 levé (VD-01..04) · R283 → écart « sdar/sdgar
  reportés » soldé (RW-01..05, RW-05 en chaîne avec RV-07). Livrable : branche pilote unique
  PR #46 (arbitrage ratifié — « rester sur PR #46 » — en lieu des 4 PRs du canon).

## RATIFICATION POST-LIVRAISON (2026-07-28, Ali) — canon écarts anciens

- Livraison des 4 parties RATIFIÉE. Dépendance partie 4 → R276 : lecture « satisfaite en
  substance sur la branche unique #46 » ratifiée (chaîne prouvée par RW-02, CoC OUVERT).
- Mapping R280 : visa humain d'Ali CONFIRMÉ — consigné au canon comme décision non
  délégable ; toute évolution future du mapping moteur↔produit remonte pour visa
  (voir spec/canon-ecarts-anciens.md, « Ratification post-livraison »).

## CANON REÇU (2026-07-28) — LES 2 DERNIERS ÉCARTS ONT LEUR CANON (R284-R287, RATIFIÉ)

- Les deux écarts ouverts « nécessitant canon » sont désormais couverts par
  spec/canon-so-et-transport-async.md : **rôle SO** → R284 (famille SO-01..06 après
  mapping ratifié AU→SO — AU pris par l'IAM R89/R90) · **transport asynchrone
  (outbox/file/SSE)** → R285-R287 (famille AS libre). Étape 0 exécutée sur le repo
  réel : relais d'outbox existant et unique (rien à rabattre ; 2 violations latentes à
  corriger : payload complet dans le corps webhook, catch silencieux du relais) ; SSE
  inexistant (création) ; rôle SO absent de l'enum (ratification = migration additive).
  Livrable : branche unique PR #46 (précédent ratifié). SOLDE de chaque écart à la fin
  de sa partie, pas avant.

## SOLDE — TRANSPORT ASYNCHRONE (2026-07-28, R285-R287 LIVRÉS, AS-01..08 verts)

- **L'écart « transport asynchrone (SSE + file de saturation) » est SOLDÉ.** R285 : le relais
  d'outbox est L'UNIQUE voie d'émission (revue de code automatisée AS-01) et le message de
  transport porte des RÉFÉRENCES seules (les 2 violations latentes corrigées : payload complet
  du corps webhook, catch silencieux du tick). R286 : watermarks persistés par consommateur
  (naissance AU PRÉSENT), retry + backoff bornés par le registre R-Q (retry_max,
  backoff_base_s, dead_letter_alerte_seuil), dead-letters TRACÉES et visibles (T9 étendu :
  GET /v1/events/sante), rejeu manuel tracé qui/quand, consommateur worker-riskcases par la
  porte canonique UC-01 (miroir outbox émis dans la transaction d'emettreCaseProposals),
  ordre par agrégat sans supposition croisée. R287 : hub SSE descente seule
  (GET /v1/events/stream), rattrapage par le journal (Last-Event-ID), scope figé à
  l'abonnement en default-deny (OL-34), pilote live compteurs Home (lib/flux.ts, idempotence
  client par seq) ; OL-31 re-passé. Référence croisée : spec/canon-so-et-transport-async.md
  partie 2 · apps/api/test/e2e/fat-canon-derniers.e2e-spec.ts · screens.test.tsx FE-AS.

## SOLDE — RÔLE SO (2026-07-28, R284 LIVRÉ, SO-01..06 verts) — LE DERNIER ÉCART EST SOLDÉ

- **L'écart « rôle SO à ratifier » (spec Home codée ADMIN, `roles_motif_sensible` sans SO) est
  SOLDÉ.** SO entre à l'enum (migration additive) comme rôle d'AUDIT : la tension HO-06 ↔ R270
  se résout par DEUX surfaces — opérationnelle (aucun accès : accueil = T3/T9, HO-06 re-passé
  tel quel) et d'audit (lecture intégrale : trail à date, conversations/runs Olivia + replay,
  journal CPSI, motifs sensibles R270 — policy SQL RESTRICTIVE au défaut étendu CO_SR,MLRO,SO,
  OF-07/OF-08 re-passés). Garde STRUCTURELLE unique dans le TenantMiddleware (avant routage) :
  tout non-GET refuse typé SO_SURFACE_AUDIT hors les DEUX exceptions fermées (STOP de run R267,
  POST /v1/audit/export tracé) ; SO jamais un regard du four-eyes ni d'aucune décision (SO-03,
  un test par type). « L'auditeur est audité » : consultation sensible ⇒ AUDIT_ACCESS
  append-only (qui/quoi/quand), servi à la Direction et à SO (GET /v1/audit/acces) — suppression
  impossible (trigger). Cumul SO+ADMIN refusé par le backend (cumul_so_admin_interdit, défaut
  vrai au registre R-Q) ; assoupli = accepté ET tracé (iam.cumul_so_admin.autorise). Le
  cloisonnement reste étanche : la réponse réseau du CO est identique avant/après consultation
  SO (SO-06). Référence croisée : spec/canon-so-et-transport-async.md partie 1 ·
  fat-canon-derniers.e2e-spec.ts (SO-01..06).

## BILAN CANON SO + TRANSPORT (R284-R287) — LES 2 DERNIERS ÉCARTS SOLDÉS

- R285-R287 → transport asynchrone soldé (AS-01..08, OL-31 re-passé) · R284 → rôle SO soldé
  (SO-01..06, HO-06/OF-07/OF-08 re-passés). Registre des écarts : PLUS AUCUN écart ouvert
  nécessitant canon. Livrable : branche unique PR #46 (arbitrage ratifié), deux séquences de
  commits (transport dbb0cad/581f548/ccd7508, puis SO).

## SOLDE — BARÈMES DE SCORING KYC (2026-07-28, R288 RATIFIÉ ET LIVRÉ, BS-07..09 verts)

- **L'écart « barèmes computeRisk codés en dur, non gouvernés » (reconnaissance sbbrm) est
  SOLDÉ.** R288 : clé R-Q `kycScoringBareme` versionnée par date d'effet (pattern
  workloadBareme, défaut [] = barème historique du moteur — zéro changement de comportement) ;
  `computeRisk` reste PUR, le barème s'injecte (`baremeEnVigueur` résout PAR DATES — rien de
  recopié sur les dossiers) ; un dossier garde à vie le score du barème de SA création (R29,
  BS-07 — la trace mentionne la date d'effet du barème gouverné) ; le bac sbbrm RE-SCORE sous
  barème hypothétique par LE moteur (intrants re-dérivés de la trace stockée kyc.created —
  nominatif, scoreAvant→scoreApres, zéro écriture, BS-08 ; contrat BS-04 conservé) ; le barème
  d'époque se rejoue par le registre (R127, BS-09). La brique configuration & paramétrage n'a
  PLUS de trou documenté : configurer (gouverné), simuler (5 bacs, leviers complets), rejouer
  (à date). Référence : spec/proposition-R288-baremes-scoring.md · fat-canon-derniers (BS-07..09).

## SOLDE — TRIAGE ÉCRANS HTML (2026-07-28, canon RATIFIÉ : R289 + volet IAM partiel LIVRÉS)

- **R289 Command Center LIVRÉ (DC-01..05 verts, Vitest)** : 54e onglet, projection Direction
  (DIR), patron de Tuile PARTAGÉ avec Home (extrait vers components/). v1 = les 7 tuiles aux
  sources vérifiées (étape 0.c). ÉCARTS CONSIGNÉS (extensions à ratifier, jamais des endpoints
  inventés) : (1) tuile « Charge compliance » — aucun agrégat visas/tâches par rôle ratifié ;
  (2) dead-letters au Command Center — GET /v1/events/sante est T9 = ADMIN/SO, servir DIR =
  étendre la matrice ratifiée. Nouvelle clé R-Q `command_seuils` (colore, ne bloque jamais).
- **paramnav + iamguide LIVRÉS (IM-02, IM-05 verts, e2e + Vitest)** : garde backend
  IAM_DERNIER_ADMIN (signalée 0.d) ; refus rendus tels quels ; route lecture seule
  GET /v1/admin/iam/guide (signalée 0.d) ; export daté. **ssoparam DIFFÉRÉ** (décision Ali) —
  4 endpoints d'extension MOD-30 restent à ratifier : config OIDC écrite, dry-run connexion
  tracé, rotation JWKS commandée, bascule de mode four-eyes à date (IM-01/03/04 en attente).
- **Catégorie B acté sur INVENTAIRE** (maquette olive-demo.html ABSENTE du repo — à fournir
  pour le diff sur pièce) ; **catégorie C** : gel SWIFT/Legal/BI confirmé ; **Octopulse non
  trié** (définition d'Ali requise). Référence : spec/canon-ecrans-html-triage.md.

## SOLDE — R290/R291 (2026-07-28, ratifiés et LIVRÉS le jour même)

- **R290 — ssoparam DÉBLOQUÉ (IM-01/03/04 verts)** : l'écart « 4 endpoints MOD-30
  manquants » est SOLDÉ. Clés R-Q ssoOidc/sso_mode/sso_bascule_coupe_sessions ; état SSO
  sans jamais un secret (booléen « configuré ») ; test dry-run tracé ; rotation JWKS
  commandée motivée (grâce structurelle) ; bascule de mode four-eyes à date PAR le
  registre (aujourd'hui jwt, à J+2 sso — R127 le restitue). Écran ssoparam = 57e onglet.
  IM-01..05 : les 5 scénarios IAM du canon triage sont TOUS verts. Écart restant consigné :
  le login OIDC effectif lit l'environnement (résolution per-tenant = extension future).
- **R291 — Command Center COMPLET (DC-06/07 verts)** : l'agrégat /v1/kyc/visas/charge
  (DIR/CO_SR) sert la tuile « Charge compliance » ; la matrice T9 s'étend à DIR en LECTURE
  (le rejeu reste ADMIN/SO — piloter n'est pas opérer) et les dead-letters entrent dans
  « Santé plateforme ». DC-01..07 : les 7 scénarios Command Center sont TOUS verts —
  plus aucune tuile amputée. Référence : spec/proposition-R290-R291-extensions.md.

## SOLDE — SÉQUENCE 4 TRIAGE FINAL : CROSS-BORDER R293-R295 (2026-07-28, XB-01..05 verts)

- **R293 — le country manual = la clé EXISTANTE `tripCrossBorderReferentiel` ENRICHIE**
  (source, licence, dateAvis), JAMAIS un second référentiel — la collision détectée à
  l'étape 0 (le canon parlait d'un « nouveau » manual, R223 en portait déjà un) se résout
  par enrichissement, ratifié. O-Live STRUCTURE la position de la banque (référence du mémo
  juridique) — l'INTERDIT « avis juridique généré » est tenu : aucun texte d'avis produit.
  Juridiction absente = NON DÉTERMINÉ (default-deny R169) ; versionné par depuisLe, rejoué
  des deux côtés de la date (XB-01/02).
- **R294 — UN moteur (`evaluerXb` pur), DEUX surfaces** : check pré-voyage (contexte
  voyageId) et check à la relation (contexte kycCode) — verdicts IDENTIQUES prouvés sur
  3 juridictions (XB-05). Le résultat est un ÉVÉNEMENT (entrée + version du manual +
  verdict) ; conformité DÉRIVÉE du journal, rien de bloqué (R39), dérogation motivée +
  visa d'un second (R13) — XB-03. État dérivé des événements, AUCUNE table nouvelle.
- **R295 — reverse solicitation documentée ou refusée** : pays restreint sans qualification
  « à l'initiative du client » → 422 XB_QUALIFICATION_REQUISE ; preuve GED obligatoire en
  EDD ou si `preuve_reverse_solicitation=preuve` → 422 XB_PREUVE_REQUISE ; reporting par
  pays MESURE (XB-04). Écran `crossborder` = 63e onglet (manual rendu, check servi,
  dérogations, reporting — FE-XB verts, rien de calculé au front).
- **ÉCARTS CONSIGNÉS** : (1) le canon donnait le visa de dérogation à LEGAL — rôle ABSENT
  du RBAC tenant ; mappé sur la clé R-Q `visa_derogation_xb` (défaut DIR), un tenant avec
  un rôle Legal l'y postera ; (2) le canon voulait une « section 10 » au gabarit KYC — les
  SECTIONS_BY_WORKFLOW sont un paramètre gouverné (R30) : le check à la relation vit comme
  ÉVÉNEMENT rattaché au dossier (contexte kycCode), pas comme section de gabarit imposée ;
  (3) l'`avisA` interne des trips (R223) reste l'avis ratifié du module voyage — le manual
  ne le remplace pas, les deux lisent la MÊME clé ; (4) hygiène de test : watermark posé
  « au présent » (R286) au beforeAll de fat-swarm — le backlog inter-suites polluait la
  photo SW-14 (fuite d'ordonnancement jest, pas un bug produit).
  Référence : spec/canon-triage-final-nav-oidc-conformite.md (séquence 4).

## SOLDE — SÉQUENCE 5 TRIAGE FINAL : R296 LOGIN DEUX TEMPS (2026-07-28, LG-01..05 verts)

- **Temps 1 — la méthode se résout par DOMAINE** : POST /v1/auth/methode {email} → LOCAL ou
  SSO+redirect. Nouvelle clé R-Q `loginDomaines` (domaines du tenant). Un domaine INCONNU
  répond la MÊME forme que LOCAL (indistinguable, pattern OL-34) — jamais une existence
  révélée (LG-01). La méthode suit `sso_mode` EN VIGUEUR : la bascule four-eyes à date de
  R290 s'applique au login SANS autre câblage — IM-04 re-passé bout en bout (LG-03).
- **Temps 2 — le login RÉSOLVANT** : POST /v1/auth/login — le tenant n'est JAMAIS envoyé
  par le client. Échec GÉNÉRIQUE byte-identique (domaine inconnu / user inconnu / mauvais
  mdp), leurre scrypt sur tous les chemins (LG-02).
- **AUCUN repli silencieux** : tenant SSO → mot de passe refusé TYPÉ (SSO_REQUIS), même
  correct ; IdP non déclaré/joignable → SSO_IDP_INDISPONIBLE (503 typée). Clé R-Q
  `sso_fallback_local` défaut FAUX (LG-04).
- **Break-glass** : clé R-Q `breakGlassComptes` — login local possible en mode SSO, MFA
  OBLIGATOIRE (compte non enrôlé = refus générique), usage AUDITÉ (BREAK_GLASS_LOGIN) +
  notifié SO/DIR par événement (LG-05).
- **ÉCARTS CONSIGNÉS** : (1) le test de timing est SMOKE (écart max < 1,5 s entre les trois
  échecs — généreux, consigné : un test statistique fin serait flaky en CI) ; (2) le
  four-eyes du CHANGEMENT de `sso_fallback_local` est différé v1 — le défaut est faux et
  toute écriture registre est motivée/versionnée (R7/R126), l'extension à deux regards
  suivra le patron IM-04 ; (3) le PORTAIL de login front est HORS périmètre du
  tab-switcher de démonstration (pas d'écran de login dans le shell actuel) — le contrat
  API est livré et testé, l'écran suivra le shell définitif ; (4) BUG PRÉEXISTANT corrigé :
  l'allowlist publique du TenantMiddleware testait `req.path` qui vaut « / » en middleware
  monté — elle ne matchait JAMAIS (aucun e2e ne couvrait /v1/auth/token) ; corrigée par
  `originalUrl` (même constat que garderSO), TM-07 harnais conservé (req.path en repli).
  Référence : spec/canon-triage-final-nav-oidc-conformite.md (séquence 5).

## SOLDE — SÉQUENCE 6 TRIAGE FINAL : PASSE DE CONFORMITÉ VISUELLE (2026-07-28)

- **docs/CONFORMITE-VISUELLE.md créé** : grille 5 colonnes (nav & libellés I18N 4 langues /
  structure / tokens palette olive / états HO-04-LC-01 / données servies) passée SUR PIÈCE
  (demo/olive-demo.html) sur les 12 écrans livrés + 4 écarts globaux de shell. Hiérarchie
  canon > maquette > goût ; chaque écart est une ligne, AUCUNE correction sans ligne.
- **5 corrections de libellés appliquées** (chacune = sa ligne de grille) : AML Investigation
  (AW-L1, canon P1 + maquette concordent), Dashboard central, Prochaines actions,
  Corroboration KYC, Cross-Border. 1 libellé refusé motivé (NV-L6 : « Pièces (GED) »
  distingue pièces/coffre que la maquette fusionne).
- **Consignés sans correction** : shell tab-switcher plat vs sidebar groupée (chantier shell,
  gelé) ; i18n 4 langues (aucune règle R ne ratifie la localisation — canon à écrire) ;
  accents de palette par module (évolution tokens.ts, pas une retouche par écran) ;
  sélecteur de persona maquette REFUSÉ (R89 : le rôle vient du jeton — le canon prime).
- **.github/pull_request_template.md créé** : la grille devient un CRITÈRE D'ACCEPTATION
  de chaque PR (ligne de grille obligatoire pour tout écran nouveau/modifié, interdit de
  donnée de maquette migrée, frontière de vérification complète).
  Référence : spec/canon-triage-final-nav-oidc-conformite.md (séquence 6). LE CANON TRIAGE
  FINAL EST SOLDÉ : DC-08/09, SO-07/08, XB-01..05, LG-01..05 tous verts + grille livrée.

## SOLDE — DÉGEL VAGUE 1 : FLUX / TXRISK / FX / SWIFT (2026-07-28, TF-01..12 verts)

- **R297 [canon R294]** : table `transactions` append-only (trigger + RLS), alimentée
  par le port core banking seul — refus gracieux typé sans port, fixture en TEST
  uniquement (TXFLUX_FAKE_PORT), idempotence (source, ref_externe), rattachement par
  coreMapping (R169), enrichissement tracé (IBAN → pays, hash jamais l'IBAN).
- **R298 [canon R295]** : txrisk = SURFACE — agrège le journal en attributs R79
  (tx_par_mois, volume_tx_mensuel_chf, rapidite_in_out, ratio_cross_border,
  wires_third_party) et les pousse au moteur ; le scénario vit au catalogue CPSI et
  détecte via le moteur (TF-04, revue d'architecture automatisée : aucune comparaison
  dans le module) ; live SSE par références (TF-05) ; tendances rejouées à date (TF-06).
- **R299 [canon R296]** : GET /v1/fx/exposition — aucune route d'écriture ; sans port FX,
  devise d'origine + mention (jamais un taux inventé) ; `fx_seuils_exposition` notifie
  (fx.seuil.franchi), rien bloqué.
- **R300 [canon R297]** : labo SWIFT — parserSwift déterministe (MT103/MT202/pacs.008 via
  `swift_types_actifs`), extraction rattachée par :20 ↔ ref_externe, hors bibliothèque /
  non parsable = quarantaine motivée visible ; ZÉRO route d'émission (TF-11 vérifie le
  routeur vivant via /v1/apidoc) ; champs sensibles → wires_third_party (TF-12, formule
  française du registre R79 servie par le catalogue).
- **ÉCARTS CONSIGNÉS** : (1) le rafraîchissement des attributs d'un client DÉJÀ enregistré
  au moteur CPSI est une extension à ratifier (événement moteur nouveau) — compté
  `dejaEnregistres`, jamais silencieux ; (2) ATTR_DEFS (engine.py) est INTOUCHABLE : la
  vague n'ajoute AUCUN attribut nouveau — elle NOURRIT des attributs déjà déclarés
  (wires_third_party, rapidite_in_out…) ; un attribut réellement nouveau se déclarerait
  dans bridge.py (hors zone intouchable), à ratifier le moment venu ; (3) le port FX réel
  et la conversion sont branchables sans changer le contrat (interface `taux` livrée,
  aucun taux par défaut) ; (4) pacs.008 : extraction minimale (MsgId) — l'extension des
  champs MX suit la demande, la quarantaine couvre le reste.
  3 écrans : txrisk, fx, swiftlab (66 onglets) — lignes de grille ajoutées.
  Référence : spec/canon-degel-complet-vagues-1-9.md (vague 1).

## SOLDE — DÉGEL VAGUE 2 : CUSTODY & TRANSFER AGENT (2026-07-28, CY-01..06 verts)

- **R301 [canon R298]** : positions custody = PORT (lues, jamais recopiées) ; refus
  gracieux sans port, fixture TEST (CUSTODY_FAKE_PORT). **R302 [canon R299]** : le registre
  nominatif = JOURNAL d'événements (souscription/transfert/nantissement/radiation) —
  l'état à toute date se REJOUE (CY-02) ; correction = contre-passation motivée (R7),
  l'UPDATE direct du journal lève (trigger) ; visas PAR TYPE (`ta_visas_par_type`),
  initiateur exclu (R13), un mouvement non visé n'est PAS au registre (CY-06).
  **R303 [canon R300]** : rapprochement = TOUS les écarts (R269), 3 types, chacun avec sa
  VOIE ; résolution = événement motivé, le traité sort de la liste mais reste COMPTÉ.
- **ÉCARTS CONSIGNÉS** : (1) livraison en UN commit pour les 3 règles — le spec-file CY
  entrelace les surfaces (CY-01 teste port ET registre) ; les règles restent tracées une à
  une dans les en-têtes de modules ; (2) le rapprochement agrège le registre PAR TITRE
  (somme des titulaires) — le rapprochement par titulaire exige la position nominative du
  dépositaire, hors contrat du port v1 (extension à ratifier avec un port réel) ;
  (3) le NANTISSEMENT grève sans déplacer (quantité nette inchangée) — la projection des
  gages est une lecture à ajouter à la demande ; (4) tokenisation HORS bloc (canon).
  Écran custodyta (67e onglet) — ligne de grille ajoutée.
  Référence : spec/canon-degel-complet-vagues-1-9.md (vague 2).

## SOLDE — DÉGEL VAGUE 3 : LE BUILDER (2026-07-28, GO Ali, WB-01..10 verts)

- **R304** : builder_artefacts (brouillons) + builder_versions (gravées, append-only,
  datées) — WB-01. **R306** : cohérence backend, 7 familles de refus listées d'un coup
  (WB-04). **R305** : verrou bac structurel (empreinte SHA du contenu simulé ; re-modifier
  invalide), rapport d'impact au principe SB-03 JOINT à la version et à l'événement
  (WB-03/10). **R307** : four-eyes (auteur ≠ publicateur), clé `roles_publication_builder`
  (WB-05). **R308** : matérialisation vers les MOTEURS RATIFIÉS — workflow → atelier
  R171-173 (résolu par date, dossier validé bout en bout sur le moteur R1-R51, WB-06) ;
  section → gabarit à la création (grandfathering R29 par construction, matrice R282
  maîtresse, WB-02/07) ; questionnaire → reviewProfiles (R283, voie R-Q). WB-08 : revue
  d'architecture automatisée (zéro interpréteur). WB-09 : le brouillon d'auteur-agent ne
  se publie JAMAIS lui-même (R13 structurel) — la chaîne humaine publie.
- **ÉCARTS CONSIGNÉS** : (1) plan 6 commits → livré en 3 (la chaîne de publication est UN
  acte ; découper aurait laissé un « publier » sans garde) ; (2) le canal de proposition
  Olivia (TYPES/CIBLES B.7) est un registre ratifié FERMÉ — y ajouter ARTEFACT_BUILDER est
  une extension du canon Olivia à ratifier ; WB-09 est couvert structurellement en
  attendant (auteur-agent tracé, publication humaine exigée) ; (3) le timbre HTTP de la
  chaîne KYC↔Workflow n'est pas exposé (état préexistant, harnais KW le couvre) — WB-06
  prouve la résolution atelier + l'exécution moteur ; (4) `OliveError.refus` ajouté au
  client front (les listes R269/R306 voyagent entières — rétro-compatible) ;
  (5) GET /v1/builder/publications ajouté à la surface SO (l'acte de publication est un
  JOURNAL — cohérent R284). Écran builder (68e onglet). 
  Référence : spec/canon-degel-complet-vagues-1-9.md (vague 3).

## SOLDE — DÉGEL VAGUE 4 : REGWATCH (2026-07-28, VR-01..05 verts)

- **R309** : sources = ports (`regwatch_sources`, credentials au coffre) — l'éteint est
  AFFICHÉ, la collecte vit ; item = événement dédupliqué par empreinte, fetch tracé.
- **R310** : qualification HUMAINE motivée (R7) ; Olivia PROPOSE — citation d'un Rn
  INEXISTANT refusée 422 (R257, jamais une référence inventée) ; l'item reste NON_TRAITE
  jusqu'à la décision humaine, la filiation IA→humain est tracée (surProposition).
- **R311** : PERTINENT exige les Rn impactés + ouvre la tâche d'analyse (événement) ;
  VR-05 vérifie par revue automatisée que le module n'écrit JAMAIS une règle (aucun
  ecrire/PATCH/PUT/DELETE) — la voie normale (amendement/R68/bac) fait le changement.
- **ÉCARTS CONSIGNÉS** : (1) la tâche d'analyse est un ÉVÉNEMENT (pattern
  tache.core.resolution R169) — le rattachement au module Tasks (T3) est une extension
  d'affichage à brancher ; (2) la proposition arrive par une route regwatch dédiée — même
  consigne que WB-09 : l'entrée au canal Olivia B.7 (TYPES fermés) est une extension à
  ratifier ; (3) le digest est servi + notifié par événement — la planification (cron)
  suivra l'infra (dette §5) ; (4) RN_MAX=323 est une constante de validation — le
  catalogue vivant la fait évoluer par amendement. Écran veille (69e onglet).
  Référence : spec/canon-degel-complet-vagues-1-9.md (vague 4).

## SOLDE — DÉGEL VAGUE 5 : LEGAL (2026-07-28, LE-01..04 verts)

- **R312** : le registre vit SUR LA GED — création refusée sans documentId réel du tenant
  (LE-01) ; rattachements client/juridiction/fournisseur ; la boucle cross-border est
  FERMÉE dans les deux sens : la source du country manual (R293) ouvre le mémo par
  référence, la juridiction liste ses mémos (LE-03) ; la version de la pièce se résout À
  DATE (LE-04, R48 — l'évaluation XB antérieure lit la v1, la nouvelle la v2).
- **R313** : échéances = FAITS calculés des dates (COURANT/PREAVIS_OUVERT/EN_RETARD) ;
  tick R274 : tâche + notification au préavis, escalade au dépassement, UNE fois par
  état — rien n'est jamais bloqué (LE-02) ; modification de dates = événement motivé.
- **ÉCARTS CONSIGNÉS** : (1) état dérivé des événements (aucune table legal) — pattern
  XB/TA ; (2) le tick est manuel/apicallable — la planification suit l'infra (dette §5,
  même consigne que regwatch) ; (3) le lien cliquable manual→mémo DANS l'écran
  cross-border est un enrichissement d'écran à venir — l'API bidirectionnelle est livrée
  et testée ; (4) typeCode MEMO_LEGAL/CONTRAT non déclarés à gedDocTypes par défaut — le
  tenant les déclare (R110), le registre ne les impose pas. Écran legalreg (70e onglet).
  Référence : spec/canon-degel-complet-vagues-1-9.md (vague 5).

## SOLDE — DÉGEL VAGUE 6 : BI LIBRE (2026-07-28, BL-01..04 verts)

- **R314** : les vues sont des PROJECTIONS déclarées (vues-bi.json — LA même vérité pour
  le runtime ET le vérificateur CI scripts/verifier-vues-bi.js, câblé dans ci.yml : une
  source hors projections autorisées = build rouge, pattern R264). Requête hors liste /
  dimension non déclarée → refus typé (BL-01). ZÉRO SQL libre : Prisma typé + agrégation
  mémoire, aucun raw, aucune écriture — revue automatisée BL-04.
- **R315** : le scope s'applique AUX PROJECTIONS (RM = ses clients, backend — BL-02) ;
  export ≥ `bi_seuil_export` = AUDIT_ACCESS (qui, quelle requête, combien) notifié SO,
  l'export reste SERVI (BL-03, R39).
- **ÉCARTS CONSIGNÉS** : (1) 3 vues au départ (clients/kyc/transactions) — chaque ajout
  passe par vues-bi.json + le vérificateur (jamais un ajout silencieux) ; (2) l'agrégation
  est en mémoire (volumes pilote) — la matérialisation SQL (vraies vues projetées) suivra
  la stratégie de migration expand/contract (dette §8) SANS changer le contrat ;
  (3) l'annuaire est servi par POST (client sans GET-avec-corps) — lecture pure malgré le
  verbe, couvert par BL-04. Écran bi (71e onglet).
  Référence : spec/canon-degel-complet-vagues-1-9.md (vague 6).

## SOLDE — DÉGEL VAGUE 7 : MOBILE BANKING (2026-07-28, MB-01..05 verts — plan visé, GO Ali)

- **R316** : population IAM DISTINCTE — table `mobile_identites` SANS colonne de rôle
  (MB-01 est une impossibilité de schéma, prouvée par information_schema) ; DEUX portes
  étanches dans les deux sens (mobile.gate exige `pop=MOBILE` sans rôle ; la porte
  interne rejette tout `pop`) ; activation par le RM du client + code hors bande (sha256
  stocké, jamais en clair ni en événement — MB-02) ; MFA TOTP OBLIGATOIRE au login.
- **R317** : v1 = LECTURE + MESSAGERIE ; exclusions v1 = routes INEXISTANTES → 404
  naturel, jamais 403 (MB-04, + revue automatisée du source) ; « changer mon adresse »
  = message → le RM ouvre le CoC par la voie R276 réelle (CC-01 rejoué, MB-05).
- **R318** : QUE le partagé (marquage explicite tracé `mobile.partage.marque`,
  `mobile_partage_defaut` = rien) ; le non-partagé est ABSENT de la RÉPONSE réseau ;
  projection minimale id/nom/date — aucune donnée compliance, pas même l'existence
  (OL-34/R270) ; `mobile_actif` OFF par défaut → toute la surface répond 404.
- **ÉCARTS CONSIGNÉS** : (1) commits A (R316) et B (R317/R318) du plan livrés FUSIONNÉS —
  une porte sans surface n'a pas de preuve e2e (précédent V2/V3) ; (2) l'app cliente
  n'existe pas en v1 (le canon dit « l'app est un rendu ») — l'écran livré est la FACE
  BANQUE (mobileadmin) ; la surface client est l'API `/v1/mobile/client/*` testée e2e ;
  (3) le marquage d'un COMPTE porte son clientId dans le DTO (un compte n'est pas une
  pièce GED — la pièce résout son client, le compte non) ; (4) les positions du compte
  partagé viendront du port custody/PMS quand un port par compte existera — v1 sert les
  références de comptes partagés (R167 : jamais un chiffre inventé). Écran mobileadmin
  (72e onglet).
  Référence : spec/canon-degel-complet-vagues-1-9.md (vague 7).

## SOLDE — DÉGEL VAGUE 8 : CONSOLE ÉDITEUR (2026-07-28, VE-01..03 verts)

- **R319** : EDITOR n'existe pas sur l'instance tenant — TRIPLE preuve permanente (VE-01) :
  l'enum Postgres `Role` est fermé (pg_enum interrogé), la création/le changement de rôle
  refusent TYPÉ (`R319 : rôle inconnu du RBAC tenant`, liste fermée miroir de l'enum —
  jamais un 500), et la revue automatisée du source (users.service, roles.guard, schema)
  est vierge.
- **R320** : la licence descend SIGNÉE et la clé publique fait foi — altération → refus
  net, état en vigueur INTACT (VE-02, LC-02 rejoué) ; signature et expiration sont DEUX
  constats : expirée = état TYPÉ (`expiree: true`), modules inactifs (403 usage), lecture
  d'audit préservée (LC-03 : GET + rôle d'audit passent), AUCUNE donnée coupée ;
  tick d'échéance J-60/J-30/expiration notifié ADMIN/DIR UNE fois par état et par
  échéance (pattern R274) — VE-03 avec une licence qui expire RÉELLEMENT pendant le test.
- **ÉCARTS CONSIGNÉS** : (1) la console vendor elle-même (registre des instances clientes :
  version, modules, échéances, canal) est une INSTANCE SÉPARÉE — hors de ce dépôt par
  construction (R319) ; `VendorLicenseService` (déjà consigné non-branché) reste la graine
  côté éditeur ; (2) AUCUN écran tenant nouveau : l'état licence (dont `expiree` + note)
  est servi par `GET /v1/modules/actifs`, déjà consommé par Home (HO-02/LC-01) — pas
  d'écran, pas de ligne de grille (principe du périmètre) ; (3) le tick est
  manuel/apicallable — la planification suit l'infra (même consigne que legal/regwatch).
  Référence : spec/canon-degel-complet-vagues-1-9.md (vague 8).

## SOLDE — DÉGEL VAGUE 9 : OCTOPULSE OPRISK (2026-07-28, OP-01..05 verts — dégel COMPLET)

- **R321** : incident = DOSSIER tracé (déclaration par tout collaborateur, classification
  OBLIGATOIRE dans `oprisk_taxonomie` — défaut : 7 catégories Bâle niveau 1, default-deny) ;
  DECLARE → EN_ANALYSE → CLOS en liste fermée, clôture motivée R7 (OP-01/02) ; un constat
  SO-07 ouvre un incident RÉFÉRENCÉ (OP-04).
- **R322** : heatmap CALCULÉE (fréquence × sévérité par catégorie), rejouée à date
  byte-identique (OP-03) ; AUCUNE écriture de cellule — négatif structurel (source + base).
- **R323** : plan d'action (owner, échéance, statut) ; retard = FAIT calculé (R274) —
  owner notifié une fois, escalade DIR au-delà de `oprisk_escalade_jours` (défaut 7) ;
  jamais bloquant (OP-05 : l'action en retard se complète).
- **ÉCARTS CONSIGNÉS** : (1) la surface SO (R284, deux exceptions fermées) porte désormais
  une TROISIÈME exception — `POST /v1/oprisk/incidents` — exigée par le canon R321 (SO-07
  → incident) ; fermée à cette route, testée (tout autre POST SO refuse toujours) ;
  (2) AMA quantitatif NON livré — le canon le dit « option à ratifier séparément » ;
  (3) le tick est manuel/apicallable (même consigne que legal/regwatch/licence) ;
  (4) état dérivé des événements, aucune table nouvelle. Écran oprisk (73e onglet).
  Référence : spec/canon-degel-complet-vagues-1-9.md (vague 9).

## POINT D'ÉTAPE FINAL — DÉGEL COMPLET (2026-07-28) + DETTE D'INTÉGRATION §1-3

Les NEUF vagues du canon du dégel (spec/canon-degel-complet-vagues-1-9.md, mapping +3
ratifié) sont livrées, testées et poussées : V1 flux/txrisk/fx/swift (TF-01..12) ·
V2 custody & TA (CY-01..06) · V3 Builder (WB-01..10, GO Ali) · V4 regwatch (VR-01..05) ·
V5 legal (LE-01..04) · V6 BI (BL-01..04) · V7 mobile (MB-01..05, GO Ali) · V8 console
éditeur (VE-01..03) · V9 OpRisk (OP-01..05). Chaque vague porte son solde ci-dessus ;
chaque écran livré a sa ligne de grille (CONFORMITE-VISUELLE.md — 73 onglets).

Dette d'intégration du canon (§1-3, « en parallèle ») — CONSTATS :
- **§1 JWT sur toutes les routes** : DÉJÀ RÉGLÉ — aucun `x-tenant-id` dans apps/api/src
  (grep vide) ; le mode headers ne survit que côté MSW/dev front. Les surfaces nouvelles
  (mobile R316) ont leur porte propre, également JWT (RS256, trousseau JWKS).
- **§2 extinction appel Anthropic navigateur** : DÉJÀ RÉGLÉ — le grep CI B.11.4
  (`! grep -rn "api.anthropic.com" apps/web/src apps/web/index.html`) est l'étape 4 de
  .github/workflows/ci.yml, bloquante.
- **§3 provisionnement Exoscale Zurich** : NON SCRIPTABLE depuis cette session (aucun
  accès au compte cloud) — reste un acte d'infra humain : VMs, Postgres managé, backups
  avec RESTAURATION TESTÉE. Consigné, pas simulé.
Qualité §4-8 et produit §9-11 : hors périmètre de ce point d'étape, inchangés au canon.

## SOLDE — DETTE QUALITÉ §4-§8 + PRODUIT §10 (2026-07-28)

- **§4 perf front** : budget bundle BLOQUANT en CI (verifier-budget-bundle.js — gzip réel :
  total ≤ 220 kB, chunk ≤ 80 kB ; état gravé : 158.9 kB / pire 50.2 kB, 73 onglets lazy).
  La frontière web (vitest + build) entre en CI — elle n'était que locale. Virtualisation/
  mémoïsation : consignées EN ATTENTE de volumes réels (aucune liste > centaines de lignes
  au pilote — optimiser sans jauge serait contraire à la doctrine R250).
- **§6 charge** : livré (fat-charge-cpsi) — mesure canon : 10 001 événements = 159.4 s de
  rejeu, QUADRATIQUE (score_comportemental recalculé à chaque ingestion, profilé cProfile).
  Le moteur est INTOUCHABLE : l'optimisation du rejeu est un chantier à RATIFIER PO —
  la jauge R250 (CPSI_REPLAY_SLOW) notifie en attendant, rien ne bloque (R39).
- **§7 sécurité** : rate limiting login LIVRÉ (RL-01..03) — 429 typé R296 par identifiant,
  jamais un oracle ; portes internes ET mobile. Écarts : seuils constants v1 (8/min login,
  30/min methode) + mémoire d'instance — clé R-Q et store partagé avec l'infra multi-
  instances ; OWASP/pentest = acte humain (hors dépôt) ; rotation secrets : JWKS livré
  (KeyStore.rotate), rotation des secrets d'env = infra §3.
- **§8 migrations** : stratégie expand/contract au RUNBOOK-OPS §8 (trois temps, interdits
  append-only, cas enum/renommage) — opposable à toute migration future.
- **§5 observabilité** : PARTIEL consigné — dead-letters + santé transport + AUDIT_ACCESS
  déjà servis (R284/R286, écran audit) ; logs structurés JSON et alerting sur CANAL RÉEL
  (mail/chat ops) exigent l'infra §3 (Exoscale) — consignés, pas simulés.
- **§10 i18n 4 langues** : NON commencé — écart déjà consigné (G2) : aucune règle R ne
  ratifie la localisation ; les libellés FR livrés SONT les clés du dictionnaire maquette,
  la bascule viendra sans réécriture. Chantier à part entière, canon à écrire (PO).

## SOLDE — DETTE PRODUIT §11 : SEED DÉMO GWB (2026-07-28)

- **§11 livré** : `OLIVE_SEED_DEMO=1 npm run seed:demo` — le tenant démo GWB se sème
  BOUT-EN-BOUT par les VRAIES routes (6 rôles, domaine login R296, 3 clients zod,
  1 dossier KYC servi par le moteur de règles, client CPSI + signal + score jauge R250,
  type CoC + dossier CC-01, incident OpRisk R321) ; preuve comptée en sortie.
- **ÉCARTS CONSIGNÉS** : (1) DEUX actes hors routes assumés — l'INSERT du tenant et le
  jeton ADMIN d'amorçage (création de tenant et premier ADMIN = actes d'ops, aucune route
  par construction) ; (2) gardes : OLIVE_SEED_DEMO=1 obligatoire + refus de double semis —
  jamais une donnée de démo par accident (R167), jamais en production ; (3) la purge de
  recette contourne les triggers append-only (session_replication_role) — documentée
  RUNBOOK §9 et INTERDITE en production : on ne purge pas un journal ; (4) le seed
  s'exécute par la machinerie ts-jest (config jest-seed dédiée, périmètre disjoint de
  l'e2e) — pas de ts-node au dépôt, pas de dépendance ajoutée pour un outil de démo.

## SOLDE — OPTIMISATION DU REJEU MOTEUR (2026-07-28, RATIFIÉE « tout ratifié »)

- **Levée du gel** : la ratification PO couvre l'optimisation du rejeu CPSI que la jauge
  R250 exigeait (constat §6 : 10 001 evts = 159.4 s, quadratique).
- **Livré** : mode `rejeu_leger` OPT-IN du moteur (défaut False — le contrat direct-Python
  PC-01..06 et la suite pytest 18/18 sont inchangés au bit près) ; le PONT seul l'active :
  les recalculs intermédiaires d'hydratation (score_recalcule/bande_franchie/tâches à
  chaque ingestion — journal interne `events`/`taches` qu'AUCUNE requête du pont ne lit)
  sont sautés ; toute lecture reste une fonction PURE de (journal ≤ as_of, config).
- **Preuves** : identité BYTE-À-BYTE prouvée sur les 10 commandes du pont (lourd vs léger,
  journal mixte 302 événements) · pytest 18/18 · e2e 40 suites / 323 tests · harnais 0 ✗ ·
  jauge avant/après : 10 001 evts **159 424 ms → 103.7 ms** (~1 500×, linéaire) ;
  2 501 evts 4 021 ms → 84.9 ms. CPSI_REPLAY_SLOW ne se déclenche plus à 10k (< warn).
- **Écart consigné** : le diff moteur est MINIMAL (un drapeau + un court-circuit de
  `_recalculer`) — aucune règle, aucun barème, aucun arrondi touché ; le mode lourd reste
  le défaut et la seule voie des tests de caractérisation du moteur.

## SOLDE — DETTE PRODUIT §10 : I18N 4 LANGUES (2026-07-28, RATIFIÉE « tout ratifié »)

- **Livré** : `lib/i18n.ts` — le dictionnaire I18N de la maquette recopié VERBATIM
  (FR = clé, EN/DE/IT — zéro traduction inventée) ; sélecteur de langue au shell
  (localStorage OLIVE_LANG, persisté) ; la traduction s'applique en UN point (le helper
  `tab` du routeur) — la promesse G2 « bascule sans réécriture » est tenue. Tests FE-I18N :
  traductions exactes, repli FR, bascule live du shell, persistance.
- **ÉCARTS CONSIGNÉS (écart par clé — la doctrine du chantier)** : (1) les onglets hors
  dictionnaire maquette (écrans canon post-maquette : CPSI · Barèmes, Custody & TA,
  Audit & transport, …) restent FR — chaque clé se comble par un AJOUT au dictionnaire,
  jamais une invention ; (2) les CONTENUS d'écrans (titres internes, colonnes) restent FR —
  même mécanique `t()`, à dérouler écran par écran (chantier continu, comme la grille) ;
  (3) la maquette porte la clé « Octopulse OppRisk » (sic, double p) — l'onglet canon dit
  « Octopulse OpRisk » : repli FR jusqu'à correction de la clé maquette (la maquette cède
  au canon, G-hiérarchie) ; (4) AUCUNE donnée métier n'est traduite — ce qui vient du
  backend s'affiche tel quel (FE-04), la langue est un choix d'affichage.

## SOLDE — CANON « 4 DERNIERS ÉCARTS » PARTIE 1 : R324/R325 DORMANTS (2026-07-29)

- **Étape 0 ratifiée** : canon R321-R324 → dépôt **R324-R327** (R321-R323 pris par
  OpRisk) ; scénarios canon PC-15..20 → **PC-20..PC-25** ; famille LN conservée.
  Spec enregistré : spec/canon-solde-4-ecarts-R324-R327.md.
- **R324/R325 = CONTRAT DORMANT, règle du canon appliquée** : la jauge R250 post-
  rejeu_leger est à **103.7 ms pour 10 001 événements** (seuil 2 000 ms) — « optimisation
  non déclenchée, jauge à 103.7 ms ». Livré : PC-20 PERMANENT (bloc 19 Python, 19/19 —
  équivalence byte-à-byte léger/lourd sur les 10 commandes + rejeu à date, pleine charge
  à la demande CPSI_EQUIV=10000) ; chemin déclaré dans les meta R250 (`chemin:
  "replay_complet"` — seul chemin existant) ; 3 clés R-Q dormantes déclarées
  (snapshot_interval_events, engine_cache_actif, engine_cache_ttl_s).
- **ÉCARTS CONSIGNÉS** : (1) fixture PC-20 permanente à 1 200 evts (le chemin lourd est
  quadratique — c'est la raison d'être du léger) ; (2) l'injection de corruption de
  snapshot (canon) viendra AVEC le snapshot (PC-21..23) — rien à corrompre aujourd'hui ;
  (3) le déclencheur reste la jauge : si cpsi_replay_warn_ms refranchit en réel,
  PC-21..25 s'implémentent selon le contrat figé.

## SOLDE — CANON « 4 DERNIERS ÉCARTS » PARTIE 2 : i18n R326/R327 EN CLIQUET (2026-07-29)

- **R326** : dictionnaire = LA source (lib/i18n.ts, import maquette verbatim, versionné
  par git) ; clé manquante = écart LISTÉ en CI (scripts/rapport-i18n.js — état initial :
  29/72 clés nav traduites, 43 écarts par langue = la liste de travail) ; repli FR PROPRE
  en prod, marqueur ⟦…⟧ en dev (LN-02) ; « une clé sans FR n'existe pas » satisfait par
  construction (la clé EST le FR).
- **LN-01 en CLIQUET (ratifié)** : scripts/verifier-i18n-cliquet.js BLOQUANT en CI — les
  fichiers convertis (liste qui ne peut que croître ; départ : le shell) sont vérifiés
  sans texte JSX en dur ; tout nouvel écran s'ajoute à sa livraison. Le cliquet a mordu
  dès son premier tour (fallback Suspense converti).
- **R327** : LN-03 donnée VERBATIM (3 écrans testés : incident DE, message mobile DE,
  interface FR) ; LN-04 paramétrage traduit PAR le tenant (CoC `libelles` fr obligatoire
  + de/en/it, langue inconnue → refus typé R327, colonne Json nullable = expand RUNBOOK
  §8) ; LN-05 le courrier OF-09 suit `corrLang` du DESTINATAIRE (gabarits FR/DE/EN/IT,
  MOTIF verbatim, re-vérifié en IT — jamais la locale de l'opérateur) ; LN-06 formats par
  Intl (le nombre suit la locale, la devise suit la donnée). Clés R-Q :
  tenant_langue_defaut, langues_actives_ui.
- **ÉCARTS CONSIGNÉS** : (1) conversion des 73 écrans = chantier continu du cliquet ;
  (2) les littéraux de format du canon (1'234.50 / 1.234,50) sont illustratifs — Intl
  fait foi par locale (fr-CH : espace + point décimal CHF) ; (3) la croissance-seule de
  la liste du cliquet est une discipline de revue (le retrait se voit au diff) ; (4) les
  gabarits de courrier sont du TEXTE D'INTERFACE (traduits par l'éditeur) — le motif
  reste une donnée, verbatim.

## SOLDE — CANON « 4 DERNIERS ÉCARTS » PARTIE 3 : INFRA CADRÉE, STORE PARTAGÉ LIVRÉ (2026-07-29)

- **§3.5 LIVRÉ (code)** : le rate limit R296 vit dans un STORE enfichable —
  `MemoireRateStore` (dev/mono-instance) / `RedisRateStore` (fenêtre glissante par
  sorted-set, activé par REDIS_URL) : N instances = UN quota par construction. RL-04
  prouve le quota GLOBAL (deux limiteurs, un store — mémoire ET adaptateur Redis via
  stub in-process). Écarts : (1) le démon Docker est indisponible en session — la
  recette « saturer via app1, 429 via app2 » se REJOUE en staging avec
  infra/compose/prod-compose.yml ; (2) ioredis se charge dynamiquement (présent là où
  REDIS_URL l'est) — pas de dépendance ajoutée au dev.
- **Runbook §1-§10 PRÉPARÉ (fichiers, zéro provisionnement)** : infra/exoscale (Terraform
  réseau/SG/VMs/SOS/DR), infra/scripts (backup-walg.sh + restore-test.sh CHRONOMÉTRÉ —
  le critère §4), infra/compose (2 instances app + Redis AOF + Caddy TLS/HSTS),
  infra/observabilite (alertes dead-letters AS-04 / jauge R250 / backups / disque —
  canal réel à brancher §9). L'acte humain restant = appliquer, pas bricoler.

## SOLDE — CANON « 4 DERNIERS ÉCARTS » PARTIE 4 : DOSSIER SÉCURITÉ INITIALISÉ (2026-07-29)

- **Livré** : docs/SECURITE.md — grille ASVS L2 remplie CONTRE LE CODE RÉEL (12 domaines ✔
  avec preuve par test, 4 écarts ouverts assumés) ; en-têtes de sécurité posés SERVEUR sur
  TOUTE réponse (SecurityHeadersMiddleware — SEC-01 rouge puis vert, 200 ET 401) ; CI
  sécurité : audit dépendances BLOQUANT sur critiques + grep secrets + ZAP baseline gated
  sur STAGING_URL (absent = sauté explicitement, jamais un advisory qui traîne).
- **Séquencement du canon constaté** : (a) JWT partout FAIT, (b) login R296 FAIT (avec
  store partagé), (c) staging = infra/ prête, acte humain. Le pentest (cabinet suisse,
  retest inclus, mobile V7 en pentest dédié) reste VOTRE acte — le dossier est sa matière.
- **Écarts** : HSTS au proxy seulement (API derrière Caddy, accepté) ; coffre secrets §7
  et rotation d'env = actes infra ; ZAP sans cible en session.

## TOUR 2 DU CLIQUET i18n — LA NAV EST COMPLÈTE (2026-07-29)

- Les 43 clés post-maquette sont AJOUTÉES au dictionnaire (« chaque clé manquante se
  comble par un ajout », R326) — bloc EXTENSION ÉDITEUR distinct : le bloc maquette reste
  VERBATIM et auditables séparément. Rapport CI : **72/72 clés nav traduites en EN/DE/IT,
  0 écart**. Les libellés d'interface sont du texte de l'ÉDITEUR (précédent OF-09) —
  jamais une donnée métier.
- Écarts LEVÉS : (1) « onglets post-maquette restent FR » (solde §10 partie 2) — levé
  pour la NAV ; (2) le sic maquette « Octopulse OppRisk » — la clé canon « Octopulse
  OpRisk » existe désormais, la maquette cède au canon.
- RESTE au cliquet : les CONTENUS d'écrans (titres internes, colonnes, boutons) — écran
  par écran, chaque conversion ajoute le fichier à la liste du cliquet.

## TOUR 3 DU CLIQUET i18n — LE PATRON D'ÉCRAN-CONTENU (2026-07-29)

- Premier écran-contenu converti : **BiReporting** (`t()` sur titre, boutons, mention de
  scope — les données restent des données) ; le fichier entre dans la LISTE DU CLIQUET
  (2 fichiers, 0 texte en dur). Bloc dictionnaire « ÉCRANS » distinct (un bloc par
  vague de conversion — maquette / extension nav / contenus, auditables séparément).
- C'est LE gabarit des 72 écrans restants : (1) `const t = traduire(langue())` ;
  (2) chaque chaîne visible → `t("…")`, la clé EST le FR ; (3) traductions au bloc
  ÉCRANS ; (4) le fichier s'ajoute au cliquet — qui vérifie. Les tests FR existants ne
  bougent pas (FR = référence).

## TRANCHE 2 DU CLIQUET i18n — OPRISK + MOBILEADMIN CONVERTIS (2026-07-29)

- Deux écrans-contenus de plus au cliquet (**4 fichiers vérifiés, 0 texte en dur**) :
  OpRisk (17 clés) et MobileAdmin (24 clés) — l'UI par t(), les DONNÉES verbatim (titres
  d'incidents, messages clients, motifs). Le cliquet a mordu sur les `<option>` :
  libellé traduit, VALEUR technique conservée (le contrat API ne bouge pas).
- Restent 70 écrans au patron — conversion par tranches, chaque fichier ajouté à la
  liste du cliquet à sa conversion.

## SOLDE — VAGUE DE CLÔTURE R328 : LE CONTEXTE VIENT DU JETON (2026-07-29, JW-01..06)

- **Étape 0 ratifiée** : canon R325-R327 → dépôt **R328-R330** (R325-R327 pris par le solde
  des 4 écarts) ; familles JW/DM/RZ conservées. Spec : spec/canon-vague-cloture-R328-R330.md.
- **Constat publié (ratifié)** : le guard global RS256/JWKS et les jetons réels au harnais
  étaient DÉJÀ en place — livré le RELIQUAT.
- **JW-01** : les 310 routes du routeur sont ÉNUMÉRÉES (le test suit le `_router.stack`,
  jamais une liste manuelle) → 401 sans jeton, sauf 7 en liste blanche (auth token/oidc/
  methode/login, JWKS, mobile/auth). **JW-02** : cross-tenant refusé/vide re-prouvé sur 5
  modules (cpsi, oprisk, coc, clients, legal). **JW-03/06** : le mode `headers` du FRONT est
  SUPPRIMÉ (authMode/isDevAuthMode retirés) — grep zéro en-tête de contexte dans code +
  harnais + front, SCELLÉ en CI ; un en-tête envoyé à l'exécution est ignoré (le jeton
  commande). **JW-04** : rotation JWKS traversée par le guard (grâce structurelle).
  **JW-05** : 401 avec jeton présent → événement `olive:session-expiree`, bandeau de
  re-connexion au shell (vraie route /v1/auth/login), brouillons (état React) préservés —
  AUCUN rechargement.
- **ÉCARTS CONSIGNÉS** : (1) OLIVE_SESSION reste une PROJECTION d'affichage (rôle courant)
  — jamais un vecteur d'auth ; (2) le refresh silencieux est un raffinement futur : v1 =
  re-login explicite au bandeau (le brouillon survit, l'exigence est tenue) ; (3) la liste
  blanche du test reprend celle du code (tenant.middleware + mobile.gate) — si elle change,
  les deux bougent ensemble (le test le forcerait).

## SOLDE — VAGUE DE CLÔTURE R330 : READINESS & PIPELINE (2026-07-29, RZ-01..04)

- **R330 livré** : `/readyz` AGRÉGÉ (liste déclarée : db_migree, redis SI REDIS_URL, outbox
  lag<seuil, jwks, secrets, moteur_cpsi) → 200 si tout OK, 503 sinon (jamais 401 — public) ;
  `/healthz` vivacité simple ; les deux SANS jeton (sondes). RZ-03 : les secrets déclarent
  leur PRÉSENCE, jamais leur valeur (grep du corps de réponse). RZ-02/04 : un déploiement =
  événement `deploiement.enregistre` append-only (version, qui, quand, smokeOk) ; un smoke
  ROUGE se trace aussi (bascule annulée) ; journal visible en auditit (GET /v1/deploiements,
  ouvert au SO).
- **Pipeline PRÉPARÉ (infra/scripts, déclenchement HUMAIN)** : deploy.sh (migrations expand
  → deploy → /readyz vert → smoke → bascule ; échec = arrêt AVANT bascule) + smoke.sh
  (readyz + login local + lecture scopée). Les identifiants de smoke vivent au coffre.
- **ÉCARTS CONSIGNÉS** : (1) Redis n'est vérifié que si REDIS_URL (pas de files au dépôt =
  composant non requis) ; (2) le relais outbox est un worker in-process — le lag se mesure
  sur event_consumers ; (3) `/deploiements` est tenanté (RLS) — le journal des déploiements
  d'un tenant lui appartient ; l'agrégat cross-tenant reste un acte d'ops (hors surface).

## SOLDE — VAGUE DE CLÔTURE R329 : LE TENANT DE DÉMO GWB (2026-07-29, DM-01..06)

- **R329 livré** : le seed GWB est REFONDU — histoire commerciale complète par les VRAIES
  APIs (prospects→onboarding 3 structures→KYC→CPSI+signal+score→CoC HAUTE→OpRisk→
  offboarding EXIT_COMPLIANCE art.10a), IDEMPOTENT PAR RÉFÉRENCES (find-or-create) —
  remplace le refus de double semis. Idempotence PROUVÉE : 2 exécutions consécutives =
  compteurs identiques ({utilisateurs:6, onboardings:3, clients:3, kyc:1, coc:1,
  offboarding:1}), DM-02.
- **DM-01** (revue de source) : zéro écriture Prisma directe sur les 8 tables de MOTEURS
  (cpsiEvent, domainEvent, riskCase, kycFile, onboarding, cocFile, offboardingFile,
  screeningRun) — tout passe par les APIs. **DM-03** : zéro branche de logique `demo` dans
  le code produit (grep CI bloquant) — la démo n'a AUCUNE voie spéciale. **DM-04** (OF-07) :
  le motif EXIT_COMPLIANCE invisible au RM, visible au CO_SR — la scène de démo.
- **DEMO-SCRIPT.md** : déroulé commercial minuté (≈12 min, 10 scènes, personas par rôle,
  les invariants que la démo prouve).
- **ÉCARTS CONSIGNÉS** : (1) amorçage hors API ASSUMÉ (INSERT tenant, jeton ADMIN,
  assignation rmUserId — aucune route ne les porte, PAS des tables moteurs) ; (2) DM-05
  (rejeu à date sur le tenant démo) et DM-06 (isolation cross-tenant) sont garantis par
  construction (RLS + rejeu générique déjà testés partout) — non re-testés sur GWB ;
  (3) le run Olivia v2 de démo s'ajoutera au seed avec §4.c (constat) ; (4) reset = purge
  (RUNBOOK §9) + re-seed.

## SOLDE — DIRECTIVES §4 DE LA VAGUE DE CLÔTURE (2026-07-29)

- **§4.a Conformité visuelle À 100 %** : la grille CONFORMITE-VISUELLE.md passe désormais
  les **72/72 écrans livrés** (passe de clôture ajoutée) — zéro ligne « non passé ». Les
  seuls écarts restants sont les GLOBAUX G1–G4 (shell/sidebar, i18n en cliquet, accents par
  module) — structurels, consignés, non bloquants. Aucun conflit canon↔maquette NOUVEAU
  pour arbitrage Ali.
- **§4.b Index sans suspens** : les deux verdicts en attente sont SOLDÉS. (1) **prospects
  vs R117–R120** : R117 modélise déjà PROSPECT (onboardings.etape) → verdict 0b.1 APPLIQUÉ
  (prospects filtrés à l'écran Pré-prospection). (2) **sbowner vs écran propositions** :
  COUVERT — la gouvernance du registre R-Q passe par Config & Go-live + Registre paramètres
  (mapping consigné). Le seul « à vérifier » résiduel de l'index (ordre de fallback
  corebanking) est RÉSOLU : le canon PORT n'a pas de cascade ordonnée (abus de langage
  maquette). Plus AUCUN « à vérifier ».
- **§4.c Olivia v2 — CONSTAT** : le canon v2 (R259–R266, SW-01..18) est DÉJÀ EXÉCUTÉ
  INTÉGRALEMENT (tâches #24–#34, 54 assertions SW dans fat-swarm, ContextBuilder IMPORTÉ
  jamais copié, `missions_actives` vide par défaut — SW-18 : une mission ne tourne
  qu'activée). Prérequis OL-01..34 verts (Olivia v1/v1.1 livrés). Rien à dérouler — le run
  de démo Olivia v2 s'ajoute au tenant GWB quand une mission est activée (hors seed par
  défaut : missions_actives vide, R167).

## COMPARAISON FRONT↔HTML + TRANCHE 3 CLIQUET (2026-07-29)

- **Comparaison MESURÉE** (docs/COMPARAISON-FRONT-HTML.md, rejouable en CI) : le cœur de
  palette est IDENTIQUE maquette↔React (olive600/gold/cream/ink — prouvé par FE-CMP qui lit
  la maquette) ; les accents PAR MODULE de la maquette (terracotta compliance #8C4A3C,
  violet data/IA #7A5AF8 + leurs fonds) sont AJOUTÉS à tokens.ts → **écart G3 LEVÉ**.
  Nav : 29/72 libellés verbatim de la maquette, 43 écrans canon post-maquette (la maquette
  les décrit sans onglet dédié) ; 7 sections sidebar maquette vs tab-switcher plat (G1,
  shell — chantier).
- **Correction mécanique appliquée** (§4.a autorise les écarts de tokens en direct) :
  Regwatch remplace le littéral `#7A5AF8` par `tokens.color.accentData` ; FE-CMP2 vérifie
  que les 4 écrans convertis (Regwatch/OpRisk/MobileAdmin/BiReporting) n'ont AUCUN hex
  décoratif en dur — la palette passe par tokens.ts.
- **Cliquet tranche 3** : Regwatch converti (10 clés × 3 langues) — 5 fichiers au cliquet,
  0 texte en dur, rapport nav 0 écart.

## Écarts — FilterBar (R404, 2026-08-04, drop PO SESSION-2026-08-04)

Ratification FilterBar (`spec/SPEC-FILTERBAR.md`, R-FB → **R404** au step-0 révisé). Le système
**notifie, il ne masque pas** (esprit R39) : un écart consigné reste ouvert tant que la **source**
n'est pas corrigée, même avec un garde-fou défensif en place.

| Écart | Nature | Statut repo |
|---|---|---|
| **E-FB-1** | Collision de codes de scénario (`AML-10/11/12` en double : série CBK/White-collar vs série Retail dans la démo) → clés React dupliquées → cartes orphelines au filtrage (18 rendues pour un compteur de 15). | Vérifié + durci côté React (lot FilterBar) — voir R-FB.4. |
| **E-FB-2** | `AmlCatalogueScreen` (démo) : `return;` orphelin dans le `.map()` des KPI → les 3 cartes KPI ne se rendent jamais. | Vérifié côté React (lot FilterBar) — état consigné au commit. |
| **E-FB-3** | Barres « Déclenchements par catégorie » (Dashboard Compliance Center) non cliquables. | **Décision PO ouverte** : drill-down → FilterBar pré-remplie, ou affichage seul. Non bloquant. |

**R-FB.4 — invariant clés uniques (non-régression du bug corrigé).** Dans toute liste rendue, la
clé React de chaque item est **unique**. Tout référentiel affiché déduplique **défensivement**
(suffixe déterministe `#n` + `console.warn` pointant la source). La source doit être corrigée ; le
`warn` est l'écart à consigner, pas le correctif. Utilitaire repo : `apps/web/src/lib/dedupeKeys.ts`.
Garde de non-régression : test corpus d'unicité des codes de scénario du référentiel AML React
(aucun `console.warn` en parcours nominal = source saine). **E-FB-1 backend** : la collision peut
exister aussi dans le seed GWB — vérification tracée pour le lot backend AML (test corpus d'unicité
à ajouter côté API).

## Écart — remplacement de l'oracle de parité par la démo PO (2026-08-04)

**Décision Ali (ratifiée) : `docs/reference/olive-demo.html` remplacé par la démo canonique PO**
(journal `docs/SESSION-2026-08-04.md` décision 7 — « remplace l'ancienne » : FilterBar sur 10 écrans,
64 règles gap au référentiel unifié, cas GT rendus TP/FP). Le contenu fonctionnel (règles gap +
FilterBar) est **déjà implémenté** au repo (waves 1+2 + composant FilterBar R404).

**Conséquences consignées (aucune n'est gatée CI — vérifié : `ci.yml` n'exécute ni `test:demo`,
ni `test:smoke`, ni `extract_demo_data`) :**
- Les **84 clones de parité** (`apps/web/src/parity/*.tsx`) citent des numéros de ligne de l'ancien
  oracle en commentaire (« porté verbatim de olive-demo.html L… »). Ces citations sont désormais
  **périmées** (dérive documentaire, pas une rupture de build — les clones sont des `.tsx`
  autonomes qui compilent/tournent). **Re-port de parité = lot ultérieur.**
- Les outils démo (`tests/demo/*.mjs`, `scripts/extract_demo_data.mjs`) importent Playwright depuis
  un chemin de l'env PO (`/home/claude/.npm-global/…`) et ciblent la structure de l'ancien oracle —
  à repointer (chemin Playwright repo + sélecteurs de la nouvelle démo) lors du re-port. Non gatés CI.
- Suites gatées **inchangées et vertes** après le remplacement : web 99/99, build, canon-master 8/8.


---

## 7. Bloc 62 — Offboarding au moteur (session 2026-08-08)

### E-OFF-1 — Module offboarding démo hors moteur
- **Constat** : l'offboarding existe en démo (écran, checklists, chaînes d'approbation) mais
  hors moteur certifié : progression par `approvalIdx++`, `OFF_APPROVAL_CHAINS` en constantes
  non tenant, pas de visa R15, pas d'exclusion R13, pas d'événements.
- **Résolution : Bloc 62 ratifié 08.08.2026** (`spec/BLOC-62-OFFBOARDING-R432-R438.md`,
  règles repo R439–R445) — migration de l'écran démo APRÈS 14/14 verts (A5).
- **EXÉCUTÉ (08.08.2026, A5)** : écran migré sur la projection (`offProjection`/`offEmettre`,
  plus d'`approvalIdx`), registre tenant `OFF_TENANT_PARAMS` (sévérités jamais codées en dur),
  masquage MROS→COMPLIANCE par rôle, onglet Paramétrage + pop-up R445. Parcours navigateur
  6/6, smoke 80/80. CLOS.

### E-OFF-2 — Port core banking absent : guard CORE en stub explicite
- **Constat** : la spec Bloc 62 exige un guard « soldes/positions core » sur la clôture, mais
  aucun connecteur core banking n'est configuré dans ce dépôt (R167 — port vide en prod).
- **Décision (A3)** : le guard CORE existe dans le registre des paramètres avec sa sévérité,
  et le service l'évalue UNIQUEMENT si un port est injecté (`OFFB_FAKE_CORE=1` en test, jamais
  en prod). Sans port, le guard n'est PAS évalué — stub explicite consigné en commentaire dans
  `offboarding-moteur.service.ts` (jamais évalué à tort, jamais un faux vert calculé). Limite
  assumée : l'absence du port n'apparaît pas encore dans la réponse du health check — à traiter
  au branchement d'un vrai connecteur (même modèle que `CorebankingModule`).

### E-OFF-3 — Collisions de numérotation et d'identifiants (découvertes au versement du Bloc 62)
- **Constat 1 — numéros de règles** : le drop de session numérote R432–R438, créneau déjà
  attribué (bloc WD, registre C5). Résolu par le mécanisme ratifié de mapping-session-repo.md :
  Bloc 62 = **R439–R445** au repo, réservation PK glisse à R446+, table §1 mise à jour.
- **Constat 2 — IDs de scénarios** : OF-01..12 existent déjà (bloc offboarding R267–R271,
  `fat-offboarding.e2e-spec.ts`, contenu différent). Les scénarios du Bloc 62 gardent leurs
  IDs OF-01..14 (le document fait foi) dans la suite distincte `offboarding-moteur.spec.ts`
  avec référence repo [R439–R445] dans chaque titre.
- **Constat 3 — deux machines à états** : la machine RATIFIÉE R267–R271
  (CLOTURE_DEMANDEE → EN_CLOTURE → CLOTUREE, OffboardingService) et celle du Bloc 62
  (Création → Collecte → Review → Validation → Clôturé, instance moteur) décrivent la même
  sortie de relation à deux granularités. R267–R271 restent actives et inchangées pendant la
  construction ; la réconciliation (mapping d'états, quelle machine porte quoi) est une
  DÉCISION PO à acter — consignée ici, jamais absorbée en silence.

### E-6364-0 — Blocs 63/64 : collision de numérotation ET de périmètre (A0, 2026-08-08 — STOP, arbitrage PO)
- **Contexte** : drop de session « Blocs 63 & 64 · Business Trip + Cross-Border » (specs v2
  post-audit, numérotation session R439–R458). L'action A0 exigeait la vérification canon
  avant tout code — la voici, verdict : STOP.
- **Collision 1 — numérotation (certaine)** : R439–R445 sont RATIFIÉES au repo (Bloc 62
  Offboarding, session R432–R438, canon 08.08.2026) ; R446+ est la réservation PK.
  Mécanisme ratifié applicable (mapping-session-repo.md §3, décision Ali 2026-07-29,
  appliqué 4 fois) : l'implémenté prend le créneau contigu → Blocs 63/64 = repo
  **R446–R465** (63 : R439→R446 … R445→R452, R458→R465 ; 64 : R446→R453 … R457→R464,
  R456/R457 gelées → R463/R464), PK glisse à R466+.
- **Collision 2 — périmètre (majeure)** : l'audit joint (AUDIT-BLOCS-63-64-EXISTANT.md) n'a
  audité QUE la démo HTML (réserve explicite §Réserve) ; or le repo implémente déjà :
  · **MOD-75 Business Trip R222–R230** (lot 51, ratifié « OK pour R222..R238 ») — cycle
    événementiel (R222), avis cross-border versionné + grandfathering (R223/R229 ≈ session
    R441/BT-14), signaux KYC (R224), visa R15 + exclusion R13 (R225 ≈ BT-03), contact
    reports mesurés (R226), certification à la DATE DU VOYAGE via MOD-43 (R228/R237 ≈
    BT-04), révision chaînée (R230 ≈ BT-07) ; `tripCertificationRequise` est DÉJÀ filtré
    par juridiction (≈ session R451 — « aucune granularité pays » n'est vrai qu'en démo).
  · **Cross-Border R293–R295** (canon triage final, 28.07) — R293 : country manual = clé
    EXISTANTE `tripCrossBorderReferentiel` ENRICHIE, « JAMAIS un second référentiel »
    (l'unification E-XB-3 est déjà doctrinale au repo) ; R294 : moteur pur `evaluerXb`,
    DEUX surfaces (pré-voyage / à la relation), dérogation motivée + visa ; R295 : ordres
    pays restreint + qualification « initiative du client » + preuve GED (≈ R448-ORDER /
    R449 partiels).
  · **MOD-43 Formations R231–R238** — attestations append-only, visa R15, catalogue tenant
    (socle de session R451, la spec le référence d'ailleurs).
  · Événements `trip.*` déjà schématisés au catalogue C6 (vague 1).
- **Réconciliation préliminaire (session → existant)** : DÉJÀ COUVERTES en substance :
  R444 (=MOD-43), cœur de R441 (=R223/R229/R230) ; PARTIELLES (extension de l'existant,
  pas de nouveau module) : R439 (chaîne dynamique risque×budget sur MOD-75), R440 (guards
  de transition sur signaux R224/R228, pattern Bloc 62), R446 (port fournisseur = extension
  de R293, jamais un remplacement), R447 (2e surface R294 à étendre), R448 (R295 couvre
  ORDER), R449 (registre-objet sur la qualification R295), R451 (codes XB-<pays> sur
  MOD-43) ; NOUVELLES : R442 (quotas+overrides), R443 (certificat de trip), R450, R452,
  R453 (brique : reporting R295), R454, R458 ; GELÉES : R456/R457.
- **Règle du drop appliquée** : « si collision de numéro ou de périmètre avec R439–R458,
  STOP et consigner l'écart pour arbitrage PO. Ne jamais dupliquer une règle existante. »
  → implémentation NON commencée, arbitrage demandé.
- **ARBITRÉ (PO, 2026-08-08)** : « Delta sur l'existant » — renumérotation mécanique
  (Bloc 63 = R446–R452 + R465, Bloc 64 = R453–R464, PK → R466+) ET implémentation en
  EXTENSION des modules existants (MOD-75, R293–R295, MOD-43) ; quand l'existant couvre,
  la règle repo le référence, aucune duplication. Specs versées avec en-tête d'édition.

### E-BT-1 — Module Business Trip démo hors moteur (Blocs 63/64, A1)
- **Constat** : la démo mute `approvals[].state` à la main, chaîne fixe RM→MGR→XB→HPB pour
  tous les voyages, `DEST_QUOTAS_SEED`/`ROLE_GATE`/`INDIGITA_DB` en constantes non tenant,
  aucun certificat de retour. NB : le repo, lui, a déjà MOD-75 (R222–R230) événementiel —
  l'écart est DÉMO-seulement pour le cycle, réel pour chaîne dynamique/guards/certificat.
- **Résolution** : Bloc 63 (repo R446–R452 + R465), migration démo en A7 après 30/30.

### E-BT-2 — Compte-rendu de voyage libre, sans validation ni cycle
- **Constat** : la démo porte `report`/`reportDate` en texte libre — sans cycle de vie,
  sans visa, sans liens contact reports, sans SLA, sans écarts déclarés.
- **Résolution** : R450 (repo) FORMALISE l'existant — le texte libre devient le corps
  narratif du certificat ; migration des comptes rendus existants en certificats Brouillon.

### E-BT-3 — Prospect né en voyage : fonctionnalité démo orpheline de règle
- **Constat** : « Nouvelle demande de voyage » sait déclarer un nouveau contact rencontré
  → prospect complet (`source: "Business Trip"`, docs CDB pré-listés) via `onNewProspect` ;
  aucune règle ne couvrait cette capacité (la migration A7 l'aurait supprimée — interdit).
- **Résolution** : règle R465 (repo ; session R458, ajout d'audit) — origine tracée, liens
  voyage + contact report, circuit d'onboarding standard, zéro raccourci de diligence.

### E-XB-1 — Matrice cross-border démo en constante
- **Constat** : `CB_RULES` en dur dans l'écran Cross-Border — aucune source, aucune
  version, aucun traitement des actes distants.
- **Résolution** : Bloc 64 (repo R453–R464) — port fournisseur versionné en EXTENSION de
  R293 (le country manual repo `tripCrossBorderReferentiel` reste LA clé), migration A7.

### E-XB-2 — Intégration réseau Indigita/Apiax : HORS SESSION
- **Décision (drop)** : adaptateurs `INDIGITA_API`/`APIAX_API` livrés en CONTRAT + MOCK
  uniquement ; l'intégration réseau réelle est un lot commercial séparé. Toute tentative
  d'implémentation réseau dans cette session serait un écart — consigné ici par avance.

### E-XB-3 — Deux référentiels cross-border parallèles en démo
- **Constat** : `CB_RULES` (matrice 6 activités) et `INDIGITA_DB` (statut/sollicitation/
  licence/produits) coexistent sans synchronisation — un pays peut être BLOQUÉ dans l'un
  et permissif dans l'autre. Le repo interdit déjà cette situation (R293 : « JAMAIS un
  second référentiel »).
- **Résolution** : R453 (repo) — la version de matrice est UN objet par juridiction
  (verdicts d'activités + champs de synthèse) ; CB_RULES et INDIGITA_DB deviennent deux
  projections de lecture de la même version.

### E-6364-A7 — Fonctionnalités démo conservées HORS périmètre R446–R465 (audit A7)
- **Constat (audit ligne à ligne avant transcription)** : l'écran Business Trip démo porte
  des capacités sans règle R des Blocs 63/64 : bouton « Lancer Indigita » (consultation
  ponctuelle de synthèse), création de prospect avec pré-liste de documents CDB, KPIs
  (pending/high/actifs), onglet « Paramétrage quotas » in-écran (doublon partiel du panneau
  admin). L'écran Cross-Border porte un simulateur de check à la relation.
- **Décision (A7, conforme au prompt)** : conservées TELLES QUELLES — ni supprimées, ni
  transcrites. La création de prospect est désormais couverte par R465 (E-BT-3 résolu) ;
  le reste attend une règle si le PO le norme. Migré au moteur : projection des événements
  (plus d'`approvals[].state` muté), chaîne résolue risque×budget figée dans
  WORKFLOW_STARTED, certificat de trip (cycle + validateur résolu + écart → XB, E-BT-2 :
  les comptes rendus libres deviennent des certificats Brouillon au semis), matrice UNE
  version datée (bandeau, E-XB-3), verdict distant consigné aux contact reports (badge),
  pop-up R445 sur toutes les éditions du panneau admin.

### E-OFF-4 — Fonctionnalités démo conservées HORS périmètre R439–R445 (audit A5)
- **Constat** : l'audit ligne à ligne de l'écran démo avant migration a recensé des
  fonctionnalités absentes de la spec Bloc 62 : onglet Dashboard (motifs de sortie, répartition
  par statut, insights générés), narrative du health check, pourcentage d'avancement checklist,
  bannières de statut client.
- **Décision (A5, conforme au prompt)** : conservées TELLES QUELLES — ni supprimées (pas de
  régression démo silencieuse), ni transcrites au moteur (elles n'ont pas de règle R associée).
  Si elles doivent devenir normatives, c'est un bloc de spec à part — décision PO.


## 6. Écarts de NAVIGATION (audit 2026-08-08 — préalable bloc WD, R432–R438)

Source : `docs/AUDIT-NAV-2026-08-08.md` (matrice complète, méthode, lignes). Constat
uniquement — **E-WD-4 (wfbuilder/RoleDashboard) est DÉJÀ ARBITRÉ : FUSION** et n'est pas
re-soumis ici.

### E-NAV-1 — Routes `accounts` et `signatories` orphelines (maquette)
- **Constat** : cases L44828/L44829 (AccountsScreen, SignatoriesScreen — écrans du portage
  « parité 100 % » du 02.08) sans AUCUNE entrée UI : absents du NAV, de la nav v2, et aucun
  `go()` vivant ne les cible. Injoignables à la souris.
- **Options** : (a) entrées NAV dédiées (g_clients) ; (b) liens depuis la fiche client
  (`ClientFileScreen`) ; (c) supprimer les routes (perte d'accès aux écrans portés).
- **ARBITRÉ (2026-08-08, PO)** : option (b) — liens « Comptes → » / « Signataires → » depuis la fiche client (`ClientFileScreen`, via `OLIVE_NAVIGATE`). Appliqué.

### E-NAV-2 — Route alias `aml48` orpheline (maquette)
- **Constat** : case L44867 rend `AmlEncyclopediaScreen`, déjà servi par `amlcat` (NAV
  « Règles AML »). Alias historique sans entrée.
- **Options** : (a) supprimer l'alias au bloc WD ; (b) conserver si des liens externes/démos
  scriptées l'utilisent (aucun trouvé dans le fichier).
- **ARBITRÉ (2026-08-08, PO)** : option (a) — alias `aml48` supprimé du switch. Appliqué.

### E-NAV-3 — Route `formbuilder` : doublon d'accès de l'onglet « quest »
- **Constat** : case L44874 (`QuestionnaireBuilderScreen`) sans entrée UI ; le MÊME composant
  est vivant comme onglet « quest » du Section Designer (L24757/L24866, via sdkyc/sdar/sdgar).
- **Options** : (a) retirer la route doublon ; (b) donner une entrée NAV propre au
  Questionnaire Builder (comme la maquette PO d'origine, item « Questionnaire Builder »).
- **ARBITRÉ (2026-08-08, PO)** : option (a) — route doublon `formbuilder` retirée ; le Questionnaire Builder reste l'onglet « quest » du Section Designer (sdkyc/sdar/sdgar). Appliqué.

### E-NAV-4 — Composants morts maquette : LoginScreen, BuilderScreen, AmlCatalogueScreen, Compliance48Screen
- **Constat** : définis (L41574, L41654, L27255, L26976), montés par personne. Le login réel
  est inline dans `App` ; BuilderScreen est l'ancêtre de WorkflowBuilderScreen ;
  AmlCatalogueScreen/Compliance48Screen sont supplantés par AmlEncyclopediaScreen/
  ComplianceCenterScreen.
- **Options** : (a) purge au bloc WD (avec E-WD-4) ; (b) conserver comme référence commentée.
- **ARBITRÉ (2026-08-08, PO)** : option (a) — `AmlCatalogueScreen` et `Compliance48Screen` purgés (mêmes geste que RoleDashboard/LoginScreen/BuilderScreen au bloc WD). Appliqué.

### E-NAV-5 — `dashboard`, `capacite`, `crm2` joignables par la SEULE nav v2
- **Constat** : atteignables uniquement via `OLIVE_NAV_INDEX`/`OliveNavV2` (panneau flottant),
  absents du menu latéral principal. Un utilisateur qui ignore la nav v2 ne les trouve pas.
- **Options** : (a) les ajouter au NAV principal ; (b) statu quo assumé (la nav v2 est le
  chemin voulu « Mon travail ») ; (c) fusionner capacite↔workload (React) au bloc WD.
- **ARBITRÉ (2026-08-08, PO)** : option (a) — `capacite` (« Capacité de l'équipe (live) ») et `crm2` (« Relation — timeline & entretiens ») ajoutés au menu latéral (groupe Front & Croissance) ; `dashboard` = alias de `home`, rien à faire. Appliqué.

### E-NAV-6 — 43 exports morts au front React (dont un composant)
- **Constat** : jamais référencés hors de leur fichier ni des tests — 40 résidus de portage
  dans `parity/*-support.ts`, `WfRulesCatalogPanel` (parity/WfEngineScreen.tsx),
  `currentAsOf`/`oliveSession` (lib/api.ts). Liste complète : AUDIT-NAV §2.
- **Options** : (a) purge groupée (lot dédié, tree-shaking déjà neutralise le poids) ;
  (b) statu quo (les clones parité sont des références de portage) ; (c) purge sélective
  (le composant seulement).
- **ARBITRÉ (2026-08-08, PO)** : option (c) — purge sélective : l'export mort `WfRulesCatalogPanel` devient interne à `parity/WfEngineScreen.tsx` (le composant reste monté L97) ; les `parity/*-support.ts` et `currentAsOf`/`oliveSession` restent (références de portage / API d'avenir). Appliqué.

### E-NAV-7 — Résidus de parité maquette ↔ React
- **Constat** : hors renommages mappés (COMPARAISON-FRONT-HTML.md), le React a 16 écrans
  sans équivalent maquette (amlgap, bat, inference, rejeu, ports, oliviaruns, audit,…) et la
  maquette 10 sans équivalent React tenant (execdash, invest, apidoc-nav, admin, crm2,
  sbowner, wfaudit, sandbox-live, prospects dédiés). Détail : AUDIT-NAV §3.
- **Options** : (a) faire suivre la maquette écran par écran (comme fait le 07-08.08) ;
  (b) assumer l'écart documenté (la maquette = vitrine, le React = produit) ; (c) trancher
  écran par écran au bloc WD.
- **ARBITRÉ (2026-08-08, PO)** : option (b) — écart ASSUMÉ et documenté : la maquette = vitrine, le React = produit ; `docs/COMPARAISON-FRONT-HTML.md` reste la table de vérité, mise à jour à chaque bloc. Aucun portage systématique.

### E-WD-7 — Nomenclature des gabarits du Designer : niveaux de diligence ≠ workflows nommés
- **Constat (2026-08-08, signalé par le PO)** : les gabarits du canvas (WF_TEMPLATES) étaient
  nommés SDD/CDD/EDD — le NIVEAU DE DILIGENCE (calculé par le moteur de risque,
  `risk-engine.ts`) — alors que le catalogue produit compte 6 workflows NOMMÉS
  (WF_MGMT_TEMPLATES, écran Gestion & versions) : SOW/HOW/POW (onboarding) ·
  SKW/HKW/PKW (perpétuel), dérivation `wfNomenclature` déjà codée et liste KYC déjà
  filtrée par ces 6 codes (maquette + React).
- **ARBITRÉ (2026-08-08, PO) — EXÉCUTÉ (même jour)** : les gabarits du Designer SONT le
  catalogue gouverné — WF_TEMPLATES est GÉNÉRÉ depuis WF_MGMT_TEMPLATES (source unique,
  étapes/rôles/SLA/approbation), 6 gabarits nommés, la diligence (SDD/CDD/EDD) reste un
  ATTRIBUT affiché (LOW→SDD, HIGH/PEP→EDD). Générateur local remappé (EDD→HOW/POW,
  SDD/CDD→SOW). ROLES_TENANT (+MLRO, +SYSTEM — rôles des gabarits, doctrine E-WD-5) côté
  démo ET défaut Q-WD-5 backend. Le backend reste TIER-BASED (le moteur calcule le niveau,
  jamais un nom de workflow) — conforme à l'option retenue.
- **Complément (même jour) — côté Paramétrage** : passe terminologique — la grille de
  risque Admin dit désormais « le score aiguille le NIVEAU DE DILIGENCE via WR0 ; le
  workflow nommé s'en dérive » ; le bac à sable Onboarding affiche la table de dérivation
  (LOW→SOW·SKW · HIGH→HOW·HKW · PEP→POW·PKW) ; libellés « aiguillage de diligence »
  partout. Les usages LÉGITIMES du niveau (matrice documentaire, profils de review,
  questionnaires AR, grille BRM, clé backend `workflows` des sections) sont INCHANGÉS.

### E-WD-5 — Référentiel « rôles tenant » de la démo : assumé = rôles des gabarits livrés
- **Constat (bloc WD, 2026-08-08)** : R434 exige des rôles mappés sur les rôles tenant. La démo
  n'a pas de référentiel de rôles séparé ; ses gabarits livrés (WF_TEMPLATES) utilisent
  AML, BRM, ESG, LEGAL, ESG/LEGAL, HPB/CEO en plus des rôles IAM. ROLES_TENANT (wir-core.mjs)
  a été aligné sur cet ensemble — un rôle inventé (ex. SORCIER) reste NON_MAPPÉ bloquant (WD-06).
- **Option d'arbitrage** : si le canon veut un référentiel de rôles plus strict (IAM seul),
  les gabarits EDD/ONBOARDING de la démo devront être re-rôlés — décision PO.
- **ARBITRÉ (2026-08-08, PO)** : les rôles des GABARITS LIVRÉS font canon — le référentiel démo reste l'union rôles IAM + rôles gabarits (AML, BRM, ESG, LEGAL, ESG/LEGAL, HPB/CEO) ; aucun re-rôlage. Côté produit, chaque tenant paramètre son référentiel (Q-WD-5). Écart CLOS.

### E-WD-6 — OcrSketchImport appelle `/api/v1/ai/workflow/*` (préfixe `/api` mort)
- **Constat** : le capteur d'import (réutilisé verbatim) tente d'abord un backend
  `/api/v1/ai/workflow/from-text|from-image` — or l'écart d'invariant §1 a acté que le backend
  réel sert `/v1/...` SANS `/api`. Le repli local silencieux masque l'échec : le chemin
  backend ne fonctionnera jamais tel quel. NON corrigé dans le bloc WD (hors périmètre —
  le pipeline WIR intercepte la sortie, quel que soit le chemin qui l'a produite).
- **Options** : (a) aligner sur `/v1/ai/workflow/*` et créer la route côté API ; (b) supprimer
  la tentative backend (démo = générateur local assumé) ; (c) statu quo documenté.
- **ARBITRÉ (2026-08-08, PO) — EXÉCUTÉ (même jour)** : générateur local ASSUMÉ — la tentative backend `/api/v1/ai/workflow/*` est SUPPRIMÉE d'OcrSketchImport (`requestWorkflow` = générateur local seul, commentaire d'arbitrage en place). La vraie API vision attend l'arbitrage licence E-WD-2 (interface VisionExtractor côté produit). Écart CLOS.



## E-HR-1 — AR = table plate hors moteur (Bloc 65, constaté 09.08.2026)
- **Constat** (audit PO 08.08 + A0 repo 09.08) : en démo, `ACCOUNT_REVIEWS_DATA` est une table
  plate (`status` muté à la main, `outcome` en texte libre, `nextReviewDate` posée à la main).
  Au repo, le module reviews (R283) fait DÉJÀ de l'AR une révision du dossier KYC
  (`review.lancee` porte revision/previousKycId/profil figé R29) — le delta R467 (diff
  REPRISE/MODIFIÉE) s'y greffe, il ne crée pas de moteur neuf.
- **Cible** : R466/R467/R468 (Bloc 65 Volet A). Statut : OUVERT — en cours d'exécution.

## E-HR-2 — Critère de groupe codé en dur, config mutée sans pop-up (Bloc 65)
- **Constat** : démo `AR_GROUP_CONFIG` muté en direct (PARAM_CHANGED sans pop-up ni versioning),
  cascade par appels directs, critère UBO commun en dur.
- **Cible** : R469 (référentiel paramétrable + projection) + R471 (cascades événements) +
  pop-up R445. Statut : OUVERT.

## E-HR-3 — GAR = configuration sans objet moteur (Bloc 65)
- **Constat** : sections GAR et template GAW existent en config (Section Designer, WF_MGMT),
  aucun dossier de groupe n'existe (ni démo moteur, ni repo) — la consolidation et la décision
  de groupe n'ont aucun objet porteur. Deux couches de définition (WF_MGMT_TEMPLATES / WF_DEFS)
  sans lien de compilation.
- **Cible** : R470 (dossier parent) + R472 (compilation templates→WF_DEF). Statut : OUVERT.

## E-HR-4 — Boutons de décision hétérogènes entre écrans (Bloc 65)
- **Constat** : Approuver/Refuser ad hoc selon les écrans ; AUCUN renvoi ciblé ; aucune corbeille
  unifiée. La carte « Circulation du dossier R85 » livrée en démo v2026-08-09.16 (session du
  09.08) est le précurseur ad hoc le plus récent — elle sera ABSORBÉE par la barre unifiée R474
  (Volet B), écart re-consigné si divergence de comportement.
- **Volet B API livré (2026-08-09, HR-15..22 verts)** : le moteur existe — `decision-unifiee.service.ts`
  + routes `/v1/decisions` (barre, decider, annuler, corbeille, params R445), branché sans fork
  sur KYC·AR·GAR + Business Trip + Offboarding.
- **Étape 9 (démo v2026-08-09.17) — E-HR-4 ABSORBÉ côté KYC** : la carte « Circulation R85 »
  est devenue la barre de décision unifiée (✓ Valider · ✕ Refuser · ↩ Renvoyer · ⇄ Déléguer,
  même ordre, raccourcis V/R/B/D, motif structuré code+texte, renvoi CIBLÉ avec chute tracée,
  compteur de boucles + signal au seuil 3, refus à issue par étape — 1re étape/finale=TERMINAL,
  intermédiaires=RENVOI) ; corbeille « À décider » (R478) en tête du cockpit « Ma journée »
  (tri SLA, ÉCHU en tête badge rouge, types KYC·AR·GAR·BT, deep-link). Recette 15/15.
- **Étape 9 (2/2, démo v2026-08-09.18) — E-HR-1/E-HR-2 LEVÉS côté écrans, E-HR-3 réduit** :
  · l'écran AR porte le **delta en tête** (déclencheur MODIFIÉ · reste REPRISE du KYC lié ·
    points à reprendre — R460/R467) et le **verdict normalisé** CONFORME/RÉSERVES/NON CONFORME
    avec conséquences PROPOSÉES (R44) ; les outcomes libres historiques s'affichent MIGRÉS
    (« CONFORME (migré de “Risk unchanged”) », mapping arbitré) ; `nextReviewDate` est
    CALCULÉE (périodicité EDD 12 · CDD 36 · SDD 60) partout — plus aucune saisie (E-HR-1) ;
  · l'onglet Groupe porte la **décision de groupe** : visa référençant les verdicts membres,
    guard « membres non clôturés » ANNONCÉ sur le bouton, clic → GUARD_BLOCKED détaillé sans
    écriture (R463/R477) — la consolidation a un porteur à l'écran (E-HR-3 réduit ; le dossier
    parent GAR complet vit au moteur, `/v1/revues`) ;
  · le panneau admin AR est devenu **Paramétrage → Revues (KYC · AR · GAR)** : toggles
    `review.groupe.*` gouvernés par le pop-up d'engagement R445 (annuler = aucune écriture),
    registre §Review/§Decision affiché (E-HR-2 levé).
  Recettes Playwright : 15/15 (barre/corbeille) + 20/20 (AR/GAR/paramétrage), smoke 81/81.
  RESTE : réutilisation de la barre R474 sur les écrans BT/Offboarding démo (boutons ad hoc
  Approuver/Refuser) — le handoff UI v2 (`DecisionPanel`) fournit le gabarit cible.
- **Cible** : R474–R479 (Bloc 65 Volet B). Statut : OUVERT.

### E-V2-1 — Cross-Border replié en un onglet de lecture (V2-M13)
- **Constat** : le module `crossborder` porte **17 routes** (check pré-voyage et pré-acte,
  dérogations + visa R13, conformité voyage, ordres, reporting, matrice + sync R453, actes
  distants R454, reverse solicitation + visa R456, localisations R457, exposition R460, rejeu
  R48, registre de paramètres R462). La v1 lui donne un écran dédié (3 onglets). La v2 n'en
  expose **qu'une route** (`GET /crossborder/matrice`) en lecture seule, comme onglet du dossier
  KYC — décision inscrite dans `apps/web/src/ui2/cartographie.ts:44` comme une fusion acquise,
  jamais consignée comme un écart, donc invisible aux revues.
- **Analyse** : la fusion se défend pour la matrice des juridictions d'un dossier ; elle ne tient
  pas pour les actes (check avant un acte, preuve de reverse solicitation, séjour temporaire) qui
  sont portés par un ACTE et un COLLABORATEUR, pas par un dossier client.
- **Cible** : arbitrage PO — écran de plein droit dans « Parcours client » (recommandé) ou
  répartition par acte.
- **SOLDÉ au lot V2-M29 (11.08.2026)** — l'option recommandée a été retenue et construite :
  `apps/web/src/ui2/CrossBorder.tsx`, écran de plein droit atteignable par le bloc « Métiers »
  (module licencié †CROSSBORDER), six onglets qui recouvrent les six familles de routes du
  moteur — Exposition (R460), Matrice pays (R453), Dérogations (XB-03/R294/R13), Actes &
  pré-acte (R454/R455/R48), Sollicitation inversée & localisations (R456/R457), Ordres &
  reporting (XB-04/R39). L'onglet Cross-Border du dossier KYC est CONSERVÉ : la matrice d'un
  dossier se lit là où le dossier se lit. Gardes U2-48 à U2-51. Statut : **FERMÉ**.

### E-V2-2 — R84 (la main sur un dossier) sans aucune surface écran (V2-M13)
- **Constat** : R84 est ratifié et livré au moteur (`kyc/rules/kyc-lock.service.ts`, 4 routes :
  `lock`, `release`, `request-hand`, `pass-hand` ; tables `kycLock`/`kycLockRequest` ; 4
  événements ; séries CK/LK). **Aucun fichier de `apps/web` n'appelle ces routes** : ni bandeau
  « détenu par X », ni bouton, ni distinction visuelle entre mode consultation et mode édition.
- **Question de sémantique à trancher (ne pas décider dans l'écran)** : `peutConsulter()` renvoie
  FAUX quand un autre détient le dossier — R84 tel qu'écrit interdit la *consultation*, pas
  seulement l'édition. La demande PO exprimée le 11.08 dit l'inverse (consultation ouverte,
  édition sous prise de main). La fonction n'est appelée nulle part hors tests : la lecture n'est
  donc pas effectivement bloquée. Amender R84 au catalogue, ou l'appliquer — pas contourner.
- **Ouvert aussi** : expiration du verrou (aucune libération automatique aujourd'hui) et reprise
  forcée par un rôle habilité. Statut : OUVERT.

### E-V2-3 — Modules verticaux absents de la v2, y compris de la cartographie ⌘K (V2-M13)
- **Constat** : la cartographie v2 compte 60 entrées contre 82 entrées de navigation en v1.
  N'y figurent **ni écran ni destination de recherche** : Finance Islamique, PMS, Multi-devise &
  FX, Mobile Banking, Custody & TA, GED/coffre, Reporting MROS, Octopulse OpRisk, Legal —
  Contrats, AML Gap, Référentiel AML, Olivia · Runs, Checklist exigences, Pré-revue IA. Les
  quatre écrans CPSI opérationnels ne sont couverts que par un encart de la fiche client.
- **Aggravant** : « PMS » et « Multi-devise & FX » sont AFFICHÉS dans le bloc « Métiers » de la
  navigation (`Ui2Preview.tsx:90`) mais `Ui2Preview` n'a aucune branche pour ces identifiants —
  ce sont des entrées mortes.
- **Cadrage** : au sens R320, `MODULES_PRODUIT` = GED, OCR, KYC, AML, COC, ACCREV, WORKFLOWS,
  ONBOARDING, SCREENING, **PMS**, IA. Les autres verticaux (Islamique, Mobile, Custody, FX,
  Cross-Border) ne sont pas facturables : leur place relève d'un arbitrage de navigation.
- **Cible** : inventaire de couverture capacité par capacité, puis (a) onglets dans la colonne
  existante pour ce qui suit le parcours, (b) écrans propres sous « Métiers » conditionnés par la
  licence. Statut : OUVERT.

### E-V2-4 — Modules verticaux non ratifiés à MODULES_PRODUIT (V2-M14)
- **Constat** : l'arbitrage PO du 11.08 veut « chaque module activable par profil et licence ».
  Or `MODULES_PRODUIT` (canon R320, `license/vendor-license.service.ts`) ne liste que GED, OCR,
  KYC, AML, COC, ACCREV, WORKFLOWS, ONBOARDING, SCREENING, PMS, IA. Huit verticaux réels du
  moteur n'y figurent pas : **CROSSBORDER, CUSTODY, FX, MOBILE, ISLAMIC, LEGAL, OPRISK,
  REGWATCH**.
- **Traitement retenu** : le registre `apps/web/src/ui2/capacites.ts` les porte avec un préfixe
  « † », traité comme une licence à part entière par `licenceActive()`. Le front N'A PAS modifié
  le canon — la ratification de ces 8 modules à `MODULES_PRODUIT` est un acte de catalogue qui
  reste à faire, et conditionne la facturation.
- **Cible** : amendement du catalogue R320 (8 modules), puis retrait des marqueurs « † ».
  Statut : OUVERT — arbitrage PO/éditeur requis.

### E-V2-5 — Cross-Border : trois familles d'objets sans route de LECTURE (V2-M29)
- **Constat** : le moteur `crossborder` écrit les dérogations (`POST /derogations`, `/visa`), les
  actes distants et pré-actes (`POST /actes-distants`, `POST /pre-acte`) et les preuves de
  sollicitation inversée et localisations (`POST /reverse-solicitation`, `/visa`,
  `POST /localisations`) — mais **n'expose aucune route qui les relise en liste**. Seules
  quatre lectures existent : exposition (R460), matrice (R453), reporting (XB-04) et conformité
  d'un voyage (XB-03), toutes branchées à l'écran.
- **Conséquence assumée** : les trois onglets concernés tournent sur des données de maquette et
  **le déclarent à l'écran**, avec le renvoi à cet écart. On ne fabrique pas une liste depuis le
  journal côté front : ce serait une seconde vérité, exactement ce que R453 interdit pour la
  matrice.
- **Cible** : trois routes de lecture au moteur (`GET /derogations`, `GET /actes`,
  `GET /reverse-solicitation`), projetées des événements comme l'est déjà l'exposition (R460).
  Aucune table nouvelle.
- **SOLDÉ au lot V2-M30 (11.08.2026)** — les trois routes existent et l'écran est branché dessus.
  Ce sont des projections pures : l'état d'une dérogation se DÉDUIT de la présence de l'événement
  de visa, l'expiration d'une localisation se CALCULE à la lecture (R48), chaque acte porte la
  version de matrice qui l'a jugé. Aucune table, aucun dénormalisé. Un constat au passage : le
  moteur n'émet **pas** d'événement de refus de dérogation — la projection ne connaît donc que
  deux états, et l'écran a cessé d'en afficher un troisième qu'il avait inventé en maquette.
  Gardes XB-15 à XB-17 (base réelle) + U2-49. Statut : **FERMÉ**.

### E-V2-6 — Aucune route ne liste les revues PRÉ-REMPLIES (R467) — trouvé sur API vivante (V2-M41)
- **Constat** : l'écran « Revue & sortie » lisait `/v1/revues/kyc/KYC-2026-00447/delta` — une
  référence de MAQUETTE écrite en dur, qui n'existe dans aucune base. Sur une instance réelle
  la route répondait 404 et l'écran retombait éternellement sur son seed. Corrigé au lot : la
  référence est désormais RÉSOLUE depuis `/v1/kyc`.
- **Ce qui reste ouvert** : le delta n'existe que pour un dossier porteur d'un événement
  `review.prerempli` (ouverture d'une revue harmonisée, `POST /v1/revues/deadlines/:id/ouvrir`).
  Ce marqueur **n'est exposé par aucune lecture** : ni `/v1/kyc` ni `/v1/revues/deadlines` ne
  disent quels dossiers ont un delta. L'écran ne peut donc pas choisir un dossier valide — il
  essaie le premier et retombe sur le seed en le disant.
- **Cible** : soit un `GET /v1/revues/ouvertes` (projection des événements `review.prerempli`,
  aucune table nouvelle — même patron que les trois lectures de E-V2-5), soit un champ
  `revueOuverte` sur la liste KYC. Statut : **OUVERT** — arbitrage moteur requis.

### E-V2-7 — Le calendrier des obligations réglementaires n'a PAS de moteur (V2-M41)
- **Constat** : l'onglet « Réglementaire » du Pilotage lisait `/v1/rapports/kpi`. Cette route
  répond 400 sans période, et **avec** période elle rend des INDICATEURS de conformité
  (screening, risk cases, MROS, charge par analyste) — pas un calendrier d'obligations. L'écran
  retombait donc toujours sur son seed ; il aurait affiché « source : /v1/rapports/kpi » le jour
  où la route aurait répondu 200, en donnant à voir des chiffres qui ne sont pas des obligations.
- **Traitement retenu** : l'écran **cesse de prétendre** être branché. Il porte la mention
  « maquette — aucun moteur ne porte ce calendrier ». Une fausse source est pire qu'une source
  absente : elle survit aux relectures.
- **Cible** : le calendrier des échéances réglementaires (LBA art. 9, OBA-FINMA, AEOI/CRS,
  FATCA) est une **config gouvernée par la banque** (R29, registre R-Q), pas un calcul. Il lui
  faut une entrée de paramétrage versionnée par date d'effet, puis une lecture.
- **SOLDÉ au lot V2-M43 (12.08.2026)** — R490→R492, `spec/CALENDRIER-REGLEMENTAIRE-R490-R492.md`.
  Le calendrier est une clé du registre R-Q (`calendrierReglementaire`) : motivée, datée,
  append-only, rejouable — donc **aucune table nouvelle et aucune seconde vérité**. Le statut de
  chaque obligation est CALCULÉ à la lecture (R491) ; le dépôt est un acte humain motivé et
  référencé (R492/R7), refusé deux fois pour de bonnes raisons (obligation non déclarée ;
  second dépôt, dont le refus nomme la première référence). Le moteur SIGNALE les retards
  (R39/R44), il ne dépose ni ne régularise rien.
  **Ce qu'il ne fait pas, et c'est délibéré** : une obligation sans échéance (« sans délai »,
  LBA art. 9) n'est JAMAIS déclarée en retard. Fabriquer une date pour pouvoir colorer une
  pastille aurait été un jugement juridique que personne n'a demandé au moteur.
  **Le CONTENU reste à valider** : les quatre obligations du tenant de démonstration viennent de
  la maquette v1 et n'ont pas été vérifiées juridiquement (question Q-CR-1, consignée dans la
  spec pour revue humaine). Statut : **FERMÉ** côté mécanisme, contenu en attente de juriste.

### E-V2-8 — Le tenant de démonstration ne peuple pas sept lectures (V2-M41)
- **Constat, mesuré** : sur les 34 lectures des écrans v2 interrogées contre l'API vivante,
  **14** rendent un conteneur vide — `screening/hits`, `aml/signals`, `txflux`, `riskcases`,
  `trips`, `regwatch/items`, `formations/assignments`, `ged/documents`, et les quatre
  projections Cross-Border. La forme de leurs ÉLÉMENTS reste donc **invérifiée** : le
  vérificateur le dit au lieu de compter un succès.
- **Deux causes distinctes, à ne pas confondre** : le seed GWB (R329) ne raconte pas ces
  chapitres (hits, alertes, déplacements, veille, formations) ; et `/v1/crossborder/matrice`
  répond 404 « synchronisez le port » — la démo ne synchronise jamais le port XB (R453).
- **Cible** : étendre le seed de démonstration à ces chapitres, PAR LES VRAIES ROUTES comme le
  reste (jamais d'INSERT direct). Tant que ce n'est pas fait, aucune de ces sept familles n'est
  démontrable sur données réelles. Statut : **OUVERT**.

### E-V2-9 — Matrice documentaire : l'axe RÔLE manquait au moteur — **ARBITRÉ ET SOLDÉ** (V2-M42)
- **La question posée** (V2-M41, confirmée sur API vivante) : l'écran affichait la matrice plate
  de la v1 (une exigence, un état) ; le moteur détenait `exigences[typeEntite][porteur]`, sans
  rôle. Un **bénéficiaire effectif** et un **simple signataire** exigeaient donc exactement les
  mêmes pièces — alors que la CDB 20 n'exige le formulaire A que du premier (art. 27) et le
  formulaire K que du détenteur du contrôle d'une société opérationnelle non cotée (art. 20).
- **Ce n'était pas un choix de conception, c'était un manque.** R26 énonce déjà, mot pour mot
  (`docs/audit/RULES_INVENTORY.md`), que « les documents requis se déduisent du croisement type
  d'entité × juridiction × **rôle** », et le scénario S-03 de la spec nomme les rôles des
  personnes liées (« BE, signataire »). La v1 le faisait en colonnes
  (`DOC_STRUCTURES[].roles` × `DOC_LIST`, 7 structures × 23 pièces, `docRuleEval`).
- **Arbitrage PO du 12.08.2026 : ENRICHIR LE CONTRAT.** Le moteur porte désormais
  `parRole: { <role>: [exigences] }`, dans le bloc du type d'entité — les rôles sont donc
  naturellement portés par la structure, exactement comme en v1.
- **Trois propriétés non négociables, chacune sous garde** :
  1. `parRole` **AJOUTE** au socle `personne_liee`, il ne le remplace jamais — sinon déclarer un
     rôle RETIRERAIT des exigences et une matrice se relirait comme une dispense ;
  2. une version publiée **sans** `parRole` évalue **exactement** comme avant, même si le dossier
     porte des rôles (grandfathering R29 : un dossier validé ne devient pas rétroactivement
     incomplet parce que le contrat s'est enrichi) ;
  3. rien n'est deviné : un rôle absent de la matrice n'ajoute rien, une personne sans rôle
     déclaré ne reçoit que le socle.
- **Effet de bord trouvé en chemin** : deux versions à la MÊME date de vigueur (cas réel — le
  seed de démo en produit une en corrigeant sa matrice le jour de sa prise d'effet) laissaient
  la base choisir laquelle est « en vigueur ». Un rejeu qui ne rend pas deux fois le même verdict
  n'est pas un rejeu (R48) : le tri porte désormais sur `(enVigueurLe desc, version desc)`.
- **Gardes** : 10 tests ajoutés à `docmatrix.spec.ts` (13 → 23), chacun négativement testé en
  cassant l'implémentation ; FM-07 côté écran, sur une fixture capturée d'une API vivante qui
  porte réellement l'axe rôle. Statut : **FERMÉ**.

### E-V2-10 — Identifiants non validés : 500 au lieu d'un refus typé — **SOLDÉ** (V2-M44)
- **Trouvé par l'EXÉCUTION**, pas par la lecture : le balayage des 24 actes déclarés contre une
  API vivante a rendu cinq `500 Internal server error`. Quatre fois la même cause — un
  identifiant venu de la requête (`CLI-00001`, `u-004`) atteint un `where` Prisma sur une
  colonne UUID et le driver lève une erreur brute. La cinquième : `lireCle(obj, undefined)`.
- **Pourquoi ce n'est pas cosmétique** : l'écran rend le message du moteur verbatim (FE-04).
  Sur un 500 il affiche « Internal server error », soit le contraire d'un refus opposable — et
  n'importe quel appelant le déclenche en collant une référence d'écran.
- **Correction** : `common/identifiant.ts` (`uuidOuRefus`), appelé **au point de lecture** de
  l'identifiant et jamais en tête d'acte — la précédence des refus est contractuelle et n'a pas
  bougé (vérifié : « R7 : une dérogation cross-border exige un motif » sort toujours en premier).
  Gardes ID-01..05, négativement testées. Statut : **FERMÉ**.

### E-V2-11 — Un acte déclaré sans aucun champ — **SOLDÉ** (V2-M44)
- **Constat** : « Modifier un paramètre §CrossBorder » ne déclarait aucun champ — bouton présent,
  formulaire vide, refus « cle attendue » côté moteur. Invisible pour AC-03, qui vérifie que les
  champs déclarés sont LUS, jamais que ce que le moteur EXIGE est DÉCLARÉ.
- **Correction** : les quatre champs du contrat (`cle`, `valeur`, `enVigueurLe`, `confirmation`)
  sont déclarés ; l'acte va désormais jusqu'au pop-up d'engagement R445 (`409
  R445_CONFIRMATION_REQUISE`, ancien et nouveau compris). Garde **AC-05** : un acte POST dont le
  contrôleur lit un corps doit déclarer au moins un champ. Statut : **FERMÉ**.
- **Ce qui reste ouvert dans cette famille** : AC-05 ne couvre que le cas extrême (zéro champ).
  Un acte qui déclare *deux* champs sur les *quatre* exigés reste invisible statiquement — le
  moteur ne distingue pas, dans son DTO, le requis de l'optionnel. Seule l'exécution le dit.

### E-V2-8 — Sept familles invérifiables faute de données — **LARGEMENT SOLDÉ** (V2-M45)
- Le seed de démonstration raconte désormais dix chapitres de plus, **par les vraies routes** :
  liste de sanctions + run de screening, signal AML, cas de risque, déplacement (BT), catalogue
  et assignation de formation, source et collecte de veille, pièce GED ingérée.
- **Idempotence prouvée** (DM-02) : deux semis consécutifs sur base neuve → le second n'écrit
  rien (« aucun — tout était déjà semé »), les compteurs restent à 1.
- **Une leçon de méthode, payée comptant** : supertest ne LÈVE PAS sur un 4xx. Les chapitres
  enveloppés dans un `try/catch` « réussissaient » en n'écrivant rien — le silence exact que ce
  projet refuse partout ailleurs. Un helper `poser()` regarde le statut et le DIT ; c'est lui
  qui a révélé les quatre contrats mal appelés (`dateStart` et non `depart`, `canal` obligatoire
  R137, `scenarioCode` = identifiant du référentiel et non numéro de règle, un cas de risque qui
  exige un signal). **Reste ouvert** : les hits de screening (E-V2-12).

### E-V2-12 — Le screening de démonstration ne produit AUCUN hit, même sur un nom exact (V2-M45)
- **Mesuré** : liste importée avec l'entrée « Nordwind Handel SA », client du tenant nommé
  « Nordwind Handel SA », périmètre = 3 clients, run persisté (R103), `nbHits = 0`. Abaisser le
  seuil à 50 ne change rien. Le pré-filtre applique pourtant ses défauts documentés
  (`minPartages: 2, maxTrigrammes: 12, plafond: 400`, fusionnés dans `blocking.js`).
- **Pourquoi c'est sérieux** : pour un moteur de screening, « 0 hit » est le résultat le plus
  dangereux qui soit — il ressemble à un dossier propre. La cause n'est PAS identifiée ici et ne
  doit pas être devinée : piste à instruire en priorité, le type de sujet (`est_entite` du client
  déduit de sa structure) face au type de l'entrée de liste, et la pénalité de type associée.
- **Ce qui a été corrigé en chemin, et qui n'était pas ça** : un run sans `seuil` faisait
  `score >= undefined` (toujours faux, donc zéro hit EN SILENCE) puis tombait en 500 sur
  `screeningRun.create`. Le seuil effectif retombe désormais sur le paramètre gouverné
  `screeningSeuil` (R100, défaut 85). Garde SC-00.

- **CAUSE TROUVÉE ET CORRIGÉE au lot V2-M46.** Ce n'était ni le seuil, ni le pré-filtre, ni le
  type de sujet — c'était un **désaccord de format entre deux routes du même module** :
  - `POST /v1/screening/listes/importer` NORMALISE les entrées (`ingererListe` : `name` →
    `nom_complet`, `id` → `uid`) ;
  - `POST /v1/screening/run` indexait `dto.entries` **BRUTES**.
  Une entrée au format DOCUMENTÉ de l'import (`{id, name}`) produisait donc un index trigramme
  **sans aucun trigramme** — `nom_complet` étant `undefined`. Zéro candidat, zéro hit, et un run
  persisté « 0 hit » : pour un moteur de screening, un dossier propre qui ne l'est pas.
  Mesuré en isolant le moteur : index sur entrées brutes → **0 candidat** ; sur entrées
  normalisées → **1 candidat, score 100**.
  Pourquoi aucun test ne le voyait : les suites parlaient déjà le format INTERNE
  (`{uid, nom_complet}`). Personne n'avait jamais fait tourner ENSEMBLE la route d'import et la
  route de run — c'est le semis de la démonstration par les vraies routes qui les a confrontées.
  **Correction** : `run()` normalise par `ingererListe`, exactement comme l'import. La fonction
  est idempotente, donc le format interne traverse inchangé. Garde **SC-0B** (les deux formats),
  écrite ROUGE avant la correction. Démonstration : hit score 100 sur « Nordwind Handel SA ».
  Gate golden du matcher inchangé (R405–R407, R410). Statut : **FERMÉ**.

### E-V2-13 — Un refus du moteur en LECTURE n'atteignait jamais l'écran — **SOLDÉ** (V2-M47)

`apiGetSourced` (couche transverse, traversée par TOUS les écrans) attrapait toute réponse
non-2xx dans un `catch` muet et retombait sur le seed. Un 404 **motivé** du moteur devenait donc
un écran silencieux.

Trouvé en confrontant le nouvel onglet Exigences à l'API vivante :

```
GET /v1/inference/<kycId>/ledger
  → 404  P-L7-1 : aucun CompletionProfile pour (PP, CH) — ni profil exact, ni repli « * »
  écran → seed vide, aucun message
```

Le message perdu était **la seule information exploitable** : il nomme la paire
(type d'entité, juridiction) qu'il faut publier au référentiel. Sans lui, l'utilisateur voit un
onglet vide et n'a aucun moyen de savoir quoi faire.

**Soldé** : `apiGetSourced` remonte `refus: { code, status, message }` (champ ADDITIF — aucun
appelant existant modifié), `useApiOrSeed` le propage, l'onglet l'affiche mot pour mot (FE-04).
Gardes **FE-04b** (le message arrive) et **FE-04c** (une panne réseau n'invente pas de refus).

**Portée** : la correction est dans la couche transverse — tout écran qui veut afficher un refus
de lecture peut désormais le faire. Les écrans existants ne changent pas de comportement tant
qu'ils ne lisent pas `refus`. Les recâbler un par un est un travail à part, non fait ici.

### E-V2-14 — `missionsActives` : l'interrupteur exigé par SW-18 n'a aucune clé gouvernée (V2-M47)

**OUVERT** — consigné, non corrigé (hors périmètre du lot).

`swarm.module.ts:248` lit `settings.missionsActives` directement dans les settings du tenant.
Le défaut `[]` est juste (SW-18/B.5 : la v2 est ÉTEINTE tant qu'on ne l'allume pas). Ce qui
manque est l'**interrupteur** : `POST /v1/parametres/valeur/missionsActives` répond
« R125 : clé inconnue du registre », et le registre gouverné compte 251 clés dont **aucune** ne
concerne les missions, les runs ou Olivia. Le seul chemin d'activation aujourd'hui est un
`UPDATE` direct sur `tenants.settings` — précisément ce que R125-R128 existent pour empêcher.

**Conséquence mesurée** : `/v1/olivia/runs` répond `[]` et le restera ; la forme des lignes n'a
donc pas pu être relevée sur l'API vivante en V2-M47.

**Piste (à arbitrer, pas décidée)** : déclarer `olivia.missionsActives` au registre R125 et faire
lire le moteur **à date** (R29), comme la résolution d'agent (SW-01/SW-02) le fait déjà — pour
qu'une désactivation ne réécrive pas le contexte des runs passés. Détail :
`docs/notes/missions-olivia-sans-cle-gouvernee.md`.

### E-V2-15 — Trois capacités « Transactions & Marchés » : une seule manquait d'écran (V2-M48)

**PARTIELLEMENT SOLDÉ.** Le registre portait trois fois le même motif — « onglet Transactions
commun » — qui décrivait l'écran sans diagnostiquer la cause. Mesure sur API vivante :

| capacité | ce qui manquait RÉELLEMENT | issue |
|---|---|---|
| `swiftlab` | rien d'autre que l'écran — `/v1/swift/*` n'exige aucun port | **soldé** : onglet SWIFT/SEPA (acte + messages + quarantaine) |
| `settlement` | le **port core banking** — phase 1 lecture seule, port injecté vide (R114/R167) | vue livrée, **reste partiel** : elle dit l'absence de port |
| `txrisk` | le même port — R298 agrège le flux (R297), qui est vide sans port | **reste partiel**, blocage nommé |

`/v1/txrisk/tendances` répond `{parMois:{}}` non par défaut d'implémentation mais parce que
`/v1/txflux` est vide, faute de port. Un écran de tendances aurait affiché un graphe vide en
laissant croire à une absence de risque.

**Arbitrage dû au PO** : configurer un port core banking (Avaloq / Temenos / Finnova / ERI) est une
décision d'intégration, pas une tâche d'écran. Tant qu'elle n'est pas prise, ces deux capacités
restent honnêtement amputées — et la doctrine R167 interdit de combler le vide par une fixture en
production.

### E-V2-16 — Le chapitre « veille » du semis n'est pas idempotent (V2-M48)

**OUVERT** — observé, non corrigé (hors périmètre).

Au second passage du semis sur une base déjà semée, tous les chapitres se taisent SAUF « source de
veille » et « collecte de veille », qui se re-posent à chaque exécution. Cause : la garde
d'idempotence teste `/v1/regwatch/items`, or le flux de test est env-gaté (`REGWATCH_FAKE_FEED`) —
sans lui la collecte ne produit aucun item, la garde reste donc toujours vraie et le chapitre
rejoue. Conséquence pratique nulle aujourd'hui (la source est un upsert de paramètre), mais c'est
une idempotence apparente et non réelle : elle mérite d'être corrigée par une garde qui teste ce
que le chapitre écrit VRAIMENT, pas ce qu'il espère produire.

### E-V2-17 — Cinq écrans liront `undefined` : les seeds nomment ce que le moteur ne sert pas (V2-M50) — **SOLDÉ** (V2-M51)

**SOLDÉ** par cinq adaptateurs (`moteur-formes.ts`, FM-08..12 contre fixtures capturées sur API
vivante) : `nom ← detail.via`, `liste ← listeVersion`, `formation ← formationCode`,
`statut ← outcome ?? status`, `origine ← compte des signaux (R280)`, `pays ← destinations[]`.
Les champs que le moteur ne détient pas (`visaChain`, `reference` des cas/voyages) restent VIDES,
et les commentaires disent pourquoi. Vérificateur : 5 écarts → 0. Historique du constat :

Le vérificateur de formes annonçait « 0 écart non traité » tant que ces routes répondaient `[]`.
Il l'avait écrit lui-même : *une réponse vide ne prouve rien sur la forme des éléments*. Les semis
des lots V2-M45 et V2-M48 les ont peuplées, et la comparaison devient possible :

| écran | route | champs que l'écran attend et que le moteur NE SERT PAS |
|---|---|---|
| `EntreeRelation` | `/v1/trips` | `reference`, `pays`, `depart`, `visaChain` |
| `Pilotage` | `/v1/formations/assignments` | `collaborateur`, `formation` |
| `Surveillance` | `/v1/screening/hits` | `nom`, `liste` |
| `Surveillance` | `/v1/aml/signals` | `statut`, `at` |
| `Surveillance` | `/v1/riskcases` | `reference`, `origine` |

Le moteur sert autre chose sous d'autres noms — par exemple, pour les hits de screening :
`entreeUid`, `listeVersion`, `matchScript`, `detail.nameScore`. **La file de screening afficherait
donc des colonnes vides en production**, ce qui est plus grave que les autres : c'est l'écran de
qualification des hits.

**Conduite** : appliquer la règle déjà posée en V2-M41 — *le moteur nomme, l'écran suit*. Soit un
adaptateur dans `moteur-formes.ts` (avec fixture capturée en vrai, jamais écrite à la main), soit
un renommage côté écran. Jamais un ajout de champ au moteur pour faire plaisir à un écran.

### E-V2-18 — Le compartiment paresseux ignore la couche v1 des mêmes modules (V2-M50)

**OUVERT** — mesuré, non corrigé.

La doctrine posée en V2-M49 dit qu'un module vendu à part ne doit pas peser sur le socle. Elle
n'est appliquée qu'aux écrans v2. Les écrans v1 des mêmes modules licenciés sont pourtant comptés
dans le cœur : `CustodyTa` 1,26 · `LegalRegistre` 1,22 · `OpRisk` 1,59 · `PmsMandats` 1,87 ·
`MobileAdmin` 1,69 kB gz — **7,6 kB**.

Ils sont déjà chargés paresseusement par le routeur v1 : il ne manque que leur entrée au
compartiment. Mais les y verser revient à statuer sur le sort de la couche v1 (destinée à
disparaître avec la migration v2 ?), ce qui est un arbitrage PO et non un geste technique.
