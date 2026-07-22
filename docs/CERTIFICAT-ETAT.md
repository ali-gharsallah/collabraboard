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

**Fallback seed** : plus aucun écran n'affiche du seed sans indicateur — bandeau « Mode
démonstration » (composant unique `DemoModeBanner`, test 9/9).

## Tests (exécution réelle)

| Niveau | Résultat | Commande |
|---|---|---|
| Règles moteur (R1→R221) | **425 / 425** (50 suites) | `pnpm --filter api run test:rules` |
| e2e Postgres réel (kyc-rules 6 + FAT 10) | **16 / 16** | `pnpm --filter api run test:e2e` |
| **FAT recette Vague 1** | **10 / 10 PASS (100 %)** | `pnpm --filter api run test:e2e -- fat-vague1` |
| Bandeau démo (front) | **9 / 9** | `pnpm --filter web run test:demo-banner` |
| Régressions | **0** | — |

## Capacités sensibles

- **Rejeu à date — paramètres/règles** (R127) : **OUI** — `GET /v1/parametres/valeur/:cle?date=` (preuve FAT-REJEU-01 : aujourd'hui=45, hier=30).
- **Rejeu à date — dossier KYC** (esprit R127, reconstruction depuis le journal append-only) : **OUI** — `GET /v1/kyc/:code/a-date?date=` (preuve FAT-REJEU-KYC-01 : INEXISTANT → EN_COURS → VALIDE).
- **Décision sur alerte** via vraie route POST : **OUI** — `POST /v1/riskcases` (R133 : jamais un cas vide).
- **Four-eyes KYC** protégeant le golden record : **OUI** (FAT-KYC-01).
- **Isolation multi-tenant** (RLS FORCE) : **OUI** (recette RLS + FAT-CLIENT-01).

## Périmètre & limites (honnête)

- Backend : **75 routes**, **27 modules** en Postgres réel (0 mock). Frontend : **6 écrans** (Vague 1).
- Reste au backlog : reporting CRS/FATCA/goAML depuis données réelles ; écrans front des autres
  domaines (GED, screening, MROS, workflow, transactions — routes prêtes) ; rejeu à date sur
  d'autres agrégats (aujourd'hui : paramètres + dossier KYC).

## Décision de recette Vague 1

- [ ] **Recette PRONONCÉE** — 100 % FAT (dont 7 critiques), 0 régression.
- Signé (sponsor / Compliance) : ______________________  Date : __________

---
*Ce certificat consolide l'ancien `docs/tests/RAPPORT-RECETTE.md` (supprimé — fusionné ici) pour ne garder qu'une seule source datée.*
