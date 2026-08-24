# Audit d'architecture — O-Live (moteur workflow KYC + moteur CPSI)

> Audit **read-only** — constat / faits uniquement, aucune recommandation de refactor.
> Toute citation renvoie à du code réel sous la forme `chemin:ligne`. « Le repo fait foi ».

---

## 0. Réconciliation avec l'énoncé de l'audit

L'énoncé d'origine supposait « un moteur KYC event-sourcé **Python**, ~64 tests, règles **R1–R51**, Gherkin ». Le dépôt réel diverge sur plusieurs points **matériels** :

| Prémisse de l'énoncé | Constat dans le dépôt | Preuve |
|---|---|---|
| Moteur KYC en **Python** | Le moteur **workflow KYC** est en **TypeScript / NestJS**, sous `apps/api`. Le Python (`services/cpsi-server-py`) est le moteur **CPSI de scoring de risque perpétuel**, distinct. | `apps/api/src/modules/kyc/*`, `services/cpsi-server-py/olive_cpsi/engine.py:1` |
| **Event-sourcé** | Le workflow KYC est **CRUD-primaire** avec **journal d'événements append-only en parallèle** (pas un rejeu d'état à partir des événements). Verrou optimiste sur les **tables d'état**, pas sur le journal. | `apps/api/src/common/optimistic-lock.ts:4-8` : « O-Live est CRUD-primaire (pas event-sourcé) » |
| **~64 tests** | Côté TS : **525** occurrences `it(`/`test(` sur **60** fichiers `*.spec.ts`. Côté Python CPSI : **117** fonctions `def test_` sur 20 fichiers `tests/test_cpsi_bloc*.py`. | `grep -r "it(|test(" apps/api/src --include=*.spec.ts`, `grep -r "def test_" services/cpsi-server-py/tests` |
| Règles **R1–R51** | Le namespace R va **bien au-delà de R51** : les identifiants R référencés dans `apps/api/src` s'étendent jusqu'à **R417** (avec des trous). R1–R51 est le **noyau workflow-visa** ; les blocs supérieurs couvrent screening, golden record, PMS, GED, MROS, riskcases, capacité d'équipe, scoring, etc. | `grep -rhoE "\bR[0-9]{1,3}\b" apps/api/src` → max R417 |
| Gherkin `.feature` | **16** fichiers `.feature` existent, tous sous `spec/**` (scénarios d'écrans/vagues, AML private banking, islamic-shariah, CPSI-PORTE). Le **corpus de règles** R1–R51 et son Gherkin normatif vivent surtout dans `spec/wf-v2.md` et les `.docx` (`spec/OLive-Specifications-Moteur-Workflow-v*.docx`), pas dans des `.feature`. | `git ls-files '*.feature'` (16), `spec/wf-v2.md:1-10` |

**Conséquence méthodologique** : cet audit se fonde sur le code réel. Le moteur workflow KYC (TS) et le moteur CPSI (Python) sont traités comme **deux moteurs séparés** qui communiquent par propositions/tâches, jamais par effet de bord direct.

---

## 1. Carte des modules

`apps/api/src/modules` contient **~50 modules** NestJS. Le tableau ci-dessous couvre ceux qui portent des aggregates, des événements ou de l'évaluation de règles ; les modules purement CRUD/écran sont regroupés en fin.

### 1.1 Noyau workflow KYC & visa (R1–R52, R85, R86)

| Module | Responsabilité | Fichiers clés | Événements émis / consommés | Règles portées |
|---|---|---|---|---|
| `kyc` | Aggregate **KycFile** (dossier) : création, sections, visas, validation finale, suspension, abandon, handoff, rejeu à date. | `kyc/kyc.service.ts` (860 l.), `kyc/kyc.controller.ts`, `kyc/kyc.templates.ts`, `kyc/risk-engine.ts` | émet `kyc.created` (`kyc.service.ts:161`), `kyc.validated` (`:566`), `kyc.visa.invalide` (`:240`), `kyc.visa.validateur.reassigne` (`:319`), `kyc.visa.annule.vice` (`:337`), `risque.operationnel.incident` (`:338`), `kyc.visas.geles` (`:349`), `kyc.comite.decision` (`:360`), `kyc.offboarding.propose` (`:365`), `kyc.dossier.suspendu` (`:399`), `prospect.retour.refuse.detecte` (`:166`) | R6/R10 (invalidation ciblée), R14 (engagement), R17/R20 (suspendu/abandonné fige), R18, R19, R46 (gel visas sur hit), R52 (four-eyes final), R271/R282/R283 (versioning matrice), R336/LK (verrou) |
| `kyc/rules` | **Entités de domaine** portées 1:1 depuis le moteur Python de référence — une classe = une règle. | `rules/named-validator.ts` (R2/R4), `rules/section-four-eyes.ts` (R13/R52), `rules/kyc-handoff.ts` (R85), `rules/qualified-visa.service.ts` (R86), `rules/kyc-lock.service.ts` | aucun (objets purs, log interne) — l'état passe par `kyc.service` | R2, R4, R13, R52, R7, R85, R86 |
| `workflow` | **Gouvernance de version** du dossier (« le dossier emporte sa version », R172) : timbre = événement, jamais rejoué. | `workflow/kyc-workflow.chaine.ts`, `workflow/workflow-def.service.ts` | émet `kyc.dossier.workflow` (`kyc-workflow.chaine.ts:46`) | R172 |
| `workflow-instances` | Instances d'exécution de workflow (état runtime). | `workflow-instances/*` | — | — |
| `reviews` | Recertification périodique — l'échéance naît à la validation KYC. | `reviews/*` (appelé `kyc.service.ts:568`) | consomme la validation (RV-01/07) | R-revues périodiques |

### 1.2 Événementiel, projection, versioning

| Module | Responsabilité | Fichiers clés | Événements | Règles |
|---|---|---|---|---|
| `events` | Écriture d'événement (source unique), **outbox worker**, **projecteur golden record**, **upcasting** à la lecture, SSE. | `common/domain-event.ts` (émission), `events/golden-record.projector.ts`, `events/upcasters.ts`, `events/outbox.worker.ts`, `events/case-proposal.consumer.ts` | consomme `kyc.validated` (projecteur, `golden-record.projector.ts:35`) | R104 (propagation GR), R48/R49 (rejeu/immutabilité), R339/EV (upcasting) |
| `common` (transverse) | Verrou optimiste, feature-flags, idempotence, tenant-settings, audit. | `common/optimistic-lock.ts`, `common/feature-flags.ts`, `common/idempotency.ts`, `common/tenant-settings.ts`, `common/audit.service.ts` | — | R53/R336 (concurrence), R125–R128 (settings gouvernés) |

### 1.3 Screening / AML / risque

| Module | Responsabilité | Fichiers clés | Événements | Règles |
|---|---|---|---|---|
| `screening` | Rapprochement nom/liste (sanctions/PEP), qualification des hits, whitelist, export CSV audit. Délègue le **scoring fin** au package `@olive/screening-engine`. | `screening/screening.service.ts` (436 l.), `screening/rules/screening-qualification.ts` | émet une **escalade PROPOSÉE** par événement (`screening.service.ts:12-13`, R39/R44 — jamais exécutée) | R100–R103 (SC-01..04), R408 (moteur fin), R409 (index une fois), R411 (décomposition), R413–R417 (config/phonétique/nationalité) |
| `aml` | Scoring AML 2G, files d'évaluation, gap-analysis vs référentiel. | `aml/aml-scoring.engine.ts`, `aml/aml-eval.service.ts`, `aml/aml-gap.service.ts` | files async d'éval | R-AML (scénarios A-69..A-86) |
| `mros` | Communication MROS (art. 9 LBA), discrétion (le client n'est pas notifié). | `mros/*` | — | R17 (discrétion type MROS), R129–R132 |
| `riskcases` | Cases d'investigation issues des hits/scénarios. | `riskcases/*` | — | R133–R136 |

### 1.4 Golden record, documents, référentiels

| Module | Responsabilité | Fichiers clés | Règles |
|---|---|---|---|
| `clients` | Fiche client (golden record cible de la projection). | `clients/*` | R104 |
| `personnes` | Personne unique du référentiel, bijectivité des relations, PEPisation. | `personnes/*` | R30–R36, R152–R159 |
| `ged` / `coffre` | Gestion documentaire, coffre-fort. | `ged/*`, `coffre/*` | R109–R116, R144–R147 |
| `pms` / `corebanking` / `custody` | Intégrations portefeuille / core banking / conservation. | `pms/*`, `corebanking/*` | R105–R108, R167–R169 |
| `parametres` | Écrans de **paramétrage tenant** (règles & moteur, questionnaire R-Q). | `parametres/parametres.service.ts` | R125–R128 |
| `onboarding`, `txflux`/`transactions`, `crm`, `formations`, `tasks`, `nba`, `businesstrip`, `olivia`, `ia`, … | Modules fonctionnels / écrans / IA assistante (Olivia propose, l'humain décide). | `modules/<nom>/*` | R117–R124, R137–R143, R160–R166, R43x… |

### 1.5 Moteur CPSI (Python) — scoring de risque perpétuel

| Composant | Responsabilité | Fichiers clés | Règles |
|---|---|---|---|
| `olive_cpsi.engine` | **Score perpétuel événementiel** : chaque signal recalcule un score pur `(statique, signaux ≤ date, config)`, append-only, décroissance half-life, segmentation en groupes de pairs, alertes, franchissement de bande = **événement/proposition** (jamais effet de bord). | `services/cpsi-server-py/olive_cpsi/engine.py` (838 l.) | R63–R84 (voir en-tête `engine.py:5-14`) |
| `olive_cpsi.analytique_2g` | Analytique 2e génération. | `analytique_2g.py` (128 l.) | — |
| `olive_cpsi.kyc_handoff` / `kyc_visa` / `kyc_lock` | Modèles de référence Python **portés en TS** dans `apps/api/src/modules/kyc/rules/*`. | `kyc_handoff.py` (76 l.), `kyc_visa.py` (49 l.), `kyc_lock.py` (74 l.) | R85, R86, R15, R53/R336 |
| `bridge.py` | Pont d'exposition du moteur Python. | `services/cpsi-server-py/bridge.py` | — |
| Tests | 117 `def test_` sur `tests/test_cpsi_bloc1..20.py`. | — | R63–R86, R250, R399–R403 |

**Distinction essentielle** : le CPSI **ne touche à aucun dossier** — il « émet tâches et propositions (R39/R44) » (`engine.py:10-11`). Le moteur workflow KYC (TS) et le CPSI (Python) sont couplés uniquement par des **propositions d'aiguillage** (durcissement/allègement de diligence), adoptées par un humain.

---

## 2. Cycle de vie événementiel d'un dossier KYC

L'écriture d'événement est centralisée : `emitEvent(client, tenantId, type, aggregateId, payload)` insère dans `domainEvent` avec horloge serveur (`common/domain-event.ts:11-13`). Le journal est **append-only** (R48/R49) ; l'état vivant est dans les tables (`kycFile`, `kycVisa`, …). Le cycle :

1. **Création** — `KycService.create` calcule le score de risque (`risk-engine.ts`), en déduit le workflow (SDD/CDD/EDD), crée le `KycFile` + sections + visas dans une transaction, puis émet `kyc.created` (`kyc.service.ts:137-162`). Détection R18 : si le prospect avait des dossiers `REJECTED`, émission de `prospect.retour.refuse.detecte` (`:164-167`). Un code unique `KYC-{année}-{pays}-{séquence}-R{révision}` est protégé par `pg_advisory_xact_lock` (`:130-135`).
2. **Timbre de version (gouvernance R172)** — `KycWorkflowChaine.ouvrirGouverne` crée le dossier puis pose le **timbre** `kyc.dossier.workflow` (`kyc-workflow.chaine.ts:35-55`). Le timbre est **posé une fois et jamais rejoué** (`:36-37`) ; repli tracé `source: "TEMPLATE"` si aucune définition gouvernée applicable (`:44`).
3. **Préparation & handoff section par section** — `KycHandoff` (phases `["ARM","RM","BRM","Compliance","Validation"]`, `kyc.service.ts:801`) : `nextStep`/`revenir` exigent un **message obligatoire** (R85, `kyc-handoff.ts:43-61`). Chaque transition est **gardée par la version** du dossier (`kyc.service.ts:818,831`).
4. **Visa de section** — apposition via `QualifiedVisaService.apposer` : verdict `OK|CONDITIONAL|NOK`, message justificatif obligatoire pour NOK/CONDITIONAL (R86, `qualified-visa.service.ts:27-38`) ; contrôle du validateur nommé/relais (R2/R4, `named-validator.ts:45-57`) ; exclusion 4-yeux de section (R13, `section-four-eyes.ts:43-61`). Toute **modification de données** invalide le visa concerné → passage `PENDING` + événement `kyc.visa.invalide` (R6/R10, `kyc.service.ts:234-241`).
5. **Événement perturbateur (hit screening pendant la validation, R46)** — `gelerVisasSurHit` gèle les visas `PENDING` → `GELE` et émet `kyc.visas.geles` ; le comité décide (`kyc.comite.decision`), dégel ou `kyc.offboarding.propose` (`kyc.service.ts:344-365`).
6. **Validation finale** — `KycService.validate` : chaîne de gardes dans un ordre de précédence fixe — non clôturé (OF-10), modifiable (R17/R20), pas déjà validé, four-eyes créateur, **four-eyes renforcé R52** (le validateur n'a contribué à aucune section, `:533-538`), rôle habilité, tous visas `SIGNED`, complétude des questions REQUIRED **à la matrice de création** (R282, `:544-552`), enfin **engagement de responsabilité R14** (`:553-556`). Puis dans une transaction : `majVersionnee(... status:"VALIDATED" ...)` **gardée par version** (R336, `:563-564`), émission de `kyc.validated` (`:565-567`), création de l'échéance de revue (`:568`), audit (`:570-571`).
7. **Propagation au golden record (handoff hors dossier, R104)** — l'outbox draine `kyc.validated` vers `GoldenRecordProjector.handle` : mapping **fermé** KYC → fiche client (`golden-record.projector.ts:20-22`), invariants GR-01..04 (jamais d'effet de bord à la validation, un KYC non `VALIDATED` ne propage rien, idempotent par diff, aucune synchro hors mapping, `:9-15,35-55`).
8. **Rejeu à date (R48)** — `KycService.etatADate` reconstruit le statut **uniquement depuis le journal** (`kyc.created`/`kyc.validated` avec `at <= date`), jamais depuis les colonnes courantes (`kyc.service.ts:177-190`).
9. **Lecture upcastée (R339/EV)** — les payloads stockés sont désérialisés via une chaîne d'upcasters purs `payload→payload` **à la lecture** (l'événement stocké n'est jamais réécrit, `upcasters.ts:1-38`).

---

## 3. Mécanisme d'évaluation des règles

Il n'existe **pas** de moteur de règles déclaratif central. Chaque règle R est **codée impérativement** dans le service ou l'entité de domaine qui la porte, et se déclenche par appel de méthode le long du cycle de vie. Trois formes coexistent :

**(a) Garde impérative « throw-based » dans un service** — la règle est une suite de `if (…) throw …` avec l'identifiant R en commentaire/message. Exemple, validation finale (R52 puis R14) :

```
apps/api/src/modules/kyc/kyc.service.ts:537-538
  if (allContribs.some(c => c.changedBy === ctx.userId))
    throw new ConflictException(`[R52] Four-eyes final : ${ctx.userId} a contribué au dossier — validation exclue`);
apps/api/src/modules/kyc/kyc.service.ts:555-556
  if (!engagement) throw new ConflictException("[R14] Engagement de responsabilité requis …");
```

**(b) Entité de domaine dédiée = une règle** — classes pures portées 1:1 du moteur Python, avec `throw` typé portant le numéro de règle. Exemples : `SectionFourEyes.viser` lève `FourEyesViolation('…', 'R13')` (`section-four-eyes.ts:50-61`) ; `NamedValidator.viser` lève `NotAuthorized('…','R2')` (`named-validator.ts:45-57`) ; `QualifiedVisaService.apposer` lève `VisaError('…(R86)')` (`qualified-visa.service.ts:27-38`). L'évaluation = instanciation par le service + appel de la méthode.

**(c) Calcul déterministe tracé (règle = barème injecté)** — le « risk-engine » n'est pas une décision mais un **scoring traçable** : `computeRisk(input, bareme)` additionne des points (structure, type de compte, pays à risque), produit `score/level/workflow` **et sa trace ligne à ligne** (`risk-engine.ts:36-49`). Le barème est **gouverné par registre** (R288) : `baremeEnVigueur(versions, at)` résout la version en vigueur à une date, défaut `BAREME_DEFAUT` (`:21-33`). Même schéma côté CPSI : `computeScore` pur pondéré par `POIDS_SIGNAUX`/`POIDS_STATIQUE` versionnés par date (`engine.py:20-60`).

**Déclenchement** : une requête HTTP → contrôleur → méthode de service → la garde/le calcul s'exécute en ligne, dans la transaction Prisma, avant l'émission de l'événement. Aucune inférence, aucun chaînage de règles, aucun moteur de faits : l'ordre d'évaluation est **écrit en dur** dans la séquence des instructions (cf. la chaîne de gardes de `validate`, `:528-556`, dont le commentaire souligne « la précédence des refus est conservée », `:554`).

**Règles « tenant additionnelles » (R56)** — seule brique proche d'un moteur de règles configurable : typologie **fermée** de 5 types (`minPreparateurs`, `sectionsPrealables`, `quatreYeuxRenforce`, `engagementSection`, `motifRefusMin`) qui ne peuvent que **durcir**, garde *default-deny* (`spec/olive-catalogue-R1-R56-et-propositions.md:92-93`). Le catalogue reste fermé, pas un langage de règles ouvert.

---

## 4. Invariants sous verrou optimiste

Le verrou vit sur les **tables d'état mutables**, pas sur le journal (`optimistic-lock.ts:4-8`). Cœur du mécanisme (`:29-39`) :

```
majVersionnee(model, id, expectedVersion, data):
  garde = UPDATE … WHERE id AND version = expectedVersion  SET …, version = version+1
  if garde.count === 1  → OK (pas de conflit)
  if enforced           → throw ConcurrencyConflictError   // FF_OPTIMISTIC_LOCKING = ON
  else (shadow/legacy)  → signale puis applique sans garde  // observation, comportement legacy
```

- **Enforcement via feature-flag** `FF_OPTIMISTIC_LOCKING` (`:33`) ; mode *shadow* signale qu'un conflit **aurait eu lieu** sans bloquer (`:37-38`).
- **Remontée HTTP 409 typée** par `ConcurrencyConflictFilter` : renvoie `{ error:"concurrent_modification", aggregate_id, expected_version, message:"Rechargez avant de soumettre." }` (`:42-52`). **Aucun retry serveur aveugle** (`:8`) — le client recharge (R53).
- **If-Match / version courante** : `validate`, `suspend`, `abandon`, et chaque transition de handoff passent `expectedVersion ?? kyc.version` à `majVersionnee(..., { enforce:true })` (`kyc.service.ts:398, 428, 563-564, 818, 831`).

**Invariants préservés** (constat) :
1. **Pas d'écrasement silencieux** : deux compliance officers sur le même dossier — l'un réussit, l'autre reçoit 409 (`optimistic-lock.ts:6-8`).
2. **Four-yeux non corrompu** : la validation finale gardée par version empêche deux validations concurrentes de se recouvrir (`kyc.service.ts:559-564`).
3. **Handoff cohérent** : `handoff_phase`/`status` ne sont jamais « clobbés » par deux acteurs qui se repassent la main (`kyc.service.ts:808-809`).
4. **Immutabilité du journal (R49)** : le verrou ne s'applique **pas** au journal append-only ; les événements ne sont jamais mis à jour (upcast à la lecture seulement, `upcasters.ts:2-3`).
5. **Timbre unique (R172)** : le timbre de version se pose une fois et ne se rejoue pas (`kyc-workflow.chaine.ts:36-37`) — invariant applicatif, distinct du verrou de version.
6. **Idempotence de projection (GR-03)** : la propagation golden record n'écrit que sur diff (`golden-record.projector.ts:50`).

---

## 5. Codé en dur vs configurable

### Codé en dur (invariants « 🔒 » et littéraux du moteur)
- **Ordre et existence des gardes** de la validation finale (R52 → rôle → visas → complétude → R14) : séquence impérative (`kyc.service.ts:528-556`).
- **Phases de handoff** : `["ARM","RM","BRM","Compliance","Validation"]` en constante statique (`kyc.service.ts:801`) — « configurable par workflow en P2 » (`:800`), donc **pas encore** tenant.
- **Rôles habilités** : `ROLES_REASSIGNATION = ["CO_SR","DIR","ADMIN"]` (`kyc.service.ts:522`), rôles de validation finale `["CO_SR","MLRO","DIR","ADMIN"]` (`:539`).
- **Mapping golden record** : liste **fermée** `GOLDEN_RECORD_MAPPING = [{from:"riskLevel", to:"riskLevel"}]` (`golden-record.projector.ts:20-22`) — commentée comme « paramètre tenant candidat » mais figée (`:18`).
- **Défauts du moteur de screening** : `DEFAUTS_MOTEUR`, `DEFAUTS_BLOCKING` (`packages/screening-engine/src/index.d.ts:45-46`) — littéraux figés (`:30`), surchargeables mais valeurs par défaut en dur.
- **Barème de risque KYC par défaut** : `HIGH_RISK_CC`, `STRUCTURE_PTS`, `ACCOUNT_PTS`, seuils `seuilEdd:50/seuilCdd:25` (`risk-engine.ts:11-23`).
- **Poids CPSI par défaut** : `POIDS_SIGNAUX`, `POIDS_STATIQUE` (`engine.py:20-29`).
- **Enum de verdicts** `OK|CONDITIONAL|NOK` (`qualified-visa.service.ts:12-13`), types R56 (typologie fermée).

### Configurable (tenant / gouverné par date)
- **`tenant.settings`** — store gouverné unique lu par `loadSettings` (`common/tenant-settings.ts:11-15`), référentiel R125–R128.
- **Barème de risque KYC** — gouverné par registre `kycScoringBareme` versionné par date d'effet (R288) : `baremeEnVigueur(versions, at)` sélectionne la version applicable, sinon défaut moteur (`risk-engine.ts:25-33`) ; un dossier garde à vie le barème de sa création (R29).
- **Config du moteur screening** — un `AmlScenario.params` **versionné** fournit `params.moteur` et `params.prefiltre` en vigueur à la date du run (R414) ; override d'appel `moteurConfig` possible et prioritaire, tout tracé (`screening.service.ts:98-102`). Champs réglables : échelle, pénalités type/DOB, phonétique, nationalité (`packages/screening-engine/src/index.d.ts:31-44`).
- **Matrice documentaire** — versionnée par date de vigueur, chaque dossier estampille sa version (R29/R282, `kyc.service.ts:193-199`).
- **Config CPSI** — `tenant_config` : `half_life_jours`, `bandes`, `seg_stat_seuils`, `seg_comp_seuils`, `poids_signaux`, `poids_statique`, `seuil_alerte`, `w_impact`/`w_freq`, `fp_suppression_active` — toutes versionnées par date de mise en vigueur (`engine.py:41-80`).
- **Feature-flags** — ex. `FF_OPTIMISTIC_LOCKING` (`optimistic-lock.ts:33`).
- **Règles tenant additionnelles R56** — activables/désactivables, tracées, ne durcissent que (`spec/olive-catalogue-R1-R56-et-propositions.md:92-93`).

---

## 6. Les 5 points de résistance à un moteur d'inférence goal-driven

Constat des obstacles architecturaux les plus forts à l'introduction d'un moteur d'inférence orienté but (backward-chaining / planification), **sans jugement de valeur** :

1. **Évaluation impérative « throw-first », non déclarative.** Chaque règle est une suite d'instructions dont l'ordre encode la précédence (« la précédence des refus est conservée », `kyc.service.ts:554`). Il n'existe aucune base de faits ni représentation des règles comme données ; un moteur goal-driven aurait besoin d'un modèle de règles réifié qui, ici, est dispersé dans du flux de contrôle (`kyc.service.ts:528-556`, `section-four-eyes.ts:43-61`, `named-validator.ts:45-57`).

2. **Couplage au schéma d'événements et versioning par upcasting figé.** L'état auditable et le rejeu à date reposent sur des payloads dont l'évolution est gérée par une chaîne d'upcasters purs enregistrés **immuablement** (`upcasters.ts:13-17` : « upcaster déjà enregistré … immuables ») et une désérialisation centralisée unique (`:5,27-38`). Un moteur qui inférerait de nouveaux buts devrait produire/consommer des faits hors de ce schéma d'événements figé, ou casser la garantie de rejeu R48.

3. **Scoring synchrone en une passe, avant tout `await`.** Le screening score « en une passe SYNCHRONE (avant tout await) » pour isoler l'IDF module-global (`screening.service.ts:19-21`) ; les scores KYC/CPSI sont des fonctions **pures et déterministes** rejouables (`risk-engine.ts:1,36-49`, `engine.py:38-40`). Un moteur d'inférence itératif (propagation jusqu'à point fixe) est structurellement en tension avec ce contrat « une passe, byte-identique ».

4. **État module-global dans le moteur de screening (IDF).** « l'IDF du moteur est un état MODULE-global … à instancier par run le jour du multi-tenant vraiment concurrent » (dette Phase 2, `screening.service.ts:19-21`). Un moteur d'inférence concurrent multi-buts/multi-tenant heurterait cet état partagé non ré-entrant.

5. **Seuils, mappings et rôles codés en dur / gouvernés par dates.** Les décisions clés reposent sur des littéraux figés ou des barèmes résolus **par date d'effet** : mapping GR fermé (`golden-record.projector.ts:20-22`), rôles en dur (`kyc.service.ts:522,539`), phases de handoff en dur (`:801`), seuils EDD/CDD (`risk-engine.ts:23`), défauts moteur (`packages/screening-engine/src/index.d.ts:45-46`). Un moteur goal-driven qui dériverait ses sous-buts de ces seuils devrait d'abord les extraire en base de connaissances ; aujourd'hui ils sont des constantes ou des lignes de barème versionné, non des faits interrogeables.

*(Obstacles complémentaires notés au passage : la propagation « jamais d'effet de bord » — tout passe par événement/tâche/proposition, R39/R44, `engine.py:10-11` — impose qu'un moteur inférentiel ne puisse muter d'état qu'en émettant des propositions à décision humaine, ce qui contraint la forme des « actions » du planificateur.)*
