// Source : docs/reference/olive-demo.html 26807-26971 — porté verbatim.
// Catalogue Gherkin AML (C48) + noms FR + helpers pour l'écran « Règles AML » (AmlEncyclopediaScreen).
import { AML_PARAMS } from "./aml";

// RULE_PARAM_KEY (source 15098) : index règle → clé de paramètre.
export const RULE_PARAM_KEY: any = {};
Object.keys(AML_PARAMS).forEach(function (k) { RULE_PARAM_KEY[(AML_PARAMS as any)[k].rule] = k; });

export const C48_AML: any[] = [
    { id: "A-69", rule: "R189", nom: "Structuring", niveau: 2, block: false, ico: "💰", desc: "N dépôts sous le seuil de déclaration, somme > seuil agrégé sur fenêtre glissante 7j.", given: "Un client effectue 5 dépôts de CHF 19'000 en 6 jours (seuil unitaire 20'000, agrégé 95'000).", when: "Le moteur agrège la fenêtre glissante à réception du 5e dépôt.", then: "Signal STRUCTURING (Niveau 2) — alerte CO, dossier d'investigation pré-rempli, aucun blocage." },
    { id: "A-70", rule: "R190", nom: "Cross-Border circulaire", niveau: 2, block: false, ico: "🔄", desc: "Flux A→B→C→A transfrontalier sans motif économique.", given: "CHF 400k partent vers SG, reviennent via HK puis LU en 21 jours.", when: "Le graphe de flux détecte le cycle fermé multi-juridictions.", then: "Signal CROSS_BORDER_CIRCULAR (Niveau 2) — demande de justification économique au RM." },
    { id: "A-71", rule: "R191", nom: "Velocity spike", niveau: 2, block: false, ico: "📈", desc: "Volume transactionnel anormal vs moyenne mobile 90j.", given: "Compte à CHF 50k/mois de moyenne passe à CHF 240k en 2 semaines.", when: "Ratio volume courant / moyenne 90j > 4×.", then: "Signal UNUSUAL_VELOCITY (Niveau 2) — revue du profil transactionnel KYC." },
    { id: "A-72", rule: "R192", nom: "Sanctions — blocage", niveau: 1, block: true, ico: "🔴", desc: "Contrepartie en liste OFAC/SECO/UE/ONU.", given: "Un virement sortant vise une entité présente sur la liste SECO.", when: "Le screening temps réel matche la contrepartie (fuzzy + exact).", then: "TRANSACTION BLOQUÉE (Niveau 1) — gel, notification MROS préparée, décision humaine requise (R44)." },
    { id: "A-73", rule: "R193", nom: "UBO mismatch", niveau: 2, block: false, ico: "❓", desc: "ADE réel des flux ≠ UBO déclaré (formulaire A/K).", given: "73% des flux bénéficient à une personne absente du formulaire A.", when: "Croisement graphe de flux ↔ personnes liées déclarées.", then: "Signal UBO_MISMATCH (Niveau 2) — clarification CDB 20, éventuel nouveau formulaire A." },
    { id: "A-74", rule: "R194", nom: "In-Out same day", niveau: 2, block: false, ico: "⏱", desc: "Dépôt puis retrait ≥ 80% le même jour (layering).", given: "CHF 150k crédités à 09h12, CHF 128k débités à 15h40 le même jour.", when: "Ratio out/in du jour ≥ 80%.", then: "Signal PLACEMENT_WITHDRAWAL (Niveau 2) — alerte CO avec chronologie des mouvements." },
    { id: "A-75", rule: "R195", nom: "Third-party payer", niveau: 1, block: false, ico: "👥", desc: "Tiers payeur sans lien documenté au KYC.", given: "Un tiers inconnu du dossier crédite CHF 45k sur le compte.", when: "L'ordonnateur n'apparaît ni dans les personnes liées ni dans le KYC.", then: "Signal THIRD_PARTY_PAYER (Niveau 1) — fonds mis en attente de documentation SOF." },
    { id: "A-76", rule: "R196", nom: "Circular flow", niveau: 2, block: false, ico: "🔁", desc: "Fonds retournant à la source ≤ 30j via intermédiaires.", given: "CHF 200k → société X → société Y → retour donneur d'ordre en 18 jours.", when: "Détection de cycle sur le graphe des contreparties.", then: "Signal CIRCULAR_FLOW (Niveau 2) — cartographie du circuit jointe à l'alerte." },
    { id: "A-77", rule: "R197", nom: "HRI jurisdiction", niveau: 2, block: false, ico: "🌍", desc: "Corridor via juridiction haut risque (liste tenant).", given: "Virement CHF 80k vers une juridiction de la liste grise GAFI.", when: "Le corridor matche la liste pays à risque paramétrée (R-Q).", then: "Signal HRI_JURISDICTION (Niveau 2) — EDD corridor, seuils pondérés par niveau de liste." },
    { id: "A-78", rule: "R198", nom: "Round amounts", niveau: 1, block: false, ico: "💵", desc: "Montants ronds répétés sans logique commerciale.", given: "3 virements de CHF 100'000.00 exactement en 3 semaines.", when: "≥ 3 multiples exacts de 50k sur 30j sans facture associée.", then: "Signal ROUND_AMOUNTS (Niveau 1) — demande de justificatifs, revue légère." },
    { id: "A-79", rule: "R199", nom: "Cash-wire pattern", niveau: 2, block: false, ico: "💳", desc: "Espèces converties en virements ≤ 48h.", given: "Dépôt espèces CHF 40k lundi, virement sortant CHF 38k mercredi.", when: "Fenêtre cash→wire ≤ 48h au-dessus du seuil tenant.", then: "Signal CASH_WIRE_PATTERN (Niveau 2) — origine des espèces à documenter (LBA art. 6)." },
    { id: "A-80", rule: "R200", nom: "PEP adjacent", niveau: 2, block: false, ico: "⚖", desc: "Contrepartie Near-PEP via le graphe des personnes liées.", given: "Flux CHF 90k avec le frère d'un PEP répertorié (relation bijective).", when: "Le graphe personnes liées qualifie la contrepartie Near-PEP.", then: "Signal PEP_ADJACENT (Niveau 2) — revue Responsable AML, pas de contamination sans KYC validé." },
    { id: "A-81", rule: "R201", nom: "Invoice underpay", niveau: 1, block: false, ico: "📄", desc: "Sous-paiement systématique de factures (trade-based ML).", given: "8 factures payées avec un écart constant de -18% sur 3 mois.", when: "Écart récurrent ≥ 15% détecté sur les paiements commerciaux.", then: "Signal INVOICE_UNDERPAY (Niveau 1) — analyse trade finance, justificatifs contractuels." },
    { id: "A-82", rule: "R202", nom: "Counterparty velocity", niveau: 2, block: false, ico: "🏢", desc: "Rotation anormale de contreparties nouvelles.", given: "11 contreparties jamais vues apparaissent en 30 jours.", when: "Compteur de contreparties nouvelles / 30j > seuil tenant (8).", then: "Signal COUNTERPARTY_VELOCITY (Niveau 2) — profil d'activité KYC à réconcilier." },
    { id: "A-83", rule: "R203", nom: "CRS non-compliance", niveau: 1, block: true, ico: "🔒", desc: "Auto-certification CRS/FATCA absente ou expirée.", given: "L'auto-certification CRS du titulaire est expirée depuis 45 jours.", when: "Contrôle de validité documentaire à l'initiation d'un virement sortant.", then: "OPÉRATIONS SORTANTES BLOQUÉES (Niveau 1) — jusqu'à régularisation, tâche Central File générée." },
    { id: "A-84", rule: "R204", nom: "Fiduciary abuse", niveau: 2, block: false, ico: "🖋", desc: "Fondé de pouvoir opérant hors mandat vers ses comptes.", given: "Le mandataire vire CHF 25k vers son compte personnel, hors périmètre du mandat.", when: "Croisement signataire ↔ bénéficiaire ↔ limites de procuration.", then: "Signal FIDUCIARY_ABUSE (Niveau 2) — alerte titulaire + CO, revue de la procuration." },
    { id: "A-85", rule: "R205", nom: "Tax minimization", niveau: 1, block: false, ico: "📊", desc: "Schéma multi-juridictions à finalité fiscale exclusive.", given: "Structure LU→KY→CH sans substance économique, flux CHF 300k.", when: "Pattern de structuration multi-juridictions sans activité déclarée.", then: "Signal TAX_MINIMIZATION (Niveau 1) — analyse infractions fiscales qualifiées (LBA)." },
    { id: "A-86", rule: "R206", nom: "Concentration risk", niveau: 1, block: false, ico: "🎯", desc: "Concentration des flux vers une contrepartie unique.", given: "68% des sorties du trimestre vers une seule contrepartie non bancaire.", when: "Part de la contrepartie > 60% des flux / 90j.", then: "Signal CONCENTRATION_RISK (Niveau 1) — revue de dépendance et de plausibilité." },
];
export const C48_ISL: any[] = [
    { id: "IS-01", rule: "R207", nom: "Islamic Profile", niveau: 2, block: false, ico: "☪", desc: "Client islamicClient=true sur compte STANDARD.", given: "Un client au profil islamique est rattaché à un compte de type STANDARD.", when: "Contrôle de cohérence type(client) ↔ type(compte) à l'ouverture ou en CoC.", then: "Signal ISLAMIC_PROFILE_VIOLATION (Niveau 2) — proposition de migration vers compte ISLAMIC." },
    { id: "IS-02", rule: "R208", nom: "Riba (intérêts)", niveau: 2, block: false, ico: "🚫", desc: "Revenu d'intérêts crédité sur compte islamique.", given: "Un coupon d'obligation conventionnelle 2.5% est crédité sur un compte ISLAMIC.", when: "Le revenu est classé « Interest » par l'analyse de flux.", then: "Signal RIBA_INCOME (Niveau 2) — revenu isolé (purification), alerte CO + Sharia Board." },
    { id: "IS-03", rule: "R209", nom: "Maysir — blocage", niveau: 1, block: true, ico: "🎲", desc: "Spéculation excessive : volatilité > 40% ou levier > 2×.", given: "Ordre d'achat crypto à volatilité 30j de 47%, levier 3×.", when: "Score maysir = f(volatilité, levier, montant) dépasse le seuil.", then: "ORDRE BLOQUÉ (Niveau 1) — motif « spéculation excessive », alternatives conformes proposées." },
    { id: "IS-04", rule: "R210", nom: "Gharar (incertitude)", niveau: 2, block: false, ico: "🔍", desc: "Contrat sans prix/quantité/échéance certains.", given: "Un forward sans échéance ferme est soumis à validation.", when: "Le contrôle contractuel détecte l'incertitude essentielle.", then: "Signal GHARAR_DETECTED (Niveau 2) — contrat rejeté, alternative Murabaha suggérée." },
    { id: "IS-05", rule: "R211", nom: "Zakat 2.5%", niveau: 0, block: false, ico: "💰", desc: "Calcul annuel automatique si richesse ≥ nisab.", given: "Client zakatEnabled, patrimoine agrégé CHF 120'000 (nisab 100'000).", when: "Clôture de l'année (lunaire ou simulée).", then: "Zakat due = CHF 3'000 (2.5%) — statut PENDING_PAYMENT, suggestions d'œuvres, traçée." },
    { id: "IS-06", rule: "R212", nom: "Sukuk authenticity", niveau: 2, block: false, ico: "📜", desc: "Titre « Sukuk » sans certification AAOIFI/ISRA valide.", given: "Achat d'un titre libellé Sukuk sans board certifié.", when: "Vérification du certificat Sharia Board du produit.", then: "Signal FAKE_SUKUK (Niveau 2) — titre rejeté du référentiel produits conformes." },
    { id: "IS-07", rule: "R213", nom: "Halal counterparty", niveau: 1, block: true, ico: "🟢", desc: "Contrepartie de secteur prohibé (alcool, jeux, armement, intérêts).", given: "Virement vers une société de paris en ligne.", when: "Screening sectoriel (référentiel secteurs + mots-clés).", then: "TRANSACTION BLOQUÉE (Niveau 1) — HARAM_COUNTERPARTY, décision humaine requise pour dérogation." },
    { id: "IS-08", rule: "R214", nom: "Qard ul Hasan", niveau: 0, block: false, ico: "🤝", desc: "Prêt sans intérêt — principal immuable.", given: "Prêt qardHasan de CHF 50k accordé à un proche du titulaire.", when: "Suivi du remboursement.", then: "Remboursement exact = principal uniquement — tout supplément est rejeté et tracé." },
    { id: "IS-09", rule: "R215", nom: "Mudaraba", niveau: 0, block: false, ico: "📈", desc: "Partage de profit trimestriel selon ratios convenus.", given: "Compte Mudaraba 60/40 (client/banque), profit net trimestriel CHF 12k.", when: "Clôture du trimestre.", then: "Distribution CHF 7'200 / 4'800 selon ratios — événement tracé dans l'audit trail (R48)." },
    { id: "IS-10", rule: "R216", nom: "Islamic sanctions", niveau: 2, block: false, ico: "🌍", desc: "Vérification parallèle sanctions pays islamiques.", given: "Contrepartie visée par des sanctions d'un pays de l'OCI.", when: "Screening parallèle SECO + listes complémentaires.", then: "Signal (Niveau 2) — revue manuelle CO, pas de blocage automatique (conformité audit)." },
    { id: "IS-11", rule: "R217", nom: "Sharia audit report", niveau: 0, block: false, ico: "📋", desc: "Rapport annuel de conformité Sharia par compte.", given: "Compte islamique actif sur l'exercice écoulé.", when: "Génération annuelle du rapport.", then: "Le système compile les contrôles R207-R216, certifie et archive le rapport (GED)." },
    { id: "IS-12", rule: "R218", nom: "Waqf", niveau: 0, block: false, ico: "🏛", desc: "Dotation : principal immuable, retraits sur revenu uniquement.", given: "Tentative de retrait entamant le principal d'un compte WAQF.", when: "Contrôle income-only à l'initiation du retrait.", then: "Retrait rejeté — motif d'immutabilité tracé, alerte CO, bénéficiaires notifiés." },
    { id: "IS-13", rule: "R219", nom: "Takaful", niveau: 0, block: false, ico: "🛡", desc: "Assurance mutualisée — surplus partagé pro-rata.", given: "Pool Takaful : primes collectées CHF 240k, sinistres CHF 180k.", when: "Clôture annuelle du pool.", then: "Surplus CHF 60k redistribué pro-rata aux souscripteurs — écritures tracées." },
    { id: "IS-14", rule: "R220", nom: "Sukuk maturity", niveau: 0, block: false, ico: "⏰", desc: "Alertes 90 / 30 / 0 jours avant échéance.", given: "Sukuk en portefeuille arrivant à échéance dans 90 jours.", when: "Vérification quotidienne des échéances.", then: "Alertes J-90, J-30 et jour J au RM — tâches de réinvestissement conformes générées." },
    { id: "IS-15", rule: "R221", nom: "ESG + Islamic cert", niveau: 1, block: false, ico: "🌱", desc: "Double certification ESG + Islamic requise.", given: "Produit certifié ESG seul proposé à un client au profil islamique.", when: "Validation des certificats à la souscription.", then: "Signal MISSING_ISLAMIC_CERT (Niveau 1) — souscription suspendue en attente de la double certification." },
];

