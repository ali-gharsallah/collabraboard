# Cahier de tests — O-Live (global, évolutif)

**Mis à jour le 2026-07-22.** Cahier consolidé, une section par vague. Chaque ligne renvoie à une
exigence et à une preuve. Résultats prouvés (voir `docs/tests/PREUVES/`). Certificat : `docs/CERTIFICAT-ETAT.md`.

## Comment rejouer (auditeur)

```bash
cd apps/api
npx prisma migrate reset --force --skip-seed --skip-generate && pnpm run prisma:post   # base propre + RLS
pnpm run test:rules                     # règles R1→R221 — attendu 425/425
pnpm run test:e2e                       # intégration + FAT — attendu 16/16
pnpm run test:e2e -- fat-vague1         # les 10 FAT métier seuls
psql "postgresql://olive_app:olive_app@localhost:5433/olive_test" -tAc "SELECT count(*) FROM clients;"  # RLS → 0
cd ../web && pnpm run test:demo-banner  # bandeau mode démo — 9/9
```

## Vague 1 — cahier par écran

| Écran | ID test | Exigence | Ce qui est vérifié (humain) | Type | Route | Résultat |
|---|---|---|---|---|---|---|
| Clients | FAT-CLIENT-01 | RLS | Création client + un autre tenant ne le voit pas | e2e/FAT | `POST /v1/clients` · `GET /v1/clients` | ✅ PASS |
| KYC | FAT-KYC-01 | Four-eyes / golden record | Le créateur ne valide pas ; un tiers valide → VALIDATED + `kyc.validated` | e2e/FAT | `POST /v1/kyc/:code/validate` | ✅ PASS |
| KYC | FAT-KYC-02 | R13 | Un contributeur ne vise pas sa section | e2e/FAT | `POST /v1/kyc/:code/visas/:section` | ✅ PASS |
| Règles AML | FAT-AML-01 | R192 | Contrepartie sanctionnée → blocage auto | e2e/FAT | `POST /v1/aml/evaluer` | ✅ PASS |
| Règles AML | FAT-AML-02 | R189 | Structuring → alerte niveau 2 non bloquante | e2e/FAT | `POST /v1/aml/evaluer` | ✅ PASS |
| File d'alertes | FAT-ALERTE-01 | tenant-scope | Alertes consultables et cloisonnées | e2e/FAT | `GET /v1/aml/clients/:id/signaux` | ✅ PASS |
| File d'alertes | FAT-ALERTE-02 | R209 / R216 | Maysir bloque ; caritative sanctionnée → revue humaine | e2e/FAT | `POST /v1/islamic/evaluer` | ✅ PASS |
| File d'alertes | **FAT-ALERTE-03** | **R133** | **Décider une alerte = ouvrir un dossier de risque ; jamais un cas vide ; file cloisonnée** | e2e/FAT | **`POST /v1/riskcases`** · `GET /v1/riskcases` | ✅ PASS |
| Rejeu KYC à date | **FAT-REJEU-KYC-01** | **R127 (esprit)** | **Dossier reconstruit à une date : INEXISTANT → EN_COURS → VALIDE (journal append-only)** | e2e/FAT | **`GET /v1/kyc/:code/a-date`** | ✅ PASS |
| Rejeu à date (paramètre) | FAT-REJEU-01 | R127 | Valeur d'une règle à une date passée (aujourd'hui=45, hier=30) | e2e/FAT | `GET /v1/parametres/valeur/:cle?date=` | ✅ PASS |
| (transverse) | Bandeau démo | crédibilité | Seed → bandeau ; API → rien | unit (front) | — | ✅ 9/9 |

**Vague 1 : 10/10 FAT PASS + bandeau 9/9. Non-régression : règles 425/425, e2e 20/20.**

## Vague 2 — cahier par écran (Surveillance & Dossiers)

