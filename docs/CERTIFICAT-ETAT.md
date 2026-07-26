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

**Fallback seed** : plus aucun écran n'affiche du seed sans indicateur — bandeau « Mode
démonstration » (composant unique `DemoModeBanner`, test 9/9).

## Tests (exécution réelle)

| Niveau | Résultat | Commande |
|---|---|---|
| Règles moteur (R1→R221) | **425 / 425** (50 suites) | `pnpm --filter api run test:rules` |
| e2e Postgres réel (kyc-rules 6 + FAT V1 10 + V2 4 + V3 7) | **27 / 27** | `pnpm --filter api run test:e2e` |
| **FAT recette Vague 1** | **10 / 10 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague1` |
| **FAT recette Vague 2** | **4 / 4 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague2` |
| **FAT recette Vague 3** | **7 / 7 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague3` |
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
- **Cycle complet de bout en bout** (entrée→KYC→screening→revue→changement) sur Postgres réel : **OUI** (FAT-CYCLE-01).
- **Four-eyes KYC** protégeant le golden record : **OUI** (FAT-KYC-01).
- **Isolation multi-tenant** (RLS FORCE) : **OUI** (recette RLS + FAT-CLIENT-01 + FAT-GED-02 + FAT-UBO-01/FAT-DASH-01).

## Périmètre & limites (honnête)

- Backend : **~88 routes** (+ portes Vague 3 : screening, personnes, onboarding list), **29 modules** en Postgres réel (0 mock). Frontend : **14 écrans** (Vague 1 = 6 + Vague 2 = 2 + Vague 3 = 6).
- Reste au backlog : reporting CRS/FATCA/goAML depuis données réelles ; écrans front des autres
  domaines (MROS, workflow, transactions — routes prêtes) ; rejeu à date sur d'autres agrégats.
- Écarts signalés (non résolus par invention) : `PersonneLienService` R152→R155 **dormant** (aucun
  modèle `Personne` au schéma) ; **% de détention** non ratifié ; 12 `no-explicit-any` préexistants (écrans Vague 1).

## Décision de recette Vague 1

- [ ] **Recette PRONONCÉE** — 100 % FAT (dont 7 critiques), 0 régression.
- Signé (sponsor / Compliance) : ______________________  Date : __________

## Décision de recette Vague 2 (Surveillance & Dossiers)

- [ ] **Recette PRONONCÉE** — 4/4 FAT (dont 4 critiques : instruction append-only R134, transitions gouvernées R133/R7, filtrage GED au rôle R110/R145, isolation RLS), 0 régression, 0 modèle Prisma nouveau.
- Signé (sponsor / Compliance) : ______________________  Date : __________

## Décision de recette Vague 3 (Le cycle client de bout en bout)

- [ ] **Recette PRONONCÉE** — 7/7 FAT (dont 6 critiques : aiguillage R117/R119, screening R101/R7/R39, revue orchestrée, UBO R31/R34, CoC R30/R42, cycle bout-en-bout), 0 régression, 0 modèle Prisma nouveau.
- Signé (sponsor / Compliance) : ______________________  Date : __________

---
*Ce certificat consolide l'ancien `docs/tests/RAPPORT-RECETTE.md` (supprimé — fusionné ici) pour ne garder qu'une seule source datée.*
