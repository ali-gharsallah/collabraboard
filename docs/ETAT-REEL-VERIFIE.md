# État réel vérifié — O-Live

> ## Addendum Vague 1 (2026-07-22)
> Deux constats de ce diagnostic ont **évolué** : (1) le rejeu-à-date n'est **plus limité aux
> paramètres** — le **dossier KYC à date** existe (`GET /v1/kyc/:code/a-date`, reconstruction
> depuis le journal append-only, preuve FAT-REJEU-KYC-01) ; (2) le frontend réel compte
> désormais **6 écrans** (ajout File d'alertes + Rejeu KYC) avec fallback seed **visible**.
> Le reste du diagnostic tient. Certificat à jour : `docs/CERTIFICAT-ETAT.md` · index : `docs/PROJECT-INDEX.md`.


**État vérifié au 2026-07-22 par diagnostic automatisé.** Chaque affirmation est adossée à
une commande shell réellement exécutée (sorties brutes ci-dessous). Rien n'est décrit « de
mémoire ». `master` = commit `521bc54` (working tree propre).

---

## PARTIE B — VERDICT (l'essentiel d'abord)

- **RÉEL et testé** : 27 modules NestJS écrivant en **Postgres réel** (Prisma ; **0 `jest.mock`/`__mocks__`** dans tout le dépôt), moteur de règles **R1→R221**, harnais **425/425** (50 suites) + **e2e 6/6** sur vraie DB, **RLS FORCE** multi-tenant prouvée par recette.
- **PARTIEL** : le frontend **appelle bien le backend** (`fetch /v1/...` via `OLIVE_API_URL`) mais avec **fallback seed** — sans `OLIVE_API_URL` la démo tourne sur données en dur. Rejeu-à-date **limité aux paramètres**.
- **Vitrine / spec seulement** : « prouver une règle depuis l'app » = **aucune route runtime** (c'est le harnais offline qui prouve) ; les « 7 services + 7 pages » Islamic du prompt « lourd » n'existent pas (2 onglets React réels : AML, Islamic).
- **Prochaine action code la plus importante** : **généraliser le rejeu-à-date** au-delà des paramètres (reconstruire l'état d'un agrégat métier — dossier KYC, client, risk case — à une date T), aujourd'hui absent.
- **Rejeu à date** : **EXISTE** pour les **paramètres** (R127, exposé HTTP `GET /parametres/valeur/:cle?date=` + `configALaDate`) — **N'EXISTE PAS** de façon généralisée sur les agrégats métier.

---

## PARTIE A — DIAGNOSTIC PROUVÉ

### 1. Volume réel du code

```
$ find . -name "*.ts" -not -path "*/node_modules/*" | wc -l
146
# répartition : apps/api 142 · tools/offline-stubs 2 · packages/shared 1 · apps/web 1 (.ts ; le web est surtout en .tsx)
$ find . \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" | xargs cat | wc -l
14335
```
**Conclusion** : ~14 300 lignes TS/TSX hors node_modules, 146 fichiers `.ts`, concentrés dans `apps/api` (backend NestJS). Le frontend `apps/web` est en `.tsx`. Volume réel d'un backend conséquent, pas une coquille.

### 2. Modules backend réellement présents (27)

`aml, annotations, auth, chaines, clients, coffre, corebanking, crm, events, ged, ia, islamic,
kyc, license, mros, ocr, onboarding, parametres, personnes, pms, recherche, riskcases, rules,
screening, transactions, workflow, workload`

Écritures DB réelles par module (`.create/.update/.delete/$executeRaw` dans les `*.service.ts`) :
```
aml=2 annotations=5 auth=8 chaines=1 clients=0 coffre=5 corebanking=6 crm=2 events=0
ged=29 ia=10 islamic=5 kyc=21 license=4 mros=7 ocr=6 onboarding=6 parametres=5 personnes=23
pms=5 recherche=6 riskcases=7 rules=0 screening=6 transactions=4 workflow=4 workload=2
```
Recherche de mocks/données en dur dans les services (`mock|hardcoded|return [{|TODO|stub`, hors `.spec`) : **aucun résultat**.

