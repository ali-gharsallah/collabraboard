# -*- coding: utf-8 -*-
# GEN-AML-GAP — source de vérité unique wave 1 (blocs 50-56, R340-R377 provisoires)
# Émet : SPEC-AML-GAP-WAVE1.md (sections règles), aml-gap-dataset-gt.json, c50gap.js (bloc démo)
# Chemins portés en-repo (2026-08-04) : le générateur PO écrivait vers /home/claude/olive/ (env PO) ;
# résolus ci-dessous en chemins relatifs au dépôt pour brancher la ré-émission dans le pipeline
# (journal action 6 : toute évolution de règle = régénération + commit). Logique inchangée.
import json, os
_HERE = os.path.dirname(os.path.abspath(__file__))          # tools/
_ROOT = os.path.dirname(_HERE)                              # racine du dépôt
# Sections de spec régénérées sous data/ (PAS spec/) : redondantes avec SPEC-AML-GAP-WAVE{1,2}.md
# versées ; les mettre sous spec/ les ferait compter par CANON-MASTER (non déterministe en CI).
_GEN = os.path.join(_ROOT, "data", "aml-gap-sections")
os.makedirs(_GEN, exist_ok=True)
os.makedirs(os.path.join(_ROOT, "data"), exist_ok=True)

def R(id, rule, fam, nom, ico, niv, block, desc, given, when, then, params, cases):
    return dict(id=id, rule=rule, fam=fam, nom=nom, ico=ico, niveau=niv, block=block,
                desc=desc, given=given, when=when, then=then, params=params, cases=cases)

def TP(cl, txt): return dict(label="TP", client=cl, txt=txt)
def FP(cl, txt): return dict(label="FP", client=cl, txt=txt)

