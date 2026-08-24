# Audit du dispositif de test — O-Live / CollabraBoard

> Audit **lecture seule** (aucun code ni test modifié). Constat + plan uniquement.
> Références citées en `chemin:ligne`. Date : 2026-08-06.

---

## 1. Réconciliation avec l'énoncé

L'énoncé de mission suppose **« ~64 tests »**. C'est faux à l'échelle du dépôt : le
chiffre 64 correspond en réalité à **une seule surface** — les 64 scénarios Gherkin
`it(...)` du corpus AML-Gap `backend-tests/aml-gap/bloc50..61` (12 fichiers). Le dépôt
réel est **polyglotte** et compte plus de **1 400 cas de test** répartis sur 9 surfaces.

| Surface | Fichiers | Cas / assertions | Runner | Porte CI |
|---|---:|---:|---|---|
| API NestJS — specs « câblage » (`apps/api/src/**/*.spec.ts`) | 60 | ~525 `it(` bruts ; **425 assertés** | `test:rules` → `scripts/run-rule-tests.sh` (compile TS, sans DB) | Bloquante — `attendu 425/425` (`.github/workflows/ci.yml:306`) |
| API e2e Postgres réel (`apps/api/test/e2e/*.e2e-spec.ts`) | 62 | ~418 `it(` ; **411 assertés** | `test:e2e` (jest + Postgres, `--runInBand`) | Bloquante, **1 retry flake** (`ci.yml:318`) ; quarantaine vidée |
| AML-Gap moteur (`backend-tests/aml-gap/bloc50..61`) | 12 | **64** `it(` → 179 verts / 11 suites | `test:aml-gap` (jest) | Bloquante, **bloc61 exclu** (`ci.yml:301`, `apps/api/package.json` `--testPathIgnorePatterns bloc61`) |
| CPSI Python (`services/cpsi-server-py/tests/test_cpsi_bloc*.py`) | 20 | **117** `def test_` | `run_tests.py` (runner maison) | Bloquante **via garde grep** — le runner rend 0 à tort (`ci.yml:342`) |
| Workflow-engine Python (`services/workflow-engine-py/tests`) | 21 | **145** `def test_` | `run_tests.py` + `run_tests_sql.py` | Bloquante — `19/19` suites + `11/11` SQL (`ci.yml:332,340`) |
| Moteur screening — portes golden (`services/screening/*.test.mjs`) | 6 | 35 checks (`check()` maison, 0 `it(`) | node direct par fichier | Bloquante — 6 portes (`ci.yml:202-245`) |
| Workflow-engine TS (`packages/workflow-engine/test/*.mjs`) | 2 | 36 `it(` | node | (via test:rules / non explicité) |
| Front web (`apps/web/**/*.test.ts`) | 3 | 14 `it(` | vitest | Bloquante — `vitest run` + build + budget bundle (`ci.yml` étape 6) |
| Démo + console éditeur (`tests/demo`, `apps/editor-console/test`) | 4 | 38 `it(` | node | vendor 6/6 bloquant ; démo Playwright **non bloquante** |
| Harnais outillage (`tools/*/test.mjs` : registrar, olivia-eval, fat, bat, canon-master, migrations, api-contract, deploiement, aml-gap gen) | ~9 | ~60 checks assertés | node | Bloquantes, no-drift générateurs |

**Verdict de réconciliation** : le « ~64 » sous-estime la réalité d'un facteur ~20.
La discipline de test est **réelle et large**, mais très inégalement répartie (voir §3).

---

## 2. Couverture par module (API NestJS)

`EXISTE` = wiring spec dédiée (dans `run-rule-tests.sh`) **ou** e2e ciblée.
`PARTIEL` = couvert seulement en marge (e2e transverse, jamais en propre).
`ABSENT` = aucune spec, aucun e2e ciblant ses routes.

