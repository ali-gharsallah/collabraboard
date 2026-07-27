# Matrice de traçabilité — exigences → tests (Vagues 1 à 8)

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

## Exigences Vague 5 — Rattrapage maquette : CRM & Workflow (couverture FAT)

| # | Exigence métier / règle | FAT | Test technique | Couvert |
|---|---|---|---|---|
| 39 | R186/R187 : timeline projetée + prochains gestes proposés | FAT-CRM-01 | crm.wiring (CR) + e2e | ✅ |
| 40 | R188/R138 : compte rendu tracé ; pré-remplissage IA refusé sans port | FAT-CR-01 | crm.wiring + e2e | ✅ |
| 41 | R171/R173/R7 : définition publiée datée, immuable, habilitée, motivée | FAT-WF-01 | workflow-def.wiring (WF) + e2e | ✅ |
| 42 | R172 : résolution datée (grandfathering structurel) | FAT-WF-01 | workflow-def.wiring + e2e | ✅ |
| 43 | R36 : divergence → Central File + corroboration, sans modifier de donnée | FAT-CORROB-01 | personnes.wiring + e2e | ✅ |

**Couverture des exigences Vague 5 : 5 / 5 (100 %).**

## Exigences Vague 6 — Paramétrage & Gouvernance (couverture FAT)

| # | Exigence métier / règle | FAT | Test technique | Couvert |
|---|---|---|---|---|
| 44 | R125/R126 : écriture de paramètre typée, motivée, jamais rétroactive | FAT-PARAM-01 | parametres.wiring (RQ) + e2e | ✅ |
| 45 | R127 : valeur/config reconstruite à une date | FAT-PARAM-01 / FAT-GOLIVE-01 | parametres.wiring + e2e | ✅ |
| 46 | R128 : go-live gouverné (signature + clés requises nommées) | FAT-GOLIVE-01 | parametres.wiring + e2e | ✅ |

**Couverture des exigences Vague 6 : 3 / 3 (100 %).**

## Exigences Vague 7 — PMS : Mandats, Adéquation & Breaches (couverture FAT)

| # | Exigence métier / règle | FAT | Test technique | Couvert |
|---|---|---|---|---|
| 47 | R107 : adéquation LSFin (riskLevel client borne le mandat), alerte sans rétrogradation | FAT-PMS-ADEQ-01 | pms.wiring (PF) + e2e | ✅ |
| 48 | R105/R44 : drift constaté, positions intactes (jamais de rééquilibrage auto) | FAT-PMS-DRIFT-01 | pms.wiring + e2e | ✅ |
| 49 | R106 : pre-trade bloquant (exclusions + concentration) | FAT-PMS-DRIFT-01 | pms.wiring + e2e | ✅ |
| 50 | R108/R7 : registre de breaches, clôture motivée (escalade sans liquider) | FAT-PMS-DRIFT-01 | pms.wiring + e2e | ✅ |

**Couverture des exigences Vague 7 : 4 / 4 (100 %).**

## Exigences Vague 8 — Référentiel AML : scénarios & seuils (couverture FAT)

| # | Exigence métier / règle | FAT | Test technique | Couvert |
|---|---|---|---|---|
| 51 | R189→R206 : le référentiel expose les 18 scénarios de surveillance | FAT-AMLCAT-01 | aml-scoring.wiring (A-69..A-86) + e2e | ✅ |
| 52 | R125→R127 : seuils AML pilotés par le registre, reflétés à chaud | FAT-AMLCAT-02 | parametres.wiring + e2e | ✅ |

**Couverture des exigences Vague 8 : 2 / 2 (100 %).**

## Exigences Vague 9 — Bac à sable AML : dry-run d'un seuil (couverture FAT)

