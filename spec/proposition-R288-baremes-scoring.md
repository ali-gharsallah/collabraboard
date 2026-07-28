# O-Live — PROPOSITION R288 : les barèmes de scoring KYC sont des RÈGLES gouvernées
# (complète la brique configuration & paramétrage — dernier trou identifié)

**Statut : PROPOSÉ — en attente de ratification par Ali Gharsallah.**

## VERDICT ÉTAPE 0 (exécutée sur le repo réel, 2026-07-28)

- **0a Numérotation R288 : LIBRE** ✓ (aucune occurrence dans spec/, src/, moteurs).
- **0b Famille : extension BS-07..09** — la famille BS (bacs à sable) est RATIFIÉE avec
  BS-01..06 ; BS-07+ vérifié libre. Aucune famille nouvelle.
- **0c État réel — CORRECTION d'une reconnaissance périmée** : les 5 endpoints dry-run
  `/v1/sandbox/*` EXISTENT (livrés 2026-07-27 : kyc-droits, brm-seuils, onb-aiguillage,
  cf-exigences, wf-delais — BS-01..06 verts, écran Sandboxes). Le RÉSIDU consigné
  (ECARTS l.181) : `computeRisk` est une fonction PURE et tracée (idéal), mais ses
  barèmes sont CODÉS EN DUR — STRUCTURE_PTS {PP:0, SA:10, HOLDING:20, TRUST:35…},
  ACCOUNT_PTS {CURRENT:0, ADVISORY:5, LOMBARD:15}, HIGH_RISK_CC (+40), seuils 50/25.
  Conséquences : (1) changer la grille de risque = changer le CODE (viole R125 :
  un barème est une règle) ; (2) `brm-seuils` ne simule que les SEUILS sur le
  riskScore STOCKÉ — impossible de simuler un changement de POINTS (structure,
  compte, pays) ni de re-scorer ; (3) aucun rejeu « quel aurait été le score sous
  le barème du 15.03 ? ».
  Précédents ratifiés à réutiliser : `workloadBareme` [{depuisLe, points}] (R185,
  versionné à date, jamais rétroactif) · `cpsi.param.applied` avec date de mise en
  vigueur (PA-03) · grandfathering R29/R48.

## R288 (PROPOSÉ) — Le barème de scoring est une règle : gouverné, versionné, rejouable

1. **Clé R-Q `kycScoringBareme`** (json, versionnée PAR DATE D'EFFET, pattern
   workloadBareme) : [{depuisLe, structurePts{...}, accountPts{...}, paysRisque[],
   paysRisquePts, seuilEdd, seuilCdd}]. **Défaut = les valeurs actuelles du moteur**
   (aucun changement de comportement à la livraison).
2. **`computeRisk(input, bareme?)`** : la fonction reste PURE — le barème s'INJECTE ;
   sans argument, le barème par défaut (compatibilité intégrale, harnais inchangé).
   La création de dossier résout le barème EN VIGUEUR à sa date (R29 : le dossier
   garde à vie le score de SON barème — déjà structurel : score + trace stockés).
   La trace mentionne la date d'effet du barème appliqué.
3. **`brm-seuils` ÉTENDU** : leviers points + pays + seuils → RE-SCORE hypothétique
   par `computeRisk` pur sur les attributs réels des clients (plus seulement le
   score stocké) — reclassements nominatifs avec ancien/nouveau score. Zéro écriture
   (BS-01 re-passé).
4. **Rejeu** : `GET /v1/parametres/valeur/kycScoringBareme?date=` restitue le barème
   d'époque (R127 — déjà servi par le registre, rien à construire).

### Scénarios BS-07..09
> **BS-07 — Le barème se change par le REGISTRE, jamais par le code** : écrire un
> barème v2 (motivé, date d'effet) → un dossier créé AVANT garde score/workflow
> (R29) ; un dossier créé APRÈS est scoré sous v2 (trace : date d'effet du barème).
> **BS-08 — sbbrm re-score sous barème hypothétique** : lever HOLDING 20→35 points →
> reclassements NOMINATIFS (ancien score → nouveau score), Δ charge EDD ; aucune
> écriture (BS-01), le barème RÉEL n'a pas bougé.
> **BS-09 — Le score d'époque se rejoue** : barème v1 puis v2 → la valeur effective
> à une date entre les deux restitue v1 (R127/R48).

### Interdits (hérités)
Second moteur de scoring ; recopie du barème sur les dossiers (résolution PAR DATES,
le score stocké + la trace suffisent) ; mutation du barème hors registre R-Q ;
écriture dans un bac à sable ; code avant test.

**Livrable proposé** : 1 commit (R288, BS-07..09) sur la branche pilote PR #46.
