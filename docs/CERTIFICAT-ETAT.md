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

**Fallback seed** : plus aucun écran n'affiche du seed sans indicateur — bandeau « Mode
démonstration » (composant unique `DemoModeBanner`, test 9/9).

## Tests (exécution réelle)

| Niveau | Résultat | Commande |
|---|---|---|
| Règles moteur (R1→R221) | **425 / 425** (50 suites) | `pnpm --filter api run test:rules` |
| e2e Postgres réel (kyc-rules 6 + FAT V1 10 + FAT V2 4) | **20 / 20** | `pnpm --filter api run test:e2e` |
| **FAT recette Vague 1** | **10 / 10 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague1` |
| **FAT recette Vague 2** | **4 / 4 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague2` |
| Bandeau démo (front) | **9 / 9** | `pnpm --filter web run test:demo-banner` |
| Régressions | **0** | — |

## Capacités sensibles

- **Rejeu à date — paramètres/règles** (R127) : **OUI** — `GET /v1/parametres/valeur/:cle?date=` (preuve FAT-REJEU-01 : aujourd'hui=45, hier=30).
- **Rejeu à date — dossier KYC** (esprit R127, reconstruction depuis le journal append-only) : **OUI** — `GET /v1/kyc/:code/a-date?date=` (preuve FAT-REJEU-KYC-01 : INEXISTANT → EN_COURS → VALIDE).
- **Décision sur alerte** via vraie route POST : **OUI** — `POST /v1/riskcases` (R133 : jamais un cas vide).
- **Instruction d'un dossier** — notes **append-only** (R134) + transitions gouvernées avec motif (R133/R7) : **OUI** (FAT-DOSSIER-01/02).
- **Consultation GED filtrée au rôle** (R110) sans jamais exposer le contenu (R145) : **OUI** (FAT-GED-01).
- **Four-eyes KYC** protégeant le golden record : **OUI** (FAT-KYC-01).
- **Isolation multi-tenant** (RLS FORCE) : **OUI** (recette RLS + FAT-CLIENT-01 + FAT-GED-02).

## Périmètre & limites (honnête)

- Backend : **77 routes** (+2 portes notes dossier), **27 modules** en Postgres réel (0 mock). Frontend : **8 écrans** (Vague 1 = 6 + Vague 2 = 2).
- Reste au backlog : reporting CRS/FATCA/goAML depuis données réelles ; écrans front des autres
  domaines (screening, MROS, workflow, transactions — routes prêtes) ; rejeu à date sur
  d'autres agrégats (aujourd'hui : paramètres + dossier KYC).

## Décision de recette Vague 1

- [ ] **Recette PRONONCÉE** — 100 % FAT (dont 7 critiques), 0 régression.
- Signé (sponsor / Compliance) : ______________________  Date : __________

## Décision de recette Vague 2 (Surveillance & Dossiers)

- [ ] **Recette PRONONCÉE** — 4/4 FAT (dont 4 critiques : instruction append-only R134, transitions gouvernées R133/R7, filtrage GED au rôle R110/R145, isolation RLS), 0 régression, 0 modèle Prisma nouveau.
- Signé (sponsor / Compliance) : ______________________  Date : __________

---
*Ce certificat consolide l'ancien `docs/tests/RAPPORT-RECETTE.md` (supprimé — fusionné ici) pour ne garder qu'une seule source datée.*
