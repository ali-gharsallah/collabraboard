// Détecteurs AML gap — blocs 50–60 (R340–R398). Le JUGEMENT de détection (code, pas data) :
// chaque scénario compare des faits à son paramètre tenant (registre R-Q), dans le SENS de son
// Gherkin. Le moteur (engine.ts) N'EXÉCUTE rien (R44) — il mesure et retourne un résultat explicable.
// Un cas GT TP ET un cas FP DÉCLENCHENT tous deux : le FP est une alerte légitime écartée en
// investigation, pas une non-alerte (sémantique du corpus, décision 5 du journal 2026-08-04).
//
// Bloc 61 (Analytique 2G, R399–R403) N'A PAS de détecteur ici : détecteurs statistiques exécutés
// dans le service CPSI Python, jamais réécrits en Nest (décision 4). Le moteur les refuse (deferred).

export interface Detection {
  raised: boolean;
  payload: Record<string, unknown>;
  explanation: string;
}
export interface Detector {
  /** Faits synthétiques déterministes qui déclenchent le scénario (consommés par les fixtures GT). */
  trigger: () => Record<string, unknown>;
  /** Mesure : faits × paramètres tenant → détection explicable (R44). */
  evaluate: (facts: Record<string, unknown>, p: Record<string, unknown>) => Detection;
}

const n = (v: unknown): number => Number(v);
const truthy = (v: unknown): boolean => v === true || v === "true";

// gte : la mesure franchit le seuil par le haut (comptes, ratios, montants, scores)
const gte = (metricKey: string, paramKey: string, unit: string, what: string): Detector["evaluate"] =>
  (f, p) => {
    const m = n(f[metricKey]), s = n(p[paramKey]);
    return { raised: m >= s, payload: { [metricKey]: m, seuil: s, paramKey },
      explanation: `${what} : ${m}${unit} ≥ seuil ${s}${unit} (${paramKey}).` };
  };
// lte : l'événement survient PLUS TÔT / EN-DEÇÀ du seuil (délais courts, âge faible, complétude basse)
const lte = (metricKey: string, paramKey: string, unit: string, what: string): Detector["evaluate"] =>
  (f, p) => {
    const m = n(f[metricKey]), s = n(p[paramKey]);
    return { raised: m <= s, payload: { [metricKey]: m, seuil: s, paramKey },
      explanation: `${what} : ${m}${unit} ≤ seuil ${s}${unit} (${paramKey}).` };
  };
// gt : strictement au-dessus (transbordements au-delà du toléré, dégradation > 0)
const gt = (metricKey: string, paramKey: string, unit: string, what: string): Detector["evaluate"] =>
  (f, p) => {
    const m = n(f[metricKey]), s = n(p[paramKey]);
    return { raised: m > s, payload: { [metricKey]: m, seuil: s, paramKey },
      explanation: `${what} : ${m}${unit} > toléré ${s}${unit} (${paramKey}).` };
  };
// hit : match contre un référentiel/liste tenant, ou condition binaire (preuve absente, gel légal…)
const hit = (flagKey: string, paramKey: string, what: string): Detector["evaluate"] =>
  (f, p) => ({ raised: truthy(f[flagKey]), payload: { [flagKey]: truthy(f[flagKey]), referentiel: paramKey },
    explanation: `${what} (référentiel ${paramKey}).` });

/** Détecteur numérique : faits déclencheurs = seuil défaut + marge (gte/gt) ou nettement en-deçà (lte). */
const num = (metricKey: string, paramKey: string, def: number, mode: "gte" | "lte" | "gt",
             unit: string, what: string): Detector => {
  const ev = mode === "gte" ? gte(metricKey, paramKey, unit, what)
    : mode === "lte" ? lte(metricKey, paramKey, unit, what)
    : gt(metricKey, paramKey, unit, what);
  const val = mode === "lte" ? Math.max(0, Math.round(def / 2))       // bien en-deçà
    : mode === "gt" ? def + Math.max(1, Math.round(def * 0.5)) + 1     // strictement au-dessus
    : def + Math.max(1, Math.round(def * 0.2));                        // au-dessus du seuil
  return { trigger: () => ({ [metricKey]: val }), evaluate: ev };
};
/** Détecteur binaire : match/condition présente (référentiel ou liste tenant). */
const flag = (flagKey: string, paramKey: string, what: string): Detector =>
  ({ trigger: () => ({ [flagKey]: true }), evaluate: hit(flagKey, paramKey, what) });