| Écran | ID test | Exigence | Ce qui est vérifié (humain) | Type | Route | Résultat |
|---|---|---|---|---|---|---|
| Dossiers de risque | **FAT-DOSSIER-01** | **R134 · R133/R136 · R7** | **2 notes append-only relues en ordre ; NOUVELLE→EN_ANALYSE ok ; clôture sans motif refusée ; clôture motivée → CLOTUREE** | e2e/FAT | **`POST`/`GET /v1/riskcases/:id/notes`** · `POST …/transition` | ✅ PASS |
| Dossiers de risque | **FAT-DOSSIER-02** | **R133** | **NOUVELLE→CLOTUREE directe refusée (transition illégale)** | e2e/FAT | `POST /v1/riskcases/:id/transition` | ✅ PASS |
| Pièces (GED) | **FAT-GED-01** | **R110 · R145** | **CO autorisé voit la pièce ; MLRO voit 0 ; fiche = empreinte, jamais le contenu** | e2e/FAT | `GET /v1/ged/documents?clientId=` · `GET /v1/ged/documents/:id` | ✅ PASS |
| Pièces (GED) | **FAT-GED-02** | **RLS** | **Un autre tenant ne voit aucune pièce** | e2e/FAT | `GET /v1/ged/documents?clientId=` | ✅ PASS |

**Vague 2 : 4/4 FAT PASS. Non-régression : règles 425/425, e2e 20/20 (aucun modèle Prisma nouveau).**

## Vague 3 — cahier par écran (Le cycle client de bout en bout)

| Écran | ID test | Exigence | Ce qui est vérifié (humain) | Type | Route | Résultat |
|---|---|---|---|---|---|---|
| Onboarding | **FAT-ONBOARD-01** | **R117/R118/R119** | **Aiguillage EDD/SDD (trace auditable) ; ouverture bloquée sans KYC VALIDATED** | e2e/FAT | `POST /v1/kyc` · `POST /v1/onboarding` · `/:id/transition` | ✅ PASS |
| Screening | **FAT-SCREEN-01** | **R100/R101/R7/R103 · R39/R44** | **Run tracé ; qualif sans motif refusée ; VP → escalade proposée ; auteur = jeton** | e2e/FAT | `POST /v1/screening/run` · `/hits/:id/qualify` · `GET /runs` | ✅ PASS |
| Account Review | **FAT-REVIEW-01** | **R103 + four-eyes** | **Re-screening tracé + décision par visa KYC gouverné ; aucun agrégat « revue » inventé** | e2e/FAT | `POST /v1/screening/run` · `POST /v1/kyc/:code/validate` | ✅ PASS |
| Personnes / UBO | **FAT-UBO-01** | **R31 · R34** | **UBO rattaché ; relation bijective relue des deux côtés ; isolation tenant** | e2e/FAT | `POST /v1/personnes` · `/:id/roles` · `/relations` · `GET /:id/relations` | ✅ PASS |
| Change of Circumstances | **FAT-COC-01** | **R30 · R42** | **CoC identité → re-screening déclenché + propagation ; aucune bascule par effet de bord** | e2e/FAT | `POST /v1/personnes/:id/coc` | ✅ PASS |
| Dashboard | **FAT-DASH-01** | **RLS** | **Stock par état (onboardings/dossiers/hits) ; autre tenant cloisonné** | e2e/FAT | `GET /v1/onboarding` · `/v1/riskcases` · `/v1/screening/hits` | ✅ PASS |
| (bout-en-bout) | **FAT-CYCLE-01** | **cycle complet** | **Entrée → KYC → screening → revue → changement, sans trou, Postgres réel** | e2e/FAT | (chaînage des routes ci-dessus) | ✅ PASS |

**Vague 3 : 7/7 FAT PASS. Non-régression : règles 425/425, e2e 27/27 (aucun modèle Prisma nouveau).**

## Vague 4 — cahier par écran (Écrans « plateforme »)

