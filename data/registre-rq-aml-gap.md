# Registre R-Q — paramètres tenant (AML gap, waves 1+2)

Chaque paramètre = une question du questionnaire d'onboarding tenant. Défauts = point de départ GWB ; toute valeur tenant est versionnée par date de vigueur (R29).

| Règle | Scénario | Bloc | Clé | Libellé | Défaut | Unité |
|---|---|---|---|---|---|---|
| R340 | SF-01 | Screening en flux | `seuil_match_pep_flux` | score de similarité minimal | 78 | % |
| R340 | SF-01 | Screening en flux | `listes_pep` | fournisseurs de listes actives | tenant | - |
| R341 | SF-02 | Screening en flux | `rang_source_min` | rang minimal de fiabilité de la source | 2 | - |
| R341 | SF-02 | Screening en flux | `categories_am` | catégories retenues (ML, fraude, corruption, TF) | tenant | - |
| R342 | SF-03 | Screening en flux | `frequence_rescreen` | fréquence du re-screening du stock | 24 | heures |
| R342 | SF-03 | Screening en flux | `scope_personnes_liees` | inclure les personnes liées | true | - |
| R343 | SF-04 | Screening en flux | `liste_bic_interne` | liste interne de banques surveillées | tenant | - |
| R344 | SF-05 | Screening en flux | `referentiel_geo_sanctions` | référentiel des zones sanctionnées | tenant | - |
| R345 | SF-06 | Screening en flux | `scripts_actifs` | scripts normalisés | AR,CYR,ZH | - |
| R346 | SF-07 | Screening en flux | `extraction_imo` | extraction IMO des champs libres | true | - |
| R347 | QO-01 | Indices OBA-FINMA | `nb_relances_avant_signal` | relances avant signal | 2 | - |
| R348 | QO-02 | Indices OBA-FINMA | `tiers_distincts_seuil` | tiers distincts / 30j | 6 | - |
| R349 | QO-03 | Indices OBA-FINMA | `delai_reponse_client` | délai de réponse attendu | 10 | jours |
| R350 | QO-04 | Indices OBA-FINMA | `clients_par_adresse_seuil` | clients distincts par adresse | 5 | - |
| R351 | QO-05 | Indices OBA-FINMA | `chgts_gouvernance_seuil` | changements / 6 mois | 3 | - |
| R352 | GU-01 | Vision groupe UBO | `fenetre_agregation_ubo` | fenêtre d'agrégation | 7 | jours |
| R352 | GU-01 | Vision groupe UBO | `seuil_agrege_ubo` | seuil agrégé groupe | 50000 | CHF |
| R353 | GU-02 | Vision groupe UBO | `duree_cycle_max` | durée max du cycle détecté | 30 | jours |
| R354 | GU-03 | Vision groupe UBO | `ratio_cash_groupe` | ratio cash consolidé max | 25 | % |
| R355 | GU-04 | Vision groupe UBO | `seuil_cross_produits` | seuil agrégé équivalent | 75000 | CHF |
| R356 | IP-01 | Instruments PB | `delai_anticipe_min` | remboursement considéré anticipé si < | 12 | mois |
| R357 | IP-02 | Instruments PB | `perimetre_lien` | liens retenus (UBO, famille, signataires) | tenant | - |
| R358 | IP-03 | Instruments PB | `ratio_prime_patrimoine` | ratio prime/patrimoine max | 60 | % |
| R359 | IP-04 | Instruments PB | `delai_rachat_min` | rachat considéré précoce si < | 24 | mois |
| R360 | IP-05 | Instruments PB | `delai_chgt_benef` | fenêtre de surveillance post-souscription | 24 | mois |
| R361 | IP-06 | Instruments PB | `fenetre_correlation` | corrélation accès↔cash | 48 | heures |
| R361 | IP-06 | Instruments PB | `nb_correlations_seuil` | corrélations / 90j | 3 | - |
| R362 | IP-07 | Instruments PB | `seuil_metaux` | équivalent CHF / 90j | 100000 | CHF |
| R363 | CR-01 | Crypto / VASP | `vasp_conformes` | registre des VASP conformes travel rule | tenant | - |
| R364 | CR-02 | Crypto / VASP | `seuil_exposition_mixer` | exposition directe max | 10 | % |
| R364 | CR-02 | Crypto / VASP | `hops_analyses` | profondeur d'analyse | 2 | hops |
| R365 | CR-03 | Crypto / VASP | `listes_adresses` | listes d'adresses actives | OFAC,SECO | - |
| R366 | CR-04 | Crypto / VASP | `seuil_cluster_illicite` | provenance illicite max | 5 | % |
| R367 | CR-05 | Crypto / VASP | `methodes_preuve` | méthodes acceptées | signature,satoshi_test | - |
| R367 | CR-05 | Crypto / VASP | `validite_preuve` | validité de la preuve | 12 | mois |
| R368 | CR-06 | Crypto / VASP | `cycles_ramp_seuil` | cycles / 30j | 6 | - |
| R369 | FT-01 | CFT | `corridors_cft` | liste corridors CFT | tenant | - |
| R369 | FT-01 | CFT | `freq_micro_seuil` | transferts / 60j | 10 | - |
| R369 | FT-01 | CFT | `montant_micro_max` | montant unitaire max | 500 | CHF |
| R370 | FT-02 | CFT | `registre_npo` | référentiel NPO surveillées | tenant | - |
| R371 | FT-03 | CFT | `sources_rechargement_seuil` | sources distinctes / 90j | 3 | - |
| R372 | FT-04 | CFT | `fenetre_voyage` | fenêtre avant/après voyage | 14 | jours |
| R373 | FT-05 | CFT | `listes_cft` | listes CFT actives | tenant | - |
| R374 | GV-01 | Gouvernance du dispositif | `taux_echantillon_btl` | taux d'échantillonnage | 2 | % |
| R374 | GV-01 | Gouvernance du dispositif | `bande_btl` | bande sous le seuil | 80-100 | % |
| R374 | GV-01 | Gouvernance du dispositif | `frequence_btl` | fréquence de campagne | 90 | jours |
| R375 | GV-02 | Gouvernance du dispositif | `fenetre_backtest` | fenêtre de rejeu | 90 | jours |
| R375 | GV-02 | Gouvernance du dispositif | `seuil_degradation` | perte de rappel max tolérée | 0 | TP manqué |
| R376 | GV-03 | Gouvernance du dispositif | `completude_min` | complétude minimale des champs critiques | 98 | % |
| R377 | GV-04 | Gouvernance du dispositif | `matrice_couverture` | référentiel de typologies de la matrice | GAFI+OBA-FINMA | - |
| R378 | TB-01 | TBML | `ecart_prix_seuil` | écart au prix de référence | 15 | % |
| R378 | TB-01 | TBML | `nb_factures_min` | factures concernées / 90j | 3 | - |
| R379 | TB-02 | TBML | `fenetre_dedup` | fenêtre de déduplication | 180 | jours |
| R380 | TB-03 | TBML | `percentile_bas` | percentile bas | 5 | % |
| R380 | TB-03 | TBML | `percentile_haut` | percentile haut | 95 | % |
| R380 | TB-03 | TBML | `referentiel_hs` | référentiel de prix HS | tenant | - |
| R381 | TB-04 | TBML | `listes_controle` | listes de contrôle actives | SECO,EU | - |
| R382 | TB-05 | TBML | `hrj_trade` | liste juridictions trade à risque | tenant | - |
| R383 | TB-06 | TBML | `seuil_verif_tracking` | seuil de vérification | 100000 | CHF |
| R384 | TB-07 | TBML | `transbordements_max` | transbordements tolérés | 1 | - |
| R385 | TB-08 | TBML | `duree_cycle_trade` | fenêtre de détection | 180 | jours |
| R386 | CB-03 | Correspondent Banking | `taux_incomplet_max` | taux d'incomplétude toléré par correspondant | 2 | % |
| R387 | CB-04 | Correspondent Banking | `fenetre_uturn` | fenêtre d'appariement | 30 | jours |
| R388 | CB-05 | Correspondent Banking | `indicateurs_pta` | indicateurs d'usage direct | tenant | - |
| R389 | CB-06 | Correspondent Banking | `derive_max` | dérive tolérée vs profil | 20 | % |
| R390 | CB-07 | Correspondent Banking | `registres_supervision` | registres de superviseurs consultés | tenant | - |
| R391 | CB-08 | Correspondent Banking | `periode_revue_rma` | période de revue | 12 | mois |
| R392 | CB-09 | Correspondent Banking | `frequence_screen_respondants` | fréquence | 30 | jours |
| R393 | PF-01 | Prolifération | `plafonds_sectoriels` | référentiel plafonds/embargos | tenant | - |
| R394 | PF-02 | Prolifération | `age_entite_min` | âge minimal sans surrisque | 24 | mois |
| R395 | PF-03 | Prolifération | `categories_luxe` | catégories surveillées | tenant | - |
| R396 | IA-01 | Immobilier & Art | `ecart_marche_max` | écart au marché toléré | 25 | % |
| R397 | IA-02 | Immobilier & Art | `delai_revente_min` | revente considérée rapide si < | 36 | mois |
| R398 | IA-03 | Immobilier & Art | `seuil_biens_valeur` | équivalent CHF / 180j | 200000 | CHF |
| R399 | AN-01 | Analytique 2G | `zscore_seuil` | z-score de déclenchement | 3.5 | σ |
| R400 | AN-02 | Analytique 2G | `sensibilite_rupture` | sensibilité du détecteur | tenant | - |
| R401 | AN-03 | Analytique 2G | `dimensions_ft` | dimensions surveillées | international,cash,HRJ,produit_risque | - |
| R401 | AN-03 | Analytique 2G | `materialite_ft` | matérialité minimale | 25000 | CHF |
| R402 | AN-04 | Analytique 2G | `dormance_segment` | dormance du segment | 24 | mois |
| R403 | AN-05 | Analytique 2G | `ecart_revenu_max` | écart toléré vs déclaré | 50 | % |

Total : **80 paramètres** sur 64 règles. Les valeurs `tenant` sans défaut chiffré exigent une réponse explicite au questionnaire (pas de défaut silencieux).