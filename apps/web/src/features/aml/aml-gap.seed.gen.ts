// GÉNÉRÉ par tools/aml-gap/gen_aml_gap.py — NE PAS ÉDITER À LA MAIN.
// Source de vérité de la vague AML Gap Wave 1 (R340–R377, blocs 50–56). Toute évolution
// d'une règle passe par le générateur ; le test de fraîcheur (test_gen_aml_gap.py) rougit
// si ce fichier dérive. Consommé par aml-gap.service.ts et aml-gap.wiring.spec.ts.

export interface AmlGapScenarioSeed {
  code: string; ruleRef: string; bloc: number; blocTitre: string; famille: string;
  titre: string; desc: string; niveau: number | null; kind: string; blocking: boolean;
  signal: string; params: { key: string; label: string; default: string | number | boolean }[];
  gherkin: { given: string; when: string; then: string };
}
export interface AmlGapGtSeed {
  caseId: string; scenarioId: string; ruleRef: string; famille: string; label: 'TP' | 'FP';
  clientId: string; narrative: string; ecartement?: string; placeholder?: boolean;
}

export const AML_GAP_SCENARIOS: AmlGapScenarioSeed[] = [
  {
    "code": "SF-01",
    "ruleRef": "R340",
    "bloc": 50,
    "blocTitre": "Screening en flux",
    "famille": "SF",
    "titre": "Contrepartie PEP en flux",
    "desc": "Screening PEP de la contrepartie de chaque transaction entrante/sortante, pas seulement du client à l'onboarding.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "PEP_COUNTERPARTY",
    "params": [
      {
        "key": "seuil_match_pep_flux",
        "label": "Score de similarité minimal",
        "default": 78
      },
      {
        "key": "listes_pep",
        "label": "Fournisseurs de listes PEP actives",
        "default": "tenant"
      }
    ],
    "gherkin": {
      "given": "Un virement entrant de CHF 180k provient d'une contrepartie non cliente matchant une liste PEP (ministre en fonction, pays tiers).",
      "when": "Le screening en flux (nom + pays + date de naissance si dispo) matche la contrepartie avec un score >= seuil tenant.",
      "then": "Signal PEP_COUNTERPARTY (Niveau 2) — alerte CO avec fiche de match, aucune contamination du statut client sans revue humaine (R44)."
    }
  },
  {
    "code": "SF-02",
    "ruleRef": "R341",
    "bloc": 50,
    "blocTitre": "Screening en flux",
    "famille": "SF",
    "titre": "Adverse media sur contrepartie",
    "desc": "Presse négative (blanchiment, fraude, corruption) sur la contrepartie d'une transaction au moment du flux.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "ADVERSE_COUNTERPARTY",
    "params": [
      {
        "key": "rang_source_min",
        "label": "Rang minimal de fiabilité de la source",
        "default": 2
      },
      {
        "key": "categories_am",
        "label": "Catégories retenues (ML, fraude, corruption, TF)",
        "default": "tenant"
      }
    ],
    "gherkin": {
      "given": "Une sortie de CHF 60k vise une société citée la veille dans une enquête pour corruption (source de rang 1).",
      "when": "Le screening adverse media en flux matche la contrepartie avec une catégorie AML-pertinente et une source pondérée >= seuil.",
      "then": "Signal ADVERSE_COUNTERPARTY (Niveau 2) — alerte avec extrait sourcé et daté ; l'humain qualifie."
    }
  },
  {
    "code": "SF-03",
    "ruleRef": "R342",
    "bloc": 50,
    "blocTitre": "Screening en flux",
    "famille": "SF",
    "titre": "Re-screening périodique (perpetual)",
    "desc": "Re-screening automatique périodique de tout le stock clients + personnes liées (sanctions/PEP/adverse), différentiel uniquement.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "SCREENING_DELTA",
    "params": [
      {
        "key": "frequence_rescreen",
        "label": "Fréquence du re-screening du stock (heures)",
        "default": 24
      },
      {
        "key": "scope_personnes_liees",
        "label": "Inclure les personnes liées",
        "default": true
      }
    ],
    "gherkin": {
      "given": "Le batch nocturne re-screene 5'000 clients ; un client existant apparaît nouvellement sur une liste PEP suite à une nomination.",
      "when": "Le différentiel (nouveau hit vs dernier run) est détecté et rattaché au dossier.",
      "then": "Événement screening.delta → ouverture automatique d'un Change of Circumstances typé SCREENING_DELTA, routé au rôle Compliance (registre CoC)."
    }
  },
  {
    "code": "SF-04",
    "ruleRef": "R343",
    "bloc": 50,
    "blocTitre": "Screening en flux",
    "famille": "SF",
    "titre": "Banques intermédiaires (BIC)",
    "desc": "Screening des BIC de la chaîne de paiement (champ 56/57), pas seulement des parties finales.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "INTERMEDIARY_HIT",
    "params": [
      {
        "key": "liste_bic_interne",
        "label": "Liste interne de banques surveillées",
        "default": "tenant"
      }
    ],
    "gherkin": {
      "given": "Un MT103 transite par une banque intermédiaire dont la maison mère est sous sanctions sectorielles.",
      "when": "Chaque BIC de la chaîne est screené contre les listes sanctions + liste interne banques à risque.",
      "then": "Signal INTERMEDIARY_HIT (Niveau 2) — routage alternatif proposé, décision humaine avant exécution."
    }
  },
  {
    "code": "SF-05",
    "ruleRef": "R344",
    "bloc": 50,
    "blocTitre": "Screening en flux",
    "famille": "SF",
    "titre": "Adresse / localisation sanctionnée",
    "desc": "Sanctions par localisation : adresses et villes de régions sous embargo (Crimée, régions occupées), au-delà du seul nom.",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "GEO_SANCTION",
    "params": [
      {
        "key": "referentiel_geo_sanctions",
        "label": "Référentiel des zones sanctionnées",
        "default": "tenant"
      }
    ],
    "gherkin": {
      "given": "Un virement sortant indique une adresse bénéficiaire à Sébastopol.",
      "when": "Le parsing d'adresse (ville, région, code postal) matche le référentiel géographique sanctionné.",
      "then": "TRANSACTION BLOQUÉE (Niveau 1) — motif géographique explicite, dossier MROS préparé, décision humaine requise (R44)."
    }
  },
  {
    "code": "SF-06",
    "ruleRef": "R345",
    "bloc": 50,
    "blocTitre": "Screening en flux",
    "famille": "SF",
    "titre": "Translittération multi-scripts",
    "desc": "Matching étendu arabe/cyrillique/chinois : variantes de translittération normalisées avant screening (le moteur IDF+trigram est latin-centrique).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "MULTISCRIPT_HIT",
    "params": [
      {
        "key": "scripts_actifs",
        "label": "Scripts normalisés",
        "default": "AR,CYR,ZH"
      }
    ],
    "gherkin": {
      "given": "Un ordonnateur « Мухаммад Аль-Рашид » (cyrillique) correspond à un profil sanctionné translittéré « Muhammad Al-Rashid ».",
      "when": "La normalisation multi-scripts (ICU + tables de translittération) produit les variantes avant le matching baseline.",
      "then": "Le hit est détecté malgré l'écart de script — signal standard du canal concerné, variante gagnante tracée."
    }
  },
  {
    "code": "SF-07",
    "ruleRef": "R346",
    "bloc": 50,
    "blocTitre": "Screening en flux",
    "famille": "SF",
    "titre": "Navires & IMO",
    "desc": "Screening des navires (nom, numéro IMO, pavillon) sur les paiements liés au négoce et au shipping.",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "VESSEL_HIT",
    "params": [
      {
        "key": "extraction_imo",
        "label": "Extraction IMO des champs libres",
        "default": true
      }
    ],
    "gherkin": {
      "given": "Un crédit documentaire référence un navire dont l'IMO figure sur la liste OFAC (shadow fleet).",
      "when": "Extraction du nom/IMO depuis les champs libres et les documents, screening dédié navires.",
      "then": "TRANSACTION BLOQUÉE (Niveau 1) — gel, escalade sanctions, décision humaine requise."
    }
  },
  {
    "code": "QO-01",
    "ruleRef": "R347",
    "bloc": 51,
    "blocTitre": "Indices OBA-FINMA",
    "famille": "QO",
    "titre": "Refus de fournir des informations",
    "desc": "Le refus du client de fournir les informations usuelles (origine des fonds, justificatifs) devient un signal structuré, pas une note libre.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "INFO_REFUSAL",
    "params": [
      {
        "key": "nb_relances_avant_signal",
        "label": "Relances avant signal",
        "default": 2
      }
    ],
    "gherkin": {
      "given": "Le RM demande un justificatif d'origine pour un apport de CHF 500k ; le client refuse explicitement à deux reprises.",
      "when": "Le RM déclare le refus via le workflow dédié (motif, pièces demandées, dates) — événement kyc.refus_information.",
      "then": "Signal INFO_REFUSAL (Niveau 2) — tâche CO, blocage possible de l'apport après décision humaine, trace au registre art. 7."
    }
  },
  {
    "code": "QO-02",
    "ruleRef": "R348",
    "bloc": 51,
    "blocTitre": "Indices OBA-FINMA",
    "famille": "QO",
    "titre": "Compte de passage multi-titulaires",
    "desc": "Compte utilisé comme compte de passage par de nombreuses personnes distinctes (indice annexe OBA-FINMA), au-delà du seul critère temporel.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "TRANSIT_ACCOUNT",
    "params": [
      {
        "key": "tiers_distincts_seuil",
        "label": "Tiers distincts / 30j",
        "default": 6
      }
    ],
    "gherkin": {
      "given": "Un compte reçoit des fonds de 9 ordonnateurs distincts sans lien documenté en 30 jours, ressortis vers 6 bénéficiaires.",
      "when": "Comptage des tiers distincts entrée + sortie / fenêtre glissante, croisé avec les personnes liées du KYC.",
      "then": "Signal TRANSIT_ACCOUNT (Niveau 2) — cartographie des tiers jointe, revue du but de la relation."
    }
  },
  {
    "code": "QO-03",
    "ruleRef": "R349",
    "bloc": 51,
    "blocTitre": "Indices OBA-FINMA",
    "famille": "QO",
    "titre": "Opération sans justification économique",
    "desc": "Red flag déclaratif du conseiller : opération constatée sans justification économique apparente, tracée et routée (jamais silencieuse).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "NO_ECON_RATIONALE",
    "params": [
      {
        "key": "delai_reponse_client",
        "label": "Délai de réponse attendu (jours)",
        "default": 10
      }
    ],
    "gherkin": {
      "given": "Le RM constate un achat-revente de titres à perte immédiate entre comptes du même client, sans logique d'investissement.",
      "when": "Le RM soulève le red flag via le formulaire structuré (opération, constat, échange client) — événement rm.redflag.",
      "then": "Signal NO_ECON_RATIONALE (Niveau 2) — investigation CO, réponse du client consignée."
    }
  },
  {
    "code": "QO-04",
    "ruleRef": "R350",
    "bloc": 51,
    "blocTitre": "Indices OBA-FINMA",
    "famille": "QO",
    "titre": "Adresse partagée multi-clients",
    "desc": "Domiciliation c/o ou adresse identique partagée par de nombreux clients sans lien déclaré.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "SHARED_ADDRESS",
    "params": [
      {
        "key": "clients_par_adresse_seuil",
        "label": "Clients distincts par adresse",
        "default": 5
      }
    ],
    "gherkin": {
      "given": "8 clients sans lien familial ni sociétal déclaré partagent la même adresse de domiciliation c/o une fiduciaire.",
      "when": "Normalisation d'adresse + comptage des clients distincts par adresse, seuil tenant.",
      "then": "Signal SHARED_ADDRESS (Niveau 1) — revue du caractère de société de domicile (CDB 20, form. K)."
    }
  },
  {
    "code": "QO-05",
    "ruleRef": "R351",
    "bloc": 51,
    "blocTitre": "Indices OBA-FINMA",
    "famille": "QO",
    "titre": "Rotation des procurations / instructions",
    "desc": "Changements fréquents de procurations, signataires ou instructions permanentes sans justification.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "GOVERNANCE_CHURN",
    "params": [
      {
        "key": "chgts_gouvernance_seuil",
        "label": "Changements / 6 mois",
        "default": 3
      }
    ],
    "gherkin": {
      "given": "3 changements de fondé de pouvoir en 6 mois, dont un révoqué 2 semaines après nomination.",
      "when": "Comptage des événements de gouvernance du compte / fenêtre, croisé avec l'activité transactionnelle.",
      "then": "Signal GOVERNANCE_CHURN (Niveau 2) — revue de la maîtrise réelle du compte (ADE effectif)."
    }
  },
  {
    "code": "GU-01",
    "ruleRef": "R352",
    "bloc": 52,
    "blocTitre": "Vision groupe UBO",
    "famille": "GU",
    "titre": "Structuring cross-comptes du groupe",
    "desc": "Agrégation des flux sur le périmètre consolidé de l'UBO (tous comptes, toutes entités) : le fractionnement réparti sur plusieurs entités devient visible.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "GROUP_STRUCTURING",
    "params": [
      {
        "key": "fenetre_agregation_ubo",
        "label": "Fenêtre d'agrégation (jours)",
        "default": 7
      },
      {
        "key": "seuil_agrege_ubo",
        "label": "Seuil agrégé groupe (CHF)",
        "default": 50000
      }
    ],
    "gherkin": {
      "given": "Un UBO contrôle 4 entités ; chacune dépose CHF 18k la même semaine (72k agrégés, unitaire sous le seuil de 20k).",
      "when": "Le moteur agrège par ubo_group_id (graphe des personnes liées) sur la fenêtre glissante.",
      "then": "Signal GROUP_STRUCTURING (Niveau 2) — vue consolidée jointe, chaque entité référencée."
    }
  },
  {
    "code": "GU-02",
    "ruleRef": "R353",
    "bloc": 52,
    "blocTitre": "Vision groupe UBO",
    "famille": "GU",
    "titre": "Flux circulaires intra-groupe",
    "desc": "Fonds circulant entre entités du même UBO sans substance (A→B→C→A intra-périmètre).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "GROUP_CIRCULAR",
    "params": [
      {
        "key": "duree_cycle_max",
        "label": "Durée max du cycle détecté (jours)",
        "default": 30
      }
    ],
    "gherkin": {
      "given": "CHF 300k font le tour de 3 entités du même UBO en 12 jours et reviennent au point de départ.",
      "when": "Détection de cycle sur le graphe restreint au périmètre UBO.",
      "then": "Signal GROUP_CIRCULAR (Niveau 2) — demande de justification économique consolidée."
    }
  },
  {
    "code": "GU-03",
    "ruleRef": "R354",
    "bloc": 52,
    "blocTitre": "Vision groupe UBO",
    "famille": "GU",
    "titre": "Cash consolidé du périmètre",
    "desc": "Intensité cash mesurée au niveau du périmètre UBO : chaque entité reste sous les radars, le groupe non.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "GROUP_CASH_INTENSITY",
    "params": [
      {
        "key": "ratio_cash_groupe",
        "label": "Ratio cash consolidé max (%)",
        "default": 25
      }
    ],
    "gherkin": {
      "given": "5 entités du même UBO déposent chacune ~CHF 9k d'espèces par mois (45k/mois consolidés).",
      "when": "Ratio cash consolidé / volume consolidé du groupe, seuils par groupe CPSI.",
      "then": "Signal GROUP_CASH_INTENSITY (Niveau 2) — ventilation par entité jointe."
    }
  },
  {
    "code": "GU-04",
    "ruleRef": "R355",
    "bloc": 52,
    "blocTitre": "Vision groupe UBO",
    "famille": "GU",
    "titre": "Seuils agrégés cross-produits",
    "desc": "Agrégation cash + titres + FX + crédit : un pattern réparti entre produits (dépôt cash, achat titres FOP, tirage lombard) est détecté globalement.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "CROSS_PRODUCT_AGGREGATE",
    "params": [
      {
        "key": "seuil_cross_produits",
        "label": "Seuil agrégé équivalent (CHF)",
        "default": 75000
      }
    ],
    "gherkin": {
      "given": "Dépôt cash 15k + transfert in-specie 40k + tirage lombard 30k la même semaine, aucun produit ne franchit seul son seuil.",
      "when": "Normalisation en équivalent CHF et agrégation cross-produits par client et par groupe UBO.",
      "then": "Signal CROSS_PRODUCT_AGGREGATE (Niveau 2) — décomposition par produit jointe."
    }
  },
  {
    "code": "IP-01",
    "ruleRef": "R356",
    "bloc": 53,
    "blocTitre": "Instruments PB",
    "famille": "IP",
    "titre": "Lombard — remboursement par tiers",
    "desc": "Crédit lombard remboursé par anticipation par un tiers sans lien documenté avec l'emprunteur.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "LOMBARD_THIRD_PARTY",
    "params": [
      {
        "key": "delai_anticipe_min",
        "label": "Remboursement considéré anticipé si < (mois)",
        "default": 12
      }
    ],
    "gherkin": {
      "given": "Un lombard de CHF 800k est soldé 4 mois après tirage par un virement d'une société tierce inconnue du dossier.",
      "when": "Croisement remboursement anticipé × identité de l'ordonnateur × personnes liées du KYC.",
      "then": "Signal LOMBARD_THIRD_PARTY (Niveau 2) — fonds en attente de documentation SOF avant mainlevée du nantissement."
    }
  },
  {
    "code": "IP-02",
    "ruleRef": "R357",
    "bloc": 53,
    "blocTitre": "Instruments PB",
    "famille": "IP",
    "titre": "Back-to-back loan",
    "desc": "Dépôt (souvent offshore) nantissant un prêt accordé à une entité liée : séparation artificielle de l'origine des fonds.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "BACK_TO_BACK",
    "params": [
      {
        "key": "perimetre_lien",
        "label": "Liens retenus (UBO, famille, signataires)",
        "default": "tenant"
      }
    ],
    "gherkin": {
      "given": "Un dépôt de CHF 2M d'une entité des Caïmans garantit un prêt de 1.8M à une société suisse du même UBO.",
      "when": "Détection nantissement × prêt dont déposant et emprunteur partagent le périmètre UBO ou des liens déclarés/détectés.",
      "then": "Signal BACK_TO_BACK (Niveau 1) — origine du dépôt à corroborer avant tout tirage, escalade EDD."
    }
  },
  {
    "code": "IP-03",
    "ruleRef": "R358",
    "bloc": 53,
    "blocTitre": "Instruments PB",
    "famille": "IP",
    "titre": "Wrapper assurance — prime hors profil",
    "desc": "Souscription d'assurance-vie à prime unique élevée, incohérente avec le patrimoine et les revenus déclarés.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "WRAPPER_PREMIUM",
    "params": [
      {
        "key": "ratio_prime_patrimoine",
        "label": "Ratio prime/patrimoine max (%)",
        "default": 60
      }
    ],
    "gherkin": {
      "given": "Prime unique de CHF 1.5M pour un client au patrimoine déclaré de 900k.",
      "when": "Ratio prime / patrimoine déclaré + origine de la prime (compte tiers ?).",
      "then": "Signal WRAPPER_PREMIUM (Niveau 2) — corroboration SOW avant acceptation du contrat."
    }
  },
  {
    "code": "IP-04",
    "ruleRef": "R359",
    "bloc": 53,
    "blocTitre": "Instruments PB",
    "famille": "IP",
    "titre": "Wrapper assurance — rachat précoce",
    "desc": "Rachat de la police peu après souscription, pénalités acceptées sans discussion (le coût du blanchiment est assumé).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "EARLY_SURRENDER",
    "params": [
      {
        "key": "delai_rachat_min",
        "label": "Rachat considéré précoce si < (mois)",
        "default": 24
      }
    ],
    "gherkin": {
      "given": "Rachat total à 7 mois d'une police à prime unique, pénalité de 4% acceptée sans négociation.",
      "when": "Délai souscription→rachat < seuil + acceptation de pénalité + bénéficiaire du rachat ≠ souscripteur.",
      "then": "Signal EARLY_SURRENDER (Niveau 2) — investigation sur la finalité réelle du produit."
    }
  },
  {
    "code": "IP-05",
    "ruleRef": "R360",
    "bloc": 53,
    "blocTitre": "Instruments PB",
    "famille": "IP",
    "titre": "Changement de bénéficiaire post-souscription",
    "desc": "Modification du bénéficiaire de la police peu après souscription, vers un tiers sans lien.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "BENEFICIARY_SWITCH",
    "params": [
      {
        "key": "delai_chgt_benef",
        "label": "Fenêtre de surveillance post-souscription (mois)",
        "default": 24
      }
    ],
    "gherkin": {
      "given": "Le bénéficiaire passe du conjoint à une société étrangère 3 mois après souscription.",
      "when": "Événement de changement de bénéficiaire × délai × nature du nouveau bénéficiaire.",
      "then": "Signal BENEFICIARY_SWITCH (Niveau 2) — justification requise, CoC ouvert."
    }
  },
  {
    "code": "IP-06",
    "ruleRef": "R361",
    "bloc": 53,
    "blocTitre": "Instruments PB",
    "famille": "IP",
    "titre": "Coffres — corrélation cash",
    "desc": "Accès au coffre-fort corrélés temporellement à des dépôts ou retraits d'espèces.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "VAULT_CASH_PATTERN",
    "params": [
      {
        "key": "fenetre_correlation",
        "label": "Corrélation accès↔cash (heures)",
        "default": 48
      },
      {
        "key": "nb_correlations_seuil",
        "label": "Corrélations / 90j",
        "default": 3
      }
    ],
    "gherkin": {
      "given": "6 accès au coffre en 2 mois, chacun suivi sous 24h d'un dépôt espèces de 15-19k.",
      "when": "Corrélation temporelle accès coffre × mouvements cash / fenêtre.",
      "then": "Signal VAULT_CASH_PATTERN (Niveau 2) — entretien client et corroboration d'origine."
    }
  },
  {
    "code": "IP-07",
    "ruleRef": "R362",
    "bloc": 53,
    "blocTitre": "Instruments PB",
    "famille": "IP",
    "titre": "Métaux précieux physiques",
    "desc": "Achats/ventes/livraisons de métaux physiques hors profil déclaré (OBA négoce OR).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "PHYSICAL_METALS",
    "params": [
      {
        "key": "seuil_metaux",
        "label": "Équivalent CHF / 90j",
        "default": 100000
      }
    ],
    "gherkin": {
      "given": "Achat de 12 kg d'or physique avec livraison hors banque, client sans profil métaux.",
      "when": "Volume métaux / profil déclaré + mode de livraison (garde vs sortie physique).",
      "then": "Signal PHYSICAL_METALS (Niveau 2) — sortie physique documentée, destination tracée."
    }
  },
  {
    "code": "CR-01",
    "ruleRef": "R363",
    "bloc": 54,
    "blocTitre": "Crypto / VASP",
    "famille": "CR",
    "titre": "Travel rule DLT",
    "desc": "Transferts DLT sans informations complètes d'ordonnateur/bénéficiaire (comm. FINMA 02/2019, GAFI R.16).",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "TRAVEL_RULE_GAP",
    "params": [
      {
        "key": "vasp_conformes",
        "label": "Registre des VASP conformes travel rule",
        "default": "tenant"
      }
    ],
    "gherkin": {
      "given": "Un transfert sortant de 0.8 BTC vise un VASP qui ne transmet pas les informations travel rule.",
      "when": "Contrôle de complétude des données travel rule avant exécution du transfert.",
      "then": "TRANSFERT BLOQUÉ (Niveau 1) — jusqu'à réception des informations ou décision humaine documentée."
    }
  },
  {
    "code": "CR-02",
    "ruleRef": "R364",
    "bloc": 54,
    "blocTitre": "Crypto / VASP",
    "famille": "CR",
    "titre": "Exposition mixer / tumbler",
    "desc": "Fonds entrants dont l'analyse on-chain révèle une exposition directe ou à 1 hop à un mixer.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "MIXER_EXPOSURE",
    "params": [
      {
        "key": "seuil_exposition_mixer",
        "label": "Exposition directe max (%)",
        "default": 10
      },
      {
        "key": "hops_analyses",
        "label": "Profondeur d'analyse (hops)",
        "default": 2
      }
    ],
    "gherkin": {
      "given": "Un dépôt de 2.1 BTC provient à 64% d'un mixer connu (analyse de provenance).",
      "when": "Score d'exposition mixer du fournisseur d'analytique on-chain >= seuil (paramètre tenant, intégration Chainalysis/Elliptic).",
      "then": "Signal MIXER_EXPOSURE (Niveau 1) — fonds gelés en attente d'explication, EDD."
    }
  },
  {
    "code": "CR-03",
    "ruleRef": "R365",
    "bloc": 54,
    "blocTitre": "Crypto / VASP",
    "famille": "CR",
    "titre": "Adresse sanctionnée on-chain",
    "desc": "Contrepartie on-chain figurant dans les adresses crypto de la liste SDN OFAC.",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "ONCHAIN_SANCTION",
    "params": [
      {
        "key": "listes_adresses",
        "label": "Listes d'adresses actives",
        "default": "OFAC,SECO"
      }
    ],
    "gherkin": {
      "given": "Une adresse de destination correspond à une adresse SDN (entité de ransomware listée).",
      "when": "Screening des adresses contre les listes crypto SDN/SECO à l'initiation.",
      "then": "TRANSFERT BLOQUÉ (Niveau 1) — gel, dossier sanctions, MROS préparé."
    }
  },
  {
    "code": "CR-04",
    "ruleRef": "R366",
    "bloc": 54,
    "blocTitre": "Crypto / VASP",
    "famille": "CR",
    "titre": "Cluster darknet / ransomware",
    "desc": "Exposition de provenance à des clusters darknet markets ou ransomware (hors listes formelles).",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "ILLICIT_CLUSTER",
    "params": [
      {
        "key": "seuil_cluster_illicite",
        "label": "Provenance illicite max (%)",
        "default": 5
      }
    ],
    "gherkin": {
      "given": "Provenance à 30% d'un cluster étiqueté darknet market par l'analytique on-chain.",
      "when": "Score de provenance par catégorie de cluster >= seuil.",
      "then": "Signal ILLICIT_CLUSTER (Niveau 1) — fonds en quarantaine, investigation."
    }
  },
  {
    "code": "CR-05",
    "ruleRef": "R367",
    "bloc": 54,
    "blocTitre": "Crypto / VASP",
    "famille": "CR",
    "titre": "Wallet auto-hébergé sans preuve",
    "desc": "Transferts vers/depuis un wallet auto-hébergé sans preuve de contrôle (satoshi test / signature de message).",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "UNHOSTED_NOPROOF",
    "params": [
      {
        "key": "methodes_preuve",
        "label": "Méthodes acceptées",
        "default": "signature,satoshi_test"
      },
      {
        "key": "validite_preuve",
        "label": "Validité de la preuve (mois)",
        "default": 12
      }
    ],
    "gherkin": {
      "given": "Le client demande une sortie de 50k CHF en ETH vers un wallet non custodial jamais vérifié.",
      "when": "Contrôle d'existence d'une preuve de contrôle valide pour l'adresse (registre des adresses vérifiées).",
      "then": "SORTIE BLOQUÉE (Niveau 1) — jusqu'à preuve de contrôle (signature) enregistrée."
    }
  },
  {
    "code": "CR-06",
    "ruleRef": "R368",
    "bloc": 54,
    "blocTitre": "Crypto / VASP",
    "famille": "CR",
    "titre": "On/off-ramp incohérent au profil",
    "desc": "Fréquence et volumes de conversion fiat↔crypto incohérents avec le profil d'investisseur déclaré.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "RAMP_VELOCITY",
    "params": [
      {
        "key": "cycles_ramp_seuil",
        "label": "Cycles / 30j",
        "default": 6
      }
    ],
    "gherkin": {
      "given": "Un client « investisseur long terme » convertit fiat→crypto→fiat 14 fois en un mois.",
      "when": "Compteur de cycles on/off-ramp / 30j vs profil déclaré (au-delà du simple seuil CHF de l'ancienne règle AML-11).",
      "then": "Signal RAMP_VELOCITY (Niveau 2) — revue du profil transactionnel crypto."
    }
  },
  {
    "code": "FT-01",
    "ruleRef": "R369",
    "bloc": 55,
    "blocTitre": "CFT",
    "famille": "FT",
    "titre": "Micro-transactions vers corridors sensibles",
    "desc": "Petits montants à haute fréquence vers des corridors géographiques sensibles (le CFT ne ressemble pas au blanchiment : montants faibles).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "CFT_MICRO_PATTERN",
    "params": [
      {
        "key": "corridors_cft",
        "label": "Liste corridors CFT",
        "default": "tenant"
      },
      {
        "key": "freq_micro_seuil",
        "label": "Transferts / 60j",
        "default": 10
      },
      {
        "key": "montant_micro_max",
        "label": "Montant unitaire max (CHF)",
        "default": 500
      }
    ],
    "gherkin": {
      "given": "23 transferts de CHF 150-400 en 60 jours vers 3 pays limitrophes d'une zone de conflit.",
      "when": "Fréquence × faible montant unitaire × corridor sensible (liste tenant distincte des HRJ blanchiment).",
      "then": "Signal CFT_MICRO_PATTERN (Niveau 2) — analyse dédiée CFT, jamais agrégé avec les seuils ML classiques."
    }
  },
  {
    "code": "FT-02",
    "ruleRef": "R370",
    "bloc": 55,
    "blocTitre": "CFT",
    "famille": "FT",
    "titre": "Collectes / ONG à risque",
    "desc": "Dons et collectes atypiques vers des organisations à but non lucratif à risque (GAFI R.8), crowdfunding non tracé.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "NPO_RISK",
    "params": [
      {
        "key": "registre_npo",
        "label": "Référentiel NPO surveillées",
        "default": "tenant"
      }
    ],
    "gherkin": {
      "given": "Des dons partent vers une association récemment créée, sans agrément, active dans une zone à risque.",
      "when": "Croisement bénéficiaire ONG × registre des NPO à risque × ancienneté/agrément.",
      "then": "Signal NPO_RISK (Niveau 2) — vérification de l'organisation et de la chaîne de distribution des fonds."
    }
  },
  {
    "code": "FT-03",
    "ruleRef": "R371",
    "bloc": 55,
    "blocTitre": "CFT",
    "famille": "FT",
    "titre": "Cartes prépayées multi-sources",
    "desc": "Rechargements de cartes prépayées depuis des sources multiples, retraits en zone frontalière ou à l'étranger.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "PREPAID_FUNDING",
    "params": [
      {
        "key": "sources_rechargement_seuil",
        "label": "Sources distinctes / 90j",
        "default": 3
      }
    ],
    "gherkin": {
      "given": "Une carte est rechargée par 5 personnes différentes puis vidée en retraits ATM dans un pays frontalier d'une zone de conflit.",
      "when": "Nombre de sources de rechargement distinctes + géographie des retraits.",
      "then": "Signal PREPAID_FUNDING (Niveau 2) — gel du rechargement tiers après décision humaine."
    }
  },
  {
    "code": "FT-04",
    "ruleRef": "R372",
    "bloc": 55,
    "blocTitre": "CFT",
    "famille": "FT",
    "titre": "Cohérence voyages ↔ flux",
    "desc": "Croisement des Business Trips / voyages connus du client avec des flux vers zones de conflit (le module Trip existe côté RM ; le croisement CFT n'existe pas).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "TRAVEL_FLOW_MISMATCH",
    "params": [
      {
        "key": "fenetre_voyage",
        "label": "Fenêtre avant/après voyage (jours)",
        "default": 14
      }
    ],
    "gherkin": {
      "given": "Un client retire du cash inhabituel juste avant un voyage déclaré vers un pays frontalier d'une zone de conflit.",
      "when": "Corrélation temporelle voyage déclaré/détecté × retraits cash atypiques × destination sensible.",
      "then": "Signal TRAVEL_FLOW_MISMATCH (Niveau 2) — entretien de clarification, trace CFT dédiée."
    }
  },
  {
    "code": "FT-05",
    "ruleRef": "R373",
    "bloc": 55,
    "blocTitre": "CFT",
    "famille": "FT",
    "titre": "Listes terroristes dédiées",
    "desc": "Screening distinct contre les ordonnances/listes terroristes (séparé des sanctions économiques : gouvernance, escalade et déclaration diffèrent).",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "CFT_LIST_HIT",
    "params": [
      {
        "key": "listes_cft",
        "label": "Listes CFT actives",
        "default": "tenant"
      }
    ],
    "gherkin": {
      "given": "Une contrepartie matche une liste d'une ordonnance fédérale anti-terrorisme (hors listes SECO économiques).",
      "when": "Canal de screening dédié listes CFT, avec circuit d'escalade propre.",
      "then": "TRANSACTION BLOQUÉE (Niveau 1) — gel immédiat, MROS, escalade direction, décision humaine tracée."
    }
  },
  {
    "code": "GV-01",
    "ruleRef": "R374",
    "bloc": 56,
    "blocTitre": "Gouvernance du dispositif",
    "famille": "GV",
    "titre": "Below-the-line sampling",
    "desc": "Campagne périodique d'échantillonnage sous les seuils : des transactions juste en-dessous des seuils actifs sont revues pour valider le calibrage.",
    "niveau": null,
    "kind": "campagne",
    "blocking": false,
    "signal": "tuning.btl.campagne",
    "params": [
      {
        "key": "taux_echantillon_btl",
        "label": "Taux d'échantillonnage (%)",
        "default": 2
      },
      {
        "key": "bande_btl",
        "label": "Bande sous le seuil (%)",
        "default": "80-100"
      },
      {
        "key": "frequence_btl",
        "label": "Fréquence de campagne (jours)",
        "default": 90
      }
    ],
    "gherkin": {
      "given": "Le trimestre écoulé compte 1'240 transactions entre 80% et 100% du seuil du scénario structuring.",
      "when": "La campagne BTL tire un échantillon stratifié (paramètre tenant) et le route en revue Compliance.",
      "then": "Événement tuning.btl.campagne — résultats consolidés : si des TP sont trouvés sous le seuil, proposition de baisse via l'Intelligence Studio (validation humaine, versionnée, réversible)."
    }
  },
  {
    "code": "GV-02",
    "ruleRef": "R375",
    "bloc": 56,
    "blocTitre": "Gouvernance du dispositif",
    "famille": "GV",
    "titre": "Backtesting par version",
    "desc": "Backtesting formel de chaque version de scénario : TP/FP historisés par version, comparaison avant/après tout changement de seuil.",
    "niveau": null,
    "kind": "campagne",
    "blocking": false,
    "signal": "tuning.backtest.run",
    "params": [
      {
        "key": "fenetre_backtest",
        "label": "Fenêtre de rejeu (jours)",
        "default": 90
      },
      {
        "key": "seuil_degradation",
        "label": "Perte de rappel max tolérée (TP manqués)",
        "default": 0
      }
    ],
    "gherkin": {
      "given": "Le seuil du scénario velocity est passé de 4× à 5× il y a 90 jours (v1.2).",
      "when": "Le backtest rejoue la fenêtre sur les deux versions et compare TP, FP, alertes manquées.",
      "then": "Rapport de backtest versionné attaché à la version du scénario — rollback proposé si dégradation du rappel (décision humaine)."
    }
  },
  {
    "code": "GV-03",
    "ruleRef": "R376",
    "bloc": 56,
    "blocTitre": "Gouvernance du dispositif",
    "famille": "GV",
    "titre": "Data quality pré-conditions",
    "desc": "Contrôles de qualité de données amont comme pré-condition des scénarios : un scénario aveugle (champs SWIFT incomplets, devises manquantes) est un faux négatif silencieux.",
    "niveau": 1,
    "kind": "ops",
    "blocking": false,
    "signal": "DQ_DEGRADED",
    "params": [
      {
        "key": "completude_min",
        "label": "Complétude minimale des champs critiques (%)",
        "default": 98
      }
    ],
    "gherkin": {
      "given": "8% des MT103 du jour arrivent sans champ ordonnateur exploitable.",
      "when": "Le contrôle DQ mesure la complétude des champs critiques par flux ; sous le seuil, les scénarios dépendants sont marqués « dégradés ».",
      "then": "Signal DQ_DEGRADED (Niveau 1, ops) — visible au dashboard Compliance, jamais silencieux (esprit dead-letters R39)."
    }
  },
  {
    "code": "GV-04",
    "ruleRef": "R377",
    "bloc": 56,
    "blocTitre": "Gouvernance du dispositif",
    "famille": "GV",
    "titre": "Revue annuelle de calibrage",
    "desc": "Revue annuelle documentée du dispositif : couverture typologique, performance par scénario, décisions de calibrage — annexée au rapport LBA Direction (art. 25a OBA-FINMA).",
    "niveau": null,
    "kind": "campagne",
    "blocking": false,
    "signal": "tuning.calibrage.annuel",
    "params": [
      {
        "key": "matrice_couverture",
        "label": "Référentiel de typologies de la matrice",
        "default": "GAFI+OBA-FINMA"
      }
    ],
    "gherkin": {
      "given": "L'exercice se clôt ; chaque scénario a un historique TP/FP et des versions.",
      "when": "La revue consolide couverture (matrice typologies GAFI × scénarios), performance et écarts.",
      "then": "Rapport de calibrage annuel généré, visé four-eyes, archivé GED — section dédiée du rapport Direction."
    }
  },
  {
    "code": "TB-01",
    "ruleRef": "R378",
    "bloc": 57,
    "blocTitre": "TBML",
    "famille": "TB",
    "titre": "Surfacturation (over-invoicing)",
    "desc": "Factures systématiquement payées au-dessus de la valeur de marché des biens — miroir sortant de R201 : la survaleur transfère du blanchiment sous couvert commercial.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "OVER_INVOICING",
    "params": [
      {
        "key": "ecart_prix_seuil",
        "label": "écart au prix de référence",
        "default": 15
      },
      {
        "key": "nb_factures_min",
        "label": "factures concernées / 90j",
        "default": 3
      }
    ],
    "gherkin": {
      "given": "8 paiements de factures d'import présentent un écart constant de +22% vs le prix de référence des biens (code HS).",
      "when": "Écart récurrent ≥ seuil entre montant payé et valeur de référence, sur ≥ N factures / 90j.",
      "then": "Signal OVER_INVOICING (Niveau 2) — analyse trade finance, justificatifs contractuels et incoterms demandés."
    }
  },
  {
    "code": "TB-02",
    "ruleRef": "R379",
    "bloc": 57,
    "blocTitre": "TBML",
    "famille": "TB",
    "titre": "Facturation multiple",
    "desc": "Le même bien ou la même expédition est facturé et payé plusieurs fois, via un ou plusieurs financeurs.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "MULTIPLE_INVOICING",
    "params": [
      {
        "key": "fenetre_dedup",
        "label": "fenêtre de déduplication",
        "default": 180
      }
    ],
    "gherkin": {
      "given": "Deux paiements de CHF 140k référencent le même connaissement (B/L) à 3 semaines d'écart.",
      "when": "Déduplication des références documentaires (B/L, facture, conteneur) sur les paiements trade / 180j.",
      "then": "Signal MULTIPLE_INVOICING (Niveau 2) — documents originaux exigés, vérification auprès du transporteur."
    }
  },
  {
    "code": "TB-03",
    "ruleRef": "R380",
    "bloc": 57,
    "blocTitre": "TBML",
    "famille": "TB",
    "titre": "Prix hors benchmark (unit price)",
    "desc": "Analyse du prix unitaire par code HS contre des référentiels de prix de marché — les écarts extrêmes signent la mis-invoicing.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "UNIT_PRICE_ANOMALY",
    "params": [
      {
        "key": "percentile_bas",
        "label": "percentile bas",
        "default": 5
      },
      {
        "key": "percentile_haut",
        "label": "percentile haut",
        "default": 95
      },
      {
        "key": "referentiel_hs",
        "label": "référentiel de prix HS",
        "default": "tenant"
      }
    ],
    "gherkin": {
      "given": "Des « composants électroniques » sont facturés CHF 2 pièce alors que le référentiel HS donne 40-60.",
      "when": "Prix unitaire vs distribution de référence du code HS ; écart au-delà des percentiles paramétrés.",
      "then": "Signal UNIT_PRICE_ANOMALY (Niveau 2) — nature réelle des biens à corroborer."
    }
  },
  {
    "code": "TB-04",
    "ruleRef": "R381",
    "bloc": 57,
    "blocTitre": "TBML",
    "famille": "TB",
    "titre": "Biens à double usage",
    "desc": "Paiements liés à des biens à double usage (annexes du contrôle des exportations) vers des destinations sensibles.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "DUAL_USE",
    "params": [
      {
        "key": "listes_controle",
        "label": "listes de contrôle actives",
        "default": "SECO,EU"
      }
    ],
    "gherkin": {
      "given": "Un paiement finance des machines-outils de précision classées double usage vers un intermédiaire au pays tiers.",
      "when": "Classification des biens (HS + libellés) croisée avec les listes de contrôle des exportations et la destination finale.",
      "then": "Signal DUAL_USE (Niveau 1) — licence d'exportation SECO à exiger avant exécution, escalade sanctions."
    }
  },
  {
    "code": "TB-05",
    "ruleRef": "R382",
    "bloc": 57,
    "blocTitre": "TBML",
    "famille": "TB",
    "titre": "LC back-to-back / crédits doc HRJ",
    "desc": "Lettres de crédit adossées (back-to-back) ou crédits documentaires dont la chaîne implique des juridictions à risque sans logique commerciale.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "BACK_TO_BACK_LC",
    "params": [
      {
        "key": "hrj_trade",
        "label": "liste juridictions trade à risque",
        "default": "tenant"
      }
    ],
    "gherkin": {
      "given": "Une LC est adossée à une seconde LC émise pour un intermédiaire offshore qui ne touche jamais la marchandise.",
      "when": "Détection de LC adossées × intermédiaires sans rôle logistique × juridictions de la chaîne.",
      "then": "Signal BACK_TO_BACK_LC (Niveau 2) — substance de l'intermédiaire à démontrer."
    }
  },
  {
    "code": "TB-06",
    "ruleRef": "R383",
    "bloc": 57,
    "blocTitre": "TBML",
    "famille": "TB",
    "titre": "Phantom shipping",
    "desc": "Paiement sans mouvement de marchandise vérifiable : documents absents, navires inexistants, conteneurs fantômes.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "PHANTOM_SHIPMENT",
    "params": [
      {
        "key": "seuil_verif_tracking",
        "label": "seuil de vérification",
        "default": 100000
      }
    ],
    "gherkin": {
      "given": "Un paiement de CHF 380k référence un conteneur dont le tracking ne montre aucun mouvement.",
      "when": "Vérification d'existence du voyage (API tracking conteneurs/navires) pour les paiements trade ≥ seuil.",
      "then": "Signal PHANTOM_SHIPMENT (Niveau 1) — fonds gelés en attente de preuve d'expédition, EDD."
    }
  },
  {
    "code": "TB-07",
    "ruleRef": "R384",
    "bloc": 57,
    "blocTitre": "TBML",
    "famille": "TB",
    "titre": "Routes & transbordements atypiques",
    "desc": "Routes maritimes incohérentes avec la géographie commerciale : détours, transbordements multiples, pavillons changés en cours de voyage.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "ROUTE_ANOMALY",
    "params": [
      {
        "key": "transbordements_max",
        "label": "transbordements tolérés",
        "default": 1
      }
    ],
    "gherkin": {
      "given": "Une cargaison Rotterdam→Genève transite par 3 ports hors route avec 2 transbordements.",
      "when": "Score d'anomalie de route (détour, transbordements, arrêts en zones sensibles) sur les documents de transport.",
      "then": "Signal ROUTE_ANOMALY (Niveau 2) — justification logistique demandée."
    }
  },
  {
    "code": "TB-08",
    "ruleRef": "R385",
    "bloc": 57,
    "blocTitre": "TBML",
    "famille": "TB",
    "titre": "Carrousel documentaire",
    "desc": "Les mêmes contreparties échangent des rôles acheteur/vendeur sur des biens similaires en boucle — chiffre d'affaires artificiel.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "TRADE_CAROUSEL",
    "params": [
      {
        "key": "duree_cycle_trade",
        "label": "fenêtre de détection",
        "default": 180
      }
    ],
    "gherkin": {
      "given": "A vend à B, B revend à C, C revend à A des lots similaires à valeur croissante sur 4 mois.",
      "when": "Détection de cycles sur le graphe des contreparties trade × similarité des biens × inflation des montants.",
      "then": "Signal TRADE_CAROUSEL (Niveau 2) — logique économique de la chaîne à démontrer."
    }
  },
  {
    "code": "CB-03",
    "ruleRef": "R386",
    "bloc": 58,
    "blocTitre": "Correspondent Banking",
    "famille": "CB",
    "titre": "Wire stripping / transparence",
    "desc": "Champs ordonnateur/bénéficiaire (50/59) incomplets, tronqués ou altérés dans la chaîne — GAFI R.16, Wolfsberg Payment Transparency.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "WIRE_STRIPPING",
    "params": [
      {
        "key": "taux_incomplet_max",
        "label": "taux d'incomplétude toléré par correspondant",
        "default": 2
      }
    ],
    "gherkin": {
      "given": "Une série de MT103 d'un correspondant arrive avec le champ 50 réduit à des initiales.",
      "when": "Contrôle de complétude et de cohérence des champs de transparence par message et par correspondant (taux agrégé).",
      "then": "Signal WIRE_STRIPPING (Niveau 1) — messages retenus, demande de complément au correspondant, taux suivi par répondant."
    }
  },
  {
    "code": "CB-04",
    "ruleRef": "R387",
    "bloc": 58,
    "blocTitre": "Correspondent Banking",
    "famille": "CB",
    "titre": "U-turn payments",
    "desc": "Fonds sortant vers un correspondant tiers et revenant à la même partie via une autre chaîne — contournement de restrictions.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "U_TURN",
    "params": [
      {
        "key": "fenetre_uturn",
        "label": "fenêtre d'appariement",
        "default": 30
      }
    ],
    "gherkin": {
      "given": "CHF 500k partent vers une banque du Golfe et reviennent 9 jours après via un correspondant européen, même bénéficiaire final.",
      "when": "Appariement sortie/entrée (montant, parties finales, fenêtre) à travers des chaînes de correspondance distinctes.",
      "then": "Signal U_TURN (Niveau 2) — finalité du détour à justifier, analyse sanctions."
    }
  },
  {
    "code": "CB-05",
    "ruleRef": "R388",
    "bloc": 58,
    "blocTitre": "Correspondent Banking",
    "famille": "CB",
    "titre": "Payable-through accounts",
    "desc": "Clients du répondant accédant directement au compte de correspondance (payable-through) — diligence impossible sur l'utilisateur final.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "PAYABLE_THROUGH",
    "params": [
      {
        "key": "indicateurs_pta",
        "label": "indicateurs d'usage direct",
        "default": "tenant"
      }
    ],
    "gherkin": {
      "given": "Des ordres au format client final (références retail) transitent par le compte nostro d'un répondant.",
      "when": "Détection de patterns d'usage direct (volumétrie retail, références client final) sur comptes de correspondance.",
      "then": "Signal PAYABLE_THROUGH (Niveau 1) — clarification contractuelle avec le répondant, restriction possible après décision."
    }
  },
  {
    "code": "CB-06",
    "ruleRef": "R389",
    "bloc": 58,
    "blocTitre": "Correspondent Banking",
    "famille": "CB",
    "titre": "Volumétrie répondant vs profil (KYCC)",
    "desc": "Volumes et corridors d'un répondant incohérents avec son profil déclaré (questionnaire Wolfsberg CBDDQ).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "RESPONDENT_PROFILE_DRIFT",
    "params": [
      {
        "key": "derive_max",
        "label": "dérive tolérée vs profil",
        "default": 20
      }
    ],
    "gherkin": {
      "given": "Un répondant déclaré « domestique retail » envoie 40% de ses flux vers des corridors HRJ.",
      "when": "Comparaison flux réels (corridors, volumes, devises) vs profil CBDDQ déclaré, par période.",
      "then": "Signal RESPONDENT_PROFILE_DRIFT (Niveau 2) — mise à jour du questionnaire exigée, revue de la relation."
    }
  },
  {
    "code": "CB-07",
    "ruleRef": "R390",
    "bloc": 58,
    "blocTitre": "Correspondent Banking",
    "famille": "CB",
    "titre": "Shell bank",
    "desc": "Détection de banques fictives (sans présence physique ni groupe régulé) dans les chaînes — interdiction LBA.",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "",
    "params": [
      {
        "key": "registres_supervision",
        "label": "registres de superviseurs consultés",
        "default": "tenant"
      }
    ],
    "gherkin": {
      "given": "Un BIC de la chaîne appartient à un établissement sans adresse physique vérifiable ni superviseur identifiable.",
      "when": "Croisement BIC × registres de supervision × indicateurs de présence physique (référentiel tenant).",
      "then": "TRANSACTION BLOQUÉE (Niveau 1) — interdiction légale, aucune dérogation, dossier sanctions/MROS selon le cas."
    }
  },
  {
    "code": "CB-08",
    "ruleRef": "R391",
    "bloc": 58,
    "blocTitre": "Correspondent Banking",
    "famille": "CB",
    "titre": "RMA sans flux ni justification",
    "desc": "Autorisations d'échange SWIFT (RMA) actives sans flux ni besoin documenté — surface d'attaque et de contournement inutile.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "RMA_DORMANT",
    "params": [
      {
        "key": "periode_revue_rma",
        "label": "période de revue",
        "default": 12
      }
    ],
    "gherkin": {
      "given": "Un RMA bilatéral est actif depuis 3 ans avec zéro message échangé.",
      "when": "Revue périodique des RMA : flux sur la période × justification métier enregistrée.",
      "then": "Signal RMA_DORMANT (Niveau 1, ops) — proposition de résiliation, décision tracée."
    }
  },
  {
    "code": "CB-09",
    "ruleRef": "R392",
    "bloc": 58,
    "blocTitre": "Correspondent Banking",
    "famille": "CB",
    "titre": "Screening des répondantes (CBDDQ)",
    "desc": "Screening périodique des banques répondantes elles-mêmes : sanctions, adverse media, rating pays, actionnariat.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "RESPONDENT_HIT",
    "params": [
      {
        "key": "frequence_screen_respondants",
        "label": "fréquence",
        "default": 30
      }
    ],
    "gherkin": {
      "given": "L'actionnaire majoritaire d'un répondant est placé sous sanctions.",
      "when": "Re-screening périodique du répondant + UBO bancaires + dirigeants ; delta → revue.",
      "then": "Signal RESPONDENT_HIT (Niveau 2) — comité correspondance, suspension possible après décision humaine."
    }
  },
  {
    "code": "PF-01",
    "ruleRef": "R393",
    "bloc": 59,
    "blocTitre": "Prolifération",
    "famille": "PF",
    "titre": "Sanctions sectorielles & plafonds",
    "desc": "Contournement des sanctions sectorielles : plafonds de prix (pétrole), embargos or/luxe, services interdits (assurance, shipping) vers RU/BY/IR/KP.",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "",
    "params": [
      {
        "key": "plafonds_sectoriels",
        "label": "référentiel plafonds/embargos",
        "default": "tenant"
      }
    ],
    "gherkin": {
      "given": "Un paiement pétrole affiche un prix au baril supérieur au plafond, assuré par un assureur non autorisé.",
      "when": "Contrôle sectoriel : produit × origine × prix vs plafond × services associés autorisés.",
      "then": "TRANSACTION BLOQUÉE (Niveau 1) — violation sectorielle, escalade sanctions, décision humaine tracée."
    }
  },
  {
    "code": "PF-02",
    "ruleRef": "R394",
    "bloc": 59,
    "blocTitre": "Prolifération",
    "famille": "PF",
    "titre": "Chaînes d'écrans corridors KP/IR",
    "desc": "Patterns d'intermédiation typiques du financement de la prolifération : sociétés jeunes, capital minimal, secteurs génériques, en chaîne vers corridors sensibles.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "PROLIF_CHAIN",
    "params": [
      {
        "key": "age_entite_min",
        "label": "âge minimal sans surrisque",
        "default": 24
      }
    ],
    "gherkin": {
      "given": "Trois sociétés de trading créées < 12 mois s'intercalent entre un exportateur européen et un acheteur final opaque.",
      "when": "Score de chaîne : âge des entités × substance × secteur générique × corridor final.",
      "then": "Signal PROLIF_CHAIN (Niveau 1) — identification du destinataire final exigée, escalade."
    }
  },
  {
    "code": "PF-03",
    "ruleRef": "R395",
    "bloc": 59,
    "blocTitre": "Prolifération",
    "famille": "PF",
    "titre": "Biens de luxe vers zones embargo",
    "desc": "Exportation de biens de luxe (montres, joaillerie, véhicules) vers des juridictions sous embargo de luxe, souvent via pays relais.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "LUXURY_EMBARGO",
    "params": [
      {
        "key": "categories_luxe",
        "label": "catégories surveillées",
        "default": "tenant"
      }
    ],
    "gherkin": {
      "given": "Des paiements de montres de haute horlogerie partent vers un relais d'Asie centrale, volume ×6 depuis l'embargo.",
      "when": "Volume par corridor relais × catégorie de biens embargo × croissance anormale post-sanctions.",
      "then": "Signal LUXURY_EMBARGO (Niveau 2) — destinataire final et usage à corroborer."
    }
  },
  {
    "code": "IA-01",
    "ruleRef": "R396",
    "bloc": 60,
    "blocTitre": "Immobilier & Art",
    "famille": "IA",
    "titre": "Immobilier via structure + prix hors marché",
    "desc": "Acquisition immobilière via structure (SCI, trust, offshore) à un prix significativement hors marché.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "REAL_ESTATE_ANOMALY",
    "params": [
      {
        "key": "ecart_marche_max",
        "label": "écart au marché toléré",
        "default": 25
      }
    ],
    "gherkin": {
      "given": "Un bien estimé CHF 2.1M est acquis 3.4M via une société des BVI financée depuis le compte.",
      "when": "Écart au prix de référence (m², registre) × acquisition via structure × origine du financement.",
      "then": "Signal REAL_ESTATE_ANOMALY (Niveau 2) — expertise indépendante et SOW exigées."
    }
  },
  {
    "code": "IA-02",
    "ruleRef": "R397",
    "bloc": 60,
    "blocTitre": "Immobilier & Art",
    "famille": "IA",
    "titre": "Art & ports francs",
    "desc": "Achat d'œuvres, dépôt en port franc, revente rapide — valeur mobile, opaque et transfrontalière.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "ART_FREEPORT",
    "params": [
      {
        "key": "delai_revente_min",
        "label": "revente considérée rapide si <",
        "default": 36
      }
    ],
    "gherkin": {
      "given": "Une œuvre achetée CHF 900k est déposée en port franc puis revendue 15 mois après à une partie liée, +40%.",
      "when": "Cycle achat→port franc→revente × délai × lien entre parties × écart de prix.",
      "then": "Signal ART_FREEPORT (Niveau 2) — provenance de l'œuvre et indépendance de l'acheteur à établir."
    }
  },
  {
    "code": "IA-03",
    "ruleRef": "R398",
    "bloc": 60,
    "blocTitre": "Immobilier & Art",
    "famille": "IA",
    "titre": "Véhicules de valeur (luxe, NFT)",
    "desc": "Biens de luxe et actifs numériques de collection utilisés comme véhicules de transfert de valeur.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "VALUE_VEHICLE",
    "params": [
      {
        "key": "seuil_biens_valeur",
        "label": "équivalent CHF / 180j",
        "default": 200000
      }
    ],
    "gherkin": {
      "given": "Trois véhicules de collection achetés et réexpédiés à l'étranger en 4 mois, revendus à des parties inconnues.",
      "when": "Fréquence d'achat/revente de biens de valeur × export × contreparties.",
      "then": "Signal VALUE_VEHICLE (Niveau 2) — finalité patrimoniale vs circulation de valeur à clarifier."
    }
  },
  {
    "code": "AN-01",
    "ruleRef": "R399",
    "bloc": 61,
    "blocTitre": "Analytique 2G",
    "famille": "AN",
    "titre": "Déviation au groupe de pairs",
    "desc": "Écart statistique du client à son groupe de pairs CPSI (z-score sur les attributs surveillés), au-delà des seuils fixes de 1re génération.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "PEER_DEVIATION",
    "params": [
      {
        "key": "zscore_seuil",
        "label": "z-score de déclenchement",
        "default": 3.5
      }
    ],
    "gherkin": {
      "given": "Un client du groupe « Affluent CH » présente un volume cash à 4.2 écarts-types de la médiane de son groupe.",
      "when": "Z-score robuste (médiane/MAD) par attribut et par groupe, recalculé au fil de l'eau.",
      "then": "Signal PEER_DEVIATION (Niveau 2) — explicable par construction : attribut, valeur, distribution du groupe joints (R44 : l'IA éclaire)."
    }
  },
  {
    "code": "AN-02",
    "ruleRef": "R400",
    "bloc": 61,
    "blocTitre": "Analytique 2G",
    "famille": "AN",
    "titre": "Rupture de comportement (baseline propre)",
    "desc": "Changement soudain vs la baseline historique du client lui-même (pas du groupe) : régime transactionnel qui bascule.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "BEHAVIOR_SHIFT",
    "params": [
      {
        "key": "sensibilite_rupture",
        "label": "sensibilité du détecteur",
        "default": "tenant"
      }
    ],
    "gherkin": {
      "given": "Un compte stable depuis 4 ans triple sa volumétrie et change de corridors en 3 semaines.",
      "when": "Détection de rupture (changepoint) sur volume, fréquence, corridors, contreparties vs baseline 12 mois.",
      "then": "Signal BEHAVIOR_SHIFT (Niveau 2) — comparatif avant/après joint au signal."
    }
  },
  {
    "code": "AN-03",
    "ruleRef": "R401",
    "bloc": 61,
    "blocTitre": "Analytique 2G",
    "famille": "AN",
    "titre": "First-time patterns",
    "desc": "Premières occurrences sensibles : premier virement international, premier cash, première contrepartie HRJ, premier produit à risque.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "FIRST_TIME",
    "params": [
      {
        "key": "dimensions_ft",
        "label": "dimensions surveillées",
        "default": "international,cash,HRJ,produit_risque"
      },
      {
        "key": "materialite_ft",
        "label": "matérialité minimale",
        "default": 25000
      }
    ],
    "gherkin": {
      "given": "Un client 100% domestique depuis 6 ans émet son premier virement vers une juridiction à risque, montant élevé.",
      "when": "Détection de première occurrence par dimension sensible × matérialité du montant.",
      "then": "Signal FIRST_TIME (Niveau 1) — friction douce : revue rapide, pas de blocage (R39 : mesurer, pas coercer)."
    }
  },
  {
    "code": "AN-04",
    "ruleRef": "R402",
    "bloc": 61,
    "blocTitre": "Analytique 2G",
    "famille": "AN",
    "titre": "Dormance partielle par segment",
    "desc": "Réactivation d'un segment d'activité dormant (ex. le cash après 3 ans d'inactivité cash) même si le compte global reste actif — complète la règle « compte dormant » existante.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "SEGMENT_REACTIVATION",
    "params": [
      {
        "key": "dormance_segment",
        "label": "dormance du segment",
        "default": 24
      }
    ],
    "gherkin": {
      "given": "Un compte actif en titres n'a fait aucun cash depuis 3 ans ; 3 dépôts espèces surviennent en 2 semaines.",
      "when": "Dormance mesurée par segment (cash, international, produit) ; réactivation = première activité du segment après N mois.",
      "then": "Signal SEGMENT_REACTIVATION (Niveau 2) — contexte de réactivation demandé."
    }
  },
  {
    "code": "AN-05",
    "ruleRef": "R403",
    "bloc": 61,
    "blocTitre": "Analytique 2G",
    "famille": "AN",
    "titre": "Revenus entrants incohérents (mismatch)",
    "desc": "Entrées récurrentes libellées « salaire/honoraires » incohérentes avec l'employeur et la rémunération déclarés au KYC — pendant entrant de R201/AML-WC-01.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "INCOME_MISMATCH",
    "params": [
      {
        "key": "ecart_revenu_max",
        "label": "écart toléré vs déclaré",
        "default": 50
      }
    ],
    "gherkin": {
      "given": "Un « salaire » mensuel de CHF 45k est crédité alors que le KYC déclare 12k et un autre employeur.",
      "when": "Croisement libellé/ordonnateur des entrées récurrentes × rémunération et employeur déclarés.",
      "then": "Signal INCOME_MISMATCH (Niveau 2) — mise à jour KYC ou justification exigée (CoC)."
    }
  }
];

