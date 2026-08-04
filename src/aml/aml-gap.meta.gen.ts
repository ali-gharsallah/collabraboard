// GÉNÉRÉ par tools/aml-gap/gen_aml_gap.py — NE PAS ÉDITER À LA MAIN.
// Métadonnées des 64 scénarios AML gap (R340–R403) : niveau/blocking/signal/params/then.
// Consommé par src/aml/engine.ts (moteur R44) + src/aml/detectors.ts. `deferred` = bloc 61
// (Analytique 2G, R399–R403) : le moteur Nest refuse — détection dans le service CPSI Python.

export interface AmlGapMeta {
  scenarioId: string; ruleRef: string; bloc: number; niveau: number; blocking: boolean;
  signal: string; deferred: boolean; then: string; params: Record<string, string | number | boolean>;
}

export const AML_GAP_META: Record<string, AmlGapMeta> = {
  "SF-01": {
    "scenarioId": "SF-01",
    "ruleRef": "R340",
    "bloc": 50,
    "niveau": 2,
    "blocking": false,
    "signal": "PEP_COUNTERPARTY",
    "deferred": false,
    "then": "Signal PEP_COUNTERPARTY (Niveau 2) — alerte CO avec fiche de match, aucune contamination du statut client sans revue humaine (R44).",
    "params": {
      "seuil_match_pep_flux": 78,
      "listes_pep": "tenant"
    }
  },
  "SF-02": {
    "scenarioId": "SF-02",
    "ruleRef": "R341",
    "bloc": 50,
    "niveau": 2,
    "blocking": false,
    "signal": "ADVERSE_COUNTERPARTY",
    "deferred": false,
    "then": "Signal ADVERSE_COUNTERPARTY (Niveau 2) — alerte avec extrait sourcé et daté ; l'humain qualifie.",
    "params": {
      "rang_source_min": 2,
      "categories_am": "tenant"
    }
  },
  "SF-03": {
    "scenarioId": "SF-03",
    "ruleRef": "R342",
    "bloc": 50,
    "niveau": 2,
    "blocking": false,
    "signal": "SCREENING_DELTA",
    "deferred": false,
    "then": "Événement screening.delta → ouverture automatique d'un Change of Circumstances typé SCREENING_DELTA, routé au rôle Compliance (registre CoC).",
    "params": {
      "frequence_rescreen": 24,
      "scope_personnes_liees": true
    }
  },
  "SF-04": {
    "scenarioId": "SF-04",
    "ruleRef": "R343",
    "bloc": 50,
    "niveau": 2,
    "blocking": false,
    "signal": "INTERMEDIARY_HIT",
    "deferred": false,
    "then": "Signal INTERMEDIARY_HIT (Niveau 2) — routage alternatif proposé, décision humaine avant exécution.",
    "params": {
      "liste_bic_interne": "tenant"
    }
  },
  "SF-05": {
    "scenarioId": "SF-05",
    "ruleRef": "R344",
    "bloc": 50,
    "niveau": 1,
    "blocking": true,
    "signal": "GEO_SANCTION",
    "deferred": false,
    "then": "TRANSACTION BLOQUÉE (Niveau 1) — motif géographique explicite, dossier MROS préparé, décision humaine requise (R44).",
    "params": {
      "referentiel_geo_sanctions": "tenant"
    }
  },
  "SF-06": {
    "scenarioId": "SF-06",
    "ruleRef": "R345",
    "bloc": 50,
    "niveau": 2,
    "blocking": false,
    "signal": "MULTISCRIPT_HIT",
    "deferred": false,
    "then": "Le hit est détecté malgré l'écart de script — signal standard du canal concerné, variante gagnante tracée.",
    "params": {
      "scripts_actifs": "AR,CYR,ZH"
    }
  },
  "SF-07": {
    "scenarioId": "SF-07",
    "ruleRef": "R346",
    "bloc": 50,
    "niveau": 1,
    "blocking": true,
    "signal": "VESSEL_HIT",
    "deferred": false,
    "then": "TRANSACTION BLOQUÉE (Niveau 1) — gel, escalade sanctions, décision humaine requise.",
    "params": {
      "extraction_imo": true
    }
  },
  "QO-01": {
    "scenarioId": "QO-01",
    "ruleRef": "R347",
    "bloc": 51,
    "niveau": 2,
    "blocking": false,
    "signal": "INFO_REFUSAL",
    "deferred": false,
    "then": "Signal INFO_REFUSAL (Niveau 2) — tâche CO, blocage possible de l'apport après décision humaine, trace au registre art. 7.",
    "params": {
      "nb_relances_avant_signal": 2
    }
  },
  "QO-02": {
    "scenarioId": "QO-02",
    "ruleRef": "R348",
    "bloc": 51,
    "niveau": 2,
    "blocking": false,
    "signal": "TRANSIT_ACCOUNT",
    "deferred": false,
    "then": "Signal TRANSIT_ACCOUNT (Niveau 2) — cartographie des tiers jointe, revue du but de la relation.",
    "params": {
      "tiers_distincts_seuil": 6
    }
  },
  "QO-03": {
    "scenarioId": "QO-03",
    "ruleRef": "R349",
    "bloc": 51,
    "niveau": 2,
    "blocking": false,
    "signal": "NO_ECON_RATIONALE",
    "deferred": false,
    "then": "Signal NO_ECON_RATIONALE (Niveau 2) — investigation CO, réponse du client consignée.",
    "params": {
      "delai_reponse_client": 10
    }
  },
  "QO-04": {
    "scenarioId": "QO-04",
    "ruleRef": "R350",
    "bloc": 51,
    "niveau": 1,
    "blocking": false,
    "signal": "SHARED_ADDRESS",
    "deferred": false,
    "then": "Signal SHARED_ADDRESS (Niveau 1) — revue du caractère de société de domicile (CDB 20, form. K).",
    "params": {
      "clients_par_adresse_seuil": 5
    }
  },
  "QO-05": {
    "scenarioId": "QO-05",
    "ruleRef": "R351",
    "bloc": 51,
    "niveau": 2,
    "blocking": false,
    "signal": "GOVERNANCE_CHURN",
    "deferred": false,
    "then": "Signal GOVERNANCE_CHURN (Niveau 2) — revue de la maîtrise réelle du compte (ADE effectif).",
    "params": {
      "chgts_gouvernance_seuil": 3
    }
  },
  "GU-01": {
    "scenarioId": "GU-01",
    "ruleRef": "R352",
    "bloc": 52,
    "niveau": 2,
    "blocking": false,
    "signal": "GROUP_STRUCTURING",
    "deferred": false,
    "then": "Signal GROUP_STRUCTURING (Niveau 2) — vue consolidée jointe, chaque entité référencée.",
    "params": {
      "fenetre_agregation_ubo": 7,
      "seuil_agrege_ubo": 50000
    }
  },
  "GU-02": {
    "scenarioId": "GU-02",
    "ruleRef": "R353",
    "bloc": 52,
    "niveau": 2,
    "blocking": false,
    "signal": "GROUP_CIRCULAR",
    "deferred": false,
    "then": "Signal GROUP_CIRCULAR (Niveau 2) — demande de justification économique consolidée.",
    "params": {
      "duree_cycle_max": 30
    }
  },
  "GU-03": {
    "scenarioId": "GU-03",
    "ruleRef": "R354",
    "bloc": 52,
    "niveau": 2,
    "blocking": false,
    "signal": "GROUP_CASH_INTENSITY",
    "deferred": false,
    "then": "Signal GROUP_CASH_INTENSITY (Niveau 2) — ventilation par entité jointe.",
    "params": {
      "ratio_cash_groupe": 25
    }
  },
  "GU-04": {
    "scenarioId": "GU-04",
    "ruleRef": "R355",
    "bloc": 52,
    "niveau": 2,
    "blocking": false,
    "signal": "CROSS_PRODUCT_AGGREGATE",
    "deferred": false,
    "then": "Signal CROSS_PRODUCT_AGGREGATE (Niveau 2) — décomposition par produit jointe.",
    "params": {
      "seuil_cross_produits": 75000
    }
  },
  "IP-01": {
    "scenarioId": "IP-01",
    "ruleRef": "R356",
    "bloc": 53,
    "niveau": 2,
    "blocking": false,
    "signal": "LOMBARD_THIRD_PARTY",
    "deferred": false,
    "then": "Signal LOMBARD_THIRD_PARTY (Niveau 2) — fonds en attente de documentation SOF avant mainlevée du nantissement.",
    "params": {
      "delai_anticipe_min": 12
    }
  },
  "IP-02": {
    "scenarioId": "IP-02",
    "ruleRef": "R357",
    "bloc": 53,
    "niveau": 1,
    "blocking": false,
    "signal": "BACK_TO_BACK",
    "deferred": false,
    "then": "Signal BACK_TO_BACK (Niveau 1) — origine du dépôt à corroborer avant tout tirage, escalade EDD.",
    "params": {
      "perimetre_lien": "tenant"
    }
  },
  "IP-03": {
    "scenarioId": "IP-03",
    "ruleRef": "R358",
    "bloc": 53,
    "niveau": 2,
    "blocking": false,
    "signal": "WRAPPER_PREMIUM",
    "deferred": false,
    "then": "Signal WRAPPER_PREMIUM (Niveau 2) — corroboration SOW avant acceptation du contrat.",
    "params": {
      "ratio_prime_patrimoine": 60
    }
  },
  "IP-04": {
    "scenarioId": "IP-04",
    "ruleRef": "R359",
    "bloc": 53,
    "niveau": 2,
    "blocking": false,
    "signal": "EARLY_SURRENDER",
    "deferred": false,
    "then": "Signal EARLY_SURRENDER (Niveau 2) — investigation sur la finalité réelle du produit.",
    "params": {
      "delai_rachat_min": 24
    }
  },
  "IP-05": {
    "scenarioId": "IP-05",
    "ruleRef": "R360",
    "bloc": 53,
    "niveau": 2,
    "blocking": false,
    "signal": "BENEFICIARY_SWITCH",
    "deferred": false,
    "then": "Signal BENEFICIARY_SWITCH (Niveau 2) — justification requise, CoC ouvert.",
    "params": {
      "delai_chgt_benef": 24
    }
  },
  "IP-06": {
    "scenarioId": "IP-06",
    "ruleRef": "R361",
    "bloc": 53,
    "niveau": 2,
    "blocking": false,
    "signal": "VAULT_CASH_PATTERN",
    "deferred": false,
    "then": "Signal VAULT_CASH_PATTERN (Niveau 2) — entretien client et corroboration d'origine.",
    "params": {
      "fenetre_correlation": 48,
      "nb_correlations_seuil": 3
    }
  },
  "IP-07": {
    "scenarioId": "IP-07",
    "ruleRef": "R362",
    "bloc": 53,
    "niveau": 2,
    "blocking": false,
    "signal": "PHYSICAL_METALS",
    "deferred": false,
    "then": "Signal PHYSICAL_METALS (Niveau 2) — sortie physique documentée, destination tracée.",
    "params": {
      "seuil_metaux": 100000
    }
  },
  "CR-01": {
    "scenarioId": "CR-01",
    "ruleRef": "R363",
    "bloc": 54,
    "niveau": 1,
    "blocking": true,
    "signal": "TRAVEL_RULE_GAP",
    "deferred": false,
    "then": "TRANSFERT BLOQUÉ (Niveau 1) — jusqu'à réception des informations ou décision humaine documentée.",
    "params": {
      "vasp_conformes": "tenant"
    }
  },
  "CR-02": {
    "scenarioId": "CR-02",
    "ruleRef": "R364",
    "bloc": 54,
    "niveau": 1,
    "blocking": false,
    "signal": "MIXER_EXPOSURE",
    "deferred": false,
    "then": "Signal MIXER_EXPOSURE (Niveau 1) — fonds gelés en attente d'explication, EDD.",
    "params": {
      "seuil_exposition_mixer": 10,
      "hops_analyses": 2
    }
  },
  "CR-03": {
    "scenarioId": "CR-03",
    "ruleRef": "R365",
    "bloc": 54,
    "niveau": 1,
    "blocking": true,
    "signal": "ONCHAIN_SANCTION",
    "deferred": false,
    "then": "TRANSFERT BLOQUÉ (Niveau 1) — gel, dossier sanctions, MROS préparé.",
    "params": {
      "listes_adresses": "OFAC,SECO"
    }
  },
  "CR-04": {
    "scenarioId": "CR-04",
    "ruleRef": "R366",
    "bloc": 54,
    "niveau": 1,
    "blocking": false,
    "signal": "ILLICIT_CLUSTER",
    "deferred": false,
    "then": "Signal ILLICIT_CLUSTER (Niveau 1) — fonds en quarantaine, investigation.",
    "params": {
      "seuil_cluster_illicite": 5
    }
  },
  "CR-05": {
    "scenarioId": "CR-05",
    "ruleRef": "R367",
    "bloc": 54,
    "niveau": 1,
    "blocking": true,
    "signal": "UNHOSTED_NOPROOF",
    "deferred": false,
    "then": "SORTIE BLOQUÉE (Niveau 1) — jusqu'à preuve de contrôle (signature) enregistrée.",
    "params": {
      "methodes_preuve": "signature,satoshi_test",
      "validite_preuve": 12
    }
  },
  "CR-06": {
    "scenarioId": "CR-06",
    "ruleRef": "R368",
    "bloc": 54,
    "niveau": 2,
    "blocking": false,
    "signal": "RAMP_VELOCITY",
    "deferred": false,
    "then": "Signal RAMP_VELOCITY (Niveau 2) — revue du profil transactionnel crypto.",
    "params": {
      "cycles_ramp_seuil": 6
    }
  },
  "FT-01": {
    "scenarioId": "FT-01",
    "ruleRef": "R369",
    "bloc": 55,
    "niveau": 2,
    "blocking": false,
    "signal": "CFT_MICRO_PATTERN",
    "deferred": false,
    "then": "Signal CFT_MICRO_PATTERN (Niveau 2) — analyse dédiée CFT, jamais agrégé avec les seuils ML classiques.",
    "params": {
      "corridors_cft": "tenant",
      "freq_micro_seuil": 10,
      "montant_micro_max": 500
    }
  },
  "FT-02": {
    "scenarioId": "FT-02",
    "ruleRef": "R370",
    "bloc": 55,
    "niveau": 2,
    "blocking": false,
    "signal": "NPO_RISK",
    "deferred": false,
    "then": "Signal NPO_RISK (Niveau 2) — vérification de l'organisation et de la chaîne de distribution des fonds.",
    "params": {
      "registre_npo": "tenant"
    }
  },
  "FT-03": {
    "scenarioId": "FT-03",
    "ruleRef": "R371",
    "bloc": 55,
    "niveau": 2,
    "blocking": false,
    "signal": "PREPAID_FUNDING",
    "deferred": false,
    "then": "Signal PREPAID_FUNDING (Niveau 2) — gel du rechargement tiers après décision humaine.",
    "params": {
      "sources_rechargement_seuil": 3
    }
  },
  "FT-04": {
    "scenarioId": "FT-04",
    "ruleRef": "R372",
    "bloc": 55,
    "niveau": 2,
    "blocking": false,
    "signal": "TRAVEL_FLOW_MISMATCH",
    "deferred": false,
    "then": "Signal TRAVEL_FLOW_MISMATCH (Niveau 2) — entretien de clarification, trace CFT dédiée.",
    "params": {
      "fenetre_voyage": 14
    }
  },
  "FT-05": {
    "scenarioId": "FT-05",
    "ruleRef": "R373",
    "bloc": 55,
    "niveau": 1,
    "blocking": true,
    "signal": "CFT_LIST_HIT",
    "deferred": false,
    "then": "TRANSACTION BLOQUÉE (Niveau 1) — gel immédiat, MROS, escalade direction, décision humaine tracée.",
    "params": {
      "listes_cft": "tenant"
    }
  },
  "GV-01": {
    "scenarioId": "GV-01",
    "ruleRef": "R374",
    "bloc": 56,
    "niveau": 0,
    "blocking": false,
    "signal": "tuning.btl.campagne",
    "deferred": false,
    "then": "Événement tuning.btl.campagne — résultats consolidés : si des TP sont trouvés sous le seuil, proposition de baisse via l'Intelligence Studio (validation humaine, versionnée, réversible).",
    "params": {
      "taux_echantillon_btl": 2,
      "bande_btl": "80-100",
      "frequence_btl": 90
    }
  },
  "GV-02": {
    "scenarioId": "GV-02",
    "ruleRef": "R375",
    "bloc": 56,
    "niveau": 0,
    "blocking": false,
    "signal": "tuning.backtest.run",
    "deferred": false,
    "then": "Rapport de backtest versionné attaché à la version du scénario — rollback proposé si dégradation du rappel (décision humaine).",
    "params": {
      "fenetre_backtest": 90,
      "seuil_degradation": 0
    }
  },
  "GV-03": {
    "scenarioId": "GV-03",
    "ruleRef": "R376",
    "bloc": 56,
    "niveau": 1,
    "blocking": false,
    "signal": "DQ_DEGRADED",
    "deferred": false,
    "then": "Signal DQ_DEGRADED (Niveau 1, ops) — visible au dashboard Compliance, jamais silencieux (esprit dead-letters R39).",
    "params": {
      "completude_min": 98
    }
  },
  "GV-04": {
    "scenarioId": "GV-04",
    "ruleRef": "R377",
    "bloc": 56,
    "niveau": 0,
    "blocking": false,
    "signal": "tuning.calibrage.annuel",
    "deferred": false,
    "then": "Rapport de calibrage annuel généré, visé four-eyes, archivé GED — section dédiée du rapport Direction.",
    "params": {
      "matrice_couverture": "GAFI+OBA-FINMA"
    }
  },
  "TB-01": {
    "scenarioId": "TB-01",
    "ruleRef": "R378",
    "bloc": 57,
    "niveau": 2,
    "blocking": false,
    "signal": "OVER_INVOICING",
    "deferred": false,
    "then": "Signal OVER_INVOICING (Niveau 2) — analyse trade finance, justificatifs contractuels et incoterms demandés.",
    "params": {
      "ecart_prix_seuil": 15,
      "nb_factures_min": 3
    }
  },
  "TB-02": {
    "scenarioId": "TB-02",
    "ruleRef": "R379",
    "bloc": 57,
    "niveau": 2,
    "blocking": false,
    "signal": "MULTIPLE_INVOICING",
    "deferred": false,
    "then": "Signal MULTIPLE_INVOICING (Niveau 2) — documents originaux exigés, vérification auprès du transporteur.",
    "params": {
      "fenetre_dedup": 180
    }
  },
  "TB-03": {
    "scenarioId": "TB-03",
    "ruleRef": "R380",
    "bloc": 57,
    "niveau": 2,
    "blocking": false,
    "signal": "UNIT_PRICE_ANOMALY",
    "deferred": false,
    "then": "Signal UNIT_PRICE_ANOMALY (Niveau 2) — nature réelle des biens à corroborer.",
    "params": {
      "percentile_bas": 5,
      "percentile_haut": 95,
      "referentiel_hs": "tenant"
    }
  },
  "TB-04": {
    "scenarioId": "TB-04",
    "ruleRef": "R381",
    "bloc": 57,
    "niveau": 1,
    "blocking": false,
    "signal": "DUAL_USE",
    "deferred": false,
    "then": "Signal DUAL_USE (Niveau 1) — licence d'exportation SECO à exiger avant exécution, escalade sanctions.",
    "params": {
      "listes_controle": "SECO,EU"
    }
  },
  "TB-05": {
    "scenarioId": "TB-05",
    "ruleRef": "R382",
    "bloc": 57,
    "niveau": 2,
    "blocking": false,
    "signal": "BACK_TO_BACK_LC",
    "deferred": false,
    "then": "Signal BACK_TO_BACK_LC (Niveau 2) — substance de l'intermédiaire à démontrer.",
    "params": {
      "hrj_trade": "tenant"
    }
  },
  "TB-06": {
    "scenarioId": "TB-06",
    "ruleRef": "R383",
    "bloc": 57,
    "niveau": 1,
    "blocking": false,
    "signal": "PHANTOM_SHIPMENT",
    "deferred": false,
    "then": "Signal PHANTOM_SHIPMENT (Niveau 1) — fonds gelés en attente de preuve d'expédition, EDD.",
    "params": {
      "seuil_verif_tracking": 100000
    }
  },
  "TB-07": {
    "scenarioId": "TB-07",
    "ruleRef": "R384",
    "bloc": 57,
    "niveau": 2,
    "blocking": false,
    "signal": "ROUTE_ANOMALY",
    "deferred": false,
    "then": "Signal ROUTE_ANOMALY (Niveau 2) — justification logistique demandée.",
    "params": {
      "transbordements_max": 1
    }
  },
  "TB-08": {
    "scenarioId": "TB-08",
    "ruleRef": "R385",
    "bloc": 57,
    "niveau": 2,
    "blocking": false,
    "signal": "TRADE_CAROUSEL",
    "deferred": false,
    "then": "Signal TRADE_CAROUSEL (Niveau 2) — logique économique de la chaîne à démontrer.",
    "params": {
      "duree_cycle_trade": 180
    }
  },
  "CB-03": {
    "scenarioId": "CB-03",
    "ruleRef": "R386",
    "bloc": 58,
    "niveau": 1,
    "blocking": false,
    "signal": "WIRE_STRIPPING",
    "deferred": false,
    "then": "Signal WIRE_STRIPPING (Niveau 1) — messages retenus, demande de complément au correspondant, taux suivi par répondant.",
    "params": {
      "taux_incomplet_max": 2
    }
  },
  "CB-04": {
    "scenarioId": "CB-04",
    "ruleRef": "R387",
    "bloc": 58,
    "niveau": 2,
    "blocking": false,
    "signal": "U_TURN",
    "deferred": false,
    "then": "Signal U_TURN (Niveau 2) — finalité du détour à justifier, analyse sanctions.",
    "params": {
      "fenetre_uturn": 30
    }
  },
  "CB-05": {
    "scenarioId": "CB-05",
    "ruleRef": "R388",
    "bloc": 58,
    "niveau": 1,
    "blocking": false,
    "signal": "PAYABLE_THROUGH",
    "deferred": false,
    "then": "Signal PAYABLE_THROUGH (Niveau 1) — clarification contractuelle avec le répondant, restriction possible après décision.",
    "params": {
      "indicateurs_pta": "tenant"
    }
  },
  "CB-06": {
    "scenarioId": "CB-06",
    "ruleRef": "R389",
    "bloc": 58,
    "niveau": 2,
    "blocking": false,
    "signal": "RESPONDENT_PROFILE_DRIFT",
    "deferred": false,
    "then": "Signal RESPONDENT_PROFILE_DRIFT (Niveau 2) — mise à jour du questionnaire exigée, revue de la relation.",
    "params": {
      "derive_max": 20
    }
  },
  "CB-07": {
    "scenarioId": "CB-07",
    "ruleRef": "R390",
    "bloc": 58,
    "niveau": 1,
    "blocking": true,
    "signal": "",
    "deferred": false,
    "then": "TRANSACTION BLOQUÉE (Niveau 1) — interdiction légale, aucune dérogation, dossier sanctions/MROS selon le cas.",
    "params": {
      "registres_supervision": "tenant"
    }
  },
  "CB-08": {
    "scenarioId": "CB-08",
    "ruleRef": "R391",
    "bloc": 58,
    "niveau": 1,
    "blocking": false,
    "signal": "RMA_DORMANT",
    "deferred": false,
    "then": "Signal RMA_DORMANT (Niveau 1, ops) — proposition de résiliation, décision tracée.",
    "params": {
      "periode_revue_rma": 12
    }
  },
  "CB-09": {
    "scenarioId": "CB-09",
    "ruleRef": "R392",
    "bloc": 58,
    "niveau": 2,
    "blocking": false,
    "signal": "RESPONDENT_HIT",
    "deferred": false,
    "then": "Signal RESPONDENT_HIT (Niveau 2) — comité correspondance, suspension possible après décision humaine.",
    "params": {
      "frequence_screen_respondants": 30
    }
  },
  "PF-01": {
    "scenarioId": "PF-01",
    "ruleRef": "R393",
    "bloc": 59,
    "niveau": 1,
    "blocking": true,
    "signal": "",
    "deferred": false,
    "then": "TRANSACTION BLOQUÉE (Niveau 1) — violation sectorielle, escalade sanctions, décision humaine tracée.",
    "params": {
      "plafonds_sectoriels": "tenant"
    }
  },
  "PF-02": {
    "scenarioId": "PF-02",
    "ruleRef": "R394",
    "bloc": 59,
    "niveau": 1,
    "blocking": false,
    "signal": "PROLIF_CHAIN",
    "deferred": false,
    "then": "Signal PROLIF_CHAIN (Niveau 1) — identification du destinataire final exigée, escalade.",
    "params": {
      "age_entite_min": 24
    }
  },
  "PF-03": {
    "scenarioId": "PF-03",
    "ruleRef": "R395",
    "bloc": 59,
    "niveau": 2,
    "blocking": false,
    "signal": "LUXURY_EMBARGO",
    "deferred": false,
    "then": "Signal LUXURY_EMBARGO (Niveau 2) — destinataire final et usage à corroborer.",
    "params": {
      "categories_luxe": "tenant"
    }
  },
  "IA-01": {
    "scenarioId": "IA-01",
    "ruleRef": "R396",
    "bloc": 60,
    "niveau": 2,
    "blocking": false,
    "signal": "REAL_ESTATE_ANOMALY",
    "deferred": false,
    "then": "Signal REAL_ESTATE_ANOMALY (Niveau 2) — expertise indépendante et SOW exigées.",
    "params": {
      "ecart_marche_max": 25
    }
  },
  "IA-02": {
    "scenarioId": "IA-02",
    "ruleRef": "R397",
    "bloc": 60,
    "niveau": 2,
    "blocking": false,
    "signal": "ART_FREEPORT",
    "deferred": false,
    "then": "Signal ART_FREEPORT (Niveau 2) — provenance de l'œuvre et indépendance de l'acheteur à établir.",
    "params": {
      "delai_revente_min": 36
    }
  },
  "IA-03": {
    "scenarioId": "IA-03",
    "ruleRef": "R398",
    "bloc": 60,
    "niveau": 2,
    "blocking": false,
    "signal": "VALUE_VEHICLE",
    "deferred": false,
    "then": "Signal VALUE_VEHICLE (Niveau 2) — finalité patrimoniale vs circulation de valeur à clarifier.",
    "params": {
      "seuil_biens_valeur": 200000
    }
  },
  "AN-01": {
    "scenarioId": "AN-01",
    "ruleRef": "R399",
    "bloc": 61,
    "niveau": 2,
    "blocking": false,
    "signal": "PEER_DEVIATION",
    "deferred": true,
    "then": "Signal PEER_DEVIATION (Niveau 2) — explicable par construction : attribut, valeur, distribution du groupe joints (R44 : l'IA éclaire).",
    "params": {
      "zscore_seuil": 3.5
    }
  },
  "AN-02": {
    "scenarioId": "AN-02",
    "ruleRef": "R400",
    "bloc": 61,
    "niveau": 2,
    "blocking": false,
    "signal": "BEHAVIOR_SHIFT",
    "deferred": true,
    "then": "Signal BEHAVIOR_SHIFT (Niveau 2) — comparatif avant/après joint au signal.",
    "params": {
      "sensibilite_rupture": "tenant"
    }
  },
  "AN-03": {
    "scenarioId": "AN-03",
    "ruleRef": "R401",
    "bloc": 61,
    "niveau": 1,
    "blocking": false,
    "signal": "FIRST_TIME",
    "deferred": true,
    "then": "Signal FIRST_TIME (Niveau 1) — friction douce : revue rapide, pas de blocage (R39 : mesurer, pas coercer).",
    "params": {
      "dimensions_ft": "international,cash,HRJ,produit_risque",
      "materialite_ft": 25000
    }
  },
  "AN-04": {
    "scenarioId": "AN-04",
    "ruleRef": "R402",
    "bloc": 61,
    "niveau": 2,
    "blocking": false,
    "signal": "SEGMENT_REACTIVATION",
    "deferred": true,
    "then": "Signal SEGMENT_REACTIVATION (Niveau 2) — contexte de réactivation demandé.",
    "params": {
      "dormance_segment": 24
    }
  },
  "AN-05": {
    "scenarioId": "AN-05",
    "ruleRef": "R403",
    "bloc": 61,
    "niveau": 2,
    "blocking": false,
    "signal": "INCOME_MISMATCH",
    "deferred": true,
    "then": "Signal INCOME_MISMATCH (Niveau 2) — mise à jour KYC ou justification exigée (CoC).",
    "params": {
      "ecart_revenu_max": 50
    }
  }
};
