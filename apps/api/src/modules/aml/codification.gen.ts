// GÉNÉRÉ par tools/codification/gen_codification.py — NE PAS ÉDITER À LA MAIN.
// Codification MÉTIER des règles de détection (V2-M15, demande PO du 11.08.2026) : le code
// porte la FAMILLE (CIB-SEN01, ISLAMIC-SEN02…), pas le bloc d'implémentation.
//
// Le code s'AJOUTE, il ne remplace rien :
//   · `ref`      = le numéro R — canon ratifié, seule référence normative ;
//   · `idMoteur` = l'identifiant persisté en base (aml_gap_signals.scenarioCode, scénarios
//                  CPSI, types de détecteurs) — intouchable, le renommer casserait les
//                  signaux déjà écrits (R49) ;
//   · `code`     = le code métier lisible, pour les écrans, rapports et échanges régulateur.
//
// Un code est IMMUABLE une fois attribué ; une règle retirée garde son numéro et celui-ci
// n'est jamais réattribué — sinon un rapport ancien devient faux.

export type SourceRegle = "moteur" | "biblio-cpsi";

export interface RegleCodifiee {
  code: string;          // FAMILLE-SENnn — code métier, immuable
  famille: string;       // code de famille (TX, CIB, ISLAMIC…)
  familleLabel: string;  // libellé lisible de la famille
  source: SourceRegle;   // "biblio-cpsi" = bibliothèque du front, PAS encore un référentiel moteur
  ref: string;           // numéro R du canon — référence normative
  idMoteur: string;      // identifiant persisté par le moteur — ne jamais renommer
  niveau: number;        // 1 = sévère · 2 = signal
  titre: string;
}