export const AML_GAP_GT_SEED: AmlGapGtSeed[] = [
  {
    "caseId": "GT-SF-01-TP-1",
    "scenarioId": "SF-01",
    "ruleRef": "R340",
    "famille": "SF",
    "label": "TP",
    "clientId": "CLI-00016",
    "narrative": "Virement de 180k reçu du frère d'un ministre en exercice (liste PEP, match 91%) — investigation confirme l'origine politique des fonds."
  },
  {
    "caseId": "GT-SF-01-TP-2",
    "scenarioId": "SF-01",
    "ruleRef": "R340",
    "famille": "SF",
    "label": "TP",
    "clientId": "CLI-00039",
    "narrative": "Sortie de 95k vers une société détenue par un PEP régional sanctionnable — lien confirmé au registre."
  },
  {
    "caseId": "GT-SF-01-FP-1",
    "scenarioId": "SF-01",
    "ruleRef": "R340",
    "famille": "SF",
    "label": "FP",
    "clientId": "CLI-00003",
    "narrative": "Homonyme parfait d'un PEP brésilien ; la date de naissance et le pays divergent — clôturé FP après vérification documentaire.",
    "ecartement": "homonymie (DDN + pays divergents)"
  },
  {
    "caseId": "GT-SF-02-TP-1",
    "scenarioId": "SF-02",
    "ruleRef": "R341",
    "famille": "SF",
    "label": "TP",
    "clientId": "CLI-00075",
    "narrative": "Paiement fournisseur vers une société mise en accusation pour corruption d'agents publics (3 sources de rang 1) — TP confirmé."
  },
  {
    "caseId": "GT-SF-02-FP-1",
    "scenarioId": "SF-02",
    "ruleRef": "R341",
    "famille": "SF",
    "label": "FP",
    "clientId": "CLI-00041",
    "narrative": "Match sur un article concernant une société homonyme d'un autre canton — secteur et IDE différents, clôturé FP.",
    "ecartement": "homonymie d'entité (secteur + IDE différents)"
  },
  {
    "caseId": "GT-SF-03-TP-1",
    "scenarioId": "SF-03",
    "ruleRef": "R342",
    "famille": "SF",
    "label": "TP",
    "clientId": "CLI-00034",
    "narrative": "Client nommé au conseil d'administration d'une entreprise publique — delta PEP détecté à J+1, CoC ouvert, EDD déclenchée."
  },
  {
    "caseId": "GT-SF-03-TP-2",
    "scenarioId": "SF-03",
    "ruleRef": "R342",
    "famille": "SF",
    "label": "TP",
    "clientId": "CLI-00070",
    "narrative": "UBO ajouté à la liste SECO lors d'un train de sanctions — delta détecté, relation gelée après décision humaine."
  },
  {
    "caseId": "GT-SF-03-FP-1",
    "scenarioId": "SF-03",
    "ruleRef": "R342",
    "famille": "SF",
    "label": "FP",
    "clientId": "CLI-00005",
    "narrative": "Mise à jour de format du fournisseur de listes régénère un hit déjà écarté (même ID de profil) — dédoublonné puis clôturé FP ; correctif de mapping consigné.",
    "ecartement": "hit déjà écarté régénéré par changement de format (même ID profil)"
  },
  {
    "caseId": "GT-SF-04-TP-1",
    "scenarioId": "SF-04",
    "ruleRef": "R343",
    "famille": "SF",
    "label": "TP",
    "clientId": "CLI-00130",
    "narrative": "Paiement vers Singapour routé via une intermédiaire filiale d'un groupe sous sanctions sectorielles — re-routé après alerte."
  },
  {
    "caseId": "GT-SF-04-FP-1",
    "scenarioId": "SF-04",
    "ruleRef": "R343",
    "famille": "SF",
    "label": "FP",
    "clientId": "CLI-00018",
    "narrative": "BIC matché sur l'ancien code d'une banque assainie et retirée des listes depuis 2024 — référentiel BIC mis à jour, FP.",
    "ecartement": "référentiel BIC obsolète (banque délistée depuis 2024)"
  },
  {
    "caseId": "GT-SF-05-TP-1",
    "scenarioId": "SF-05",
    "ruleRef": "R344",
    "famille": "SF",
    "label": "TP",
    "clientId": "CLI-00070",
    "narrative": "Bénéficiaire domicilié dans une région sous embargo — blocage confirmé, déclaration préparée."
  },
  {
    "caseId": "GT-SF-05-FP-1",
    "scenarioId": "SF-05",
    "ruleRef": "R344",
    "famille": "SF",
    "label": "FP",
    "clientId": "CLI-00035",
    "narrative": "Rue « Crimée » à Paris 19e matchée par le parseur — règle affinée (ville+pays requis), FP documenté.",
    "ecartement": "faux match toponymique (rue « Crimée » à Paris)"
  },
  {
    "caseId": "GT-SF-06-TP-1",
    "scenarioId": "SF-06",
    "ruleRef": "R345",
    "famille": "SF",
    "label": "TP",
    "clientId": "CLI-00045",
    "narrative": "Contrepartie en caractères chinois matchant un profil OFAC translittéré — non détectable sans normalisation, TP."
  },
  {
    "caseId": "GT-SF-06-FP-1",
    "scenarioId": "SF-06",
    "ruleRef": "R345",
    "famille": "SF",
    "label": "FP",
    "clientId": "CLI-00193",
    "narrative": "Translittération agressive rapproche deux patronymes arabes courants distincts — seuil par script relevé, FP.",
    "ecartement": "translittération trop agressive (patronymes distincts)"
  },
  {
    "caseId": "GT-SF-07-TP-1",
    "scenarioId": "SF-07",
    "ruleRef": "R346",
    "famille": "SF",
    "label": "TP",
    "clientId": "CLI-00039",
    "narrative": "LC référençant un tanker de la flotte fantôme (IMO sanctionné, pavillon changé 3× en 12 mois) — blocage confirmé."
  },
  {
    "caseId": "GT-SF-07-FP-1",
    "scenarioId": "SF-07",
    "ruleRef": "R346",
    "famille": "SF",
    "label": "FP",
    "clientId": "CLI-00130",
    "narrative": "Navire homonyme d'une unité sanctionnée mais IMO distinct et pavillon UE — libéré après vérification IMO, FP.",
    "ecartement": "homonymie de navire (IMO distinct, pavillon UE)"
  },
  {
    "caseId": "GT-QO-01-TP-1",
    "scenarioId": "QO-01",
    "ruleRef": "R347",
    "famille": "QO",
    "label": "TP",
    "clientId": "CLI-00043",
    "narrative": "Refus réitéré de documenter un apport de 500k malgré 2 relances écrites — relation dénoncée après comité."
  },
  {
    "caseId": "GT-QO-01-FP-1",
    "scenarioId": "QO-01",
    "ruleRef": "R347",
    "famille": "QO",
    "label": "FP",
    "clientId": "CLI-00053",
    "narrative": "Retard de 3 semaines dû à une succession en cours chez le notaire — documents fournis, signal clôturé FP.",
    "ecartement": "retard légitime (succession chez le notaire)"
  },
  {
    "caseId": "GT-QO-02-TP-1",
    "scenarioId": "QO-02",
    "ruleRef": "R348",
    "famille": "QO",
    "label": "TP",
    "clientId": "CLI-00072",
    "narrative": "11 ordonnateurs inconnus en 3 semaines, fonds ressortis sous 48h — typologie mule/passage confirmée."
  },
  {
    "caseId": "GT-QO-02-FP-1",
    "scenarioId": "QO-02",
    "ruleRef": "R348",
    "famille": "QO",
    "label": "FP",
    "clientId": "CLI-00110",
    "narrative": "Fondation caritative recevant des dons multiples pendant sa campagne annuelle déclarée au KYC — but documenté, FP.",
    "ecartement": "but documenté au KYC (campagne caritative)"
  },
  {
    "caseId": "GT-QO-03-TP-1",
    "scenarioId": "QO-03",
    "ruleRef": "R349",
    "famille": "QO",
    "label": "TP",
    "clientId": "CLI-00080",
    "narrative": "Aller-retour titres à perte de 4% en 48h répété 3× — habillage de transferts de valeur confirmé."
  },
  {
    "caseId": "GT-QO-03-FP-1",
    "scenarioId": "QO-03",
    "ruleRef": "R349",
    "famille": "QO",
    "label": "FP",
    "clientId": "CLI-00104",
    "narrative": "Vente à perte fin décembre puis rachat en janvier — tax-loss harvesting documenté par le gérant, FP.",
    "ecartement": "tax-loss harvesting documenté"
  },
  {
    "caseId": "GT-QO-04-TP-1",
    "scenarioId": "QO-04",
    "ruleRef": "R350",
    "famille": "QO",
    "label": "TP",
    "clientId": "CLI-00043",
    "narrative": "14 sociétés clientes domiciliées à la même adresse d'un prestataire offshore — requalification en sociétés de domicile."
  },
  {
    "caseId": "GT-QO-04-FP-1",
    "scenarioId": "QO-04",
    "ruleRef": "R350",
    "famille": "QO",
    "label": "FP",
    "clientId": "CLI-00018",
    "narrative": "Membres d'une même famille (grand-parents, enfants, holding familiale) à l'adresse du family office — liens déclarés, FP.",
    "ecartement": "liens familiaux déclarés (family office)"
  },
  {
    "caseId": "GT-QO-05-TP-1",
    "scenarioId": "QO-05",
    "ruleRef": "R351",
    "famille": "QO",
    "label": "TP",
    "clientId": "CLI-00034",
    "narrative": "Rotation de 4 mandataires en 5 mois masquant l'opérateur réel du compte — ADE requalifié."
  },
  {
    "caseId": "GT-QO-05-FP-1",
    "scenarioId": "QO-05",
    "ruleRef": "R351",
    "famille": "QO",
    "label": "FP",
    "clientId": "CLI-00016",
    "narrative": "Réorganisation du family office documentée (départ CFO, arrivée de deux successeurs) — actes fournis, FP.",
    "ecartement": "réorganisation documentée (départ CFO)"
  },
  {
    "caseId": "GT-GU-01-TP-1",
    "scenarioId": "GU-01",
    "ruleRef": "R352",
    "famille": "GU",
    "label": "TP",
    "clientId": "CLI-00005",
    "narrative": "4 dépôts de 18-19k via holding, SCI et deux comptes personnels du même UBO en 6 jours — structuring de groupe confirmé."
  },
  {
    "caseId": "GT-GU-01-FP-1",
    "scenarioId": "GU-01",
    "ruleRef": "R352",
    "famille": "GU",
    "label": "FP",
    "clientId": "CLI-00152",
    "narrative": "Distributions de dividendes simultanées des filiales vers la holding, calendrier d'AG documenté — flux légitimes, FP.",
    "ecartement": "distributions de dividendes documentées (calendrier d'AG)"
  },
  {
    "caseId": "GT-GU-02-TP-1",
    "scenarioId": "GU-02",
    "ruleRef": "R353",
    "famille": "GU",
    "label": "TP",
    "clientId": "CLI-00101",
    "narrative": "Rotation de 300k entre 3 entités pour gonfler artificiellement les bilans avant une demande de crédit — TP."
  },
  {
    "caseId": "GT-GU-02-FP-1",
    "scenarioId": "GU-02",
    "ruleRef": "R353",
    "famille": "GU",
    "label": "FP",
    "clientId": "CLI-00016",
    "narrative": "Cash pooling intra-groupe documenté par convention de trésorerie — mécanique déclarée au KYC, FP.",
    "ecartement": "cash pooling documenté (convention de trésorerie)"
  },
  {
    "caseId": "GT-GU-03-TP-1",
    "scenarioId": "GU-03",
    "ruleRef": "R354",
    "famille": "GU",
    "label": "TP",
    "clientId": "CLI-00033",
    "narrative": "45k/mois d'espèces répartis sur 5 entités d'un même bénéficiaire, activité déclarée sans lien avec le cash — TP."
  },
  {
    "caseId": "GT-GU-03-FP-1",
    "scenarioId": "GU-03",
    "ruleRef": "R354",
    "famille": "GU",
    "label": "FP",
    "clientId": "CLI-00041",
    "narrative": "Groupe de restaurants du même propriétaire : intensité cash cohérente avec le secteur déclaré de chaque entité, FP.",
    "ecartement": "intensité cash cohérente au secteur déclaré (restauration)"
  },
  {
    "caseId": "GT-GU-04-TP-1",
    "scenarioId": "GU-04",
    "ruleRef": "R355",
    "famille": "GU",
    "label": "TP",
    "clientId": "CLI-00072",
    "narrative": "Combinaison cash + in-specie + lombard totalisant 85k/semaine en contournement des seuils unitaires — TP."
  },
  {
    "caseId": "GT-GU-04-FP-1",
    "scenarioId": "GU-04",
    "ruleRef": "R355",
    "famille": "GU",
    "label": "FP",
    "clientId": "CLI-00164",
    "narrative": "Rééquilibrage trimestriel de portefeuille documenté par le mandat de gestion (mouvements multi-produits simultanés), FP.",
    "ecartement": "rééquilibrage documenté (mandat de gestion)"
  },
  {
    "caseId": "GT-IP-01-TP-1",
    "scenarioId": "IP-01",
    "ruleRef": "R356",
    "famille": "IP",
    "label": "TP",
    "clientId": "CLI-00043",
    "narrative": "Lombard soldé par une société panaméenne étrangère au dossier — le crédit servait à donner une apparence bancaire aux fonds, TP."
  },
  {
    "caseId": "GT-IP-01-FP-1",
    "scenarioId": "IP-01",
    "ruleRef": "R356",
    "famille": "IP",
    "label": "FP",
    "clientId": "CLI-00152",
    "narrative": "Remboursement par la holding mère de l'emprunteur, convention de trésorerie au dossier — lien documenté, FP.",
    "ecartement": "lien documenté (holding mère, convention de trésorerie)"
  },
  {
    "caseId": "GT-IP-02-TP-1",
    "scenarioId": "IP-02",
    "ruleRef": "R357",
    "famille": "IP",
    "label": "TP",
    "clientId": "CLI-00033",
    "narrative": "Dépôt offshore non corroboré garantissant un prêt à l'entité opérationnelle suisse du même bénéficiaire — schéma B2B confirmé."
  },
  {
    "caseId": "GT-IP-02-FP-1",
    "scenarioId": "IP-02",
    "ruleRef": "R357",
    "famille": "IP",
    "label": "FP",
    "clientId": "CLI-00016",
    "narrative": "Garantie intra-groupe standard d'un family office, origine des fonds corroborée à l'ouverture — structure déclarée, FP.",
    "ecartement": "structure déclarée + SOF corroborée à l'ouverture"
  },
  {
    "caseId": "GT-IP-03-TP-1",
    "scenarioId": "IP-03",
    "ruleRef": "R358",
    "famille": "IP",
    "label": "TP",
    "clientId": "CLI-00048",
    "narrative": "Prime de 1.5M financée par trois virements de sociétés tierces, patrimoine déclaré 900k — support d'intégration, TP."
  },
  {
    "caseId": "GT-IP-03-FP-1",
    "scenarioId": "IP-03",
    "ruleRef": "R358",
    "famille": "IP",
    "label": "FP",
    "clientId": "CLI-00005",
    "narrative": "Prime élevée financée par la vente documentée d'un bien immobilier (acte notarié au dossier) — SOW corroborée, FP.",
    "ecartement": "SOW corroborée (vente immobilière, acte notarié)"
  },
  {
    "caseId": "GT-IP-04-TP-1",
    "scenarioId": "IP-04",
    "ruleRef": "R359",
    "famille": "IP",
    "label": "TP",
    "clientId": "CLI-00043",
    "narrative": "Rachat à 7 mois versé sur un compte tiers à Dubaï, pénalité assumée — la police n'a servi que de sas, TP."
  },
  {
    "caseId": "GT-IP-04-FP-1",
    "scenarioId": "IP-04",
    "ruleRef": "R359",
    "famille": "IP",
    "label": "FP",
    "clientId": "CLI-00110",
    "narrative": "Rachat à 10 mois pour financer une acquisition immobilière urgente (compromis de vente fourni) — besoin réel, FP.",
    "ecartement": "besoin réel documenté (acquisition immobilière)"
  },
  {
    "caseId": "GT-IP-05-TP-1",
    "scenarioId": "IP-05",
    "ruleRef": "R360",
    "famille": "IP",
    "label": "TP",
    "clientId": "CLI-00034",
    "narrative": "Bénéficiaire basculé vers une fondation panaméenne contrôlée par un tiers — transfert de valeur déguisé, TP."
  },
  {
    "caseId": "GT-IP-05-FP-1",
    "scenarioId": "IP-05",
    "ruleRef": "R360",
    "famille": "IP",
    "label": "FP",
    "clientId": "CLI-00053",
    "narrative": "Changement vers les enfants suite à un divorce (jugement au dossier) — événement de vie documenté, FP.",
    "ecartement": "événement de vie documenté (divorce, jugement)"
  },
  {
    "caseId": "GT-IP-06-TP-1",
    "scenarioId": "IP-06",
    "ruleRef": "R361",
    "famille": "IP",
    "label": "TP",
    "clientId": "CLI-00072",
    "narrative": "6 séquences coffre→dépôt sous 24h totalisant 100k — le coffre alimente les dépôts, TP."
  },
  {
    "caseId": "GT-IP-06-FP-1",
    "scenarioId": "IP-06",
    "ruleRef": "R361",
    "famille": "IP",
    "label": "FP",
    "clientId": "CLI-00063",
    "narrative": "Numismate déclaré accédant au coffre avant chaque vente aux enchères documentée (bordereaux fournis) — activité déclarée, FP.",
    "ecartement": "activité déclarée (numismate, bordereaux de vente)"
  },
  {
    "caseId": "GT-IP-07-TP-1",
    "scenarioId": "IP-07",
    "ruleRef": "R362",
    "famille": "IP",
    "label": "TP",
    "clientId": "CLI-00080",
    "narrative": "Achats répétés d'or livré à un tiers non documenté à l'étranger — conversion de valeur portable, TP."
  },
  {
    "caseId": "GT-IP-07-FP-1",
    "scenarioId": "IP-07",
    "ruleRef": "R362",
    "famille": "IP",
    "label": "FP",
    "clientId": "CLI-00164",
    "narrative": "Allocation or de 5% du portefeuille en garde bancaire, conforme au mandat de gestion — investissement standard, FP.",
    "ecartement": "investissement standard (allocation or en garde, mandat)"
  },
  {
    "caseId": "GT-CR-01-TP-1",
    "scenarioId": "CR-01",
    "ruleRef": "R363",
    "famille": "CR",
    "label": "TP",
    "clientId": "CLI-00022",
    "narrative": "Sortie vers un exchange non coopératif refusant l'échange travel rule — blocage maintenu, relation revue."
  },
  {
    "caseId": "GT-CR-01-FP-1",
    "scenarioId": "CR-01",
    "ruleRef": "R363",
    "famille": "CR",
    "label": "FP",
    "clientId": "CLI-00068",
    "narrative": "Message travel rule retardé par une panne du protocole d'échange du VASP partenaire (reçu à H+6) — libéré, FP.",
    "ecartement": "panne technique du protocole (message reçu à H+6)"
  },
  {
    "caseId": "GT-CR-02-TP-1",
    "scenarioId": "CR-02",
    "ruleRef": "R364",
    "famille": "CR",
    "label": "TP",
    "clientId": "CLI-00022",
    "narrative": "64% de provenance mixer sur un dépôt de 2.1 BTC, client incapable d'expliquer la chaîne — fonds refusés, TP."
  },
  {
    "caseId": "GT-CR-02-FP-1",
    "scenarioId": "CR-02",
    "ruleRef": "R364",
    "famille": "CR",
    "label": "FP",
    "clientId": "CLI-00068",
    "narrative": "Exposition indirecte de 3% à 2 hops via un exchange majeur (pollution de cluster) — sous matérialité, FP.",
    "ecartement": "sous matérialité (3% indirect via exchange majeur)"
  },
  {
    "caseId": "GT-CR-03-TP-1",
    "scenarioId": "CR-03",
    "ruleRef": "R365",
    "famille": "CR",
    "label": "TP",
    "clientId": "CLI-00022",
    "narrative": "Destination = adresse SDN d'un groupe ransomware — blocage, déclaration effectuée."
  },
  {
    "caseId": "GT-CR-03-FP-1",
    "scenarioId": "CR-03",
    "ruleRef": "R365",
    "famille": "CR",
    "label": "FP",
    "clientId": "CLI-00068",
    "narrative": "Adresse retirée de la liste SDN au dernier délisting, cache local obsolète — synchronisation corrigée, FP.",
    "ecartement": "cache de liste obsolète (adresse délistée)"
  },
  {
    "caseId": "GT-CR-04-TP-1",
    "scenarioId": "CR-04",
    "ruleRef": "R366",
    "famille": "CR",
    "label": "TP",
    "clientId": "CLI-00022",
    "narrative": "30% de provenance darknet sur un dépôt, historique d'adresses cohérent avec du peel chaining — TP."
  },
  {
    "caseId": "GT-CR-04-FP-1",
    "scenarioId": "CR-04",
    "ruleRef": "R366",
    "famille": "CR",
    "label": "FP",
    "clientId": "CLI-00068",
    "narrative": "Étiquetage erroné d'un cluster par le fournisseur (corrigé dans sa release suivante) — FP documenté fournisseur.",
    "ecartement": "étiquetage fournisseur erroné (corrigé en release suivante)"
  },
  {
    "caseId": "GT-CR-05-TP-1",
    "scenarioId": "CR-05",
    "ruleRef": "R367",
    "famille": "CR",
    "label": "TP",
    "clientId": "CLI-00022",
    "narrative": "Adresse prétendument personnelle appartenant en réalité à un tiers (échec du test de signature) — TP."
  },
  {
    "caseId": "GT-CR-05-FP-1",
    "scenarioId": "CR-05",
    "ruleRef": "R367",
    "famille": "CR",
    "label": "FP",
    "clientId": "CLI-00068",
    "narrative": "Preuve expirée de 2 semaines pour une adresse déjà vérifiée 3× — re-signée le jour même, FP.",
    "ecartement": "preuve expirée récemment (adresse déjà vérifiée 3×)"
  },
  {
    "caseId": "GT-CR-06-TP-1",
    "scenarioId": "CR-06",
    "ruleRef": "R368",
    "famille": "CR",
    "label": "TP",
    "clientId": "CLI-00022",
    "narrative": "14 cycles/mois avec marge négative systématique — le coût de conversion est le prix du layering, TP."
  },
  {
    "caseId": "GT-CR-06-FP-1",
    "scenarioId": "CR-06",
    "ruleRef": "R368",
    "famille": "CR",
    "label": "FP",
    "clientId": "CLI-00068",
    "narrative": "Trader actif déclaré avec profil « trading fréquent » validé à l'onboarding — comportement conforme, FP.",
    "ecartement": "profil « trading fréquent » validé à l'onboarding"
  },
  {
    "caseId": "GT-FT-01-TP-1",
    "scenarioId": "FT-01",
    "ruleRef": "R369",
    "famille": "FT",
    "label": "TP",
    "clientId": "CLI-00084",
    "narrative": "23 micro-transferts vers des collecteurs relais identifiés par la suite dans une enquête — TP."
  },
  {
    "caseId": "GT-FT-01-FP-1",
    "scenarioId": "FT-01",
    "ruleRef": "R369",
    "famille": "FT",
    "label": "FP",
    "clientId": "CLI-00035",
    "narrative": "Soutien familial mensuel régulier vers le pays d'origine, bénéficiaire unique documenté (famille au KYC) — remittance légitime, FP.",
    "ecartement": "remittance légitime (soutien familial, bénéficiaire unique au KYC)"
  },
  {
    "caseId": "GT-FT-02-TP-1",
    "scenarioId": "FT-02",
    "ruleRef": "R370",
    "famille": "FT",
    "label": "TP",
    "clientId": "CLI-00084",
    "narrative": "Dons répétés vers une association-écran dissoute 8 mois plus tard, dirigeants condamnés — TP."
  },
  {
    "caseId": "GT-FT-02-FP-1",
    "scenarioId": "FT-02",
    "ruleRef": "R370",
    "famille": "FT",
    "label": "FP",
    "clientId": "CLI-00110",
    "narrative": "Dons vers une ONG certifiée ZEWO opérant en zone à risque avec audit de distribution publié — organisation vérifiée, FP.",
    "ecartement": "organisation vérifiée (ONG certifiée ZEWO, audit publié)"
  },
  {
    "caseId": "GT-FT-03-TP-1",
    "scenarioId": "FT-03",
    "ruleRef": "R371",
    "famille": "FT",
    "label": "TP",
    "clientId": "CLI-00084",
    "narrative": "Carte financée par 5 tiers et vidée en cash à la frontière turco-syrienne — TP."
  },
  {
    "caseId": "GT-FT-03-FP-1",
    "scenarioId": "FT-03",
    "ruleRef": "R371",
    "famille": "FT",
    "label": "FP",
    "clientId": "CLI-00121",
    "narrative": "Carte d'étudiant rechargée par ses deux parents et un grand-parent (liens familiaux au dossier), retraits sur le lieu d'études — FP.",
    "ecartement": "liens familiaux au dossier (carte étudiant)"
  },
  {
    "caseId": "GT-FT-04-TP-1",
    "scenarioId": "FT-04",
    "ruleRef": "R372",
    "famille": "FT",
    "label": "TP",
    "clientId": "CLI-00084",
    "narrative": "Retraits de 18k en 10 jours avant un déplacement vers une zone frontalière, sans explication — TP."
  },
  {
    "caseId": "GT-FT-04-FP-1",
    "scenarioId": "FT-04",
    "ruleRef": "R372",
    "famille": "FT",
    "label": "FP",
    "clientId": "CLI-00007",
    "narrative": "Retraits avant un pèlerinage documenté avec agence de voyage agréée et itinéraire fourni — motif religieux légitime, FP.",
    "ecartement": "motif documenté (pèlerinage, agence agréée, itinéraire)"
  },
  {
    "caseId": "GT-FT-05-TP-1",
    "scenarioId": "FT-05",
    "ruleRef": "R373",
    "famille": "FT",
    "label": "TP",
    "clientId": "CLI-00084",
    "narrative": "Match exact (nom + date de naissance) sur une liste d'ordonnance fédérale — gel et déclaration."
  },
  {
    "caseId": "GT-FT-05-FP-1",
    "scenarioId": "FT-05",
    "ruleRef": "R373",
    "famille": "FT",
    "label": "FP",
    "clientId": "CLI-00099",
    "narrative": "Homonymie sur un nom très courant, date de naissance divergente de 30 ans — levé après vérification, FP.",
    "ecartement": "homonymie (DDN divergente de 30 ans)"
  },
  {
    "caseId": "GT-GV-01-TP-1",
    "scenarioId": "GV-01",
    "ruleRef": "R374",
    "famille": "GV",
    "label": "TP",
    "clientId": "—",
    "narrative": "Campagne T2 : 2 cas suspects trouvés à 85% du seuil structuring → seuil abaissé de 20k à 18k (version v1.3, simulée puis déployée)."
  },
  {
    "caseId": "GT-GV-01-FP-1",
    "scenarioId": "GV-01",
    "ruleRef": "R374",
    "famille": "GV",
    "label": "FP",
    "clientId": "—",
    "narrative": "Campagne T3 : 0 TP sous seuil sur 25 dossiers échantillonnés → calibrage confirmé, rapport archivé.",
    "ecartement": "calibrage confirmé (0 TP sous seuil sur l'échantillon)"
  },
  {
    "caseId": "GT-GV-02-TP-1",
    "scenarioId": "GV-02",
    "ruleRef": "R375",
    "famille": "GV",
    "label": "TP",
    "clientId": "—",
    "narrative": "v1.2 du velocity : -40% de FP, 0 TP manqué sur 90j — changement validé et documenté."
  },
  {
    "caseId": "GT-GV-02-FP-1",
    "scenarioId": "GV-02",
    "ruleRef": "R375",
    "famille": "GV",
    "label": "FP",
    "clientId": "—",
    "narrative": "v2.0 du round-amounts aurait manqué 1 TP historique — rollback v1.4 exécuté, écart consigné.",
    "ecartement": "dégradation du rappel détectée (rollback v1.4)"
  },
  {
    "caseId": "GT-GV-03-TP-1",
    "scenarioId": "GV-03",
    "ruleRef": "R376",
    "famille": "GV",
    "label": "TP",
    "clientId": "—",
    "narrative": "Champ 50 vide sur 8% des messages d'un correspondant pendant 3 jours : le wire-stripping était indétectable — corrigé, période re-screenée."
  },
  {
    "caseId": "GT-GV-03-FP-1",
    "scenarioId": "GV-03",
    "ruleRef": "R376",
    "famille": "GV",
    "label": "FP",
    "clientId": "—",
    "narrative": "Chute de complétude due à un nouveau format ISO 20022 mal mappé (données présentes, parsing KO) — mapping corrigé, FP.",
    "ecartement": "parsing KO mais données présentes (mapping ISO 20022 corrigé)"
  },
  {
    "caseId": "GT-GV-04-TP-1",
    "scenarioId": "GV-04",
    "ruleRef": "R377",
    "famille": "GV",
    "label": "TP",
    "clientId": "—",
    "narrative": "Revue 2026 : 3 angles morts identifiés (TBML, CBK, prolifération) → wave 2 planifiée et arbitrée en comité."
  },
  {
    "caseId": "GT-GV-04-FP-1",
    "scenarioId": "GV-04",
    "ruleRef": "R377",
    "famille": "GV",
    "label": "FP",
    "clientId": "—",
    "narrative": "",
    "placeholder": true
  },
  {
    "caseId": "GT-TB-01-TP-1",
    "scenarioId": "TB-01",
    "ruleRef": "R378",
    "famille": "TB",
    "label": "TP",
    "clientId": "CLI-00130",
    "narrative": "Import de composants payés +22% vs benchmark sur 8 factures du même fournisseur lié — transfert de valeur confirmé."
  },
  {
    "caseId": "GT-TB-01-FP-1",
    "scenarioId": "TB-01",
    "ruleRef": "R378",
    "famille": "TB",
    "label": "FP",
    "clientId": "CLI-00101",
    "narrative": "Surcoût de +18% documenté par une clause d'urgence logistique (fret aérien vs maritime, contrat fourni) — FP."
  },
  {
    "caseId": "GT-TB-02-TP-1",
    "scenarioId": "TB-02",
    "ruleRef": "R379",
    "famille": "TB",
    "label": "TP",
    "clientId": "CLI-00130",
    "narrative": "Même connaissement financé deux fois via deux banques — double financement frauduleux confirmé."
  },
  {
    "caseId": "GT-TB-02-FP-1",
    "scenarioId": "TB-02",
    "ruleRef": "R379",
    "famille": "TB",
    "label": "FP",
    "clientId": "CLI-00193",
    "narrative": "Facture d'acompte puis facture de solde portant la même référence commande (schéma 30/70 contractuel) — FP."
  },
  {
    "caseId": "GT-TB-03-TP-1",
    "scenarioId": "TB-03",
    "ruleRef": "R380",
    "famille": "TB",
    "label": "TP",
    "clientId": "CLI-00130",
    "narrative": "Biens sous-facturés à 5% du prix de marché pour exfiltrer de la valeur au pays d'origine — TP."
  },
  {
    "caseId": "GT-TB-03-FP-1",
    "scenarioId": "TB-03",
    "ruleRef": "R380",
    "famille": "TB",
    "label": "FP",
    "clientId": "CLI-00037",
    "narrative": "Lot déclassé vendu à prix cassé avec certificat de non-conformité joint — décote documentée, FP."
  },
  {
    "caseId": "GT-TB-04-TP-1",
    "scenarioId": "TB-04",
    "ruleRef": "R381",
    "famille": "TB",
    "label": "TP",
    "clientId": "CLI-00039",
    "narrative": "Machines classées double usage routées via un intermédiaire vers une destination sous embargo — licence absente, TP."
  },
  {
    "caseId": "GT-TB-04-FP-1",
    "scenarioId": "TB-04",
    "ruleRef": "R381",
    "famille": "TB",
    "label": "FP",
    "clientId": "CLI-00142",
    "narrative": "Bien listé mais licence d'exportation SECO valide fournie et destinataire final vérifié — conforme, FP."
  },
  {
    "caseId": "GT-TB-05-TP-1",
    "scenarioId": "TB-05",
    "ruleRef": "R382",
    "famille": "TB",
    "label": "TP",
    "clientId": "CLI-00043",
    "narrative": "Intermédiaire des Caïmans intercalé entre acheteur et vendeur réels, marge de 12% sans fonction — écran, TP."
  },
  {
    "caseId": "GT-TB-05-FP-1",
    "scenarioId": "TB-05",
    "ruleRef": "R382",
    "famille": "TB",
    "label": "FP",
    "clientId": "CLI-00150",
    "narrative": "Maison de négoce établie jouant un rôle réel de contrepartie centrale (contrats et assurances au dossier) — FP."
  },
  {
    "caseId": "GT-TB-06-TP-1",
    "scenarioId": "TB-06",
    "ruleRef": "R383",
    "famille": "TB",
    "label": "TP",
    "clientId": "CLI-00130",
    "narrative": "Trois « expéditions » payées 1.1M au total, aucun conteneur n'a jamais quitté le port déclaré — TP."
  },
  {
    "caseId": "GT-TB-06-FP-1",
    "scenarioId": "TB-06",
    "ruleRef": "R383",
    "famille": "TB",
    "label": "FP",
    "clientId": "CLI-00193",
    "narrative": "Retard de mise à jour du tracking d'un transporteur secondaire (mouvement confirmé à J+4 par le B/L) — FP."
  },
  {
    "caseId": "GT-TB-07-TP-1",
    "scenarioId": "TB-07",
    "ruleRef": "R384",
    "famille": "TB",
    "label": "TP",
    "clientId": "CLI-00039",
    "narrative": "Détour par un port connu pour le maquillage d'origine (certificats réémis) — contournement d'embargo, TP."
  },
  {
    "caseId": "GT-TB-07-FP-1",
    "scenarioId": "TB-07",
    "ruleRef": "R384",
    "famille": "TB",
    "label": "FP",
    "clientId": "CLI-00150",
    "narrative": "Réacheminement dû à une congestion portuaire majeure documentée par l'armateur (avis publié) — FP."
  },
  {
    "caseId": "GT-TB-08-TP-1",
    "scenarioId": "TB-08",
    "ruleRef": "R385",
    "famille": "TB",
    "label": "TP",
    "clientId": "CLI-00101",
    "narrative": "Boucle de revente à valeur +15% par tour entre trois entités liées au même bénéficiaire — carrousel confirmé."
  },
  {
    "caseId": "GT-TB-08-FP-1",
    "scenarioId": "TB-08",
    "ruleRef": "R385",
    "famille": "TB",
    "label": "FP",
    "clientId": "CLI-00037",
    "narrative": "Négoce légitime de matières premières où les rôles s'inversent selon les cours (positions documentées) — FP."
  },
  {
    "caseId": "GT-CB-03-TP-1",
    "scenarioId": "CB-03",
    "ruleRef": "R386",
    "famille": "CB",
    "label": "TP",
    "clientId": "CLI-00130",
    "narrative": "Correspondant supprimant systématiquement le nom d'ordonnateurs iraniens (initiales seules) — stripping confirmé, relation revue."
  },
  {
    "caseId": "GT-CB-03-FP-1",
    "scenarioId": "CB-03",
    "ruleRef": "R386",
    "famille": "CB",
    "label": "FP",
    "clientId": "CLI-00018",
    "narrative": "Troncature technique de caractères non-latins par un système legacy (données complètes en pièce jointe MT199) — FP, correctif demandé."
  },
  {
    "caseId": "GT-CB-04-TP-1",
    "scenarioId": "CB-04",
    "ruleRef": "R387",
    "famille": "CB",
    "label": "TP",
    "clientId": "CLI-00070",
    "narrative": "Détour par deux correspondants pour masquer une contrepartie russe restreinte — contournement confirmé."
  },
  {
    "caseId": "GT-CB-04-FP-1",
    "scenarioId": "CB-04",
    "ruleRef": "R387",
    "famille": "CB",
    "label": "FP",
    "clientId": "CLI-00164",
    "narrative": "Paiement rejeté par la banque bénéficiaire (IBAN erroné) et retourné par une autre route — retour technique documenté, FP."
  },
  {
    "caseId": "GT-CB-05-TP-1",
    "scenarioId": "CB-05",
    "ruleRef": "R388",
    "famille": "CB",
    "label": "TP",
    "clientId": "CLI-00130",
    "narrative": "Répondant offrant à ses clients un accès quasi direct au nostro (milliers de micro-ordres) — PTA confirmé, convention résiliée."
  },
  {
    "caseId": "GT-CB-05-FP-1",
    "scenarioId": "CB-05",
    "ruleRef": "R388",
    "famille": "CB",
    "label": "FP",
    "clientId": "CLI-00018",
    "narrative": "Pic de petits ordres dû à une migration de paie groupée du répondant (préavisée par MT199) — usage propre, FP."
  },
  {
    "caseId": "GT-CB-06-TP-1",
    "scenarioId": "CB-06",
    "ruleRef": "R389",
    "famille": "CB",
    "label": "TP",
    "clientId": "CLI-00130",
    "narrative": "Répondant « retail domestique » devenu hub régional de flux vers zones grises sans mise à jour CBDDQ — dérive confirmée."
  },
  {
    "caseId": "GT-CB-06-FP-1",
    "scenarioId": "CB-06",
    "ruleRef": "R389",
    "famille": "CB",
    "label": "FP",
    "clientId": "CLI-00150",
    "narrative": "Croissance de corridor liée à l'acquisition documentée d'une banque voisine (communiqué + CBDDQ mis à jour) — FP."
  },
  {
    "caseId": "GT-CB-07-TP-1",
    "scenarioId": "CB-07",
    "ruleRef": "R390",
    "famille": "CB",
    "label": "TP",
    "clientId": "CLI-00043",
    "narrative": "Établissement caribéen sans licence vérifiable ni locaux (adresse = boîte postale d'un agent) — shell bank, blocage."
  },
  {
    "caseId": "GT-CB-07-FP-1",
    "scenarioId": "CB-07",
    "ruleRef": "R390",
    "famille": "CB",
    "label": "FP",
    "clientId": "CLI-00164",
    "narrative": "Banque digitale licenciée sans agences mais dûment supervisée (registre du régulateur consulté) — présence légale établie, FP."
  },
  {
    "caseId": "GT-CB-08-TP-1",
    "scenarioId": "CB-08",
    "ruleRef": "R391",
    "famille": "CB",
    "label": "TP",
    "clientId": "CLI-00130",
    "narrative": "RMA dormant réactivé soudainement pour une série de MT202 vers une zone grise — le canal oublié servait de porte dérobée."
  },
  {
    "caseId": "GT-CB-08-FP-1",
    "scenarioId": "CB-08",
    "ruleRef": "R391",
    "famille": "CB",
    "label": "FP",
    "clientId": "CLI-00018",
    "narrative": "RMA maintenu par exigence contractuelle d'un schéma de garantie multilatéral (convention au dossier) — justifié, FP."
  },
  {
    "caseId": "GT-CB-09-TP-1",
    "scenarioId": "CB-09",
    "ruleRef": "R392",
    "famille": "CB",
    "label": "TP",
    "clientId": "CLI-00130",
    "narrative": "Nouvel actionnaire de contrôle d'un répondant apparu sur liste de sanctions — relation suspendue après comité."
  },
  {
    "caseId": "GT-CB-09-FP-1",
    "scenarioId": "CB-09",
    "ruleRef": "R392",
    "famille": "CB",
    "label": "FP",
    "clientId": "CLI-00150",
    "narrative": "Adverse media visant l'homonyme d'une autre banque du même groupe de presse — établissement distinct, FP."
  },
  {
    "caseId": "GT-PF-01-TP-1",
    "scenarioId": "PF-01",
    "ruleRef": "R393",
    "famille": "PF",
    "label": "TP",
    "clientId": "CLI-00039",
    "narrative": "Cargaison d'origine russe payée au-dessus du price cap via un négociant intermédiaire — violation confirmée, blocage."
  },
  {
    "caseId": "GT-PF-01-FP-1",
    "scenarioId": "PF-01",
    "ruleRef": "R393",
    "famille": "PF",
    "label": "FP",
    "clientId": "CLI-00037",
    "narrative": "Pétrole d'origine certifiée kazakhe transitant par un port russe (certificat d'origine et pipeline documentés) — hors périmètre du plafond, FP."
  },
  {
    "caseId": "GT-PF-02-TP-1",
    "scenarioId": "PF-02",
    "ruleRef": "R394",
    "famille": "PF",
    "label": "TP",
    "clientId": "CLI-00043",
    "narrative": "Chaîne de trois écrans hongkongais récents aboutissant à une entité liée à un programme sous sanctions — TP."
  },
  {
    "caseId": "GT-PF-02-FP-1",
    "scenarioId": "PF-02",
    "ruleRef": "R394",
    "famille": "PF",
    "label": "FP",
    "clientId": "CLI-00045",
    "narrative": "Jeunes filiales de distribution d'un groupe industriel établi (organigramme et comptes consolidés fournis) — substance démontrée, FP."
  },
  {
    "caseId": "GT-PF-03-TP-1",
    "scenarioId": "PF-03",
    "ruleRef": "R395",
    "famille": "PF",
    "label": "TP",
    "clientId": "CLI-00080",
    "narrative": "Négociant horloger multipliant par 6 ses exports vers un relais notoire de réexportation — contournement confirmé."
  },
  {
    "caseId": "GT-PF-03-FP-1",
    "scenarioId": "PF-03",
    "ruleRef": "R395",
    "famille": "PF",
    "label": "FP",
    "clientId": "CLI-00063",
    "narrative": "Croissance liée à l'ouverture documentée d'une boutique franchisée locale (bail et licence fournis) — marché réel, FP."
  },
  {
    "caseId": "GT-IA-01-TP-1",
    "scenarioId": "IA-01",
    "ruleRef": "R396",
    "famille": "IA",
    "label": "TP",
    "clientId": "CLI-00005",
    "narrative": "Surpaiement de 60% via structure BVI : la survaleur revenait au vendeur complice — intégration confirmée."
  },
  {
    "caseId": "GT-IA-01-FP-1",
    "scenarioId": "IA-01",
    "ruleRef": "R396",
    "famille": "IA",
    "label": "FP",
    "clientId": "CLI-00152",
    "narrative": "Prime de 30% pour un bien de prestige off-market avec deux expertises concordantes au dossier — marché de niche, FP."
  },
  {
    "caseId": "GT-IA-02-TP-1",
    "scenarioId": "IA-02",
    "ruleRef": "R397",
    "famille": "IA",
    "label": "TP",
    "clientId": "CLI-00034",
    "narrative": "Aller-retour d'une œuvre entre deux entités du même bénéficiaire avec +40% — transfert de valeur habillé, TP."
  },
  {
    "caseId": "GT-IA-02-FP-1",
    "scenarioId": "IA-02",
    "ruleRef": "R397",
    "famille": "IA",
    "label": "FP",
    "clientId": "CLI-00016",
    "narrative": "Collectionneur établi cédant une pièce via une maison de vente publique (adjudication tierce, catalogue) — vente de marché, FP."
  },
  {
    "caseId": "GT-IA-03-TP-1",
    "scenarioId": "IA-03",
    "ruleRef": "R398",
    "famille": "IA",
    "label": "TP",
    "clientId": "CLI-00080",
    "narrative": "Rotation de véhicules de collection exportés vers un marchand relais, marges incohérentes — circulation de valeur, TP."
  },
  {
    "caseId": "GT-IA-03-FP-1",
    "scenarioId": "IA-03",
    "ruleRef": "R398",
    "famille": "IA",
    "label": "FP",
    "clientId": "CLI-00063",
    "narrative": "Passionné documenté (assurances, expertises, participation à des concours d'élégance) constituant sa collection — FP."
  },
  {
    "caseId": "GT-AN-01-TP-1",
    "scenarioId": "AN-01",
    "ruleRef": "R399",
    "famille": "AN",
    "label": "TP",
    "clientId": "CLI-00072",
    "narrative": "Cash à 4.2σ du groupe sans changement déclaré de situation — activité non expliquée, TP."
  },
  {
    "caseId": "GT-AN-01-FP-1",
    "scenarioId": "AN-01",
    "ruleRef": "R399",
    "famille": "AN",
    "label": "FP",
    "clientId": "CLI-00104",
    "narrative": "Pic à 3.8σ expliqué par la vente documentée d'une entreprise (CoC ouvert en amont) — événement de vie, FP."
  },
  {
    "caseId": "GT-AN-02-TP-1",
    "scenarioId": "AN-02",
    "ruleRef": "R400",
    "famille": "AN",
    "label": "TP",
    "clientId": "CLI-00099",
    "narrative": "Bascule complète du profil (nouveaux corridors, volumes ×3) après un changement de mandataire — compte repris en main par un tiers, TP."
  },
  {
    "caseId": "GT-AN-02-FP-1",
    "scenarioId": "AN-02",
    "ruleRef": "R400",
    "famille": "AN",
    "label": "FP",
    "clientId": "CLI-00016",
    "narrative": "Montée en charge annoncée d'un mandat de gestion élargi (avenant signé) — changement contractualisé, FP."
  },
  {
    "caseId": "GT-AN-03-TP-1",
    "scenarioId": "AN-03",
    "ruleRef": "R401",
    "famille": "AN",
    "label": "TP",
    "clientId": "CLI-00069",
    "narrative": "Premier international du compte : 180k vers une fiduciaire offshore inconnue, dossier à 2% de complétude — TP."
  },
  {
    "caseId": "GT-AN-03-FP-1",
    "scenarioId": "AN-03",
    "ruleRef": "R401",
    "famille": "AN",
    "label": "FP",
    "clientId": "CLI-00121",
    "narrative": "Premier virement France→UK pour l'inscription universitaire d'un enfant (attestation jointe) — vie courante, FP."
  },
  {
    "caseId": "GT-AN-04-TP-1",
    "scenarioId": "AN-04",
    "ruleRef": "R402",
    "famille": "AN",
    "label": "TP",
    "clientId": "CLI-00156",
    "narrative": "Segment cash réactivé par des dépôts fractionnés après 3 ans — le canal oublié sert au placement, TP."
  },
  {
    "caseId": "GT-AN-04-FP-1",
    "scenarioId": "AN-04",
    "ruleRef": "R402",
    "famille": "AN",
    "label": "FP",
    "clientId": "CLI-00053",
    "narrative": "Retraits cash réactivés pour des travaux payés en espèces à des artisans (devis et factures fournis) — usage ponctuel expliqué, FP."
  },
  {
    "caseId": "GT-AN-05-TP-1",
    "scenarioId": "AN-05",
    "ruleRef": "R403",
    "famille": "AN",
    "label": "TP",
    "clientId": "CLI-00080",
    "narrative": "« Salaires » de 45k versés par une société sans lien avec l'employeur déclaré — canal de distribution occulte, TP."
  },
  {
    "caseId": "GT-AN-05-FP-1",
    "scenarioId": "AN-05",
    "ruleRef": "R403",
    "famille": "AN",
    "label": "FP",
    "clientId": "CLI-00035",
    "narrative": "Bonus exceptionnel documenté par le certificat de salaire annuel (élément variable déclaré) — rémunération réelle, FP."
  }
];
