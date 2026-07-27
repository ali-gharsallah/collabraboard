# Certificat d'état — O-Live (source unique, datée)

**État vérifié au 2026-07-22.** Page unique de vérité — remplace les certificats/rapports de
recette isolés. Tout est prouvé par exécution réelle (preuves : `docs/tests/PREUVES/`).
Index maître : `docs/PROJECT-INDEX.md`.

## Écrans réels (frontend React `apps/web`) — Vague 1

| # | Écran | Route(s) backend consommée(s) | Fallback seed | État |
|---|---|---|---|---|
| 1 | **Clients** | `GET /v1/clients` · `POST /v1/clients` | **visible** (bandeau) | ✅ réel |
| 2 | **KYC** (création + détail) | `POST /v1/kyc` · `GET /v1/kyc/:code` · `PATCH …/questions` · `POST …/visas` · `POST …/validate` | **visible** | ✅ réel |
| 3 | **Règles AML** | `GET /v1/parametres/registre` · `POST /v1/parametres/valeur/:cle` | **visible** | ✅ réel |
| 4 | **File d'alertes** | `GET /v1/aml/clients/:id/signaux` · **`POST /v1/riskcases`** (décision) · `GET /v1/riskcases` | **visible** | ✅ réel (nouveau) |
| 5 | **Rejeu KYC à date** | **`GET /v1/kyc/:code/a-date?date=…`** | **visible** | ✅ réel (nouveau) |
| (+) | Finance Islamique | `POST /v1/islamic/{zakat,evaluer}` | **visible** | ✅ réel |

## Écrans réels (frontend React `apps/web`) — Vague 2 (Surveillance & Dossiers)

| # | Écran | Route(s) backend consommée(s) | Fallback seed | État |
|---|---|---|---|---|
| 6 | **Dossiers de risque** (instruction) | `GET /v1/riskcases` · **`POST`/`GET /v1/riskcases/:id/notes`** (append-only R134) · `POST /v1/riskcases/:id/transition` (R133/R7) | **visible** | ✅ réel (nouveau) |
| 7 | **Pièces (GED)** (consultation) | `GET /v1/ged/documents?clientId=` (filtré au rôle R110) · `GET /v1/ged/documents/:id` (fiche = empreinte, jamais le contenu R145) | **visible** | ✅ réel (nouveau) |

## Écrans réels (frontend React `apps/web`) — Vague 3 (Le cycle client de bout en bout)

| # | Écran | Route(s) backend consommée(s) | Fallback seed | État |
|---|---|---|---|---|
| 8 | **Onboarding** (aiguillage) | `POST /v1/onboarding` · `/:id/transition` · `POST /v1/kyc` (workflow SDD/CDD/EDD + riskTrace, R117/R119) | **visible** | ✅ réel (nouveau) |
| 9 | **Screening** | **`POST /v1/screening/run`** · **`/hits/:id/qualify`** · `GET /hits` · `/runs` (R100→R103, R39/R44) | **visible** | ✅ réel (nouveau) |
| 10 | **Account Review** | orchestration : `POST /v1/screening/run` (R103) + visas KYC four-eyes — zéro canon inventé | **visible** | ✅ réel (nouveau) |
| 11 | **Personnes / UBO** | **`POST /v1/personnes`** · **`/:id/roles`** · **`/relations`** · `GET /:id/relations` (R31/R34) | **visible** | ✅ réel (nouveau) |
| 12 | **Change of Circumstances** | **`POST /v1/personnes/:id/coc`** (R30/R42) | **visible** | ✅ réel (nouveau) |
| 13 | **Dashboard exécutif** | **`GET /v1/onboarding`** · `/v1/riskcases` · `/v1/screening/hits` (stock par état, RLS) | **visible** | ✅ réel (nouveau) |

## Écrans réels (frontend React `apps/web`) — Vague 4 (Écrans « plateforme »)