| # | Exigence (règle) | FAT | Test technique | Statut |
|---|---|---|---|---|
| 53 | R94 / B-02 : un seuil simulé montre l'impact **nominatif** (avant/après/nouvelles nommées) | FAT-SBAML-01 | aml.sandbox (moteur pur rejoué) + e2e | ✅ |
| 54 | R70 : la simulation ne crée **ni signal, ni tâche, ni case** (0 écriture prouvée en base) | FAT-SBAML-01 | e2e (`amlSignal.count()===0`) | ✅ |
| 55 | R94 / R96 / R126 / R29 : proposer ≠ appliquer — l'application passe par le registre gouverné, daté, journalisé | FAT-SBAML-02 | parametres.wiring + e2e | ✅ |

**Couverture des exigences Vague 9 : 3 / 3 (100 %).**

## Exigences Vague 10 — Front-câblage v2, phase 1 (couverture FAT + Vitest)

| # | Exigence | Test | Preuve | Statut |
|---|---|---|---|---|
| 56 | R167/R163/R180 : les ports ratifiés se lisent, statut = présence de config, **jamais le secret** | FAT-PORT-01 | ports porte + e2e | ✅ |
| 57 | R167/R126 : déclarer un port au registre → CONFIGURED ; port inconnu → 404 (jamais fabriqué) | FAT-PORT-02 | e2e | ✅ |
| 58 | FE-CORE : seed signalé, propagation session (JWT/headers), rejeu `asOf` (R48), erreurs non traduites | FE-01..04 | Vitest `api.test.ts` | ✅ |

**Couverture des exigences Vague 10 : 3 / 3 (100 %).** Écarts (non couverts car non ratifiés — `docs/ECARTS-FRONT.md`) : FE-TASK (backlog), décision NBA, R222..R238 (proposées).

## Exigences Vague 12 — Workflow Instances (FE-WFI, couverture FAT)

| # | Exigence | FAT | Test technique | Statut |
|---|---|---|---|---|
| 59 | Projection du workflow gouverné (dossiers KYC) : liste des instances | FAT-WFI-01 | workflow-instances porte + e2e | ✅ |
| 60 | R15/R13 : détail = steps + visas uniformes ; visa signé porte son signataire | FAT-WFI-02 | e2e (visa SIGNED, signePar) | ✅ |
| 61 | FE-20 : timeline append-only (DomainEvents), ordre serveur | FAT-WFI-03 | e2e (`/:id/events`) | ✅ |

**Couverture des exigences Vague 12 : 3 / 3 (100 %).** FE-WFI n'est plus FE-05 (câblé au canon KYC).

## Exigences Vague 13 — MOD-43 Formations & Certifications (R231→R238, couverture FAT)

| # | Exigence (règle) | FAT | Test technique | Statut |
|---|---|---|---|---|
| 62 | R231 : référentiel de formation 100% tenant (aucun type en dur) | FO-01 | formations.catalog + e2e | ✅ |
| 63 | R232 : complétion événementielle + attestation GED | FO-02 | e2e (training.completed { docId }) | ✅ |
| 64 | R233/R39 : rappels J-x informatifs, aucun blocage | FO-03 | e2e (tick J-30/J-7) | ✅ |
| 65 | R234 : attestations & certifications append-only | FO-04 | trigger audit_immutable + e2e (UPDATE refusé) | ✅ |
| 66 | R235/R15 : validation par visa (mode VALIDATED) | FO-05 | e2e (dépôt → visa → COMPLETED) | ✅ |
| 67 | R235/R13 : l'auteur ne valide pas sa propre complétion | FO-06 | e2e (TRAINING_SELF_VALIDATION_FORBIDDEN) | ✅ |
| 68 | R236 : visibilité par profil (soi/équipe/tout) | FO-07 | e2e (RM/BRM/CO) | ✅ |
| 69 | R238 : rejeu certifiant depuis l'historique append-only | FO-08 | e2e (asOf) | ✅ |

**Couverture des exigences Vague 13 : 8 / 8 (100 %).**