| Module | Test présent (fichier) | État | Style d'assertion |
|---|---|---|---|
| personnes | `personnes.wiring.spec.ts`, `personne-lien.wiring.spec.ts` | EXISTE | **Événements** (`evts()` sur `_db.events`, `personnes.wiring.spec.ts:54`) |
| kyc / rules | `kyc/rules/*.spec.ts` (7 fichiers), `test/e2e/kyc-rules.e2e-spec.ts` | EXISTE | Mixte : état (verdicts) + events |
| screening | `screening.wiring.spec.ts`, `screening-scenarios.spec.ts`, `test/e2e/fat-screening` | EXISTE | Golden-verdict + events |
| aml / aml-gap | `aml-scoring.wiring.spec.ts`, `aml-gap.wiring.spec.ts`, 11 e2e `fat-aml-*` | EXISTE | Faits mesurés vs paramètres tenant |
| auth / IAM | `auth/*.spec.ts` (11 fichiers : oidc, jwks, mfa, totp, roles.guard, secret-box…) | EXISTE | État + refus (`rejects`) |
| ged (+ avancé/ingestion/consultation/vues/retention) | 6 wiring specs | EXISTE | Événements |
| coffre / ged-externe / webdav | 3 wiring specs | EXISTE | Événements |
| events (golden-record, upcasters) | `golden-record.projector.spec.ts`, `upcasters.spec.ts`, `test/e2e/event-projections`, `event-versioning` | EXISTE | Projections (events → état lu) |
| workflow / chaines | `workflow-def.wiring.spec.ts`, `kyc-workflow.chaine.wiring.spec.ts`, `chaines.wiring.spec.ts` | EXISTE | Événements |
| crm / ia / ocr / mros / riskcases / onboarding / pms / recherche / annotations / corebanking / parametres / rapports / transactions / license / workload | wiring spec dédiée chacun | EXISTE | Majoritairement **événements** |
| islamic | `islamic-screening.wiring.spec.ts`, e2e | EXISTE | Golden-verdict |
| olivia (persona IA) | `test/e2e/fat-olivia` + `tools/olivia-eval` (golden set / suite d'attaque) | PARTIEL | e2e flaky (1 retry) ; pas de wiring spec ; ratchet de résistance |
| coc / reviews / offboarding / readiness / sandbox / swarm | e2e `fat-coc`, `fat-reviews`, `fat-offboarding`, `fat-cloture-readiness`, `fat-swarm` ; `tests/demo/sandbox-scenarios` | PARTIEL | e2e HTTP ; aucune spec unitaire |
| cpsi | `services/cpsi-server-py` (Python) + `test/e2e/fat-cpsi`, `fat-charge-cpsi` | PARTIEL | Logique testée **hors Nest**, en Python |
| **businesstrip** (MOD-75, R222→R230) | — | **ABSENT** | Contrôleur+service événementiel embarqués dans `businesstrip.module.ts` (202 l.), **hors** `run-rule-tests.sh` |
| **oprisk** | — | **ABSENT** | `oprisk.module.ts`, controller embarqué, aucune spec |
| **custody / ta** | — | **ABSENT** | `custody.module.ts`, `ta.module.ts` |
| **crossborder (xb)** | — | **ABSENT** | `xb.module.ts` |
| **txflux (fx / swift / txrisk)** | — | **ABSENT** | 4 modules, controllers embarqués, aucune spec |
| **regwatch** | — | **ABSENT** | `regwatch.module.ts` |
| **formations** | — | **ABSENT** | `formations.module.ts` |
| **nba** | — | **ABSENT** | `nba.module.ts` |
| **bi** | — | **ABSENT** (specs) | Vues déclarées gardées par `verifier-vues-bi.js` (no-drift, pas de test comportemental) |
| **rules / apidoc / mobile / clients / legal / builder / workflow-instances** | — | **ABSENT** (specs) | Touchés seulement en incident par e2e transverses |

**Constat** : sur ~53 modules API, ~30 ont une spec/e2e dédiée ; la vague **R222→R238
(MOD-*)** — logique de conformité événementielle réelle, ~1 664 lignes de modules mono-fichier —
est **globalement non testée en propre** ; son seul filet est l'incidence des `fat-vague13..17`.

---

## 3. Zones non testées (gaps), les plus risquées d'abord

1. **Vague R222→R238 (businesstrip, oprisk, custody/ta, crossborder/xb, txflux/fx/swift/txrisk,
   regwatch, formations, nba)** — modules mono-fichier packant `@Controller`+`@Injectable`
   avec logique événementielle sensible (avis cross-border, visa R15, R13 séparation des
   pouvoirs), **absents de `run-rule-tests.sh`** et sans wiring spec. Risque : régression
   silencieuse d'une décision de conformité, non couverte par la porte bloquante 425/425.
2. **`bloc61` / Analytique 2G AML-Gap explicitement exclu de la CI** (`ci.yml:301`,
   `package.json` `--testPathIgnorePatterns bloc61`). « Rouge assumé, hors CI ». Le seul
   filet est la suite Python `test_cpsi_bloc20.py` (détecteurs statistiques). Le contrat
   Nest↔Python n'est donc jamais vérifié bout-en-bout de façon bloquante.
3. **CPSI Python en « faux-vert »** : `services/cpsi-server-py/run_tests.py` **rend 0 même
   en cas d'échec** ; la CI ne tient que par une garde grep `### 20/20 suites vertes ###`
   (`ci.yml:342`). Toute panne d'un `def test_` d'un bloc *non* dernier peut passer si le
   marqueur final reste imprimé. Fiabilité du signal fragile.
4. **Front web quasi non testé** : 3 fichiers / 14 cas vitest pour toute l'app web ; la
   recette **visuelle Playwright est un job séparé non bloquant** (`ci.yml` étape 6 & note
   finale). La quasi-totalité des écrans (73 en démo) n'a aucune assertion bloquante.
5. **Olivia (IA) flaky-tolérant** : couverte seulement en e2e avec **1 retry autorisé**
   (`ci.yml:318,320`, pont Python + latence). Un vrai bug intermittent peut être absorbé
   comme flake. Pas de wiring spec déterministe du service.
6. **13 contrôleurs déclarés hors `*.module.ts`** vs 45 services : la surface HTTP réelle
   est plus large que ce que les 62 e2e couvrent nommément ; le no-drift `api-contract`
   protège le *contrat* de routes mais **ne teste aucun comportement**.

---

## 4. Tests par événements vs état interne

La suite affiche une **discipline événementielle explicite et assumée**, surtout côté
wiring specs API :

- **Wiring specs = assertion par ÉVÉNEMENTS observables.** Faux Prisma en mémoire avec table
  `domainEvent`, et un helper qui lit le flux d'événements plutôt que l'état interne du
  service : `const evts = (p, type) => p._db.events.filter(e => e.type === type)`
  (`apps/api/src/modules/personnes/personnes.wiring.spec.ts:54`). L'invariant est écrit noir
  sur blanc : « tâches et notifications = **ÉVÉNEMENTS TRACÉS (invariant n°1 — pas d'effet de
  bord)** » (`personnes.wiring.spec.ts:5`). C'est le patron dominant des modules ged, coffre,
  crm, workflow, etc.
- **Events → projections** : les specs `events` vérifient l'état *reconstruit* depuis le flux
  (`golden-record.projector.spec.ts`, `test/e2e/event-projections.e2e-spec.ts`), pas des
  champs privés — encore une posture « comportement observable ».
- **e2e = comportement HTTP réel.** 58/62 suites pilotent l'API par supertest contre un
  Postgres réel et assertent sur réponses + projections ; 51 croisent des assertions sur les
  événements. Style boîte-noire de bout en bout.
- **Golden-verdict / équivalence-aux-défauts (services/screening)** : la meilleure discipline
  du dépôt. Le golden set (127 cas) est **asserté** avec planchers-ratchet mesurés
  (`services/screening/gate.test.mjs`, `PLANCHER` figé), et surtout l'**équivalence-aux-défauts** :
  « no-config === `DEFAUTS_MOTEUR` explicite, sur les 127 cas » puis vérification qu'un réglage
  changé **change bien un verdict** (`services/screening/config-equivalence.test.mjs:2,37-44`).
  C'est de la caractérisation par verdict observable, avec cliquet anti-régression.
- **Contre-exemple (état/blancheur structurelle)** : plusieurs portes CI ne testent pas un
  *comportement* mais un **no-drift structurel** (contrat de routes `api-contract`, vues BI
  `verifier-vues-bi.js`, guide `DEPLOIEMENT.md`, CANON-MASTER). Utile en garde-fou, mais ce
  n'est ni events ni état métier — à ne pas compter comme couverture fonctionnelle.

**Synthèse** : suite fortement orientée **événements / comportement observable** là où elle
existe ; les rares assertions d'état sont des projections lues, pas des internes. Le point
faible n'est pas le *style* mais la *répartition* (§3).

---

## 5. Plan en 5 actions pour améliorer la testabilité

1. **Câbler la vague R222→R238 dans `run-rule-tests.sh`.** Ajouter une wiring spec par module
   MOD-* (businesstrip, oprisk, custody/ta, crossborder/xb, txflux/fx/swift/txrisk, regwatch,
   formations, nba), sur le même patron faux-Prisma + `evts()`, et les intégrer à la porte
   bloquante `test:rules`. Priorité 1 : c'est le plus gros trou de logique métier non gardée.
2. **Faire échouer le runner CPSI Python.** Corriger `run_tests.py` pour rendre un code de
   sortie non nul dès qu'un `ko > 0` (au lieu de s'appuyer sur la garde grep). Supprime le
   risque de faux-vert et rend le signal des 117 tests fiable sans béquille CI.
3. **Sortir `bloc61` / Analytique 2G de la quarantaine par un test de contrat.** Plutôt que
   de réécrire en Nest, ajouter un test bout-en-bout **bloquant** du contrat Nest↔service CPSI
   Python (entrées/verdicts sur fixtures figées), pour que l'exclusion `--testPathIgnorePatterns
   bloc61` cesse d'être un angle mort permanent.
4. **Promouvoir un socle front bloquant.** Étendre vitest au-delà des 14 cas actuels (au moins
   les parcours critiques : session/JWT, garde démo, i18n) et **rendre bloquant un sous-ensemble
   Playwright smoke** (5-10 écrans clés) plutôt que le laisser entièrement advisory.
5. **Durcir Olivia et retirer la tolérance au flake.** Ajouter une wiring spec déterministe du
   service (pont Python mocké) pour ne plus dépendre d'un e2e avec retry ; réserver le retry
   `§8` aux seules assertions de latence, pas aux verdicts métier.