| # | Écran | Route(s) backend consommée(s) | Fallback seed | État |
|---|---|---|---|---|
| 14 | **Transferts & ordres** | **`POST /v1/transactions/evaluer`** · `/revue` · `/:id/decider` · `/:id/statut-client` (R140→R143, R132) | **visible** | ✅ réel (nouveau) |
| 15 | **Settlement** | **`GET /v1/corebanking/etat`** · `POST /importer` (port R167→R169 ; refus sans connecteur) | **visible** | ✅ réel (nouveau) |
| 16 | **Screening avancé** | `POST /v1/screening/run` (listes complémentaires) · `/hits/:id/qualify` (R100→R103) | **visible** | ✅ réel (nouveau) |
| 17 | **Reporting MROS** | **`GET /v1/mros`** · `POST /decider` · `GET /:id` · `/:id/gel` (R129→R132, empreinte opposable) | **visible** | ✅ réel (nouveau) |
| 18 | **GED / coffre** | `GET /v1/ged/documents` · `/documents/:id` (preuve = versions, jamais le contenu R145) | **visible** | ✅ réel (nouveau) |
| 19 | **Registre LBA** | `GET /v1/mros` · `/v1/transactions/revue` · `/v1/screening/runs` (agrégation, RLS) | **visible** | ✅ réel (nouveau) |

## Écrans réels (frontend React `apps/web`) — Vague 5 (Rattrapage maquette : CRM & Workflow)

| # | Écran | Route(s) backend consommée(s) | Fallback seed | État |
|---|---|---|---|---|
| 20 | **CRM Banque** | `GET /v1/crm/clients/:id/timeline` · `/gestes` (R186/R187) | **visible** | ✅ réel (nouveau) |
| 21 | **Contact Reports** | `POST /v1/crm/clients/:id/entretiens` · `/pre-remplir` (R188/R138) | **visible** | ✅ réel (nouveau) |
| 22 | **Workflow Designer/Rules** | **`POST/PATCH /v1/workflow/definitions`** · `/:id/publier` · `GET /resoudre` (R171→R173) | **visible** | ✅ réel (nouveau) |
| 23 | **Corroboration KYC** | **`POST /v1/personnes/:id/corroboration`** (R36) | **visible** | ✅ réel (nouveau) |

## Écrans réels (frontend React `apps/web`) — Vague 6 (Paramétrage & Gouvernance)

| # | Écran | Route(s) backend consommée(s) | Fallback seed | État |
|---|---|---|---|---|
| 24 | **Registre de paramétrage** | `GET /v1/parametres/registre` · `GET/POST /valeur/:cle` (R125→R127) | **visible** | ✅ réel (nouveau) |
| 25 | **Config à date & Go-live** | **`GET /v1/parametres/config`** · **`POST /v1/parametres/activer`** (R127/R128) | **visible** | ✅ réel (nouveau) |

## Écrans réels (frontend React `apps/web`) — Vague 7 (PMS)

| # | Écran | Route(s) backend consommée(s) | Fallback seed | État |
|---|---|---|---|---|
| 26 | **PMS** | **`POST/GET /v1/pms/mandats`** · `/:id/valoriser` · `/:id/pre-trade` · `GET /clients/:id/adequation` · `GET /breaches` · `POST /breaches/:id/clore` (R105→R108) | **visible** | ✅ réel (nouveau) |

## Écrans réels (frontend React `apps/web`) — Vague 10/11 (Front-câblage v2 + A1)

