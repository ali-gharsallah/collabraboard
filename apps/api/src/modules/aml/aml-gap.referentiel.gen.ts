// GÉNÉRÉ par tools/aml-gap/gen_aml_gap.py — NE PAS ÉDITER À LA MAIN.
// Source de vérité de la vague AML Gap Wave 1 (R340–R377, blocs 50–56). Toute évolution
// d'une règle passe par le générateur ; le test de fraîcheur (test_gen_aml_gap.py) rougit
// si ce fichier dérive. Consommé par aml-gap.service.ts et aml-gap.wiring.spec.ts.

export interface AmlGapParam { key: string; label: string; default: string | number | boolean; }
export interface AmlGapRule {
  id: string; ruleRef: string; bloc: number; blocTitre: string; plage: string; famille: string;
  titre: string; desc: string; niveau: number | null; kind: 'detection' | 'ops' | 'campagne';
  blocking: boolean; signal: string;
  gherkin: { given: string; when: string; then: string };
  params: AmlGapParam[]; gtCount: { tp: number; fp: number };
}

export const AML_GAP_REFERENTIEL: AmlGapRule[] = [
  {
    "id": "SF-01",
    "ruleRef": "R340",
    "bloc": 50,
    "blocTitre": "Screening en flux",
    "plage": "R340–R346",
    "famille": "SF",
    "titre": "Contrepartie PEP en flux",
    "desc": "Screening PEP de la contrepartie de chaque transaction entrante/sortante, pas seulement du client à l'onboarding.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "PEP_COUNTERPARTY",
    "gherkin": {
      "given": "Un virement entrant de CHF 180k provient d'une contrepartie non cliente matchant une liste PEP (ministre en fonction, pays tiers).",
      "when": "Le screening en flux (nom + pays + date de naissance si dispo) matche la contrepartie avec un score >= seuil tenant.",
      "then": "Signal PEP_COUNTERPARTY (Niveau 2) — alerte CO avec fiche de match, aucune contamination du statut client sans revue humaine (R44)."
    },
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
    "gtCount": {
      "tp": 2,
      "fp": 1
    }
  },
  {
    "id": "SF-02",
    "ruleRef": "R341",
    "bloc": 50,
    "blocTitre": "Screening en flux",
    "plage": "R340–R346",
    "famille": "SF",
    "titre": "Adverse media sur contrepartie",
    "desc": "Presse négative (blanchiment, fraude, corruption) sur la contrepartie d'une transaction au moment du flux.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "ADVERSE_COUNTERPARTY",
    "gherkin": {
      "given": "Une sortie de CHF 60k vise une société citée la veille dans une enquête pour corruption (source de rang 1).",
      "when": "Le screening adverse media en flux matche la contrepartie avec une catégorie AML-pertinente et une source pondérée >= seuil.",
      "then": "Signal ADVERSE_COUNTERPARTY (Niveau 2) — alerte avec extrait sourcé et daté ; l'humain qualifie."
    },
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
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "SF-03",
    "ruleRef": "R342",
    "bloc": 50,
    "blocTitre": "Screening en flux",
    "plage": "R340–R346",
    "famille": "SF",
    "titre": "Re-screening périodique (perpetual)",
    "desc": "Re-screening automatique périodique de tout le stock clients + personnes liées (sanctions/PEP/adverse), différentiel uniquement.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "SCREENING_DELTA",
    "gherkin": {
      "given": "Le batch nocturne re-screene 5'000 clients ; un client existant apparaît nouvellement sur une liste PEP suite à une nomination.",
      "when": "Le différentiel (nouveau hit vs dernier run) est détecté et rattaché au dossier.",
      "then": "Événement screening.delta → ouverture automatique d'un Change of Circumstances typé SCREENING_DELTA, routé au rôle Compliance (registre CoC)."
    },
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
    "gtCount": {
      "tp": 2,
      "fp": 1
    }
  },
  {
    "id": "SF-04",
    "ruleRef": "R343",
    "bloc": 50,
    "blocTitre": "Screening en flux",
    "plage": "R340–R346",
    "famille": "SF",
    "titre": "Banques intermédiaires (BIC)",
    "desc": "Screening des BIC de la chaîne de paiement (champ 56/57), pas seulement des parties finales.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "INTERMEDIARY_HIT",
    "gherkin": {
      "given": "Un MT103 transite par une banque intermédiaire dont la maison mère est sous sanctions sectorielles.",
      "when": "Chaque BIC de la chaîne est screené contre les listes sanctions + liste interne banques à risque.",
      "then": "Signal INTERMEDIARY_HIT (Niveau 2) — routage alternatif proposé, décision humaine avant exécution."
    },
    "params": [
      {
        "key": "liste_bic_interne",
        "label": "Liste interne de banques surveillées",
        "default": "tenant"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "SF-05",
    "ruleRef": "R344",
    "bloc": 50,
    "blocTitre": "Screening en flux",
    "plage": "R340–R346",
    "famille": "SF",
    "titre": "Adresse / localisation sanctionnée",
    "desc": "Sanctions par localisation : adresses et villes de régions sous embargo (Crimée, régions occupées), au-delà du seul nom.",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "GEO_SANCTION",
    "gherkin": {
      "given": "Un virement sortant indique une adresse bénéficiaire à Sébastopol.",
      "when": "Le parsing d'adresse (ville, région, code postal) matche le référentiel géographique sanctionné.",
      "then": "TRANSACTION BLOQUÉE (Niveau 1) — motif géographique explicite, dossier MROS préparé, décision humaine requise (R44)."
    },
    "params": [
      {
        "key": "referentiel_geo_sanctions",
        "label": "Référentiel des zones sanctionnées",
        "default": "tenant"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "SF-06",
    "ruleRef": "R345",
    "bloc": 50,
    "blocTitre": "Screening en flux",
    "plage": "R340–R346",
    "famille": "SF",
    "titre": "Translittération multi-scripts",
    "desc": "Matching étendu arabe/cyrillique/chinois : variantes de translittération normalisées avant screening (le moteur IDF+trigram est latin-centrique).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "MULTISCRIPT_HIT",
    "gherkin": {
      "given": "Un ordonnateur « Мухаммад Аль-Рашид » (cyrillique) correspond à un profil sanctionné translittéré « Muhammad Al-Rashid ».",
      "when": "La normalisation multi-scripts (ICU + tables de translittération) produit les variantes avant le matching baseline.",
      "then": "Le hit est détecté malgré l'écart de script — signal standard du canal concerné, variante gagnante tracée."
    },
    "params": [
      {
        "key": "scripts_actifs",
        "label": "Scripts normalisés",
        "default": "AR,CYR,ZH"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "SF-07",
    "ruleRef": "R346",
    "bloc": 50,
    "blocTitre": "Screening en flux",
    "plage": "R340–R346",
    "famille": "SF",
    "titre": "Navires & IMO",
    "desc": "Screening des navires (nom, numéro IMO, pavillon) sur les paiements liés au négoce et au shipping.",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "VESSEL_HIT",
    "gherkin": {
      "given": "Un crédit documentaire référence un navire dont l'IMO figure sur la liste OFAC (shadow fleet).",
      "when": "Extraction du nom/IMO depuis les champs libres et les documents, screening dédié navires.",
      "then": "TRANSACTION BLOQUÉE (Niveau 1) — gel, escalade sanctions, décision humaine requise."
    },
    "params": [
      {
        "key": "extraction_imo",
        "label": "Extraction IMO des champs libres",
        "default": true
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "QO-01",
    "ruleRef": "R347",
    "bloc": 51,
    "blocTitre": "Indices OBA-FINMA",
    "plage": "R347–R351",
    "famille": "QO",
    "titre": "Refus de fournir des informations",
    "desc": "Le refus du client de fournir les informations usuelles (origine des fonds, justificatifs) devient un signal structuré, pas une note libre.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "INFO_REFUSAL",
    "gherkin": {
      "given": "Le RM demande un justificatif d'origine pour un apport de CHF 500k ; le client refuse explicitement à deux reprises.",
      "when": "Le RM déclare le refus via le workflow dédié (motif, pièces demandées, dates) — événement kyc.refus_information.",
      "then": "Signal INFO_REFUSAL (Niveau 2) — tâche CO, blocage possible de l'apport après décision humaine, trace au registre art. 7."
    },
    "params": [
      {
        "key": "nb_relances_avant_signal",
        "label": "Relances avant signal",
        "default": 2
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "QO-02",
    "ruleRef": "R348",
    "bloc": 51,
    "blocTitre": "Indices OBA-FINMA",
    "plage": "R347–R351",
    "famille": "QO",
    "titre": "Compte de passage multi-titulaires",
    "desc": "Compte utilisé comme compte de passage par de nombreuses personnes distinctes (indice annexe OBA-FINMA), au-delà du seul critère temporel.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "TRANSIT_ACCOUNT",
    "gherkin": {
      "given": "Un compte reçoit des fonds de 9 ordonnateurs distincts sans lien documenté en 30 jours, ressortis vers 6 bénéficiaires.",
      "when": "Comptage des tiers distincts entrée + sortie / fenêtre glissante, croisé avec les personnes liées du KYC.",
      "then": "Signal TRANSIT_ACCOUNT (Niveau 2) — cartographie des tiers jointe, revue du but de la relation."
    },
    "params": [
      {
        "key": "tiers_distincts_seuil",
        "label": "Tiers distincts / 30j",
        "default": 6
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "QO-03",
    "ruleRef": "R349",
    "bloc": 51,
    "blocTitre": "Indices OBA-FINMA",
    "plage": "R347–R351",
    "famille": "QO",
    "titre": "Opération sans justification économique",
    "desc": "Red flag déclaratif du conseiller : opération constatée sans justification économique apparente, tracée et routée (jamais silencieuse).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "NO_ECON_RATIONALE",
    "gherkin": {
      "given": "Le RM constate un achat-revente de titres à perte immédiate entre comptes du même client, sans logique d'investissement.",
      "when": "Le RM soulève le red flag via le formulaire structuré (opération, constat, échange client) — événement rm.redflag.",
      "then": "Signal NO_ECON_RATIONALE (Niveau 2) — investigation CO, réponse du client consignée."
    },
    "params": [
      {
        "key": "delai_reponse_client",
        "label": "Délai de réponse attendu (jours)",
        "default": 10
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "QO-04",
    "ruleRef": "R350",
    "bloc": 51,
    "blocTitre": "Indices OBA-FINMA",
    "plage": "R347–R351",
    "famille": "QO",
    "titre": "Adresse partagée multi-clients",
    "desc": "Domiciliation c/o ou adresse identique partagée par de nombreux clients sans lien déclaré.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "SHARED_ADDRESS",
    "gherkin": {
      "given": "8 clients sans lien familial ni sociétal déclaré partagent la même adresse de domiciliation c/o une fiduciaire.",
      "when": "Normalisation d'adresse + comptage des clients distincts par adresse, seuil tenant.",
      "then": "Signal SHARED_ADDRESS (Niveau 1) — revue du caractère de société de domicile (CDB 20, form. K)."
    },
    "params": [
      {
        "key": "clients_par_adresse_seuil",
        "label": "Clients distincts par adresse",
        "default": 5
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "QO-05",
    "ruleRef": "R351",
    "bloc": 51,
    "blocTitre": "Indices OBA-FINMA",
    "plage": "R347–R351",
    "famille": "QO",
    "titre": "Rotation des procurations / instructions",
    "desc": "Changements fréquents de procurations, signataires ou instructions permanentes sans justification.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "GOVERNANCE_CHURN",
    "gherkin": {
      "given": "3 changements de fondé de pouvoir en 6 mois, dont un révoqué 2 semaines après nomination.",
      "when": "Comptage des événements de gouvernance du compte / fenêtre, croisé avec l'activité transactionnelle.",
      "then": "Signal GOVERNANCE_CHURN (Niveau 2) — revue de la maîtrise réelle du compte (ADE effectif)."
    },
    "params": [
      {
        "key": "chgts_gouvernance_seuil",
        "label": "Changements / 6 mois",
        "default": 3
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "GU-01",
    "ruleRef": "R352",
    "bloc": 52,
    "blocTitre": "Vision groupe UBO",
    "plage": "R352–R355",
    "famille": "GU",
    "titre": "Structuring cross-comptes du groupe",
    "desc": "Agrégation des flux sur le périmètre consolidé de l'UBO (tous comptes, toutes entités) : le fractionnement réparti sur plusieurs entités devient visible.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "GROUP_STRUCTURING",
    "gherkin": {
      "given": "Un UBO contrôle 4 entités ; chacune dépose CHF 18k la même semaine (72k agrégés, unitaire sous le seuil de 20k).",
      "when": "Le moteur agrège par ubo_group_id (graphe des personnes liées) sur la fenêtre glissante.",
      "then": "Signal GROUP_STRUCTURING (Niveau 2) — vue consolidée jointe, chaque entité référencée."
    },
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
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "GU-02",
    "ruleRef": "R353",
    "bloc": 52,
    "blocTitre": "Vision groupe UBO",
    "plage": "R352–R355",
    "famille": "GU",
    "titre": "Flux circulaires intra-groupe",
    "desc": "Fonds circulant entre entités du même UBO sans substance (A→B→C→A intra-périmètre).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "GROUP_CIRCULAR",
    "gherkin": {
      "given": "CHF 300k font le tour de 3 entités du même UBO en 12 jours et reviennent au point de départ.",
      "when": "Détection de cycle sur le graphe restreint au périmètre UBO.",
      "then": "Signal GROUP_CIRCULAR (Niveau 2) — demande de justification économique consolidée."
    },
    "params": [
      {
        "key": "duree_cycle_max",
        "label": "Durée max du cycle détecté (jours)",
        "default": 30
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "GU-03",
    "ruleRef": "R354",
    "bloc": 52,
    "blocTitre": "Vision groupe UBO",
    "plage": "R352–R355",
    "famille": "GU",
    "titre": "Cash consolidé du périmètre",
    "desc": "Intensité cash mesurée au niveau du périmètre UBO : chaque entité reste sous les radars, le groupe non.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "GROUP_CASH_INTENSITY",
    "gherkin": {
      "given": "5 entités du même UBO déposent chacune ~CHF 9k d'espèces par mois (45k/mois consolidés).",
      "when": "Ratio cash consolidé / volume consolidé du groupe, seuils par groupe CPSI.",
      "then": "Signal GROUP_CASH_INTENSITY (Niveau 2) — ventilation par entité jointe."
    },
    "params": [
      {
        "key": "ratio_cash_groupe",
        "label": "Ratio cash consolidé max (%)",
        "default": 25
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "GU-04",
    "ruleRef": "R355",
    "bloc": 52,
    "blocTitre": "Vision groupe UBO",
    "plage": "R352–R355",
    "famille": "GU",
    "titre": "Seuils agrégés cross-produits",
    "desc": "Agrégation cash + titres + FX + crédit : un pattern réparti entre produits (dépôt cash, achat titres FOP, tirage lombard) est détecté globalement.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "CROSS_PRODUCT_AGGREGATE",
    "gherkin": {
      "given": "Dépôt cash 15k + transfert in-specie 40k + tirage lombard 30k la même semaine, aucun produit ne franchit seul son seuil.",
      "when": "Normalisation en équivalent CHF et agrégation cross-produits par client et par groupe UBO.",
      "then": "Signal CROSS_PRODUCT_AGGREGATE (Niveau 2) — décomposition par produit jointe."
    },
    "params": [
      {
        "key": "seuil_cross_produits",
        "label": "Seuil agrégé équivalent (CHF)",
        "default": 75000
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "IP-01",
    "ruleRef": "R356",
    "bloc": 53,
    "blocTitre": "Instruments PB",
    "plage": "R356–R362",
    "famille": "IP",
    "titre": "Lombard — remboursement par tiers",
    "desc": "Crédit lombard remboursé par anticipation par un tiers sans lien documenté avec l'emprunteur.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "LOMBARD_THIRD_PARTY",
    "gherkin": {
      "given": "Un lombard de CHF 800k est soldé 4 mois après tirage par un virement d'une société tierce inconnue du dossier.",
      "when": "Croisement remboursement anticipé × identité de l'ordonnateur × personnes liées du KYC.",
      "then": "Signal LOMBARD_THIRD_PARTY (Niveau 2) — fonds en attente de documentation SOF avant mainlevée du nantissement."
    },
    "params": [
      {
        "key": "delai_anticipe_min",
        "label": "Remboursement considéré anticipé si < (mois)",
        "default": 12
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "IP-02",
    "ruleRef": "R357",
    "bloc": 53,
    "blocTitre": "Instruments PB",
    "plage": "R356–R362",
    "famille": "IP",
    "titre": "Back-to-back loan",
    "desc": "Dépôt (souvent offshore) nantissant un prêt accordé à une entité liée : séparation artificielle de l'origine des fonds.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "BACK_TO_BACK",
    "gherkin": {
      "given": "Un dépôt de CHF 2M d'une entité des Caïmans garantit un prêt de 1.8M à une société suisse du même UBO.",
      "when": "Détection nantissement × prêt dont déposant et emprunteur partagent le périmètre UBO ou des liens déclarés/détectés.",
      "then": "Signal BACK_TO_BACK (Niveau 1) — origine du dépôt à corroborer avant tout tirage, escalade EDD."
    },
    "params": [
      {
        "key": "perimetre_lien",
        "label": "Liens retenus (UBO, famille, signataires)",
        "default": "tenant"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "IP-03",
    "ruleRef": "R358",
    "bloc": 53,
    "blocTitre": "Instruments PB",
    "plage": "R356–R362",
    "famille": "IP",
    "titre": "Wrapper assurance — prime hors profil",
    "desc": "Souscription d'assurance-vie à prime unique élevée, incohérente avec le patrimoine et les revenus déclarés.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "WRAPPER_PREMIUM",
    "gherkin": {
      "given": "Prime unique de CHF 1.5M pour un client au patrimoine déclaré de 900k.",
      "when": "Ratio prime / patrimoine déclaré + origine de la prime (compte tiers ?).",
      "then": "Signal WRAPPER_PREMIUM (Niveau 2) — corroboration SOW avant acceptation du contrat."
    },
    "params": [
      {
        "key": "ratio_prime_patrimoine",
        "label": "Ratio prime/patrimoine max (%)",
        "default": 60
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "IP-04",
    "ruleRef": "R359",
    "bloc": 53,
    "blocTitre": "Instruments PB",
    "plage": "R356–R362",
    "famille": "IP",
    "titre": "Wrapper assurance — rachat précoce",
    "desc": "Rachat de la police peu après souscription, pénalités acceptées sans discussion (le coût du blanchiment est assumé).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "EARLY_SURRENDER",
    "gherkin": {
      "given": "Rachat total à 7 mois d'une police à prime unique, pénalité de 4% acceptée sans négociation.",
      "when": "Délai souscription→rachat < seuil + acceptation de pénalité + bénéficiaire du rachat ≠ souscripteur.",
      "then": "Signal EARLY_SURRENDER (Niveau 2) — investigation sur la finalité réelle du produit."
    },
    "params": [
      {
        "key": "delai_rachat_min",
        "label": "Rachat considéré précoce si < (mois)",
        "default": 24
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "IP-05",
    "ruleRef": "R360",
    "bloc": 53,
    "blocTitre": "Instruments PB",
    "plage": "R356–R362",
    "famille": "IP",
    "titre": "Changement de bénéficiaire post-souscription",
    "desc": "Modification du bénéficiaire de la police peu après souscription, vers un tiers sans lien.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "BENEFICIARY_SWITCH",
    "gherkin": {
      "given": "Le bénéficiaire passe du conjoint à une société étrangère 3 mois après souscription.",
      "when": "Événement de changement de bénéficiaire × délai × nature du nouveau bénéficiaire.",
      "then": "Signal BENEFICIARY_SWITCH (Niveau 2) — justification requise, CoC ouvert."
    },
    "params": [
      {
        "key": "delai_chgt_benef",
        "label": "Fenêtre de surveillance post-souscription (mois)",
        "default": 24
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "IP-06",
    "ruleRef": "R361",
    "bloc": 53,
    "blocTitre": "Instruments PB",
    "plage": "R356–R362",
    "famille": "IP",
    "titre": "Coffres — corrélation cash",
    "desc": "Accès au coffre-fort corrélés temporellement à des dépôts ou retraits d'espèces.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "VAULT_CASH_PATTERN",
    "gherkin": {
      "given": "6 accès au coffre en 2 mois, chacun suivi sous 24h d'un dépôt espèces de 15-19k.",
      "when": "Corrélation temporelle accès coffre × mouvements cash / fenêtre.",
      "then": "Signal VAULT_CASH_PATTERN (Niveau 2) — entretien client et corroboration d'origine."
    },
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
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "IP-07",
    "ruleRef": "R362",
    "bloc": 53,
    "blocTitre": "Instruments PB",
    "plage": "R356–R362",
    "famille": "IP",
    "titre": "Métaux précieux physiques",
    "desc": "Achats/ventes/livraisons de métaux physiques hors profil déclaré (OBA négoce OR).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "PHYSICAL_METALS",
    "gherkin": {
      "given": "Achat de 12 kg d'or physique avec livraison hors banque, client sans profil métaux.",
      "when": "Volume métaux / profil déclaré + mode de livraison (garde vs sortie physique).",
      "then": "Signal PHYSICAL_METALS (Niveau 2) — sortie physique documentée, destination tracée."
    },
    "params": [
      {
        "key": "seuil_metaux",
        "label": "Équivalent CHF / 90j",
        "default": 100000
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "CR-01",
    "ruleRef": "R363",
    "bloc": 54,
    "blocTitre": "Crypto / VASP",
    "plage": "R363–R368",
    "famille": "CR",
    "titre": "Travel rule DLT",
    "desc": "Transferts DLT sans informations complètes d'ordonnateur/bénéficiaire (comm. FINMA 02/2019, GAFI R.16).",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "TRAVEL_RULE_GAP",
    "gherkin": {
      "given": "Un transfert sortant de 0.8 BTC vise un VASP qui ne transmet pas les informations travel rule.",
      "when": "Contrôle de complétude des données travel rule avant exécution du transfert.",
      "then": "TRANSFERT BLOQUÉ (Niveau 1) — jusqu'à réception des informations ou décision humaine documentée."
    },
    "params": [
      {
        "key": "vasp_conformes",
        "label": "Registre des VASP conformes travel rule",
        "default": "tenant"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "CR-02",
    "ruleRef": "R364",
    "bloc": 54,
    "blocTitre": "Crypto / VASP",
    "plage": "R363–R368",
    "famille": "CR",
    "titre": "Exposition mixer / tumbler",
    "desc": "Fonds entrants dont l'analyse on-chain révèle une exposition directe ou à 1 hop à un mixer.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "MIXER_EXPOSURE",
    "gherkin": {
      "given": "Un dépôt de 2.1 BTC provient à 64% d'un mixer connu (analyse de provenance).",
      "when": "Score d'exposition mixer du fournisseur d'analytique on-chain >= seuil (paramètre tenant, intégration Chainalysis/Elliptic).",
      "then": "Signal MIXER_EXPOSURE (Niveau 1) — fonds gelés en attente d'explication, EDD."
    },
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
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "CR-03",
    "ruleRef": "R365",
    "bloc": 54,
    "blocTitre": "Crypto / VASP",
    "plage": "R363–R368",
    "famille": "CR",
    "titre": "Adresse sanctionnée on-chain",
    "desc": "Contrepartie on-chain figurant dans les adresses crypto de la liste SDN OFAC.",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "ONCHAIN_SANCTION",
    "gherkin": {
      "given": "Une adresse de destination correspond à une adresse SDN (entité de ransomware listée).",
      "when": "Screening des adresses contre les listes crypto SDN/SECO à l'initiation.",
      "then": "TRANSFERT BLOQUÉ (Niveau 1) — gel, dossier sanctions, MROS préparé."
    },
    "params": [
      {
        "key": "listes_adresses",
        "label": "Listes d'adresses actives",
        "default": "OFAC,SECO"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "CR-04",
    "ruleRef": "R366",
    "bloc": 54,
    "blocTitre": "Crypto / VASP",
    "plage": "R363–R368",
    "famille": "CR",
    "titre": "Cluster darknet / ransomware",
    "desc": "Exposition de provenance à des clusters darknet markets ou ransomware (hors listes formelles).",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "ILLICIT_CLUSTER",
    "gherkin": {
      "given": "Provenance à 30% d'un cluster étiqueté darknet market par l'analytique on-chain.",
      "when": "Score de provenance par catégorie de cluster >= seuil.",
      "then": "Signal ILLICIT_CLUSTER (Niveau 1) — fonds en quarantaine, investigation."
    },
    "params": [
      {
        "key": "seuil_cluster_illicite",
        "label": "Provenance illicite max (%)",
        "default": 5
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "CR-05",
    "ruleRef": "R367",
    "bloc": 54,
    "blocTitre": "Crypto / VASP",
    "plage": "R363–R368",
    "famille": "CR",
    "titre": "Wallet auto-hébergé sans preuve",
    "desc": "Transferts vers/depuis un wallet auto-hébergé sans preuve de contrôle (satoshi test / signature de message).",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "UNHOSTED_NOPROOF",
    "gherkin": {
      "given": "Le client demande une sortie de 50k CHF en ETH vers un wallet non custodial jamais vérifié.",
      "when": "Contrôle d'existence d'une preuve de contrôle valide pour l'adresse (registre des adresses vérifiées).",
      "then": "SORTIE BLOQUÉE (Niveau 1) — jusqu'à preuve de contrôle (signature) enregistrée."
    },
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
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "CR-06",
    "ruleRef": "R368",
    "bloc": 54,
    "blocTitre": "Crypto / VASP",
    "plage": "R363–R368",
    "famille": "CR",
    "titre": "On/off-ramp incohérent au profil",
    "desc": "Fréquence et volumes de conversion fiat↔crypto incohérents avec le profil d'investisseur déclaré.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "RAMP_VELOCITY",
    "gherkin": {
      "given": "Un client « investisseur long terme » convertit fiat→crypto→fiat 14 fois en un mois.",
      "when": "Compteur de cycles on/off-ramp / 30j vs profil déclaré (au-delà du simple seuil CHF de l'ancienne règle AML-11).",
      "then": "Signal RAMP_VELOCITY (Niveau 2) — revue du profil transactionnel crypto."
    },
    "params": [
      {
        "key": "cycles_ramp_seuil",
        "label": "Cycles / 30j",
        "default": 6
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "FT-01",
    "ruleRef": "R369",
    "bloc": 55,
    "blocTitre": "CFT",
    "plage": "R369–R373",
    "famille": "FT",
    "titre": "Micro-transactions vers corridors sensibles",
    "desc": "Petits montants à haute fréquence vers des corridors géographiques sensibles (le CFT ne ressemble pas au blanchiment : montants faibles).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "CFT_MICRO_PATTERN",
    "gherkin": {
      "given": "23 transferts de CHF 150-400 en 60 jours vers 3 pays limitrophes d'une zone de conflit.",
      "when": "Fréquence × faible montant unitaire × corridor sensible (liste tenant distincte des HRJ blanchiment).",
      "then": "Signal CFT_MICRO_PATTERN (Niveau 2) — analyse dédiée CFT, jamais agrégé avec les seuils ML classiques."
    },
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
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "FT-02",
    "ruleRef": "R370",
    "bloc": 55,
    "blocTitre": "CFT",
    "plage": "R369–R373",
    "famille": "FT",
    "titre": "Collectes / ONG à risque",
    "desc": "Dons et collectes atypiques vers des organisations à but non lucratif à risque (GAFI R.8), crowdfunding non tracé.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "NPO_RISK",
    "gherkin": {
      "given": "Des dons partent vers une association récemment créée, sans agrément, active dans une zone à risque.",
      "when": "Croisement bénéficiaire ONG × registre des NPO à risque × ancienneté/agrément.",
      "then": "Signal NPO_RISK (Niveau 2) — vérification de l'organisation et de la chaîne de distribution des fonds."
    },
    "params": [
      {
        "key": "registre_npo",
        "label": "Référentiel NPO surveillées",
        "default": "tenant"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "FT-03",
    "ruleRef": "R371",
    "bloc": 55,
    "blocTitre": "CFT",
    "plage": "R369–R373",
    "famille": "FT",
    "titre": "Cartes prépayées multi-sources",
    "desc": "Rechargements de cartes prépayées depuis des sources multiples, retraits en zone frontalière ou à l'étranger.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "PREPAID_FUNDING",
    "gherkin": {
      "given": "Une carte est rechargée par 5 personnes différentes puis vidée en retraits ATM dans un pays frontalier d'une zone de conflit.",
      "when": "Nombre de sources de rechargement distinctes + géographie des retraits.",
      "then": "Signal PREPAID_FUNDING (Niveau 2) — gel du rechargement tiers après décision humaine."
    },
    "params": [
      {
        "key": "sources_rechargement_seuil",
        "label": "Sources distinctes / 90j",
        "default": 3
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "FT-04",
    "ruleRef": "R372",
    "bloc": 55,
    "blocTitre": "CFT",
    "plage": "R369–R373",
    "famille": "FT",
    "titre": "Cohérence voyages ↔ flux",
    "desc": "Croisement des Business Trips / voyages connus du client avec des flux vers zones de conflit (le module Trip existe côté RM ; le croisement CFT n'existe pas).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "TRAVEL_FLOW_MISMATCH",
    "gherkin": {
      "given": "Un client retire du cash inhabituel juste avant un voyage déclaré vers un pays frontalier d'une zone de conflit.",
      "when": "Corrélation temporelle voyage déclaré/détecté × retraits cash atypiques × destination sensible.",
      "then": "Signal TRAVEL_FLOW_MISMATCH (Niveau 2) — entretien de clarification, trace CFT dédiée."
    },
    "params": [
      {
        "key": "fenetre_voyage",
        "label": "Fenêtre avant/après voyage (jours)",
        "default": 14
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "FT-05",
    "ruleRef": "R373",
    "bloc": 55,
    "blocTitre": "CFT",
    "plage": "R369–R373",
    "famille": "FT",
    "titre": "Listes terroristes dédiées",
    "desc": "Screening distinct contre les ordonnances/listes terroristes (séparé des sanctions économiques : gouvernance, escalade et déclaration diffèrent).",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "CFT_LIST_HIT",
    "gherkin": {
      "given": "Une contrepartie matche une liste d'une ordonnance fédérale anti-terrorisme (hors listes SECO économiques).",
      "when": "Canal de screening dédié listes CFT, avec circuit d'escalade propre.",
      "then": "TRANSACTION BLOQUÉE (Niveau 1) — gel immédiat, MROS, escalade direction, décision humaine tracée."
    },
    "params": [
      {
        "key": "listes_cft",
        "label": "Listes CFT actives",
        "default": "tenant"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "GV-01",
    "ruleRef": "R374",
    "bloc": 56,
    "blocTitre": "Gouvernance du dispositif",
    "plage": "R374–R377",
    "famille": "GV",
    "titre": "Below-the-line sampling",
    "desc": "Campagne périodique d'échantillonnage sous les seuils : des transactions juste en-dessous des seuils actifs sont revues pour valider le calibrage.",
    "niveau": null,
    "kind": "campagne",
    "blocking": false,
    "signal": "tuning.btl.campagne",
    "gherkin": {
      "given": "Le trimestre écoulé compte 1'240 transactions entre 80% et 100% du seuil du scénario structuring.",
      "when": "La campagne BTL tire un échantillon stratifié (paramètre tenant) et le route en revue Compliance.",
      "then": "Événement tuning.btl.campagne — résultats consolidés : si des TP sont trouvés sous le seuil, proposition de baisse via l'Intelligence Studio (validation humaine, versionnée, réversible)."
    },
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
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "GV-02",
    "ruleRef": "R375",
    "bloc": 56,
    "blocTitre": "Gouvernance du dispositif",
    "plage": "R374–R377",
    "famille": "GV",
    "titre": "Backtesting par version",
    "desc": "Backtesting formel de chaque version de scénario : TP/FP historisés par version, comparaison avant/après tout changement de seuil.",
    "niveau": null,
    "kind": "campagne",
    "blocking": false,
    "signal": "tuning.backtest.run",
    "gherkin": {
      "given": "Le seuil du scénario velocity est passé de 4× à 5× il y a 90 jours (v1.2).",
      "when": "Le backtest rejoue la fenêtre sur les deux versions et compare TP, FP, alertes manquées.",
      "then": "Rapport de backtest versionné attaché à la version du scénario — rollback proposé si dégradation du rappel (décision humaine)."
    },
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
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "GV-03",
    "ruleRef": "R376",
    "bloc": 56,
    "blocTitre": "Gouvernance du dispositif",
    "plage": "R374–R377",
    "famille": "GV",
    "titre": "Data quality pré-conditions",
    "desc": "Contrôles de qualité de données amont comme pré-condition des scénarios : un scénario aveugle (champs SWIFT incomplets, devises manquantes) est un faux négatif silencieux.",
    "niveau": 1,
    "kind": "ops",
    "blocking": false,
    "signal": "DQ_DEGRADED",
    "gherkin": {
      "given": "8% des MT103 du jour arrivent sans champ ordonnateur exploitable.",
      "when": "Le contrôle DQ mesure la complétude des champs critiques par flux ; sous le seuil, les scénarios dépendants sont marqués « dégradés ».",
      "then": "Signal DQ_DEGRADED (Niveau 1, ops) — visible au dashboard Compliance, jamais silencieux (esprit dead-letters R39)."
    },
    "params": [
      {
        "key": "completude_min",
        "label": "Complétude minimale des champs critiques (%)",
        "default": 98
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "GV-04",
    "ruleRef": "R377",
    "bloc": 56,
    "blocTitre": "Gouvernance du dispositif",
    "plage": "R374–R377",
    "famille": "GV",
    "titre": "Revue annuelle de calibrage",
    "desc": "Revue annuelle documentée du dispositif : couverture typologique, performance par scénario, décisions de calibrage — annexée au rapport LBA Direction (art. 25a OBA-FINMA).",
    "niveau": null,
    "kind": "campagne",
    "blocking": false,
    "signal": "tuning.calibrage.annuel",
    "gherkin": {
      "given": "L'exercice se clôt ; chaque scénario a un historique TP/FP et des versions.",
      "when": "La revue consolide couverture (matrice typologies GAFI × scénarios), performance et écarts.",
      "then": "Rapport de calibrage annuel généré, visé four-eyes, archivé GED — section dédiée du rapport Direction."
    },
    "params": [
      {
        "key": "matrice_couverture",
        "label": "Référentiel de typologies de la matrice",
        "default": "GAFI+OBA-FINMA"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "TB-01",
    "ruleRef": "R378",
    "bloc": 57,
    "blocTitre": "TBML",
    "plage": "R378–R385",
    "famille": "TB",
    "titre": "Surfacturation (over-invoicing)",
    "desc": "Factures systématiquement payées au-dessus de la valeur de marché des biens — miroir sortant de R201 : la survaleur transfère du blanchiment sous couvert commercial.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "OVER_INVOICING",
    "gherkin": {
      "given": "8 paiements de factures d'import présentent un écart constant de +22% vs le prix de référence des biens (code HS).",
      "when": "Écart récurrent ≥ seuil entre montant payé et valeur de référence, sur ≥ N factures / 90j.",
      "then": "Signal OVER_INVOICING (Niveau 2) — analyse trade finance, justificatifs contractuels et incoterms demandés."
    },
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
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "TB-02",
    "ruleRef": "R379",
    "bloc": 57,
    "blocTitre": "TBML",
    "plage": "R378–R385",
    "famille": "TB",
    "titre": "Facturation multiple",
    "desc": "Le même bien ou la même expédition est facturé et payé plusieurs fois, via un ou plusieurs financeurs.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "MULTIPLE_INVOICING",
    "gherkin": {
      "given": "Deux paiements de CHF 140k référencent le même connaissement (B/L) à 3 semaines d'écart.",
      "when": "Déduplication des références documentaires (B/L, facture, conteneur) sur les paiements trade / 180j.",
      "then": "Signal MULTIPLE_INVOICING (Niveau 2) — documents originaux exigés, vérification auprès du transporteur."
    },
    "params": [
      {
        "key": "fenetre_dedup",
        "label": "fenêtre de déduplication",
        "default": 180
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "TB-03",
    "ruleRef": "R380",
    "bloc": 57,
    "blocTitre": "TBML",
    "plage": "R378–R385",
    "famille": "TB",
    "titre": "Prix hors benchmark (unit price)",
    "desc": "Analyse du prix unitaire par code HS contre des référentiels de prix de marché — les écarts extrêmes signent la mis-invoicing.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "UNIT_PRICE_ANOMALY",
    "gherkin": {
      "given": "Des « composants électroniques » sont facturés CHF 2 pièce alors que le référentiel HS donne 40-60.",
      "when": "Prix unitaire vs distribution de référence du code HS ; écart au-delà des percentiles paramétrés.",
      "then": "Signal UNIT_PRICE_ANOMALY (Niveau 2) — nature réelle des biens à corroborer."
    },
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
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "TB-04",
    "ruleRef": "R381",
    "bloc": 57,
    "blocTitre": "TBML",
    "plage": "R378–R385",
    "famille": "TB",
    "titre": "Biens à double usage",
    "desc": "Paiements liés à des biens à double usage (annexes du contrôle des exportations) vers des destinations sensibles.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "DUAL_USE",
    "gherkin": {
      "given": "Un paiement finance des machines-outils de précision classées double usage vers un intermédiaire au pays tiers.",
      "when": "Classification des biens (HS + libellés) croisée avec les listes de contrôle des exportations et la destination finale.",
      "then": "Signal DUAL_USE (Niveau 1) — licence d'exportation SECO à exiger avant exécution, escalade sanctions."
    },
    "params": [
      {
        "key": "listes_controle",
        "label": "listes de contrôle actives",
        "default": "SECO,EU"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "TB-05",
    "ruleRef": "R382",
    "bloc": 57,
    "blocTitre": "TBML",
    "plage": "R378–R385",
    "famille": "TB",
    "titre": "LC back-to-back / crédits doc HRJ",
    "desc": "Lettres de crédit adossées (back-to-back) ou crédits documentaires dont la chaîne implique des juridictions à risque sans logique commerciale.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "BACK_TO_BACK_LC",
    "gherkin": {
      "given": "Une LC est adossée à une seconde LC émise pour un intermédiaire offshore qui ne touche jamais la marchandise.",
      "when": "Détection de LC adossées × intermédiaires sans rôle logistique × juridictions de la chaîne.",
      "then": "Signal BACK_TO_BACK_LC (Niveau 2) — substance de l'intermédiaire à démontrer."
    },
    "params": [
      {
        "key": "hrj_trade",
        "label": "liste juridictions trade à risque",
        "default": "tenant"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "TB-06",
    "ruleRef": "R383",
    "bloc": 57,
    "blocTitre": "TBML",
    "plage": "R378–R385",
    "famille": "TB",
    "titre": "Phantom shipping",
    "desc": "Paiement sans mouvement de marchandise vérifiable : documents absents, navires inexistants, conteneurs fantômes.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "PHANTOM_SHIPMENT",
    "gherkin": {
      "given": "Un paiement de CHF 380k référence un conteneur dont le tracking ne montre aucun mouvement.",
      "when": "Vérification d'existence du voyage (API tracking conteneurs/navires) pour les paiements trade ≥ seuil.",
      "then": "Signal PHANTOM_SHIPMENT (Niveau 1) — fonds gelés en attente de preuve d'expédition, EDD."
    },
    "params": [
      {
        "key": "seuil_verif_tracking",
        "label": "seuil de vérification",
        "default": 100000
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "TB-07",
    "ruleRef": "R384",
    "bloc": 57,
    "blocTitre": "TBML",
    "plage": "R378–R385",
    "famille": "TB",
    "titre": "Routes & transbordements atypiques",
    "desc": "Routes maritimes incohérentes avec la géographie commerciale : détours, transbordements multiples, pavillons changés en cours de voyage.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "ROUTE_ANOMALY",
    "gherkin": {
      "given": "Une cargaison Rotterdam→Genève transite par 3 ports hors route avec 2 transbordements.",
      "when": "Score d'anomalie de route (détour, transbordements, arrêts en zones sensibles) sur les documents de transport.",
      "then": "Signal ROUTE_ANOMALY (Niveau 2) — justification logistique demandée."
    },
    "params": [
      {
        "key": "transbordements_max",
        "label": "transbordements tolérés",
        "default": 1
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "TB-08",
    "ruleRef": "R385",
    "bloc": 57,
    "blocTitre": "TBML",
    "plage": "R378–R385",
    "famille": "TB",
    "titre": "Carrousel documentaire",
    "desc": "Les mêmes contreparties échangent des rôles acheteur/vendeur sur des biens similaires en boucle — chiffre d'affaires artificiel.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "TRADE_CAROUSEL",
    "gherkin": {
      "given": "A vend à B, B revend à C, C revend à A des lots similaires à valeur croissante sur 4 mois.",
      "when": "Détection de cycles sur le graphe des contreparties trade × similarité des biens × inflation des montants.",
      "then": "Signal TRADE_CAROUSEL (Niveau 2) — logique économique de la chaîne à démontrer."
    },
    "params": [
      {
        "key": "duree_cycle_trade",
        "label": "fenêtre de détection",
        "default": 180
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "CB-03",
    "ruleRef": "R386",
    "bloc": 58,
    "blocTitre": "Correspondent Banking",
    "plage": "R386–R392",
    "famille": "CB",
    "titre": "Wire stripping / transparence",
    "desc": "Champs ordonnateur/bénéficiaire (50/59) incomplets, tronqués ou altérés dans la chaîne — GAFI R.16, Wolfsberg Payment Transparency.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "WIRE_STRIPPING",
    "gherkin": {
      "given": "Une série de MT103 d'un correspondant arrive avec le champ 50 réduit à des initiales.",
      "when": "Contrôle de complétude et de cohérence des champs de transparence par message et par correspondant (taux agrégé).",
      "then": "Signal WIRE_STRIPPING (Niveau 1) — messages retenus, demande de complément au correspondant, taux suivi par répondant."
    },
    "params": [
      {
        "key": "taux_incomplet_max",
        "label": "taux d'incomplétude toléré par correspondant",
        "default": 2
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "CB-04",
    "ruleRef": "R387",
    "bloc": 58,
    "blocTitre": "Correspondent Banking",
    "plage": "R386–R392",
    "famille": "CB",
    "titre": "U-turn payments",
    "desc": "Fonds sortant vers un correspondant tiers et revenant à la même partie via une autre chaîne — contournement de restrictions.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "U_TURN",
    "gherkin": {
      "given": "CHF 500k partent vers une banque du Golfe et reviennent 9 jours après via un correspondant européen, même bénéficiaire final.",
      "when": "Appariement sortie/entrée (montant, parties finales, fenêtre) à travers des chaînes de correspondance distinctes.",
      "then": "Signal U_TURN (Niveau 2) — finalité du détour à justifier, analyse sanctions."
    },
    "params": [
      {
        "key": "fenetre_uturn",
        "label": "fenêtre d'appariement",
        "default": 30
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "CB-05",
    "ruleRef": "R388",
    "bloc": 58,
    "blocTitre": "Correspondent Banking",
    "plage": "R386–R392",
    "famille": "CB",
    "titre": "Payable-through accounts",
    "desc": "Clients du répondant accédant directement au compte de correspondance (payable-through) — diligence impossible sur l'utilisateur final.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "PAYABLE_THROUGH",
    "gherkin": {
      "given": "Des ordres au format client final (références retail) transitent par le compte nostro d'un répondant.",
      "when": "Détection de patterns d'usage direct (volumétrie retail, références client final) sur comptes de correspondance.",
      "then": "Signal PAYABLE_THROUGH (Niveau 1) — clarification contractuelle avec le répondant, restriction possible après décision."
    },
    "params": [
      {
        "key": "indicateurs_pta",
        "label": "indicateurs d'usage direct",
        "default": "tenant"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "CB-06",
    "ruleRef": "R389",
    "bloc": 58,
    "blocTitre": "Correspondent Banking",
    "plage": "R386–R392",
    "famille": "CB",
    "titre": "Volumétrie répondant vs profil (KYCC)",
    "desc": "Volumes et corridors d'un répondant incohérents avec son profil déclaré (questionnaire Wolfsberg CBDDQ).",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "RESPONDENT_PROFILE_DRIFT",
    "gherkin": {
      "given": "Un répondant déclaré « domestique retail » envoie 40% de ses flux vers des corridors HRJ.",
      "when": "Comparaison flux réels (corridors, volumes, devises) vs profil CBDDQ déclaré, par période.",
      "then": "Signal RESPONDENT_PROFILE_DRIFT (Niveau 2) — mise à jour du questionnaire exigée, revue de la relation."
    },
    "params": [
      {
        "key": "derive_max",
        "label": "dérive tolérée vs profil",
        "default": 20
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "CB-07",
    "ruleRef": "R390",
    "bloc": 58,
    "blocTitre": "Correspondent Banking",
    "plage": "R386–R392",
    "famille": "CB",
    "titre": "Shell bank",
    "desc": "Détection de banques fictives (sans présence physique ni groupe régulé) dans les chaînes — interdiction LBA.",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "",
    "gherkin": {
      "given": "Un BIC de la chaîne appartient à un établissement sans adresse physique vérifiable ni superviseur identifiable.",
      "when": "Croisement BIC × registres de supervision × indicateurs de présence physique (référentiel tenant).",
      "then": "TRANSACTION BLOQUÉE (Niveau 1) — interdiction légale, aucune dérogation, dossier sanctions/MROS selon le cas."
    },
    "params": [
      {
        "key": "registres_supervision",
        "label": "registres de superviseurs consultés",
        "default": "tenant"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "CB-08",
    "ruleRef": "R391",
    "bloc": 58,
    "blocTitre": "Correspondent Banking",
    "plage": "R386–R392",
    "famille": "CB",
    "titre": "RMA sans flux ni justification",
    "desc": "Autorisations d'échange SWIFT (RMA) actives sans flux ni besoin documenté — surface d'attaque et de contournement inutile.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "RMA_DORMANT",
    "gherkin": {
      "given": "Un RMA bilatéral est actif depuis 3 ans avec zéro message échangé.",
      "when": "Revue périodique des RMA : flux sur la période × justification métier enregistrée.",
      "then": "Signal RMA_DORMANT (Niveau 1, ops) — proposition de résiliation, décision tracée."
    },
    "params": [
      {
        "key": "periode_revue_rma",
        "label": "période de revue",
        "default": 12
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "CB-09",
    "ruleRef": "R392",
    "bloc": 58,
    "blocTitre": "Correspondent Banking",
    "plage": "R386–R392",
    "famille": "CB",
    "titre": "Screening des répondantes (CBDDQ)",
    "desc": "Screening périodique des banques répondantes elles-mêmes : sanctions, adverse media, rating pays, actionnariat.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "RESPONDENT_HIT",
    "gherkin": {
      "given": "L'actionnaire majoritaire d'un répondant est placé sous sanctions.",
      "when": "Re-screening périodique du répondant + UBO bancaires + dirigeants ; delta → revue.",
      "then": "Signal RESPONDENT_HIT (Niveau 2) — comité correspondance, suspension possible après décision humaine."
    },
    "params": [
      {
        "key": "frequence_screen_respondants",
        "label": "fréquence",
        "default": 30
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "PF-01",
    "ruleRef": "R393",
    "bloc": 59,
    "blocTitre": "Prolifération",
    "plage": "R393–R395",
    "famille": "PF",
    "titre": "Sanctions sectorielles & plafonds",
    "desc": "Contournement des sanctions sectorielles : plafonds de prix (pétrole), embargos or/luxe, services interdits (assurance, shipping) vers RU/BY/IR/KP.",
    "niveau": 1,
    "kind": "detection",
    "blocking": true,
    "signal": "",
    "gherkin": {
      "given": "Un paiement pétrole affiche un prix au baril supérieur au plafond, assuré par un assureur non autorisé.",
      "when": "Contrôle sectoriel : produit × origine × prix vs plafond × services associés autorisés.",
      "then": "TRANSACTION BLOQUÉE (Niveau 1) — violation sectorielle, escalade sanctions, décision humaine tracée."
    },
    "params": [
      {
        "key": "plafonds_sectoriels",
        "label": "référentiel plafonds/embargos",
        "default": "tenant"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "PF-02",
    "ruleRef": "R394",
    "bloc": 59,
    "blocTitre": "Prolifération",
    "plage": "R393–R395",
    "famille": "PF",
    "titre": "Chaînes d'écrans corridors KP/IR",
    "desc": "Patterns d'intermédiation typiques du financement de la prolifération : sociétés jeunes, capital minimal, secteurs génériques, en chaîne vers corridors sensibles.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "PROLIF_CHAIN",
    "gherkin": {
      "given": "Trois sociétés de trading créées < 12 mois s'intercalent entre un exportateur européen et un acheteur final opaque.",
      "when": "Score de chaîne : âge des entités × substance × secteur générique × corridor final.",
      "then": "Signal PROLIF_CHAIN (Niveau 1) — identification du destinataire final exigée, escalade."
    },
    "params": [
      {
        "key": "age_entite_min",
        "label": "âge minimal sans surrisque",
        "default": 24
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "PF-03",
    "ruleRef": "R395",
    "bloc": 59,
    "blocTitre": "Prolifération",
    "plage": "R393–R395",
    "famille": "PF",
    "titre": "Biens de luxe vers zones embargo",
    "desc": "Exportation de biens de luxe (montres, joaillerie, véhicules) vers des juridictions sous embargo de luxe, souvent via pays relais.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "LUXURY_EMBARGO",
    "gherkin": {
      "given": "Des paiements de montres de haute horlogerie partent vers un relais d'Asie centrale, volume ×6 depuis l'embargo.",
      "when": "Volume par corridor relais × catégorie de biens embargo × croissance anormale post-sanctions.",
      "then": "Signal LUXURY_EMBARGO (Niveau 2) — destinataire final et usage à corroborer."
    },
    "params": [
      {
        "key": "categories_luxe",
        "label": "catégories surveillées",
        "default": "tenant"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "IA-01",
    "ruleRef": "R396",
    "bloc": 60,
    "blocTitre": "Immobilier & Art",
    "plage": "R396–R398",
    "famille": "IA",
    "titre": "Immobilier via structure + prix hors marché",
    "desc": "Acquisition immobilière via structure (SCI, trust, offshore) à un prix significativement hors marché.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "REAL_ESTATE_ANOMALY",
    "gherkin": {
      "given": "Un bien estimé CHF 2.1M est acquis 3.4M via une société des BVI financée depuis le compte.",
      "when": "Écart au prix de référence (m², registre) × acquisition via structure × origine du financement.",
      "then": "Signal REAL_ESTATE_ANOMALY (Niveau 2) — expertise indépendante et SOW exigées."
    },
    "params": [
      {
        "key": "ecart_marche_max",
        "label": "écart au marché toléré",
        "default": 25
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "IA-02",
    "ruleRef": "R397",
    "bloc": 60,
    "blocTitre": "Immobilier & Art",
    "plage": "R396–R398",
    "famille": "IA",
    "titre": "Art & ports francs",
    "desc": "Achat d'œuvres, dépôt en port franc, revente rapide — valeur mobile, opaque et transfrontalière.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "ART_FREEPORT",
    "gherkin": {
      "given": "Une œuvre achetée CHF 900k est déposée en port franc puis revendue 15 mois après à une partie liée, +40%.",
      "when": "Cycle achat→port franc→revente × délai × lien entre parties × écart de prix.",
      "then": "Signal ART_FREEPORT (Niveau 2) — provenance de l'œuvre et indépendance de l'acheteur à établir."
    },
    "params": [
      {
        "key": "delai_revente_min",
        "label": "revente considérée rapide si <",
        "default": 36
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "IA-03",
    "ruleRef": "R398",
    "bloc": 60,
    "blocTitre": "Immobilier & Art",
    "plage": "R396–R398",
    "famille": "IA",
    "titre": "Véhicules de valeur (luxe, NFT)",
    "desc": "Biens de luxe et actifs numériques de collection utilisés comme véhicules de transfert de valeur.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "VALUE_VEHICLE",
    "gherkin": {
      "given": "Trois véhicules de collection achetés et réexpédiés à l'étranger en 4 mois, revendus à des parties inconnues.",
      "when": "Fréquence d'achat/revente de biens de valeur × export × contreparties.",
      "then": "Signal VALUE_VEHICLE (Niveau 2) — finalité patrimoniale vs circulation de valeur à clarifier."
    },
    "params": [
      {
        "key": "seuil_biens_valeur",
        "label": "équivalent CHF / 180j",
        "default": 200000
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "AN-01",
    "ruleRef": "R399",
    "bloc": 61,
    "blocTitre": "Analytique 2G",
    "plage": "R399–R403",
    "famille": "AN",
    "titre": "Déviation au groupe de pairs",
    "desc": "Écart statistique du client à son groupe de pairs CPSI (z-score sur les attributs surveillés), au-delà des seuils fixes de 1re génération.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "PEER_DEVIATION",
    "gherkin": {
      "given": "Un client du groupe « Affluent CH » présente un volume cash à 4.2 écarts-types de la médiane de son groupe.",
      "when": "Z-score robuste (médiane/MAD) par attribut et par groupe, recalculé au fil de l'eau.",
      "then": "Signal PEER_DEVIATION (Niveau 2) — explicable par construction : attribut, valeur, distribution du groupe joints (R44 : l'IA éclaire)."
    },
    "params": [
      {
        "key": "zscore_seuil",
        "label": "z-score de déclenchement",
        "default": 3.5
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "AN-02",
    "ruleRef": "R400",
    "bloc": 61,
    "blocTitre": "Analytique 2G",
    "plage": "R399–R403",
    "famille": "AN",
    "titre": "Rupture de comportement (baseline propre)",
    "desc": "Changement soudain vs la baseline historique du client lui-même (pas du groupe) : régime transactionnel qui bascule.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "BEHAVIOR_SHIFT",
    "gherkin": {
      "given": "Un compte stable depuis 4 ans triple sa volumétrie et change de corridors en 3 semaines.",
      "when": "Détection de rupture (changepoint) sur volume, fréquence, corridors, contreparties vs baseline 12 mois.",
      "then": "Signal BEHAVIOR_SHIFT (Niveau 2) — comparatif avant/après joint au signal."
    },
    "params": [
      {
        "key": "sensibilite_rupture",
        "label": "sensibilité du détecteur",
        "default": "tenant"
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "AN-03",
    "ruleRef": "R401",
    "bloc": 61,
    "blocTitre": "Analytique 2G",
    "plage": "R399–R403",
    "famille": "AN",
    "titre": "First-time patterns",
    "desc": "Premières occurrences sensibles : premier virement international, premier cash, première contrepartie HRJ, premier produit à risque.",
    "niveau": 1,
    "kind": "detection",
    "blocking": false,
    "signal": "FIRST_TIME",
    "gherkin": {
      "given": "Un client 100% domestique depuis 6 ans émet son premier virement vers une juridiction à risque, montant élevé.",
      "when": "Détection de première occurrence par dimension sensible × matérialité du montant.",
      "then": "Signal FIRST_TIME (Niveau 1) — friction douce : revue rapide, pas de blocage (R39 : mesurer, pas coercer)."
    },
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
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "AN-04",
    "ruleRef": "R402",
    "bloc": 61,
    "blocTitre": "Analytique 2G",
    "plage": "R399–R403",
    "famille": "AN",
    "titre": "Dormance partielle par segment",
    "desc": "Réactivation d'un segment d'activité dormant (ex. le cash après 3 ans d'inactivité cash) même si le compte global reste actif — complète la règle « compte dormant » existante.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "SEGMENT_REACTIVATION",
    "gherkin": {
      "given": "Un compte actif en titres n'a fait aucun cash depuis 3 ans ; 3 dépôts espèces surviennent en 2 semaines.",
      "when": "Dormance mesurée par segment (cash, international, produit) ; réactivation = première activité du segment après N mois.",
      "then": "Signal SEGMENT_REACTIVATION (Niveau 2) — contexte de réactivation demandé."
    },
    "params": [
      {
        "key": "dormance_segment",
        "label": "dormance du segment",
        "default": 24
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  },
  {
    "id": "AN-05",
    "ruleRef": "R403",
    "bloc": 61,
    "blocTitre": "Analytique 2G",
    "plage": "R399–R403",
    "famille": "AN",
    "titre": "Revenus entrants incohérents (mismatch)",
    "desc": "Entrées récurrentes libellées « salaire/honoraires » incohérentes avec l'employeur et la rémunération déclarés au KYC — pendant entrant de R201/AML-WC-01.",
    "niveau": 2,
    "kind": "detection",
    "blocking": false,
    "signal": "INCOME_MISMATCH",
    "gherkin": {
      "given": "Un « salaire » mensuel de CHF 45k est crédité alors que le KYC déclare 12k et un autre employeur.",
      "when": "Croisement libellé/ordonnateur des entrées récurrentes × rémunération et employeur déclarés.",
      "then": "Signal INCOME_MISMATCH (Niveau 2) — mise à jour KYC ou justification exigée (CoC)."
    },
    "params": [
      {
        "key": "ecart_revenu_max",
        "label": "écart toléré vs déclaré",
        "default": 50
      }
    ],
    "gtCount": {
      "tp": 1,
      "fp": 1
    }
  }
];
