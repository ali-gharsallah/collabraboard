import React, { useState } from "react";
import { T } from "./tokens";
import CLIENTS from "../fixtures/CLIENTS.json";
import { DOC_STRUCTURES } from "./preonboarding-support";
import { WF_RULE_PARAMS } from "./kyc-support";
import { evalAmlRules } from "./aml";
import { CPSI_PAYS_RISQUE, CPSI_SECTEUR_RISQUE } from "./cpsi-engine-support";
import { QUESTIONS_TEMPLATE } from "./kyc-detail-data";
import { pushParamAudit } from "./param-audit-support";
import { sbTension, SbStress, sbProposer } from "./sandbox-support";

// Source : docs/reference/olive-demo.html 19328-19560 — OnbSandboxScreen (bac à sable Onboarding aiguillage).
// Données REF_ACCOUNT_TYPES (18042), WF_KYC_SECTIONS_PARAM (21782) + helpers onbPays/onbCdbForm inline (verbatim).

const REF_ACCOUNT_TYPES = [
{ code: "COURANT", label: "Compte courant", score: 0 },
{ code: "EPARGNE", label: "Épargne", score: 0 },
{ code: "TITRES", label: "Dépôt-titres", score: 1 },
{ code: "NUMERO", label: "Compte numéroté", score: 2 },
{ code: "ESCROW", label: "Compte escrow / séquestre", score: 2 },
{ code: "LOMBARD", label: "Crédit lombard", score: 2 },
{ code: "CRYPTO", label: "Actifs numériques", score: 3 },
];
const WF_KYC_SECTIONS_PARAM = [
{ code: "IDENT", label: "1. Identité du client", visa: true, val: "ARM", sup: "CO" },
{ code: "UBO", label: "2. Ayants droit & contrôle", visa: true, val: "CO", sup: "CO Senior" },
{ code: "LIEES", label: "3. Personnes liées", visa: false, val: "ARM", sup: "CO" },
{ code: "REL", label: "4. Relation d\u2019affaires", visa: true, val: "ARM", sup: "CO" },
{ code: "SOF", label: "5. Origine fonds & fortune", visa: true, val: "CO", sup: "CO Senior" },
{ code: "SCREEN", label: "6. Screening", visa: true, val: "Resp. AML (MLRO)", sup: "CO Senior" },
{ code: "RISK", label: "7. Profil de risque", visa: true, val: "BRM", sup: "CO Senior" },
{ code: "AML", label: "8. AML / LBA", visa: true, val: "Resp. AML (MLRO)", sup: "CO Senior" },
{ code: "FISC", label: "9. Fiscalité", visa: true, val: "CO", sup: "Legal" },
{ code: "XB", label: "10. Cross-border", visa: true, val: "Legal", sup: "CO Senior" },
{ code: "ESG", label: "11. ESG", visa: false, val: "ESG Officer", sup: "CO" },
{ code: "DOCS", label: "12. Documents (CDB)", visa: true, val: "Central File", sup: "CO" },
{ code: "FINAL", label: "13. Workflow & validation", visa: true, val: "Head of PB", sup: "CEO" }
];
function onbPays() {
var m = {};
CLIENTS.forEach(function (c) { if (c.countryCode)
m[c.countryCode] = c.country || c.countryCode; });
Object.keys(CPSI_PAYS_RISQUE).forEach(function (k) { if (!m[k])
m[k] = k; });
return Object.keys(m).sort(function (a, b) { return m[a].localeCompare(m[b]); }).map(function (k) { return { code: k, country: m[k], risque: (CPSI_PAYS_RISQUE[k] != null ? CPSI_PAYS_RISQUE[k] : 1) }; });
}
function onbCdbForm(struct) { return struct === "PP" ? "A" : (struct === "TRUST" ? "T" : (struct === "FOND" ? "S" : "K")); }

