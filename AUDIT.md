# AUDIT O-Live — état des lieux

> Audit en lecture seule du dépôt `collabraboard` (produit O-Live). Aucun fichier de code
> modifié pour cet audit. Daté du 2026-08-01. Réalisé par exploration du dépôt + exécution des
> suites de tests exécutables sans base de données.

**TL;DR** — O-Live est un **monorepo pnpm** avec un backend **NestJS** (pas FastAPI) réellement
event-sourcé, ~230 endpoints REST sous `/v1`, une isolation multi-tenant par RLS **créée mais
dormante par défaut**, un optimistic locking **présent comme mécanisme mais pas encore adopté par
les handlers**, et deux fronts React (production **branché API** avec repli seed/démo ; parité
**offline** sur fixtures). Suites unitaires + règles : **506/506 vertes** ; e2e (51 specs) non
exécutables ici (nécessitent un Postgres via Docker, indisponible).

---

## 0. Topologie du dépôt

| Zone | Rôle |
|---|---|
| `apps/api` | Backend **NestJS 10 + Express + Prisma 5 + PostgreSQL**, préfixe global `/v1`. Cœur métier + event store. |
| `apps/web` | Front **React + Vite**. Deux surfaces : `src/features/**` (production, branché API) et `src/parity/**` (clone offline dev-only du mockup). |
| `services/workflow-engine-py` | Moteur workflow **réimplémenté en Python** + adaptateur **FastAPI** (`uvicorn`) — banc de rejeu / cross-validation, pas la porte de prod. |
| `services/cpsi-server-py` | Pont CPSI Python (shell-out, sans HTTP) rejoué par la porte NestJS. |
| `services/screening`, `packages/workflow-engine`, `packages/shared` | Moteurs/paquets partagés (Node). |

---

## 1. Le moteur event-sourcé

Il existe **deux** moteurs event-sourcés :

### 1.a Backend `apps/api` (le moteur de production)
Architecture **outbox / projecteurs** autour d'un event store Prisma.

- **Event store** : modèle `DomainEvent` (`apps/api/prisma/schema.prisma:256`) — `type`, `aggregateId`
  (code métier OU uuid), `payload` (Json), `eventVersion` (upcasting), `at`, `publishedAt` (marqueur
  outbox). Idempotence des commandes : `ProcessedCommand` (`commandId`, `resultHash`,
  `responseSnapshot`, R337). Watermarks `EventConsumer`, `EventDeadLetter`.
- **Émission unique** : `OutboxWorker` (`modules/events/outbox.worker.ts`) — livraison at-least-once,
  watermark par consommateur, retry/backoff, dead-letter, publication webhook HMAC (R285/R286).
- **Projecteurs / consommateurs** :
  `GoldenRecordProjector` (`golden-record.projector.ts`, R104 : `kyc.validated` → Client),
  `CaseProposalConsumer` (`case-proposal.consumer.ts`, R286 : `cpsi.case_proposal.emitted` → risk case).
- **Upcasting** : `upcasters.ts` (R339) appliqué à la lecture (journal append-only).
- **Rejeu à date (`asOf`)** = l'implémentation R48/R49 en bande : `workflow-instances.module.ts:87`,
  `cpsi.module.ts:104`, `tasks.module.ts:95`, `txrisk.module.ts:95`, front `lib/api.ts:82`.
- **Agrégats de domaine visés par les événements** : `KycFile` + `KycVisa` (l'« instance de
  workflow »), `Client` (golden record), `ScreeningRun`/`ScreeningHit`, etc.
- Moteurs de règles nommés en bande : `kyc/rules/named-validator.ts` (R2/R4),
  `kyc/rules/section-four-eyes.ts` (R13/R52) — « portés fidèle » depuis le moteur Python de référence.

### 1.b Front parité `apps/web/src/parity/olive-wf-engine.tsx` (`class OliveWfEngine`)
Moteur event-sourcé **en mémoire**, autonome, porté verbatim du mockup (en-tête : « R1–R62 »).
Machinerie : `emit()` (append + freeze + `apply`), `apply()` (dispatch `on<Type>`), `audit()`,
export scellé SHA-256 chaîné (`exportSealed`/`verifySealed`).

