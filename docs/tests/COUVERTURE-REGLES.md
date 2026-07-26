# Matrice de traçabilité — exigences → tests (Vagues 1 à 4)

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
| 11 | R133 : décision sur alerte = ouvrir un dossier de risque (jamais un cas vide) | FAT-ALERTE-03 | risk-case.wiring (RK-01..06) | ✅ |
| 12 | R127 (esprit) : rejeu **KYC** à date — état d'un dossier reconstruit du journal | FAT-REJEU-KYC-01 | e2e `kyc/:code/a-date` | ✅ |

**Couverture des exigences Vague 1 : 12 / 12 (100 %).**

## Exigences Vague 2 — Surveillance & Dossiers (couverture FAT)

| # | Exigence métier / règle | FAT | Test technique | Couvert |
|---|---|---|---|---|
| 13 | R134 : notes d'instruction d'un dossier **append-only** (aucune édition/suppression) | FAT-DOSSIER-01 | risk-case.wiring (notes) + e2e notes | ✅ |
| 14 | R133/R136 : transitions gouvernées d'un dossier (états prévus uniquement) | FAT-DOSSIER-01 / FAT-DOSSIER-02 | risk-case.wiring (RK) + e2e transition | ✅ |
| 15 | R7 : un état terminal (clôture/escalade) exige un **motif** | FAT-DOSSIER-01 | risk-case.service (motif requis) + e2e | ✅ |
| 16 | R110 : pièces GED filtrées au **rôle**, relu à l'acte | FAT-GED-01 | ged-consultation (GS-01..05) + e2e | ✅ |
| 17 | R145 : la fiche GED expose l'**empreinte**, jamais le contenu | FAT-GED-01 | ged-consultation.fiche (versions sans contenuRef) | ✅ |
| 18 | Isolation tenant des pièces GED (RLS) | FAT-GED-02 | Recette RLS + e2e (autre tenant → 0) | ✅ |

**Couverture des exigences Vague 2 : 6 / 6 (100 %).**

## Exigences Vague 3 — Le cycle client de bout en bout (couverture FAT)

| # | Exigence métier / règle | FAT | Test technique | Couvert |
|---|---|---|---|---|
| 19 | R117/R118 : aiguillage de diligence SDD/CDD/EDD selon le risque | FAT-ONBOARD-01 | kyc risk-engine (computeRisk) + e2e | ✅ |
| 20 | R119 : pas d'ouverture sans KYC VALIDATED | FAT-ONBOARD-01 | onboarding.wiring (OB) + e2e | ✅ |
| 21 | R100/R103 : hits persistés + trace de passage toujours écrite | FAT-SCREEN-01 | screening.wiring (SC-01..04) + e2e | ✅ |
| 22 | R101/R7 : qualification motivée, auteur = jeton | FAT-SCREEN-01 | screening.wiring + e2e | ✅ |
| 23 | R39/R44 : escalade proposée, jamais exécutée | FAT-SCREEN-01 | screening.service (événement) + e2e | ✅ |
| 24 | Revue = orchestration de primitives ratifiées (zéro canon inventé) | FAT-REVIEW-01 | re-screening (R103) + four-eyes KYC (e2e) | ✅ |
| 25 | R31 : rattachement de rôle (UBO) selon politique banque | FAT-UBO-01 | personnes.wiring (P-01..08) + e2e | ✅ |
| 26 | R34 : relation bijective — une arête, deux lectures | FAT-UBO-01 | personnes.wiring + e2e | ✅ |
| 27 | R30/R42 : CoC propagé + re-screening déclenché sur identité | FAT-COC-01 | personnes.wiring + e2e | ✅ |
| 28 | Dashboard : stock par état, cloisonné RLS | FAT-DASH-01 | e2e (agrégation lecture) | ✅ |
| 29 | Cycle complet entrée→KYC→screening→revue→changement | FAT-CYCLE-01 | e2e bout-en-bout | ✅ |

**Couverture des exigences Vague 3 : 11 / 11 (100 %).**

## Exigences Vague 4 — Écrans « plateforme » (couverture FAT)

| # | Exigence métier / règle | FAT | Test technique | Couvert |
|---|---|---|---|---|
| 30 | R140/R142 : toute transaction passe par le portail, verdict tracé | FAT-TX-01 | transaction-gate.wiring (TX) + e2e | ✅ |
| 31 | R143/R7 : file de revue habilitée, décision motivée | FAT-TX-01 | transaction-gate.wiring + e2e | ✅ |
| 32 | R132 : vue client sans motif AML (art. 10a) | FAT-TX-01 | transaction-gate.vueClient + e2e | ✅ |
| 33 | R167/R114 : core = port ; sans port, refus explicite (pas de simulacre) | FAT-SETTLE-01 | core-sync.wiring (SY) + e2e | ✅ |
| 34 | R100→R103 : screening listes complémentaires (adverse media) tracé | FAT-SCREEN-ADV-01 | screening.wiring (SC) + e2e | ✅ |
| 35 | R130 : décision MROS figée + empreinte opposable | FAT-MROS-01 | mros.wiring + e2e | ✅ |
| 36 | R132 : art. 10a — lecture MROS habilitée seulement | FAT-MROS-01 | mros.wiring + e2e | ✅ |
| 37 | R110/R145 : GED filtrée au rôle, preuve sans contenu | FAT-GED-COFFRE-01 | ged-consultation (GS) + e2e | ✅ |
| 38 | Registre LBA agrégé, cloisonné RLS | FAT-REGISTRE-01 | e2e (agrégation lecture) | ✅ |

**Couverture des exigences Vague 4 : 9 / 9 (100 %).**

## Assise technique sous-jacente (non-FAT, prouvée par le harnais)

Les FAT ci-dessus s'appuient sur un socle de **425 tests de règles** (R1→R221, 50 suites) + **33
tests e2e** (Postgres réel : kyc-rules 6 + FAT Vague 1 10 + Vague 2 4 + Vague 3 7 + Vague 4 6). La couverture règle-par-règle complète est portée par les
`*.wiring.spec.ts` de chaque module (cf. `docs/RUNBOOK-OPS.md` §2) ; cette matrice ne trace que
les **exigences métier de Vague 1** exercées en recette d'acceptation.

## Exigences hors Vague 1 (non couvertes par FAT à ce stade — backlog)

| Exigence | Statut |
|---|---|
| Rejeu à date — **dossier KYC** | ✅ **Implémenté (Vague 1)** — `GET /v1/kyc/:code/a-date` (FAT-REJEU-KYC-01) |
| Rejeu à date généralisé aux **autres** agrégats (client, risk case…) | Non implémenté (aujourd'hui : paramètres + KYC) |
| Reporting CRS/FATCA/goAML depuis données réelles | Backlog (P1) |
| Écrans front GED/screening/MROS/risk cases/workflow/transactions | Backend prêt, surface produit à construire |
