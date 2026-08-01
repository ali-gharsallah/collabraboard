import React, { useState, useEffect } from "react";
import { T } from "./tokens";
import USERS from "../fixtures/USERS.json";
import { Badge, SectionTitle } from "./components";
import { ROLE_LABELS } from "./offboarding-support";
import { pushParamAudit } from "./param-audit-support";
import { ADMIN_NAV, SCOPE_OPTS, WF_ROLE_UNIVERSE, wfEmit, SANCTIONS_SOURCES } from "./admin-support";
import { RISK_COUNTRIES, RC_LEVELS, riskCountryOf } from "./risk-country-support";
import { amlHash } from "./preonboarding-support";

// Source : docs/reference/olive-demo.html 40526-40636 — AdminScreen (Administration, hub 30 panneaux) + UserCreateModal (39207).
// Onglet « Utilisateurs & rôles » (RBAC) + « Créer un utilisateur » portés verbatim. Les autres panneaux
// d'administration (matrices, référentiels, scoring, licences, résilience…) relèvent de modules gouvernés — consignés.

const usersData = USERS as any[];

function AdminConsigne({ label }: { label: string }) {
return React.createElement("div", { style: { background: T.oliveSoft, border: `1.5px solid ${T.olive600}`, borderRadius: 14, padding: 22 } },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.olive700, marginBottom: 6 } }, label + " — panneau d'administration gouverné"),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkMid, lineHeight: 1.6 } }, "Ce panneau de paramétrage relève d'un module gouverné (matrices, référentiels, scoring, workflows, licences…). Il est consigné dans ce front de parité. L'onglet « Utilisateurs & rôles » (RBAC) et la création d'utilisateur sont pleinement fonctionnels."));
}

