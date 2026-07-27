# Décalage — Front React (`apps/web`) vs Maquette démo (`olive-demo.html`)

**Vérifié le 2026-07-27 (maj après Vagues 13-17 + lot CPSI)** par lecture des fichiers (`demo/olive-demo.html` NAV @L12838, `apps/web/src/app/router.tsx`, `apps/web/src/features/*`).
Deux objets **différents** :

| | `olive-demo.html` | `apps/web` (React) |
|---|---|---|
| Nature | Maquette **statique**, données **seed** en dur | App réelle, **câblée au backend** (routes `/v1/…`) |
| Écrans | **~73** navigables (81 items de nav, dont têtes/doublons/role-only) | **41** écrans (comptés au routeur) |
| Backend | **Aucun** (0 appel réseau métier) | **Postgres réel** (fallback seed **signalé** par bandeau) |

**La maquette montre la CIBLE produit ; le React livre le SOCLE vendable, écran par écran, câblé.**
Couverture actuelle : **41 / 73 ≈ 56 %** — **plus aucun écran en FE-05 seed** : Workflow Instances (V12), Formations (V13), Business Trip (V14), Tâches (V16), NBA décidable (V17) sont réels, et le lot **CPSI** (2026-07-27) ajoute Profil & score, Segmentation, Alertes & propositions de case (porte mince R63-R83, amendement R248-R252). Écarts + décisions A1 : `docs/ECARTS-FRONT.md`.

---

## 1. Écrans démo AVEC équivalent React câblé backend (✅)

| Écran démo (`id`) | Écran React | Routes réelles |
|---|---|---|
| clients | `ClientsList` | `/v1/clients` |
| persons | `PersonnesLiees` (Personnes/UBO) | `/v1/personnes` `/:id/roles` `/relations` |
| kyc | `KycCreate` + `KycDetail` | `/v1/kyc` `/:code` `/visas` `/validate` |
| review | `AccountReview` | `/v1/screening/run` + visas KYC |
| coc | `ChangementCirconstances` | `/v1/personnes/:id/coc` |
| screening | `Screening` + `ScreeningAvance` | `/v1/screening/run` `/hits/:id/qualify` |
| transferts | `TransfertsOrdres` | `/v1/transactions/evaluer` `/revue` `/:id/decider` |
| settlement | `Settlement` | `/v1/corebanking/etat` `/importer` |
| registre | `RegistreLBA` | `/v1/mros` `/transactions/revue` `/screening/runs` |
| reporting | `ReportingMros` | `/v1/mros` `/decider` `/:id` `/:id/gel` |
| ged | `GedPieces` + `GedCoffre` | `/v1/ged/documents` `/:id` |
| oil | `FinanceIslamique` | `/v1/islamic/evaluer` `/zakat` |
| execdash | `Dashboard` | `/v1/onboarding` `/riskcases` `/screening/hits` |
| *(onboarding — pas un item de nav démo distinct, mais présent)* | `Onboarding` | `/v1/onboarding` `/:id/transition` `/v1/kyc` |

