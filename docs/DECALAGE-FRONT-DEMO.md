# Décalage — Front React (`apps/web`) vs Maquette démo (`olive-demo.html`)

**Vérifié le 2026-07-26 (maj après Vague 5)** par lecture des fichiers (`demo/olive-demo.html` NAV @L12838, `apps/web/src/features/*`).
Deux objets **différents** :

| | `olive-demo.html` | `apps/web` (React) |
|---|---|---|
| Nature | Maquette **statique**, données **seed** en dur | App réelle, **câblée au backend** (routes `/v1/…`) |
| Écrans | **~73** navigables (81 items de nav, dont têtes/doublons/role-only) | **28** écrans |
| Backend | **Aucun** (0 appel réseau métier) | **Postgres réel** (fallback seed **signalé** par bandeau) |

**La maquette montre la CIBLE produit ; le React livre le SOCLE vendable, écran par écran, câblé.**
Couverture actuelle : **~29 / 73 ≈ 40 %** des écrans démo ont un équivalent React **réellement câblé** (Vague 9 a ajouté le Bac à sable AML — dry-run d'un seuil R94/B-02, impact nominatif sans écriture).

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
| txrisk (Transactions Risk Monitoring) | `TransfertsOrdres` (portail, verdict, file de revue) | Monitoring/tendances temps réel, tableaux de bord tx |

---

## 3. Écrans démo NON construits en React (❌) — regroupés par nature

**a) Backend ratifié EXISTE, écran React à faire** (prochaines vagues, faible risque) :
- ✅ **FAIT (Vague 5)** : `crm` (CRM Banque), `contactreports` (Contact Reports) · reste : `nextbestaction`, `tasks`
- ✅ **FAIT (Vague 5)** : `wfdesigner`/`wfengine` (Workflow Designer/Rules, porte `WorkflowModule`) · reste : `wfmanagement` (instances)
- ✅ **FAIT (Vague 5)** : `corrob` (Corroboration KYC) · reste : `offboarding` (canon à fournir)
- ✅ **PARTIEL (Vague 6/9)** : `sbowner` (gouvernance registre R-Q) via Registre de paramétrage + Config & Go-live · ✅ **`sbaml` FAIT (Vague 9)** — dry-run AML sur le moteur ratifié `evaluer` (R94/B-02, canon confirmé dans `spec/catalogue-amendements-R89-R99-ratifies.md`) · ⚠️ **DRY-RUN restants** (`sbkyc`/`sbbrm`/`sbonb`/`sbcf`/`sbwf` : mêmes R93→R99 sur d'autres moteurs) = à ouvrir sur le même patron `sandbox` quand chaque moteur cible est isolé — R95 (stress test/courbe de réponse), R96 (propose≠applique), R97 (cumul de tension) non encore surfacés
- Sections & droits (`sdkyc`, `sdar`, `sdgar`, `paramfields`, `cocparam`) → registre R-Q existe

**b) « Intégrer, pas refaire » — dépend d'un PORT externe, pas d'un moteur à recoder** :
- ✅ **FAIT (Vague 7)** : `pms` (PMS — compliance sur positions, R105→R108, PAS un moteur recodé) · reste : `fx` · `custody` · `mobile` · `integrations`/`apidoc` (Core Banking)
- → le **port** core existe (`CorebankingModule`, R167→R169) ; l'écran se branchera sur un connecteur réel, jamais sur un moteur réimplémenté.

**c) Domaines non encore ouverts (ni backend ratifié, ni écran)** :
- `command` (Command Center) · `prospection` / `prospect_*` (pré-prospection) · `crossborder` · `invest` (investigation financière) · `swiftlab` (SWIFT/SEPA) · `legal` (contrats) · `opprisk` (Octopulse) · `regwatch` (veille régl.) · `cpsi` / `cpsiparam` / `cpsiguide` / `cpsigroupes` (profilage CPSI — service Python séparé) · `olivia` (AI Core) · `bi` (reporting sur mesure) · `wfaudit` / `auditit` (audit) · `paramnav` / `iamguide` / `ssoparam` (IAM/SSO) · `admin` / `editorconsole` · `home`

---

## 4. Écrans démo relevant de la LISTE NOIRE (⛔ — jamais à construire)

Présents dans la maquette, **délibérément non construits** (hors produit CLM) :
- `trip` (**Business Trip**) · `formations` (**Formations & habilitations** = e-learning)

*(Les autres items de la liste noire — RH, budget, réunions, cyber-SOC — n'apparaissent pas sous ces noms dans cette version de la maquette.)*

---

## 5. Lecture honnête

- Le React **ne « suit » pas** la maquette écran pour écran : il en couvre **~33 %**, mais **la partie câblée est réelle** (0 mock, Postgres, RLS, FAT prouvées) là où la maquette est **100 % seed**.
- La maquette reste la **vision cible** (73 écrans) ; la stratégie tenue est **incrémentale et prouvée** : chaque vague transforme un lot d'écrans-maquette en écrans React câblés + recette FAT.
- Prochaines vagues « à fort levier & faible risque » = groupe **3.a** (backend déjà ratifié) : CRM/Contact Reports/Tâches, Workflow, Offboarding, Corroboration, Sandboxes de paramétrage.
- Ne pas se laisser piéger par la maquette : **groupe 3.b = ports** (ne pas recoder un PMS/core), **groupe 4 = liste noire** (ignorer).