## Exigences Vague 14 — MOD-75 Business Trip (R222→R230, couverture FAT)

| # | Exigence (règle) | FAT | Statut |
|---|---|---|---|
| 70 | R222 : cycle de vie événementiel (TRIP_SUBMITTED) | BT-01 | ✅ |
| 71 | R223 : avis cross-border attaché, ne décide pas | BT-02 | ✅ |
| 72 | R224 : KYC non approuvé — INFORMATIF / BLOQUANT | BT-03/04 | ✅ |
| 73 | R225/R15 : visa uniforme + matrice tenant | BT-05 | ✅ |
| 74 | R225/R13 : auto-approbation interdite | BT-06 | ✅ |
| 75 | R226/R39 : contact reports mesurés, non coercés | BT-07 | ✅ |
| 76 | R228/R237 : certification à la date du voyage (depuis MOD-43) | BT-08 | ✅ |
| 77 | R229 : rejeu avec grandfathering du référentiel | BT-09 | ✅ |
| 78 | R230 : révision chaînée après approbation | BT-10 | ✅ |

**Couverture des exigences Vague 14 : 9 / 9 (100 %).** R222→R238 intégralement couvert (MOD-43 V13 + MOD-75 V14).

## Exigences Vague 16 — MOD Tâches (R239→R242, couverture FAT)

| # | Exigence (règle) | FAT | Statut |
|---|---|---|---|
| 79 | R239 : naissance par événement + création manuelle gouvernée | TA-01/TA-02 | ✅ |
| 80 | R240 : listage scopé serveur, périmètre non élargissable | TA-03 | ✅ |
| 81 | R241 : complétion événementielle immuable + habilitée | TA-04/TA-05 | ✅ |
| 82 | R242/R39 : SLA mesuré, jamais coercitif | TA-06 | ✅ |

**Couverture des exigences Vague 16 : 6 / 6 (100 %).**

## Exigences Vague 17 — MOD Décision NBA (R243→R246, couverture FAT)

| # | Exigence (règle) | FAT | Statut |
|---|---|---|---|
| 83 | R243 : suggestion immuable une fois proposée | NB-01 | ✅ |
| 84 | R244 : décision unique événementielle + motif/ajustement | NB-02/03/04 | ✅ |
| 85 | R245/R44 : humain seulement, zéro exécution directe | NB-05 | ✅ |
| 86 | R246/R48 : rejeu suggestions & décisions à date | NB-06 | ✅ |

**Couverture des exigences Vague 17 : 4 / 4 (100 %).** R239→R246 intégralement couvert (V16 + V17).

## Assise technique sous-jacente (non-FAT, prouvée par le harnais)

Les FAT ci-dessus s'appuient sur un socle de **425 tests de règles** (R1→R221, 50 suites) + **47
tests e2e** (Postgres réel : kyc-rules 6 + … + V14 10 + A3 4 + V16 6 + V17 6) + **13 tests Vitest** (front : FE-CORE `api.ts` FE-01..06 + composants FE-05/10/40). La couverture règle-par-règle complète est portée par les
`*.wiring.spec.ts` de chaque module (cf. `docs/RUNBOOK-OPS.md` §2) ; cette matrice ne trace que
les **exigences métier de Vague 1** exercées en recette d'acceptation.

## Exigences hors Vague 1 (non couvertes par FAT à ce stade — backlog)

| Exigence | Statut |
|---|---|
| Rejeu à date — **dossier KYC** | ✅ **Implémenté (Vague 1)** — `GET /v1/kyc/:code/a-date` (FAT-REJEU-KYC-01) |
| Rejeu à date généralisé aux **autres** agrégats (client, risk case…) | Non implémenté (aujourd'hui : paramètres + KYC) |
| Reporting CRS/FATCA/goAML depuis données réelles | Backlog (P1) |
| Écrans front GED/screening/MROS/risk cases/workflow/transactions | Backend prêt, surface produit à construire |