**+ 4 écrans React « capacités » sans item de nav démo dédié** (ils enrichissent le pôle Compliance) :
`AlertsQueue` (File d'alertes), `DossiersRisque` (Dossiers de risque, R134), `RejeuKyc` (rejeu KYC à date, R127), `AmlParametres` (Règles AML / registre).

→ **~13 écrans démo « pleins » + 4 capacités + onboarding + CRM/Contact Reports/Workflow/Corroboration (Vague 5) = 24 écrans React, tous câblés.**

---

## 2. Écrans démo PARTIELLEMENT couverts (🟡)

| Écran démo | Ce que React couvre | Ce qui manque |
|---|---|---|
| aml (AML Investigation Workspace) | Règles AML + File d'alertes + Dossiers de risque | Le **workspace d'investigation** unifié (timeline, liens, graphe d'enquête) |
| ✅ **FAIT (Vague 8)** amlcat (Référentiel AML) | `ReferentielAml` (18 scénarios R189→R206 + seuils effectifs) | — |
| ✅ **FAIT (Vague 9)** sbaml (Bac à sable AML) | `SandboxAml` (dry-run d'un seuil R94/B-02 : avant/après/nouvelles nommées, `ecriture=false`) | `POST /v1/aml/sandbox` |
| ✅ **FAIT (Vague 10)** Ports (intégrations) | `Ports` (état des ports ratifiés core/IA/coffre, refus gracieux, aucun secret) | `GET /v1/ports`, `GET\|POST /v1/ports/:id/health` |
| ✅ **FAIT (Vague 10→17)** NBA (Next Best Action) | `NextBestAction` — suggestions décidables (R243), décision humaine unique câblée (R244/R245, R44) | `GET /v1/nba` · `POST /:id/decision` |
| ✅ **FAIT (Vague 12)** Workflow Instances | `WorkflowInstances` **réel** — projection du workflow gouverné KYC (steps + visas R15 + timeline). `<VisaBadge>` composant unique. | `GET /v1/workflow-instances`, `/:id`, `/:id/events` |
| ✅ **FAIT (Vague 13)** Formations & Certifications (MOD-43) | `Formations` — catalogue tenant (R231), complétion événementielle + attestation GED (R232), visa (R235), rejeu certifiant (R238) | `GET/POST /v1/formations/*` |
| ✅ **FAIT (Vague 14)** Business Trip (MOD-75) | `BusinessTrip` — cycle R222, avis cross-border R223, signaux KYC/certif R224/R228, visas R225, contact reports R226, rejeu R229, révision R230 | `GET/POST /v1/trips/*` |
| ✅ **FAIT (Vague 16)** Tâches | `Tasks` — liste scopée serveur (R240), complétion événementielle (R241), SLA informatif (R242). Sort de FE-05. | `GET/POST /v1/tasks/*` |
| txrisk (Transactions Risk Monitoring) | `TransfertsOrdres` (portail, verdict, file de revue) | Monitoring/tendances temps réel, tableaux de bord tx |

---

## 3. Écrans démo NON construits en React (❌) — regroupés par nature

**a) Backend ratifié EXISTE, écran React à faire** (prochaines vagues, faible risque) :
- ✅ **FAIT (Vague 5)** : `crm` (CRM Banque), `contactreports` (Contact Reports) · reste : `nextbestaction`, `tasks`
- ✅ **FAIT (Vague 5)** : `wfdesigner`/`wfengine` (Workflow Designer/Rules, porte `WorkflowModule`) · reste : `wfmanagement` (instances)
- ✅ **FAIT (Vague 5)** : `corrob` (Corroboration KYC) · reste : `offboarding` (canon à fournir)
- ✅ **PARTIEL (Vague 6/9)** : `sbowner` (gouvernance registre R-Q) via Registre de paramétrage + Config & Go-live · ✅ **`sbaml` FAIT (Vague 9)** — dry-run AML sur le moteur ratifié `evaluer` (R94/B-02, canon confirmé dans `spec/catalogue-amendements-R89-R99-ratifies.md`) · ✅ **`sbonb` FAIT (2026-07-27)** — dry-run SLA onboarding (`POST /v1/onboarding/sandbox`, `onboardingSlaJours`, impact nominatif, FAT-SBONB-01/02) · ⚠️ **DRY-RUN restants** (`sbkyc`/`sbbrm`/`sbcf`/`sbwf`) = **bloqués par le canon, pas par le code** — reconnaissance consignée dans `docs/ECARTS-FRONT.md` (barèmes KYC non gouvernés, moteurs BRM/CF non isolés, objet sbwf non défini) — R95 (stress test/courbe de réponse), R96 (propose≠applique), R97 (cumul de tension) non encore surfacés
- Sections & droits (`sdkyc`, `sdar`, `sdgar`, `paramfields`, `cocparam`) → registre R-Q existe

**b) « Intégrer, pas refaire » — dépend d'un PORT externe, pas d'un moteur à recoder** :
- ✅ **FAIT (Vague 7)** : `pms` (PMS — compliance sur positions, R105→R108, PAS un moteur recodé) · reste : `fx` · `custody` · `mobile` · `integrations`/`apidoc` (Core Banking)
- → le **port** core existe (`CorebankingModule`, R167→R169) ; l'écran se branchera sur un connecteur réel, jamais sur un moteur réimplémenté.

**c) Domaines non encore ouverts (ni backend ratifié, ni écran)** :
- `command` (Command Center) · `prospection` / `prospect_*` (pré-prospection) · `crossborder` · `invest` (investigation financière) · `swiftlab` (SWIFT/SEPA) · `legal` (contrats) · `opprisk` (Octopulse) · `regwatch` (veille régl.) · `olivia` (AI Core) · `bi` (reporting sur mesure) · `wfaudit` / `auditit` (audit) · `paramnav` / `iamguide` / `ssoparam` (IAM/SSO) · `admin` / `editorconsole` · `home`
- ✅ **PARTIEL (2026-07-27)** : `cpsi` / `cpsigroupes` — la porte mince CPSI (R63-R83, PR #46) est câblée et **3 écrans React** existent : `CpsiProfiling` (score+drivers R67), `CpsiSegmentation` (R65), `CpsiRiskCases` (alertes R80/R81 + émission `case_proposal` R252 — l'instruction reste chez riskcases). ✅ `cpsiparam` FAIT (2026-07-27) : `CpsiParam` — règles en clair (R68), bac à sable avec verrou « Proposer » tant que non simulé (R70), propositions adoptées/rejetées motivées (R69), jauge santé (R250). ✅ `cpsiguide` FAIT (2026-07-27) : `CpsiGuide` — guide ANCRÉ sur le réel (règles R68 + catalogue R79 servis par la porte, vocabulaire ratifié R80/R81, invariants R248-R252). **Le pôle CPSI de la maquette est couvert en entier.**

---

## 4. Liste noire (⛔) — CADUQUE pour `trip` et `formations`

**Correction (2026-07-27).** La version précédente de ce document classait `trip` (Business Trip) et
`formations` (Formations & habilitations) « jamais à construire ». Ils ont depuis été **RATIFIÉS et
CONSTRUITS** : « OK pour R222..R238 » → MOD-75 Business Trip (R222-R230, Vague 14, BT-01..10) et
MOD-43 Formations & Certifications (R231-R238, Vague 13, FO-01..08), backend + écrans React câblés.
La liste noire ne s'applique plus à aucun item de cette version de la maquette — **une exclusion
n'était pas du canon** : seule la ratification décide, dans un sens comme dans l'autre.

*(Les autres items historiques de la liste noire — RH, budget, réunions, cyber-SOC — n'apparaissent
pas sous ces noms dans cette version de la maquette.)*

---

## 5. Lecture honnête

- Le React **ne « suit » pas** la maquette écran pour écran : il en couvre **~56 % (41/73)**, mais **la partie câblée est réelle** (0 mock, Postgres, RLS, FAT prouvées) là où la maquette est **100 % seed**. Il reste **~35 écrans** : bacs à sable restants + sections & droits (backend ratifié, écrans à faire) ; `fx`/`custody`/`mobile`/`integrations` (ports externes) ; et les domaines jamais ouverts (§3c).
- La maquette reste la **vision cible** (73 écrans) ; la stratégie tenue est **incrémentale et prouvée** : chaque vague transforme un lot d'écrans-maquette en écrans React câblés + recette FAT.
- Prochaines vagues « à fort levier & faible risque » = groupe **3.a** (backend déjà ratifié) : CRM/Contact Reports/Tâches, Workflow, Offboarding, Corroboration, Sandboxes de paramétrage.
- Ne pas se laisser piéger par la maquette : **groupe 3.b = ports** (ne pas recoder un PMS/core), **groupe 4 = liste noire** (ignorer).
