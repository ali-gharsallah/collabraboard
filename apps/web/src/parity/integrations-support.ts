// Source : docs/reference/olive-demo.html 14473–14537 — porté verbatim.
// Data Integration Layer : systèmes cœur, objets canoniques, niveaux/statuts de mapping, migration.
import { T } from "./tokens";

export const CORE_SYSTEMS: any[] = [
  { id: "AVALOQ", name: "Avaloq", vendor: "Avaloq (Zürich)", color: T.blue, status: "CONNECTED", version: "Avaloq Core Suite 9.2", fieldsMapped: 142, fieldsTotal: 158, lastSync: "il y a 4 min" },
  { id: "OLYMPIC", name: "Olympic Banking System", vendor: "ERI Bancaire (Genève)", color: T.gold, status: "CONNECTED", version: "Olympic 20.5", fieldsMapped: 97, fieldsTotal: 120, lastSync: "il y a 12 min" },
  { id: "TEMENOS", name: "Temenos Transact", vendor: "Temenos (Genève)", color: T.olive700, status: "PARTIAL", version: "Transact R23", fieldsMapped: 61, fieldsTotal: 135, lastSync: "il y a 2h" },
];
export const CANONICAL_OBJECTS: any[] = [
  { id: "Client", label: "Client", desc: "Personne physique ou morale — golden record", icon: "◑" },
  { id: "Relationship", label: "Relationship", desc: "UBO, signataire, mandataire, trustee…", icon: "☺" },
  { id: "Account", label: "Account", desc: "Compte bancaire — cycle de vie, statut", icon: "▤" },
  { id: "Portfolio", label: "Portfolio", desc: "Positions, exposition, valorisation", icon: "▦" },
  { id: "KycProfile", label: "KYC Profile", desc: "Sections, statut, workflow, profil de risque", icon: "◎" },
  { id: "RiskProfile", label: "Risk Profile", desc: "Score, classification, facteurs de risque", icon: "▲" },
  { id: "Event", label: "Event", desc: "COC, onboarding, revue, transaction", icon: "⇆" },
];
export const TARGET_APPS: any[] = [
  { id: "kyc", label: "KYC / CLM", icon: "◎" },
  { id: "aml", label: "AML / Screening", icon: "◬" },
  { id: "pms", label: "Portfolio (PMS)", icon: "▦" },
  { id: "risk", label: "Risk & Reporting", icon: "▲" },
];
export const MAP_LEVELS: any = {
  Structural: { color: T.blue, desc: "Correspondance de structure : champ source → champ canonique" },
  Semantic: { color: T.violet || T.olive700, desc: "Correspondance de concept : les systèmes ne découpent pas la réalité pareil (UBO vs ayant droit vs beneficial owner)" },
  Contextual: { color: T.amber, desc: "Interprétation propre à la banque : échelles de risque, devises de référence, seuils réglementaires locaux" },
};
export const STATUS_STYLE: any = {
  MAPPED: [T.green, T.greenSoft, "Mappé"],
  PARTIAL: [T.amber, T.amberSoft, "Partiel"],
  UNMAPPED: [T.red, T.redSoft, "Non mappé"],
};
export const FIELD_MAPPINGS: any = {
  AVALOQ: [
    { canonical: "Client.clientType", source: "party.partyType", level: "Structural", note: "Mapping direct — types individual / legal_entity alignés", status: "MAPPED" },
    { canonical: "Client.riskLevel", source: "party.riskClass (échelle 1–5)", level: "Contextual", note: "Échelle Avaloq 1–5 ≠ échelle O-Live LOW/MEDIUM/HIGH/CRITICAL — table de correspondance ajustable par banque", status: "MAPPED" },
    { canonical: "Relationship.role=UBO", source: "party.beneficialOwner", level: "Semantic", note: "Avaloq distingue beneficial owner de controlling person — O-Live les unifie sous UBO avec un sous-type", status: "MAPPED" },
    { canonical: "KycProfile.status", source: "party.kycStatus (enum interne, 7 valeurs)", level: "Structural", note: "7 statuts Avaloq → 6 statuts O-Live — mapping non bijectif, 1 valeur nécessite une règle métier", status: "PARTIAL" },
    { canonical: "Account.openingDate", source: "account.valueDate", level: "Structural", note: "", status: "MAPPED" },
    { canonical: "Event.type=COC", source: "(aucun équivalent direct)", level: "Semantic", note: "Avaloq n'a pas de concept natif de Change of Circumstances — reconstruit depuis le journal d'audit party", status: "UNMAPPED" },
  ],
  OLYMPIC: [
    { canonical: "Client.clientType", source: "customer.legalForm", level: "Structural", note: "", status: "MAPPED" },
    { canonical: "Relationship.role=UBO", source: "customer.economicBeneficiary", level: "Semantic", note: "Concept proche mais Olympic ne distingue pas UBO direct/indirect — O-Live enrichit via le graphe de contrôle", status: "MAPPED" },
    { canonical: "RiskProfile.score", source: "customer.riskIndicator (échelle 0–10)", level: "Contextual", note: "Échelle 0–10 Olympic → 0–100 O-Live — facteur direct mais pondération des composantes diffère", status: "MAPPED" },
    { canonical: "KycProfile.workflow", source: "(champ texte libre, non structuré)", level: "Semantic", note: "Pas de workflow typé natif — SDD/CDD/EDD déduit par règles métier appliquées au profil", status: "PARTIAL" },
    { canonical: "Portfolio.positions", source: "mandate.holdings", level: "Structural", note: "", status: "MAPPED" },
    { canonical: "Event.type=AccountReview", source: "(aucun équivalent direct)", level: "Semantic", note: "Reconstruit depuis les tâches de révision périodique du module compliance Olympic", status: "UNMAPPED" },
  ],
  TEMENOS: [
    { canonical: "Client.clientType", source: "CUSTOMER.CUSTOMER.TYPE", level: "Structural", note: "", status: "MAPPED" },
    { canonical: "Account.status", source: "ARRANGEMENT.STATUS", level: "Structural", note: "", status: "MAPPED" },
    { canonical: "RiskProfile.classification", source: "CUSTOMER.RISK.CATEGORY (texte libre)", level: "Contextual", note: "Champ configurable par instance Temenos — valeurs propres à chaque banque, mapping à refaire par déploiement", status: "PARTIAL" },
    { canonical: "Relationship.role", source: "RELATION.CUSTOMER (40+ codes internes)", level: "Semantic", note: "Table de rôles Temenos très granulaire — consolidée en 12 rôles canoniques O-Live", status: "MAPPED" },
    { canonical: "KycProfile.*", source: "(module Financial Crime Mitigation séparé)", level: "Structural", note: "Nécessite l'intégration du module FCM Temenos, pas seulement Transact core", status: "UNMAPPED" },
    { canonical: "Event.type=Transaction", source: "FT.COMMISSION / FUNDS.TRANSFER", level: "Structural", note: "", status: "MAPPED" },
  ],
};
export const MIGRATION_STATUS: any[] = [
  { system: "AVALOQ", entity: "KYC", total: 1240, migrated: 1198, needsReview: 31, failed: 11 },
  { system: "AVALOQ", entity: "Account Review", total: 3400, migrated: 3350, needsReview: 40, failed: 10 },
  { system: "OLYMPIC", entity: "KYC", total: 680, migrated: 512, needsReview: 140, failed: 28 },
  { system: "OLYMPIC", entity: "Account Review", total: 1890, migrated: 1400, needsReview: 410, failed: 80 },
  { system: "TEMENOS", entity: "KYC", total: 2100, migrated: 890, needsReview: 980, failed: 230 },
  { system: "TEMENOS", entity: "Account Review", total: 5200, migrated: 2100, needsReview: 2600, failed: 500 },
];