export const DETECTORS: Record<string, Detector> = {
  // ── Bloc 50 — Screening en flux (R340–R346) ──
  "SF-01": num("matchScore", "seuil_match_pep_flux", 78, "gte", "%", "Contrepartie PEP en flux (score de similarité)"),
  "SF-02": num("sourceRank", "rang_source_min", 2, "lte", "", "Adverse media : rang de fiabilité de la source"),
  "SF-03": flag("deltaScreening", "frequence_rescreen", "Re-screening périodique : nouveau hit au différentiel"),
  "SF-04": flag("bicHit", "liste_bic_interne", "Banque intermédiaire (BIC) matchée"),
  "SF-05": flag("geoMatch", "referentiel_geo_sanctions", "Adresse en zone sanctionnée"),
  "SF-06": flag("scriptHit", "scripts_actifs", "Hit multi-scripts (translittération normalisée)"),
  "SF-07": flag("imoHit", "extraction_imo", "Navire / IMO sanctionné"),
  // ── Bloc 51 — Indices OBA-FINMA (R347–R351) ──
  "QO-01": num("relances", "nb_relances_avant_signal", 2, "gte", "", "Refus d'information après relances"),
  "QO-02": num("tiersDistincts", "tiers_distincts_seuil", 6, "gte", "", "Compte de passage : tiers distincts"),
  "QO-03": flag("redFlag", "delai_reponse_client", "Opération sans justification économique (red flag conseiller)"),
  "QO-04": num("clientsParAdresse", "clients_par_adresse_seuil", 5, "gte", "", "Adresse partagée : clients distincts"),
  "QO-05": num("chgtsGouvernance", "chgts_gouvernance_seuil", 3, "gte", "", "Rotation des procurations / instructions"),
  // ── Bloc 52 — Vision groupe UBO (R352–R355) ──
  "GU-01": { trigger: () => ({ agregeChf: 72000, fenetreJours: 6 }),
    evaluate: (f, p) => { const m = n(f.agregeChf), s = n(p.seuil_agrege_ubo), w = n(f.fenetreJours), wm = n(p.fenetre_agregation_ubo);
      return { raised: m >= s && w <= wm, payload: { agregeChf: m, seuil: s, fenetreJours: w, fenetreMax: wm },
        explanation: `Structuring de groupe : ${m} CHF agrégés sur ${w}j ≥ seuil ${s} CHF (fenêtre ${wm}j).` }; } },
  "GU-02": num("cycleJours", "duree_cycle_max", 30, "lte", "j", "Flux circulaire intra-groupe (durée du cycle)"),
  "GU-03": num("ratioCash", "ratio_cash_groupe", 25, "gte", "%", "Cash consolidé du périmètre UBO"),
  "GU-04": num("agregeChf", "seuil_cross_produits", 75000, "gte", " CHF", "Seuil agrégé cross-produits"),
  // ── Bloc 53 — Instruments PB (R356–R362) ──
  "IP-01": num("delaiMois", "delai_anticipe_min", 12, "lte", " mois", "Lombard soldé par anticipation"),
  "IP-02": flag("backToBack", "perimetre_lien", "Back-to-back loan (dépôt lié nantit le prêt)"),
  "IP-03": num("ratioPrimePatrimoine", "ratio_prime_patrimoine", 60, "gte", "%", "Wrapper : prime hors profil patrimonial"),
  "IP-04": num("delaiMois", "delai_rachat_min", 24, "lte", " mois", "Wrapper : rachat précoce"),
  "IP-05": num("delaiMois", "delai_chgt_benef", 24, "lte", " mois", "Changement de bénéficiaire post-souscription"),
  "IP-06": num("correlations", "nb_correlations_seuil", 3, "gte", "", "Coffre : corrélations accès ↔ cash"),
  "IP-07": num("metauxChf", "seuil_metaux", 100000, "gte", " CHF", "Métaux précieux physiques hors profil"),
  // ── Bloc 54 — Crypto / VASP (R363–R368) ──
  "CR-01": flag("travelRuleGap", "vasp_conformes", "Travel rule DLT : informations incomplètes"),
  "CR-02": num("mixerExposure", "seuil_exposition_mixer", 10, "gte", "%", "Exposition mixer / tumbler"),
  "CR-03": flag("sdnMatch", "listes_adresses", "Adresse sanctionnée on-chain (SDN)"),
  "CR-04": num("illicitProvenance", "seuil_cluster_illicite", 5, "gte", "%", "Cluster darknet / ransomware"),
  "CR-05": flag("proofMissing", "methodes_preuve", "Wallet auto-hébergé sans preuve de contrôle"),
  "CR-06": num("rampCycles", "cycles_ramp_seuil", 6, "gte", "", "On/off-ramp incohérent au profil"),
  // ── Bloc 55 — CFT (R369–R373) ──
  "FT-01": num("microTransferts", "freq_micro_seuil", 10, "gte", "", "Micro-transactions vers corridors sensibles"),
  "FT-02": flag("npoRisk", "registre_npo", "Collecte / ONG à risque"),
  "FT-03": num("sourcesRechargement", "sources_rechargement_seuil", 3, "gte", "", "Cartes prépayées multi-sources"),
  "FT-04": num("joursVoyage", "fenetre_voyage", 14, "lte", "j", "Cohérence voyage ↔ flux (retrait pré-voyage)"),
  "FT-05": flag("cftHit", "listes_cft", "Liste terroriste dédiée matchée"),
  // ── Bloc 56 — Gouvernance du dispositif (R374–R377) : campagnes/ops, niveau 0 sauf GV-03 (N1) ──
  "GV-01": { trigger: () => ({ txSousSeuil: 1240 }),
    evaluate: (f) => ({ raised: n(f.txSousSeuil) > 0, payload: { txSousSeuil: n(f.txSousSeuil) },
      explanation: `Campagne below-the-line : ${n(f.txSousSeuil)} transactions sous seuil échantillonnées.` }) },
  "GV-02": { trigger: () => ({ versionChangee: true }),
    evaluate: (f) => ({ raised: truthy(f.versionChangee), payload: { versionChangee: truthy(f.versionChangee) },
      explanation: "Backtesting par version : rejeu de la fenêtre sur les deux versions du scénario." }) },
  "GV-03": num("completude", "completude_min", 98, "lte", "%", "Data quality : complétude des champs critiques"),
  "GV-04": { trigger: () => ({ revueClose: true }),
    evaluate: (f) => ({ raised: truthy(f.revueClose), payload: { revueClose: truthy(f.revueClose) },
      explanation: "Revue annuelle de calibrage : couverture typologique et performance consolidées." }) },
  // ── Bloc 57 — TBML (R378–R385) ──
  "TB-01": num("ecartPrix", "ecart_prix_seuil", 15, "gte", "%", "Sur/sous-facturation vs prix de référence"),
  "TB-02": flag("facturesDupliquees", "fenetre_dedup", "Multiple invoicing (même expédition, factures multiples)"),
  "TB-03": flag("prixOutlier", "percentile_bas", "Anomalie de prix unitaire (hors percentiles HS)"),
  "TB-04": flag("dualUseHit", "listes_controle", "Bien à double usage (liste de contrôle)"),
  "TB-05": flag("hrjTrade", "hrj_trade", "Back-to-back LC via juridiction trade à risque"),
  "TB-06": { trigger: () => ({ montantChf: 150000, trackingAbsent: true }),
    evaluate: (f, p) => { const m = n(f.montantChf), s = n(p.seuil_verif_tracking);
      return { raised: m >= s && truthy(f.trackingAbsent), payload: { montantChf: m, seuil: s, trackingAbsent: truthy(f.trackingAbsent) },
        explanation: `Phantom shipment : ${m} CHF ≥ seuil ${s} CHF sans preuve de transport (seuil_verif_tracking).` }; } },
  "TB-07": num("transbordements", "transbordements_max", 1, "gt", "", "Anomalie de route (transbordements)"),
  "TB-08": num("cycleJours", "duree_cycle_trade", 180, "lte", "j", "Trade carousel (cycle commercial)"),
  // ── Bloc 58 — Correspondent Banking (R386–R392) ──
  "CB-03": num("tauxIncomplet", "taux_incomplet_max", 2, "gte", "%", "Wire stripping (taux d'incomplétude)"),
  "CB-04": num("joursUturn", "fenetre_uturn", 30, "lte", "j", "U-turn (aller-retour de fonds)"),
  "CB-05": flag("ptaHit", "indicateurs_pta", "Payable-through account (usage direct)"),
  "CB-06": num("derive", "derive_max", 20, "gte", "%", "Dérive du profil du répondant"),
  "CB-07": flag("shellBank", "registres_supervision", "Banque coquille / hors supervision (gel légal)"),
  "CB-08": num("moisSansActivite", "periode_revue_rma", 12, "gte", " mois", "RMA dormant (revue échue)"),
  "CB-09": flag("respondentHit", "frequence_screen_respondants", "Hit sur un respondant (screening périodique)"),
  // ── Bloc 59 — Prolifération (R393–R395) ──
  "PF-01": flag("plafondDepasse", "plafonds_sectoriels", "Violation de plafond / embargo sectoriel"),
  "PF-02": num("ageMois", "age_entite_min", 24, "lte", " mois", "Chaîne de prolifération (entité récente)"),
  "PF-03": flag("luxeEmbargo", "categories_luxe", "Bien de luxe sous embargo (destinataire final)"),
  // ── Bloc 60 — Immobilier & Art (R396–R398) ──
  "IA-01": num("ecartMarche", "ecart_marche_max", 25, "gte", "%", "Anomalie immobilière (écart au marché)"),
  "IA-02": num("delaiMois", "delai_revente_min", 36, "lte", " mois", "Revente rapide (art / freeport)"),
  "IA-03": num("valeurChf", "seuil_biens_valeur", 200000, "gte", " CHF", "Bien de valeur comme véhicule patrimonial"),
};
