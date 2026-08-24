// Source : docs/reference/olive-demo.html — LICENSED_MODULES_CATALOG (21742), ACTIVE_LICENSE
// (27815), DEMO_LICENSES (27821), ENVIRONMENTS (27825), licenseDaysRemaining/demoDaysRemaining/
// toggleLicenseModule (27841-27855), ETL_ENTITY_SCHEMA (27857), SOURCE_FORMATS (27883),
// MIGRATION_PACKAGES (27884), addMigrationRun/setMigrationStrategy (27892-27900). Porté verbatim.
import { pushParamAudit } from "./param-audit-support";
import { wfEmit } from "./admin-support";

export const LICENSED_MODULES_CATALOG: any[] = [
  { id: "KYC", label: "KYC" },
  { id: "ONBOARDING", label: "Onboarding" },
  { id: "REVIEW", label: "Account Review" },
  { id: "GROUP_REVIEW", label: "Group Account Review" },
  { id: "TRIP", label: "Business Trip" },
  { id: "AML", label: "AML" },
  { id: "DOCS", label: "Document Management" },
  { id: "CROSSBORDER", label: "Cross Border" },
  { id: "REPORTING", label: "Reporting" },
  { id: "API", label: "API Gateway" },
  { id: "EXECDASH", label: "Dashboard Exécutif" },
  { id: "COPILOT", label: "AI Compliance Copilot" },
];