| # | Écran | Route(s) backend consommée(s) | Fallback seed | État |
|---|---|---|---|---|
| 27 | **Référentiel AML** | **`GET /v1/aml/referentiel`** (18 scénarios R189→R206 + seuils effectifs, pilotés par le registre) | **visible** | ✅ réel |
| 29 | **Bac à sable AML** | **`POST /v1/aml/sandbox`** (dry-run d'un seuil R94/B-02 : avant/après/nouvelles nommées, `ecriture=false`) | **visible** | ✅ réel |
| 30 | **Ports** | **`GET /v1/ports`**, **`GET\|POST /v1/ports/:id/health`** (état des ports ratifiés core/IA/coffre, refus gracieux, aucun secret) | **visible** | ✅ réel (nouveau) |
| 31 | **Next Best Action** | **`GET /v1/crm/clients/:id/gestes`** (R187, gestes proposés ; décision R44 en lecture — route de décision non ratifiée) | **visible** | ✅ réel (lecture) |
| 32 | **Workflow Instances** | **`GET /v1/workflow-instances`, `/:id`, `/:id/events`** (projection du workflow gouverné KYC : steps + visas R15 + timeline) | **visible** | ✅ réel (V12) |
| 33 | **Tâches** | _aucun service backlog ratifié_ (seul `workload.reassigner`) — **FE-05 seed lecture seule** (A1) | **seed (bandeau)** | ⚠️ démonstration |
| 34 | **Formations & Certifications** | **`/v1/formations/*`** (catalogue R231, assignations/complétion R232, visa R235, certifs & rejeu R234/R238, rappels R233) | **visible** | ✅ réel (nouveau, V13) |

**Fallback seed** : plus aucun écran n'affiche du seed sans indicateur — bandeau « Mode
démonstration » (composant unique `DemoModeBanner`, test 9/9).

## Tests (exécution réelle)

| Niveau | Résultat | Commande |
|---|---|---|
| Règles moteur (R1→R221) | **425 / 425** (50 suites) | `pnpm --filter api run test:rules` |
| e2e Postgres réel (… + V10 2 + V12 3 + V13 8) | **58 / 58** | `pnpm --filter api run test:e2e` |
| Front (Vitest — FE-CORE 7 + composants WFI/Ports/NBA/FE-05/FE-FORM 5) | **12 / 12** | `pnpm --filter web run test:unit` |
| **FAT recette Vague 1** | **10 / 10 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague1` |
| **FAT recette Vague 2** | **4 / 4 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague2` |
| **FAT recette Vague 3** | **7 / 7 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague3` |
| **FAT recette Vague 4** | **6 / 6 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague4` |
| **FAT recette Vague 5** | **4 / 4 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague5` |
| **FAT recette Vague 6** | **2 / 2 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague6` |
| **FAT recette Vague 7** | **2 / 2 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague7` |
| **FAT recette Vague 8** | **2 / 2 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague8` |
| **FAT recette Vague 9** | **2 / 2 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague9` |
| **FAT recette Vague 10** | **2 / 2 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague10` |
| **FAT recette Vague 12** (Workflow Instances) | **3 / 3 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague12` |
| **FAT recette Vague 13** (Formations MOD-43) | **8 / 8 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague13` |
| Bandeau démo (front) | **9 / 9** | `pnpm --filter web run test:demo-banner` |
| Régressions | **0** | — |

## Capacités sensibles

- **Rejeu à date — paramètres/règles** (R127) : **OUI** — `GET /v1/parametres/valeur/:cle?date=` (preuve FAT-REJEU-01 : aujourd'hui=45, hier=30).
- **Rejeu à date — dossier KYC** (esprit R127, reconstruction depuis le journal append-only) : **OUI** — `GET /v1/kyc/:code/a-date?date=` (preuve FAT-REJEU-KYC-01 : INEXISTANT → EN_COURS → VALIDE).
- **Décision sur alerte** via vraie route POST : **OUI** — `POST /v1/riskcases` (R133 : jamais un cas vide).
- **Instruction d'un dossier** — notes **append-only** (R134) + transitions gouvernées avec motif (R133/R7) : **OUI** (FAT-DOSSIER-01/02).
- **Consultation GED filtrée au rôle** (R110) sans jamais exposer le contenu (R145) : **OUI** (FAT-GED-01).
- **Aiguillage de diligence** SDD/CDD/EDD au risque (R117) + ouverture sous KYC VALIDATED (R119) : **OUI** (FAT-ONBOARD-01).
- **Screening** : qualification motivée (R101/R7), escalade **proposée** jamais exécutée (R39/R44) : **OUI** (FAT-SCREEN-01).
- **Dry-run d'un seuil AML** (R94/B-02) — simuler sur données réelles, impact **nominatif**, **sans aucune écriture** (R70) : **OUI** — `POST /v1/aml/sandbox` (preuve FAT-SBAML-01 : 0 signal en base ; FAT-SBAML-02 : appliquer passe par le registre gouverné).
- **Cycle complet de bout en bout** (entrée→KYC→screening→revue→changement) sur Postgres réel : **OUI** (FAT-CYCLE-01).
- **Four-eyes KYC** protégeant le golden record : **OUI** (FAT-KYC-01).
- **Isolation multi-tenant** (RLS FORCE) : **OUI** (recette RLS + FAT-CLIENT-01 + FAT-GED-02 + FAT-UBO-01/FAT-DASH-01).

## Périmètre & limites (honnête)

- Backend : **~131 routes** (+ Formations V13 : catalogue/assignations/certifs/rappels), **37 modules** en Postgres réel (0 mock). Frontend : **34 écrans** (… V12 : Workflow Instances réel · **V13 : Formations & Certifications** · Tâches reste FE-05 seed). Écarts front + décisions A1 : `docs/ECARTS-FRONT.md` ; migrations : `docs/MIGRATION-FRONT.md`.
- Reste au backlog : reporting CRS/FATCA/goAML depuis données réelles ; écran front **workflow**
  (backend prêt) ; rejeu à date sur d'autres agrégats. **Liste noire** (RH, e-learning, business
  trip, budget, réunions, cyber-SOC) : **jamais construite** — hors produit CLM.
- Écarts signalés (non résolus par invention) : `PersonneLienService` R152→R155 **dormant** (aucun
  modèle `Personne`) ; **% de détention** non ratifié ; **fiche GED** empreinte de version non
  restituée (divergence fake/modèle `no`/`empreinte` vs `numero`/`sha256`, hors périmètre) ;
  12 `no-explicit-any` préexistants (écrans Vague 1).
- Dette d'infra corrigée (Vague 4) : `PrismaService.onModuleDestroy` ajouté (fuite de connexions
  e2e) + `connection_limit=3` ; un `PrismaModule` @Global (client unique) reste le correctif de fond.

