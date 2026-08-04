// GÉNÉRÉ par tools/aml-gap/gen_aml_gap.py — NE PAS ÉDITER À LA MAIN.
// Registre R-Q des paramètres tenant AML gap (waves 1+2, R340–R403). Étalé dans
// REGISTRE_RQ (parametres.service.ts) : le questionnaire d'onboarding se génère de ces
// entrées. Toute évolution passe par le générateur (test_gen_aml_gap.py rougit sinon).

export interface AmlGapRqEntree {
  cle: string; type: 'int' | 'bool' | 'json' | 'string'; defaut: string | number | boolean | null;
  regle: string; requis: boolean; exemple?: unknown; description: string;
}

export const AML_GAP_RQ: AmlGapRqEntree[] = [
  {
    "cle": "seuil_match_pep_flux",
    "type": "int",
    "defaut": 78,
    "regle": "R340",
    "requis": false,
    "description": "Score de similarité minimal — SF-01 / Screening en flux (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "listes_pep",
    "type": "json",
    "defaut": null,
    "regle": "R340",
    "requis": true,
    "description": "Fournisseurs de listes PEP actives — SF-01 / Screening en flux (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "rang_source_min",
    "type": "int",
    "defaut": 2,
    "regle": "R341",
    "requis": false,
    "description": "Rang minimal de fiabilité de la source — SF-02 / Screening en flux (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "categories_am",
    "type": "json",
    "defaut": null,
    "regle": "R341",
    "requis": true,
    "description": "Catégories retenues (ML, fraude, corruption, TF) — SF-02 / Screening en flux (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "frequence_rescreen",
    "type": "int",
    "defaut": 24,
    "regle": "R342",
    "requis": false,
    "description": "Fréquence du re-screening du stock (heures) — SF-03 / Screening en flux (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "scope_personnes_liees",
    "type": "bool",
    "defaut": true,
    "regle": "R342",
    "requis": false,
    "description": "Inclure les personnes liées — SF-03 / Screening en flux (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "liste_bic_interne",
    "type": "json",
    "defaut": null,
    "regle": "R343",
    "requis": true,
    "description": "Liste interne de banques surveillées — SF-04 / Screening en flux (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "referentiel_geo_sanctions",
    "type": "json",
    "defaut": null,
    "regle": "R344",
    "requis": true,
    "description": "Référentiel des zones sanctionnées — SF-05 / Screening en flux (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "scripts_actifs",
    "type": "string",
    "defaut": "AR,CYR,ZH",
    "regle": "R345",
    "requis": false,
    "description": "Scripts normalisés — SF-06 / Screening en flux (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "extraction_imo",
    "type": "bool",
    "defaut": true,
    "regle": "R346",
    "requis": false,
    "description": "Extraction IMO des champs libres — SF-07 / Screening en flux (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "nb_relances_avant_signal",
    "type": "int",
    "defaut": 2,
    "regle": "R347",
    "requis": false,
    "description": "Relances avant signal — QO-01 / Indices OBA-FINMA (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "tiers_distincts_seuil",
    "type": "int",
    "defaut": 6,
    "regle": "R348",
    "requis": false,
    "description": "Tiers distincts / 30j — QO-02 / Indices OBA-FINMA (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "delai_reponse_client",
    "type": "int",
    "defaut": 10,
    "regle": "R349",
    "requis": false,
    "description": "Délai de réponse attendu (jours) — QO-03 / Indices OBA-FINMA (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "clients_par_adresse_seuil",
    "type": "int",
    "defaut": 5,
    "regle": "R350",
    "requis": false,
    "description": "Clients distincts par adresse — QO-04 / Indices OBA-FINMA (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "chgts_gouvernance_seuil",
    "type": "int",
    "defaut": 3,
    "regle": "R351",
    "requis": false,
    "description": "Changements / 6 mois — QO-05 / Indices OBA-FINMA (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "fenetre_agregation_ubo",
    "type": "int",
    "defaut": 7,
    "regle": "R352",
    "requis": false,
    "description": "Fenêtre d'agrégation (jours) — GU-01 / Vision groupe UBO (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "seuil_agrege_ubo",
    "type": "int",
    "defaut": 50000,
    "regle": "R352",
    "requis": false,
    "description": "Seuil agrégé groupe (CHF) — GU-01 / Vision groupe UBO (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "duree_cycle_max",
    "type": "int",
    "defaut": 30,
    "regle": "R353",
    "requis": false,
    "description": "Durée max du cycle détecté (jours) — GU-02 / Vision groupe UBO (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "ratio_cash_groupe",
    "type": "int",
    "defaut": 25,
    "regle": "R354",
    "requis": false,
    "description": "Ratio cash consolidé max (%) — GU-03 / Vision groupe UBO (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "seuil_cross_produits",
    "type": "int",
    "defaut": 75000,
    "regle": "R355",
    "requis": false,
    "description": "Seuil agrégé équivalent (CHF) — GU-04 / Vision groupe UBO (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "delai_anticipe_min",
    "type": "int",
    "defaut": 12,
    "regle": "R356",
    "requis": false,
    "description": "Remboursement considéré anticipé si < (mois) — IP-01 / Instruments PB (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "perimetre_lien",
    "type": "json",
    "defaut": null,
    "regle": "R357",
    "requis": true,
    "description": "Liens retenus (UBO, famille, signataires) — IP-02 / Instruments PB (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "ratio_prime_patrimoine",
    "type": "int",
    "defaut": 60,
    "regle": "R358",
    "requis": false,
    "description": "Ratio prime/patrimoine max (%) — IP-03 / Instruments PB (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "delai_rachat_min",
    "type": "int",
    "defaut": 24,
    "regle": "R359",
    "requis": false,
    "description": "Rachat considéré précoce si < (mois) — IP-04 / Instruments PB (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "delai_chgt_benef",
    "type": "int",
    "defaut": 24,
    "regle": "R360",
    "requis": false,
    "description": "Fenêtre de surveillance post-souscription (mois) — IP-05 / Instruments PB (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "fenetre_correlation",
    "type": "int",
    "defaut": 48,
    "regle": "R361",
    "requis": false,
    "description": "Corrélation accès↔cash (heures) — IP-06 / Instruments PB (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "nb_correlations_seuil",
    "type": "int",
    "defaut": 3,
    "regle": "R361",
    "requis": false,
    "description": "Corrélations / 90j — IP-06 / Instruments PB (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "seuil_metaux",
    "type": "int",
    "defaut": 100000,
    "regle": "R362",
    "requis": false,
    "description": "Équivalent CHF / 90j — IP-07 / Instruments PB (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "vasp_conformes",
    "type": "json",
    "defaut": null,
    "regle": "R363",
    "requis": true,
    "description": "Registre des VASP conformes travel rule — CR-01 / Crypto / VASP (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "seuil_exposition_mixer",
    "type": "int",
    "defaut": 10,
    "regle": "R364",
    "requis": false,
    "description": "Exposition directe max (%) — CR-02 / Crypto / VASP (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "hops_analyses",
    "type": "int",
    "defaut": 2,
    "regle": "R364",
    "requis": false,
    "description": "Profondeur d'analyse (hops) — CR-02 / Crypto / VASP (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "listes_adresses",
    "type": "string",
    "defaut": "OFAC,SECO",
    "regle": "R365",
    "requis": false,
    "description": "Listes d'adresses actives — CR-03 / Crypto / VASP (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "seuil_cluster_illicite",
    "type": "int",
    "defaut": 5,
    "regle": "R366",
    "requis": false,
    "description": "Provenance illicite max (%) — CR-04 / Crypto / VASP (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "methodes_preuve",
    "type": "string",
    "defaut": "signature,satoshi_test",
    "regle": "R367",
    "requis": false,
    "description": "Méthodes acceptées — CR-05 / Crypto / VASP (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "validite_preuve",
    "type": "int",
    "defaut": 12,
    "regle": "R367",
    "requis": false,
    "description": "Validité de la preuve (mois) — CR-05 / Crypto / VASP (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "cycles_ramp_seuil",
    "type": "int",
    "defaut": 6,
    "regle": "R368",
    "requis": false,
    "description": "Cycles / 30j — CR-06 / Crypto / VASP (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "corridors_cft",
    "type": "json",
    "defaut": null,
    "regle": "R369",
    "requis": true,
    "description": "Liste corridors CFT — FT-01 / CFT (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "freq_micro_seuil",
    "type": "int",
    "defaut": 10,
    "regle": "R369",
    "requis": false,
    "description": "Transferts / 60j — FT-01 / CFT (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "montant_micro_max",
    "type": "int",
    "defaut": 500,
    "regle": "R369",
    "requis": false,
    "description": "Montant unitaire max (CHF) — FT-01 / CFT (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "registre_npo",
    "type": "json",
    "defaut": null,
    "regle": "R370",
    "requis": true,
    "description": "Référentiel NPO surveillées — FT-02 / CFT (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "sources_rechargement_seuil",
    "type": "int",
    "defaut": 3,
    "regle": "R371",
    "requis": false,
    "description": "Sources distinctes / 90j — FT-03 / CFT (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "fenetre_voyage",
    "type": "int",
    "defaut": 14,
    "regle": "R372",
    "requis": false,
    "description": "Fenêtre avant/après voyage (jours) — FT-04 / CFT (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "listes_cft",
    "type": "json",
    "defaut": null,
    "regle": "R373",
    "requis": true,
    "description": "Listes CFT actives — FT-05 / CFT (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "taux_echantillon_btl",
    "type": "int",
    "defaut": 2,
    "regle": "R374",
    "requis": false,
    "description": "Taux d'échantillonnage (%) — GV-01 / Gouvernance du dispositif (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "bande_btl",
    "type": "string",
    "defaut": "80-100",
    "regle": "R374",
    "requis": false,
    "description": "Bande sous le seuil (%) — GV-01 / Gouvernance du dispositif (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "frequence_btl",
    "type": "int",
    "defaut": 90,
    "regle": "R374",
    "requis": false,
    "description": "Fréquence de campagne (jours) — GV-01 / Gouvernance du dispositif (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "fenetre_backtest",
    "type": "int",
    "defaut": 90,
    "regle": "R375",
    "requis": false,
    "description": "Fenêtre de rejeu (jours) — GV-02 / Gouvernance du dispositif (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "seuil_degradation",
    "type": "int",
    "defaut": 0,
    "regle": "R375",
    "requis": false,
    "description": "Perte de rappel max tolérée (TP manqués) — GV-02 / Gouvernance du dispositif (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "completude_min",
    "type": "int",
    "defaut": 98,
    "regle": "R376",
    "requis": false,
    "description": "Complétude minimale des champs critiques (%) — GV-03 / Gouvernance du dispositif (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "matrice_couverture",
    "type": "string",
    "defaut": "GAFI+OBA-FINMA",
    "regle": "R377",
    "requis": false,
    "description": "Référentiel de typologies de la matrice — GV-04 / Gouvernance du dispositif (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "ecart_prix_seuil",
    "type": "int",
    "defaut": 15,
    "regle": "R378",
    "requis": false,
    "description": "écart au prix de référence — TB-01 / TBML (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "nb_factures_min",
    "type": "int",
    "defaut": 3,
    "regle": "R378",
    "requis": false,
    "description": "factures concernées / 90j — TB-01 / TBML (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "fenetre_dedup",
    "type": "int",
    "defaut": 180,
    "regle": "R379",
    "requis": false,
    "description": "fenêtre de déduplication — TB-02 / TBML (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "percentile_bas",
    "type": "int",
    "defaut": 5,
    "regle": "R380",
    "requis": false,
    "description": "percentile bas — TB-03 / TBML (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "percentile_haut",
    "type": "int",
    "defaut": 95,
    "regle": "R380",
    "requis": false,
    "description": "percentile haut — TB-03 / TBML (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "referentiel_hs",
    "type": "json",
    "defaut": null,
    "regle": "R380",
    "requis": true,
    "description": "référentiel de prix HS — TB-03 / TBML (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "listes_controle",
    "type": "string",
    "defaut": "SECO,EU",
    "regle": "R381",
    "requis": false,
    "description": "listes de contrôle actives — TB-04 / TBML (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "hrj_trade",
    "type": "json",
    "defaut": null,
    "regle": "R382",
    "requis": true,
    "description": "liste juridictions trade à risque — TB-05 / TBML (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "seuil_verif_tracking",
    "type": "int",
    "defaut": 100000,
    "regle": "R383",
    "requis": false,
    "description": "seuil de vérification — TB-06 / TBML (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "transbordements_max",
    "type": "int",
    "defaut": 1,
    "regle": "R384",
    "requis": false,
    "description": "transbordements tolérés — TB-07 / TBML (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "duree_cycle_trade",
    "type": "int",
    "defaut": 180,
    "regle": "R385",
    "requis": false,
    "description": "fenêtre de détection — TB-08 / TBML (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "taux_incomplet_max",
    "type": "int",
    "defaut": 2,
    "regle": "R386",
    "requis": false,
    "description": "taux d'incomplétude toléré par correspondant — CB-03 / Correspondent Banking (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "fenetre_uturn",
    "type": "int",
    "defaut": 30,
    "regle": "R387",
    "requis": false,
    "description": "fenêtre d'appariement — CB-04 / Correspondent Banking (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "indicateurs_pta",
    "type": "json",
    "defaut": null,
    "regle": "R388",
    "requis": true,
    "description": "indicateurs d'usage direct — CB-05 / Correspondent Banking (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "derive_max",
    "type": "int",
    "defaut": 20,
    "regle": "R389",
    "requis": false,
    "description": "dérive tolérée vs profil — CB-06 / Correspondent Banking (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "registres_supervision",
    "type": "json",
    "defaut": null,
    "regle": "R390",
    "requis": true,
    "description": "registres de superviseurs consultés — CB-07 / Correspondent Banking (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "periode_revue_rma",
    "type": "int",
    "defaut": 12,
    "regle": "R391",
    "requis": false,
    "description": "période de revue — CB-08 / Correspondent Banking (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "frequence_screen_respondants",
    "type": "int",
    "defaut": 30,
    "regle": "R392",
    "requis": false,
    "description": "fréquence — CB-09 / Correspondent Banking (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "plafonds_sectoriels",
    "type": "json",
    "defaut": null,
    "regle": "R393",
    "requis": true,
    "description": "référentiel plafonds/embargos — PF-01 / Prolifération (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "age_entite_min",
    "type": "int",
    "defaut": 24,
    "regle": "R394",
    "requis": false,
    "description": "âge minimal sans surrisque — PF-02 / Prolifération (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "categories_luxe",
    "type": "json",
    "defaut": null,
    "regle": "R395",
    "requis": true,
    "description": "catégories surveillées — PF-03 / Prolifération (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "ecart_marche_max",
    "type": "int",
    "defaut": 25,
    "regle": "R396",
    "requis": false,
    "description": "écart au marché toléré — IA-01 / Immobilier & Art (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "delai_revente_min",
    "type": "int",
    "defaut": 36,
    "regle": "R397",
    "requis": false,
    "description": "revente considérée rapide si < — IA-02 / Immobilier & Art (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "seuil_biens_valeur",
    "type": "int",
    "defaut": 200000,
    "regle": "R398",
    "requis": false,
    "description": "équivalent CHF / 180j — IA-03 / Immobilier & Art (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "zscore_seuil",
    "type": "string",
    "defaut": "3.5",
    "regle": "R399",
    "requis": false,
    "description": "z-score de déclenchement — AN-01 / Analytique 2G (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "sensibilite_rupture",
    "type": "json",
    "defaut": null,
    "regle": "R400",
    "requis": true,
    "description": "sensibilité du détecteur — AN-02 / Analytique 2G (paramètre tenant AML gap, registre R-Q).",
    "exemple": []
  },
  {
    "cle": "dimensions_ft",
    "type": "string",
    "defaut": "international,cash,HRJ,produit_risque",
    "regle": "R401",
    "requis": false,
    "description": "dimensions surveillées — AN-03 / Analytique 2G (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "materialite_ft",
    "type": "int",
    "defaut": 25000,
    "regle": "R401",
    "requis": false,
    "description": "matérialité minimale — AN-03 / Analytique 2G (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "dormance_segment",
    "type": "int",
    "defaut": 24,
    "regle": "R402",
    "requis": false,
    "description": "dormance du segment — AN-04 / Analytique 2G (paramètre tenant AML gap, registre R-Q)."
  },
  {
    "cle": "ecart_revenu_max",
    "type": "int",
    "defaut": 50,
    "regle": "R403",
    "requis": false,
    "description": "écart toléré vs déclaré — AN-05 / Analytique 2G (paramètre tenant AML gap, registre R-Q)."
  }
];
