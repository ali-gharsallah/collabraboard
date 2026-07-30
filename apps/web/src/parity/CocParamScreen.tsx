import React, { useState } from "react";
import { T } from "./tokens";
import { cpsiSetUser, cpsiUserNom, cpsiUser } from "./cpsi-engine-support";
import { pushParamAudit } from "./param-audit-support";
import {
  COC_CONFIG, COC_TYPE_LABELS, COC_ROLES, COC_DATA, COC_ACT_LABEL, COC_ACTION_DONE,
  COC_CREATED_TASKS, cocActions, cocPrimaryAction,
} from "./coc-support";

// Source : docs/reference/olive-demo.html 25631-25795 — CocParamScreen (Paramétrage CoC : types & sensibilité).
// Porté verbatim en React.createElement. Adaptation ESM : CPSI_USER (global source) → cpsiSetUser/cpsiUser.

export function CocParamScreen({ user }: { user?: any }) {
cpsiSetUser(user);
const [, force] = useState(0);
const re = () => force(x => x + 1);
const [nt, setNt] = useState("");
const [nm, setNm] = useState("MEDIUM");
const [na, setNa] = useState("ROLE");
const [nr, setNr] = useState("Compliance");
const ajouterType = () => {
if (!nt.trim())
return;
const key = "USR_" + nt.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 24);
COC_TYPE_LABELS[key] = nt.trim();
var _acts = (nm === "HIGH" ? ["KYC"] : [na]);
COC_CONFIG[key] = { materiality: nm, actions: _acts, action: cocPrimaryAction(_acts), role: _acts.indexOf("ROLE") >= 0 ? nr : "—", cpsiSev: nm === "HIGH" ? 2 : (nm === "MEDIUM" ? 1 : 0) };
if (typeof pushParamAudit === "function")
pushParamAudit(cpsiUserNom(), "Nouveau type de CoC ajouté : «" + nt.trim() + "» (matérialité " + nm + ")");
setNt("");
re();
};
const MATS = [["LOW", "Faible", T.green], ["MEDIUM", "Moyenne", T.amber], ["HIGH", "Haute", T.red]];
const ACTS = [["ROLE", "Routage à un rôle"], ["KYC", "Révision KYC proposée"], ["TASK", "Créer une tâche"]];
const maj = (k, patch, desc) => {
COC_CONFIG[k] = Object.assign({}, COC_CONFIG[k], patch);
if (typeof pushParamAudit === "function")
pushParamAudit(cpsiUserNom(), "Paramétrage CoC — " + (COC_TYPE_LABELS[k] || k) + " : " + desc);
re();
};
return React.createElement("div", { style: { maxWidth: 1080 } },
React.createElement("div", { style: { marginBottom: 14 } },
React.createElement("div", { style: { fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 } }, "Param\u00E9trage \u00B7 R\u00E8gles & moteur"),
React.createElement("div", { style: { fontSize: 21, fontWeight: 800, color: T.ink } }, "CoC \u2014 Types & sensibilit\u00E9"),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft } }, "Une seule v\u00E9rit\u00E9 : ce param\u00E9trage gouverne l'\u00E9cran Change of Circumstances ET le signal envoy\u00E9 au CPSI.")),
React.createElement("div", { style: { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 18px", marginBottom: 14 } },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.olive900, marginBottom: 4 } }, "La r\u00E8gle, en clair (R68)"),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft, lineHeight: 1.6 } },
"Un changement de circonstances de mat\u00E9rialit\u00E9 ",
React.createElement("b", { style: { color: T.red } }, "Haute"),
" d\u00E9clenche une ",
React.createElement("b", null, "r\u00E9vision KYC propos\u00E9e"),
" (l'humain d\u00E9cide, R44). Une mat\u00E9rialit\u00E9 ",
React.createElement("b", { style: { color: T.amber } }, "Moyenne"),
" ou ",
React.createElement("b", { style: { color: T.green } }, "Faible"),
" est rout\u00E9e au r\u00F4le affect\u00E9. Chaque type \u00E9met (ou non) un ",
React.createElement("b", null, "signal CPSI"),
" \u00AB coc_sensible \u00BB de la s\u00E9v\u00E9rit\u00E9 param\u00E9tr\u00E9e \u2014 qui p\u00E8se dans le score perp\u00E9tuel selon les r\u00E8gles R63/R64 visibles dans \u00AB CPSI \u2014 R\u00E8gles de calcul \u00BB.")),
React.createElement("div", { style: { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 18px", marginBottom: 14 } },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.olive900, marginBottom: 8 } }, "Ajouter un type de changement (R74)"),
React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
React.createElement("input", { value: nt, onChange: e => setNt(e.target.value), placeholder: "Libell\u00E9 du type (ex. \u00AB Changement de garant \u00BB)", style: { padding: "6px 9px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 11.5, flex: 1, minWidth: 240 } }),
React.createElement("select", { value: nm, onChange: e => setNm(e.target.value), style: { padding: "6px 9px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 11.5, background: "#fff" } },
React.createElement("option", { value: "LOW" }, "Faible"),
React.createElement("option", { value: "MEDIUM" }, "Moyenne"),
React.createElement("option", { value: "HIGH" }, "Haute (\u2192 r\u00E9vision KYC)")),
React.createElement("select", { value: na, onChange: e => setNa(e.target.value), disabled: nm === "HIGH", style: { padding: "6px 9px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 11.5, background: nm === "HIGH" ? T.cream : "#fff" } },
React.createElement("option", { value: "ROLE" }, "Routage \u00E0 un r\u00F4le"),
React.createElement("option", { value: "KYC" }, "R\u00E9vision KYC")),
React.createElement("select", { value: nr, onChange: e => setNr(e.target.value), disabled: na !== "ROLE" || nm === "HIGH", style: { padding: "6px 9px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 11.5, background: (na !== "ROLE" || nm === "HIGH") ? T.cream : "#fff" } }, COC_ROLES.map(r => React.createElement("option", { key: r, value: r }, r))),
React.createElement("button", { disabled: !nt.trim(), onClick: ajouterType, style: { padding: "7px 15px", borderRadius: 9, border: "none", background: nt.trim() ? T.olive600 : T.line, color: "#fff", fontSize: 12, fontWeight: 700, cursor: nt.trim() ? "pointer" : "not-allowed" } }, "Ajouter")),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginTop: 8 } }, "Le type ajout\u00E9 est trac\u00E9 (PARAM_AUDIT), gouverne aussit\u00F4t l\\'\u00E9cran op\u00E9rationnel et le signal CPSI. Mat\u00E9rialit\u00E9 Haute force la r\u00E9vision KYC.")),
React.createElement("div", { style: { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 } },
React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, marginBottom: 8 } },
Object.keys(COC_CONFIG).length,
" types de changement param\u00E9tr\u00E9s"),
React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 11.5 } },
React.createElement("thead", null,
React.createElement("tr", null, ["Type de changement", "Matérialité", "Action déclenchée", "Rôle affecté", "Signal CPSI (sévérité)"].map(h => React.createElement("th", { key: h, style: { textAlign: "left", padding: "7px 8px", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", borderBottom: `1px solid ${T.line}` } }, h)))),
React.createElement("tbody", null, Object.keys(COC_CONFIG).map(k => {
const c = COC_CONFIG[k];
return (React.createElement("tr", { key: k },
React.createElement("td", { style: { padding: "8px", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 700, color: T.ink } }, COC_TYPE_LABELS[k] || k),
React.createElement("td", { style: { padding: "8px", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("span", { style: { display: "inline-flex", gap: 4 } }, MATS.map(m => React.createElement("button", { key: m[0], onClick: () => { var acts = cocActions(c).slice(); if (m[0] === "HIGH" && acts.indexOf("KYC") < 0)
acts = acts.concat(["KYC"]); maj(k, { materiality: m[0], actions: acts, action: cocPrimaryAction(acts) }, "matérialité → " + m[1]); }, style: { padding: "3px 9px", borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: "pointer",
border: `1px solid ${c.materiality === m[0] ? m[2] : T.line}`,
background: c.materiality === m[0] ? m[2] + "18" : "#fff", color: c.materiality === m[0] ? m[2] : T.inkSoft } }, m[1])))),
React.createElement("td", { style: { padding: "8px", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("span", { style: { display: "inline-flex", gap: 4, flexWrap: "wrap" } }, ACTS.map(function (a) {
var on = cocActions(c).indexOf(a[0]) >= 0;
return React.createElement("button", { key: a[0], onClick: function () {
var acts = cocActions(c).slice();
if (on) {
if (a[0] === "KYC" && c.materiality === "HIGH")
return;
acts = acts.filter(function (x) { return x !== a[0]; });
if (acts.length === 0)
acts = [a[0]];
}
else
acts = acts.concat([a[0]]);
maj(k, { actions: acts, action: cocPrimaryAction(acts) }, "action " + (on ? "retirée" : "ajoutée") + " : " + a[1]);
}, style: { padding: "3px 9px", borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: "pointer",
border: `1px solid ${on ? T.olive600 : T.line}`,
background: on ? T.oliveSoft : "#fff", color: on ? T.olive700 : T.inkSoft } },
on ? "✓ " : "",
a[1]);
}))),
React.createElement("td", { style: { padding: "8px", borderBottom: `1px solid ${T.lineSoft}` } }, cocActions(c).indexOf("ROLE") >= 0 ? React.createElement("select", { value: c.role, onChange: e => maj(k, { role: e.target.value }, "rôle → " + e.target.value), style: { padding: "4px 8px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11, background: "#fff" } }, COC_ROLES.map(r => React.createElement("option", { key: r, value: r }, r))) : React.createElement("span", { style: { fontSize: 10.5, color: T.inkSoft } }, cocActions(c).indexOf("KYC") >= 0 ? "— révision KYC —" : "— tâche —")),
React.createElement("td", { style: { padding: "8px", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("select", { value: c.cpsiSev, onChange: e => maj(k, { cpsiSev: +e.target.value }, "signal CPSI → sévérité " + e.target.value), style: { padding: "4px 8px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 11, background: "#fff" } },
React.createElement("option", { value: 0 }, "0 \u2014 aucun signal"),
React.createElement("option", { value: 1 }, "1 \u2014 faible"),
React.createElement("option", { value: 2 }, "2 \u2014 sensible"),
React.createElement("option", { value: 3 }, "3 \u2014 critique")))));
}))),
React.createElement("div", { style: { marginTop: 10, fontSize: 10.5, color: T.inkSoft } }, "Chaque modification est journalis\u00E9e (PARAM_AUDIT). Une ou plusieurs actions par type (multi-s\u00E9lection). Mat\u00E9rialit\u00E9 Haute force la pr\u00E9sence de \u00AB R\u00E9vision KYC \u00BB.")),
(function () {
var STMAP = { SUBMITTED: "En attente", UNDER_REVIEW: "En attente", ASSIGNED: "Affecté", KYC_TRIGGERED: "KYC déclenché", APPLIED: "Traité", REJECTED: "Rejeté", DRAFT: "Brouillon" };
var ACTC = { ROLE: T.olive700, KYC: T.red, TASK: (T.violet || "#7A5AF8") };
var pend = [];
(typeof COC_DATA !== "undefined" ? COC_DATA : []).forEach(function (r) {
var cfg = COC_CONFIG[r.type];
if (!cfg)
return;
var terminal = (r.status === "APPLIED" || r.status === "REJECTED" || r.status === "KYC_TRIGGERED");
cocActions(cfg).forEach(function (a) {
pend.push({ coc: r.id, client: r.clientName, clientId: r.clientId, typeCode: r.type, type: COC_TYPE_LABELS[r.type] || r.type, action: a, key: r.id + "|" + a, done: !!COC_ACTION_DONE[r.id + "|" + a],
cible: a === "ROLE" ? (cfg.role || "—") : a === "KYC" ? "Révision KYC" : "Tâche à créer",
statut: STMAP[r.status] || r.status, terminal: terminal });
});
});
var enAttente = pend.filter(function (p) { return !p.terminal && !p.done; });
var nTraite = pend.filter(function (p) { return !p.terminal && p.done; }).length;
return React.createElement("div", { style: { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, marginTop: 14 } },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.olive900, marginBottom: 2 } },
"\u25F7 Actions en attente \u2014 ",
enAttente.length,
nTraite ? React.createElement("span", { style: { marginLeft: 8, fontSize: 10, fontWeight: 700, color: T.olive700 } },
"\u00B7 ",
nTraite,
" trait\u00E9(s) \u2713") : null),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 10, lineHeight: 1.5 } }, "Chaque changement de circonstances en cours g\u00E9n\u00E8re, selon son param\u00E9trage ci-dessus, une ou plusieurs actions \u00E0 traiter (router \u00E0 un r\u00F4le, proposer une r\u00E9vision KYC, cr\u00E9er une t\u00E2che). Rien par effet de bord : l'humain traite (R44)."),
React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 11 } },
React.createElement("thead", null,
React.createElement("tr", null, ["CoC", "Client", "Type de changement", "Action", "Cible", "Statut", ""].map(function (h) { return React.createElement("th", { key: h, style: { textAlign: "left", padding: "6px 8px", fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", borderBottom: `1px solid ${T.line}` } }, h); }))),
React.createElement("tbody", null, enAttente.slice(0, 40).map(function (p, i) {
return React.createElement("tr", { key: p.coc + "-" + p.action + "-" + i },
React.createElement("td", { style: { padding: "6px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontFamily: "monospace", fontSize: 10, color: T.inkSoft } }, p.coc),
React.createElement("td", { style: { padding: "6px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 600, color: T.ink } }, p.client),
React.createElement("td", { style: { padding: "6px 8px", borderBottom: `1px solid ${T.lineSoft}`, color: T.inkMid } }, p.type),
React.createElement("td", { style: { padding: "6px 8px", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("span", { style: { fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10, color: ACTC[p.action], background: ACTC[p.action] + "18" } }, COC_ACT_LABEL[p.action] || p.action)),
React.createElement("td", { style: { padding: "6px 8px", borderBottom: `1px solid ${T.lineSoft}`, color: T.inkMid } }, p.cible),
React.createElement("td", { style: { padding: "6px 8px", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 700, color: p.statut === "En attente" ? T.amber : T.inkMid } }, p.statut),
React.createElement("td", { style: { padding: "6px 8px", borderBottom: `1px solid ${T.lineSoft}`, textAlign: "right" } },
React.createElement("button", { onClick: function () {
COC_ACTION_DONE[p.key] = 1;
if (p.action === "TASK" && typeof COC_CREATED_TASKS !== "undefined") {
var tid = "TSK-COC-" + p.coc;
if (!COC_CREATED_TASKS.some(function (t) { return t.id === tid; })) {
var cfg = (typeof COC_CONFIG !== "undefined" && COC_CONFIG[p.typeCode]) || {};
var pri = cfg.materiality === "HIGH" ? "HIGH" : cfg.materiality === "MEDIUM" ? "MEDIUM" : "LOW";
COC_CREATED_TASKS.unshift({ id: tid, title: "Suite CoC — " + p.type + " · " + p.client, type: "COC_HANDLE", clientId: p.clientId || "", clientName: p.client, assigneeId: (cpsiUser() && cpsiUser().id) || "USR-001", priority: pri, status: "TODO", due: "2026-07-21", source: "coc", note: "Tâche générée par le changement de circonstances " + p.coc + " (" + p.type + ")." });
}
}
if (typeof pushParamAudit === "function")
pushParamAudit((typeof cpsiUserNom === "function" ? cpsiUserNom() : "Admin"), "Action CoC traitée — " + p.coc + " / " + (COC_ACT_LABEL[p.action] || p.action) + (p.action === "TASK" ? " → tâche créée (module Tâches)" : ""));
re();
}, style: { padding: "3px 10px", borderRadius: 7, fontSize: 10, cursor: "pointer", border: `1px solid ${T.olive600}`, background: T.oliveSoft, color: T.olive700, fontWeight: 700 } }, "\u2713 Traiter")));
}))),
enAttente.length === 0 && React.createElement("div", { style: { fontSize: 11, color: T.olive700, padding: "8px 0", fontWeight: 600 } }, "\u2713 Aucune action en attente \u2014 toutes trait\u00E9es."));
})());
}