**Agrégats** : `Dossier` (racine KYC), `Section` (dont section synthétique `__FINAL__`), `Visa`
(objet-valeur, machine `AUCUN→EN_ATTENTE→ACCORDE/REFUSE/INVALIDE/ANNULE`), `Process` (sous-process
CoC `EVENEMENT` / recertification `RECERT`), `TenantRule`, registres annexes (rejets, récusations,
habilitations, absents).

**Commandes (extrait)** : `createDossier`, `editField`, `submitForVisa`, `setValidator`,
`grantVisa`, `grantVisaByDerogation`, `refuseVisa`, `revokeVisa` (lève toujours — R9),
`changeOfCircumstances`, `startRecertification`, `reassignValidator`, `tickReminder`,
`attachScreeningAlert`, `suspendForMros`, `reject`, `evalInactivity`, `reactivate`,
`requestErasureLpd`, `recuseVisa`, `setHabilitation`, `setScoreRisque`, `exportSealed`.

**Événements (extrait des littéraux `type`)** : `DOSSIER_CREE`, `CHAMP_MODIFIE`, `SECTION_SOUMISE`,
`VALIDATEUR_DEFINI`, `VISA_ACCORDE`, `VISA_REFUSE`, `VISA_ANNULE`, `DEROGATION_PRONONCEE`,
`VISA_TENTATIVE_REFUSEE`, `ENGAGEMENT_RESPONSABILITE`, `VISA_FINAL_PREMIER_SIGNATAIRE`,
`DOSSIER_SUSPENDU`, `DOSSIER_REJETE`, `DOSSIER_ABANDONNE`, `DOSSIER_REACTIVE`, `COC_RECU`,
`RECERT_DEMARREE`, `EVENEMENT_CLOTURE`, `DOCUMENT_RECU`/`_EXPIRE`, `REGLE_TENANT_AJOUTEE`/`ACTIVEE`,
`HABILITATION_DEFINIE`, `SCORE_RISQUE_DEFINI`, `RECUSATION_PRONONCEE`, `ESCALADE_EMISE`,
`EXPORT_SCELLE_EMIS`… (~45 types, chacun avec son réducteur `on<Type>`).

### 1.c Règles R1–R51 : implémentées vs manquantes (dans `apps/*`)

> Convention : **IMPL** = réellement appliquée (branche/lève sur la règle) ; **REF** = citée en
> commentaire/UI/doc seulement ; **ABSENT** = numéro introuvable dans `apps/*` (peut vivre dans
> `docs/`, le questionnaire R-Q `docs/CANON-MASTER.md`, ou le moteur Python de référence).
> Faux positifs exclus : les `R1/R2/R3` suffixes de révision (`KYC-…-R2`) et les id de matrice
> documentaire locale (`preonboarding-support` : Form K/T/S).