export function OnbSandboxScreen() {
const structs = DOC_STRUCTURES.filter(function (x) { return x.active !== false; });
const [st, setSt] = useState((structs[0] || { id: "PP" }).id);
const [pays, setPays] = useState("CH");
const [act, setAct] = useState("Technologie");
const [cpt, setCpt] = useState(REF_ACCOUNT_TYPES[0].code);
const [pep, setPep] = useState(false);
const [aum, setAum] = useState("CHF 3.5M");
const [sdd, setSdd] = useState(WF_RULE_PARAMS.WR0.sdd);
const [cdd, setCdd] = useState(WF_RULE_PARAMS.WR0.cdd);
const [msg, setMsg] = useState(null);
const cand = { name: "Prospect simulé", type: st, countryCode: pays, sector: act, aum: aum, pep: pep, uboName: "" };
const ev = evalAmlRules(cand, null);
const tier = ev.score <= sdd ? "SDD" : (ev.score <= cdd ? "CDD" : "EDD");
const risk = tier === "SDD" ? "LOW" : (tier === "CDD" ? "MEDIUM" : "HIGH");
const cdb = onbCdbForm(st);
const hits = ev.rules.filter(function (r) { return r.hit; });
const tierRef = ev.score <= WF_RULE_PARAMS.WR0.sdd ? "SDD" : (ev.score <= WF_RULE_PARAMS.WR0.cdd ? "CDD" : "EDD");
const seuilsModifies = sdd !== WF_RULE_PARAMS.WR0.sdd || cdd !== WF_RULE_PARAMS.WR0.cdd;
// charge induite : questions obligatoires + visas requis
const reqTotal = Object.keys(QUESTIONS_TEMPLATE).reduce(function (a, k) {
return a + QUESTIONS_TEMPLATE[k].filter(function (q) { return q.right === "REQUIRED"; }).length;
}, 0);
const visas = WF_KYC_SECTIONS_PARAM.filter(function (x) { return x.visa; });
const accScore = (REF_ACCOUNT_TYPES.find(function (x) { return x.code === cpt; }) || {}).score;
// impact des seuils sur le portefeuille réel
const portefeuille = CLIENTS.map(function (c) { return { c: c, s: evalAmlRules(c, null).score }; });
const repRef = { SDD: 0, CDD: 0, EDD: 0 }, repSim = { SDD: 0, CDD: 0, EDD: 0 };
portefeuille.forEach(function (x) {
const a = x.s <= WF_RULE_PARAMS.WR0.sdd ? "SDD" : (x.s <= WF_RULE_PARAMS.WR0.cdd ? "CDD" : "EDD");
const b = x.s <= sdd ? "SDD" : (x.s <= cdd ? "CDD" : "EDD");
repRef[a]++;
repSim[b]++;
});
const versEdd = portefeuille.filter(function (x) {
const a = x.s <= WF_RULE_PARAMS.WR0.sdd ? "SDD" : (x.s <= WF_RULE_PARAMS.WR0.cdd ? "CDD" : "EDD");
const b = x.s <= sdd ? "SDD" : (x.s <= cdd ? "CDD" : "EDD");
return a !== "EDD" && b === "EDD";
});
function appliquer() {
if (!seuilsModifies) {
setMsg({ k: "err", t: "Aucune modification des seuils." });
return;
}
var av = WF_RULE_PARAMS.WR0.sdd + "/" + WF_RULE_PARAMS.WR0.cdd;
WF_RULE_PARAMS.WR0.sdd = sdd;
WF_RULE_PARAMS.WR0.cdd = cdd;
pushParamAudit("K. Weber (ADMIN)", "Seuils d'aiguillage KYC modifiés : " + av + " → " + sdd + "/" + cdd
+ " — répartition portefeuille SDD " + repRef.SDD + "→" + repSim.SDD + ", CDD " + repRef.CDD + "→" + repSim.CDD + ", EDD " + repRef.EDD + "→" + repSim.EDD);
setMsg({ k: "ok", t: "Seuils appliqués. Les dossiers déjà validés conservent leur niveau de diligence (R29) ; l'aiguillage s'applique aux nouveaux dossiers." });
}
const card = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 16, marginBottom: 14 };
const lbl = { fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 };
const inp = { width: "100%", padding: "7px 9px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12, background: "#fff" };
const TC = { SDD: T.green, CDD: T.amber, EDD: T.red };
return (React.createElement("div", null,
React.createElement("div", { style: { marginBottom: 12 } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
React.createElement("div", { style: { fontSize: 21, fontWeight: 800, color: T.ink } }, "Bac \u00E0 sable Onboarding \u2014 aiguillage"),
React.createElement("span", { style: { fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: T.olive600 + "15", color: T.olive700 } }, "DRY-RUN \u00B7 aucun prospect cr\u00E9\u00E9")),
React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginTop: 4, maxWidth: 980, lineHeight: 1.6 } },
"Quatre informations \u00E0 la cr\u00E9ation d\u00E9cident de tout : niveau de diligence, workflow, formulaire CDB et charge documentaire. Ici, on voit ",
React.createElement("b", null, "pourquoi"),
" \u2014 r\u00E8gle par r\u00E8gle \u2014 et ce que d\u00E9placent les seuils d'aiguillage sur le portefeuille r\u00E9el.")),
msg && React.createElement("div", { style: { marginBottom: 12, padding: "9px 12px", borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
background: msg.k === "ok" ? T.greenSoft : T.redSoft, color: msg.k === "ok" ? T.green : T.red, border: "1px solid " + (msg.k === "ok" ? T.green : T.red) + "30" } }, msg.t),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 14 } },
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 12 } }, "Les informations de cr\u00E9ation"),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Structure"),
React.createElement("select", { value: st, onChange: function (e) { setSt(e.target.value); }, style: inp }, structs.map(function (x) { return React.createElement("option", { key: x.id, value: x.id }, x.name); }))),
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Pays"),
React.createElement("select", { value: pays, onChange: function (e) { setPays(e.target.value); }, style: inp }, onbPays().map(function (c) { return React.createElement("option", { key: c.code, value: c.code },
c.country,
" (",
c.risque,
")"); }))),
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Activit\u00E9"),
React.createElement("select", { value: act, onChange: function (e) { setAct(e.target.value); }, style: inp }, Object.keys(CPSI_SECTEUR_RISQUE).sort().map(function (a) { return React.createElement("option", { key: a, value: a },
a,
" (",
CPSI_SECTEUR_RISQUE[a],
")"); }))),
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Type de compte"),
React.createElement("select", { value: cpt, onChange: function (e) { setCpt(e.target.value); }, style: inp }, REF_ACCOUNT_TYPES.map(function (t) { return React.createElement("option", { key: t.code, value: t.code },
t.label,
" (",
t.score,
")"); }))),
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Avoirs attendus"),
React.createElement("input", { value: aum, onChange: function (e) { setAum(e.target.value); }, style: inp })),
React.createElement("div", null,
React.createElement("div", { style: lbl }, "Statut PEP"),
React.createElement("button", { onClick: function () { setPep(!pep); }, style: { width: "100%", padding: "7px 9px", borderRadius: 8, cursor: "pointer", fontSize: 11.5, fontWeight: 800,
border: "1px solid " + (pep ? T.red : T.line), background: pep ? T.redSoft : "transparent", color: pep ? T.red : T.inkSoft } }, pep ? "PEP — oui" : "Non-PEP"))),
React.createElement("div", { style: { marginTop: 12, fontSize: 10.5, color: T.inkSoft, lineHeight: 1.5 } },
"Activit\u00E9 et type de compte tirent leur score du ",
React.createElement("b", null, "R\u00E9f\u00E9rentiel"),
" \u2014 changer une pond\u00E9ration l\u00E0-bas change l'aiguillage ici.")),
React.createElement("div", null,
React.createElement("div", { style: Object.assign({}, card, { border: "2px solid " + TC[tier] + "66", background: TC[tier] + "08" }) },
React.createElement("div", { style: { display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" } },
React.createElement("div", { style: { textAlign: "center", minWidth: 92 } },
React.createElement("div", { style: { fontSize: 30, fontWeight: 800, fontFamily: "monospace", color: TC[tier], lineHeight: 1 } },
ev.score,
React.createElement("span", { style: { fontSize: 13, color: T.inkSoft } }, "/100")),
React.createElement("div", { style: { fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 } }, "score")),
React.createElement("div", { style: { flex: 1, minWidth: 220 } },
React.createElement("div", { style: { display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" } },
React.createElement("span", { style: { fontSize: 19, fontWeight: 800, color: TC[tier] } }, tier),
React.createElement("span", { style: { fontSize: 11, color: T.inkSoft } },
"\u00B7 risque ",
risk),
React.createElement("span", { style: { fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: T.oliveSoft, color: T.olive700 } },
"Formulaire CDB ",
cdb),
tier !== tierRef && React.createElement("span", { style: { fontSize: 10, fontWeight: 800, color: T.violet } },
"\u21C4 seuils simul\u00E9s : ",
tierRef,
" \u2192 ",
tier)),
React.createElement("div", { style: { fontSize: 11, color: T.inkMid, marginTop: 6, lineHeight: 1.5 } },
"Workflow ",
React.createElement("b", null,
"WF_",
tier),
" \u00B7 ",
visas.length,
" visa",
visas.length > 1 ? "s" : "",
" de section requis \u00B7 ",
reqTotal,
" question",
reqTotal > 1 ? "s" : "",
" obligatoire",
reqTotal > 1 ? "s" : "",
" au total",
accScore > 0 ? " · type de compte pondéré +" + accScore : "")))),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 8 } },
"Pourquoi ce score \u2014 ",
hits.length,
" r\u00E8gle",
hits.length > 1 ? "s" : "",
" d\u00E9clench\u00E9e",
hits.length > 1 ? "s" : "",
" sur ",
ev.rules.length),
hits.length === 0 && React.createElement("div", { style: { fontSize: 11.5, color: T.green } }, "Aucune r\u00E8gle d\u00E9clench\u00E9e \u2014 profil sans facteur aggravant."),
React.createElement("div", { style: { maxHeight: 190, overflowY: "auto" } }, hits.map(function (r) {
return (React.createElement("div", { key: r.id, style: { display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderBottom: "1px solid " + T.lineSoft, fontSize: 11.5 } },
React.createElement("span", { style: { color: T.ink, flex: 1 } }, r.label),
React.createElement("span", { style: { fontSize: 9.5, color: T.inkSoft } }, r.cat),
React.createElement("span", { style: { fontFamily: "monospace", fontWeight: 800, color: r.pts >= 20 ? T.red : T.amber, minWidth: 34, textAlign: "right" } },
"+",
r.pts)));
}))))),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 3 } }, "Seuils d'aiguillage \u2014 et leur effet sur le portefeuille"),
React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, marginBottom: 12 } }, "Ces deux nombres d\u00E9cident du niveau de diligence de chaque nouveau dossier. Les d\u00E9placer redistribue tout le portefeuille."),
React.createElement("div", { style: { display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 14 } },
React.createElement("label", { style: { fontSize: 11.5, color: T.inkMid } },
"SDD si score \u2264",
React.createElement("input", { type: "number", value: sdd, onChange: function (e) { setSdd(parseInt(e.target.value, 10) || 0); }, style: { width: 66, marginLeft: 6, padding: "5px 8px", borderRadius: 7, border: "1px solid " + (sdd !== WF_RULE_PARAMS.WR0.sdd ? T.olive600 : T.line), fontFamily: "monospace", fontSize: 12 } })),
React.createElement("label", { style: { fontSize: 11.5, color: T.inkMid } },
"CDD si score \u2264",
React.createElement("input", { type: "number", value: cdd, onChange: function (e) { setCdd(parseInt(e.target.value, 10) || 0); }, style: { width: 66, marginLeft: 6, padding: "5px 8px", borderRadius: 7, border: "1px solid " + (cdd !== WF_RULE_PARAMS.WR0.cdd ? T.olive600 : T.line), fontFamily: "monospace", fontSize: 12 } })),
React.createElement("span", { style: { fontSize: 11, color: T.inkSoft } },
"au-del\u00E0 \u2192 EDD \u00B7 r\u00E9f\u00E9rence actuelle ",
WF_RULE_PARAMS.WR0.sdd,
" / ",
WF_RULE_PARAMS.WR0.cdd)),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 } }, ["SDD", "CDD", "EDD"].map(function (k) {
return (React.createElement("div", { key: k, style: { border: "1px solid " + TC[k] + "40", background: TC[k] + "0D", borderRadius: 10, padding: "10px 14px" } },
React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: TC[k], letterSpacing: 0.5 } }, k),
React.createElement("div", { style: { fontFamily: "monospace", fontSize: 19, fontWeight: 800, color: T.ink, marginTop: 3 } },
repRef[k],
" ",
React.createElement("span", { style: { color: T.inkSoft, fontSize: 13 } }, "\u2192"),
" ",
React.createElement("span", { style: { color: repSim[k] !== repRef[k] ? TC[k] : T.ink } }, repSim[k])),
React.createElement("div", { style: { fontSize: 9.5, color: T.inkSoft } }, "clients du portefeuille")));
})),
React.createElement("div", { style: { margin: "14px 0" } },
React.createElement(SbStress, { titre: "portefeuille en EDD", unite: "seuil CDD (au-del\u00E0 \u2192 EDD)", niveau: sbTension(0, versEdd.length, 0, 0), sousTitre: "O\u00F9 placer la fronti\u00E8re CDD/EDD \u2014 et ce que \u00E7a co\u00FBte en diligence renforc\u00E9e.", curIdx: 2, points: [-20, -10, 0, 10, 20].map(function (d) {
var c2 = cdd + d, n = 0;
portefeuille.forEach(function (x) { if (!(x.s <= sdd) && !(x.s <= c2))
n++; });
return { x: String(c2), v: n };
}) })),
versEdd.length > 0 && (React.createElement("div", { style: { marginTop: 12, background: T.redSoft, border: "1px solid " + T.red + "40", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: T.red, lineHeight: 1.5 } },
"\u25B2 ",
versEdd.length,
" client",
versEdd.length > 1 ? "s" : "",
" passerai",
versEdd.length > 1 ? "ent" : "t",
" en ",
React.createElement("b", null, "EDD"),
" avec ces seuils : ",
versEdd.slice(0, 5).map(function (x) { return x.c.name; }).join(", "),
versEdd.length > 5 ? " …" : "",
" \u2014 diligence renforc\u00E9e, donc charge accrue.")),
React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" } },
React.createElement("button", { onClick: appliquer, disabled: !seuilsModifies, style: { padding: "9px 18px", borderRadius: 9, border: "none", background: seuilsModifies ? T.olive700 : T.line, color: "#fff", fontSize: 12, fontWeight: 800, cursor: seuilsModifies ? "pointer" : "not-allowed" } }, "Appliquer les seuils"),
React.createElement("button", { onClick: function () {
if (!seuilsModifies) {
setMsg({ k: "err", t: "Aucune modification à proposer." });
return;
}
var a = sdd, b = cdd;
sbProposer({ source: "ONB", by: "S. Marchand (ARM)", role: "ARM", dateEff: "2026-09-01",
titre: "Seuils d'aiguillage SDD/CDD/EDD",
detail: "SDD ≤ " + a + " · CDD ≤ " + b + " (référence " + WF_RULE_PARAMS.WR0.sdd + "/" + WF_RULE_PARAMS.WR0.cdd + ")",
impacts: [{ k: "clients vers EDD", v: versEdd.length }, { k: "EDD portefeuille", v: repSim.EDD - repRef.EDD }, { k: "SDD portefeuille", v: repSim.SDD - repRef.SDD }],
apply: function () { WF_RULE_PARAMS.WR0.sdd = a; WF_RULE_PARAMS.WR0.cdd = b; } });
setMsg({ k: "ok", t: "Recommandation soumise au comité de paramétrage." });
}, disabled: !seuilsModifies, style: { padding: "9px 18px", borderRadius: 9, border: "1px solid " + (seuilsModifies ? T.violet : T.line), background: "transparent", color: seuilsModifies ? T.violet : T.inkSoft, fontSize: 12, fontWeight: 800, cursor: seuilsModifies ? "pointer" : "not-allowed" } }, "\u2696 Proposer au comit\u00E9"),
React.createElement("button", { onClick: function () { setSdd(WF_RULE_PARAMS.WR0.sdd); setCdd(WF_RULE_PARAMS.WR0.cdd); setMsg(null); }, style: { padding: "9px 16px", borderRadius: 9, border: "1px solid " + T.line, background: "transparent", color: T.inkMid, fontSize: 12, fontWeight: 700, cursor: "pointer" } }, "R\u00E9initialiser"),
React.createElement("span", { style: { fontSize: 10.5, color: T.inkSoft } }, seuilsModifies ? "Seuils modifiés — non écrits." : "Seuils identiques à la production.")))));
}
