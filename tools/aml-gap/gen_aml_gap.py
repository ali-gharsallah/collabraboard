#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_aml_gap.py — GÉNÉRATEUR / SOURCE DE VÉRITÉ de la vague AML Gap Wave 1 (blocs 50–56).

Numéros DÉFINITIFS (step-0, 2026-08-04, spec/mapping-session-repo.md §4) :
    R340–R377 (identité provisoire = repo), 38 scénarios, familles SF/QO/GU/IP/CR/FT/GV.

Toute modification de règle passe par CE fichier — JAMAIS par édition manuelle des artefacts
générés (aml-gap-rules.json, aml-gap-dataset-gt.json). Le générateur ne DÉDUIT rien et n'INVENTE
rien : il transcrit l'annexe de SPEC-AMLGAP-WAVE1.md (ratifiée PO le 04.08.2026). Les cas GT dont
la spec laisse le contenu vide (« — — — ») sont émis comme placeholders explicites, jamais comblés.

Données 100 % synthétiques et déterministes (graine fixe → mêmes fichiers, chiffres comparables
dans le temps ; même discipline que services/screening/generate.mjs). Aucune personne réelle.

    python3 tools/aml-gap/gen_aml_gap.py          # (re)génère les deux artefacts
"""

import json
import os

SEED = 20260804  # step-0 : mêmes fichiers à chaque exécution
HERE = os.path.dirname(os.path.abspath(__file__))

# Règles émettant `aml.block.requested` (BLOQUANT — contrainte type R13, pas SLA). Source : §1.2 spec.
BLOCKING = {"R344", "R346", "R363", "R365", "R367", "R373"}


def _p(key, label, default):
    """Paramètre tenant (registre R-Q)."""
    return {"key": key, "label": label, "default": default}


def _gt(client, narrative, ecartement=None):
    """Cas GT. `ecartement` = cause d'écartement documentée (FP uniquement). client='—' pour la
    gouvernance. narrative='' + placeholder pour un cas que la spec laisse vide (R377 FP)."""
    row = {"clientId": client, "narrative": narrative}
    if ecartement is not None:
        row["ecartement"] = ecartement
    return row


# ── ANNEXE TRANSCRITE (SPEC-AMLGAP-WAVE1.md § « RÈGLES DÉTAILLÉES ») ──────────────────────────
# Chaque bloc : (numero, titre, plage, famille, [regles]). Chaque règle :
#   id, ruleRef, titre, desc, niveau (int|None), kind, signal, given/when/then, params, tp[], fp[]
# kind ∈ {"detection","ops","campagne"} — les campagnes/ops de gouvernance n'ont pas de « niveau ».

BLOCS = [
    (50, "Screening en flux", "R340–R346", "SF", [
        dict(
            id="SF-01", ruleRef="R340", niveau=2, kind="detection", signal="PEP_COUNTERPARTY",
            titre="Contrepartie PEP en flux",
            desc="Screening PEP de la contrepartie de chaque transaction entrante/sortante, pas seulement du client à l'onboarding.",
            given="Un virement entrant de CHF 180k provient d'une contrepartie non cliente matchant une liste PEP (ministre en fonction, pays tiers).",
            when="Le screening en flux (nom + pays + date de naissance si dispo) matche la contrepartie avec un score >= seuil tenant.",
            then="Signal PEP_COUNTERPARTY (Niveau 2) — alerte CO avec fiche de match, aucune contamination du statut client sans revue humaine (R44).",
            params=[_p("seuil_match_pep_flux", "Score de similarité minimal", 78),
                    _p("listes_pep", "Fournisseurs de listes PEP actives", "tenant")],
            tp=[_gt("CLI-00016", "Virement de 180k reçu du frère d'un ministre en exercice (liste PEP, match 91%) — investigation confirme l'origine politique des fonds."),
                _gt("CLI-00039", "Sortie de 95k vers une société détenue par un PEP régional sanctionnable — lien confirmé au registre.")],
            fp=[_gt("CLI-00003", "Homonyme parfait d'un PEP brésilien ; la date de naissance et le pays divergent — clôturé FP après vérification documentaire.", "homonymie (DDN + pays divergents)")],
        ),
        dict(
            id="SF-02", ruleRef="R341", niveau=2, kind="detection", signal="ADVERSE_COUNTERPARTY",
            titre="Adverse media sur contrepartie",
            desc="Presse négative (blanchiment, fraude, corruption) sur la contrepartie d'une transaction au moment du flux.",
            given="Une sortie de CHF 60k vise une société citée la veille dans une enquête pour corruption (source de rang 1).",
            when="Le screening adverse media en flux matche la contrepartie avec une catégorie AML-pertinente et une source pondérée >= seuil.",
            then="Signal ADVERSE_COUNTERPARTY (Niveau 2) — alerte avec extrait sourcé et daté ; l'humain qualifie.",
            params=[_p("rang_source_min", "Rang minimal de fiabilité de la source", 2),
                    _p("categories_am", "Catégories retenues (ML, fraude, corruption, TF)", "tenant")],
            tp=[_gt("CLI-00075", "Paiement fournisseur vers une société mise en accusation pour corruption d'agents publics (3 sources de rang 1) — TP confirmé.")],
            fp=[_gt("CLI-00041", "Match sur un article concernant une société homonyme d'un autre canton — secteur et IDE différents, clôturé FP.", "homonymie d'entité (secteur + IDE différents)")],
        ),
        dict(
            id="SF-03", ruleRef="R342", niveau=2, kind="detection", signal="SCREENING_DELTA",
            titre="Re-screening périodique (perpetual)",
            desc="Re-screening automatique périodique de tout le stock clients + personnes liées (sanctions/PEP/adverse), différentiel uniquement.",
            given="Le batch nocturne re-screene 5'000 clients ; un client existant apparaît nouvellement sur une liste PEP suite à une nomination.",
            when="Le différentiel (nouveau hit vs dernier run) est détecté et rattaché au dossier.",
            then="Événement screening.delta → ouverture automatique d'un Change of Circumstances typé SCREENING_DELTA, routé au rôle Compliance (registre CoC).",
            params=[_p("frequence_rescreen", "Fréquence du re-screening du stock (heures)", 24),
                    _p("scope_personnes_liees", "Inclure les personnes liées", True)],
            tp=[_gt("CLI-00034", "Client nommé au conseil d'administration d'une entreprise publique — delta PEP détecté à J+1, CoC ouvert, EDD déclenchée."),
                _gt("CLI-00070", "UBO ajouté à la liste SECO lors d'un train de sanctions — delta détecté, relation gelée après décision humaine.")],
            fp=[_gt("CLI-00005", "Mise à jour de format du fournisseur de listes régénère un hit déjà écarté (même ID de profil) — dédoublonné puis clôturé FP ; correctif de mapping consigné.", "hit déjà écarté régénéré par changement de format (même ID profil)")],
        ),
        dict(
            id="SF-04", ruleRef="R343", niveau=2, kind="detection", signal="INTERMEDIARY_HIT",
            titre="Banques intermédiaires (BIC)",
            desc="Screening des BIC de la chaîne de paiement (champ 56/57), pas seulement des parties finales.",
            given="Un MT103 transite par une banque intermédiaire dont la maison mère est sous sanctions sectorielles.",
            when="Chaque BIC de la chaîne est screené contre les listes sanctions + liste interne banques à risque.",
            then="Signal INTERMEDIARY_HIT (Niveau 2) — routage alternatif proposé, décision humaine avant exécution.",
            params=[_p("liste_bic_interne", "Liste interne de banques surveillées", "tenant")],
            tp=[_gt("CLI-00130", "Paiement vers Singapour routé via une intermédiaire filiale d'un groupe sous sanctions sectorielles — re-routé après alerte.")],
            fp=[_gt("CLI-00018", "BIC matché sur l'ancien code d'une banque assainie et retirée des listes depuis 2024 — référentiel BIC mis à jour, FP.", "référentiel BIC obsolète (banque délistée depuis 2024)")],
        ),
        dict(
            id="SF-05", ruleRef="R344", niveau=1, kind="detection", signal="GEO_SANCTION",
            titre="Adresse / localisation sanctionnée",
            desc="Sanctions par localisation : adresses et villes de régions sous embargo (Crimée, régions occupées), au-delà du seul nom.",
            given="Un virement sortant indique une adresse bénéficiaire à Sébastopol.",
            when="Le parsing d'adresse (ville, région, code postal) matche le référentiel géographique sanctionné.",
            then="TRANSACTION BLOQUÉE (Niveau 1) — motif géographique explicite, dossier MROS préparé, décision humaine requise (R44).",
            params=[_p("referentiel_geo_sanctions", "Référentiel des zones sanctionnées", "tenant")],
            tp=[_gt("CLI-00070", "Bénéficiaire domicilié dans une région sous embargo — blocage confirmé, déclaration préparée.")],
            fp=[_gt("CLI-00035", "Rue « Crimée » à Paris 19e matchée par le parseur — règle affinée (ville+pays requis), FP documenté.", "faux match toponymique (rue « Crimée » à Paris)")],
        ),
        dict(
            id="SF-06", ruleRef="R345", niveau=2, kind="detection", signal="MULTISCRIPT_HIT",
            titre="Translittération multi-scripts",
            desc="Matching étendu arabe/cyrillique/chinois : variantes de translittération normalisées avant screening (le moteur IDF+trigram est latin-centrique).",
            given="Un ordonnateur « Мухаммад Аль-Рашид » (cyrillique) correspond à un profil sanctionné translittéré « Muhammad Al-Rashid ».",
            when="La normalisation multi-scripts (ICU + tables de translittération) produit les variantes avant le matching baseline.",
            then="Le hit est détecté malgré l'écart de script — signal standard du canal concerné, variante gagnante tracée.",
            params=[_p("scripts_actifs", "Scripts normalisés", "AR,CYR,ZH")],
            tp=[_gt("CLI-00045", "Contrepartie en caractères chinois matchant un profil OFAC translittéré — non détectable sans normalisation, TP.")],
            fp=[_gt("CLI-00193", "Translittération agressive rapproche deux patronymes arabes courants distincts — seuil par script relevé, FP.", "translittération trop agressive (patronymes distincts)")],
        ),
        dict(
            id="SF-07", ruleRef="R346", niveau=1, kind="detection", signal="VESSEL_HIT",
            titre="Navires & IMO",
            desc="Screening des navires (nom, numéro IMO, pavillon) sur les paiements liés au négoce et au shipping.",
            given="Un crédit documentaire référence un navire dont l'IMO figure sur la liste OFAC (shadow fleet).",
            when="Extraction du nom/IMO depuis les champs libres et les documents, screening dédié navires.",
            then="TRANSACTION BLOQUÉE (Niveau 1) — gel, escalade sanctions, décision humaine requise.",
            params=[_p("extraction_imo", "Extraction IMO des champs libres", True)],
            tp=[_gt("CLI-00039", "LC référençant un tanker de la flotte fantôme (IMO sanctionné, pavillon changé 3× en 12 mois) — blocage confirmé.")],
            fp=[_gt("CLI-00130", "Navire homonyme d'une unité sanctionnée mais IMO distinct et pavillon UE — libéré après vérification IMO, FP.", "homonymie de navire (IMO distinct, pavillon UE)")],
        ),
    ]),
    (51, "Indices OBA-FINMA", "R347–R351", "QO", [
        dict(
            id="QO-01", ruleRef="R347", niveau=2, kind="detection", signal="INFO_REFUSAL",
            titre="Refus de fournir des informations",
            desc="Le refus du client de fournir les informations usuelles (origine des fonds, justificatifs) devient un signal structuré, pas une note libre.",
            given="Le RM demande un justificatif d'origine pour un apport de CHF 500k ; le client refuse explicitement à deux reprises.",
            when="Le RM déclare le refus via le workflow dédié (motif, pièces demandées, dates) — événement kyc.refus_information.",
            then="Signal INFO_REFUSAL (Niveau 2) — tâche CO, blocage possible de l'apport après décision humaine, trace au registre art. 7.",
            params=[_p("nb_relances_avant_signal", "Relances avant signal", 2)],
            tp=[_gt("CLI-00043", "Refus réitéré de documenter un apport de 500k malgré 2 relances écrites — relation dénoncée après comité.")],
            fp=[_gt("CLI-00053", "Retard de 3 semaines dû à une succession en cours chez le notaire — documents fournis, signal clôturé FP.", "retard légitime (succession chez le notaire)")],
        ),
        dict(
            id="QO-02", ruleRef="R348", niveau=2, kind="detection", signal="TRANSIT_ACCOUNT",
            titre="Compte de passage multi-titulaires",
            desc="Compte utilisé comme compte de passage par de nombreuses personnes distinctes (indice annexe OBA-FINMA), au-delà du seul critère temporel.",
            given="Un compte reçoit des fonds de 9 ordonnateurs distincts sans lien documenté en 30 jours, ressortis vers 6 bénéficiaires.",
            when="Comptage des tiers distincts entrée + sortie / fenêtre glissante, croisé avec les personnes liées du KYC.",
            then="Signal TRANSIT_ACCOUNT (Niveau 2) — cartographie des tiers jointe, revue du but de la relation.",
            params=[_p("tiers_distincts_seuil", "Tiers distincts / 30j", 6)],
            tp=[_gt("CLI-00072", "11 ordonnateurs inconnus en 3 semaines, fonds ressortis sous 48h — typologie mule/passage confirmée.")],
            fp=[_gt("CLI-00110", "Fondation caritative recevant des dons multiples pendant sa campagne annuelle déclarée au KYC — but documenté, FP.", "but documenté au KYC (campagne caritative)")],
        ),
        dict(
            id="QO-03", ruleRef="R349", niveau=2, kind="detection", signal="NO_ECON_RATIONALE",
            titre="Opération sans justification économique",
            desc="Red flag déclaratif du conseiller : opération constatée sans justification économique apparente, tracée et routée (jamais silencieuse).",
            given="Le RM constate un achat-revente de titres à perte immédiate entre comptes du même client, sans logique d'investissement.",
            when="Le RM soulève le red flag via le formulaire structuré (opération, constat, échange client) — événement rm.redflag.",
            then="Signal NO_ECON_RATIONALE (Niveau 2) — investigation CO, réponse du client consignée.",
            params=[_p("delai_reponse_client", "Délai de réponse attendu (jours)", 10)],
            tp=[_gt("CLI-00080", "Aller-retour titres à perte de 4% en 48h répété 3× — habillage de transferts de valeur confirmé.")],
            fp=[_gt("CLI-00104", "Vente à perte fin décembre puis rachat en janvier — tax-loss harvesting documenté par le gérant, FP.", "tax-loss harvesting documenté")],
        ),
        dict(
            id="QO-04", ruleRef="R350", niveau=1, kind="detection", signal="SHARED_ADDRESS",
            titre="Adresse partagée multi-clients",
            desc="Domiciliation c/o ou adresse identique partagée par de nombreux clients sans lien déclaré.",
            given="8 clients sans lien familial ni sociétal déclaré partagent la même adresse de domiciliation c/o une fiduciaire.",
            when="Normalisation d'adresse + comptage des clients distincts par adresse, seuil tenant.",
            then="Signal SHARED_ADDRESS (Niveau 1) — revue du caractère de société de domicile (CDB 20, form. K).",
            params=[_p("clients_par_adresse_seuil", "Clients distincts par adresse", 5)],
            tp=[_gt("CLI-00043", "14 sociétés clientes domiciliées à la même adresse d'un prestataire offshore — requalification en sociétés de domicile.")],
            fp=[_gt("CLI-00018", "Membres d'une même famille (grand-parents, enfants, holding familiale) à l'adresse du family office — liens déclarés, FP.", "liens familiaux déclarés (family office)")],
        ),
        dict(
            id="QO-05", ruleRef="R351", niveau=2, kind="detection", signal="GOVERNANCE_CHURN",
            titre="Rotation des procurations / instructions",
            desc="Changements fréquents de procurations, signataires ou instructions permanentes sans justification.",
            given="3 changements de fondé de pouvoir en 6 mois, dont un révoqué 2 semaines après nomination.",
            when="Comptage des événements de gouvernance du compte / fenêtre, croisé avec l'activité transactionnelle.",
            then="Signal GOVERNANCE_CHURN (Niveau 2) — revue de la maîtrise réelle du compte (ADE effectif).",
            params=[_p("chgts_gouvernance_seuil", "Changements / 6 mois", 3)],
            tp=[_gt("CLI-00034", "Rotation de 4 mandataires en 5 mois masquant l'opérateur réel du compte — ADE requalifié.")],
            fp=[_gt("CLI-00016", "Réorganisation du family office documentée (départ CFO, arrivée de deux successeurs) — actes fournis, FP.", "réorganisation documentée (départ CFO)")],
        ),
    ]),
    (52, "Vision groupe UBO", "R352–R355", "GU", [
        dict(
            id="GU-01", ruleRef="R352", niveau=2, kind="detection", signal="GROUP_STRUCTURING",
            titre="Structuring cross-comptes du groupe",
            desc="Agrégation des flux sur le périmètre consolidé de l'UBO (tous comptes, toutes entités) : le fractionnement réparti sur plusieurs entités devient visible.",
            given="Un UBO contrôle 4 entités ; chacune dépose CHF 18k la même semaine (72k agrégés, unitaire sous le seuil de 20k).",
            when="Le moteur agrège par ubo_group_id (graphe des personnes liées) sur la fenêtre glissante.",
            then="Signal GROUP_STRUCTURING (Niveau 2) — vue consolidée jointe, chaque entité référencée.",
            params=[_p("fenetre_agregation_ubo", "Fenêtre d'agrégation (jours)", 7),
                    _p("seuil_agrege_ubo", "Seuil agrégé groupe (CHF)", 50000)],
            tp=[_gt("CLI-00005", "4 dépôts de 18-19k via holding, SCI et deux comptes personnels du même UBO en 6 jours — structuring de groupe confirmé.")],
            fp=[_gt("CLI-00152", "Distributions de dividendes simultanées des filiales vers la holding, calendrier d'AG documenté — flux légitimes, FP.", "distributions de dividendes documentées (calendrier d'AG)")],
        ),
        dict(
            id="GU-02", ruleRef="R353", niveau=2, kind="detection", signal="GROUP_CIRCULAR",
            titre="Flux circulaires intra-groupe",
            desc="Fonds circulant entre entités du même UBO sans substance (A→B→C→A intra-périmètre).",
            given="CHF 300k font le tour de 3 entités du même UBO en 12 jours et reviennent au point de départ.",
            when="Détection de cycle sur le graphe restreint au périmètre UBO.",
            then="Signal GROUP_CIRCULAR (Niveau 2) — demande de justification économique consolidée.",
            params=[_p("duree_cycle_max", "Durée max du cycle détecté (jours)", 30)],
            tp=[_gt("CLI-00101", "Rotation de 300k entre 3 entités pour gonfler artificiellement les bilans avant une demande de crédit — TP.")],
            fp=[_gt("CLI-00016", "Cash pooling intra-groupe documenté par convention de trésorerie — mécanique déclarée au KYC, FP.", "cash pooling documenté (convention de trésorerie)")],
        ),
        dict(
            id="GU-03", ruleRef="R354", niveau=2, kind="detection", signal="GROUP_CASH_INTENSITY",
            titre="Cash consolidé du périmètre",
            desc="Intensité cash mesurée au niveau du périmètre UBO : chaque entité reste sous les radars, le groupe non.",
            given="5 entités du même UBO déposent chacune ~CHF 9k d'espèces par mois (45k/mois consolidés).",
            when="Ratio cash consolidé / volume consolidé du groupe, seuils par groupe CPSI.",
            then="Signal GROUP_CASH_INTENSITY (Niveau 2) — ventilation par entité jointe.",
            params=[_p("ratio_cash_groupe", "Ratio cash consolidé max (%)", 25)],
            tp=[_gt("CLI-00033", "45k/mois d'espèces répartis sur 5 entités d'un même bénéficiaire, activité déclarée sans lien avec le cash — TP.")],
            fp=[_gt("CLI-00041", "Groupe de restaurants du même propriétaire : intensité cash cohérente avec le secteur déclaré de chaque entité, FP.", "intensité cash cohérente au secteur déclaré (restauration)")],
        ),
        dict(
            id="GU-04", ruleRef="R355", niveau=2, kind="detection", signal="CROSS_PRODUCT_AGGREGATE",
            titre="Seuils agrégés cross-produits",
            desc="Agrégation cash + titres + FX + crédit : un pattern réparti entre produits (dépôt cash, achat titres FOP, tirage lombard) est détecté globalement.",
            given="Dépôt cash 15k + transfert in-specie 40k + tirage lombard 30k la même semaine, aucun produit ne franchit seul son seuil.",
            when="Normalisation en équivalent CHF et agrégation cross-produits par client et par groupe UBO.",
            then="Signal CROSS_PRODUCT_AGGREGATE (Niveau 2) — décomposition par produit jointe.",
            params=[_p("seuil_cross_produits", "Seuil agrégé équivalent (CHF)", 75000)],
            tp=[_gt("CLI-00072", "Combinaison cash + in-specie + lombard totalisant 85k/semaine en contournement des seuils unitaires — TP.")],
            fp=[_gt("CLI-00164", "Rééquilibrage trimestriel de portefeuille documenté par le mandat de gestion (mouvements multi-produits simultanés), FP.", "rééquilibrage documenté (mandat de gestion)")],
        ),
    ]),
    (53, "Instruments PB", "R356–R362", "IP", [
        dict(
            id="IP-01", ruleRef="R356", niveau=2, kind="detection", signal="LOMBARD_THIRD_PARTY",
            titre="Lombard — remboursement par tiers",
            desc="Crédit lombard remboursé par anticipation par un tiers sans lien documenté avec l'emprunteur.",
            given="Un lombard de CHF 800k est soldé 4 mois après tirage par un virement d'une société tierce inconnue du dossier.",
            when="Croisement remboursement anticipé × identité de l'ordonnateur × personnes liées du KYC.",
            then="Signal LOMBARD_THIRD_PARTY (Niveau 2) — fonds en attente de documentation SOF avant mainlevée du nantissement.",
            params=[_p("delai_anticipe_min", "Remboursement considéré anticipé si < (mois)", 12)],
            tp=[_gt("CLI-00043", "Lombard soldé par une société panaméenne étrangère au dossier — le crédit servait à donner une apparence bancaire aux fonds, TP.")],
            fp=[_gt("CLI-00152", "Remboursement par la holding mère de l'emprunteur, convention de trésorerie au dossier — lien documenté, FP.", "lien documenté (holding mère, convention de trésorerie)")],
        ),
        dict(
            id="IP-02", ruleRef="R357", niveau=1, kind="detection", signal="BACK_TO_BACK",
            titre="Back-to-back loan",
            desc="Dépôt (souvent offshore) nantissant un prêt accordé à une entité liée : séparation artificielle de l'origine des fonds.",
            given="Un dépôt de CHF 2M d'une entité des Caïmans garantit un prêt de 1.8M à une société suisse du même UBO.",
            when="Détection nantissement × prêt dont déposant et emprunteur partagent le périmètre UBO ou des liens déclarés/détectés.",
            then="Signal BACK_TO_BACK (Niveau 1) — origine du dépôt à corroborer avant tout tirage, escalade EDD.",
            params=[_p("perimetre_lien", "Liens retenus (UBO, famille, signataires)", "tenant")],
            tp=[_gt("CLI-00033", "Dépôt offshore non corroboré garantissant un prêt à l'entité opérationnelle suisse du même bénéficiaire — schéma B2B confirmé.")],
            fp=[_gt("CLI-00016", "Garantie intra-groupe standard d'un family office, origine des fonds corroborée à l'ouverture — structure déclarée, FP.", "structure déclarée + SOF corroborée à l'ouverture")],
        ),
        dict(
            id="IP-03", ruleRef="R358", niveau=2, kind="detection", signal="WRAPPER_PREMIUM",
            titre="Wrapper assurance — prime hors profil",
            desc="Souscription d'assurance-vie à prime unique élevée, incohérente avec le patrimoine et les revenus déclarés.",
            given="Prime unique de CHF 1.5M pour un client au patrimoine déclaré de 900k.",
            when="Ratio prime / patrimoine déclaré + origine de la prime (compte tiers ?).",
            then="Signal WRAPPER_PREMIUM (Niveau 2) — corroboration SOW avant acceptation du contrat.",
            params=[_p("ratio_prime_patrimoine", "Ratio prime/patrimoine max (%)", 60)],
            tp=[_gt("CLI-00048", "Prime de 1.5M financée par trois virements de sociétés tierces, patrimoine déclaré 900k — support d'intégration, TP.")],
            fp=[_gt("CLI-00005", "Prime élevée financée par la vente documentée d'un bien immobilier (acte notarié au dossier) — SOW corroborée, FP.", "SOW corroborée (vente immobilière, acte notarié)")],
        ),
        dict(
            id="IP-04", ruleRef="R359", niveau=2, kind="detection", signal="EARLY_SURRENDER",
            titre="Wrapper assurance — rachat précoce",
            desc="Rachat de la police peu après souscription, pénalités acceptées sans discussion (le coût du blanchiment est assumé).",
            given="Rachat total à 7 mois d'une police à prime unique, pénalité de 4% acceptée sans négociation.",
            when="Délai souscription→rachat < seuil + acceptation de pénalité + bénéficiaire du rachat ≠ souscripteur.",
            then="Signal EARLY_SURRENDER (Niveau 2) — investigation sur la finalité réelle du produit.",
            params=[_p("delai_rachat_min", "Rachat considéré précoce si < (mois)", 24)],
            tp=[_gt("CLI-00043", "Rachat à 7 mois versé sur un compte tiers à Dubaï, pénalité assumée — la police n'a servi que de sas, TP.")],
            fp=[_gt("CLI-00110", "Rachat à 10 mois pour financer une acquisition immobilière urgente (compromis de vente fourni) — besoin réel, FP.", "besoin réel documenté (acquisition immobilière)")],
        ),
        dict(
            id="IP-05", ruleRef="R360", niveau=2, kind="detection", signal="BENEFICIARY_SWITCH",
            titre="Changement de bénéficiaire post-souscription",
            desc="Modification du bénéficiaire de la police peu après souscription, vers un tiers sans lien.",
            given="Le bénéficiaire passe du conjoint à une société étrangère 3 mois après souscription.",
            when="Événement de changement de bénéficiaire × délai × nature du nouveau bénéficiaire.",
            then="Signal BENEFICIARY_SWITCH (Niveau 2) — justification requise, CoC ouvert.",
            params=[_p("delai_chgt_benef", "Fenêtre de surveillance post-souscription (mois)", 24)],
            tp=[_gt("CLI-00034", "Bénéficiaire basculé vers une fondation panaméenne contrôlée par un tiers — transfert de valeur déguisé, TP.")],
            fp=[_gt("CLI-00053", "Changement vers les enfants suite à un divorce (jugement au dossier) — événement de vie documenté, FP.", "événement de vie documenté (divorce, jugement)")],
        ),
        dict(
            id="IP-06", ruleRef="R361", niveau=2, kind="detection", signal="VAULT_CASH_PATTERN",
            titre="Coffres — corrélation cash",
            desc="Accès au coffre-fort corrélés temporellement à des dépôts ou retraits d'espèces.",
            given="6 accès au coffre en 2 mois, chacun suivi sous 24h d'un dépôt espèces de 15-19k.",
            when="Corrélation temporelle accès coffre × mouvements cash / fenêtre.",
            then="Signal VAULT_CASH_PATTERN (Niveau 2) — entretien client et corroboration d'origine.",
            params=[_p("fenetre_correlation", "Corrélation accès↔cash (heures)", 48),
                    _p("nb_correlations_seuil", "Corrélations / 90j", 3)],
            tp=[_gt("CLI-00072", "6 séquences coffre→dépôt sous 24h totalisant 100k — le coffre alimente les dépôts, TP.")],
            fp=[_gt("CLI-00063", "Numismate déclaré accédant au coffre avant chaque vente aux enchères documentée (bordereaux fournis) — activité déclarée, FP.", "activité déclarée (numismate, bordereaux de vente)")],
        ),
        dict(
            id="IP-07", ruleRef="R362", niveau=2, kind="detection", signal="PHYSICAL_METALS",
            titre="Métaux précieux physiques",
            desc="Achats/ventes/livraisons de métaux physiques hors profil déclaré (OBA négoce OR).",
            given="Achat de 12 kg d'or physique avec livraison hors banque, client sans profil métaux.",
            when="Volume métaux / profil déclaré + mode de livraison (garde vs sortie physique).",
            then="Signal PHYSICAL_METALS (Niveau 2) — sortie physique documentée, destination tracée.",
            params=[_p("seuil_metaux", "Équivalent CHF / 90j", 100000)],
            tp=[_gt("CLI-00080", "Achats répétés d'or livré à un tiers non documenté à l'étranger — conversion de valeur portable, TP.")],
            fp=[_gt("CLI-00164", "Allocation or de 5% du portefeuille en garde bancaire, conforme au mandat de gestion — investissement standard, FP.", "investissement standard (allocation or en garde, mandat)")],
        ),
    ]),
    (54, "Crypto / VASP", "R363–R368", "CR", [
        dict(
            id="CR-01", ruleRef="R363", niveau=1, kind="detection", signal="TRAVEL_RULE_GAP",
            titre="Travel rule DLT",
            desc="Transferts DLT sans informations complètes d'ordonnateur/bénéficiaire (comm. FINMA 02/2019, GAFI R.16).",
            given="Un transfert sortant de 0.8 BTC vise un VASP qui ne transmet pas les informations travel rule.",
            when="Contrôle de complétude des données travel rule avant exécution du transfert.",
            then="TRANSFERT BLOQUÉ (Niveau 1) — jusqu'à réception des informations ou décision humaine documentée.",
            params=[_p("vasp_conformes", "Registre des VASP conformes travel rule", "tenant")],
            tp=[_gt("CLI-00022", "Sortie vers un exchange non coopératif refusant l'échange travel rule — blocage maintenu, relation revue.")],
            fp=[_gt("CLI-00068", "Message travel rule retardé par une panne du protocole d'échange du VASP partenaire (reçu à H+6) — libéré, FP.", "panne technique du protocole (message reçu à H+6)")],
        ),
        dict(
            id="CR-02", ruleRef="R364", niveau=1, kind="detection", signal="MIXER_EXPOSURE",
            titre="Exposition mixer / tumbler",
            desc="Fonds entrants dont l'analyse on-chain révèle une exposition directe ou à 1 hop à un mixer.",
            given="Un dépôt de 2.1 BTC provient à 64% d'un mixer connu (analyse de provenance).",
            when="Score d'exposition mixer du fournisseur d'analytique on-chain >= seuil (paramètre tenant, intégration Chainalysis/Elliptic).",
            then="Signal MIXER_EXPOSURE (Niveau 1) — fonds gelés en attente d'explication, EDD.",
            params=[_p("seuil_exposition_mixer", "Exposition directe max (%)", 10),
                    _p("hops_analyses", "Profondeur d'analyse (hops)", 2)],
            tp=[_gt("CLI-00022", "64% de provenance mixer sur un dépôt de 2.1 BTC, client incapable d'expliquer la chaîne — fonds refusés, TP.")],
            fp=[_gt("CLI-00068", "Exposition indirecte de 3% à 2 hops via un exchange majeur (pollution de cluster) — sous matérialité, FP.", "sous matérialité (3% indirect via exchange majeur)")],
        ),
        dict(
            id="CR-03", ruleRef="R365", niveau=1, kind="detection", signal="ONCHAIN_SANCTION",
            titre="Adresse sanctionnée on-chain",
            desc="Contrepartie on-chain figurant dans les adresses crypto de la liste SDN OFAC.",
            given="Une adresse de destination correspond à une adresse SDN (entité de ransomware listée).",
            when="Screening des adresses contre les listes crypto SDN/SECO à l'initiation.",
            then="TRANSFERT BLOQUÉ (Niveau 1) — gel, dossier sanctions, MROS préparé.",
            params=[_p("listes_adresses", "Listes d'adresses actives", "OFAC,SECO")],
            tp=[_gt("CLI-00022", "Destination = adresse SDN d'un groupe ransomware — blocage, déclaration effectuée.")],
            fp=[_gt("CLI-00068", "Adresse retirée de la liste SDN au dernier délisting, cache local obsolète — synchronisation corrigée, FP.", "cache de liste obsolète (adresse délistée)")],
        ),
        dict(
            id="CR-04", ruleRef="R366", niveau=1, kind="detection", signal="ILLICIT_CLUSTER",
            titre="Cluster darknet / ransomware",
            desc="Exposition de provenance à des clusters darknet markets ou ransomware (hors listes formelles).",
            given="Provenance à 30% d'un cluster étiqueté darknet market par l'analytique on-chain.",
            when="Score de provenance par catégorie de cluster >= seuil.",
            then="Signal ILLICIT_CLUSTER (Niveau 1) — fonds en quarantaine, investigation.",
            params=[_p("seuil_cluster_illicite", "Provenance illicite max (%)", 5)],
            tp=[_gt("CLI-00022", "30% de provenance darknet sur un dépôt, historique d'adresses cohérent avec du peel chaining — TP.")],
            fp=[_gt("CLI-00068", "Étiquetage erroné d'un cluster par le fournisseur (corrigé dans sa release suivante) — FP documenté fournisseur.", "étiquetage fournisseur erroné (corrigé en release suivante)")],
        ),
        dict(
            id="CR-05", ruleRef="R367", niveau=1, kind="detection", signal="UNHOSTED_NOPROOF",
            titre="Wallet auto-hébergé sans preuve",
            desc="Transferts vers/depuis un wallet auto-hébergé sans preuve de contrôle (satoshi test / signature de message).",
            given="Le client demande une sortie de 50k CHF en ETH vers un wallet non custodial jamais vérifié.",
            when="Contrôle d'existence d'une preuve de contrôle valide pour l'adresse (registre des adresses vérifiées).",
            then="SORTIE BLOQUÉE (Niveau 1) — jusqu'à preuve de contrôle (signature) enregistrée.",
            params=[_p("methodes_preuve", "Méthodes acceptées", "signature,satoshi_test"),
                    _p("validite_preuve", "Validité de la preuve (mois)", 12)],
            tp=[_gt("CLI-00022", "Adresse prétendument personnelle appartenant en réalité à un tiers (échec du test de signature) — TP.")],
            fp=[_gt("CLI-00068", "Preuve expirée de 2 semaines pour une adresse déjà vérifiée 3× — re-signée le jour même, FP.", "preuve expirée récemment (adresse déjà vérifiée 3×)")],
        ),
        dict(
            id="CR-06", ruleRef="R368", niveau=2, kind="detection", signal="RAMP_VELOCITY",
            titre="On/off-ramp incohérent au profil",
            desc="Fréquence et volumes de conversion fiat↔crypto incohérents avec le profil d'investisseur déclaré.",
            given="Un client « investisseur long terme » convertit fiat→crypto→fiat 14 fois en un mois.",
            when="Compteur de cycles on/off-ramp / 30j vs profil déclaré (au-delà du simple seuil CHF de l'ancienne règle AML-11).",
            then="Signal RAMP_VELOCITY (Niveau 2) — revue du profil transactionnel crypto.",
            params=[_p("cycles_ramp_seuil", "Cycles / 30j", 6)],
            tp=[_gt("CLI-00022", "14 cycles/mois avec marge négative systématique — le coût de conversion est le prix du layering, TP.")],
            fp=[_gt("CLI-00068", "Trader actif déclaré avec profil « trading fréquent » validé à l'onboarding — comportement conforme, FP.", "profil « trading fréquent » validé à l'onboarding")],
        ),
    ]),
    (55, "CFT", "R369–R373", "FT", [
        dict(
            id="FT-01", ruleRef="R369", niveau=2, kind="detection", signal="CFT_MICRO_PATTERN",
            titre="Micro-transactions vers corridors sensibles",
            desc="Petits montants à haute fréquence vers des corridors géographiques sensibles (le CFT ne ressemble pas au blanchiment : montants faibles).",
            given="23 transferts de CHF 150-400 en 60 jours vers 3 pays limitrophes d'une zone de conflit.",
            when="Fréquence × faible montant unitaire × corridor sensible (liste tenant distincte des HRJ blanchiment).",
            then="Signal CFT_MICRO_PATTERN (Niveau 2) — analyse dédiée CFT, jamais agrégé avec les seuils ML classiques.",
            params=[_p("corridors_cft", "Liste corridors CFT", "tenant"),
                    _p("freq_micro_seuil", "Transferts / 60j", 10),
                    _p("montant_micro_max", "Montant unitaire max (CHF)", 500)],
            tp=[_gt("CLI-00084", "23 micro-transferts vers des collecteurs relais identifiés par la suite dans une enquête — TP.")],
            fp=[_gt("CLI-00035", "Soutien familial mensuel régulier vers le pays d'origine, bénéficiaire unique documenté (famille au KYC) — remittance légitime, FP.", "remittance légitime (soutien familial, bénéficiaire unique au KYC)")],
        ),
        dict(
            id="FT-02", ruleRef="R370", niveau=2, kind="detection", signal="NPO_RISK",
            titre="Collectes / ONG à risque",
            desc="Dons et collectes atypiques vers des organisations à but non lucratif à risque (GAFI R.8), crowdfunding non tracé.",
            given="Des dons partent vers une association récemment créée, sans agrément, active dans une zone à risque.",
            when="Croisement bénéficiaire ONG × registre des NPO à risque × ancienneté/agrément.",
            then="Signal NPO_RISK (Niveau 2) — vérification de l'organisation et de la chaîne de distribution des fonds.",
            params=[_p("registre_npo", "Référentiel NPO surveillées", "tenant")],
            tp=[_gt("CLI-00084", "Dons répétés vers une association-écran dissoute 8 mois plus tard, dirigeants condamnés — TP.")],
            fp=[_gt("CLI-00110", "Dons vers une ONG certifiée ZEWO opérant en zone à risque avec audit de distribution publié — organisation vérifiée, FP.", "organisation vérifiée (ONG certifiée ZEWO, audit publié)")],
        ),
        dict(
            id="FT-03", ruleRef="R371", niveau=2, kind="detection", signal="PREPAID_FUNDING",
            titre="Cartes prépayées multi-sources",
            desc="Rechargements de cartes prépayées depuis des sources multiples, retraits en zone frontalière ou à l'étranger.",
            given="Une carte est rechargée par 5 personnes différentes puis vidée en retraits ATM dans un pays frontalier d'une zone de conflit.",
            when="Nombre de sources de rechargement distinctes + géographie des retraits.",
            then="Signal PREPAID_FUNDING (Niveau 2) — gel du rechargement tiers après décision humaine.",
            params=[_p("sources_rechargement_seuil", "Sources distinctes / 90j", 3)],
            tp=[_gt("CLI-00084", "Carte financée par 5 tiers et vidée en cash à la frontière turco-syrienne — TP.")],
            fp=[_gt("CLI-00121", "Carte d'étudiant rechargée par ses deux parents et un grand-parent (liens familiaux au dossier), retraits sur le lieu d'études — FP.", "liens familiaux au dossier (carte étudiant)")],
        ),
        dict(
            id="FT-04", ruleRef="R372", niveau=2, kind="detection", signal="TRAVEL_FLOW_MISMATCH",
            titre="Cohérence voyages ↔ flux",
            desc="Croisement des Business Trips / voyages connus du client avec des flux vers zones de conflit (le module Trip existe côté RM ; le croisement CFT n'existe pas).",
            given="Un client retire du cash inhabituel juste avant un voyage déclaré vers un pays frontalier d'une zone de conflit.",
            when="Corrélation temporelle voyage déclaré/détecté × retraits cash atypiques × destination sensible.",
            then="Signal TRAVEL_FLOW_MISMATCH (Niveau 2) — entretien de clarification, trace CFT dédiée.",
            params=[_p("fenetre_voyage", "Fenêtre avant/après voyage (jours)", 14)],
            tp=[_gt("CLI-00084", "Retraits de 18k en 10 jours avant un déplacement vers une zone frontalière, sans explication — TP.")],
            fp=[_gt("CLI-00007", "Retraits avant un pèlerinage documenté avec agence de voyage agréée et itinéraire fourni — motif religieux légitime, FP.", "motif documenté (pèlerinage, agence agréée, itinéraire)")],
        ),
        dict(
            id="FT-05", ruleRef="R373", niveau=1, kind="detection", signal="CFT_LIST_HIT",
            titre="Listes terroristes dédiées",
            desc="Screening distinct contre les ordonnances/listes terroristes (séparé des sanctions économiques : gouvernance, escalade et déclaration diffèrent).",
            given="Une contrepartie matche une liste d'une ordonnance fédérale anti-terrorisme (hors listes SECO économiques).",
            when="Canal de screening dédié listes CFT, avec circuit d'escalade propre.",
            then="TRANSACTION BLOQUÉE (Niveau 1) — gel immédiat, MROS, escalade direction, décision humaine tracée.",
            params=[_p("listes_cft", "Listes CFT actives", "tenant")],
            tp=[_gt("CLI-00084", "Match exact (nom + date de naissance) sur une liste d'ordonnance fédérale — gel et déclaration.")],
            fp=[_gt("CLI-00099", "Homonymie sur un nom très courant, date de naissance divergente de 30 ans — levé après vérification, FP.", "homonymie (DDN divergente de 30 ans)")],
        ),
    ]),
    (56, "Gouvernance du dispositif", "R374–R377", "GV", [
        dict(
            id="GV-01", ruleRef="R374", niveau=None, kind="campagne", signal="tuning.btl.campagne",
            titre="Below-the-line sampling",
            desc="Campagne périodique d'échantillonnage sous les seuils : des transactions juste en-dessous des seuils actifs sont revues pour valider le calibrage.",
            given="Le trimestre écoulé compte 1'240 transactions entre 80% et 100% du seuil du scénario structuring.",
            when="La campagne BTL tire un échantillon stratifié (paramètre tenant) et le route en revue Compliance.",
            then="Événement tuning.btl.campagne — résultats consolidés : si des TP sont trouvés sous le seuil, proposition de baisse via l'Intelligence Studio (validation humaine, versionnée, réversible).",
            params=[_p("taux_echantillon_btl", "Taux d'échantillonnage (%)", 2),
                    _p("bande_btl", "Bande sous le seuil (%)", "80-100"),
                    _p("frequence_btl", "Fréquence de campagne (jours)", 90)],
            tp=[_gt("—", "Campagne T2 : 2 cas suspects trouvés à 85% du seuil structuring → seuil abaissé de 20k à 18k (version v1.3, simulée puis déployée).")],
            fp=[_gt("—", "Campagne T3 : 0 TP sous seuil sur 25 dossiers échantillonnés → calibrage confirmé, rapport archivé.", "calibrage confirmé (0 TP sous seuil sur l'échantillon)")],
        ),
        dict(
            id="GV-02", ruleRef="R375", niveau=None, kind="campagne", signal="tuning.backtest.run",
            titre="Backtesting par version",
            desc="Backtesting formel de chaque version de scénario : TP/FP historisés par version, comparaison avant/après tout changement de seuil.",
            given="Le seuil du scénario velocity est passé de 4× à 5× il y a 90 jours (v1.2).",
            when="Le backtest rejoue la fenêtre sur les deux versions et compare TP, FP, alertes manquées.",
            then="Rapport de backtest versionné attaché à la version du scénario — rollback proposé si dégradation du rappel (décision humaine).",
            params=[_p("fenetre_backtest", "Fenêtre de rejeu (jours)", 90),
                    _p("seuil_degradation", "Perte de rappel max tolérée (TP manqués)", 0)],
            tp=[_gt("—", "v1.2 du velocity : -40% de FP, 0 TP manqué sur 90j — changement validé et documenté.")],
            fp=[_gt("—", "v2.0 du round-amounts aurait manqué 1 TP historique — rollback v1.4 exécuté, écart consigné.", "dégradation du rappel détectée (rollback v1.4)")],
        ),
        dict(
            id="GV-03", ruleRef="R376", niveau=1, kind="ops", signal="DQ_DEGRADED",
            titre="Data quality pré-conditions",
            desc="Contrôles de qualité de données amont comme pré-condition des scénarios : un scénario aveugle (champs SWIFT incomplets, devises manquantes) est un faux négatif silencieux.",
            given="8% des MT103 du jour arrivent sans champ ordonnateur exploitable.",
            when="Le contrôle DQ mesure la complétude des champs critiques par flux ; sous le seuil, les scénarios dépendants sont marqués « dégradés ».",
            then="Signal DQ_DEGRADED (Niveau 1, ops) — visible au dashboard Compliance, jamais silencieux (esprit dead-letters R39).",
            params=[_p("completude_min", "Complétude minimale des champs critiques (%)", 98)],
            tp=[_gt("—", "Champ 50 vide sur 8% des messages d'un correspondant pendant 3 jours : le wire-stripping était indétectable — corrigé, période re-screenée.")],
            fp=[_gt("—", "Chute de complétude due à un nouveau format ISO 20022 mal mappé (données présentes, parsing KO) — mapping corrigé, FP.", "parsing KO mais données présentes (mapping ISO 20022 corrigé)")],
        ),
        dict(
            id="GV-04", ruleRef="R377", niveau=None, kind="campagne", signal="tuning.calibrage.annuel",
            titre="Revue annuelle de calibrage",
            desc="Revue annuelle documentée du dispositif : couverture typologique, performance par scénario, décisions de calibrage — annexée au rapport LBA Direction (art. 25a OBA-FINMA).",
            given="L'exercice se clôt ; chaque scénario a un historique TP/FP et des versions.",
            when="La revue consolide couverture (matrice typologies GAFI × scénarios), performance et écarts.",
            then="Rapport de calibrage annuel généré, visé four-eyes, archivé GED — section dédiée du rapport Direction.",
            params=[_p("matrice_couverture", "Référentiel de typologies de la matrice", "GAFI+OBA-FINMA")],
            tp=[_gt("—", "Revue 2026 : 3 angles morts identifiés (TBML, CBK, prolifération) → wave 2 planifiée et arbitrée en comité.")],
            # La spec laisse ce FP vide (« — — — ») : placeholder explicite, jamais comblé (never invent).
            fp=[dict(clientId="—", narrative="", placeholder=True,
                     note="FP déclaré par la spec (1 TP · 1 FP) mais contenu laissé vide « — — — » ; en attente PO.")],
        ),
    ]),
]


# ── LCG déterministe (mêmes payloads synthétiques à chaque run) ───────────────────────────────
class _Rng:
    def __init__(self, seed):
        self.s = seed & 0x7FFFFFFF or 1

    def next(self):
        # xorshift32, borné positif — même esprit que services/screening/generate.mjs
        self.s ^= (self.s << 13) & 0x7FFFFFFF
        self.s ^= (self.s >> 17)
        self.s ^= (self.s << 5) & 0x7FFFFFFF
        return abs(self.s) / 0x7FFFFFFF

    def intv(self, a, b):
        return a + int(self.next() * (b - a + 1))


def _payload(case_id, rule, label):
    """Transaction synthétique déterministe sous-jacente au cas GT (stub que le seed backend
    étendra). Graine = SEED + hash stable du caseId → reproductible, aucune donnée réelle."""
    h = 0
    for ch in case_id:
        h = (h * 131 + ord(ch)) & 0x7FFFFFFF
    rng = _Rng(SEED ^ h)
    return {
        "seed": SEED ^ h,
        "montantChf": rng.intv(1, 200) * 1000,
        "valueDate": "2026-%02d-%02d" % (rng.intv(1, 12), rng.intv(1, 28)),
        "canal": {"detection": "FLOW", "ops": "PERPETUAL", "campagne": "CAMPAIGN"}[rule["kind"]],
        "contrepartieRef": "CP-%05d" % rng.intv(1, 99999),
        "declencheur": rule["signal"],
        "attendu": label,  # TP | FP — les deux DOIVENT déclencher (corpus de recall)
    }


import re

# ── Wave 2 (R378–R403, blocs 57–61) : DÉRIVÉE du canon PO tools/gen_aml_gap.py (jamais transcrite) ──
_WAVE2_BLOCNUM = {"TBML": 57, "Correspondent Banking": 58, "Prolifération": 59,
                  "Immobilier & Art": 60, "Analytique 2G": 61}


def _parse_default(d):
    s = str(d)
    try:
        return int(s)
    except ValueError:
        pass
    try:
        return float(s)
    except ValueError:
        pass
    if s.lower() in ("true", "false"):
        return s.lower() == "true"
    return s


def _po_signal(then):
    m = re.search(r"Signal ([A-Z_]+)", then or "")
    return m.group(1) if m else ""


def _load_po_rules():
    """Charge les 64 RULES du canon PO (tools/gen_aml_gap.py) SANS déclencher son émission :
    on n'exécute que la partie AVANT le marqueur d'émission (construction des règles + wave2)."""
    po_gen = os.path.normpath(os.path.join(HERE, "..", "gen_aml_gap.py"))
    src = open(po_gen, encoding="utf-8").read().split("# ════════ ÉMISSION")[0]
    ns = {"__file__": po_gen}  # le canon PO résout ses chemins via __file__
    exec(compile(src, po_gen, "exec"), ns)
    return ns["RULES"]


def _wave2_rules_gt():
    """Mappe la tranche Wave 2 du canon PO (R378–R403) vers la forme de l'émetteur (référentiel +
    GT enrichi de payloads déterministes). Le canon fait foi ; aucune donnée transcrite ici."""
    po = [r for r in _load_po_rules() if r["rule"] > "R377"]
    byfam = {}
    for r in po:
        byfam.setdefault(r["fam"], []).append(r["rule"])
    plage = {fam: refs[0] + "–" + refs[-1] for fam, refs in byfam.items()}
    rules, gt = [], []
    for r in po:
        fam2 = r["id"][:2]
        rule = {
            "id": r["id"], "ruleRef": r["rule"], "bloc": _WAVE2_BLOCNUM[r["fam"]],
            "blocTitre": r["fam"], "plage": plage[r["fam"]], "famille": fam2, "titre": r["nom"],
            "desc": r["desc"], "niveau": r["niveau"], "kind": "detection", "blocking": bool(r["block"]),
            "signal": _po_signal(r["then"]),
            "gherkin": {"given": r["given"], "when": r["when"], "then": r["then"]},
            "params": [{"key": p[0], "label": p[1], "default": _parse_default(p[2])} for p in r["params"]],
            "gtCount": {"tp": sum(1 for c in r["cases"] if c["label"] == "TP"),
                        "fp": sum(1 for c in r["cases"] if c["label"] == "FP")},
        }
        rules.append(rule)
        counters = {"TP": 0, "FP": 0}
        for c in r["cases"]:
            counters[c["label"]] += 1
            case_id = "GT-%s-%s-%d" % (r["id"], c["label"], counters[c["label"]])
            gt.append({
                "caseId": case_id, "scenarioId": r["id"], "ruleRef": r["rule"], "famille": fam2,
                "label": c["label"], "clientId": c["client"], "narrative": c["txt"],
                "payload": _payload(case_id, rule, c["label"]),
            })
    return rules, gt


def build():
    rules = []
    gt = []
    for bloc_no, bloc_titre, plage, fam, regles in BLOCS:
        for r in regles:
            rules.append({
                "id": r["id"],
                "ruleRef": r["ruleRef"],
                "bloc": bloc_no,
                "blocTitre": bloc_titre,
                "plage": plage,
                "famille": fam,
                "titre": r["titre"],
                "desc": r["desc"],
                "niveau": r["niveau"],
                "kind": r["kind"],
                "blocking": r["ruleRef"] in BLOCKING,
                "signal": r["signal"],
                "gherkin": {"given": r["given"], "when": r["when"], "then": r["then"]},
                "params": r["params"],
                "gtCount": {"tp": len(r["tp"]), "fp": len(r["fp"])},
            })
            for label, rows in (("TP", r["tp"]), ("FP", r["fp"])):
                for i, row in enumerate(rows, start=1):
                    case_id = "GT-%s-%s-%d" % (r["id"], label, i)
                    case = {
                        "caseId": case_id,
                        "scenarioId": r["id"],
                        "ruleRef": r["ruleRef"],
                        "famille": fam,
                        "label": label,
                        "clientId": row["clientId"],
                        "narrative": row["narrative"],
                    }
                    if row.get("ecartement"):
                        case["ecartement"] = row["ecartement"]
                    if row.get("placeholder"):
                        case["placeholder"] = True
                        case["note"] = row.get("note", "")
                    else:
                        case["payload"] = _payload(case_id, r, label)
                    gt.append(case)
    # ── Wave 2 (R378–R403) appendue depuis le canon PO — Wave 1 (BLOCS) inchangée ──
    w2_rules, w2_gt = _wave2_rules_gt()
    rules += w2_rules
    gt += w2_gt
    return rules, gt


API_AML_DIR = os.path.normpath(os.path.join(HERE, "..", "..", "apps", "api", "src", "modules", "aml"))
API_PARAM_DIR = os.path.normpath(os.path.join(HERE, "..", "..", "apps", "api", "src", "modules", "parametres"))
WEB_AML_DIR = os.path.normpath(os.path.join(HERE, "..", "..", "apps", "web", "src", "features", "aml"))

_TS_HEADER = (
    "// GÉNÉRÉ par tools/aml-gap/gen_aml_gap.py — NE PAS ÉDITER À LA MAIN.\n"
    "// Source de vérité de la vague AML Gap Wave 1 (R340–R377, blocs 50–56). Toute évolution\n"
    "// d'une règle passe par le générateur ; le test de fraîcheur (test_gen_aml_gap.py) rougit\n"
    "// si ce fichier dérive. Consommé par aml-gap.service.ts et aml-gap.wiring.spec.ts.\n"
)


def _emit_ts(rules, gt):
    """Émet le référentiel + le corpus GT en TS dans apps/api (le générateur reste la source de
    vérité ; le backend et son spec consomment ces artefacts, jamais des JSON hors apps/api)."""
    ref_types = (
        "export interface AmlGapParam { key: string; label: string; default: string | number | boolean; }\n"
        "export interface AmlGapRule {\n"
        "  id: string; ruleRef: string; bloc: number; blocTitre: string; plage: string; famille: string;\n"
        "  titre: string; desc: string; niveau: number | null; kind: 'detection' | 'ops' | 'campagne';\n"
        "  blocking: boolean; signal: string;\n"
        "  gherkin: { given: string; when: string; then: string };\n"
        "  params: AmlGapParam[]; gtCount: { tp: number; fp: number };\n"
        "}\n"
    )
    gt_types = (
        "export interface AmlGapGtCase {\n"
        "  caseId: string; scenarioId: string; ruleRef: string; famille: string;\n"
        "  label: 'TP' | 'FP'; clientId: string; narrative: string;\n"
        "  ecartement?: string; placeholder?: boolean; note?: string;\n"
        "  payload?: Record<string, unknown>;\n"
        "}\n"
    )
    ref_json = json.dumps(rules, ensure_ascii=False, indent=2)
    gt_json = json.dumps(gt, ensure_ascii=False, indent=2)
    with open(os.path.join(API_AML_DIR, "aml-gap.referentiel.gen.ts"), "w", encoding="utf-8") as f:
        f.write(_TS_HEADER + "\n" + ref_types + "\nexport const AML_GAP_REFERENTIEL: AmlGapRule[] = " + ref_json + ";\n")
    with open(os.path.join(API_AML_DIR, "aml-gap.gt.gen.ts"), "w", encoding="utf-8") as f:
        f.write(_TS_HEADER + "\n" + gt_types + "\nexport const AML_GAP_GT: AmlGapGtCase[] = " + gt_json + ";\n")
    # Seed front (web) : même source, utilisé en repli par useApiOrSeed quand le backend est absent.
    web = (
        _TS_HEADER + "\n"
        "export interface AmlGapScenarioSeed {\n"
        "  code: string; ruleRef: string; bloc: number; blocTitre: string; famille: string;\n"
        "  titre: string; desc: string; niveau: number | null; kind: string; blocking: boolean;\n"
        "  signal: string; params: { key: string; label: string; default: string | number | boolean }[];\n"
        "  gherkin: { given: string; when: string; then: string };\n"
        "}\n"
        "export interface AmlGapGtSeed {\n"
        "  caseId: string; scenarioId: string; ruleRef: string; famille: string; label: 'TP' | 'FP';\n"
        "  clientId: string; narrative: string; ecartement?: string; placeholder?: boolean;\n"
        "}\n"
    )
    scen_seed = [{
        "code": r["id"], "ruleRef": r["ruleRef"], "bloc": r["bloc"], "blocTitre": r["blocTitre"],
        "famille": r["famille"], "titre": r["titre"], "desc": r["desc"], "niveau": r["niveau"],
        "kind": r["kind"], "blocking": r["blocking"], "signal": r["signal"], "params": r["params"],
        "gherkin": r["gherkin"],
    } for r in rules]
    gt_seed = [{k: c[k] for k in ("caseId", "scenarioId", "ruleRef", "famille", "label", "clientId",
                                  "narrative") if k in c}
               | ({"ecartement": c["ecartement"]} if c.get("ecartement") else {})
               | ({"placeholder": True} if c.get("placeholder") else {})
               for c in gt]
    web += ("\nexport const AML_GAP_SCENARIOS: AmlGapScenarioSeed[] = "
            + json.dumps(scen_seed, ensure_ascii=False, indent=2) + ";\n")
    web += ("\nexport const AML_GAP_GT_SEED: AmlGapGtSeed[] = "
            + json.dumps(gt_seed, ensure_ascii=False, indent=2) + ";\n")
    with open(os.path.join(WEB_AML_DIR, "aml-gap.seed.gen.ts"), "w", encoding="utf-8") as f:
        f.write(web)


def _rq_entrees(rules):
    """Registre R-Q (action 5 du journal 2026-08-04) : chaque paramètre tenant des 64 règles
    devient une entrée du questionnaire exécutable (parametres.service.ts). Rattachée à sa règle
    (R125), typée pour le contrôle d'écriture (bonType), datée/motivée à l'écriture (R7/R29/R126).
    Les défauts `tenant` n'ont PAS de valeur chiffrée silencieuse (requis=true, exemple=[]) : le
    tenant DOIT répondre au questionnaire. Dérivé des params du référentiel — jamais saisi à la main."""
    seen = set()
    entrees = []
    for r in rules:
        for p in r["params"]:
            key = p["key"]
            if key in seen:
                continue  # une clé = une question ; première occurrence fait foi (déterministe)
            seen.add(key)
            d = p["default"]
            exemple = None
            if isinstance(d, bool):                 # AVANT int (bool est un int en Python)
                typ, defaut, requis = "bool", d, False
            elif isinstance(d, int):
                typ, defaut, requis = "int", d, False
            elif isinstance(d, float):              # décimal non représentable en int → string
                typ, defaut, requis = "string", repr(d), False
            elif d == "tenant":                     # référentiel/liste tenant : pas de défaut silencieux
                typ, defaut, requis, exemple = "json", None, True, []
            else:                                   # listes/plages énumérées ("OFAC,SECO", "80-100"…)
                typ, defaut, requis = "string", d, False
            e = {
                "cle": key, "type": typ, "defaut": defaut, "regle": r["ruleRef"], "requis": requis,
                "description": "%s — %s / %s (paramètre tenant AML gap, registre R-Q)."
                               % (p["label"], r["id"], r["blocTitre"]),
            }
            if exemple is not None:
                e["exemple"] = exemple
            entrees.append(e)
    return entrees


ROOT_AML_DIR = os.path.normpath(os.path.join(HERE, "..", "..", "src", "aml"))


def _emit_meta(rules):
    """Émet les métadonnées de scénario consommées par le moteur (src/aml/engine.ts) et les
    fixtures (backend-tests/aml-gap). Data pure — niveau/blocking/signal/params/then par scénario ;
    le JUGEMENT de détection reste dans src/aml/detectors.ts (code, pas data). `deferred` = bloc 61
    (Analytique 2G) : le moteur Nest REFUSE ces scénarios — détecteurs statistiques exécutés dans le
    service CPSI Python, jamais réécrits en Nest (décision 4 du journal 2026-08-04)."""
    os.makedirs(ROOT_AML_DIR, exist_ok=True)
    meta = {}
    for r in rules:
        meta[r["id"]] = {
            "scenarioId": r["id"], "ruleRef": r["ruleRef"], "bloc": r["bloc"],
            "niveau": r["niveau"] if r["niveau"] is not None else 0,  # campagne/ops → 0
            "blocking": r["blocking"], "signal": r["signal"], "deferred": r["bloc"] == 61,
            "then": r["gherkin"]["then"],
            "params": {p["key"]: p["default"] for p in r["params"]},
        }
    ts = (
        "// GÉNÉRÉ par tools/aml-gap/gen_aml_gap.py — NE PAS ÉDITER À LA MAIN.\n"
        "// Métadonnées des 64 scénarios AML gap (R340–R403) : niveau/blocking/signal/params/then.\n"
        "// Consommé par src/aml/engine.ts (moteur R44) + src/aml/detectors.ts. `deferred` = bloc 61\n"
        "// (Analytique 2G, R399–R403) : le moteur Nest refuse — détection dans le service CPSI Python.\n\n"
        "export interface AmlGapMeta {\n"
        "  scenarioId: string; ruleRef: string; bloc: number; niveau: number; blocking: boolean;\n"
        "  signal: string; deferred: boolean; then: string; params: Record<string, string | number | boolean>;\n"
        "}\n\n"
        "export const AML_GAP_META: Record<string, AmlGapMeta> = "
        + json.dumps(meta, ensure_ascii=False, indent=2) + ";\n"
    )
    with open(os.path.join(ROOT_AML_DIR, "aml-gap.meta.gen.ts"), "w", encoding="utf-8") as f:
        f.write(ts)
    return meta


def _emit_rq(rules):
    """Émet le fragment R-Q consommé par parametres.service.ts (spread dans REGISTRE_RQ)."""
    entrees = _rq_entrees(rules)
    ts = (
        "// GÉNÉRÉ par tools/aml-gap/gen_aml_gap.py — NE PAS ÉDITER À LA MAIN.\n"
        "// Registre R-Q des paramètres tenant AML gap (waves 1+2, R340–R403). Étalé dans\n"
        "// REGISTRE_RQ (parametres.service.ts) : le questionnaire d'onboarding se génère de ces\n"
        "// entrées. Toute évolution passe par le générateur (test_gen_aml_gap.py rougit sinon).\n\n"
        "export interface AmlGapRqEntree {\n"
        "  cle: string; type: 'int' | 'bool' | 'json' | 'string'; defaut: string | number | boolean | null;\n"
        "  regle: string; requis: boolean; exemple?: unknown; description: string;\n"
        "}\n\n"
        "export const AML_GAP_RQ: AmlGapRqEntree[] = "
        + json.dumps(entrees, ensure_ascii=False, indent=2) + ";\n"
    )
    with open(os.path.join(API_PARAM_DIR, "aml-gap.rq.gen.ts"), "w", encoding="utf-8") as f:
        f.write(ts)
    return entrees


def main():
    rules, gt = build()
    tp = sum(1 for c in gt if c["label"] == "TP")
    fp = sum(1 for c in gt if c["label"] == "FP")
    placeholders = sum(1 for c in gt if c.get("placeholder"))
    meta = {
        "generator": "tools/aml-gap/gen_aml_gap.py",
        "spec": "SPEC-AMLGAP-WAVE1.md (ratifiée PO 04.08.2026)",
        "mapping": "spec/mapping-session-repo.md §4 (step-0)",
        "seed": SEED,
        "ruleRange": rules[0]["ruleRef"] + "–" + rules[-1]["ruleRef"],
        "blocs": sorted({r["bloc"] for r in rules}),
        "familles": sorted({r["famille"] for r in rules}),
        "counts": {"rules": len(rules), "gt": len(gt), "tp": tp, "fp": fp,
                   "placeholders": placeholders, "blocking": sum(1 for r in rules if r["blocking"])},
        "note": "Artefacts GÉNÉRÉS — ne jamais éditer à la main ; toute évolution passe par le générateur.",
    }
    with open(os.path.join(HERE, "aml-gap-rules.json"), "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "rules": rules}, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(os.path.join(HERE, "aml-gap-dataset-gt.json"), "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "cases": gt}, f, ensure_ascii=False, indent=2)
        f.write("\n")
    _emit_ts(rules, gt)
    rq = _emit_rq(rules)
    _emit_meta(rules)
    print("aml-gap généré : %d règles (%s, %d bloquantes) · %d cas GT (%d TP / %d FP, %d placeholder)"
          % (len(rules), meta["ruleRange"], meta["counts"]["blocking"], len(gt), tp, fp, placeholders))
    print("  + TS backend : apps/api/src/modules/aml/aml-gap.referentiel.gen.ts · aml-gap.gt.gen.ts")
    print("  + TS front   : apps/web/src/features/aml/aml-gap.seed.gen.ts")
    print("  + R-Q        : apps/api/src/modules/parametres/aml-gap.rq.gen.ts (%d paramètres tenant)"
          % len(rq))
    print("  + Moteur     : src/aml/aml-gap.meta.gen.ts (métadonnées scénarios, bloc 61 deferred CPSI)")


if __name__ == "__main__":
    main()