RULES = [
# ══ BLOC 50 — SCREENING EN FLUX & PERPÉTUEL (R340-R346) ══
R("SF-01","R340","Screening en flux","Contrepartie PEP en flux","🎗",2,False,
  "Screening PEP de la contrepartie de chaque transaction entrante/sortante, pas seulement du client à l'onboarding.",
  "Un virement entrant de CHF 180k provient d'une contrepartie non cliente matchant une liste PEP (ministre en fonction, pays tiers).",
  "Le screening en flux (nom + pays + date de naissance si dispo) matche la contrepartie avec un score ≥ seuil tenant.",
  "Signal PEP_COUNTERPARTY (Niveau 2) — alerte CO avec fiche de match, aucune contamination du statut client sans revue humaine (R44).",
  [["seuil_match_pep_flux","score de similarité minimal","78","%"],["listes_pep","fournisseurs de listes actives","tenant","-"]],
  [TP("CLI-00016","Virement de 180k reçu du frère d'un ministre en exercice (liste PEP, match 91%) — investigation confirme l'origine politique des fonds."),
   TP("CLI-00039","Sortie de 95k vers une société détenue par un PEP régional sanctionnable — lien confirmé au registre."),
   FP("CLI-00003","Homonyme parfait d'un PEP brésilien ; la date de naissance et le pays divergent — clôturé FP après vérification documentaire.")]),
R("SF-02","R341","Screening en flux","Adverse media sur contrepartie","📰",2,False,
  "Presse négative (blanchiment, fraude, corruption) sur la contrepartie d'une transaction au moment du flux.",
  "Une sortie de CHF 60k vise une société citée la veille dans une enquête pour corruption (source de rang 1).",
  "Le screening adverse media en flux matche la contrepartie avec une catégorie AML-pertinente et une source pondérée ≥ seuil.",
  "Signal ADVERSE_COUNTERPARTY (Niveau 2) — alerte avec extrait sourcé et daté ; l'humain qualifie.",
  [["rang_source_min","rang minimal de fiabilité de la source","2","-"],["categories_am","catégories retenues (ML, fraude, corruption, TF)","tenant","-"]],
  [TP("CLI-00075","Paiement fournisseur vers une société mise en accusation pour corruption d'agents publics (3 sources de rang 1) — TP confirmé."),
   FP("CLI-00041","Match sur un article concernant une société homonyme d'un autre canton — secteur et IDE différents, clôturé FP.")]),
R("SF-03","R342","Screening en flux","Re-screening périodique (perpetual)","🔁",2,False,
  "Re-screening automatique périodique de tout le stock clients + personnes liées (sanctions/PEP/adverse), différentiel uniquement.",
  "Le batch nocturne re-screene 5'000 clients ; un client existant apparaît nouvellement sur une liste PEP suite à une nomination.",
  "Le différentiel (nouveau hit vs dernier run) est détecté et rattaché au dossier.",
  "Événement screening.delta → ouverture automatique d'un Change of Circumstances typé SCREENING_DELTA, routé au rôle Compliance (registre CoC).",
  [["frequence_rescreen","fréquence du re-screening du stock","24","heures"],["scope_personnes_liees","inclure les personnes liées","true","-"]],
  [TP("CLI-00034","Client nommé au conseil d'administration d'une entreprise publique — delta PEP détecté à J+1, CoC ouvert, EDD déclenchée."),
   TP("CLI-00070","UBO ajouté à la liste SECO lors d'un train de sanctions — delta détecté, relation gelée après décision humaine."),
   FP("CLI-00005","Mise à jour de format du fournisseur de listes régénère un hit déjà écarté (même ID de profil) — dédoublonné puis clôturé FP ; correctif de mapping consigné.")]),
R("SF-04","R343","Screening en flux","Banques intermédiaires (BIC)","🏦",2,False,
  "Screening des BIC de la chaîne de paiement (champ 56/57), pas seulement des parties finales.",
  "Un MT103 transite par une banque intermédiaire dont la maison mère est sous sanctions sectorielles.",
  "Chaque BIC de la chaîne est screené contre les listes sanctions + liste interne banques à risque.",
  "Signal INTERMEDIARY_HIT (Niveau 2) — routage alternatif proposé, décision humaine avant exécution.",
  [["liste_bic_interne","liste interne de banques surveillées","tenant","-"]],
  [TP("CLI-00130","Paiement vers Singapour routé via une intermédiaire filiale d'un groupe sous sanctions sectorielles — re-routé après alerte."),
   FP("CLI-00018","BIC matché sur l'ancien code d'une banque assainie et retirée des listes depuis 2024 — référentiel BIC mis à jour, FP.")]),
R("SF-05","R344","Screening en flux","Adresse / localisation sanctionnée","📍",1,True,
  "Sanctions par localisation : adresses et villes de régions sous embargo (Crimée, régions occupées), au-delà du seul nom.",
  "Un virement sortant indique une adresse bénéficiaire à Sébastopol.",
  "Le parsing d'adresse (ville, région, code postal) matche le référentiel géographique sanctionné.",
  "TRANSACTION BLOQUÉE (Niveau 1) — motif géographique explicite, dossier MROS préparé, décision humaine requise (R44).",
  [["referentiel_geo_sanctions","référentiel des zones sanctionnées","tenant","-"]],
  [TP("CLI-00070","Bénéficiaire domicilié dans une région sous embargo — blocage confirmé, déclaration préparée."),
   FP("CLI-00035","Rue « Crimée » à Paris 19e matchée par le parseur — règle affinée (ville+pays requis), FP documenté.")]),
R("SF-06","R345","Screening en flux","Translittération multi-scripts","𝔸",2,False,
  "Matching étendu arabe/cyrillique/chinois : variantes de translittération normalisées avant screening (le moteur IDF+trigram est latin-centrique).",
  "Un ordonnateur « Мухаммад Аль-Рашид » (cyrillique) correspond à un profil sanctionné translittéré « Muhammad Al-Rashid ».",
  "La normalisation multi-scripts (ICU + tables de translittération) produit les variantes avant le matching baseline.",
  "Le hit est détecté malgré l'écart de script — signal standard du canal concerné, variante gagnante tracée.",
  [["scripts_actifs","scripts normalisés","AR,CYR,ZH","-"]],
  [TP("CLI-00045","Contrepartie en caractères chinois matchant un profil OFAC translittéré — non détectable sans normalisation, TP."),
   FP("CLI-00193","Translittération agressive rapproche deux patronymes arabes courants distincts — seuil par script relevé, FP.")]),
R("SF-07","R346","Screening en flux","Navires & IMO","🚢",1,True,
  "Screening des navires (nom, numéro IMO, pavillon) sur les paiements liés au négoce et au shipping.",
  "Un crédit documentaire référence un navire dont l'IMO figure sur la liste OFAC (shadow fleet).",
  "Extraction du nom/IMO depuis les champs libres et les documents, screening dédié navires.",
  "TRANSACTION BLOQUÉE (Niveau 1) — gel, escalade sanctions, décision humaine requise.",
  [["extraction_imo","extraction IMO des champs libres","true","-"]],
  [TP("CLI-00039","LC référençant un tanker de la flotte fantôme (IMO sanctionné, pavillon changé 3× en 12 mois) — blocage confirmé."),
   FP("CLI-00130","Navire homonyme d'une unité sanctionnée mais IMO distinct et pavillon UE — libéré après vérification IMO, FP.")]),

# ══ BLOC 51 — INDICES QUALITATIFS OBA-FINMA (R347-R351) ══
R("QO-01","R347","Indices OBA-FINMA","Refus de fournir des informations","🙅",2,False,
  "Le refus du client de fournir les informations usuelles (origine des fonds, justificatifs) devient un signal structuré, pas une note libre.",
  "Le RM demande un justificatif d'origine pour un apport de CHF 500k ; le client refuse explicitement à deux reprises.",
  "Le RM déclare le refus via le workflow dédié (motif, pièces demandées, dates) — événement kyc.refus_information.",
  "Signal INFO_REFUSAL (Niveau 2) — tâche CO, blocage possible de l'apport après décision humaine, trace au registre art. 7.",
  [["nb_relances_avant_signal","relances avant signal","2","-"]],
  [TP("CLI-00043","Refus réitéré de documenter un apport de 500k malgré 2 relances écrites — relation dénoncée après comité."),
   FP("CLI-00053","Retard de 3 semaines dû à une succession en cours chez le notaire — documents fournis, signal clôturé FP.")]),
R("QO-02","R348","Indices OBA-FINMA","Compte de passage multi-titulaires","🚪",2,False,
  "Compte utilisé comme compte de passage par de nombreuses personnes distinctes (indice annexe OBA-FINMA), au-delà du seul critère temporel.",
  "Un compte reçoit des fonds de 9 ordonnateurs distincts sans lien documenté en 30 jours, ressortis vers 6 bénéficiaires.",
  "Comptage des tiers distincts entrée + sortie / fenêtre glissante, croisé avec les personnes liées du KYC.",
  "Signal TRANSIT_ACCOUNT (Niveau 2) — cartographie des tiers jointe, revue du but de la relation.",
  [["tiers_distincts_seuil","tiers distincts / 30j","6","-"]],
  [TP("CLI-00072","11 ordonnateurs inconnus en 3 semaines, fonds ressortis sous 48h — typologie mule/passage confirmée."),
   FP("CLI-00110","Fondation caritative recevant des dons multiples pendant sa campagne annuelle déclarée au KYC — but documenté, FP.")]),
R("QO-03","R349","Indices OBA-FINMA","Opération sans justification économique","❔",2,False,
  "Red flag déclaratif du conseiller : opération constatée sans justification économique apparente, tracée et routée (jamais silencieuse).",
  "Le RM constate un achat-revente de titres à perte immédiate entre comptes du même client, sans logique d'investissement.",
  "Le RM soulève le red flag via le formulaire structuré (opération, constat, échange client) — événement rm.redflag.",
  "Signal NO_ECON_RATIONALE (Niveau 2) — investigation CO, réponse du client consignée.",
  [["delai_reponse_client","délai de réponse attendu","10","jours"]],
  [TP("CLI-00080","Aller-retour titres à perte de 4% en 48h répété 3× — habillage de transferts de valeur confirmé."),
   FP("CLI-00104","Vente à perte fin décembre puis rachat en janvier — tax-loss harvesting documenté par le gérant, FP.")]),
R("QO-04","R350","Indices OBA-FINMA","Adresse partagée multi-clients","🏠",1,False,
  "Domiciliation c/o ou adresse identique partagée par de nombreux clients sans lien déclaré.",
  "8 clients sans lien familial ni sociétal déclaré partagent la même adresse de domiciliation c/o une fiduciaire.",
  "Normalisation d'adresse + comptage des clients distincts par adresse, seuil tenant.",
  "Signal SHARED_ADDRESS (Niveau 1) — revue du caractère de société de domicile (CDB 20, form. K).",
  [["clients_par_adresse_seuil","clients distincts par adresse","5","-"]],
  [TP("CLI-00043","14 sociétés clientes domiciliées à la même adresse d'un prestataire offshore — requalification en sociétés de domicile."),
   FP("CLI-00018","Membres d'une même famille (grand-parents, enfants, holding familiale) à l'adresse du family office — liens déclarés, FP.")]),
R("QO-05","R351","Indices OBA-FINMA","Rotation des procurations / instructions","✍",2,False,
  "Changements fréquents de procurations, signataires ou instructions permanentes sans justification.",
  "3 changements de fondé de pouvoir en 6 mois, dont un révoqué 2 semaines après nomination.",
  "Comptage des événements de gouvernance du compte / fenêtre, croisé avec l'activité transactionnelle.",
  "Signal GOVERNANCE_CHURN (Niveau 2) — revue de la maîtrise réelle du compte (ADE effectif).",
  [["chgts_gouvernance_seuil","changements / 6 mois","3","-"]],
  [TP("CLI-00034","Rotation de 4 mandataires en 5 mois masquant l'opérateur réel du compte — ADE requalifié."),
   FP("CLI-00016","Réorganisation du family office documentée (départ CFO, arrivée de deux successeurs) — actes fournis, FP.")]),

# ══ BLOC 52 — VISION GROUPE UBO (R352-R355) ══
R("GU-01","R352","Vision groupe UBO","Structuring cross-comptes du groupe","🕸",2,False,
  "Agrégation des flux sur le périmètre consolidé de l'UBO (tous comptes, toutes entités) : le fractionnement réparti sur plusieurs entités devient visible.",
  "Un UBO contrôle 4 entités ; chacune dépose CHF 18k la même semaine (72k agrégés, unitaire sous le seuil de 20k).",
  "Le moteur agrège par ubo_group_id (graphe des personnes liées) sur la fenêtre glissante.",
  "Signal GROUP_STRUCTURING (Niveau 2) — vue consolidée jointe, chaque entité référencée.",
  [["fenetre_agregation_ubo","fenêtre d'agrégation","7","jours"],["seuil_agrege_ubo","seuil agrégé groupe","50000","CHF"]],
  [TP("CLI-00005","4 dépôts de 18-19k via holding, SCI et deux comptes personnels du même UBO en 6 jours — structuring de groupe confirmé."),
   FP("CLI-00152","Distributions de dividendes simultanées des filiales vers la holding, calendrier d'AG documenté — flux légitimes, FP.")]),
R("GU-02","R353","Vision groupe UBO","Flux circulaires intra-groupe","🔄",2,False,
  "Fonds circulant entre entités du même UBO sans substance (A→B→C→A intra-périmètre).",
  "CHF 300k font le tour de 3 entités du même UBO en 12 jours et reviennent au point de départ.",
  "Détection de cycle sur le graphe restreint au périmètre UBO.",
  "Signal GROUP_CIRCULAR (Niveau 2) — demande de justification économique consolidée.",
  [["duree_cycle_max","durée max du cycle détecté","30","jours"]],
  [TP("CLI-00101","Rotation de 300k entre 3 entités pour gonfler artificiellement les bilans avant une demande de crédit — TP."),
   FP("CLI-00016","Cash pooling intra-groupe documenté par convention de trésorerie — mécanique déclarée au KYC, FP.")]),
R("GU-03","R354","Vision groupe UBO","Cash consolidé du périmètre","💶",2,False,
  "Intensité cash mesurée au niveau du périmètre UBO : chaque entité reste sous les radars, le groupe non.",
  "5 entités du même UBO déposent chacune ~CHF 9k d'espèces par mois (45k/mois consolidés).",
  "Ratio cash consolidé / volume consolidé du groupe, seuils par groupe CPSI.",
  "Signal GROUP_CASH_INTENSITY (Niveau 2) — ventilation par entité jointe.",
  [["ratio_cash_groupe","ratio cash consolidé max","25","%"]],
  [TP("CLI-00033","45k/mois d'espèces répartis sur 5 entités d'un même bénéficiaire, activité déclarée sans lien avec le cash — TP."),
   FP("CLI-00041","Groupe de restaurants du même propriétaire : intensité cash cohérente avec le secteur déclaré de chaque entité, FP.")]),
R("GU-04","R355","Vision groupe UBO","Seuils agrégés cross-produits","🧩",2,False,
  "Agrégation cash + titres + FX + crédit : un pattern réparti entre produits (dépôt cash, achat titres FOP, tirage lombard) est détecté globalement.",
  "Dépôt cash 15k + transfert in-specie 40k + tirage lombard 30k la même semaine, aucun produit ne franchit seul son seuil.",
  "Normalisation en équivalent CHF et agrégation cross-produits par client et par groupe UBO.",
  "Signal CROSS_PRODUCT_AGGREGATE (Niveau 2) — décomposition par produit jointe.",
  [["seuil_cross_produits","seuil agrégé équivalent","75000","CHF"]],
  [TP("CLI-00072","Combinaison cash + in-specie + lombard totalisant 85k/semaine en contournement des seuils unitaires — TP."),
   FP("CLI-00164","Rééquilibrage trimestriel de portefeuille documenté par le mandat de gestion (mouvements multi-produits simultanés), FP.")]),

# ══ BLOC 53 — INSTRUMENTS BANQUE PRIVÉE (R356-R362) ══
R("IP-01","R356","Instruments PB","Lombard — remboursement par tiers","🏛",2,False,
  "Crédit lombard remboursé par anticipation par un tiers sans lien documenté avec l'emprunteur.",
  "Un lombard de CHF 800k est soldé 4 mois après tirage par un virement d'une société tierce inconnue du dossier.",
  "Croisement remboursement anticipé × identité de l'ordonnateur × personnes liées du KYC.",
  "Signal LOMBARD_THIRD_PARTY (Niveau 2) — fonds en attente de documentation SOF avant mainlevée du nantissement.",
  [["delai_anticipe_min","remboursement considéré anticipé si <","12","mois"]],
  [TP("CLI-00043","Lombard soldé par une société panaméenne étrangère au dossier — le crédit servait à donner une apparence bancaire aux fonds, TP."),
   FP("CLI-00152","Remboursement par la holding mère de l'emprunteur, convention de trésorerie au dossier — lien documenté, FP.")]),
R("IP-02","R357","Instruments PB","Back-to-back loan","🔗",1,False,
  "Dépôt (souvent offshore) nantissant un prêt accordé à une entité liée : séparation artificielle de l'origine des fonds.",
  "Un dépôt de CHF 2M d'une entité des Caïmans garantit un prêt de 1.8M à une société suisse du même UBO.",
  "Détection nantissement × prêt dont déposant et emprunteur partagent le périmètre UBO ou des liens déclarés/détectés.",
  "Signal BACK_TO_BACK (Niveau 1) — origine du dépôt à corroborer avant tout tirage, escalade EDD.",
  [["perimetre_lien","liens retenus (UBO, famille, signataires)","tenant","-"]],
  [TP("CLI-00033","Dépôt offshore non corroboré garantissant un prêt à l'entité opérationnelle suisse du même bénéficiaire — schéma B2B confirmé."),
   FP("CLI-00016","Garantie intra-groupe standard d'un family office, origine des fonds corroborée à l'ouverture — structure déclarée, FP.")]),
R("IP-03","R358","Instruments PB","Wrapper assurance — prime hors profil","🧾",2,False,
  "Souscription d'assurance-vie à prime unique élevée, incohérente avec le patrimoine et les revenus déclarés.",
  "Prime unique de CHF 1.5M pour un client au patrimoine déclaré de 900k.",
  "Ratio prime / patrimoine déclaré + origine de la prime (compte tiers ?).",
  "Signal WRAPPER_PREMIUM (Niveau 2) — corroboration SOW avant acceptation du contrat.",
  [["ratio_prime_patrimoine","ratio prime/patrimoine max","60","%"]],
  [TP("CLI-00048","Prime de 1.5M financée par trois virements de sociétés tierces, patrimoine déclaré 900k — support d'intégration, TP."),
   FP("CLI-00005","Prime élevée financée par la vente documentée d'un bien immobilier (acte notarié au dossier) — SOW corroborée, FP.")]),
R("IP-04","R359","Instruments PB","Wrapper assurance — rachat précoce","⏳",2,False,
  "Rachat de la police peu après souscription, pénalités acceptées sans discussion (le coût du blanchiment est assumé).",
  "Rachat total à 7 mois d'une police à prime unique, pénalité de 4% acceptée sans négociation.",
  "Délai souscription→rachat < seuil + acceptation de pénalité + bénéficiaire du rachat ≠ souscripteur.",
  "Signal EARLY_SURRENDER (Niveau 2) — investigation sur la finalité réelle du produit.",
  [["delai_rachat_min","rachat considéré précoce si <","24","mois"]],
  [TP("CLI-00043","Rachat à 7 mois versé sur un compte tiers à Dubaï, pénalité assumée — la police n'a servi que de sas, TP."),
   FP("CLI-00110","Rachat à 10 mois pour financer une acquisition immobilière urgente (compromis de vente fourni) — besoin réel, FP.")]),
R("IP-05","R360","Instruments PB","Changement de bénéficiaire post-souscription","🎯",2,False,
  "Modification du bénéficiaire de la police peu après souscription, vers un tiers sans lien.",
  "Le bénéficiaire passe du conjoint à une société étrangère 3 mois après souscription.",
  "Événement de changement de bénéficiaire × délai × nature du nouveau bénéficiaire.",
  "Signal BENEFICIARY_SWITCH (Niveau 2) — justification requise, CoC ouvert.",
  [["delai_chgt_benef","fenêtre de surveillance post-souscription","24","mois"]],
  [TP("CLI-00034","Bénéficiaire basculé vers une fondation panaméenne contrôlée par un tiers — transfert de valeur déguisé, TP."),
   FP("CLI-00053","Changement vers les enfants suite à un divorce (jugement au dossier) — événement de vie documenté, FP.")]),
R("IP-06","R361","Instruments PB","Coffres — corrélation cash","🗄",2,False,
  "Accès au coffre-fort corrélés temporellement à des dépôts ou retraits d'espèces.",
  "6 accès au coffre en 2 mois, chacun suivi sous 24h d'un dépôt espèces de 15-19k.",
  "Corrélation temporelle accès coffre × mouvements cash / fenêtre.",
  "Signal VAULT_CASH_PATTERN (Niveau 2) — entretien client et corroboration d'origine.",
  [["fenetre_correlation","corrélation accès↔cash","48","heures"],["nb_correlations_seuil","corrélations / 90j","3","-"]],
  [TP("CLI-00072","6 séquences coffre→dépôt sous 24h totalisant 100k — le coffre alimente les dépôts, TP."),
   FP("CLI-00063","Numismate déclaré accédant au coffre avant chaque vente aux enchères documentée (bordereaux fournis) — activité déclarée, FP.")]),
R("IP-07","R362","Instruments PB","Métaux précieux physiques","🥇",2,False,
  "Achats/ventes/livraisons de métaux physiques hors profil déclaré (OBA négoce OR).",
  "Achat de 12 kg d'or physique avec livraison hors banque, client sans profil métaux.",
  "Volume métaux / profil déclaré + mode de livraison (garde vs sortie physique).",
  "Signal PHYSICAL_METALS (Niveau 2) — sortie physique documentée, destination tracée.",
  [["seuil_metaux","équivalent CHF / 90j","100000","CHF"]],
  [TP("CLI-00080","Achats répétés d'or livré à un tiers non documenté à l'étranger — conversion de valeur portable, TP."),
   FP("CLI-00164","Allocation or de 5% du portefeuille en garde bancaire, conforme au mandat de gestion — investissement standard, FP.")]),

# ══ BLOC 54 — CRYPTO / VASP (R363-R368) ══
R("CR-01","R363","Crypto / VASP","Travel rule DLT","🧭",1,True,
  "Transferts DLT sans informations complètes d'ordonnateur/bénéficiaire (comm. FINMA 02/2019, GAFI R.16).",
  "Un transfert sortant de 0.8 BTC vise un VASP qui ne transmet pas les informations travel rule.",
  "Contrôle de complétude des données travel rule avant exécution du transfert.",
  "TRANSFERT BLOQUÉ (Niveau 1) — jusqu'à réception des informations ou décision humaine documentée.",
  [["vasp_conformes","registre des VASP conformes travel rule","tenant","-"]],
  [TP("CLI-00022","Sortie vers un exchange non coopératif refusant l'échange travel rule — blocage maintenu, relation revue."),
   FP("CLI-00068","Message travel rule retardé par une panne du protocole d'échange du VASP partenaire (reçu à H+6) — libéré, FP.")]),
R("CR-02","R364","Crypto / VASP","Exposition mixer / tumbler","🌀",1,False,
  "Fonds entrants dont l'analyse on-chain révèle une exposition directe ou à 1 hop à un mixer.",
  "Un dépôt de 2.1 BTC provient à 64% d'un mixer connu (analyse de provenance).",
  "Score d'exposition mixer du fournisseur d'analytique on-chain ≥ seuil (paramètre tenant, intégration Chainalysis/Elliptic).",
  "Signal MIXER_EXPOSURE (Niveau 1) — fonds gelés en attente d'explication, EDD.",
  [["seuil_exposition_mixer","exposition directe max","10","%"],["hops_analyses","profondeur d'analyse","2","hops"]],
  [TP("CLI-00022","64% de provenance mixer sur un dépôt de 2.1 BTC, client incapable d'expliquer la chaîne — fonds refusés, TP."),
   FP("CLI-00068","Exposition indirecte de 3% à 2 hops via un exchange majeur (pollution de cluster) — sous matérialité, FP.")]),
R("CR-03","R365","Crypto / VASP","Adresse sanctionnée on-chain","⛔",1,True,
  "Contrepartie on-chain figurant dans les adresses crypto de la liste SDN OFAC.",
  "Une adresse de destination correspond à une adresse SDN (entité de ransomware listée).",
  "Screening des adresses contre les listes crypto SDN/SECO à l'initiation.",
  "TRANSFERT BLOQUÉ (Niveau 1) — gel, dossier sanctions, MROS préparé.",
  [["listes_adresses","listes d'adresses actives","OFAC,SECO","-"]],
  [TP("CLI-00022","Destination = adresse SDN d'un groupe ransomware — blocage, déclaration effectuée."),
   FP("CLI-00068","Adresse retirée de la liste SDN au dernier délisting, cache local obsolète — synchronisation corrigée, FP.")]),
R("CR-04","R366","Crypto / VASP","Cluster darknet / ransomware","🕳",1,False,
  "Exposition de provenance à des clusters darknet markets ou ransomware (hors listes formelles).",
  "Provenance à 30% d'un cluster étiqueté darknet market par l'analytique on-chain.",
  "Score de provenance par catégorie de cluster ≥ seuil.",
  "Signal ILLICIT_CLUSTER (Niveau 1) — fonds en quarantaine, investigation.",
  [["seuil_cluster_illicite","provenance illicite max","5","%"]],
  [TP("CLI-00022","30% de provenance darknet sur un dépôt, historique d'adresses cohérent avec du peel chaining — TP."),
   FP("CLI-00068","Étiquetage erroné d'un cluster par le fournisseur (corrigé dans sa release suivante) — FP documenté fournisseur.")]),
R("CR-05","R367","Crypto / VASP","Wallet auto-hébergé sans preuve","🔑",1,True,
  "Transferts vers/depuis un wallet auto-hébergé sans preuve de contrôle (satoshi test / signature de message).",
  "Le client demande une sortie de 50k CHF en ETH vers un wallet non custodial jamais vérifié.",
  "Contrôle d'existence d'une preuve de contrôle valide pour l'adresse (registre des adresses vérifiées).",
  "SORTIE BLOQUÉE (Niveau 1) — jusqu'à preuve de contrôle (signature) enregistrée.",
  [["methodes_preuve","méthodes acceptées","signature,satoshi_test","-"],["validite_preuve","validité de la preuve","12","mois"]],
  [TP("CLI-00022","Adresse prétendument personnelle appartenant en réalité à un tiers (échec du test de signature) — TP."),
   FP("CLI-00068","Preuve expirée de 2 semaines pour une adresse déjà vérifiée 3× — re-signée le jour même, FP.")]),
R("CR-06","R368","Crypto / VASP","On/off-ramp incohérent au profil","📊",2,False,
  "Fréquence et volumes de conversion fiat↔crypto incohérents avec le profil d'investisseur déclaré.",
  "Un client « investisseur long terme » convertit fiat→crypto→fiat 14 fois en un mois.",
  "Compteur de cycles on/off-ramp / 30j vs profil déclaré (au-delà du simple seuil CHF de l'ancienne règle AML-11).",
  "Signal RAMP_VELOCITY (Niveau 2) — revue du profil transactionnel crypto.",
  [["cycles_ramp_seuil","cycles / 30j","6","-"]],
  [TP("CLI-00022","14 cycles/mois avec marge négative systématique — le coût de conversion est le prix du layering, TP."),
   FP("CLI-00068","Trader actif déclaré avec profil « trading fréquent » validé à l'onboarding — comportement conforme, FP.")]),

# ══ BLOC 55 — CFT (R369-R373) ══
R("FT-01","R369","CFT","Micro-transactions vers corridors sensibles","🪙",2,False,
  "Petits montants à haute fréquence vers des corridors géographiques sensibles (le CFT ne ressemble pas au blanchiment : montants faibles).",
  "23 transferts de CHF 150-400 en 60 jours vers 3 pays limitrophes d'une zone de conflit.",
  "Fréquence × faible montant unitaire × corridor sensible (liste tenant distincte des HRJ blanchiment).",
  "Signal CFT_MICRO_PATTERN (Niveau 2) — analyse dédiée CFT, jamais agrégé avec les seuils ML classiques.",
  [["corridors_cft","liste corridors CFT","tenant","-"],["freq_micro_seuil","transferts / 60j","10","-"],["montant_micro_max","montant unitaire max","500","CHF"]],
  [TP("CLI-00084","23 micro-transferts vers des collecteurs relais identifiés par la suite dans une enquête — TP."),
   FP("CLI-00035","Soutien familial mensuel régulier vers le pays d'origine, bénéficiaire unique documenté (famille au KYC) — remittance légitime, FP.")]),
R("FT-02","R370","CFT","Collectes / ONG à risque","🤲",2,False,
  "Dons et collectes atypiques vers des organisations à but non lucratif à risque (GAFI R.8), crowdfunding non tracé.",
  "Des dons partent vers une association récemment créée, sans agrément, active dans une zone à risque.",
  "Croisement bénéficiaire ONG × registre des NPO à risque × ancienneté/agrément.",
  "Signal NPO_RISK (Niveau 2) — vérification de l'organisation et de la chaîne de distribution des fonds.",
  [["registre_npo","référentiel NPO surveillées","tenant","-"]],
  [TP("CLI-00084","Dons répétés vers une association-écran dissoute 8 mois plus tard, dirigeants condamnés — TP."),
   FP("CLI-00110","Dons vers une ONG certifiée ZEWO opérant en zone à risque avec audit de distribution publié — organisation vérifiée, FP.")]),
R("FT-03","R371","CFT","Cartes prépayées multi-sources","💳",2,False,
  "Rechargements de cartes prépayées depuis des sources multiples, retraits en zone frontalière ou à l'étranger.",
  "Une carte est rechargée par 5 personnes différentes puis vidée en retraits ATM dans un pays frontalier d'une zone de conflit.",
  "Nombre de sources de rechargement distinctes + géographie des retraits.",
  "Signal PREPAID_FUNDING (Niveau 2) — gel du rechargement tiers après décision humaine.",
  [["sources_rechargement_seuil","sources distinctes / 90j","3","-"]],
  [TP("CLI-00084","Carte financée par 5 tiers et vidée en cash à la frontière turco-syrienne — TP."),
   FP("CLI-00121","Carte d'étudiant rechargée par ses deux parents et un grand-parent (liens familiaux au dossier), retraits sur le lieu d'études — FP.")]),
R("FT-04","R372","CFT","Cohérence voyages ↔ flux","✈",2,False,
  "Croisement des Business Trips / voyages connus du client avec des flux vers zones de conflit (le module Trip existe côté RM ; le croisement CFT n'existe pas).",
  "Un client retire du cash inhabituel juste avant un voyage déclaré vers un pays frontalier d'une zone de conflit.",
  "Corrélation temporelle voyage déclaré/détecté × retraits cash atypiques × destination sensible.",
  "Signal TRAVEL_FLOW_MISMATCH (Niveau 2) — entretien de clarification, trace CFT dédiée.",
  [["fenetre_voyage","fenêtre avant/après voyage","14","jours"]],
  [TP("CLI-00084","Retraits de 18k en 10 jours avant un déplacement vers une zone frontalière, sans explication — TP."),
   FP("CLI-00007","Retraits avant un pèlerinage documenté avec agence de voyage agréée et itinéraire fourni — motif religieux légitime, FP.")]),
R("FT-05","R373","CFT","Listes terroristes dédiées","🛑",1,True,
  "Screening distinct contre les ordonnances/listes terroristes (séparé des sanctions économiques : gouvernance, escalade et déclaration diffèrent).",
  "Une contrepartie matche une liste d'une ordonnance fédérale anti-terrorisme (hors listes SECO économiques).",
  "Canal de screening dédié listes CFT, avec circuit d'escalade propre.",
  "TRANSACTION BLOQUÉE (Niveau 1) — gel immédiat, MROS, escalade direction, décision humaine tracée.",
  [["listes_cft","listes CFT actives","tenant","-"]],
  [TP("CLI-00084","Match exact (nom + date de naissance) sur une liste d'ordonnance fédérale — gel et déclaration."),
   FP("CLI-00099","Homonymie sur un nom très courant, date de naissance divergente de 30 ans — levé après vérification, FP.")]),

# ══ BLOC 56 — GOUVERNANCE DU TUNING (R374-R377) ══
R("GV-01","R374","Gouvernance du dispositif","Below-the-line sampling","🎚",0,False,
  "Campagne périodique d'échantillonnage sous les seuils : des transactions juste en-dessous des seuils actifs sont revues pour valider le calibrage.",
  "Le trimestre écoulé compte 1'240 transactions entre 80% et 100% du seuil du scénario structuring.",
  "La campagne BTL tire un échantillon stratifié (paramètre tenant) et le route en revue Compliance.",
  "Événement tuning.btl.campagne — résultats consolidés : si des TP sont trouvés sous le seuil, proposition de baisse via l'Intelligence Studio (validation humaine, versionnée, réversible).",
  [["taux_echantillon_btl","taux d'échantillonnage","2","%"],["bande_btl","bande sous le seuil","80-100","%"],["frequence_btl","fréquence de campagne","90","jours"]],
  [TP("—","Campagne T2 : 2 cas suspects trouvés à 85% du seuil structuring → seuil abaissé de 20k à 18k (version v1.3, simulée puis déployée)."),
   FP("—","Campagne T3 : 0 TP sous seuil sur 25 dossiers échantillonnés → calibrage confirmé, rapport archivé.")]),
R("GV-02","R375","Gouvernance du dispositif","Backtesting par version","📈",0,False,
  "Backtesting formel de chaque version de scénario : TP/FP historisés par version, comparaison avant/après tout changement de seuil.",
  "Le seuil du scénario velocity est passé de 4× à 5× il y a 90 jours (v1.2).",
  "Le backtest rejoue la fenêtre sur les deux versions et compare TP, FP, alertes manquées.",
  "Rapport de backtest versionné attaché à la version du scénario — rollback proposé si dégradation du rappel (décision humaine).",
  [["fenetre_backtest","fenêtre de rejeu","90","jours"],["seuil_degradation","perte de rappel max tolérée","0","TP manqué"]],
  [TP("—","v1.2 du velocity : -40% de FP, 0 TP manqué sur 90j — changement validé et documenté."),
   FP("—","v2.0 du round-amounts aurait manqué 1 TP historique — rollback v1.4 exécuté, écart consigné.")]),
R("GV-03","R376","Gouvernance du dispositif","Data quality pré-conditions","🧪",1,False,
  "Contrôles de qualité de données amont comme pré-condition des scénarios : un scénario aveugle (champs SWIFT incomplets, devises manquantes) est un faux négatif silencieux.",
  "8% des MT103 du jour arrivent sans champ ordonnateur exploitable.",
  "Le contrôle DQ mesure la complétude des champs critiques par flux ; sous le seuil, les scénarios dépendants sont marqués « dégradés ».",
  "Signal DQ_DEGRADED (Niveau 1, ops) — visible au dashboard Compliance, jamais silencieux (esprit dead-letters R39).",
  [["completude_min","complétude minimale des champs critiques","98","%"]],
  [TP("—","Champ 50 vide sur 8% des messages d'un correspondant pendant 3 jours : le wire-stripping était indétectable — corrigé, période re-screenée."),
   FP("—","Chute de complétude due à un nouveau format ISO 20022 mal mappé (données présentes, parsing KO) — mapping corrigé, FP.")]),
R("GV-04","R377","Gouvernance du dispositif","Revue annuelle de calibrage","📋",0,False,
  "Revue annuelle documentée du dispositif : couverture typologique, performance par scénario, décisions de calibrage — annexée au rapport LBA Direction (art. 25a OBA-FINMA).",
  "L'exercice se clôt ; chaque scénario a un historique TP/FP et des versions.",
  "La revue consolide couverture (matrice typologies GAFI × scénarios), performance et écarts.",
  "Rapport de calibrage annuel généré, visé four-eyes, archivé GED — section dédiée du rapport Direction.",
  [["matrice_couverture","référentiel de typologies de la matrice","GAFI+OBA-FINMA","-"]],
  [TP("—","Revue 2026 : 3 angles morts identifiés (TBML, CBK, prolifération) → wave 2 planifiée et arbitrée en comité."),
   FP("—","—")]),
]