function UserCreateModal({ onClose, onCreated, initialRole }: { onClose: () => void; onCreated?: (u: any) => void; initialRole?: string }) {
const [nm, setNm] = useState("");
const [emailTouched, setEmailTouched] = useState(false);
const [email, setEmail] = useState("");
const [pwd, setPwd] = useState("olive2026");
const [showPwd, setShowPwd] = useState(false);
const [role, setRole] = useState(initialRole || "ARM");
const [dept, setDept] = useState(initialRole && ["CO", "CO_SR", "MLRO", "AML"].indexOf(initialRole) >= 0 ? "Compliance" : initialRole && ["RM", "ARM"].indexOf(initialRole) >= 0 ? "Front Office" : "Front Office");
const [scope, setScope] = useState("own_clients");
const [mfa, setMfa] = useState(true);
const genEmail = function (n: string) { return n.toLowerCase().trim().split(/\s+/).map(function (x, i) { return i === 0 ? x[0] : x; }).join(".").normalize("NFD").replace(/[^a-z.]/g, "") + "@banque-olive.ch"; };
const effEmail = emailTouched ? email : (nm.trim() ? genEmail(nm) : "");
const valid = nm.trim().length > 1 && effEmail.indexOf("@") > 0 && pwd.length >= 6;
const initials = nm.trim() ? nm.trim().split(/\s+/).map(function (x) { return x[0]; }).join("").slice(0, 2).toUpperCase() : "?";
const inp: any = { padding: "10px 12px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 13, width: "100%", boxSizing: "border-box" };
const lbl: any = { fontSize: 10.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 };
const create = function () {
if (!valid)
return;
var n = nm.trim();
var perms = ["kyc_read"];
if (["CO", "CO_SR", "MLRO", "AML"].indexOf(role) >= 0)
perms = perms.concat(["kyc_review", "aml_read", "screening_run"]);
if (role === "MLRO")
perms = perms.concat(["sar_file", "mros_report", "depep"]);
if (["RM", "ARM"].indexOf(role) >= 0)
perms = perms.concat(["kyc_edit_own", "client_read", "tasks_create"]);
if (scope === "admin" || role === "ADMIN")
perms = perms.concat(["admin", "params_edit"]);
var u = { id: "USR-" + String(100 + usersData.length), name: n, email: effEmail, password: pwd, role: role,
roleLabel: (ROLE_LABELS as any)[role] || role, dept: dept, avatar: initials, color: T.olive600,
permissions: perms, visibility: scope, mfa: mfa };
usersData.push(u);
pushParamAudit("Admin", "Utilisateur créé : " + n + " (" + role + ", scope " + scope + ") · " + effEmail + (mfa ? " · MFA" : ""));
wfEmit("PARAM_CHANGED", null, { subjectId: "USER/" + n, actor: "Admin", payload: { role: role, scope: scope, email: effEmail, mfa: mfa } });
if (onCreated)
onCreated(u);
onClose();
};
return (React.createElement("div", { onClick: onClose, style: { position: "fixed", inset: 0, background: "rgba(20,26,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 340 } },
React.createElement("div", { onClick: function (e: any) { e.stopPropagation(); }, style: { background: T.surface, borderRadius: 16, width: 560, maxWidth: "94vw", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 70px rgba(10,15,8,0.35)" } },
React.createElement("div", { style: { padding: "18px 22px", borderBottom: "1px solid " + T.line, display: "flex", alignItems: "center", gap: 12 } },
React.createElement("span", { style: { width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg," + T.olive600 + "," + T.leaf + ")", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 } }, initials),
React.createElement("div", { style: { flex: 1 } },
React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: T.ink } }, "Nouvel utilisateur"),
React.createElement("div", { style: { fontSize: 11, color: T.inkSoft } }, nm.trim() ? ((ROLE_LABELS as any)[role] || role) + " · " + dept : "Identité, accès et périmètre client")),
React.createElement("button", { onClick: onClose, style: { border: "none", background: "transparent", fontSize: 17, color: T.inkSoft, cursor: "pointer" } }, "✕")),
React.createElement("div", { style: { padding: "16px 22px", display: "flex", flexDirection: "column", gap: 13 } },
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Prénom Nom *"),
React.createElement("input", { value: nm, onChange: function (e: any) { setNm(e.target.value); }, placeholder: "ex. Camille Perrin", style: inp })),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Email *"),
React.createElement("input", { value: effEmail, onChange: function (e: any) { setEmailTouched(true); setEmail(e.target.value); }, placeholder: "prenom.nom@banque-olive.ch", style: Object.assign({}, inp, { borderColor: effEmail && effEmail.indexOf("@") <= 0 ? T.red : T.line }) }),
!emailTouched && nm.trim().length > 1 && React.createElement("div", { style: { fontSize: 9.5, color: T.inkSoft, marginTop: 3 } }, "généré automatiquement — modifiable")),
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Mot de passe * (min. 6)"),
React.createElement("div", { style: { position: "relative" } },
React.createElement("input", { type: showPwd ? "text" : "password", value: pwd, onChange: function (e: any) { setPwd(e.target.value); }, style: Object.assign({}, inp, { paddingRight: 36, borderColor: pwd.length > 0 && pwd.length < 6 ? T.red : T.line }) }),
React.createElement("button", { onClick: function () { setShowPwd(!showPwd); }, style: { position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", fontSize: 13 } }, showPwd ? "🙈" : "👁")))),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Rôle *"),
React.createElement("select", { value: role, onChange: function (e: any) { var r = e.target.value; setRole(r); setDept(["RM", "ARM"].indexOf(r) >= 0 ? "Front Office" : ["CO", "CO_SR", "MLRO", "AML"].indexOf(r) >= 0 ? "Compliance" : ["BRM"].indexOf(r) >= 0 ? "Risque" : ["LEGAL"].indexOf(r) >= 0 ? "Legal" : ["CF"].indexOf(r) >= 0 ? "Central File" : ["ADMIN", "SECU", "AUDIT"].indexOf(r) >= 0 ? "IT & Sécurité" : "Direction"); setScope(["RM", "ARM"].indexOf(r) >= 0 ? "own_clients" : r === "ADMIN" ? "admin" : r === "AUDIT" ? "read_only" : "all_clients"); }, style: inp }, WF_ROLE_UNIVERSE.concat(["ADMIN", "AUDIT", "SECU"]).map(function (r: string) { return React.createElement("option", { key: r, value: r }, ((ROLE_LABELS as any)[r] || r) + " (" + r + ")"); }))),
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Département"),
React.createElement("select", { value: dept, onChange: function (e: any) { setDept(e.target.value); }, style: inp }, ["Front Office", "Compliance", "Risque", "Legal", "Central File", "Direction", "IT & Sécurité"].map(function (d: string) { return React.createElement("option", { key: d, value: d }, d); })))),
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Scope client — périmètre de visibilité *"),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } }, SCOPE_OPTS.map(function (o: any) {
var on = scope === o.id;
return (React.createElement("div", { key: o.id, onClick: function () { setScope(o.id); }, style: { border: "1.5px solid " + (on ? T.olive600 : T.line), background: on ? T.oliveSoft : T.surface, borderRadius: 10, padding: "9px 11px", cursor: "pointer" } },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: on ? T.olive700 : T.ink } },
o.icon,
" ",
o.label,
" ",
on && "✓"),
React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, marginTop: 2, lineHeight: 1.4 } }, o.desc)));
}))),
React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.inkMid, cursor: "pointer" } },
React.createElement("input", { type: "checkbox", checked: mfa, onChange: function (e: any) { setMfa(e.target.checked); }, style: { accentColor: T.olive600 } }),
"🔐 MFA obligatoire à la première connexion (politique sécurité 100%)")),
React.createElement("div", { style: { padding: "14px 22px", borderTop: "1px solid " + T.line, display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" } },
React.createElement("span", { style: { flex: 1, fontSize: 10.5, color: T.inkSoft } }, "Création tracée (audit + PARAM_CHANGED) — connexion immédiate avec cet email / mot de passe."),
React.createElement("button", { onClick: onClose, style: { padding: "9px 16px", borderRadius: 9, border: "1px solid " + T.line, background: T.surface, color: T.inkMid, fontSize: 12.5, cursor: "pointer" } }, "Annuler"),
React.createElement("button", { onClick: create, disabled: !valid, style: { padding: "9px 18px", borderRadius: 9, border: "none", background: valid ? T.olive600 : T.line, color: valid ? "#fff" : T.inkSoft, fontSize: 12.5, fontWeight: 800, cursor: valid ? "pointer" : "not-allowed" } }, "Créer l'utilisateur →")))));
}

