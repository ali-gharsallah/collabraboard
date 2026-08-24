import React, { useState } from "react";
import { T } from "./tokens";
import { CPSI_SCENARIOS, CPSI_GROUPES } from "./cpsi-data-support";
import {
  cpsiSetUser, cpsiUserNom, cpsiDecrireGroupes, cpsiAlertesParScenario, cpsiSignaux,
  cpsiEvaluerScenario, cpsiCreerGroupe, cpsiMembres, cpsiPopulation, cpsiSimulerScenarios,
  CPSI_FAM_GROUPES, CPSI_FAM_SCEN, CPSI_CHAMPS, CPSI_OP_LIST, CPSI_OPLIB,
} from "./cpsi-engine-support";
import { pushParamAudit } from "./param-audit-support";

// Source : docs/reference/olive-demo.html 26581-26843 (CpsiGroupesScreen) + 27773-27901 (CpsiSandboxAml).
// Porté verbatim en React.createElement (le source est lui-même en React.createElement).
// Adaptation ESM : CPSI_USER = user → cpsiSetUser(user).

function CpsiSandboxAml() {
const [fac, setFac] = useState(1);
const sim = cpsiSimulerScenarios(fac);
const SEVC = { HIGH: T.red, MEDIUM: T.amber };
return React.createElement("div", { style: { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, marginBottom: 14 } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.olive900 } }, "Bac \u00E0 sable AML \u2014 simulation de la biblioth\u00E8que (dry-run)"),
React.createElement("span", { style: { fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: T.olive600 + "15", color: T.olive700 } }, "aucune case cr\u00E9\u00E9e")),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, margin: "6px 0 12px" } }, "Projette le volume d'alertes de TOUS les sc\u00E9narios sur la population, sans rien cr\u00E9er ni muter (R70). Le curseur de sensibilit\u00E9 multiplie tous les seuils : plus bas = plus sensible = plus d'alertes."),
React.createElement("div", { style: { display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 12 } },
React.createElement("label", { style: { fontSize: 11.5, color: T.inkMid, display: "flex", alignItems: "center", gap: 8 } },
"Sensibilit\u00E9 (\u00D7 seuils)",
React.createElement("input", { type: "range", min: "0.5", max: "1.5", step: "0.05", value: fac, onChange: e => setFac(parseFloat(e.target.value)), style: { width: 180 } }),
React.createElement("b", { style: { fontFamily: "monospace", color: fac < 1 ? T.red : (fac > 1 ? T.green : T.ink) } },
"\u00D7",
fac.toFixed(2))),
React.createElement("span", { style: { fontSize: 10.5, color: T.inkSoft } }, "Recalcul en direct au d\u00E9placement du curseur.")),
sim && React.createElement(React.Fragment, null,
React.createElement("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 } },
React.createElement("div", { style: { padding: "8px 16px", borderRadius: 10, background: T.olive600 + "12", border: `1px solid ${T.olive600}30` } },
React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: T.olive700, fontFamily: "monospace" } }, sim.total),
React.createElement("div", { style: { fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase" } }, "alertes projet\u00E9es")),
["HIGH", "MEDIUM"].map(sv => React.createElement("div", { key: sv, style: { padding: "8px 16px", borderRadius: 10, background: SEVC[sv] + "12", border: `1px solid ${SEVC[sv]}30` } },
React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: SEVC[sv], fontFamily: "monospace" } }, sim.parSev[sv]),
React.createElement("div", { style: { fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase" } }, sv)))),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } },
React.createElement("div", null,
React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: T.inkMid, marginBottom: 6, textTransform: "uppercase" } }, "Par domaine"),
CPSI_FAM_SCEN.map(d => React.createElement("div", { key: d, style: { display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "4px 0", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("span", { style: { color: T.inkMid } }, d),
React.createElement("b", { style: { fontFamily: "monospace", color: T.olive700 } }, sim.parDom[d] || 0)))),
React.createElement("div", null,
React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: T.inkMid, marginBottom: 6, textTransform: "uppercase" } }, "Top sc\u00E9narios (volume)"),
sim.parScen.slice(0, 8).map(s => React.createElement("div", { key: s.id, title: s.fam, style: { display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "4px 0", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("span", { style: { color: T.inkMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 } }, s.label),
React.createElement("b", { style: { fontFamily: "monospace", color: s.n > 0 ? T.red : T.inkSoft } }, s.n)))))));
}
const NAV_MODULE_MAP = {
kyc: "KYC", prospect_onboard: "ONBOARDING", prospect_test: "ONBOARDING", prospect_contact: "ONBOARDING", review: "REVIEW", offboarding: "REVIEW",
trip: "TRIP", aml: "AML", compliance: "AML", registre: "AML", formations: "AML", crossborder: "KYC", transferts: "AML", crm: "KYC", reporting: "REPORTING", integrations: "API", execdash: "EXECDASH",
};
// -- Licence active (simule le contenu déchiffré d'olive_license.lic, signé et vérifié localement) --
const ACTIVE_LICENSE = {
customer: "Banque Olive Suisse", tier: "Enterprise",
modules: ["KYC", "ONBOARDING", "REVIEW", "GROUP_REVIEW", "TRIP", "AML", "DOCS", "REPORTING", "API", "EXECDASH", "COPILOT"],
users: 500, valid_from: "2026-01-01", valid_until: "2027-06-30", environment: "PRODUCTION",
signature: "3F2A9E7B1C4D8A61F0E29B7C4D3A1F8E56C0B2D9", verified: true,
};
const DEMO_LICENSES = [
{ id: "POC-RIV", customer: "Riviera Wealth (essai)", modules: ["KYC", "REVIEW", "REPORTING"], start: "2026-06-15", end: "2026-09-13", environment: "DEMO", status: "ACTIVE" },
{ id: "POC-HEL", customer: "Helvetia Private Bank (démo)", modules: ["KYC", "ONBOARDING", "REVIEW", "AML"], start: "2026-05-01", end: "2026-07-30", environment: "DEMO", status: "ACTIVE" },
];
const ENVIRONMENTS = [
{ id: "PROD-BOS", customer: "Banque Olive Suisse", env: "PRODUCTION", version: "v0.2.0", lastAccess: "aujourd'hui 09:14", status: "ACTIVE" },
{ id: "TEST-BOS", customer: "Banque Olive Suisse", env: "TEST", version: "v0.2.1-rc1", lastAccess: "hier 17:40", status: "ACTIVE" },
{ id: "DEV-BOS", customer: "Banque Olive Suisse", env: "DEV", version: "v0.3.0-dev", lastAccess: "il y a 3j", status: "ACTIVE" },
{ id: "DEMO-RIV", customer: "Riviera Wealth (essai)", env: "DEMO", version: "v0.2.0", lastAccess: "il y a 2j", status: "ACTIVE" },
{ id: "DEMO-HEL", customer: "Helvetia Private Bank (démo)", env: "DEMO", version: "v0.1.9", lastAccess: "il y a 12j", status: "SUSPENDUE" },
];
function todayStr() { return "2026-07-10"; }
function isModuleLicensed(moduleKey) {
if (!moduleKey)
return true;
if (ACTIVE_LICENSE.modules.indexOf(moduleKey) >= 0)
return true;
var today = todayStr();
return DEMO_LICENSES.some(function (d) { return d.status === "ACTIVE" && d.modules.indexOf(moduleKey) >= 0 && d.start <= today && today <= d.end; });
}
function licenseDaysRemaining(lic) {
var end = new Date((lic ? lic.valid_until : ACTIVE_LICENSE.valid_until) + "T00:00:00");
var now = new Date(2026, 6, 10);
return Math.ceil((end - now) / 86400000);
}
function demoDaysRemaining(d) { var end = new Date(d.end + "T00:00:00"); var now = new Date(2026, 6, 10); return Math.ceil((end - now) / 86400000); }
function toggleLicenseModule(moduleKey) {
var i = ACTIVE_LICENSE.modules.indexOf(moduleKey);
if (i >= 0)
ACTIVE_LICENSE.modules.splice(i, 1);
else
ACTIVE_LICENSE.modules.push(moduleKey);
pushParamAudit("Éditeur Olive", "Licence " + ACTIVE_LICENSE.customer + " — module " + moduleKey + " : " + (ACTIVE_LICENSE.modules.indexOf(moduleKey) >= 0 ? "activé" : "désactivé"));
wfEmit("PARAM_CHANGED", null, { subjectId: "LICENSE_MODULE/" + moduleKey, actor: "Éditeur Olive", payload: { active: ACTIVE_LICENSE.modules.indexOf(moduleKey) >= 0 } });
}
// -- ETL Designer & Migration Management (éditeur) --
const ETL_ENTITY_SCHEMA = [
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
const SOURCE_FORMATS = ["CSV", "Excel", "XML", "JSON", "API temps réel", "Base de données"];
const MIGRATION_PACKAGES = [
{ id: "MIG-BOS", tenant: "Banque Olive Suisse", format: "API temps réel", strategy: "RECURRING", frequency: "Quotidienne",
files: [{ name: "Customer Mapping.xlsx", status: "OK" }, { name: "Account Mapping.xlsx", status: "OK" }, { name: "Document Mapping.xlsx", status: "OK" }, { name: "Validation Rules", status: "OK" }, { name: "Migration Scripts", status: "OK" }],
runs: [{ id: "RUN-4471", date: "2026-07-10 02:00", status: "TERMINÉE", rows: 18420, errors: 3 }, { id: "RUN-4402", date: "2026-07-09 02:00", status: "TERMINÉE", rows: 18310, errors: 0 }] },
{ id: "MIG-RIV", tenant: "Riviera Wealth (essai)", format: "CSV", strategy: "ONE_SHOT", frequency: null,
files: [{ name: "Customer Mapping.xlsx", status: "OK" }, { name: "Account Mapping.xlsx", status: "MANQUANT" }, { name: "Document Mapping.xlsx", status: "MANQUANT" }, { name: "Validation Rules", status: "OK" }, { name: "Migration Scripts", status: "EN ATTENTE" }],
runs: [{ id: "RUN-1001", date: "2026-06-15 10:00", status: "ÉCHEC", rows: 0, errors: 1 }] },
];
function addMigrationRun(pkg, status, rows, errors) {
pkg.runs.unshift({ id: "RUN-" + String(Date.now()).slice(-4), date: todayStr() + " " + (new Date()).toISOString().slice(11, 16), status: status, rows: rows, errors: errors });
pushParamAudit("Éditeur Olive", "Migration " + pkg.tenant + " — run " + status + " (" + rows + " lignes, " + errors + " erreur(s))");
wfEmit("PARAM_CHANGED", null, { subjectId: "MIGRATION_RUN/" + pkg.id, actor: "Éditeur Olive", payload: { status: status, rows: rows, errors: errors } });
}
function setMigrationStrategy(pkg, strategy, frequency) {
pkg.strategy = strategy;
pkg.frequency = strategy === "RECURRING" ? (frequency || "Quotidienne") : null;
pushParamAudit("Éditeur Olive", "Migration " + pkg.tenant + " — stratégie : " + strategy + (pkg.frequency ? (" / " + pkg.frequency) : ""));
}

export function CpsiGroupesScreen({ user }: { user?: any }) {
cpsiSetUser(user);
const [, force] = useState(0);
const re = () => force(x => x + 1);
const [ed, setEd] = useState(false);
const [nl, setNl] = useState("");
const [nf, setNf] = useState("Combinés");
const [np, setNp] = useState(30);
const [nlog, setNlog] = useState("ET");
const [conds, setConds] = useState([{ champ: "secteur", op: "eq", val: "" }]);
const setCond = (i, k, v) => { const c = conds.slice(); c[i] = { ...c[i], [k]: v }; setConds(c); };
const groupes = cpsiDecrireGroupes();
const [famG, setFamG] = useState("Type d'entité");
const [famS, setFamS] = useState("Activité transactionnelle");
const scenariosFam = CPSI_SCENARIOS.filter(s => s.fam === famS);
const [scId, setScId] = useState(scenariosFam[0].id);
const [vueScen, setVueScen] = useState("ref");
const [scenDomTab, setScenDomTab] = useState("Tous");
const [tabSG, setTabSG] = useState("scen");
const REFSCEN = cpsiAlertesParScenario();
const SCORED = (typeof cpsiSignaux === "function") ? cpsiSignaux() : [];
const scoredA = SCORED.filter(function (s) { return s.statut === "ALERTE"; }).length;
const scoredNM = SCORED.filter(function (s) { return s.statut === "NEAR_MISS"; }).length;
const scoredAN = SCORED.filter(function (s) { return s.statut === "ANALYSE"; }).length;
const drillScen = (fam, id) => { setFamS(fam); setScId(id); setVueScen("dom"); };
const sc = CPSI_SCENARIOS.find(s => s.id === scId) || scenariosFam[0];
const rap = cpsiEvaluerScenario(sc);
const setSeuil = (gid, v) => {
const x = parseFloat(v);
if (isNaN(x))
return;
sc.groupes_seuils[gid] = x;
if (typeof pushParamAudit === "function")
pushParamAudit(cpsiUserNom(), "Scénario «" + sc.label + "» — seuil " + gid + " → " + x);
re();
};
const fmt = (v) => (typeof v === "number" && v >= 1000) ? (v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : (v / 1e3).toFixed(0) + "k") : v;
return React.createElement("div", { style: { maxWidth: 1160 } },
React.createElement("div", { style: { marginBottom: 14 } },
React.createElement("div", { style: { fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 } }, "Param\u00E9trage \u00B7 R\u00E8gles & moteur"),
React.createElement("div", { style: { fontSize: 21, fontWeight: 800, color: T.ink } }, "Sc\u00E9narios AML & groupes de population (R71-R74)"),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft } },
"Biblioth\u00E8que \u00E9tendue : ",
CPSI_GROUPES.length,
" groupes en ",
CPSI_FAM_GROUPES.length,
" familles, ",
CPSI_SCENARIOS.length,
" sc\u00E9narios sur ",
CPSI_FAM_SCEN.length,
" domaines. R\u00E8gles d'appartenance en clair, bar\u00E8me par groupe, seuils par groupe \u00E9ditables.")),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginTop: -4, marginBottom: 12, lineHeight: 1.5, padding: "8px 12px", background: T.cream, borderRadius: 9 } },
"Cha\u00EEne de qualification : ",
React.createElement("b", null,
REFSCEN.reduce(function (a, r) { return a + r.total; }, 0),
" franchissements"),
" bruts (une personne franchit le seuil d'un sc\u00E9nario pour son groupe) \u2192 d\u00E9dupliqu\u00E9s par (client, sc\u00E9nario) en ",
React.createElement("b", null,
SCORED.length,
" signaux"),
" scor\u00E9s (R81) \u2192 seuil de score X \u2192 ",
React.createElement("b", null,
scoredA,
" alertes"),
" \u00B7 ",
scoredNM,
" near-miss \u00B7 ",
scoredAN,
" analyses (R80). \u00AB Alerte \u00BB = signal franchissant X ; \u00AB franchissement \u00BB = hit brut de d\u00E9tection."),
React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 14 } }, [["scen", "◇ Scénarios AML"], ["grp", "⬡ Groupes de population"]].map(function (o) { return React.createElement("button", { key: o[0], onClick: () => setTabSG(o[0]), style: { padding: "8px 16px", borderRadius: 9, fontSize: 13, cursor: "pointer", fontWeight: tabSG === o[0] ? 700 : 500, border: `1px solid ${tabSG === o[0] ? T.olive600 : T.line}`, background: tabSG === o[0] ? T.oliveSoft : T.surface, color: tabSG === o[0] ? T.olive900 : T.inkMid } }, o[1]); })),
tabSG === "grp" && React.createElement("div", null,
React.createElement("div", { style: { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, marginBottom: 14 } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.olive900 } }, "Cr\u00E9er un groupe \u2014 \u00E9diteur de pr\u00E9dicats (R71/R74)"),
React.createElement("button", { onClick: () => setEd(!ed), style: { marginLeft: "auto", padding: "5px 12px", borderRadius: 8, border: `1px solid ${ed ? T.olive600 : T.line}`, background: ed ? T.oliveSoft : "#fff", color: ed ? T.olive700 : T.inkMid, fontSize: 11.5, fontWeight: 700, cursor: "pointer" } }, ed ? "Fermer" : "＋ Nouveau groupe")),
ed && React.createElement("div", { style: { marginTop: 12 } },
React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 } },
React.createElement("input", { value: nl, onChange: e => setNl(e.target.value), placeholder: "Nom du groupe (obligatoire)", style: { padding: "6px 9px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 11.5, minWidth: 220 } }),
React.createElement("select", { value: nf, onChange: e => setNf(e.target.value), style: { padding: "6px 9px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 11.5, background: "#fff" } }, CPSI_FAM_GROUPES.map(f => React.createElement("option", { key: f, value: f }, f))),
React.createElement("label", { style: { fontSize: 11, color: T.inkSoft, display: "flex", alignItems: "center", gap: 5 } },
"Priorit\u00E9 ",
React.createElement("input", { type: "number", value: np, onChange: e => setNp(parseInt(e.target.value) || 30), style: { width: 60, padding: "6px 8px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 11.5 } })),
React.createElement("div", { style: { display: "inline-flex", gap: 4 } }, ["ET", "OU"].map(l => React.createElement("button", { key: l, onClick: () => setNlog(l), style: { padding: "6px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: "pointer", border: `1px solid ${nlog === l ? T.olive600 : T.line}`, background: nlog === l ? T.oliveSoft : "#fff", color: nlog === l ? T.olive700 : T.inkSoft } }, l)))),
conds.map((c, i) => React.createElement("div", { key: i, style: { display: "flex", gap: 6, alignItems: "center", marginBottom: 6 } },
React.createElement("select", { value: c.champ, onChange: e => setCond(i, "champ", e.target.value), style: { padding: "5px 8px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11, background: "#fff" } }, CPSI_CHAMPS.map(x => React.createElement("option", { key: x, value: x }, x))),
React.createElement("select", { value: c.op, onChange: e => setCond(i, "op", e.target.value), style: { padding: "5px 8px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11, background: "#fff" } }, CPSI_OP_LIST.map(x => React.createElement("option", { key: x, value: x }, CPSI_OPLIB[x]))),
React.createElement("input", { value: c.val, onChange: e => setCond(i, "val", e.target.value), placeholder: "valeur (ou a,b,c pour \u2208)", style: { padding: "5px 8px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11, flex: 1, minWidth: 150 } }),
conds.length > 1 && React.createElement("button", { onClick: () => setConds(conds.filter((_, j) => j !== i)), style: { padding: "4px 9px", borderRadius: 7, border: `1px solid ${T.red}40`, background: "#fff", color: T.red, fontSize: 11, cursor: "pointer" } }, "\u2715"))),
React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
React.createElement("button", { onClick: () => setConds(conds.concat([{ champ: "score", op: "gte", val: "" }])), style: { padding: "5px 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", fontSize: 11, cursor: "pointer", color: T.inkMid } }, "\uFF0B Ajouter une condition"),
React.createElement("button", { disabled: !nl.trim() || conds.some(c => c.val === ""), onClick: () => {
const norm = (op, v) => { if (op === "in" || op === "nin")
return v.split(",").map(s => s.trim()); if (v === "true")
return true; if (v === "false")
return false; const n = parseFloat(v); return (!isNaN(n) && ("" + n) === v.trim()) ? n : v; };
const g = { id: "G-USR-" + (CPSI_GROUPES.length + 1), fam: nf, label: nl.trim(), priorite: np, predicat: { logique: nlog, conditions: conds.map(c => ({ champ: c.champ, op: c.op, val: norm(c.op, c.val) })) } };
cpsiCreerGroupe(g);
setNl("");
setConds([{ champ: "secteur", op: "eq", val: "" }]);
setFamG(nf);
setEd(false);
re();
}, style: { padding: "5px 14px", borderRadius: 8, border: "none", background: (nl.trim() && !conds.some(c => c.val === "")) ? T.olive600 : T.line, color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: (nl.trim() && !conds.some(c => c.val === "")) ? "pointer" : "not-allowed" } }, "Cr\u00E9er le groupe"),
React.createElement("span", { style: { fontSize: 10.5, color: T.inkSoft, alignSelf: "center" } }, "Le groupe cr\u00E9\u00E9 est trac\u00E9 (R74), disponible imm\u00E9diatement pour les sc\u00E9narios.")))),
React.createElement("div", { style: { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, marginBottom: 14 } },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.olive900, marginBottom: 8 } }, "Groupes de population \u2014 en clair (R74)"),
React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 } }, CPSI_FAM_GROUPES.map(f => React.createElement("button", { key: f, onClick: () => setFamG(f), style: { padding: "5px 11px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontWeight: 700,
border: `1px solid ${famG === f ? T.olive600 : T.line}`, background: famG === f ? T.oliveSoft : "#fff", color: famG === f ? T.olive700 : T.inkSoft } },
f,
" \u00B7 ",
groupes.filter(g => g.fam === f).length))),
React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 11.5 } },
React.createElement("thead", null,
React.createElement("tr", null, ["Prio.", "Groupe", "Règle d'appartenance", "Barème", "Effectif"].map(h => React.createElement("th", { key: h, style: { textAlign: "left", padding: "6px 8px", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", borderBottom: `1px solid ${T.line}` } }, h)))),
React.createElement("tbody", null, groupes.filter(g => g.fam === famG).map(g => React.createElement("tr", { key: g.id },
React.createElement("td", { style: { padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontFamily: "monospace", color: T.inkSoft } }, g.priorite),
React.createElement("td", { style: { padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 700, color: T.ink } }, g.label),
React.createElement("td", { style: { padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontFamily: "monospace", fontSize: 10.5, color: T.inkMid } }, g.regle),
React.createElement("td", { style: { padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("span", { style: { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, color: g.bareme === "surchargé" ? (T.violet || "#7A5AF8") : T.inkSoft, background: (g.bareme === "surchargé" ? "#7A5AF8" : "#8090A0") + "15" } }, g.bareme)),
React.createElement("td", { style: { padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontFamily: "monospace", fontWeight: 700, color: T.olive700 } }, g.effectif))))))),
tabSG === "scen" && React.createElement("div", null,
React.createElement("div", { style: { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 2 } },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.olive900 } },
"Biblioth\u00E8que de sc\u00E9narios AML \u2014 ",
CPSI_SCENARIOS.length,
" sc\u00E9narios \u00B7 ",
CPSI_FAM_SCEN.length,
" domaines \u00B7 seuils fine-tun\u00E9s par groupe (R73)"),
React.createElement("div", { style: { marginLeft: "auto", display: "flex", gap: 4 } }, [["ref", "▤ Référentiel"], ["dom", "◧ Par domaine"]].map(function (o) { return React.createElement("button", { key: o[0], onClick: () => setVueScen(o[0]), style: { padding: "4px 11px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontWeight: 700, border: `1px solid ${vueScen === o[0] ? T.olive600 : T.line}`, background: vueScen === o[0] ? T.oliveSoft : T.surface, color: vueScen === o[0] ? T.olive900 : T.inkMid } }, o[1]); }))),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 10 } }, "Biblioth\u00E8que AML organis\u00E9e en six domaines : cash & esp\u00E8ces \u00B7 transferts & transfer agent \u00B7 activit\u00E9 transactionnelle \u00B7 trading & march\u00E9s \u00B7 capital markets/CIB \u00B7 abus de march\u00E9. Chaque sc\u00E9nario n'\u00E9value QUE les membres des groupes vis\u00E9s, \u00E0 SON seuil (survolez un sc\u00E9nario pour son descriptif)."),
vueScen === "ref" && React.createElement("div", null,
React.createElement("div", { style: { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 } }, ["Tous"].concat(CPSI_FAM_SCEN).map(function (dt) { var n = dt === "Tous" ? REFSCEN.length : REFSCEN.filter(function (r) { return r.fam === dt; }).length; return React.createElement("button", { key: dt, onClick: function () { setScenDomTab(dt); }, style: { padding: "5px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontWeight: scenDomTab === dt ? 700 : 500, border: `1px solid ${scenDomTab === dt ? T.olive600 : T.line}`, background: scenDomTab === dt ? T.oliveSoft : T.surface, color: scenDomTab === dt ? T.olive900 : T.inkMid } },
dt,
" ",
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkSoft } },
"(",
n,
")")); })),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 8 } }, "R\u00E9f\u00E9rentiel par type de sc\u00E9nario. Cliquez une ligne pour ouvrir son d\u00E9tail et r\u00E9gler ses seuils."),
React.createElement("div", { style: { overflowX: "auto" } },
React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 11.5, marginBottom: 10 } },
React.createElement("thead", null,
React.createElement("tr", null, ["Domaine", "Scénario", "Attribut surveillé", "Groupes", "Franchissements", "HIGH", "MEDIUM"].map(h => React.createElement("th", { key: h, style: { textAlign: h === "Scénario" || h === "Domaine" || h === "Attribut surveillé" ? "left" : "center", padding: "6px 9px", fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", borderBottom: `1px solid ${T.line}`, position: "sticky", top: 0, background: T.surface } }, h)))),
React.createElement("tbody", null, (scenDomTab === "Tous" ? CPSI_FAM_SCEN : [scenDomTab]).map(function (dom) {
return REFSCEN.filter(function (r) { return r.fam === dom; }).map(function (r, i) {
return React.createElement("tr", { key: r.id },
React.createElement("td", { style: { padding: "6px 9px", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 10, color: T.olive700, fontWeight: 700 } }, i === 0 ? dom : ""),
React.createElement("td", { style: { padding: "6px 9px", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("button", { title: r.desc, onClick: () => drillScen(r.fam, r.id), style: { border: "none", background: "none", padding: 0, cursor: "pointer", fontWeight: 700, color: T.olive800 || T.ink, textAlign: "left", fontSize: 11.5, textDecoration: "underline", textDecorationColor: T.line } }, r.label)),
React.createElement("td", { style: { padding: "6px 9px", borderBottom: `1px solid ${T.lineSoft}`, fontFamily: "monospace", fontSize: 10.5, color: T.inkMid } }, r.champ),
React.createElement("td", { style: { padding: "6px 9px", borderBottom: `1px solid ${T.lineSoft}`, textAlign: "center", fontFamily: "monospace" } }, r.groupes.length),
React.createElement("td", { style: { padding: "6px 9px", borderBottom: `1px solid ${T.lineSoft}`, textAlign: "center", fontWeight: 800, fontFamily: "monospace", color: r.total ? T.red : T.inkSoft } }, r.total),
React.createElement("td", { style: { padding: "6px 9px", borderBottom: `1px solid ${T.lineSoft}`, textAlign: "center", fontFamily: "monospace", color: r.high ? T.red : T.inkSoft } }, r.high),
React.createElement("td", { style: { padding: "6px 9px", borderBottom: `1px solid ${T.lineSoft}`, textAlign: "center", fontFamily: "monospace", color: r.medium ? T.amber : T.inkSoft } }, r.medium));
});
})),
React.createElement("tfoot", null,
React.createElement("tr", null, (function () {
var F = scenDomTab === "Tous" ? REFSCEN : REFSCEN.filter(function (r) { return r.fam === scenDomTab; });
return React.createElement(React.Fragment, null,
React.createElement("td", { colSpan: 4, style: { padding: "8px 9px", fontWeight: 800, color: T.olive900, borderTop: `2px solid ${T.line}` } },
"Total ",
scenDomTab === "Tous" ? "" : "(" + scenDomTab + ") ",
"\u2014 ",
F.length,
" sc\u00E9narios"),
React.createElement("td", { style: { padding: "8px 9px", textAlign: "center", fontWeight: 800, fontFamily: "monospace", color: T.red, borderTop: `2px solid ${T.line}` } }, F.reduce(function (a, r) { return a + r.total; }, 0)),
React.createElement("td", { style: { padding: "8px 9px", textAlign: "center", fontWeight: 800, fontFamily: "monospace", color: T.red, borderTop: `2px solid ${T.line}` } }, F.reduce(function (a, r) { return a + r.high; }, 0)),
React.createElement("td", { style: { padding: "8px 9px", textAlign: "center", fontWeight: 800, fontFamily: "monospace", color: T.amber, borderTop: `2px solid ${T.line}` } }, F.reduce(function (a, r) { return a + r.medium; }, 0)));
})()))))),
vueScen === "dom" && React.createElement("div", null,
React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" } }, CPSI_FAM_SCEN.map(f => React.createElement("button", { key: f, onClick: () => { setFamS(f); setScId(CPSI_SCENARIOS.find(s => s.fam === f).id); }, style: { padding: "6px 12px", borderRadius: 8, fontSize: 11.5, cursor: "pointer", fontWeight: 700,
border: `1px solid ${famS === f ? T.olive600 : T.line}`, background: famS === f ? T.olive600 : "#fff", color: famS === f ? "#fff" : T.inkMid } }, f))),
React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" } }, scenariosFam.map(s => React.createElement("button", { key: s.id, title: s.desc, onClick: () => setScId(s.id), style: { padding: "4px 10px", borderRadius: 7, fontSize: 10.5, cursor: "pointer",
border: `1px solid ${scId === s.id ? T.olive600 : T.line}`, background: scId === s.id ? T.oliveSoft : "#fff", color: scId === s.id ? T.olive700 : T.inkSoft, fontWeight: scId === s.id ? 700 : 400 } }, s.label))),
React.createElement("div", { title: sc.desc, style: { fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 4 } },
"\u00AB ",
sc.label,
" \u00BB \u2014 attribut surveill\u00E9 : ",
sc.champ,
" ",
CPSI_OPLIB[sc.sens],
" seuil (par groupe)"),
React.createElement("div", { style: { fontSize: 11, color: T.inkMid, lineHeight: 1.55, marginBottom: 10, padding: "8px 12px", background: T.cream, borderRadius: 9, borderLeft: `3px solid ${T.olive600}` } },
"\u24D8 ",
sc.desc),
React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 11.5, marginBottom: 12 } },
React.createElement("thead", null,
React.createElement("tr", null, ["Groupe visé", "Effectif", "Seuil du groupe", "Personnes concernées (hits)"].map(h => React.createElement("th", { key: h, style: { textAlign: "left", padding: "6px 8px", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", borderBottom: `1px solid ${T.line}` } }, h)))),
React.createElement("tbody", null, Object.keys(sc.groupes_seuils).map(gid => {
const g = CPSI_GROUPES.find(x => x.id === gid);
const eff = g ? cpsiMembres(g).length : 0;
const hits = rap.hits.filter(h => h.groupe === gid);
return React.createElement("tr", { key: gid },
React.createElement("td", { style: { padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 700 } }, g ? g.label : gid),
React.createElement("td", { style: { padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontFamily: "monospace" } }, eff),
React.createElement("td", { style: { padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("input", { type: "number", value: sc.groupes_seuils[gid], onChange: e => setSeuil(gid, e.target.value), style: { width: 96, padding: "4px 7px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11.5 } })),
React.createElement("td", { style: { padding: "7px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 700, color: hits.length ? T.red : T.inkSoft } },
hits.length,
hits.length ? " — " + hits.slice(0, 3).map(h => h.client).join(", ") + (hits.length > 3 ? "…" : "") : ""));
}))),
React.createElement("div", { style: { display: "flex", gap: 22, fontSize: 12, padding: "8px 12px", background: T.cream, borderRadius: 9, flexWrap: "wrap" } },
React.createElement("span", null,
"Population : ",
React.createElement("b", null, cpsiPopulation().length)),
React.createElement("span", null,
"Dans le p\u00E9rim\u00E8tre : ",
React.createElement("b", { style: { color: T.olive700 } }, rap.evalues)),
React.createElement("span", null,
"Hits : ",
React.createElement("b", { style: { color: T.red } }, rap.hits.length)),
React.createElement("span", { style: { color: T.inkSoft } },
"\u2192 ",
cpsiPopulation().length - rap.evalues,
" hors p\u00E9rim\u00E8tre, jamais \u00E9valu\u00E9s")))),
React.createElement(CpsiSandboxAml, null)));
}
// ── R79 : Référentiel de conformité AML — consultation lecture seule (Compliance & toutes fonctions) ──

// ══ BLOCS 48-49 — AML PRIVATE BANKING & ISLAMIC SHARIAH — MODULE DÉMO ══
// 33 scénarios : A-69..A-86 (R189..R206) + IS-01..IS-15 (R207..R221).
// Invariants : signaux tracés (append-only), Niveau 1 = blocage auto, Niveau 2 = alerte CO,
// IA-assistée / humain-décide (R44), paramètres tenant via registre R-Q.
const C48_AML = [
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
const C48_ISL = [
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