export const ACTIVE_LICENSE: any = {
  customer: "Banque Olive Suisse", tier: "Enterprise",
  modules: ["KYC", "ONBOARDING", "REVIEW", "GROUP_REVIEW", "TRIP", "AML", "DOCS", "REPORTING", "API", "EXECDASH", "COPILOT"],
  users: 500, valid_from: "2026-01-01", valid_until: "2027-06-30", environment: "PRODUCTION",
  signature: "3F2A9E7B1C4D8A61F0E29B7C4D3A1F8E56C0B2D9", verified: true,
};
export const DEMO_LICENSES: any[] = [
  { id: "POC-RIV", customer: "Riviera Wealth (essai)", modules: ["KYC", "REVIEW", "REPORTING"], start: "2026-06-15", end: "2026-09-13", environment: "DEMO", status: "ACTIVE" },
  { id: "POC-HEL", customer: "Helvetia Private Bank (démo)", modules: ["KYC", "ONBOARDING", "REVIEW", "AML"], start: "2026-05-01", end: "2026-07-30", environment: "DEMO", status: "ACTIVE" },
];
export const ENVIRONMENTS: any[] = [
  { id: "PROD-BOS", customer: "Banque Olive Suisse", env: "PRODUCTION", version: "v0.2.0", lastAccess: "aujourd'hui 09:14", status: "ACTIVE" },
  { id: "TEST-BOS", customer: "Banque Olive Suisse", env: "TEST", version: "v0.2.1-rc1", lastAccess: "hier 17:40", status: "ACTIVE" },
  { id: "DEV-BOS", customer: "Banque Olive Suisse", env: "DEV", version: "v0.3.0-dev", lastAccess: "il y a 3j", status: "ACTIVE" },
  { id: "DEMO-RIV", customer: "Riviera Wealth (essai)", env: "DEMO", version: "v0.2.0", lastAccess: "il y a 2j", status: "ACTIVE" },
  { id: "DEMO-HEL", customer: "Helvetia Private Bank (démo)", env: "DEMO", version: "v0.1.9", lastAccess: "il y a 12j", status: "SUSPENDUE" },
];
function todayStr() { return "2026-07-10"; }
export function licenseDaysRemaining(lic?: any) {
  const end = new Date((lic ? lic.valid_until : ACTIVE_LICENSE.valid_until) + "T00:00:00") as any;
  const now = new Date(2026, 6, 10) as any;
  return Math.ceil((end - now) / 86400000);
}
export function demoDaysRemaining(d: any) { const end = new Date(d.end + "T00:00:00") as any; const now = new Date(2026, 6, 10) as any; return Math.ceil((end - now) / 86400000); }
export function toggleLicenseModule(moduleKey: string) {
  const i = ACTIVE_LICENSE.modules.indexOf(moduleKey);
  if (i >= 0)
    ACTIVE_LICENSE.modules.splice(i, 1);
  else
    ACTIVE_LICENSE.modules.push(moduleKey);
  pushParamAudit("Éditeur Olive", "Licence " + ACTIVE_LICENSE.customer + " — module " + moduleKey + " : " + (ACTIVE_LICENSE.modules.indexOf(moduleKey) >= 0 ? "activé" : "désactivé"));
  wfEmit("PARAM_CHANGED", null, { subjectId: "LICENSE_MODULE/" + moduleKey, actor: "Éditeur Olive", payload: { active: ACTIVE_LICENSE.modules.indexOf(moduleKey) >= 0 } });
}
// -- ETL Designer & Migration Management (éditeur) --
export const ETL_ENTITY_SCHEMA: any[] = [
  { entity: "Client", fields: [
    { name: "client_id", type: "string", required: true, example: "CLI-00001" },
    { name: "name", type: "string", required: true, example: "Tanaka SA" },
    { name: "country_code", type: "ISO 3166-1 alpha-2", required: true, example: "CH" },
    { name: "aum_chf", type: "decimal", required: true, example: "3700000.00" },
    { name: "risk_score", type: "integer 0-100", required: false, example: "42" },
    { name: "ubo_name", type: "string", required: false, example: "Nils Larsen" },
  ] },
  { entity: "KYC", fields: [
    { name: "kyc_code", type: "string", required: true, example: "KYC-2026-CH-0044-R2" },
    { name: "revision", type: "integer", required: true, example: "2" },
    { name: "workflow", type: "enum SDD|CDD|EDD", required: true, example: "EDD" },
    { name: "status", type: "enum", required: true, example: "APPROVED" },
  ] },
  { entity: "Compte", fields: [
    { name: "account_id", type: "string", required: true, example: "ACC-000123" },
    { name: "iban", type: "string", required: false, example: "CH93 0076 2011 6238 5295 7" },
    { name: "currency", type: "ISO 4217", required: true, example: "CHF" },
  ] },
  { entity: "Transaction", fields: [
    { name: "tx_id", type: "string", required: true, example: "TX-98213" },
    { name: "amount", type: "decimal", required: true, example: "120000.00" },
    { name: "date", type: "ISO 8601", required: true, example: "2026-06-14" },
  ] },
];
export const SOURCE_FORMATS = ["CSV", "Excel", "XML", "JSON", "API temps réel", "Base de données"];
export const MIGRATION_PACKAGES: any[] = [
  { id: "MIG-BOS", tenant: "Banque Olive Suisse", format: "API temps réel", strategy: "RECURRING", frequency: "Quotidienne",
    files: [{ name: "Customer Mapping.xlsx", status: "OK" }, { name: "Account Mapping.xlsx", status: "OK" }, { name: "Document Mapping.xlsx", status: "OK" }, { name: "Validation Rules", status: "OK" }, { name: "Migration Scripts", status: "OK" }],
    runs: [{ id: "RUN-4471", date: "2026-07-10 02:00", status: "TERMINÉE", rows: 18420, errors: 3 }, { id: "RUN-4402", date: "2026-07-09 02:00", status: "TERMINÉE", rows: 18310, errors: 0 }] },
  { id: "MIG-RIV", tenant: "Riviera Wealth (essai)", format: "CSV", strategy: "ONE_SHOT", frequency: null,
    files: [{ name: "Customer Mapping.xlsx", status: "OK" }, { name: "Account Mapping.xlsx", status: "MANQUANT" }, { name: "Document Mapping.xlsx", status: "MANQUANT" }, { name: "Validation Rules", status: "OK" }, { name: "Migration Scripts", status: "EN ATTENTE" }],
    runs: [{ id: "RUN-1001", date: "2026-06-15 10:00", status: "ÉCHEC", rows: 0, errors: 1 }] },
];
export function addMigrationRun(pkg: any, status: string, rows: number, errors: number) {
  pkg.runs.unshift({ id: "RUN-" + String(Date.now()).slice(-4), date: todayStr() + " " + (new Date()).toISOString().slice(11, 16), status: status, rows: rows, errors: errors });
  pushParamAudit("Éditeur Olive", "Migration " + pkg.tenant + " — run " + status + " (" + rows + " lignes, " + errors + " erreur(s))");
  wfEmit("PARAM_CHANGED", null, { subjectId: "MIGRATION_RUN/" + pkg.id, actor: "Éditeur Olive", payload: { status: status, rows: rows, errors: errors } });
}
export function setMigrationStrategy(pkg: any, strategy: string, frequency?: string) {
  pkg.strategy = strategy;
  pkg.frequency = strategy === "RECURRING" ? (frequency || "Quotidienne") : null;
  pushParamAudit("Éditeur Olive", "Migration " + pkg.tenant + " — stratégie : " + strategy + (pkg.frequency ? (" / " + pkg.frequency) : ""));
}