**Marquage** :
- **RÉEL-DB** : 25 modules (tous ci-dessus écrivent/lisent Prisma sur Postgres).
- **MOTEUR PUR (par conception, 0 DB)** : `rules` (moteur de règles KYC), `events` (worker outbox + projector : écrit via SQL brut dans `outbox.worker.ts`, pas dans un `*.service.ts`).
- **MOCK / VIDE** : **aucun**.

Preuve concrète (`islamic.service.ts`) : `tx.islamicSignal.create(...)`, `tx.zakatCalculation.create(...)`, `tx.mudarabaDistribution.create(...)`, `tx.waqfDistribution.create(...)`, `findMany(...)` — écritures/lectures réelles.

### 3. Tests — vérité terrain

```
$ bash scripts/run-rule-tests.sh   → PASSED=425  suites=50  (0 ✗)
   … Câblage Surveillance AML (A-69..A-86, R189→R206) — 45/45
   … Câblage Couche Shariah (IS-01..IS-15, R207→R221) — 41/41
$ grep -rlE "jest.mock|__mocks__" apps → AUCUN
$ pnpm test:e2e (vrai Postgres)  → 1er run : 1 échec (R2)  ⇒ cause = accumulation de données
   (subquery 21000 « more than one row » sur kyc_files.code, artefact de runs répétés locaux)
   après `prisma migrate reset` :  Tests: 6 passed, 6 total
```
**VRAI code vs mocks** : **0 mock jest** dans tout le dépôt. Les **425** tests du harnais exercent le **vrai code** des services/moteurs mais avec un **faux Prisma en mémoire** (`fakePrisma`, 38 specs) — logique métier réelle, couche de persistance simulée. Les **6** tests e2e exercent la **pile réelle** (`createNestApplication` + `PrismaService`) contre **Postgres réel**. Nombre réel : **425 (harnais) + 6 (e2e vraie DB) = 431 tests**, tous verts sur base propre.

### 4. Intégration frontend ↔ backend

```
$ grep -rn "OLIVE_API_URL|fetch(|apiGet" apps/web/src
  aml/AmlParametres.tsx      : apiGet("/v1/parametres/registre") + fetch POST /v1/parametres/valeur/:cle
  islamic/FinanceIslamique.tsx : fetch POST /v1/islamic/zakat, /v1/islamic/evaluer
  kyc/KycCreate.tsx          : apiGet("/v1/clients") + fetch POST /v1/kyc
  kyc/KycDetail.tsx          : fetch /v1/kyc/:code
  clients/ClientsList.tsx    : apiGet("/v1/clients", seed)
  lib/api.ts                 : if (!OLIVE_API_URL) return seed;   // fallback démo
```
**Verdict** : flux bout-en-bout **RÉEL et câblé** (5 features appellent `/v1/...`), **mais** conditionné à `OLIVE_API_URL`. Sans cette variable, `apiGet` retombe sur des **seeds en dur** (mode démo). Ce n'est **pas** un « backend îlot non consommé » — le câblage existe ; c'est un **hybride démo/produit** assumé (`lib/api.ts` : « le pont entre la démo single-file et le produit »).

### 5. Les deux capacités critiques

**a) Rejeu à date / time-machine** — **EXISTE (partiel, exposé HTTP)** :
```
parametres.service.ts : valeurEffective(ctx, cle, date) · configALaDate(ctx, date)
   → reconstruit la valeur effective d'un paramètre à une date passée depuis le journal
     append-only tenant_param_changes (R127)
parametres.controller.ts:15 : @Get("valeur/:cle")  @Query("date")  → exposé HTTP
crm.service.ts:46 : timeline() PROJETTE domain_events (projection du journal, état courant)
events/outbox.worker.ts : projection AVANT (kyc.validated → fiche client)
```
Le rejeu-à-date **existe pour les paramètres** (config à une date) et est **exposé en HTTP**. Il **n'existe PAS** de reconstruction généralisée d'un agrégat métier arbitraire (dossier KYC, client) à une date T — `mros.service.ts:81` note même « R130 : relecture opposable — **jamais de reconstruction** » (choix délibéré).