# ── Wave 2 (blocs 57-61) ──
exec(open(os.path.join(_HERE, 'wave2_rules.py'), encoding='utf-8').read())
RULES += WAVE2

# ════════ ÉMISSION ════════
import io, collections

# 1) Dataset GT JSON
cases = []
for r in RULES:
    for i, c in enumerate(r["cases"]):
        cases.append(dict(caseId=r["id"]+"-C"+str(i+1), rule=r["rule"], scenarioId=r["id"], fam=r["fam"],
                          nom=r["nom"], label=c["label"], clientId=c["client"], narrative=c["txt"]))
ds = dict(dataset="aml-gap-gt", version="1.0", generated="2026-08-04",
          note="Cas plantés déterministes — TP = alerte confirmée en investigation, FP = alerte légitimement déclenchée puis écartée avec motif. Sert de corpus de test (chaque cas DOIT déclencher son scénario) et de base de métriques TP/FP par version.",
          stats=dict(rules=len(RULES), cases=len(cases),
                     tp=sum(1 for c in cases if c["label"]=="TP"), fp=sum(1 for c in cases if c["label"]=="FP")),
          cases=cases)
open(os.path.join(_ROOT, 'data', 'aml-gap-dataset-gt.json'),'w',encoding='utf-8').write(json.dumps(ds, ensure_ascii=False, indent=1))

