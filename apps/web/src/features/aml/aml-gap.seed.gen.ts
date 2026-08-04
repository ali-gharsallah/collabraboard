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
  }
];