**b) Prouver une règle depuis l'app** — **ABSENT du runtime** :
```
$ grep -rnE "@(Get|Post)\(" --include=*.controller.ts | grep -iE "prove|scenario|gherkin|preuve|replay"
  AUCUNE route de ce type
```
Aucun endpoint `proveRule/runScenario/executeGherkin`. Les règles se prouvent par le **harnais offline** (425) et les specs `*.wiring.spec.ts`, pas par une route applicative. (Le « Preuves moteur » du RUNBOOK est un écran de **démo** Playwright, hors app.)

### 6. Blocs récents + état git

```
$ git log --oneline (extrait)
521bc54 Merge PR #23 … bloc 49b ledgers shariah
bea21f8 Merge PR #22 … bloc 49 couche shariah R207-R221
ef16edc Merge PR #21 … bloc 48 surveillance AML R189-R206
$ git status → working tree clean (branch master)
$ grep -rlE "R189|R207|AmlSignal|IslamicSignal" apps/*/src
  apps/api/src/modules/aml/*  ·  apps/api/src/modules/islamic/*  ·  apps/web/src/features/{aml,islamic}/*
```
- **Bloc 48 (AML PB, R189→R206)** : **MERGÉ** (PR #21, `ef16edc`). Module `aml/` présent, 45/45 tests.
- **Bloc 49 (Islamic, R207→R221)** : **MERGÉ** (PR #22, `bea21f8`). Module `islamic/` présent, 41/41 tests.
- **Bloc 49b (ledgers Shariah persistés)** : **MERGÉ** (PR #23, `521bc54`).

---

## PARTIE C — Documents mis à jour

Fichiers de référence corrigés (chacun reçoit un en-tête « ## État réel vérifié au 2026-07-22 »
qui pointe ici et corrige les affirmations fausses/obsolètes ; l'historique utile est conservé) :

| Fichier | Ce qui était faux/obsolète | Correction |
|---|---|---|
| `docs/CATALOGUE-REGLES-R1-R206.md` | Titre « R1..R206 » ; 0 mention de R207→R221 | En-tête : le code implémente désormais **R1→R221** (AML R189-R206 + Islamic R207-R221 mergés) |
| `ARCHITECTURE-ENTERPRISE.md` | « AML Engine : scénarios en lib », « Rule Engine : règles en constantes », roadmap **P2** | En-tête : AML (R189-R206) **implémenté et mergé** (module `aml/`, DB réelle, 45 tests) ; Islamic (R207-R221) livré |
| `README.md` | Aucun périmètre/état chiffré | En-tête : périmètre réel R1→R221, 431 tests verts (425 harnais + 6 e2e) |
| `PLAN-EXECUTION.md` | AML/CRS listés comme roadmap future | En-tête : détection AML + couche Islamic désormais **en code** |
| `docs/olive-session-handoff-2026-07-19.md` | Comptes de tests figés au 19.07 (202, 200, 150/150…) | En-tête : snapshot daté, périmètre courant = **425/6** |
| `docs/matrice-addendum-2026-07-19.md` | Matrice R100-R108 datée 19.07 | En-tête : snapshot daté, superseded (voir ce fichier + RUNBOOK) |

`docs/RUNBOOK-OPS.md` : **déjà à jour** (mentionne 425, BLOC 49b, `islamic_signals`) — non modifié.

**Réponse binaire — « Dois-je mettre à jour les sources ? »** : **OUI.** Les docs racine/`docs/` décrivaient un périmètre arrêté avant les blocs AML/Islamic (roadmap « P2 », catalogue « R1..R206 », comptes figés au 19.07). Ils sont corrigés ci-dessus ; le RUNBOOK, lui, était déjà juste.
