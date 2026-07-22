# Matrice de traçabilité — exigences → tests (Vague 1)

**2026-07-22.** Chaque exigence métier / règle est reliée à son **FAT** (acceptation métier) et à
son **test technique** (règle unitaire dans le harnais et/ou e2e).

## Exigences Vague 1 (couverture FAT)

| # | Exigence métier / règle | FAT | Test technique | Couvert |
|---|---|---|---|---|
| 1 | Isolation multi-tenant (un tenant ne voit pas les données d'un autre) | FAT-CLIENT-01 | Recette RLS (`olive_app` 0 ligne sans GUC) + e2e | ✅ |
| 2 | KYC four-eyes : le créateur ne valide pas | FAT-KYC-01 | `kyc-rules` R52/Four-eyes (e2e) | ✅ |
| 3 | Golden record mis à jour **après** validation (événement `kyc.validated`) | FAT-KYC-01 | golden-record.projector.spec (GR-01..04) | ✅ |
| 4 | R13 : contributeur exclu de son visa | FAT-KYC-02 | `kyc-rules` R13 (e2e) + rules.spec | ✅ |
| 5 | R192 : contrepartie sanctionnée → blocage automatique | FAT-AML-01 | aml-scoring.wiring (A-72) | ✅ |
| 6 | R189 : structuring → alerte niveau 2 non bloquante | FAT-AML-02 | aml-scoring.wiring (A-69) | ✅ |
| 7 | Alertes consultables + cloisonnées | FAT-ALERTE-01 | aml.service signaux (wiring) | ✅ |
| 8 | R209 : spéculation maysir → blocage automatique | FAT-ALERTE-02 | islamic-screening.wiring (IS-03) | ✅ |
| 9 | R216 : entité caritative sanctionnée → revue humaine, jamais auto-block | FAT-ALERTE-02 | islamic-screening.wiring (IS-10) | ✅ |
| 10 | R127 : rejeu à date (valeur d'un paramètre à une date passée) | FAT-REJEU-01 | parametres.wiring (RQ-05) | ✅ |

**Couverture des exigences Vague 1 : 10 / 10 (100 %).**

## Assise technique sous-jacente (non-FAT, prouvée par le harnais)

Les FAT ci-dessus s'appuient sur un socle de **425 tests de règles** (R1→R221, 50 suites) + **14
tests e2e** (Postgres réel). La couverture règle-par-règle complète est portée par les
`*.wiring.spec.ts` de chaque module (cf. `docs/RUNBOOK-OPS.md` §2) ; cette matrice ne trace que
les **exigences métier de Vague 1** exercées en recette d'acceptation.

## Exigences hors Vague 1 (non couvertes par FAT à ce stade — backlog)

| Exigence | Statut |
|---|---|
| Rejeu à date **généralisé** aux agrégats métier (dossier KYC, client) | Non implémenté (rejeu limité aux paramètres) |
| Reporting CRS/FATCA/goAML depuis données réelles | Backlog (P1) |
| Écrans front GED/screening/MROS/risk cases/workflow/transactions | Backend prêt, surface produit à construire |
