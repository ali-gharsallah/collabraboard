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

**Vague 1 : 10/10 FAT PASS + bandeau 9/9. Non-régression : règles 425/425, e2e 16/16.**

## Socle technique (rappel)

Les FAT s'appuient sur **425 tests de règles** (R1→R221) et **16 e2e** (Postgres réel). Traçabilité
règle-par-règle : `docs/tests/COUVERTURE-REGLES.md`. Errata de test : **E4** (sous-requête
`kyc-rules` scopée au tenant — le `code` KYC n'est unique que par tenant).

## Vagues suivantes

*(À compléter — le cahier grandit par section : Vague 2, etc.)*