# 2) Bloc JS pour la démo
def js(o): return json.dumps(o, ensure_ascii=False)
lines = ["// ══ C50_GAP — WAVE 1 GAP ANALYSIS (blocs 50-56, R340-R377 provisoires — mapping step-0) ══",
         "// Chaque entrée porte ses cas plantés TP/FP (dataset GT) — source: GEN-AML-GAP",
         "const C50_GAP = ["]
for r in RULES:
    e = dict(on=True, id=r["id"], rule=r["rule"], fam=r["fam"], nom=r["nom"], ico=r["ico"], niveau=r["niveau"],
             block=r["block"], desc=r["desc"], given=r["given"], when=r["when"], then=r["then"],
             params=r["params"], cases=r["cases"])
    lines.append("    " + js(e) + ",")
lines.append("];")
open(os.path.join(_ROOT, 'data', 'c50gap.gen.js'),'w',encoding='utf-8').write("\n".join(lines))

# 3) Sections règles pour la SPEC
out = io.StringIO()
fams = collections.OrderedDict()
for r in RULES: fams.setdefault(r["fam"], []).append(r)
blocnum = {"Screening en flux":50,"Indices OBA-FINMA":51,"Vision groupe UBO":52,"Instruments PB":53,"Crypto / VASP":54,"CFT":55,"Gouvernance du dispositif":56,"TBML":57,"Correspondent Banking":58,"Prolifération":59,"Immobilier & Art":60,"Analytique 2G":61}
out2 = io.StringIO()
WAVE2_FAMS = {"TBML","Correspondent Banking","Prolifération","Immobilier & Art","Analytique 2G"}
for fam, rs in fams.items():
    r0, r1 = rs[0]["rule"], rs[-1]["rule"]
    dest = out2 if fam in WAVE2_FAMS else out
    dest.write(f"\n## Bloc {blocnum[fam]} — {fam} ({r0}–{r1})\n\n")
    for r in rs:
        blk = " · **BLOQUANT** (contrainte type R13, pas SLA)" if r["block"] else ""
        niv = f"Niveau {r['niveau']}" if r["niveau"] else "Campagne/ops"
        dest.write(f"### {r['rule']} ({r['id']}) — {r['nom']} — {niv}{blk}\n")
        dest.write(f"{r['desc']}\n\n")
        dest.write(f"**Gherkin (scénario nominal, à décliner en tests rouges avant code)**\n")
        dest.write(f"- Given — {r['given']}\n- When — {r['when']}\n- Then — {r['then']}\n\n")
        if r["params"]:
            dest.write("**Paramètres tenant (registre R-Q)** : " + " ; ".join(f"`{p[0]}` ({p[1]}, défaut {p[2]} {p[3]})".replace(" -","") for p in r["params"]) + "\n\n")
        tps = [c for c in r["cases"] if c["label"]=="TP"]; fps = [c for c in r["cases"] if c["label"]=="FP"]
        dest.write(f"**Cas GT plantés** : {len(tps)} TP · {len(fps)} FP\n")
        for c in r["cases"]:
            dest.write(f"- [{c['label']}] {c['client']} — {c['txt']}\n")
        dest.write("\n")
open(os.path.join(_GEN, 'aml-gap-wave1-sections.md'),'w',encoding='utf-8').write(out.getvalue())
open(os.path.join(_GEN, 'aml-gap-wave2-sections.md'),'w',encoding='utf-8').write(out2.getvalue())
print("OK — règles:", len(RULES), "| cas GT:", len(cases), "| TP:", ds["stats"]["tp"], "| FP:", ds["stats"]["fp"])
print("  → data/aml-gap-dataset-gt.json · data/c50gap.gen.js · spec/generated/aml-gap-wave{1,2}-sections.md")