// Source : docs/reference/olive-demo.html 31638-31679 — RiskCountriesPanel (« Pays à risque GAFI + interne »). Verbatim.
function RiskCountriesPanel({ user }: { user: any }) {
const [, bump] = useState(0);
const re = function () { bump(function (x) { return x + 1; }); };
const [nCc, setNCc] = useState("");
const [nName, setNName] = useState("");
const [nLvl, setNLvl] = useState("INTERNE");
const card: any = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
return (React.createElement("div", { style: card },
React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 4, flexWrap: "wrap" } },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.ink, flex: 1 } },
"⚑ Pays à risque — ",
RISK_COUNTRIES.length,
" juridictions"),
React.createElement("label", { style: { padding: "8px 14px", borderRadius: 9, border: "1px solid " + T.olive600, color: T.olive700, fontSize: 11, fontWeight: 800, cursor: "pointer" } },
"⬆ Charger une liste (CSV)",
React.createElement("input", { type: "file", accept: ".csv,.txt", style: { display: "none" }, onChange: function (e: any) { var f = e.target.files && e.target.files[0]; if (!f)
return; var rd = new FileReader(); rd.onload = function (ev: any) { var lines = String(ev.target.result).split(/\r?\n/).filter(Boolean); var n = 0; lines.forEach(function (l: string) { var p = l.split(/[;,]/); if (p.length >= 2 && p[0].trim().length === 2 && !riskCountryOf(p[0].trim().toUpperCase())) {
RISK_COUNTRIES.push({ cc: p[0].trim().toUpperCase(), name: p[1].trim(), level: (p[2] || "INTERNE").trim().toUpperCase(), source: "Import " + f.name });
n++;
} }); pushParamAudit((user && user.name) || "—", "Pays à risque — import " + f.name + " : " + n + " ajoutée(s)"); re(); }; rd.readAsText(f); } }))),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 12 } }, "Format CSV : code ISO;nom;niveau (FATF_BLACK / FATF_GREY / INTERNE). Consommé par : contrôles pré-exécution des transferts, scénarios AML, analyseur SWIFT, corroboration."),
React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" } },
React.createElement("input", { placeholder: "CC", maxLength: 2, value: nCc, onChange: function (e: any) { setNCc(e.target.value.toUpperCase()); }, style: { width: 52, padding: "7px 9px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 11 } }),
React.createElement("input", { placeholder: "Nom du pays", value: nName, onChange: function (e: any) { setNName(e.target.value); }, style: { flex: "1 1 160px", padding: "7px 9px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 11 } }),
React.createElement("select", { value: nLvl, onChange: function (e: any) { setNLvl(e.target.value); }, style: { padding: "7px 9px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 11 } }, Object.keys(RC_LEVELS).map(function (k: string) { return React.createElement("option", { key: k, value: k }, RC_LEVELS[k][0]); })),
React.createElement("button", { onClick: function () { if (nCc.length === 2 && nName && !riskCountryOf(nCc)) {
RISK_COUNTRIES.push({ cc: nCc, name: nName, level: nLvl, source: "Saisie manuelle" });
pushParamAudit((user && user.name) || "—", "Pays à risque — ajout " + nCc);
setNCc("");
setNName("");
re();
} }, style: { padding: "7px 14px", borderRadius: 8, border: "none", background: T.olive600, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" } }, "+ Ajouter")),
RISK_COUNTRIES.map(function (x: any) {
var lv = RC_LEVELS[x.level] || RC_LEVELS.INTERNE;
return (React.createElement("div", { key: x.cc, style: { display: "flex", gap: 9, alignItems: "center", padding: "6px 0", borderBottom: "1px solid " + T.lineSoft, fontSize: 10.5 } },
React.createElement("span", { style: { fontFamily: "monospace", fontWeight: 800, color: T.ink, width: 30, flexShrink: 0 } }, x.cc),
React.createElement("span", { style: { fontWeight: 700, color: T.ink, width: 150, flexShrink: 0 } }, x.name),
React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: (T as any)[lv[1]], background: (T as any)[lv[1] + "Soft"], padding: "2px 9px", borderRadius: 8, flexShrink: 0 } }, lv[0]),
React.createElement("span", { style: { color: T.inkSoft, flex: 1 } }, x.source),
React.createElement("button", { onClick: function () { var i = RISK_COUNTRIES.indexOf(x); RISK_COUNTRIES.splice(i, 1); pushParamAudit((user && user.name) || "—", "Pays à risque — retrait " + x.cc); re(); }, style: { border: "none", background: "transparent", color: T.red, fontSize: 11, cursor: "pointer" } }, "✕")));
})));
}

// Source : docs/reference/olive-demo.html 31923-31950 — SanctionsSourcesPanel (« Listes de sanctions & embargos »). Verbatim.
function SanctionsSourcesPanel({ user }: { user: any }) {
const [, bump] = useState(0);
const re = function () { bump(function (x) { return x + 1; }); };
const card: any = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
return (React.createElement("div", { style: card },
React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 4, flexWrap: "wrap" } },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.ink, flex: 1 } },
"⛔ Listes de sanctions & embargos — ",
SANCTIONS_SOURCES.reduce(function (a: number, x: any) { return a + x.entries; }, 0).toLocaleString("fr-CH"),
" entrées"),
React.createElement("label", { style: { padding: "8px 14px", borderRadius: 9, border: "1px solid " + T.olive600, color: T.olive700, fontSize: 11, fontWeight: 800, cursor: "pointer" } },
"⬆ Charger une liste (CSV/XML)",
React.createElement("input", { type: "file", accept: ".csv,.xml,.txt", style: { display: "none" }, onChange: function (e: any) { var f = e.target.files && e.target.files[0]; if (!f)
return; var src = SANCTIONS_SOURCES.find(function (x: any) { return f.name.toLowerCase().indexOf(x.id) >= 0; }) || SANCTIONS_SOURCES[4]; src.ver = "2026-07-11"; src.status = "À jour"; src.mode = "Chargement manuel (" + f.name + ")"; src.entries += amlHash(f.name, 40); pushParamAudit((user && user.name) || "—", "Sanctions — chargement " + f.name + " → " + src.label); re(); } }))),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 12 } }, "Consommées par : moteur de screening, contrôles pré-exécution des transferts, analyseur SWIFT, scénarios AML."),
SANCTIONS_SOURCES.map(function (x: any) {
return (React.createElement("div", { key: x.id, style: { display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid " + T.lineSoft, fontSize: 10.5 } },
React.createElement("span", { style: { fontFamily: "monospace", fontWeight: 800, color: T.olive700, width: 44, textTransform: "uppercase", flexShrink: 0 } }, x.id),
React.createElement("span", { style: { fontWeight: 700, color: T.ink, flex: 1, minWidth: 180 } }, x.label),
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkMid } },
x.entries.toLocaleString("fr-CH"),
" entrées · v",
x.ver),
React.createElement("span", { style: { color: T.inkSoft, width: 170 } }, x.mode),
React.createElement("span", { style: { fontSize: 9.5, fontWeight: 800, color: x.status === "À jour" ? T.green : T.amber } }, x.status)));
}),
React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, marginTop: 10 } }, "Base de démonstration active : 20 entrées réelles (OFAC/SECO/UE/ONU) chargées dans le moteur local.")));
}