export function amlThemeOf(row: any): string {
    if (row.family === "ISL") return "Islamic Finance";
    if (row.kind === "SCORING") return "Socle universel (scoring)";
    var c = row.cat || "";
    if (c.indexOf("Bloc 48") >= 0) return "Private Banking";
    if (c.indexOf("Correspondent") >= 0) return "Correspondent Banking";
    if (c.indexOf("White collar") >= 0) return "Capital Investment & Marchés";
    return "Retail & Universel";
}
export const AML_NOMS_FR: any = {
    "Structuring": "Fractionnement des dépôts (structuring)",
    "Cross-Border circulaire": "Circuit transfrontalier circulaire",
    "Velocity spike": "Vélocité transactionnelle anormale",
    "Sanctions — blocage": "Contrepartie sanctionnée — blocage immédiat",
    "UBO mismatch": "Ayant droit économique incohérent",
    "In-Out same day": "Entrée-sortie le même jour",
    "Third-party payer": "Payeur tiers non documenté",
    "Circular flow": "Fonds revenant à leur source",
    "HRI jurisdiction": "Virements vers juridictions à risque",
    "Round amounts": "Montants ronds répétés",
    "Cash-wire pattern": "Espèces converties en virements",
    "PEP adjacent": "Proximité avec une personne politiquement exposée",
    "Invoice underpay": "Factures systématiquement sous-payées",
    "Counterparty velocity": "Rotation anormale de contreparties",
    "CRS non-compliance": "Documentation fiscale manquante — blocage des sorties",
    "Fiduciary abuse": "Abus de procuration",
    "Tax minimization": "Montage fiscal multi-juridictions",
    "Concentration risk": "Concentration sur une contrepartie unique",
    "Riba (intérêts)": "Revenus d'intérêts (riba)",
    "Maysir — blocage": "Spéculation excessive (maysir) — blocage",
    "Gharar (incertitude)": "Contrat incertain (gharar)",
    "Sukuk authenticity": "Authenticité des sukuk",
    "Halal counterparty": "Contrepartie de secteur prohibé — blocage",
    "Qard ul Hasan": "Prêt sans intérêt (qard ul hasan)",
    "Sharia audit report": "Rapport d'audit Sharia annuel",
    "Sukuk maturity": "Échéance de sukuk — alertes",
    "ESG + Islamic cert": "Double certification ESG + islamique",
    "Islamic Profile": "Profil islamique sur compte standard",
    "Zakat 2.5%": "Calcul annuel de la zakat (2.5%)",
    "Mudaraba": "Partage de profit (mudaraba)",
    "Waqf": "Dotation à principal immuable (waqf)",
    "Takaful": "Assurance mutualisée (takaful)",
    "Islamic sanctions": "Sanctions — vérification parallèle islamique",
};
export function amlCleanName(n: any): string { return String(n || "").replace(/\s*\(R\d+\)\s*/g, " ").replace(/\s*PB\b/g, "").replace(/\s+/g, " ").trim(); }
export function amlHitsSeries(code: string, base: number): number[] {
  let h = 0; for (let i = 0; i < code.length; i++) h = ((h * 31 + code.charCodeAt(i)) >>> 0);
  const out: number[] = []; for (let m = 0; m < 6; m++) { h = ((h * 1103515245 + 12345) >>> 0); out.push(h % (base ? base + 4 : 7)); }
  return out;
}