export const CODIFICATION: RegleCodifiee[] = [
  {
    "code": "TX-SEN01",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R189",
    "idMoteur": "STRUCTURING",
    "niveau": 2,
    "titre": "Structuring : fractionnement sous le seuil, même bénéficiaire"
  },
  {
    "code": "TX-SEN02",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R190",
    "idMoteur": "CROSS_BORDER_CIRCULAR",
    "niveau": 2,
    "titre": "Cross-border circular : même UBO, ≥N pays, fenêtre courte"
  },
  {
    "code": "TX-SEN03",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R191",
    "idMoteur": "UNUSUAL_VELOCITY",
    "niveau": 2,
    "titre": "Unusual velocity : réveil d'un compte dormant"
  },
  {
    "code": "TX-SEN04",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R192",
    "idMoteur": "SANCTIONS",
    "niveau": 1,
    "titre": "Sanctions : liste réglementaire → refus immédiat non révocable"
  },
  {
    "code": "TX-SEN05",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R193",
    "idMoteur": "UBO_MISMATCH",
    "niveau": 2,
    "titre": "UBO mismatch : déclaré ≠ détecté"
  },
  {
    "code": "TX-SEN06",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R194",
    "idMoteur": "PLACEMENT_WITHDRAWAL",
    "niveau": 2,
    "titre": "In/Out same day : entrée puis sortie ≈montant, fenêtre courte"
  },
  {
    "code": "TX-SEN07",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R195",
    "idMoteur": "THIRD_PARTY_PAYER",
    "niveau": 1,
    "titre": "Third-party payer : le titulaire ne paie jamais"
  },
  {
    "code": "TX-SEN08",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R196",
    "idMoteur": "CIRCULAR_FLOW",
    "niveau": 2,
    "titre": "Circular flow : cycle A→B→C→A entre comptes du même UBO"
  },
  {
    "code": "TX-SEN09",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R197",
    "idMoteur": "HRI_JURISDICTION",
    "niveau": 2,
    "titre": "HRI jurisdiction : pays à haut risque → blocage attente CO"
  },
  {
    "code": "TX-SEN10",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R198",
    "idMoteur": "ROUND_AMOUNTS",
    "niveau": 1,
    "titre": "Round amounts : forte proportion de montants ronds"
  },
  {
    "code": "TX-SEN11",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R199",
    "idMoteur": "CASH_WIRE_PATTERN",
    "niveau": 2,
    "titre": "Cash deposit + wire out : espèces puis virement >X% en <Yh"
  },
  {
    "code": "TX-SEN12",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R200",
    "idMoteur": "PEP_ADJACENT",
    "niveau": 2,
    "titre": "PEP adjacent : le client paie un tiers PEP/Near-PEP"
  },
  {
    "code": "TX-SEN13",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R201",
    "idMoteur": "INVOICE_UNDERPAY",
    "niveau": 1,
    "titre": "Invoice underpay : sous-paiement systématique des factures"
  },
  {
    "code": "TX-SEN14",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R202",
    "idMoteur": "COUNTERPARTY_VELOCITY",
    "niveau": 2,
    "titre": "Counterparty velocity : montant > facteur × (moyenne + σ)"
  },
  {
    "code": "TX-SEN15",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R203",
    "idMoteur": "CRS_NON_COMPLIANCE",
    "niveau": 2,
    "titre": "CRS/FATCA non-compliance : périmètre CRS, gros solde, pas d'auto-certification"
  },
  {
    "code": "TX-SEN16",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R204",
    "idMoteur": "FIDUCIARY_ABUSE",
    "niveau": 2,
    "titre": "Fiduciary abuse : retrait personnel > X% des dépôts clients"
  },
  {
    "code": "TX-SEN17",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R205",
    "idMoteur": "TAX_MINIMIZATION",
    "niveau": 1,
    "titre": "Tax minimization : circuit CH → tax haven"
  },
  {
    "code": "TX-SEN18",
    "famille": "TX",
    "familleLabel": "Surveillance transactionnelle",
    "source": "moteur",
    "ref": "R206",
    "idMoteur": "CONCENTRATION_RISK",
    "niveau": 1,
    "titre": "Concentration risk : >X% du patrimoine sur 1-2 comptes courants"
  },
  {
    "code": "SF-SEN01",
    "famille": "SF",
    "familleLabel": "Screening en flux",
    "source": "moteur",
    "ref": "R340",
    "idMoteur": "SF-01",
    "niveau": 2,
    "titre": "Contrepartie PEP en flux"
  },
  {
    "code": "SF-SEN02",
    "famille": "SF",
    "familleLabel": "Screening en flux",
    "source": "moteur",
    "ref": "R341",
    "idMoteur": "SF-02",
    "niveau": 2,
    "titre": "Adverse media sur contrepartie"
  },
  {
    "code": "SF-SEN03",
    "famille": "SF",
    "familleLabel": "Screening en flux",
    "source": "moteur",
    "ref": "R342",
    "idMoteur": "SF-03",
    "niveau": 2,
    "titre": "Re-screening périodique (perpetual)"
  },
  {
    "code": "SF-SEN04",
    "famille": "SF",
    "familleLabel": "Screening en flux",
    "source": "moteur",
    "ref": "R343",
    "idMoteur": "SF-04",
    "niveau": 2,
    "titre": "Banques intermédiaires (BIC)"
  },
  {
    "code": "SF-SEN05",
    "famille": "SF",
    "familleLabel": "Screening en flux",
    "source": "moteur",
    "ref": "R344",
    "idMoteur": "SF-05",
    "niveau": 1,
    "titre": "Adresse / localisation sanctionnée"
  },
  {
    "code": "SF-SEN06",
    "famille": "SF",
    "familleLabel": "Screening en flux",
    "source": "moteur",
    "ref": "R345",
    "idMoteur": "SF-06",
    "niveau": 2,
    "titre": "Translittération multi-scripts"
  },
  {
    "code": "SF-SEN07",
    "famille": "SF",
    "familleLabel": "Screening en flux",
    "source": "moteur",
    "ref": "R346",
    "idMoteur": "SF-07",
    "niveau": 1,
    "titre": "Navires & IMO"
  },
  {
    "code": "QO-SEN01",
    "famille": "QO",
    "familleLabel": "Indices OBA-FINMA",
    "source": "moteur",
    "ref": "R347",
    "idMoteur": "QO-01",
    "niveau": 2,
    "titre": "Refus de fournir des informations"
  },
  {
    "code": "QO-SEN02",
    "famille": "QO",
    "familleLabel": "Indices OBA-FINMA",
    "source": "moteur",
    "ref": "R348",
    "idMoteur": "QO-02",
    "niveau": 2,
    "titre": "Compte de passage multi-titulaires"
  },
  {
    "code": "QO-SEN03",
    "famille": "QO",
    "familleLabel": "Indices OBA-FINMA",
    "source": "moteur",
    "ref": "R349",
    "idMoteur": "QO-03",
    "niveau": 2,
    "titre": "Opération sans justification économique"
  },
  {
    "code": "QO-SEN04",
    "famille": "QO",
    "familleLabel": "Indices OBA-FINMA",
    "source": "moteur",
    "ref": "R350",
    "idMoteur": "QO-04",
    "niveau": 1,
    "titre": "Adresse partagée multi-clients"
  },
  {
    "code": "QO-SEN05",
    "famille": "QO",
    "familleLabel": "Indices OBA-FINMA",
    "source": "moteur",
    "ref": "R351",
    "idMoteur": "QO-05",
    "niveau": 2,
    "titre": "Rotation des procurations / instructions"
  },
  {
    "code": "GU-SEN01",
    "famille": "GU",
    "familleLabel": "Vision groupe UBO",
    "source": "moteur",
    "ref": "R352",
    "idMoteur": "GU-01",
    "niveau": 2,
    "titre": "Structuring cross-comptes du groupe"
  },
  {
    "code": "GU-SEN02",
    "famille": "GU",
    "familleLabel": "Vision groupe UBO",
    "source": "moteur",
    "ref": "R353",
    "idMoteur": "GU-02",
    "niveau": 2,
    "titre": "Flux circulaires intra-groupe"
  },
  {
    "code": "GU-SEN03",
    "famille": "GU",
    "familleLabel": "Vision groupe UBO",
    "source": "moteur",
    "ref": "R354",
    "idMoteur": "GU-03",
    "niveau": 2,
    "titre": "Cash consolidé du périmètre"
  },
  {
    "code": "GU-SEN04",
    "famille": "GU",
    "familleLabel": "Vision groupe UBO",
    "source": "moteur",
    "ref": "R355",
    "idMoteur": "GU-04",
    "niveau": 2,
    "titre": "Seuils agrégés cross-produits"
  },
  {
    "code": "IP-SEN01",
    "famille": "IP",
    "familleLabel": "Instruments PB",
    "source": "moteur",
    "ref": "R356",
    "idMoteur": "IP-01",
    "niveau": 2,
    "titre": "Lombard — remboursement par tiers"
  },
  {
    "code": "IP-SEN02",
    "famille": "IP",
    "familleLabel": "Instruments PB",
    "source": "moteur",
    "ref": "R357",
    "idMoteur": "IP-02",
    "niveau": 1,
    "titre": "Back-to-back loan"
  },
  {
    "code": "IP-SEN03",
    "famille": "IP",
    "familleLabel": "Instruments PB",
    "source": "moteur",
    "ref": "R358",
    "idMoteur": "IP-03",
    "niveau": 2,
    "titre": "Wrapper assurance — prime hors profil"
  },
  {
    "code": "IP-SEN04",
    "famille": "IP",
    "familleLabel": "Instruments PB",
    "source": "moteur",
    "ref": "R359",
    "idMoteur": "IP-04",
    "niveau": 2,
    "titre": "Wrapper assurance — rachat précoce"
  },
  {
    "code": "IP-SEN05",
    "famille": "IP",
    "familleLabel": "Instruments PB",
    "source": "moteur",
    "ref": "R360",
    "idMoteur": "IP-05",
    "niveau": 2,
    "titre": "Changement de bénéficiaire post-souscription"
  },
  {
    "code": "IP-SEN06",
    "famille": "IP",
    "familleLabel": "Instruments PB",
    "source": "moteur",
    "ref": "R361",
    "idMoteur": "IP-06",
    "niveau": 2,
    "titre": "Coffres — corrélation cash"
  },
  {
    "code": "IP-SEN07",
    "famille": "IP",
    "familleLabel": "Instruments PB",
    "source": "moteur",
    "ref": "R362",
    "idMoteur": "IP-07",
    "niveau": 2,
    "titre": "Métaux précieux physiques"
  },
  {
    "code": "CR-SEN01",
    "famille": "CR",
    "familleLabel": "Crypto / VASP",
    "source": "moteur",
    "ref": "R363",
    "idMoteur": "CR-01",
    "niveau": 1,
    "titre": "Travel rule DLT"
  },
  {
    "code": "CR-SEN02",
    "famille": "CR",
    "familleLabel": "Crypto / VASP",
    "source": "moteur",
    "ref": "R364",
    "idMoteur": "CR-02",
    "niveau": 1,
    "titre": "Exposition mixer / tumbler"
  },
  {
    "code": "CR-SEN03",
    "famille": "CR",
    "familleLabel": "Crypto / VASP",
    "source": "moteur",
    "ref": "R365",
    "idMoteur": "CR-03",
    "niveau": 1,
    "titre": "Adresse sanctionnée on-chain"
  },
  {
    "code": "CR-SEN04",
    "famille": "CR",
    "familleLabel": "Crypto / VASP",
    "source": "moteur",
    "ref": "R366",
    "idMoteur": "CR-04",
    "niveau": 1,
    "titre": "Cluster darknet / ransomware"
  },
  {
    "code": "CR-SEN05",
    "famille": "CR",
    "familleLabel": "Crypto / VASP",
    "source": "moteur",
    "ref": "R367",
    "idMoteur": "CR-05",
    "niveau": 1,
    "titre": "Wallet auto-hébergé sans preuve"
  },
  {
    "code": "CR-SEN06",
    "famille": "CR",
    "familleLabel": "Crypto / VASP",
    "source": "moteur",
    "ref": "R368",
    "idMoteur": "CR-06",
    "niveau": 2,
    "titre": "On/off-ramp incohérent au profil"
  },
  {
    "code": "FT-SEN01",
    "famille": "FT",
    "familleLabel": "CFT",
    "source": "moteur",
    "ref": "R369",
    "idMoteur": "FT-01",
    "niveau": 2,
    "titre": "Micro-transactions vers corridors sensibles"
  },
  {
    "code": "FT-SEN02",
    "famille": "FT",
    "familleLabel": "CFT",
    "source": "moteur",
    "ref": "R370",
    "idMoteur": "FT-02",
    "niveau": 2,
    "titre": "Collectes / ONG à risque"
  },
  {
    "code": "FT-SEN03",
    "famille": "FT",
    "familleLabel": "CFT",
    "source": "moteur",
    "ref": "R371",
    "idMoteur": "FT-03",
    "niveau": 2,
    "titre": "Cartes prépayées multi-sources"
  },
  {
    "code": "FT-SEN04",
    "famille": "FT",
    "familleLabel": "CFT",
    "source": "moteur",
    "ref": "R372",
    "idMoteur": "FT-04",
    "niveau": 2,
    "titre": "Cohérence voyages ↔ flux"
  },
  {
    "code": "FT-SEN05",
    "famille": "FT",
    "familleLabel": "CFT",
    "source": "moteur",
    "ref": "R373",
    "idMoteur": "FT-05",
    "niveau": 1,
    "titre": "Listes terroristes dédiées"
  },
  {
    "code": "GV-SEN01",
    "famille": "GV",
    "familleLabel": "Gouvernance du dispositif",
    "source": "moteur",
    "ref": "R374",
    "idMoteur": "GV-01",
    "niveau": null,
    "titre": "Below-the-line sampling"
  },
  {
    "code": "GV-SEN02",
    "famille": "GV",
    "familleLabel": "Gouvernance du dispositif",
    "source": "moteur",
    "ref": "R375",
    "idMoteur": "GV-02",
    "niveau": null,
    "titre": "Backtesting par version"
  },
  {
    "code": "GV-SEN03",
    "famille": "GV",
    "familleLabel": "Gouvernance du dispositif",
    "source": "moteur",
    "ref": "R376",
    "idMoteur": "GV-03",
    "niveau": 1,
    "titre": "Data quality pré-conditions"
  },
  {
    "code": "GV-SEN04",
    "famille": "GV",
    "familleLabel": "Gouvernance du dispositif",
    "source": "moteur",
    "ref": "R377",
    "idMoteur": "GV-04",
    "niveau": null,
    "titre": "Revue annuelle de calibrage"
  },
  {
    "code": "TB-SEN01",
    "famille": "TB",
    "familleLabel": "TBML",
    "source": "moteur",
    "ref": "R378",
    "idMoteur": "TB-01",
    "niveau": 2,
    "titre": "Surfacturation (over-invoicing)"
  },
  {
    "code": "TB-SEN02",
    "famille": "TB",
    "familleLabel": "TBML",
    "source": "moteur",
    "ref": "R379",
    "idMoteur": "TB-02",
    "niveau": 2,
    "titre": "Facturation multiple"
  },
  {
    "code": "TB-SEN03",
    "famille": "TB",
    "familleLabel": "TBML",
    "source": "moteur",
    "ref": "R380",
    "idMoteur": "TB-03",
    "niveau": 2,
    "titre": "Prix hors benchmark (unit price)"
  },
  {
    "code": "TB-SEN04",
    "famille": "TB",
    "familleLabel": "TBML",
    "source": "moteur",
    "ref": "R381",
    "idMoteur": "TB-04",
    "niveau": 1,
    "titre": "Biens à double usage"
  },
  {
    "code": "TB-SEN05",
    "famille": "TB",
    "familleLabel": "TBML",
    "source": "moteur",
    "ref": "R382",
    "idMoteur": "TB-05",
    "niveau": 2,
    "titre": "LC back-to-back / crédits doc HRJ"
  },
  {
    "code": "TB-SEN06",
    "famille": "TB",
    "familleLabel": "TBML",
    "source": "moteur",
    "ref": "R383",
    "idMoteur": "TB-06",
    "niveau": 1,
    "titre": "Phantom shipping"
  },
  {
    "code": "TB-SEN07",
    "famille": "TB",
    "familleLabel": "TBML",
    "source": "moteur",
    "ref": "R384",
    "idMoteur": "TB-07",
    "niveau": 2,
    "titre": "Routes & transbordements atypiques"
  },
  {
    "code": "TB-SEN08",
    "famille": "TB",
    "familleLabel": "TBML",
    "source": "moteur",
    "ref": "R385",
    "idMoteur": "TB-08",
    "niveau": 2,
    "titre": "Carrousel documentaire"
  },
  {
    "code": "CB-SEN01",
    "famille": "CB",
    "familleLabel": "Correspondent Banking",
    "source": "moteur",
    "ref": "R386",
    "idMoteur": "CB-03",
    "niveau": 1,
    "titre": "Wire stripping / transparence"
  },
  {
    "code": "CB-SEN02",
    "famille": "CB",
    "familleLabel": "Correspondent Banking",
    "source": "moteur",
    "ref": "R387",
    "idMoteur": "CB-04",
    "niveau": 2,
    "titre": "U-turn payments"
  },
  {
    "code": "CB-SEN03",
    "famille": "CB",
    "familleLabel": "Correspondent Banking",
    "source": "moteur",
    "ref": "R388",
    "idMoteur": "CB-05",
    "niveau": 1,
    "titre": "Payable-through accounts"
  },
  {
    "code": "CB-SEN04",
    "famille": "CB",
    "familleLabel": "Correspondent Banking",
    "source": "moteur",
    "ref": "R389",
    "idMoteur": "CB-06",
    "niveau": 2,
    "titre": "Volumétrie répondant vs profil (KYCC)"
  },
  {
    "code": "CB-SEN05",
    "famille": "CB",
    "familleLabel": "Correspondent Banking",
    "source": "moteur",
    "ref": "R390",
    "idMoteur": "CB-07",
    "niveau": 1,
    "titre": "Shell bank"
  },
  {
    "code": "CB-SEN06",
    "famille": "CB",
    "familleLabel": "Correspondent Banking",
    "source": "moteur",
    "ref": "R391",
    "idMoteur": "CB-08",
    "niveau": 1,
    "titre": "RMA sans flux ni justification"
  },
  {
    "code": "CB-SEN07",
    "famille": "CB",
    "familleLabel": "Correspondent Banking",
    "source": "moteur",
    "ref": "R392",
    "idMoteur": "CB-09",
    "niveau": 2,
    "titre": "Screening des répondantes (CBDDQ)"
  },
  {
    "code": "PF-SEN01",
    "famille": "PF",
    "familleLabel": "Prolifération",
    "source": "moteur",
    "ref": "R393",
    "idMoteur": "PF-01",
    "niveau": 1,
    "titre": "Sanctions sectorielles & plafonds"
  },
  {
    "code": "PF-SEN02",
    "famille": "PF",
    "familleLabel": "Prolifération",
    "source": "moteur",
    "ref": "R394",
    "idMoteur": "PF-02",
    "niveau": 1,
    "titre": "Chaînes d'écrans corridors KP/IR"
  },
  {
    "code": "PF-SEN03",
    "famille": "PF",
    "familleLabel": "Prolifération",
    "source": "moteur",
    "ref": "R395",
    "idMoteur": "PF-03",
    "niveau": 2,
    "titre": "Biens de luxe vers zones embargo"
  },
  {
    "code": "IA-SEN01",
    "famille": "IA",
    "familleLabel": "Immobilier & Art",
    "source": "moteur",
    "ref": "R396",
    "idMoteur": "IA-01",
    "niveau": 2,
    "titre": "Immobilier via structure + prix hors marché"
  },
  {
    "code": "IA-SEN02",
    "famille": "IA",
    "familleLabel": "Immobilier & Art",
    "source": "moteur",
    "ref": "R397",
    "idMoteur": "IA-02",
    "niveau": 2,
    "titre": "Art & ports francs"
  },
  {
    "code": "IA-SEN03",
    "famille": "IA",
    "familleLabel": "Immobilier & Art",
    "source": "moteur",
    "ref": "R398",
    "idMoteur": "IA-03",
    "niveau": 2,
    "titre": "Véhicules de valeur (luxe, NFT)"
  },
  {
    "code": "AN-SEN01",
    "famille": "AN",
    "familleLabel": "Analytique 2G",
    "source": "moteur",
    "ref": "R399",
    "idMoteur": "AN-01",
    "niveau": 2,
    "titre": "Déviation au groupe de pairs"
  },
  {
    "code": "AN-SEN02",
    "famille": "AN",
    "familleLabel": "Analytique 2G",
    "source": "moteur",
    "ref": "R400",
    "idMoteur": "AN-02",
    "niveau": 2,
    "titre": "Rupture de comportement (baseline propre)"
  },
  {
    "code": "AN-SEN03",
    "famille": "AN",
    "familleLabel": "Analytique 2G",
    "source": "moteur",
    "ref": "R401",
    "idMoteur": "AN-03",
    "niveau": 1,
    "titre": "First-time patterns"
  },
  {
    "code": "AN-SEN04",
    "famille": "AN",
    "familleLabel": "Analytique 2G",
    "source": "moteur",
    "ref": "R402",
    "idMoteur": "AN-04",
    "niveau": 2,
    "titre": "Dormance partielle par segment"
  },
  {
    "code": "AN-SEN05",
    "famille": "AN",
    "familleLabel": "Analytique 2G",
    "source": "moteur",
    "ref": "R403",
    "idMoteur": "AN-05",
    "niveau": 2,
    "titre": "Revenus entrants incohérents (mismatch)"
  },
  {
    "code": "CASH-SEN01",
    "famille": "CASH",
    "familleLabel": "Cash & espèces",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-STRUCT",
    "niveau": 2,
    "titre": "Fractionnement (structuring)"
  },
  {
    "code": "CASH-SEN02",
    "famille": "CASH",
    "familleLabel": "Cash & espèces",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-CASH",
    "niveau": 2,
    "titre": "Intensité cash"
  },
  {
    "code": "CASH-SEN03",
    "famille": "CASH",
    "familleLabel": "Cash & espèces",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-CASHDEP",
    "niveau": 2,
    "titre": "Dépôts espèces importants"
  },
  {
    "code": "CASH-SEN04",
    "famille": "CASH",
    "familleLabel": "Cash & espèces",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-CASHWD",
    "niveau": 2,
    "titre": "Retraits espèces importants"
  },
  {
    "code": "TRF-SEN01",
    "famille": "TRF",
    "familleLabel": "Transferts & transfer agent",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-WIRE-HRJ",
    "niveau": 2,
    "titre": "Virements vers juridictions à risque"
  },
  {
    "code": "TRF-SEN02",
    "famille": "TRF",
    "familleLabel": "Transferts & transfer agent",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-PASSTHRU",
    "niveau": 2,
    "titre": "Pass-through — entrée/sortie même jour"
  },
  {
    "code": "TRF-SEN03",
    "famille": "TRF",
    "familleLabel": "Transferts & transfer agent",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-3PWIRE",
    "niveau": 2,
    "titre": "Virements vers tiers non liés"
  },
  {
    "code": "TRF-SEN04",
    "famille": "TRF",
    "familleLabel": "Transferts & transfer agent",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-STRUCTW",
    "niveau": 2,
    "titre": "Virements structurés (sous seuil)"
  },
  {
    "code": "TRF-SEN05",
    "famille": "TRF",
    "familleLabel": "Transferts & transfer agent",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-FUNNEL",
    "niveau": 2,
    "titre": "Comptes entonnoir (multi-sources)"
  },
  {
    "code": "TRF-SEN06",
    "famille": "TRF",
    "familleLabel": "Transferts & transfer agent",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-FOP",
    "niveau": 2,
    "titre": "Livraisons franco de paiement (FOP)"
  },
  {
    "code": "TRF-SEN07",
    "famille": "TRF",
    "familleLabel": "Transferts & transfer agent",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-INSPECIE",
    "niveau": 2,
    "titre": "Transferts in-specie"
  },
  {
    "code": "TRF-SEN08",
    "famille": "TRF",
    "familleLabel": "Transferts & transfer agent",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-TIERS",
    "niveau": 2,
    "titre": "Règlements de tiers"
  },
  {
    "code": "TRF-SEN09",
    "famille": "TRF",
    "familleLabel": "Transferts & transfer agent",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-ROTATION",
    "niveau": 2,
    "titre": "Rotation de titres anormale"
  },
  {
    "code": "ACT-SEN01",
    "famille": "ACT",
    "familleLabel": "Activité transactionnelle",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-VELO",
    "niveau": 2,
    "titre": "Vélocité transactionnelle anormale"
  },
  {
    "code": "ACT-SEN02",
    "famille": "ACT",
    "familleLabel": "Activité transactionnelle",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-VOLUME",
    "niveau": 2,
    "titre": "Volume mensuel inhabituel (CHF)"
  },
  {
    "code": "ACT-SEN03",
    "famille": "ACT",
    "familleLabel": "Activité transactionnelle",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-RAPIDE",
    "niveau": 2,
    "titre": "Mouvements rapides in/out"
  },
  {
    "code": "ACT-SEN04",
    "famille": "ACT",
    "familleLabel": "Activité transactionnelle",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-CROSS",
    "niveau": 2,
    "titre": "Concentration transfrontalière"
  },
  {
    "code": "TRAD-SEN01",
    "famille": "TRAD",
    "familleLabel": "Trading & marchés",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-ILLIQ",
    "niveau": 2,
    "titre": "Trading en titres illiquides"
  },
  {
    "code": "TRAD-SEN02",
    "famille": "TRAD",
    "familleLabel": "Trading & marchés",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-CHURN",
    "niveau": 2,
    "titre": "Rotation excessive (churning)"
  },
  {
    "code": "TRAD-SEN03",
    "famille": "TRAD",
    "familleLabel": "Trading & marchés",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-CROSSTR",
    "niveau": 2,
    "titre": "Cross trades entre comptes liés"
  },
  {
    "code": "CIB-SEN01",
    "famille": "CIB",
    "familleLabel": "Capital markets / CIB",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-CAPCALL",
    "niveau": 2,
    "titre": "Appels de capitaux atypiques"
  },
  {
    "code": "CIB-SEN02",
    "famille": "CIB",
    "familleLabel": "Capital markets / CIB",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-PRIVPLACE",
    "niveau": 2,
    "titre": "Placements privés non cotés"
  },
  {
    "code": "CIB-SEN03",
    "famille": "CIB",
    "familleLabel": "Capital markets / CIB",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-IPO",
    "niveau": 2,
    "titre": "Flux IPO / pre-IPO inhabituels"
  },
  {
    "code": "CIB-SEN04",
    "famille": "CIB",
    "familleLabel": "Capital markets / CIB",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-UNLISTED",
    "niveau": 2,
    "titre": "Investissements non cotés / SPV"
  },
  {
    "code": "ABUS-SEN01",
    "famille": "ABUS",
    "familleLabel": "Abus de marché",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-PRENEWS",
    "niveau": 2,
    "titre": "Trades avant annonce (insider dealing)"
  },
  {
    "code": "ABUS-SEN02",
    "famille": "ABUS",
    "familleLabel": "Abus de marché",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-SPOOF",
    "niveau": 2,
    "titre": "Spoofing / layering (annulations)"
  },
  {
    "code": "ABUS-SEN03",
    "famille": "ABUS",
    "familleLabel": "Abus de marché",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-WASH",
    "niveau": 2,
    "titre": "Wash trades"
  },
  {
    "code": "ABUS-SEN04",
    "famille": "ABUS",
    "familleLabel": "Abus de marché",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-CONCENTR",
    "niveau": 2,
    "titre": "Concentration intraday (manipulation)"
  },
  {
    "code": "ABUS-SEN05",
    "famille": "ABUS",
    "familleLabel": "Abus de marché",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-MARKCL",
    "niveau": 2,
    "titre": "Marquage de clôture (marking the close)"
  },
  {
    "code": "ABUS-SEN06",
    "famille": "ABUS",
    "familleLabel": "Abus de marché",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-OFFMKT",
    "niveau": 2,
    "titre": "Transactions à prix hors marché"
  },
  {
    "code": "ABUS-SEN07",
    "famille": "ABUS",
    "familleLabel": "Abus de marché",
    "source": "biblio-cpsi",
    "ref": "R71-R76",
    "idMoteur": "SCN-PUMPDUMP",
    "niveau": 2,
    "titre": "Pump & dump (toutes classes d'actifs)"
  },
  {
    "code": "ISLAMIC-SEN01",
    "famille": "ISLAMIC",
    "familleLabel": "Conformité Shariah",
    "source": "moteur",
    "ref": "R207",
    "idMoteur": "R207",
    "niveau": 2,
    "titre": "Client islamique payant un secteur haram"
  },
  {
    "code": "ISLAMIC-SEN02",
    "famille": "ISLAMIC",
    "familleLabel": "Conformité Shariah",
    "source": "moteur",
    "ref": "R208",
    "idMoteur": "R208",
    "niveau": 2,
    "titre": "Riba : revenu d'intérêt d'une banque conventionnelle"
  },
  {
    "code": "ISLAMIC-SEN03",
    "famille": "ISLAMIC",
    "familleLabel": "Conformité Shariah",
    "source": "moteur",
    "ref": "R209",
    "idMoteur": "R209",
    "niveau": 1,
    "titre": "Maysir : spéculation → BLOCAGE automatique (seul blocage auto du bloc)"
  },
  {
    "code": "ISLAMIC-SEN04",
    "famille": "ISLAMIC",
    "familleLabel": "Conformité Shariah",
    "source": "moteur",
    "ref": "R210",
    "idMoteur": "R210",
    "niveau": 2,
    "titre": "Gharar : contrat à incertitude excessive"
  },
  {
    "code": "ISLAMIC-SEN05",
    "famille": "ISLAMIC",
    "familleLabel": "Conformité Shariah",
    "source": "moteur",
    "ref": "R211",
    "idMoteur": "R211",
    "niveau": 2,
    "titre": "Zakat annuelle : 2.5% du patrimoine au-delà du nisab"
  },
  {
    "code": "ISLAMIC-SEN06",
    "famille": "ISLAMIC",
    "familleLabel": "Conformité Shariah",
    "source": "moteur",
    "ref": "R212",
    "idMoteur": "R212",
    "niveau": 2,
    "titre": "Sukuk : instrument non certifié Shariah"
  },
  {
    "code": "ISLAMIC-SEN07",
    "famille": "ISLAMIC",
    "familleLabel": "Conformité Shariah",
    "source": "moteur",
    "ref": "R213",
    "idMoteur": "R213",
    "niveau": 2,
    "titre": "Contrepartie haram : fournisseur au cœur de métier illicite"
  },
  {
    "code": "ISLAMIC-SEN08",
    "famille": "ISLAMIC",
    "familleLabel": "Conformité Shariah",
    "source": "moteur",
    "ref": "R214",
    "idMoteur": "R214",
    "niveau": 2,
    "titre": "Qard ul Hasan : prêt sans intérêt, principal seul"
  },
  {
    "code": "ISLAMIC-SEN09",
    "famille": "ISLAMIC",
    "familleLabel": "Conformité Shariah",
    "source": "moteur",
    "ref": "R215",
    "idMoteur": "R215",
    "niveau": 2,
    "titre": "Mudaraba : distribution trimestrielle du profit selon le partage"
  },
  {
    "code": "ISLAMIC-SEN10",
    "famille": "ISLAMIC",
    "familleLabel": "Conformité Shariah",
    "source": "moteur",
    "ref": "R216",
    "idMoteur": "R216",
    "niveau": 2,
    "titre": "Entité islamique caritative sous sanction → PAS d'auto-blocage, revue humaine"
  },
  {
    "code": "ISLAMIC-SEN11",
    "famille": "ISLAMIC",
    "familleLabel": "Conformité Shariah",
    "source": "moteur",
    "ref": "R217",
    "idMoteur": "R217",
    "niveau": 2,
    "titre": "Audit Shariah annuel : taux de conformité du portefeuille islamique"
  },
  {
    "code": "ISLAMIC-SEN12",
    "famille": "ISLAMIC",
    "familleLabel": "Conformité Shariah",
    "source": "moteur",
    "ref": "R218",
    "idMoteur": "R218",
    "niveau": 2,
    "titre": "Waqf : retrait sur le revenu SEUL, principal immuable"
  },
  {
    "code": "ISLAMIC-SEN13",
    "famille": "ISLAMIC",
    "familleLabel": "Conformité Shariah",
    "source": "moteur",
    "ref": "R219",
    "idMoteur": "R219",
    "niveau": 2,
    "titre": "Takaful : prime mutualisée (pool, pas assureur)"
  },
  {
    "code": "ISLAMIC-SEN14",
    "famille": "ISLAMIC",
    "familleLabel": "Conformité Shariah",
    "source": "moteur",
    "ref": "R220",
    "idMoteur": "R220",
    "niveau": 2,
    "titre": "Sukuk : alerte de maturité + options de refinancement"
  },
  {
    "code": "ISLAMIC-SEN15",
    "famille": "ISLAMIC",
    "familleLabel": "Conformité Shariah",
    "source": "moteur",
    "ref": "R221",
    "idMoteur": "R221",
    "niveau": 2,
    "titre": "Fonds ESG sans certification islamique"
  }
];