| R | Statut | R | Statut | R | Statut |
|---|---|---|---|---|---|
| R1 | REF (borne de plage) | R18 | ABSENT | R35 | **IMPL** (personnes.service `R35`) |
| R2 | **IMPL** (named-validator) | R19 | ABSENT code (R-Q ; parité `evalInactivity`) | R36 | **IMPL** (corroboration) |
| R3 | ABSENT | R20 | ABSENT | R37 | ABSENT code (R-Q) |
| R4 | **IMPL** (relais nommé/dérog.) | R21 | ABSENT | R38 | ABSENT |
| R5 | ABSENT code (R-Q ; parité `tickReminder`) | R22 | ABSENT | R39 | **IMPL** (mesure & notifie) |
| R6 | ABSENT | R23 | ABSENT | R40 | ABSENT |
| R7 | **IMPL** (motif obligatoire) | R24 | REF (revue périodique) | R41 | ABSENT code (R-Q) |
| R8 | ABSENT | R25 | ABSENT code (R-Q) | R42 | **IMPL** (rescreening immédiat) |
| R9 | **IMPL** (pas de révocation) | R26 | REF (matrice doc) | R43 | ABSENT code (R-Q) |
| R10 | ABSENT | R27 | ABSENT | R44 | **IMPL** (IA propose/humain décide) |
| R11 | **IMPL** (réassignation owner) | R28 | ABSENT | R45 | ABSENT code (R-Q) |
| R12 | ABSENT | R29 | **IMPL** (grandfathering/date d'effet) | R46 | ABSENT |
| R13 | **IMPL** (four-eyes, partout) | R30 | **IMPL** (référentiel personne unique) | R47 | ABSENT code (R-Q ; `AUDIT_ACCESS` non tagué) |
| R14 | **IMPL** (engagement final) | R31 | **IMPL** (cumul rôles paramétré) | R48 | **IMPL** (rejeu à date) |
| R15 | **IMPL** (visa uniforme) | R32 | **IMPL** (PEPisation contagieuse) | R49 | **IMPL** (journal append-only) |
| R16 | ABSENT | R33 | **IMPL** (le délai ne dé-PEPise pas) | R50 | ABSENT |
| R17 | ABSENT code (R-Q ; parité `restrictions`) | R34 | **IMPL** (bijectivité liens) | R51 | ABSENT |

**Bilan R1–R51 (dans `apps/*`)** : **22 IMPL** (R2, R4, R7, R9, R11, R13, R14, R15, R29–R36, R39,
R42, R44, R48, R49) · **3 REF** (R1, R24, R26) · **26 ABSENT** dont 9 restent des questions ouvertes
du questionnaire R-Q (R5, R17, R19, R25, R37, R41, R43, R45, R47).

**Nuances importantes** :
1. Le catalogue autoritatif n'est **plus** `docs/CATALOGUE-REGLES-R1-R206.md` (gelé/déprécié) mais
   `docs/CANON-MASTER.md` (généré, gardé par CI), qui couvre désormais R1–R339+.
2. Les définitions canoniques R1–R52 du workflow vivent dans le moteur Python de référence
   `services/workflow-engine-py/olive_engine/domain.py` (144 références de règles) — hors des deux
   arbres `apps/*` audités, mais source dont `named-validator.ts`/`section-four-eyes.ts` disent
   « portés fidèle ».
3. Le moteur de parité implémente aussi R56–R62 (hors plage R1–R51).

---

## 2. Couche API

**Oui — et ce n'est PAS FastAPI pour la porte de production.**

- **API principale : NestJS 10 + Express (TypeScript)**, `apps/api`. Préfixe global **`/v1`**
  (`main.ts:7`). Démarre seulement si `AUDIT_HMAC_SECRET` est défini. ~55 classes contrôleur,
  **~230 endpoints REST**.
- **Service FastAPI secondaire** : `services/workflow-engine-py/olive_engine/api.py`
  (`FastAPI(title="O-Live Engine")`, `uvicorn`) — adaptateur du moteur Python, 5 routes
  (`POST /dossiers/{id}/sections/{section}/visa`, `…/refus`, `GET /dossiers/{id}/audit`,
  `GET /audit/preuve-4yeux`, `GET /dossiers/{id}/etat-a-date`). Banc de validation croisée, hors
  surface NestJS.

**Sécurité / middleware** : `SecurityHeadersMiddleware` + `TenantMiddleware` (JWT RS256, résolution
`kid` via JWKS, période de grâce ; pose `req.ctx` + RLS). Routes publiques : `/v1/auth/token|login|
methode|oidc/login`, `/v1/.well-known/jwks.json`, `/v1/healthz`, `/v1/readyz`. Population **mobile**
isolée (`garderMobile`). Rôle **SO** restreint à un allowlist audit-only pré-routage. `RolesGuard`
+ `@Roles("ADMIN")` sur `admin/*`. `LoginRateLimiter` (Redis si `REDIS_URL`, sinon mémoire).

**Inventaire des endpoints (par contrôleur, sous `/v1`)** :

- **auth** — `POST auth/token`, `auth/login`, `auth/methode`, `auth/oidc/login` · `GET .well-known/jwks.json` · `POST auth/mfa/enroll|confirm`
- **admin/users** [ADMIN] — `GET admin/users` · `POST admin/users`, `…/:id/active|role|reset-mfa`
- **admin/sso** [ADMIN] — `GET admin/sso/etat` · `POST admin/sso/test|jwks/rotation|mode|mode/visa`
- **admin/iam** [ADMIN] — `GET admin/iam/guide`
- **clients** — `GET clients` · `POST clients`, `clients/:id/events`
- **kyc** — 20 routes : `POST/GET kyc`, `GET kyc/visas/pending|charge`, `GET kyc/:code[/access-matrix|/a-date|/voir-comme/:role]`, `PATCH kyc/:code/questions/:qcode[/access]`, `POST kyc/:code/visas/:section|validate|lock|release|request-hand|pass-hand|handoff/next|back|validate|reject`
- **ged** — `GET ged/documents[/:id][/contenu/:versionId]`, `GET ged/recherche|vues/:code` · `POST ged/documents[/:id/classement|/gel]`
- **onboarding** — `POST onboarding[/:id/transition|/sandbox]` · `GET onboarding[/:id/funnel]`
- **ia/prerevue** — `POST ia/prerevue/kyc/:id|/:id/points/:idx|/prompt` · `GET ia/prerevue/:id|/kyc/:id/traitement`
- **parametres** — `GET parametres/registre|valeur/:cle|config` · `POST parametres/valeur/:cle|activer`
- **crm** — `GET crm/clients/:id/timeline|gestes` · `POST crm/clients/:id/entretiens[/pre-remplir]`
- **workload** — `GET workload/equipes/:role|mesures/:userId|points/:userId` · `POST workload/equipes/:role/surcharges|snapshot-rh`, `workload/taches/:id/reassigner`
- **aml** — `POST aml/evaluer|sandbox` · `GET aml/clients/:id/signaux|referentiel`
- **islamic** — `POST islamic/evaluer|zakat|mudaraba|waqf/retrait|qard|takaful|sukuk/maturite|audit` · `GET islamic/clients/:id/signaux|zakat`
- **riskcases** — `POST riskcases[/consommer-proposition|/:id/transition|/:id/notes|/:id/rattacher|/:id/detacher]` · `GET riskcases[/:id/notes]`
- **screening** — `POST screening/run|hits/:id/qualify` · `GET screening/hits|runs`
- **personnes** — `POST personnes[/:id/roles|/relations|/:id/coc|/:id/corroboration]` · `GET personnes/:id/relations`
- **transactions** — `POST transactions/evaluer|:id/decider` · `GET transactions/revue|:id/statut-client`
- **mros** — `POST mros/decider|:id/notification|:id/gel|:id/gel/lever` · `GET mros[/:id]`
- **corebanking** — `GET corebanking/etat` · `POST corebanking/importer`
- **workflow** — `POST workflow/definitions[/:id/publier]` · `PATCH workflow/definitions/:id` · `GET workflow/definitions|resoudre`
- **workflow-instances** — `GET workflow-instances[/:id][/events]`
- **pms** — `POST pms/mandats|:id/pre-trade`, `pms/breaches/:id/clore` · `GET pms/mandats[/:id/valoriser]|clients/:id/adequation|breaches`
- **tasks** — `GET tasks` · `POST tasks[/from-event|/:id/complete|/:id/reassign|/sla/tick]`
- **nba** — `GET nba[/:id]` · `POST nba/propose|:id/decision`
- **formations** — `GET formations/catalog|assignments|certifications` · `POST formations/assignments[/:id/complete|/:id/visa]|certifications|rappels/tick`
- **trips (businesstrip)** — `POST trips[/:id/submit|/:id/visa|/:id/revise|/:id/contact-reports/mesurer]` · `GET trips[/:id]`
- **reviews** — `GET reviews/deadlines|profils` · `POST reviews/clients/:clientId/recalcul|deadlines/:id/anticiper|report[/visa]|lancer|tick|kyc/:code/reconfirmer/:section|signaler-changement`
- **coc** — `GET coc[/config|/reporting|/:id/replay]` · `POST coc[/config|/:id/traiter|/:id/transition]`
- **offboarding** — `POST offboarding[/:id/transition|/:id/visa|/:id/documents|/:id/attestation-avoirs]` · `GET offboarding[/:id|/statut/:clientId|/:id/courrier]`
- **cpsi** — 29 routes (santé, clients/score/signals, segmentation, catalogue, règles, groups, scenarios, alerts, timeline, volumetrie, sandbox/simulate, params/proposals[/adopt|reject|apply|history], false-positives, insider[/lift], reporting/sla[/tick], case-proposals)
- **olivia** — `POST olivia/conversations[/:id/messages|/:id/feedback]|proposals[/:id/adopt|reject]` · `GET olivia/conversations/:id[/replay]|proposals|health`
- **olivia (swarm, même base path)** — `GET/POST olivia/tools|agents[/:code/retirer|/:code/en-vigueur]|runs[/reprise|/:id/gate-decision|/:id/replay|/agregat|/:id|/:id/stop]|missions`
- **crossborder** — `POST crossborder/check|derogations[/:id/visa]|ordres` · `GET crossborder/voyages/:id/conformite|reporting`
- **txflux / txrisk / fx / swift** — `GET/POST txflux/etat|importer`, `txrisk/alimenter|tendances`, `fx/exposition`, `swift/analyser|messages|quarantaine`
- **custody / ta** — `GET custody/positions|rapprochement`, `POST custody/ecarts/resoudre` · `POST ta/mouvements[/:ref/visa|/:ref/contrepasser]`, `GET ta/registre`
- **builder** — `POST/GET builder/artefacts[/:id/simuler|/:id/publier]|publications`
- **regwatch** — `POST regwatch/collecter|items/:e/proposer|qualifier|digest` · `GET regwatch/items`
- **legal** — `POST legal/objets[/:id/dates]|tick` · `GET legal/objets|par-reference|echeances`
- **bi** — `POST bi/requete|annuaire`
- **mobile** (2 contrôleurs) — banquier : `POST mobile/activer|partager|messages/:c/repondre|messages/:id/ouvrir-coc`, `GET mobile/messages` · client : `POST mobile/auth/activer|login|client/messages`, `GET mobile/client/documents|comptes|messages`
- **oprisk** — `POST oprisk/incidents[/:id/transition]|actions[/:id/statut]|tick` · `GET oprisk/incidents|heatmap|actions`
- **sandbox** — `POST sandbox/kyc-droits|brm-seuils|onb-aiguillage|cf-exigences|wf-delais`
- **ports** — `GET ports[/:portId/health]` · `POST ports/:portId/health`
- **modules (license)** — `GET modules/actifs` · `POST modules/licence[/tick]`
- **audit** [SO/DIR] — `GET audit/acces|integrite|parametrages` · `POST audit/export`
- **apidoc** — `GET apidoc` (inventaire de routes vivant)
- **events** — `GET events/sante|stream` (SSE) · `POST events/dead-letters/:id/rejouer`
- **readiness / deploiements** — `GET healthz|readyz` (racine, publics) · `POST/GET deploiements`

---

## 3. Schéma PostgreSQL — RLS multi-tenant & optimistic locking

### 3.a RLS multi-tenant : **créée, mais dormante par défaut**

- **Créée ? OUI** — SQL généré dans `apps/api/prisma/post-deploy-v2.sql` (script `prisma:post`,
  appliqué après `prisma db push`). Boucle `DO $$ … FOREACH t IN ARRAY[~70 tables] LOOP` gardée par
  un contrôle `information_schema` (table existe ET a une colonne `tenant_id`) :
  `ENABLE ROW LEVEL SECURITY` + **`FORCE ROW LEVEL SECURITY`** + `CREATE POLICY tenant_isolation …
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (…)`.
  (L'ancien `post-deploy.sql` v1 — 6 tables, ENABLE sans FORCE — est déprécié et non référencé.)
- **Contexte tenant par requête** : GUC `app.tenant_id`, posé **non** par le middleware mais par
  `prisma.service.ts` `withTenant()` via `set_config('app.tenant_id', $1, true)` (SET LOCAL, scope
  transaction), **derrière le flag `FF_RLS_ENFORCED`**.
- **Tables couvertes** : ~70 tables tenant ; **exclues explicitement** : 6 tables filles KYC sans
  `tenant_id` (`kyc_sections`, `kyc_questions`, `kyc_access_rules`, `kyc_question_history`,
  `kyc_visas`, `kyc_lock_requests`) — isolées transitivement par FK + filtre applicatif — et
  `event_consumers` (infra sans tenant). Politique RESTRICTIVE supplémentaire sur
  `offboarding_sensibles` (LBA art. 10a, R270).
- **Recette anti-fuite** : `test/e2e/rls-runtime.e2e-spec.ts` (« recette 4b ») — en rôle non-owner
  `olive_app`, `SELECT count(*) FROM clients` **sans GUC → 0** ; avec GUC → seules les lignes du
  tenant ; anti-bypass (`olive_app` non superuser/non `bypassrls`, 0 table possédée).
- **⚠ Dormante en prod par défaut** : l'app se connecte en **`olive` (superuser/owner)** qui
  contourne même FORCE RLS, et `FF_RLS_ENFORCED` est **off**. L'isolation active aujourd'hui repose
  sur le **filtrage applicatif `WHERE tenant_id = ctx.tenantId`** ; la RLS moteur est prouvée en base
  (recette 4b) mais mise en service par un déploiement en deux temps (bascule `DATABASE_URL` →
  `olive_app` + activation du flag). Documenté dans `docs/multi-tenancy.md`.

### 3.b Optimistic locking : **mécanisme présent, non encore adopté par les handlers, off par défaut**

- **Implémenté (mécanisme) : OUI** — `apps/api/src/common/optimistic-lock.ts` : `majVersionnee()` =
  compare-and-set `updateMany({ where: { id, version: expectedVersion }, data: { …, version:
  { increment: 1 } } })` ; si 0 ligne touchée et flag `FF_OPTIMISTIC_LOCKING` on →
  `ConcurrencyConflictError` ; sinon mode « shadow » (log + applique quand même, legacy). R336/LK.
- **Colonne de version** : **seul `KycFile` porte un vrai jeton** (`schema.prisma:99` `version Int
  @default(0)`, migration dédiée). Les 3 autres `version Int` (`WorkflowDef`, `OliviaAgent`,
  `BuilderVersion`) sont des **numéros de version métier de registres**, pas des jetons de verrou.
- **Adoption** : **aucun service/contrôleur de prod n'appelle encore `majVersionnee`** (grep :
  uniquement le module commun + ses specs). `core.module.ts` le documente : rien ne lève l'erreur
  tant que le flag est off ET qu'aucun handler n'adopte le compare-and-set.
- **Mapping HTTP 409 : OUI** — `ConcurrencyConflictFilter` → `HttpStatus.CONFLICT` (corps
  `{ error:"concurrent_modification", aggregate_id, expected_version }`), enregistré globalement
  (`APP_FILTER`, `core.module.ts`).
- **Tests** : unit `optimistic-lock.spec.ts` (LK-01/03) ; e2e `optimistic-lock.e2e-spec.ts` (LK-02 :
  deux updates concurrents sur le même `kyc_files` → exactement un succès, un conflit, `version===1`).

---

## 4. Front React — écrans & branchement API vs mocks

**Deux surfaces distinctes.**

### 4.a Production `apps/web/src/features/**` (routeur `app/router.tsx`)
Toutes les données passent par **`lib/api.ts`** (`apiGet`/`apiGetSourced`/`apiPost`), souvent via le
hook `useApiOrSeed(path, SEED)` : si `window.OLIVE_API_URL` est défini → **API réelle** ; sinon (ou
sur erreur/401) → repli sur un **SEED** avec `isDemo=true` et bannière `<DemoModeBanner/>`.

**Verdict : tous les écrans production sont branchés API avec repli seed/démo — sauf un.**
- **73 ids routés** (`router.tsx`) → ~71 composants distincts (les deep-links sandbox
  `sbkyc/sbbrm/sbcf/sbwf` résolvent tous vers `Sandboxes` ; `KycDetail` rendu dans la route `kyc`).
- **83 fichiers `.tsx`** sous `features/` (le reste = 4 sous-composants partagés + 1 orphelin
  `kyc/KycCreate.tsx` non routé).
- **Seule exception mock-only** : `bat/BatCampagne.tsx` — aucun câblage API, rend toujours une
  constante `DEMO` en dur (le routeur ne lui passe pas de prop `campagne`).

Exemples de câblage : `clients` → `GET /v1/clients` ; `kyc` → `GET/POST /v1/kyc/*` ;
`screening` → `POST /v1/screening/run` ; `cpsiParam` → `GET/POST /v1/cpsi/*` ;
`paramfields` → `GET /v1/parametres/registre` ; `command`/`compliance` → agrégat multi-endpoints via
`Projection`/`Tuile`. (Inventaire complet ligne à ligne disponible sur demande.)

### 4.b Parité `apps/web/src/parity/**` (routeur `parity/Shell.tsx`) — **offline**
Clone dev-only du mockup. **0 import de `lib/api`, 0 `useApiOrSeed`, 0 `fetch`.** Données = fixtures
`apps/web/src/fixtures/*.json` (19 fichiers) + état de modules `*-support.ts` (~50 modules).

- **65 ids `case`** dans `Shell.tsx` → **63 fichiers `*Screen.tsx`** (des ids partagent un composant :
  `home`+`dashboard`, `wfmanagement`+`wfdesigner`, `sdkyc`+`sdar`+`sdgar`).
- **Verdict : 100 % offline / mock-fixture.** C'est intentionnel — la parité est un banc de fidélité
  visuelle dev-only, jamais bâti dans `dist` (vérifié : `build` → 0 fuite parité).

> Note : le grand chantier en cours de cette session est le **portage écran par écran** de la
> maquette vers la parité. Écrans encore en Placeholder à la date de l'audit :
> `prospect_onboard`, `trip`, `olivia`, `paramnav`, `ssoparam`, `admin`, `editorconsole`.

---

## 5. Résultat exact des tests

| Suite | Commande | Résultat | Notes |
|---|---|---|---|
| Web — unitaires (vitest) | `pnpm --dir apps/web run test:unit` | **80 / 80 verts** (2 fichiers : `screens.test.tsx` 73 + `api.test.ts` 7) | ~4 s |
| API — règles moteur (harnais autonome, **sans DB**) | `bash apps/api/scripts/run-rule-tests.sh` | **426 / 426 verts**, exit 0 | ~50 blocs (KYC R84/85/86, IAM, screening, personnes, PMS, GED, onboarding, IA, paramètres R-Q **8/8 dont RQ-07**, MROS, risk cases, AML 45/45, Shariah 41/41, feature-flags, optimistic-lock 4/4, idempotency 4/4, upcasters 3/3, …) |
| API — e2e (jest, DB réelle) | `pnpm --dir apps/api run test:e2e` | **NON EXÉCUTÉ ici** | **51 fichiers `*.e2e-spec.ts`**. Exige un Postgres via `docker compose … up` + `prisma db push` + `prisma:post`. **Démon Docker indisponible dans cet environnement** → suite non lançable ici. Couvre notamment la recette RLS (`rls-runtime`) et l'optimistic locking concurrent (`optimistic-lock`). |

**Total exécutable ici : 506 tests, 506 verts.** Les e2e (RLS runtime, verrou concurrent, parcours
golden/FAT) requièrent la base — non exécutables dans cet environnement sandboxé (pas de démon
Docker).

---

## Synthèse & points d'attention

| Axe | État |
|---|---|
| Moteur event-sourcé | **Réel** des deux côtés (backend outbox/projecteurs + moteur parité en mémoire). Rejeu à date (R48), append-only (R49), upcasting, dead-letter. |
| Règles R1–R51 (dans `apps/*`) | **22 appliquées, 3 citées, 26 absentes** (dont 9 questions R-Q ouvertes). Définitions canoniques complètes dans le moteur Python de référence. |
| API | **NestJS** (~230 endpoints `/v1`), pas FastAPI pour la prod ; un adaptateur **FastAPI** annexe côté moteur Python. |
| RLS multi-tenant | **Créée (ENABLE+FORCE+POLICY+recette anti-fuite) mais dormante** : app en owner + `FF_RLS_ENFORCED` off → isolation par filtre applicatif aujourd'hui. |
| Optimistic locking | **Mécanisme + 409 + tests présents**, mais **aucun handler ne l'adopte** et le flag est off → aucun endpoint ne lève encore le conflit ; jeton `version` seulement sur `KycFile`. |
| Front | Production **branché API** (repli seed/démo) sauf `BatCampagne` ; parité **100 % offline** (fixtures). |
| Tests | **506/506 verts** exécutables sans DB ; **51 specs e2e** non lançables ici (Docker/Postgres requis). |

**Trois écarts « prêt mais pas armé » à connaître** : (1) RLS non enforçante en prod par défaut ;
(2) optimistic locking non branché sur les handlers ; (3) R1–R51 partiellement matérialisées dans
`apps/*` (le canon complet vit dans le moteur Python de référence, pas dans la porte NestJS).
</content>
