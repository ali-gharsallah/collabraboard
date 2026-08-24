import React, { useState, useEffect } from "react";
import { T } from "./tokens";
import { CPSI_SCENARIOS, CPSI_GROUPES } from "./cpsi-data-support";
import { cpsiMembres, cpsiAttr, CPSI_OPS } from "./cpsi-engine-support";
import { pushParamAudit } from "./param-audit-support";
import { amlSbFmt, sbTension, SbStress, sbProposer } from "./sandbox-support";

// Source : docs/reference/olive-demo.html 18561-18804 — AmlSandboxScreen (bac à sable AML seuils & populations).
// Porté verbatim en React.createElement.

export function AmlSandboxScreen() {
const [scId, setScId] = useState(CPSI_SCENARIOS[0].id);
const sc = CPSI_SCENARIOS.find(function (x) { return x.id === scId; }) || CPSI_SCENARIOS[0];
const [seuils, setSeuils] = useState(function () { return Object.assign({}, sc.groupes_seuils); });
const [addG, setAddG] = useState("");
const [dateEff, setDateEff] = useState("2026-08-01");
const [msg, setMsg] = useState(null);
useEffect(function () { setSeuils(Object.assign({}, sc.groupes_seuils)); setMsg(null); setAddG(""); }, [scId]);
function evaluer(map) {
var hits = [];
Object.keys(map).forEach(function (gid) {
var g = CPSI_GROUPES.find(function (x) { return x.id === gid; });
if (!g)
return;
cpsiMembres(g).forEach(function (cl) {
var v = cpsiAttr(cl, sc.champ);
if (v === null || v === undefined)
return;
if (CPSI_OPS[sc.sens](v, map[gid]))
hits.push({ k: cl.id + "|" + gid, cl: cl, gid: gid, v: v, seuil: map[gid] });
});
});
return hits;
}
const base = evaluer(sc.groupes_seuils), sim = evaluer(seuils);
const bk = {}, sk = {};
base.forEach(function (h) { bk[h.k] = h; });
sim.forEach(function (h) { sk[h.k] = h; });
const nouvelles = sim.filter(function (h) { return !bk[h.k]; });
const disparues = base.filter(function (h) { return !sk[h.k]; });
const touches = {};
nouvelles.concat(disparues).forEach(function (h) { touches[h.cl.id] = 1; });
const modifie = JSON.stringify(seuils) !== JSON.stringify(sc.groupes_seuils);
const horsScope = CPSI_GROUPES.filter(function (g) { return !(g.id in seuils); });
const gLabel = function (gid) { var g = CPSI_GROUPES.find(function (x) { return x.id === gid; }); return g ? g.label : gid; };
function setSeuil(gid, v) { var o = Object.assign({}, seuils); o[gid] = parseFloat(v) || 0; setSeuils(o); }
function retirer(gid) { var o = Object.assign({}, seuils); delete o[gid]; setSeuils(o); }
function ajouter() {
if (!addG)
return;
var vals = Object.keys(seuils).map(function (k) { return seuils[k]; });
var def = vals.length ? vals[0] : 1;
var o = Object.assign({}, seuils);
o[addG] = def;
setSeuils(o);
setAddG("");
}
function reset() { setSeuils(Object.assign({}, sc.groupes_seuils)); setMsg(null); }
function appliquer() {
if (!modifie) {
setMsg({ k: "err", t: "Aucune modification à appliquer." });
return;
}
var avant = JSON.stringify(sc.groupes_seuils);
sc.groupes_seuils = Object.assign({}, seuils);
pushParamAudit("K. Weber (ADMIN)", "AML « " + sc.label + " » — seuils/portée modifiés (effet " + dateEff + ") : "
+ Object.keys(seuils).length + " groupe(s), " + (nouvelles.length ? "+" + nouvelles.length + " alerte(s)" : "")
+ (disparues.length ? " −" + disparues.length + " alerte(s)" : "") + " · avant " + avant);
setMsg({ k: "ok", t: "Appliqué en production avec date de mise en vigueur " + dateEff + " (R29 : les dossiers antérieurs conservent l'ancien paramétrage). Journalisé." });
}
const card = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 16, marginBottom: 14 };
const kpi = function (v, l, c) {
return (React.createElement("div", { style: { padding: "9px 16px", borderRadius: 10, background: c + "12", border: "1px solid " + c + "30", minWidth: 104 } },
React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: c, fontFamily: "monospace" } }, v),
React.createElement("div", { style: { fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4 } }, l)));
};
const th = { padding: "8px 10px", textAlign: "left", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 };
const td = { padding: "8px 10px", fontSize: 11.5, color: T.ink };
return (React.createElement("div", null,
React.createElement("div", { style: { marginBottom: 12 } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
React.createElement("div", { style: { fontSize: 21, fontWeight: 800, color: T.ink } }, "Bac \u00E0 sable AML \u2014 seuils & populations"),
React.createElement("span", { style: { fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: T.olive600 + "15", color: T.olive700 } }, "DRY-RUN \u00B7 aucune \u00E9criture, aucun case cr\u00E9\u00E9 (R70)")),
React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginTop: 4, maxWidth: 960, lineHeight: 1.6 } },
"Rejoue un sc\u00E9nario de la biblioth\u00E8que sur la population r\u00E9elle. Modifier un ",
React.createElement("b", null, "seuil par groupe"),
" ou la",
React.createElement("b", null, " port\u00E9e d'un groupe"),
" (ajout/retrait) recalcule imm\u00E9diatement quelles alertes apparaissent et lesquelles disparaissent, avec les clients concern\u00E9s. Rien n'est \u00E9crit tant que vous n'appliquez pas.")),
msg && React.createElement("div", { style: { marginBottom: 12, padding: "9px 12px", borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
background: msg.k === "ok" ? T.greenSoft : T.redSoft, color: msg.k === "ok" ? T.green : T.red, border: "1px solid " + (msg.k === "ok" ? T.green : T.red) + "30" } }, msg.t),
React.createElement("div", { style: card },
React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } },
React.createElement("span", { style: { fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase" } }, "Sc\u00E9nario"),
React.createElement("select", { value: scId, onChange: function (e) { setScId(e.target.value); }, style: { padding: "8px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12, minWidth: 340 } }, CPSI_SCENARIOS.map(function (x) { return React.createElement("option", { key: x.id, value: x.id },
x.fam,
" \u2014 ",
x.label); })),
React.createElement("span", { style: { fontSize: 11, color: T.inkSoft, fontFamily: "monospace" } },
sc.id,
" \u00B7 champ \u00AB ",
sc.champ,
" \u00BB \u00B7 ",
sc.sens === "gte" ? "≥ seuil" : "≤ seuil")),
sc.desc && React.createElement("div", { style: { fontSize: 11.5, color: T.inkMid, marginTop: 8, lineHeight: 1.6 } }, sc.desc)),
React.createElement("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 } },
kpi(base.length, "alertes actuelles", T.inkMid),
kpi(sim.length, "alertes simulées", T.olive700),
kpi((sim.length - base.length >= 0 ? "+" : "") + (sim.length - base.length), "delta", sim.length > base.length ? T.red : (sim.length < base.length ? T.green : T.inkSoft)),
kpi(nouvelles.length, "nouvelles", T.red),
kpi(disparues.length, "disparues", T.green),
kpi(Object.keys(touches).length, "clients touchés", T.violet)),
React.createElement(SbStress, { titre: "volume d'alertes", unite: "seuils simul\u00E9s \u00D7 facteur", niveau: sbTension(0, 0, nouvelles.length, Object.keys(touches).length), sousTitre: "Sensibilité du scénario aux seuils que vous venez de fixer.", curIdx: 2, points: [0.6, 0.8, 1, 1.2, 1.4].map(function (f) {
var m = {};
Object.keys(seuils).forEach(function (g) { m[g] = seuils[g] * f; });
return { x: "×" + f, v: evaluer(m).length };
}) }),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 3 } }, "Seuils par groupe \u00B7 port\u00E9e du sc\u00E9nario"),
React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, marginBottom: 10 } }, "Retirer un groupe sort sa population du sc\u00E9nario. Ajouter un groupe y fait entrer la sienne."),
React.createElement("table", { style: { width: "100%", borderCollapse: "collapse" } },
React.createElement("thead", null,
React.createElement("tr", { style: { background: T.lineSoft } }, ["Groupe", "Population", "Seuil de référence", "Seuil simulé", "Alertes (actuel → simulé)", ""].map(function (h, i) { return React.createElement("th", { key: i, style: th }, h); }))),
React.createElement("tbody", null, Object.keys(seuils).map(function (gid) {
const g = CPSI_GROUPES.find(function (x) { return x.id === gid; });
const pop = g ? cpsiMembres(g).length : 0;
const nb = base.filter(function (h) { return h.gid === gid; }).length;
const ns = sim.filter(function (h) { return h.gid === gid; }).length;
const ref = sc.groupes_seuils[gid];
return (React.createElement("tr", { key: gid, style: { borderBottom: "1px solid " + T.lineSoft } },
React.createElement("td", { style: td },
React.createElement("b", null, gLabel(gid)),
React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, fontFamily: "monospace" } },
gid,
g ? " · " + g.fam : "")),
React.createElement("td", { style: td },
pop,
" client",
pop > 1 ? "s" : ""),
React.createElement("td", { style: Object.assign({}, td, { color: T.inkSoft, fontFamily: "monospace" }) }, ref === undefined ? "— (hors périmètre)" : amlSbFmt(ref)),
React.createElement("td", { style: td },
React.createElement("input", { type: "number", step: "any", value: seuils[gid], onChange: function (e) { setSeuil(gid, e.target.value); }, style: { width: 110, padding: "5px 8px", borderRadius: 7, border: "1px solid " + (ref !== undefined && seuils[gid] !== ref ? T.olive600 : T.line), fontSize: 11.5, fontFamily: "monospace" } })),
React.createElement("td", { style: td },
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkSoft } }, nb),
React.createElement("span", { style: { color: T.inkSoft } }, " \u2192 "),
React.createElement("span", { style: { fontFamily: "monospace", fontWeight: 800, color: ns > nb ? T.red : (ns < nb ? T.green : T.ink) } }, ns)),
React.createElement("td", { style: Object.assign({}, td, { textAlign: "right" }) },
React.createElement("button", { onClick: function () { retirer(gid); }, style: { padding: "4px 9px", borderRadius: 6, border: "1px solid " + T.line, background: "transparent", color: T.red, fontSize: 10, fontWeight: 700, cursor: "pointer" } }, "Retirer"))));
}))),
React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" } },
React.createElement("select", { value: addG, onChange: function (e) { setAddG(e.target.value); }, style: { padding: "7px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 11.5, minWidth: 280 } },
React.createElement("option", { value: "" }, "Ajouter un groupe au p\u00E9rim\u00E8tre\u2026"),
horsScope.map(function (g) { return React.createElement("option", { key: g.id, value: g.id },
g.fam,
" \u2014 ",
g.label,
" (",
cpsiMembres(g).length,
")"); })),
React.createElement("button", { onClick: ajouter, disabled: !addG, style: { padding: "7px 14px", borderRadius: 8, border: "none", background: addG ? T.olive600 : T.line, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: addG ? "pointer" : "not-allowed" } }, "Ajouter"),
React.createElement("button", { onClick: reset, style: { padding: "7px 14px", borderRadius: 8, border: "1px solid " + T.line, background: "transparent", color: T.inkMid, fontSize: 11.5, fontWeight: 700, cursor: "pointer" } }, "R\u00E9initialiser"))),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } },
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.red, marginBottom: 8 } },
"\u25B2 Nouvelles alertes (",
nouvelles.length,
")"),
nouvelles.length === 0 && React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft } }, "Aucune \u2014 le param\u00E9trage simul\u00E9 ne d\u00E9clenche rien de plus."),
nouvelles.slice(0, 12).map(function (h) {
return (React.createElement("div", { key: h.k, style: { display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid " + T.lineSoft, fontSize: 11.5 } },
React.createElement("span", { style: { color: T.ink, fontWeight: 600 } }, h.cl.name),
React.createElement("span", { style: { color: T.inkSoft, fontSize: 10.5 } }, gLabel(h.gid)),
React.createElement("span", { style: { fontFamily: "monospace", color: T.red } },
amlSbFmt(h.v),
" vs ",
amlSbFmt(h.seuil))));
}),
nouvelles.length > 12 && React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginTop: 6 } },
"+ ",
nouvelles.length - 12,
" autres\u2026")),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.green, marginBottom: 8 } },
"\u25BC Alertes disparues (",
disparues.length,
")"),
disparues.length === 0 && React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft } }, "Aucune \u2014 aucune alerte actuelle n'est perdue."),
disparues.slice(0, 12).map(function (h) {
return (React.createElement("div", { key: h.k, style: { display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid " + T.lineSoft, fontSize: 11.5 } },
React.createElement("span", { style: { color: T.ink, fontWeight: 600 } }, h.cl.name),
React.createElement("span", { style: { color: T.inkSoft, fontSize: 10.5 } }, gLabel(h.gid)),
React.createElement("span", { style: { fontFamily: "monospace", color: T.green } },
amlSbFmt(h.v),
" vs ",
amlSbFmt(h.seuil))));
}),
disparues.length > 12 && React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginTop: 6 } },
"+ ",
disparues.length - 12,
" autres\u2026"))),
React.createElement("div", { style: Object.assign({}, card, { marginTop: 14 }) },
React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } },
React.createElement("span", { style: { fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase" } }, "Date de mise en vigueur (R29)"),
React.createElement("input", { type: "date", value: dateEff, onChange: function (e) { setDateEff(e.target.value); }, style: { padding: "7px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12 } }),
React.createElement("button", { onClick: appliquer, disabled: !modifie, style: { padding: "9px 18px", borderRadius: 9, border: "none", background: modifie ? T.olive700 : T.line, color: "#fff", fontSize: 12, fontWeight: 800, cursor: modifie ? "pointer" : "not-allowed" } }, "Appliquer en production"),
React.createElement("button", { onClick: function () {
if (!modifie) {
setMsg({ k: "err", t: "Aucune modification à proposer." });
return;
}
var seuilsCopie = Object.assign({}, seuils), scRef = sc;
sbProposer({ source: "AML", by: "I. Vernet (CO Senior)", role: "CO_SR", dateEff: dateEff,
titre: "Scénario « " + sc.label + " » — seuils/portée",
detail: Object.keys(seuilsCopie).map(function (g) { return gLabel(g) + " : " + amlSbFmt(seuilsCopie[g]); }).join(" · "),
impacts: [{ k: "alertes", v: sim.length - base.length }, { k: "nouvelles alertes", v: nouvelles.length }, { k: "alertes disparues", v: disparues.length }, { k: "clients touchés", v: Object.keys(touches).length }],
apply: function () { scRef.groupes_seuils = Object.assign({}, seuilsCopie); } });
setMsg({ k: "ok", t: "Recommandation soumise au comité de paramétrage — rien n'est écrit tant que l'owner n'a pas arbitré." });
}, disabled: !modifie, style: { padding: "9px 18px", borderRadius: 9, border: "1px solid " + (modifie ? T.violet : T.line), background: "transparent", color: modifie ? T.violet : T.inkSoft, fontSize: 12, fontWeight: 800, cursor: modifie ? "pointer" : "not-allowed" } }, "\u2696 Proposer au comit\u00E9"),
React.createElement("span", { style: { fontSize: 10.5, color: T.inkSoft } }, modifie ? "Modifications en attente — non écrites." : "Paramétrage identique à la production.")))));
}