export default function AdminScreen() {
const [tab, setTab] = useState(function () { var w: any = typeof window !== "undefined" ? window : {}; var t = w.OLIVE_NAV_HINT_ADMIN || "users"; w.OLIVE_NAV_HINT_ADMIN = null; return t; });
const [nuOpen, setNuOpen] = useState(false);
const [nuLast, setNuLast] = useState<any>(null);
const [, adminBump] = useState(0);
const [users, setUsers] = useState(function () {
return usersData.filter(function (u) { return u.role !== "EDITOR"; }).map(function (u, i) {
return { id: u.id, name: u.name, role: u.roleLabel || u.role, team: u.dept || "—",
mfa: (i % 5 !== 3), active: (i % 9 !== 7), auth: (i % 4 === 0 ? "SSO" : "Local") };
});
});
useEffect(function () {
var attendu = usersData.filter(function (u) { return u.role !== "EDITOR"; }).length;
if (users.length !== attendu) {
setUsers(usersData.filter(function (u) { return u.role !== "EDITOR"; }).map(function (u) {
var ex = users.find(function (x) { return x.id === u.id; });
return ex || { id: u.id, name: u.name, role: u.roleLabel || u.role, team: u.dept || "—", mfa: false, active: true, auth: "Local" };
}));
}
});
function toggleActive(u: any) {
pushParamAudit("K. Weber (ADMIN)", (u.active ? "Compte désactivé" : "Compte réactivé") + " — " + u.name + " (" + u.id + ")");
setUsers(function (prev: any) { return prev.map(function (x: any) { return x.id === u.id ? Object.assign({}, x, { active: !x.active }) : x; }); });
}
function resetMfa(u: any) {
pushParamAudit("K. Weber (ADMIN)", "MFA réinitialisée — nouvel enrôlement requis — " + u.name + " (" + u.id + ")");
setUsers(function (prev: any) { return prev.map(function (x: any) { return x.id === u.id ? Object.assign({}, x, { mfa: false }) : x; }); });
}
const activeLabel = (ADMIN_NAV.flatMap((g: any) => g.items).find((i: any) => i.id === tab) || {}).label || "Administration";
return (React.createElement("div", null,
React.createElement("div", { style: { display: "flex", gap: 20, alignItems: "flex-start" } },
React.createElement("nav", { style: { width: 216, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 16 } }, ADMIN_NAV.map((g: any) => (React.createElement("div", { key: g.group },
React.createElement("div", { style: { fontSize: 9.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, padding: "0 10px", marginBottom: 5 } }, g.group),
React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 1 } }, g.items.map((it: any) => {
const active = tab === it.id;
return (React.createElement("button", { key: it.id, onClick: () => setTab(it.id), style: { display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "none", borderLeft: active ? `2.5px solid ${T.olive600}` : "2.5px solid transparent", background: active ? T.oliveSoft : "transparent", color: active ? T.olive700 : T.inkMid, fontSize: 12.5, fontWeight: active ? 700 : 500, cursor: "pointer" } },
React.createElement("span", { style: { fontSize: 13, width: 16, textAlign: "center", flexShrink: 0, opacity: active ? 1 : 0.7 } }, it.icon),
React.createElement("span", null, it.label)));
})))))),
React.createElement("div", { style: { flex: 1, minWidth: 0 } },
React.createElement("div", { style: { fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 } }, activeLabel),
tab === "user_create" && React.createElement(UserCreateModal, { onClose: () => setTab("users"), onCreated: (u: any) => { setNuLast(u); adminBump(x => x + 1); } }),
tab === "riskcountries" && React.createElement(RiskCountriesPanel, { user: null }),
tab === "sanctionssrc" && React.createElement(SanctionsSourcesPanel, { user: null }),
tab !== "users" && tab !== "user_create" && tab !== "riskcountries" && tab !== "sanctionssrc" && React.createElement(AdminConsigne, { label: activeLabel }),
tab === "users" && React.createElement("div", { style: { background: T.surface, border: `1px solid ${T.olive600}44`, borderRadius: 14, padding: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" } },
React.createElement("div", { style: { flex: 1, minWidth: 220 } },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink } }, "＋ Créer un utilisateur & affecter un rôle"),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginTop: 2 } }, "Email, mot de passe, rôle, département et scope client — via le formulaire complet."),
nuLast && React.createElement("div", { style: { fontSize: 11, color: T.olive700, marginTop: 5, background: T.oliveSoft, padding: "5px 9px", borderRadius: 7, display: "inline-block" } },
"✓ ",
nuLast.name,
" créé · ",
nuLast.email,
" · ",
((ROLE_LABELS as any)[nuLast.role] || nuLast.role),
" · scope ",
nuLast.visibility)),
React.createElement("button", { onClick: () => setNuOpen(true), style: { padding: "10px 18px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer" } }, "＋ Nouvel utilisateur"),
nuOpen && React.createElement(UserCreateModal, { onClose: () => setNuOpen(false), onCreated: (u: any) => { setNuLast(u); adminBump(x => x + 1); } })),
tab === "users" && React.createElement("div", { style: { background: T.surface, borderRadius: 14, border: `1px solid ${T.line}`, overflow: "hidden" } },
React.createElement("div", { style: { padding: "16px 20px", borderBottom: `1px solid ${T.line}` } },
React.createElement(SectionTitle, null, "Utilisateurs & rôles (RBAC)")),
React.createElement("table", { style: { width: "100%", borderCollapse: "collapse" } },
React.createElement("thead", null,
React.createElement("tr", { style: { background: T.lineSoft } }, ["Utilisateur", "Rôle", "Équipe", "Authentification", "MFA", "Statut", "Actions"].map(h => React.createElement("th", { key: h, style: { padding: "10px 20px", textAlign: "left", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 } }, h)))),
React.createElement("tbody", null, users.map((u: any, i: number) => (React.createElement("tr", { key: i, style: { borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("td", { style: { padding: "14px 20px" } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
React.createElement("div", { style: { width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg,${T.olive700},${T.leaf})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 } }, u.name.split(" ").map((n: string) => n[0]).join("")),
React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: T.ink } }, u.name))),
React.createElement("td", { style: { padding: "14px 20px" } },
React.createElement(Badge, { text: u.role, color: T.olive700, bg: T.oliveSoft })),
React.createElement("td", { style: { padding: "14px 20px", fontSize: 12, color: T.inkMid } }, u.team),
React.createElement("td", { style: { padding: "14px 20px" } },
React.createElement(Badge, { text: u.auth === "SSO" ? "SSO fédéré" : "Local", color: u.auth === "SSO" ? T.violet : T.inkSoft, bg: u.auth === "SSO" ? T.violetSoft : T.lineSoft })),
React.createElement("td", { style: { padding: "14px 20px" } }, u.mfa ? React.createElement("span", { style: { fontSize: 12, color: T.green, fontWeight: 600 } }, "🔐 Activée") : React.createElement("span", { style: { fontSize: 12, color: T.amber, fontWeight: 600 } }, "⚠ À enrôler")),
React.createElement("td", { style: { padding: "14px 20px" } },
React.createElement(Badge, { text: u.active ? "Actif" : "Désactivé", color: u.active ? T.green : T.red, bg: u.active ? T.greenSoft : T.redSoft })),
React.createElement("td", { style: { padding: "14px 20px" } },
React.createElement("div", { style: { display: "flex", gap: 6 } },
React.createElement("button", { onClick: function () { toggleActive(u); }, style: { padding: "5px 10px", borderRadius: 7, border: `1px solid ${u.active ? T.red : T.green}`, background: "transparent", color: u.active ? T.red : T.green, fontSize: 10, fontWeight: 700, cursor: "pointer" } }, u.active ? "Désactiver" : "Activer"),
React.createElement("button", { onClick: function () { resetMfa(u); }, disabled: !u.mfa, style: { padding: "5px 10px", borderRadius: 7, border: `1px solid ${u.mfa ? T.line : T.lineSoft}`, background: "transparent", color: u.mfa ? T.inkMid : T.inkSoft, fontSize: 10, fontWeight: 700, cursor: u.mfa ? "pointer" : "not-allowed", opacity: u.mfa ? 1 : 0.5 } }, "Réinit. MFA")))))))))))));
}