## Décision de recette Vague 1

- [ ] **Recette PRONONCÉE** — 100 % FAT (dont 7 critiques), 0 régression.
- Signé (sponsor / Compliance) : ______________________  Date : __________

## Décision de recette Vague 2 (Surveillance & Dossiers)

- [ ] **Recette PRONONCÉE** — 4/4 FAT (dont 4 critiques : instruction append-only R134, transitions gouvernées R133/R7, filtrage GED au rôle R110/R145, isolation RLS), 0 régression, 0 modèle Prisma nouveau.
- Signé (sponsor / Compliance) : ______________________  Date : __________

## Décision de recette Vague 3 (Le cycle client de bout en bout)

- [ ] **Recette PRONONCÉE** — 7/7 FAT (dont 6 critiques : aiguillage R117/R119, screening R101/R7/R39, revue orchestrée, UBO R31/R34, CoC R30/R42, cycle bout-en-bout), 0 régression, 0 modèle Prisma nouveau.
- Signé (sponsor / Compliance) : ______________________  Date : __________

## Décision de recette Vague 4 (Écrans « plateforme »)

- [ ] **Recette PRONONCÉE** — 6/6 FAT (dont 4 critiques : portail tx R140→R143/R132, core=port R167/R114, MROS opposable R130/R132, GED preuve R110/R145), 0 régression, 0 modèle Prisma nouveau. Doctrine « intégrer, pas refaire » tenue ; liste noire respectée.
- Signé (sponsor / Compliance) : ______________________  Date : __________

## Décision de recette Vague 5 (Rattrapage maquette : CRM & Workflow)

- [ ] **Recette PRONONCÉE** — 4/4 FAT (dont 2 critiques : Workflow gouverné R171→R173, Corroboration R36), 0 régression, 0 modèle Prisma nouveau. **Zéro invention** : canon déjà ratifié (CRM R186→R188, Workflow R171→R173, R36).
- Signé (sponsor / Compliance) : ______________________  Date : __________

## Décision de recette Vague 6 (Paramétrage & Gouvernance)

- [ ] **Recette PRONONCÉE** — 2/2 FAT (dont 2 critiques : écriture gouvernée R125→R127, go-live R128), 0 régression. **Conformité schéma↔canon** : Tenant.statut/rqSignePar/rqSigneAt ajoutés (activer R128 fonctionne enfin), baseline régénérée. DRY-RUN sandboxes différés (canon manquant).
- Signé (sponsor / Compliance) : ______________________  Date : __________

## Décision de recette Vague 7 (PMS)

- [ ] **Recette PRONONCÉE** — 2/2 FAT (2 critiques : adéquation LSFin R107, drift/pre-trade/breach R105/R106/R108), 0 régression, 0 modèle Prisma nouveau. **Intégrer, pas refaire** : compliance sur positions, pas de moteur de portefeuille.
- Signé (sponsor / Compliance) : ______________________  Date : __________

## Décision de recette Vague 8 (Référentiel AML)

- [ ] **Recette PRONONCÉE** — 2/2 FAT (référentiel R189→R206 + seuils gouvernés R125→R127), 0 régression, 0 modèle Prisma nouveau. **Zéro invention** : catalogue = projection du canon ratifié ; seuils pilotés par le registre, jamais en dur.
- Signé (sponsor / Compliance) : ______________________  Date : __________

---
*Ce certificat consolide l'ancien `docs/tests/RAPPORT-RECETTE.md` (supprimé — fusionné ici) pour ne garder qu'une seule source datée.*
