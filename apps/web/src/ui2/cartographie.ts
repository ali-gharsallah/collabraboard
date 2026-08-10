/**
 * UI v2 — étape 9 : cartographie de migration des écrans v1 (README du handoff, tables
 * « Cartographie de migration », REPRISES VERBATIM). Le principe n°2 du handoff : « un écran
 * rarement utilisé n'a pas besoin d'une entrée de menu permanente ; il a besoin d'être
 * trouvable en deux frappes ». Chaque écran de la démo actuelle est donc CHERCHABLE dans la
 * palette ⌘K sous son ANCIEN nom et mène à sa destination v2 — y compris les quatre fusions
 * arbitrées par le PO le 10.08.2026 (dashboards → Ma journée/Rapports, bacs à sable → onglet
 * Simulation du Paramétrage, capacité unique, modules verticaux → bloc Métiers licencié R320).
 */
export type EcranMigre = { id: string; libelle: string; detail: string };

export const ECRANS_MIGRES: EcranMigre[] = [
  // ── Bloc « Mon espace » ──
  { id: "journee", libelle: "Accueil", detail: "fusionné dans Ma journée" },
  { id: "journee", libelle: "Command Center", detail: "fusionné dans Ma journée" },
  { id: "journee", libelle: "Dashboard central", detail: "fusionné dans Ma journée (bandeau KPI)" },
  { id: "journee", libelle: "Tâches", detail: "onglet de Ma journée" },
  { id: "journee", libelle: "Prochaines actions", detail: "colonne latérale de Ma journée" },
  { id: "rapports", libelle: "Capacité de l'équipe (live)", detail: "encart Ma journée + Pilotage (capacité UNIQUE)" },
  { id: "rapports", libelle: "Capacité équipe", detail: "doublon fusionné — même destination" },
  { id: "clients", libelle: "Clients", detail: "→ Mes clients" },
  { id: "clients", libelle: "Personnes", detail: "→ Mes clients, onglet Personnes" },
  // ── Bloc « Parcours client » ──
  { id: "entree", libelle: "Prospect à contacter", detail: "→ Entrée en relation, pipeline" },
  { id: "entree", libelle: "Prospect en contact", detail: "→ Entrée en relation, pipeline" },
  { id: "entree", libelle: "Prospect à onboarder", detail: "→ Entrée en relation, pipeline" },
  { id: "entree", libelle: "Pré-prospection", detail: "→ Entrée en relation, onglet Sourcing" },
  { id: "entree", libelle: "Onboarding", detail: "→ Entrée en relation, dossier (écran 04)" },
  { id: "kyc", libelle: "KYC", detail: "→ Connaissance client, dossier (écran 02)" },
  { id: "kyc", libelle: "Corroboration KYC", detail: "onglet du dossier KYC" },
  { id: "kyc", libelle: "Change of Circumstances", detail: "→ Connaissance client (écran 07)" },
  { id: "surveillance", libelle: "Screening", detail: "→ Surveillance (écran 05)" },
  { id: "surveillance", libelle: "Compliance Center", detail: "fusionné dans Surveillance, vue d'ensemble" },
  { id: "surveillance", libelle: "AML Investigation", detail: "→ Surveillance (écran 03)" },
  { id: "param", libelle: "Règles AML", detail: "→ Paramétrage (écran 10, bac à sable intégré)" },
  { id: "surveillance", libelle: "Investigation financière", detail: "onglet de l'écran 03" },
  { id: "surveillance", libelle: "Transactions Risk Monitoring", detail: "→ Surveillance, onglet Transactions" },
  { id: "surveillance", libelle: "Transferts & ordres", detail: "→ Surveillance, onglet Transactions" },
  { id: "surveillance", libelle: "Exécution & Settlement", detail: "→ Surveillance, onglet Transactions" },
  { id: "surveillance", libelle: "Analyseur SWIFT/SEPA", detail: "outil contextuel depuis une transaction" },
  { id: "rapports", libelle: "Registre LBA", detail: "→ Rapports, onglet Registre" },
  { id: "revue", libelle: "Account Review", detail: "→ Revue & sortie (écran 06)" },
  { id: "revue", libelle: "Offboarding", detail: "→ Revue & sortie, onglet Sorties" },
  { id: "kyc", libelle: "Cross-Border", detail: "onglet du dossier KYC" },
  { id: "entree", libelle: "Business Trip", detail: "→ Entrée en relation, onglet Déplacements" },
  { id: "clients", libelle: "CRM Banque", detail: "fusionné dans la fiche client" },
  { id: "clients", libelle: "Relation — timeline & entretiens", detail: "onglet Chronologie de la fiche client" },
  { id: "clients", libelle: "Contact Reports", detail: "onglet Chronologie de la fiche client" },
  { id: "clients", libelle: "Profilage CPSI", detail: "encart « profil » de la fiche client" },
  // ── Bloc « Pilotage » ──
  { id: "rapports", libelle: "Dashboard Exécutif", detail: "→ Rapports (écran 08)" },
  { id: "rapports", libelle: "Reporting réglementaire", detail: "→ Rapports, onglet Réglementaire" },
  { id: "rapports", libelle: "Rapports conformité", detail: "→ Rapports, onglet Conformité" },
  { id: "rapports", libelle: "BI — Reporting sur mesure", detail: "→ Rapports, onglet Sur mesure" },
  { id: "rapports", libelle: "Veille réglementaire", detail: "→ Rapports, onglet Veille" },
  { id: "rapports", libelle: "Formations & habilitations", detail: "→ Rapports, onglet Habilitations" },
  { id: "rapports", libelle: "Audit FINMA — rejeu & preuves", detail: "→ Rapports (écran 09, rôle Audit)" },
  { id: "rapports", libelle: "Audit IT — intégrité", detail: "écran 09, onglet Intégrité" },
  { id: "rapports", libelle: "Surveillance ES", detail: "écran 09, onglet Supervision" },
  { id: "param", libelle: "Sections — KYC / AR / Grouped AR", detail: "→ Paramétrage, section Questionnaires" },
  { id: "param", libelle: "Champs & droits par section", detail: "→ Paramétrage, section Questionnaires" },
  { id: "param", libelle: "CPSI — règles / guide", detail: "→ Paramétrage, section Règles" },
  { id: "param", libelle: "CoC — types & sensibilité", detail: "→ Paramétrage, section Règles" },
  { id: "param", libelle: "Scénarios AML & groupes", detail: "→ Paramétrage, section Règles" },
  { id: "param", libelle: "Workflow Designer", detail: "→ Paramétrage, section Workflow" },
  { id: "param", libelle: "Bacs à sable", detail: "supprimés comme écrans — onglet Simulation du Paramétrage" },
  { id: "param", libelle: "Menus par rôle · IAM · SSO", detail: "→ Paramétrage, section Accès" },
  { id: "param", libelle: "Config & Go-live", detail: "→ Paramétrage, section Banque (banque.golive, R127/R128)" },
  { id: "param", libelle: "Recette client (BAT)", detail: "→ Paramétrage, section Banque (banque.bat, R333)" },
  { id: "param", libelle: "Structures juridiques & init tenant", detail: "→ Paramétrage, section Banque (R288, R-Q, R320)" },
  { id: "param", libelle: "Administration", detail: "→ Paramétrage, section Général" },
  { id: "param", libelle: "Administration Éditeur", detail: "espace séparé, rôle EDITOR uniquement" },
  { id: "param", libelle: "Intégrations / API & doc", detail: "→ Paramétrage, section Général" },
  { id: "kyc", libelle: "GED — Documents", detail: "accessible depuis chaque dossier + recherche ⌘K" },
  { id: "param", libelle: "Olivia (AI Core) / Gouvernance O", detail: "→ Paramétrage, section IA" },
];