| Écran | ID test | Exigence | Ce qui est vérifié (humain) | Type | Route | Résultat |
|---|---|---|---|---|---|---|
| Transferts & ordres | **FAT-TX-01** | **R140/R142/R143/R7/R132** | **SUSPEND tracé ; file habilitée ; décision motivée ; statut client sans motif AML** | e2e/FAT | `POST /v1/transactions/evaluer` · `/revue` · `/:id/decider` · `/:id/statut-client` | ✅ PASS |
| Settlement | **FAT-SETTLE-01** | **R167/R168/R114** | **État sync lisible ; import sans port REFUSÉ (jamais un simulacre)** | e2e/FAT | `GET /v1/corebanking/etat` · `POST /importer` | ✅ PASS |
| Screening avancé | **FAT-SCREEN-ADV-01** | **R100→R103** | **Adverse media = paramètre du moteur ratifié ; trace + qualification** | e2e/FAT | `POST /v1/screening/run` · `/hits/:id/qualify` | ✅ PASS |
| Reporting MROS | **FAT-MROS-01** | **R130/R132** | **Empreinte opposable ; dossier figé (re-décision refusée) ; art. 10a** | e2e/FAT | `POST /v1/mros/decider` · `GET /v1/mros/:id` | ✅ PASS |
| GED / coffre | **FAT-GED-COFFRE-01** | **R110/R145** | **Fiche = versions (preuve) filtrées au rôle, jamais le contenu** | e2e/FAT | `GET /v1/ged/documents` · `/documents/:id` | ✅ PASS |
| Registre LBA | **FAT-REGISTRE-01** | **RLS** | **Piste d'audit agrégée (MROS + runs) ; autre tenant cloisonné** | e2e/FAT | `GET /v1/mros` · `/v1/screening/runs` | ✅ PASS |

**Vague 4 : 6/6 FAT PASS. Non-régression : règles 425/425, e2e 33/33 (aucun modèle Prisma nouveau).**

## Vague 5 — cahier par écran (Rattrapage maquette : CRM & Workflow)

| Écran | ID test | Exigence | Ce qui est vérifié (humain) | Type | Route | Résultat |
|---|---|---|---|---|---|---|
| CRM Banque | **FAT-CRM-01** | **R186/R187** | **Timeline projetée + prochains gestes proposés, jamais exécutés** | e2e/FAT | `GET /v1/crm/clients/:id/timeline` · `/gestes` | ✅ PASS |
| Contact Reports | **FAT-CR-01** | **R188/R138** | **Compte rendu tracé ; pré-remplissage IA refusé sans port** | e2e/FAT | `POST /v1/crm/clients/:id/entretiens` · `/pre-remplir` | ✅ PASS |
| Workflow Designer/Rules | **FAT-WF-01** | **R171/R172/R173/R7** | **Publiée datée + immuable ; non-habilité refusé ; sans motif refusé ; résolution datée** | e2e/FAT | `POST/PATCH /v1/workflow/definitions` · `/:id/publier` · `GET /resoudre` | ✅ PASS |
| Corroboration KYC | **FAT-CORROB-01** | **R36** | **Divergence → Central File ouvert + tâche ; aucune donnée modifiée** | e2e/FAT | `POST /v1/personnes/:id/corroboration` | ✅ PASS |

**Vague 5 : 4/4 FAT PASS. Non-régression : règles 425/425, e2e 37/37 (aucun modèle Prisma nouveau). Zéro invention — canon déjà ratifié.**
**Correctif d'infra** : `PrismaService.onModuleDestroy(){ $disconnect() }` (fuite de connexions entre suites e2e) + `connection_limit=3` (DATABASE_URL test/CI). **Liste noire respectée** (aucun écran RH/e-learning/voyage/budget/réunions/cyber-SOC).

## Socle technique (rappel)

Les FAT s'appuient sur **425 tests de règles** (R1→R221) et **37 e2e** (Postgres réel : kyc-rules 6
+ FAT V1 10 + V2 4 + V3 7 + V4 6 + V5 4). Traçabilité règle-par-règle :
`docs/tests/COUVERTURE-REGLES.md`. Errata de test : **E4** (sous-requête `kyc-rules` scopée au
tenant — le `code` KYC n'est unique que par tenant).

## Vagues suivantes

*(À compléter — le cahier grandit par section : Vague 6, etc.)*
