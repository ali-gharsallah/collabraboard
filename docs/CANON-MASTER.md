<!-- GÉNÉRÉ — NE PAS ÉDITER À LA MAIN. Produit par tools/canon-master/ depuis le repo.
     Toute édition manuelle rend le build CI ROUGE (le généré fait foi). -->
# CANON-MASTER — O-Live (document unique faisant foi, GÉNÉRÉ)

> **Généré le 2026-07-29 · commit `32b6ae0`.** Ce document se périme visiblement :
> régénéré à chaque merge de PR de ratification (registrar). Le REPO FAIT FOI.

## ⚠️ Rapport d'anomalies (à traiter, jamais absorbé)

**Aucune anomalie à traiter.** Les cas connus sont classés & justifiés ci-dessous.

- **Doublons de numéro à titres divergents** : 0
- **Familles de scénarios sans suite de test** : 0
- **Artefacts porteurs de règles sans aucune famille de scénario** : 0
- **Numéros R absents dans [1..339]** (plafond = sommet de l'amas contigu, hors réserves) : 0
- **Numéros cités hors plage ratifiée** (coquilles, hors placeholders déclarés) : 0

### Cas connus & justifiés (`spec/canon-master-exceptions.md`)

- **Errata** (corrections datées, pas des collisions) : motifs `erratum-` — ex. R119 (`APPROVED`→`VALIDATED`, décision Ali).
- **Docs historiques / référence** (hors couverture familles) : motifs `catalogue-patch-`, `catalogue-v2-inventaire`, `wf-v2`, `ADR-` — écarte les jetons XX-NN incidents (DB-, MO-).
- **Numéros réservés / non applicables** : 2
  - R78 — Numéro RÉSERVÉ au catalogue CPSI (gap documenté, non attribué) (réf. `docs/CPSI-CATALOGUE-R63-R86.md` · référentiel §4)
  - R247 — Read-model workflow **CAS B — NON APPLICABLE** (O-Live = CAS A : état persisté & requêtable, rejeu read-side) (réf. `docs/ECARTS-FRONT.md` §A3 · `docs/RUNBOOK-OPS.md` · `docs/tests/FAT/FAT-A3-WORKFLOW.md`)
- **Placeholders de test** : 1
  - R999 — Citation « REGLE:R999 inexistante » du test négatif **OL-14** (prouve le rejet d'une règle inconnue au catalogue) (réf. `spec/spec-fonctionnelle-home-olivia.md` (OL-14))

## 🔀 Divergences référence-de-session ↔ repo

Comparé : `spec/REFERENTIEL-SESSION-2026-07-29.md` (79 numéros) via seed
`spec/mapping-session-repo.md`. Numéros de session sans contrepartie repo : **0**.

> Cette table ne capte que la présence NUMÉRIQUE. Les divergences **structurelles/sémantiques**
> (ex. On-premise session R332–R334 absent du repo — créneau R335–R339 pris par la robustesse,
> PK réservé **R340+** par décision Ali) sont énumérées dans `spec/mapping-session-repo.md` §2/§3.

## a) Mapping session → repo (seed ratifié — `spec/mapping-session-repo.md`)

| Session | Repo | Objet | Familles |
|---------|------|-------|----------|
| R325 | R328 | Clôture JWT (jetons réels partout) | JW-01..06 |
| R326 | R329 | Tenant démo GWB scripté (zéro if-demo) | DM-01..06 |
| R327 | R330 | Readiness + pipeline conditionnel | RZ-01..04 |
| R328 | R331 | Registrar inbox→PR de ratification | IX-01..05 |
| R329 | R332 | FAT dérivée du catalogue, gate absolue | FB-01..04 |
| R330 | R333 | BAT cahier généré + signature visa | FB-05..07 |
| R331 | R334 | Migrations expand/contract | MG-01..05 |
| R70 | R95 | Mapping droits (renumérotation étape 0 signalée) | — |
| R222 | R248 | Porte CPSI (enveloppe versionnée) | PC-01..14 |

## b) Inventaire intégral (par artefact ratifié — le repo fait foi)

96 artefacts indexés. Colonne « Règles » = numéros POSSÉDÉS (nom de fichier)
quand ils existent, sinon numéros CITÉS dans le corps (⚠ inclut alors les renvois, ex. « gel
R1–R51 »). Statut · familles · suites de test dérivés du contenu et des suites réelles.

| Règles (repo) | Domaine / titre | Statut | Familles | Suites de test |
|---------------|-----------------|--------|----------|----------------|
| R1–R52 | ADR-14 — Implémentation de référence du moteur de workflow | PROPOSÉ | — | — |
| R1, R7, R13, R29, R39, R42, R48–R49, R66, R68, R177–R179, R267–R279 | ═══ VERDICT ÉTAPE 0 (Claude Code, 2026-07-27) — canon reçu d'Ali, enregistré tel quel ci-dessous ═══ | PROPOSÉ | CC, HO, LC, LS, OL, RV | fat-canon-anciens.e2e-spec.ts, fat-coc.e2e-spec.ts, fat-degel-v7.e2e-spec.ts, fat-canon-derniers.e2e-spec.ts |
| R1–R51, R68–R70, R73, R79–R80, R109–R115, R167–R169, R224, R255, R257, R264–R265, R269–R270, R272, R274, R276, R279, R282–R283, R285–R287, R290, R293–R323 | O-Live — CANON DU DÉGEL COMPLET (Vagues 1–9) + état du développement restant | RATIFIÉ | AS, AU, BD, BL, CC, CY, LC, LE, MB, OL, OP, PA, PC, RW, SB, SO, SY, TF, VE, VR, WB | fat-canon-derniers.e2e-spec.ts, fat-degel-v1.e2e-spec.ts, screens.test.tsx, auth.spec.ts |
| R1–R51, R334–R339 | CANON — ROBUSTESSE O-Live (adaptation étape 0, PROPOSÉ — en attente de ratification) | PROPOSÉ | MG | test.mjs, test.mjs |
| R1–R51, R104, R285–R286, R334–R339 | CANON — ROBUSTESSE O-Live, SPEC v2 ADAPTÉE (exploration approfondie, PROPOSÉ) | PROPOSÉ | EV, GR, LK, PJ, RB | upcasters.spec.ts, event-versioning.e2e-spec.ts, test.mjs, test.mjs |
| R104 | Catalogue O-Live — Amendement PROPOSÉ (R104) | RATIFIÉ | GR | golden-record.projector.spec.ts, event-projections.e2e-spec.ts |
| R144–R147 | Catalogue O-Live — Amendement PROPOSÉ (R144 → R147) · Bloc 26 « Le coffre — stockage gouverné » | RATIFIÉ | CV | coffre.wiring.spec.ts |
| R1–R77, R80–R81, R83–R103 | Catalogue O-Live — Amendements ratifiés (v2 → v2.1) | PROPOSÉ | AU, BD, BG, CK, DV, EX, GP, HM, IA, IN, KS, MF, OI, PD, PS, PT, RC, RP, RT, SC, SG, SN, ST, TM, TP, VQ | auth.spec.ts, fat-cloture-readiness.e2e-spec.ts, run_tests.py, test_cpsi_bloc1.py |
| R1, R112, R115, R139, R148–R152, R155 | Catalogue O-Live — Patch v4.10 → v4.11 (RATIFICATION du 20.07.2026) | PROPOSÉ | RS | recherche.wiring.spec.ts |
| R1, R39, R125, R152–R155 | Catalogue O-Live — Patch v4.11 → v4.12 (RATIFICATION du 20.07.2026) | PROPOSÉ | MO, PL | personne-lien.wiring.spec.ts |
| R1, R125, R149, R156–R161 | Catalogue O-Live — Patch v4.12 → v4.13 (RATIFICATION du 20.07.2026) | PROPOSÉ | AN | annotation.wiring.spec.ts |
| R1, R160–R163 | Catalogue O-Live — Patch v4.13 → v4.14 (RATIFICATION du 20.07.2026) | PROPOSÉ | AI | ia-ged.wiring.spec.ts |
| R1, R164–R166 | Catalogue O-Live — Patch v4.14 → v4.15 (RATIFICATION du 20.07.2026) | PROPOSÉ | GD, VU | ged-avance.wiring.spec.ts, ged.wiring.spec.ts, retention.wiring.spec.ts, vues.wiring.spec.ts |
| R1, R7, R39, R167–R170 | Catalogue O-Live — Patch v4.15 → v4.16 (RATIFICATION du 21.07.2026) | PROPOSÉ | GD, RN, SY | ged-avance.wiring.spec.ts, ged.wiring.spec.ts, retention.wiring.spec.ts, core-sync.wiring.spec.ts |
| R1, R171–R173 | Catalogue O-Live — Patch v4.16 → v4.17 (RATIFICATION du 21.07.2026) | PROPOSÉ | WF | workflow-def.wiring.spec.ts, fat-vague5.e2e-spec.ts |
| R1, R174–R176 | Catalogue O-Live — Patch v4.17 → v4.18 (RATIFICATION du 21.07.2026) | PROPOSÉ | OC | ocr-extraction.wiring.spec.ts |
| R1, R177–R182 | Catalogue O-Live — Patch v4.18 → v4.19 (RATIFICATION du 21.07.2026) | PROPOSÉ | GX, LC | ged-externe.wiring.spec.ts, vendor-license.wiring.spec.ts, fat-degel-v8.e2e-spec.ts, screens.test.tsx |
| R1, R183–R185 | Catalogue O-Live — Patch v4.19 → v4.20 (RATIFICATION du 21.07.2026) | PROPOSÉ | WK | workload.wiring.spec.ts |
| R1, R117–R120 | Catalogue O-Live — Patch v4.2 → v4.3 (RATIFICATION du 19.07.2026, soirée) | PROPOSÉ | OB | onboarding.wiring.spec.ts |
| R1, R186–R188 | Catalogue O-Live — Patch v4.20 → v4.21 (RATIFICATION du 21.07.2026) | PROPOSÉ | CR | crm.wiring.spec.ts, fat-vague5.e2e-spec.ts |
| R1, R119, R121–R124 | Catalogue O-Live — Patch v4.3 → v4.4 (RATIFICATION du 19.07.2026, nuit) | PROPOSÉ | AG | prerevue.wiring.spec.ts |
| R1, R48–R49, R124–R128 | Catalogue O-Live — Patch v4.4 → v4.5 (RATIFICATION du 19.07.2026, nuit — 2e vague) | PROPOSÉ | RQ | parametres.wiring.spec.ts |
| R1, R83, R125, R129–R133 | Catalogue O-Live — Patch v4.5 → v4.6 (RATIFICATION du 19.07.2026, fin de nuit) | PROPOSÉ | MR | mros.wiring.spec.ts |
| R1, R125, R133–R136 | Catalogue O-Live — Patch v4.6 → v4.7 (RATIFICATION du 20.07.2026, aube) | PROPOSÉ | RK | risk-case.wiring.spec.ts |
| R1, R109, R116, R125, R137–R139 | Catalogue O-Live — Patch v4.7 → v4.8 (RATIFICATION du 20.07.2026) | PROPOSÉ | IG | ged-ingestion.wiring.spec.ts |
| R1, R125, R131, R140–R143 | Catalogue O-Live — Patch v4.8 → v4.9 (RATIFICATION du 20.07.2026, matin) | PROPOSÉ | TX | transaction-gate.wiring.spec.ts, fat-vague4.e2e-spec.ts, run_tests.py, test_cpsi_bloc4.py |
| R1–R56, R109–R113, R115, R125, R137, R144–R147 | Catalogue O-Live — Patch v4.9 → v4.10 (RATIFICATION du 20.07.2026) | PROPOSÉ | CV, DB | coffre.wiring.spec.ts |
| R1–R52 | Catalogue normatif v2 — inventaire (source : OLive-Specifications-Moteur-Workflow-v2) | PROPOSÉ | — | — |
| R1–R56 | O-Live — Catalogue des règles R1–R56 (état v2.4, 12.07.2026) & propositions R57–R62 | PROPOSÉ | BD, DV, EX, IA, PS, PT, RC, RT, SC, SG, ST | run_tests.py, test_cpsi_bloc1.py, test_bloc10_r58_r61.py, run_tests.py |
| R1–R51 | sans-titre | PROPOSÉ | — | — |
| R117–R120 | Catalogue O-Live — Amendement PROPOSÉ (R117 → R120) · Bloc 19 « Onboarding — l'entrée en relation » | RATIFIÉ | OB | onboarding.wiring.spec.ts |
| R89–R99 | Catalogue O-Live — Amendements RATIFIÉS (R89 → R99) | RATIFIÉ | AU, KS, MF, OI, TM, TP | auth.spec.ts, fat-cloture-readiness.e2e-spec.ts, key-store.spec.ts, mfa.spec.ts |
| R2, R4, R13, R39, R48–R49, R52, R58–R61, R84–R86, R100–R103 | Catalogue O-Live — Erratum & note de version **v4.0 → v4.1** | PROPOSÉ | CK, FE, HF, HM, LK, NV, SC, VQ | rules.spec.ts, run_tests.py, test_cpsi_bloc16.py, test_cpsi_bloc17.py |
| R2, R7, R44, R48–R49, R66, R68–R70, R79–R80, R133–R136, R144, R167, R170, R177–R179, R250, R253–R266, R999 | O-Live — Spécification fonctionnelle détaillée | PROPOSÉ | HO, OL | fat-canon-derniers.e2e-spec.ts, fat-home.e2e-spec.ts, fat-swarm.e2e-spec.ts, screens.test.tsx |
| R2, R39, R44, R68, R121–R124, R177, R253–R267 | O-Live — Spécification fonctionnelle détaillée | PROPOSÉ | AG, HO, OL, SW | prerevue.wiring.spec.ts, fat-canon-derniers.e2e-spec.ts, fat-home.e2e-spec.ts, fat-swarm.e2e-spec.ts |
| R4–R5, R7, R13–R14, R17, R19, R25–R26, R29, R31, R33, R37, R39, R41–R43, R45, R47, R68, R163, R170, R177, R248–R278 | Questionnaire de paramétrage d'intégration (R-Q) | PROPOSÉ | CC, HO, OL, RV, SD, SW | fat-canon-anciens.e2e-spec.ts, fat-coc.e2e-spec.ts, fat-degel-v7.e2e-spec.ts, fat-canon-derniers.e2e-spec.ts |
| R7, R15, R29, R39, R83, R129–R136, R148–R151, R248–R252, R272, R274–R278, R280–R283 | O-Live — Canon des ÉCARTS ANCIENS | RATIFIÉ | AW, CC, PC, RC, RS, RV, RW, SB, SD, UC, VD | fat-cpsi.e2e-spec.ts, screens.test.tsx, fat-canon-anciens.e2e-spec.ts, fat-coc.e2e-spec.ts |
| R7, R13, R39, R68, R133–R136, R167, R177, R252–R259, R266–R267, R269, R274, R281, R284, R286, R288–R289 | O-Live — Canon & TRIAGE des ÉCRANS HTML restants | RATIFIÉ | AU, AW, BS, CP, DC, HO, IM, LC, PC, SO | auth.spec.ts, fat-cloture-readiness.e2e-spec.ts, fat-cpsi.e2e-spec.ts, screens.test.tsx |
| R7, R13, R39, R48, R68–R69, R89–R90, R117, R129–R132, R167–R169, R250, R255, R279, R282, R284, R289–R296 | O-Live — Canon : TRIAGE FINAL DE LA NAV · OIDC PER-TENANT AU LOGIN · PASSE DE CONFORMITÉ VISUELLE | RATIFIÉ | AU, CP, DC, HO, IM, LC, LG, OL, PC, RW, SD, SO, XB | auth.spec.ts, fat-cloture-readiness.e2e-spec.ts, fat-charge-cpsi.e2e-spec.ts, fat-cpsi.e2e-spec.ts |
| R7, R13, R15, R29, R39, R44, R48–R49, R63–R70, R72–R74, R76–R77, R79–R83, R86, R94, R100–R103, R129–R136, R167, R169–R170, R177, R248–R271, R276 | ═══ VERDICT ÉTAPE 0 (Claude Code, 2026-07-27) — canon reçu d'Ali, enregistré tel quel ci-dessous ═══ | PROPOSÉ | AW, BS, CP, HO, OF, OL, PA, PC, SB, SD | fat-cpsi.e2e-spec.ts, screens.test.tsx, fat-bs.e2e-spec.ts, fat-canon-derniers.e2e-spec.ts |
| R105–R108 | Catalogue O-Live — Amendement PROPOSÉ (R105 → R108) · Bloc 17 « PMS — mandats & adéquation » | RATIFIÉ | PF | pms.wiring.spec.ts |
| R109–R112 | Catalogue O-Live — Amendement PROPOSÉ (R109 → R112) · Bloc 18 « GED — documents & preuve » | RATIFIÉ | GD | ged-avance.wiring.spec.ts, ged.wiring.spec.ts, retention.wiring.spec.ts |
| R113–R116 | Catalogue O-Live — Amendement (R113 → R116) · Bloc 18 « GED — documents & preuve » (extension) | RATIFIÉ | GD | ged-avance.wiring.spec.ts, ged.wiring.spec.ts, retention.wiring.spec.ts |
| R121–R124 | Catalogue O-Live — Amendement PROPOSÉ (R121 → R124) · Bloc 20 « Agent de pré-revue IA » | RATIFIÉ | AG, GD | prerevue.wiring.spec.ts, ged-avance.wiring.spec.ts, ged.wiring.spec.ts, retention.wiring.spec.ts |
| R125–R128 | Catalogue O-Live — Amendement PROPOSÉ (R125 → R128) · Bloc 21 « Gouvernance des paramètres tenant — le R-Q exécutable » | RATIFIÉ | RQ | parametres.wiring.spec.ts |
| R129–R132 | Catalogue O-Live — Amendement PROPOSÉ (R129 → R132) · Bloc 22 « Communication MROS — art. 9 LBA » | RATIFIÉ | MR | mros.wiring.spec.ts |
| R133–R136 | Catalogue O-Live — Amendement PROPOSÉ (R133 → R136) · Bloc 23 « Risk cases — l'instruction AML » | RATIFIÉ | RK | risk-case.wiring.spec.ts |
| R140–R143 | Catalogue O-Live — Amendement PROPOSÉ (R140 → R143) · Bloc 25 « Le portail transactionnel — prévenir, pas constater » | RATIFIÉ | TX | transaction-gate.wiring.spec.ts, fat-vague4.e2e-spec.ts, run_tests.py, test_cpsi_bloc4.py |
| R152–R155 | Catalogue O-Live — Amendement PROPOSÉ (R152 → R155) · Bloc 28 « Les personnes liées — le lien est un acte » | RATIFIÉ | PL | personne-lien.wiring.spec.ts |
| R156–R159 | Catalogue O-Live — Amendement PROPOSÉ (R156 → R159) · Bloc 29 « Annotations & caviardage — le regard sans la plume » | RATIFIÉ | AN | annotation.wiring.spec.ts |
| R160–R163 | Catalogue O-Live — Amendement PROPOSÉ (R160 → R163) · Bloc 31 « L'IA au service du dossier » | RATIFIÉ | AI | ia-ged.wiring.spec.ts |
| R164–R166 | Catalogue O-Live — Amendement PROPOSÉ (R164 → R166) · Bloc 32 « Les dossiers-vues — classer sans copier » | RATIFIÉ | GD, VU | ged-avance.wiring.spec.ts, ged.wiring.spec.ts, retention.wiring.spec.ts, vues.wiring.spec.ts |
| R170 | Catalogue O-Live — Amendement PROPOSÉ (R170) · « La rétention naît au classement » | RATIFIÉ | GD, RN | ged-avance.wiring.spec.ts, ged.wiring.spec.ts, retention.wiring.spec.ts |
| R171–R173 | Catalogue O-Live — Amendement PROPOSÉ (R171 → R173) · Bloc 34 « Le workflow est un paramètre gouverné » | RATIFIÉ | WF | workflow-def.wiring.spec.ts, fat-vague5.e2e-spec.ts |
| R183–R185 | Catalogue O-Live — Amendement PROPOSÉ (R183 → R185) · Bloc 39 « La charge se voit, la reconnaissance se décide » | RATIFIÉ | WK | workload.wiring.spec.ts |
| R100–R103 | Catalogue O-Live — Amendements RATIFIÉS (R100 → R103) | RATIFIÉ | SC | screening-scenarios.spec.ts, screening.wiring.spec.ts, run_tests.py, test_cpsi_bloc3.py |
| R7, R39, R44, R48–R49, R63–R83, R133–R136, R248–R252 | language: fr | RATIFIÉ | CP, PC, PT | fat-charge-cpsi.e2e-spec.ts, fat-cpsi.e2e-spec.ts, fat-canon-anciens.e2e-spec.ts, fat-canon-derniers.e2e-spec.ts |
| R290–R291 | O-Live — PROPOSITION R290-R291 : les deux extensions consignées du canon triage | RATIFIÉ | DC, IM | fat-canon-derniers.e2e-spec.ts, screens.test.tsx |
| R7, R110, R133–R134, R145 | language: fr | PROPOSÉ | — | — |
| R7, R31, R34, R39, R42, R44, R103, R117–R119 | language: fr | PROPOSÉ | — | — |
| R7, R101, R103, R110, R114, R130, R132, R140, R142–R143, R145, R167–R169 | language: fr | PROPOSÉ | — | — |
| R7, R36, R138, R171–R173, R186–R188 | language: fr | PROPOSÉ | — | — |
| R7, R93, R99, R125–R128 | language: fr | PROPOSÉ | — | — |
| R7, R44, R105–R108 | language: fr | PROPOSÉ | — | — |
| R13, R15, R48–R49, R76, R89–R90, R104, R255, R266–R267, R270, R284–R287 | O-Live — Canon des DEUX DERNIERS ÉCARTS | RATIFIÉ | AS, AU, HO, OF, OL, PC, SO, UC | fat-canon-derniers.e2e-spec.ts, fat-degel-v1.e2e-spec.ts, screens.test.tsx, auth.spec.ts |
| R13, R15, R39, R48, R222, R230–R238 | language: fr | RATIFIÉ | FO | fat-vague13.e2e-spec.ts |
| R13, R15, R29, R39, R48, R221–R230, R238 | language: fr | PROPOSÉ | BT | fat-vague14.e2e-spec.ts |
| R331–R334 | CANON — INDUSTRIALISATION (enregistré 2026-07-29, statut RATIFIÉ) | RATIFIÉ | DP, FB, IX, MG | test.mjs, test.mjs, test.mjs, test.mjs |
| R167–R169 | Catalogue O-Live — Amendement PROPOSÉ (R167 → R169) · Bloc 33 « Le core banking est un port » | RATIFIÉ | SY | core-sync.wiring.spec.ts |
| R288 | O-Live — PROPOSITION R288 : les barèmes de scoring KYC sont des RÈGLES gouvernées | RATIFIÉ | BS, PA | fat-bs.e2e-spec.ts, fat-canon-derniers.e2e-spec.ts, screens.test.tsx, fat-cpsi.e2e-spec.ts |
| R29, R70, R94, R126, R189, R206 | language: fr | PROPOSÉ | — | — |
| R137–R139 | Catalogue O-Live — Amendement PROPOSÉ (R137 → R139) · Bloc 24 « Capture & ingestion GED » | RATIFIÉ | IG | ged-ingestion.wiring.spec.ts |
| R148–R151 | Catalogue O-Live — Amendement PROPOSÉ (R148 → R151) · Bloc 27 « La recherche — trouver sans trahir » | RATIFIÉ | RS | recherche.wiring.spec.ts |
| R174–R176 | Catalogue O-Live — Amendement PROPOSÉ (R174 → R176) · Bloc 36 « L'extraction comprend le document » | RATIFIÉ | OC | ocr-extraction.wiring.spec.ts |
| R186–R188 | Catalogue O-Live — Amendement PROPOSÉ (R186 → R188) · Bloc 40 « La relation se lit, le geste se motive, le conseil se tr | RATIFIÉ | CR | crm.wiring.spec.ts, fat-vague5.e2e-spec.ts |
| R248–R252 | Catalogue O-Live — Amendement (R248 → R252) · Bloc « La porte CPSI est un rejeu » | PROPOSÉ | AW, CP, PA, PC, RC | fat-cpsi.e2e-spec.ts, screens.test.tsx, fat-charge-cpsi.e2e-spec.ts, fat-canon-anciens.e2e-spec.ts |
| R39, R239–R242, R246 | language: fr | RATIFIÉ | TA | fat-vague16.e2e-spec.ts, fat-vague17.e2e-spec.ts |
| R44, R56, R104–R116 | Catalogue O-Live — Patch v4.1 → v4.2 (RATIFICATION du 19.07.2026) | PROPOSÉ | GD, GR, PF | ged-avance.wiring.spec.ts, ged.wiring.spec.ts, retention.wiring.spec.ts, golden-record.projector.spec.ts |
| R44, R48, R239, R243–R246 | language: fr | RATIFIÉ | NB, TA | fat-vague17.e2e-spec.ts, fat-vague16.e2e-spec.ts |
| R177–R179 | Catalogue O-Live — Amendement PROPOSÉ (R177 → R179) · Bloc 37 « Le module est une licence » | RATIFIÉ | LC | vendor-license.wiring.spec.ts, fat-degel-v8.e2e-spec.ts, screens.test.tsx |
| R70, R94–R95, R316–R317, R319–R320 | CANON — DÉCISIONS PO : BACS À SABLE + CONSOLE ÉDITEUR (enregistré 2026-07-29, RATIFIÉ) | PROPOSÉ | BS, VE | fat-bs.e2e-spec.ts, fat-canon-derniers.e2e-spec.ts, screens.test.tsx, fat-degel-v8.e2e-spec.ts |
| R115, R138–R139, R144, R146, R148–R151, R156–R159 | Note de câblage — Les chaînes (CB-01..06) · Lot 30 | PROPOSÉ | CB | chaines.wiring.spec.ts |
| R119 | Erratum R119 — `APPROVED` → `VALIDATED` (19.07.2026, soir) | PROPOSÉ | OB | onboarding.wiring.spec.ts |
| R125–R127, R189, R206 | language: fr | PROPOSÉ | — | — |
| R127, R133 | language: fr | PROPOSÉ | — | — |
| R180–R182 | Catalogue O-Live — Amendement PROPOSÉ (R180 → R182) · Bloc 38 « L'hébergeur est un choix, la preuve n'en est pas un » | RATIFIÉ | CV, GX | coffre.wiring.spec.ts, ged-externe.wiring.spec.ts |
| R172 | Note de câblage — KYC ↔ Workflow gouverné (KW-01..05) · Lot 35 | PROPOSÉ | KW | kyc-workflow.chaine.wiring.spec.ts |
| R177, R179 | Erratum E3 — 22.07.2026 · Dates relatives dans le spec Licence vendor (R177→R179) | PROPOSÉ | LC | vendor-license.wiring.spec.ts, fat-degel-v8.e2e-spec.ts, screens.test.tsx |
| R186–R187 | Erratum E1 — 21.07.2026 · Nommage du RM dans le module CRM (R186) | PROPOSÉ | CR | crm.wiring.spec.ts, fat-vague5.e2e-spec.ts |
| R189–R206 | language: fr | PROPOSÉ | — | — |
| R207–R221 | language: fr | PROPOSÉ | IS | islamic-screening.wiring.spec.ts |
| R221–R222, R230–R231, R238 | Règles PROPOSÉES R222..R238 — GELÉES (attente validation Ali) | RATIFIÉ | BT, FO | fat-vague14.e2e-spec.ts, fat-vague13.e2e-spec.ts |
| R324–R327 | CANON — SOLDE DES 4 DERNIERS ÉCARTS (enregistré 2026-07-29, statut RATIFIÉ) | RATIFIÉ | LN, OF, PC | fat-solde4-i18n.e2e-spec.ts, screens.test.tsx, kyc-service.spec.ts, fat-canon-derniers.e2e-spec.ts |
| R328–R330 | CANON — VAGUE DE CLÔTURE PRÉ-PILOTE (enregistré 2026-07-29, statut RATIFIÉ) | RATIFIÉ | DM, JW, RZ, SW | fat-cloture-demo.e2e-spec.ts, seed-demo-gwb.seed.ts, test.mjs, fat-cloture-jwt.e2e-spec.ts |
| — | O-Live GED — Référence technique | PROPOSÉ | — | — |
| — | Note E2 — 21.07.2026 · `Document.nom` est le champ canonique | PROPOSÉ | — | — |

## c) Paramètres tenant R-Q (`spec/questionnaire-R-Q.md`)

36 points de variabilité. (Défaut : voir le canon de chaque règle ; le questionnaire
porte la question, pas toujours le défaut — signalé comme tel.)

| Réf. | Question (résumée) |
|------|--------------------|
| R4 | Qui sont les relais nommés de chaque Visa / organisation validateur ? Quelle est la procédure de dérogation et son ratta |
| R5 | Délais des rappels de visa et Visa / SLA destinataires de l'escalade après le deuxième rappel ? |
| R17 | Restrictions d'opérations en état Dossier Suspendu (ex. entrées autorisées / sorties gelées en cas de communication MROS |
| R19 | Délais de rappel et de clôture Dossier administrative des dossiers abandonnés ? |
| R25 | Liste des documents optionnels vs Matrice documentaire obligatoires par section, et délai d'invalidation du visa conditi |
| R26/R29 | Contenu de la matrice documentaire par Matrice documentaire structure juridique, personnes liées et comptes ; calendrier |
| R31 | Le cumul de rôles dans un même dossier Personnes est-il autorisé ? Si oui, dans quels cas, avec quels flags (insider) ? |
| R33 | Délai post-mandat avant dé-PEPisation, et Personnes / PEP qui décide (Central File, RM, Compliance) ? |
| R37 | Périmètre exact du Central File : quels Organisation contrôles qualité, quels documents, quelle corroboration ? |
| R39 | Politique SLA : délais formels par type Tâches / SLA de tâche, destinataires des notifications, mécanismes d'incitation  |
| R41 | Chaînes d'escalade et de déblocage Organisation d'urgence : application manager, managers de fonction, COO ; suppléances |
| R42 | Fréquences du screening perpétuel Screening (quotidien positions/transactions, hebdomadaire PEP/sanctions, ou autres) ? |
| R43 | Qui porte la LoD2 de confirmation des Screening hits : MLRO ou autre rôle alloué ? |
| R45 | Sévérité d'application sur hit sanctions Screening / sanctions confirmé : suspension immédiate par défaut, modalités du  |
| R47 | La journalisation des accès en lecture Audit trail est-elle exigée ? |
| R251 | `cpsi_gate_timeout_ms` — timeout du Porte CPSI sous-processus moteur (défaut 5000 ms). Dépassé ⇒ 503 typé CPSI_GATE_UNAV |
| R250 | `cpsi_replay_warn_ms` — seuil de durée Porte CPSI d'hydratation (défaut 2000 ms). Dépassé ⇒ notification tracée (CPSI_RE |
| R248 | `cpsi_contract_version` supportées — Porte CPSI versions d'enveloppe acceptées (défaut ["1"]). Version inconnue ⇒ erreur |
| R267 | `retentionPostClotureAns` — durée de Offboarding rétention post-clôture (défaut 10 ans, LBA art. 7). La purge de fin de  |
| R268 | `visasParTypeCloture` — visas requis par Offboarding type (défauts : EXIT_COMPLIANCE → [CO_SR, DIR] (Head PB → DIR, mapp |
| R268 | `documentsParTypeCloture` — documents Offboarding exigés par type (défauts : DEMANDE_CLIENT → INSTRUCTION_TRANSFERT_SIGN |
| R270 | `rolesMotifSensible` — rôles habilités au Offboarding motif détaillé + réf MROS d'un EXIT_COMPLIANCE (défaut [CO_SR, MLR |
| R271 | `exExitComplianceForceEdd` — un ex- Offboarding EXIT_COMPLIANCE qui revient entre en workflow EDD imposé (défaut vrai). |
| R253 | `oliviaProviderRef` / `oliviaModel` — Olivia RÉFÉRENCES du fournisseur et du modèle (jamais le secret — pattern R163 ; l |
| R253 | `oliviaTimeoutMs` — timeout fournisseur Olivia (défaut 30000). Dépassé ⇒ 502 OLIVIA_PROVIDER_DOWN, échec JOURNALISÉ. |
| R255 | `oliviaScopeMaxObjets` — borne du Olivia contexte (défaut 50). Dépassée ⇒ 422 OLIVIA_CONTEXT_OVERFLOW AVANT tout appel. |
| R255/R68 | `oliviaPromptTemplate.{C1..C4}` — Olivia gabarits versionnés à date. Défauts = artefact livré `olivia-gabarits.default.j |
| R257 | `oliviaRetentionConversationsMois` — Olivia rétention du journal (politique R170 du tenant ; la purge est un processus d |
| R272 | `cadenceReviewMois` {EDD, CDD, SDD} — Reviews cadence par niveau de diligence (défauts 12 / 36 / 60). La valeur EN VIGUE |
| R274 | `preavisReviewJours` — préavis de tâche Reviews RM + notification (défaut 30). Notifie UNE fois, ne bloque jamais (R39). |
| R274 | `escaladeRetardJours` {CO, DIR} — Reviews escalade du retard (défauts 30 / 90). EN_RETARD est un fait CALCULÉ à la lectu |
| R273 | `rolesReportEcheance` — rôles habilités Reviews à RECULER une échéance (défaut [CO_SR]) ; motif R7 + visa four-eyes d'un |
| R276 | Registre COC_CONFIG — types de CoC CoC versionnés à date (append-only, `coc_config_versions` ; table LIVRÉE de 12 types  |
| R277 | `cocFourEyes` {HAUTE, MOYENNE, BASSE} — CoC visa d'un second au traitement (défauts vrai / faux / faux ; l'initiateur ne |
| R278 | `cocSlaJours` {HAUTE, MOYENNE, BASSE} — CoC délais ouverture→traitement (défauts 10 / 30 / 90). MESURÉS au reporting, ja |
| R273 | `cocReviewAnticipationJours` — un CoC CoC/Reviews HAUTE anticipe l'échéance de review à J+n (défaut 30 ; déclencheur `co |

## d) Écrans (72/72)

67+4 bacs = 71 au front tenant + 1 app vendor. Comptage gravé : « absent par
canon » ≠ « absent par retard ». Conformité visuelle : grille 5 colonnes,
hiérarchie canon > maquette > goût, i18n 4 langues, tokens olive.

Détail par écran : `docs/CONFORMITE-VISUELLE.md` (grille 5 colonnes).

## e) Gels & options restants (déclencheurs chiffrés)

Backend **TypeScript/NestJS + Prisma + PostgreSQL** (RLS, triggers
d'immuabilité) · Front **React/TS (Vite)** · Moteur CPSI **Python pur isolé**
derrière une porte à contrat versionné · Redis (BullMQ + rate limit partagé) ·
SSE descendant · Exoscale (Terraform, WAL-G, SOS) · JWT RS256 + OIDC per-tenant.
K8s/Kafka : différés Phase 3 sur déclencheurs CHIFFRÉS (≥25 tenants / ≥3
deploys/sem / autoscaling démontré ; lag outbox >60s p95 / >1M évts/j / ≥5
consommateurs) — refus par défaut en dessous.

Actes Ali : terraform apply + restore testé · canal d'alerte · 4 écarts ASVS ·
pentest (cabinet CH, retest, mobile exclu→dédié) · marque · premier pilote.
Décisions d'opportunité : cache moteur (jauge), options coupées (tokenisation,
AMA, paiements mobile) sur demande client.

---
# PROMPT SOURCE — GÉNÉRER LE DOCUMENT FAISANT FOI (conservé pour traçabilité)

Objectif : produire `docs/CANON-MASTER.md` — LE document unique faisant foi,
GÉNÉRÉ depuis le repo (jamais rédigé à la main), et le maintenir à jour.
(1) Générateur parcourant `spec/`, catalogues, `PROJECT-INDEX.md`,
`questionnaire-R-Q.md` et le code → mapping session↔repo, inventaire intégral,
paramètres R-Q, écrans, gels/options, invariants, en-tête daté+hash.
(2) Vérifications : numéro manquant/doublon, règle sans scénario, scénario sans
suite → rapport d'anomalie en tête (jamais corrigé en silence).
(3) CI : régénération à chaque merge ; édition manuelle → build rouge.
(4) Comparaison référentiel de session ↔ généré → rapport de divergences à
signaler, pas à absorber.

## f) Invariants (repris verbatim — s'appliquent à tout bloc)

1. Rien ne change d'état par effet de bord — tout passe par un événement tracé.
2. Journaux append-only chaînés (hash), rejeu à date nominal (R48/R49).
3. Versionné par date de mise en vigueur + grandfathering (R29/R68) — nuance
   ratifiée : la SÉCURITÉ suit la config courante, la COMPLÉTUDE est
   grandfathérée.
4. Visa objet uniforme (R15) ; four-eyes au niveau section, initiateur exclu (R13).
5. Motif obligatoire sur tout acte sensible (R7).
6. IA propose, humain décide (R44) — partout, y compris agents.
7. Le système mesure et notifie, ne coerce jamais (R39) — retards/SLA = faits
   calculés, jamais des statuts stockés ni des blocages.
8. Ports optionnels : pas de secret/connecteur = refus gracieux typé ; ZÉRO
   donnée simulée en prod (fixtures = test uniquement).
9. Default-deny : l'inconnu (signal, juridiction, commande, rôle) est refusé ou
   « non déterminé », jamais deviné.
10. RBAC+RLS côté backend exclusivement — le front ne filtre jamais ; la
    non-révélation d'existence s'applique (refus indistinguables).
11. Tout « ça dépend de la banque » = paramètre tenant au questionnaire R-Q,
    affiché en clair, versionné.
12. Spec-first : Gherkin ratifié avant code ; un bloc est fini à 100 % de
    scénarios verts ; tout écart repo↔canon est consigné, jamais tranché en
    silence.

