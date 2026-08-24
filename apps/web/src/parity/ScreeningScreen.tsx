import React, { useState } from "react";
import { T } from "./tokens";
import { Badge, SevPill, SectionTitle } from "./components";
import { clientById } from "./components-data";
import { pushParamAudit } from "./param-audit-support";
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import {
  SANCTIONS_DB, SCREEN_LISTS, SCREEN_BATCH_RUNS, SCREEN_BATCH_LAST,
  screenHits, screenMatch, screenQualify, screenConfirmFp, screenRescreenOne, screenBatchRun,
  aiScreeningAnalyze, aiPrioritizeQueue,
} from "./screening-support";

// Source : docs/reference/olive-demo.html — ScreeningTabs (39124) : Qualification (34107), Re-screening (34264),
// Test (34333), Watchlists (17847). Porté verbatim en React.createElement.
// Onglet « Preuves moteur » (MoteurPreuvesPanel/OLIVE_PROOFS) consigné : harnais backend hors périmètre.

// CONSIGNÉ (hors périmètre parité) : l'onglet « Preuves moteur » de la source (MoteurPreuvesPanel)
// exécute OLIVE_PROOFS — un harnais qui rejoue les SERVICES BACKEND réels (R104 · R100→R103 · R30→R36).
// Ce harnais backend n'est pas porté côté front de parité → panneau neutre.
function MoteurPreuvesPanel() {
  return React.createElement("div", { style: { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 } },
    React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 } }, "🧪 Preuves moteur \u2014 consigné"),
    React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, lineHeight: 1.6 } }, "Cet onglet rejoue en direct les services backend de conformité (harnais OLIVE_PROOFS). Il relève du backend gouverné, hors périmètre du front de parité \u2014 consigné."));
}

function ScreeningScreen() {
// Build hits from real KYCS_DATA screening results
const hits = KYCS_DATA
.filter(k => Object.values(k.screening).some(v => v === "HIT"))
.slice(0, 20)
.flatMap(k => {
const items = [];
if (k.screening.pep === "HIT")
items.push({ name: k.clientName, list: "World-Check PEP", match: `${70 + Math.floor(k.riskScore / 3)}%`, type: "PEP", status: "Confirmé", sev: k.risk, kycCode: k.code });
if (k.screening.ofac === "HIT")
items.push({ name: k.clientName, list: "OFAC SDN", match: `${80 + Math.floor(k.riskScore / 5)}%`, type: "Sanctions", status: "Confirmé", sev: "CRITICAL", kycCode: k.code });
if (k.screening.seco === "HIT")
items.push({ name: k.clientName, list: "SECO embargo", match: `${65 + Math.floor(k.riskScore / 4)}%`, type: "Sanctions", status: "Confirmé", sev: k.risk, kycCode: k.code });
if (k.screening.adverse === "HIT")
items.push({ name: k.clientName, list: "Adverse Media", match: `${50 + Math.floor(k.riskScore / 3)}%`, type: "Adverse Media", status: "À qualifier", sev: "MEDIUM", kycCode: k.code });
return items;
});
const totalScreenings = KYCS_DATA.length * 4;
const hitCount = hits.length;
const confirmedHits = hits.filter(h => h.status === "Confirmé").length;
const pepHits = hits.filter(h => h.type === "PEP").length;
return (React.createElement("div", null,
React.createElement("div", { style: { background: T.surface, borderRadius: 14, border: `1px solid ${T.line}`, overflow: "hidden" } },
React.createElement("div", { style: { padding: "16px 20px", borderBottom: `1px solid ${T.line}` } },
React.createElement(SectionTitle, null, "Hits de screening \u00E0 qualifier")),
React.createElement("table", { style: { width: "100%", borderCollapse: "collapse" } },
React.createElement("thead", null,
React.createElement("tr", { style: { background: T.lineSoft } }, ["Entité", "Liste", "Type", "Correspondance", "Statut", "Sévérité"].map(h => React.createElement("th", { key: h, style: { padding: "10px 20px", textAlign: "left", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 } }, h)))),
React.createElement("tbody", null, hits.map((h, i) => (React.createElement("tr", { key: i, style: { borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("td", { style: { padding: "14px 20px", fontSize: 13, fontWeight: 600, color: T.ink } }, h.name),
React.createElement("td", { style: { padding: "14px 20px", fontSize: 12, color: T.inkMid } }, h.list),
React.createElement("td", { style: { padding: "14px 20px" } },
React.createElement(Badge, { text: h.type, color: T.olive700, bg: T.oliveSoft })),
React.createElement("td", { style: { padding: "14px 20px" } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
React.createElement("div", { style: { width: 50, height: 6, background: T.lineSoft, borderRadius: 3, overflow: "hidden" } },
React.createElement("div", { style: { height: "100%", width: h.match, background: parseInt(h.match) > 80 ? T.red : parseInt(h.match) > 50 ? T.amber : T.green, borderRadius: 3 } })),
React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: T.ink } }, h.match))),
React.createElement("td", { style: { padding: "14px 20px", fontSize: 12, fontWeight: 600, color: h.status === "Confirmé" ? T.red : T.green } }, h.status),
React.createElement("td", { style: { padding: "14px 20px" } },
React.createElement(SevPill, { sev: h.sev }))))))))));
}

function ScreeningQualifPanel({ user }: { user?: any }) {
const [selKey, setSelKey] = useState(null);
const [note, setNote] = useState("");
const [fltr, setFltr] = useState("PENDING");
const [aiCache, setAiCache] = useState({});
const [prio, setPrio] = useState(null);
const [, bump] = useState(0);
const re = function () { bump(function (x) { return x + 1; }); };
const card = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
const canQ = user && ["CO", "CO_SR", "AML", "MLRO", "DIR", "ADMIN"].indexOf(user.role) >= 0;
const all = screenHits();
const rows = all.filter(function (h) { return fltr === "ALL" ? true : fltr === "PENDING" ? !h.q : (h.q && h.q.decision === fltr); });
const nP = all.filter(function (h) { return !h.q; }).length;
return (React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 } },
"\u2696 Atelier de qualification \u2014 ",
all.length,
" hits, ",
nP,
" \u00E0 trancher"),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 12 } }, "Vrai positif \u2192 escalade \u00B7 Faux positif \u2192 lev\u00E9e motiv\u00E9e (note obligatoire, four-eyes \u2265 80%). D\u00E9cision Compliance, trac\u00E9e."),
React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" } },
[["PENDING", "À trancher"], ["TP", "Vrais positifs"], ["FP", "Faux positifs"], ["ALL", "Tous"]].map(function (x) {
return (React.createElement("button", { key: x[0], onClick: function () { setFltr(x[0]); setSelKey(null); }, style: { padding: "6px 12px", borderRadius: 8, border: "1px solid " + (fltr === x[0] ? T.olive600 : T.line), background: fltr === x[0] ? T.oliveSoft : T.surface, color: fltr === x[0] ? T.olive700 : T.inkMid, fontSize: 10.5, fontWeight: 700, cursor: "pointer" } }, x[1]));
}),
React.createElement("button", { onClick: function () { var p = aiPrioritizeQueue(all); setPrio(p); pushParamAudit((user && user.name) || "—", "Screening — priorisation IA de la file (" + p.length + " hits à trancher)"); }, style: { marginLeft: "auto", padding: "6px 14px", borderRadius: 8, border: "1px solid " + T.violet, background: T.violetSoft, color: T.violet, fontSize: 10.5, fontWeight: 800, cursor: "pointer" } }, "\u2726 Prioriser la file (IA)")),
prio && (React.createElement("div", { style: { padding: "10px 13px", borderRadius: 10, background: T.violetSoft, border: "1px solid " + T.violet + "44", marginBottom: 12 } },
React.createElement("div", { style: { fontSize: 10.5, fontWeight: 800, color: T.violet, marginBottom: 6 } }, "\u2726 File prioris\u00E9e par l'IA \u2014 s\u00E9v\u00E9rit\u00E9 du programme \u00D7 confiance \u00D7 risque client"),
prio.slice(0, 5).map(function (x, i) {
return (React.createElement("div", { key: x.h.key, onClick: function () { setSelKey(x.h.key); }, style: { display: "flex", gap: 8, alignItems: "baseline", fontSize: 10.5, padding: "3px 0", cursor: "pointer" } },
React.createElement("span", { style: { fontFamily: "monospace", fontWeight: 800, color: T.violet } },
"#",
i + 1),
React.createElement("span", { style: { fontWeight: 700, color: T.ink } }, x.h.c.name),
React.createElement("span", { style: { color: T.inkSoft } },
"\u00D7 ",
x.h.entry.name),
React.createElement("span", { style: { marginLeft: "auto", fontSize: 9.5, color: T.inkMid } },
x.ai.severity,
" \u00B7 ",
x.h.conf,
"% \u00B7 ",
x.ai.recommendation)));
}))),
rows.slice(0, 25).map(function (h) {
var open = selKey === h.key;
return (React.createElement("div", { key: h.key, style: { marginBottom: 7 } },
React.createElement("div", { onClick: function () { setSelKey(open ? null : h.key); setNote(""); }, style: { display: "flex", gap: 9, alignItems: "center", padding: "9px 12px", borderRadius: 9, border: "1.5px solid " + (open ? T.olive600 : T.lineSoft), background: open ? T.oliveSoft : T.cream, cursor: "pointer", flexWrap: "wrap" } },
React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: "#fff", background: h.list === "ofac" ? T.red : h.list === "seco" ? T.orange || T.amber : h.list === "pep" ? T.violet : T.amber, padding: "3px 9px", borderRadius: 9, textTransform: "uppercase" } }, h.listMeta[0]),
React.createElement("span", { style: { flex: 1, fontSize: 11.5, fontWeight: 700, color: T.ink, minWidth: 180 } },
h.c.name,
" ",
React.createElement("span", { style: { fontWeight: 400, color: T.inkSoft } },
"\u00B7 cible : ",
h.target)),
React.createElement("span", { style: { fontFamily: "monospace", fontSize: 11, fontWeight: 800, color: h.conf >= 85 ? T.red : h.conf >= 72 ? T.amber : T.inkMid } },
h.conf,
"%"),
h.q
? React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: h.q.decision === "TP" ? T.red : T.green, background: h.q.decision === "TP" ? T.redSoft : T.greenSoft, padding: "3px 10px", borderRadius: 12 } }, h.q.decision === "TP" ? "VRAI POSITIF" : "FAUX POSITIF")
: React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: T.amber, background: T.amberSoft, padding: "3px 10px", borderRadius: 12 } }, "\u00C0 TRANCHER")),
open && (React.createElement("div", { style: { background: T.cream, borderRadius: 10, padding: "11px 15px", marginTop: 4 } },
React.createElement("div", { style: { padding: "8px 11px", borderRadius: 9, background: T.surface, border: "1px solid " + T.lineSoft, marginBottom: 8 } },
React.createElement("div", { style: { fontSize: 11, fontWeight: 800, color: T.ink } },
h.entry.name,
" ",
React.createElement("span", { style: { fontWeight: 400, color: T.inkSoft } },
"(",
h.entry.type === "PERSON" ? "personne" : "entité",
h.entry.dob ? (" · née le " + h.entry.dob) : "",
h.entry.country && h.entry.country !== "—" ? (" · " + h.entry.country) : "",
")")),
React.createElement("div", { style: { fontSize: 10, color: T.inkMid, marginTop: 2 } },
"Programme : ",
React.createElement("strong", null, h.entry.program),
" \u00B7 r\u00E9f. ",
h.entry.ref,
(h.entry.aliases || []).length ? (" · alias : " + h.entry.aliases.join(", ")) : "",
" \u00B7 liste ",
h.listMeta[0],
" (version ",
h.listMeta[1],
")"),
React.createElement("div", { style: { fontSize: 9.5, color: T.inkSoft, marginTop: 2 } },
"Dossier ",
h.k.code,
h.alert ? " · alerte " + h.alert.id + " (" + h.alert.status + ")" : "",
h.q ? " · décision par " + h.q.by + (h.q.note ? " — " + h.q.note : "") : "")),
(function () {
var ai = aiCache[h.key];
if (!ai)
return (React.createElement("button", { onClick: function (e) { e.stopPropagation(); var a = aiScreeningAnalyze(h); setAiCache(Object.assign({}, aiCache, (function () { var o = {}; o[h.key] = a; return o; })())); pushParamAudit((user && user.name) || "—", "Screening — analyse IA demandée : " + h.c.name + " × " + h.listMeta[0] + " → " + a.recommendation); }, style: { marginBottom: 8, padding: "7px 14px", borderRadius: 9, border: "1px solid " + T.violet, background: T.violetSoft, color: T.violet, fontSize: 10.5, fontWeight: 800, cursor: "pointer" } }, "\u2726 Analyse IA du hit"));
return (React.createElement("div", { style: { padding: "9px 12px", borderRadius: 9, background: T.violetSoft, border: "1px solid " + T.violet + "44", marginBottom: 8 } },
React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "baseline", marginBottom: 5 } },
React.createElement("span", { style: { fontSize: 10, fontWeight: 800, color: T.violet } },
"\u2726 ADJUDICATION IA \u2014 ",
ai.recommendation),
React.createElement("span", { style: { fontSize: 9, color: T.inkSoft } },
"s\u00E9v\u00E9rit\u00E9 programme : ",
ai.severity,
" \u00B7 ",
ai.source)),
ai.facts.map(function (f, i) { return React.createElement("div", { key: i, style: { fontSize: 10, color: T.inkMid, padding: "1.5px 0" } }, f); }),
React.createElement("div", { style: { fontSize: 10.5, color: T.ink, marginTop: 5, fontStyle: "italic" } }, ai.rationale),
React.createElement("div", { style: { fontSize: 9, color: T.inkSoft, marginTop: 4 } }, "L'IA recommande, l'humain d\u00E9cide \u2014 la d\u00E9cision reste au CO, trac\u00E9e.")));
})(),
React.createElement("div", { style: { marginBottom: 10 } },
React.createElement("div", { style: { display: "flex", gap: 8, fontSize: 8.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", padding: "0 0 4px" } },
React.createElement("span", { style: { width: 150 } }, "Attribut"),
React.createElement("span", { style: { flex: 1 } }, "Dossier"),
React.createElement("span", { style: { flex: 1 } }, "Entr\u00E9e de liste"),
React.createElement("span", { style: { width: 76, textAlign: "right" } }, "Points")),
h.attrs.map(function (a, i) {
var okA = a.state === "MATCH" || a.state === "PROCHE";
return (React.createElement("div", { key: i, style: { display: "flex", gap: 8, alignItems: "baseline", fontSize: 10.5, padding: "3px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { width: 150, fontWeight: 700, color: T.ink } }, a.label),
React.createElement("span", { style: { flex: 1, color: T.inkMid } }, a.dossier),
React.createElement("span", { style: { flex: 1, color: T.inkMid } }, a.liste),
React.createElement("span", { style: { width: 76, textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: okA ? (a.state === "PROCHE" ? T.amber : T.green) : a.state === "INCONNUE" ? T.inkSoft : T.red } },
a.state === "MATCH" ? "✓" : a.state === "PROCHE" ? "≈" : a.state === "INCONNUE" ? "?" : "✗",
" ",
a.pts)));
}),
React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", fontSize: 10.5, fontWeight: 800, color: T.ink, paddingTop: 4 } },
"Confiance calcul\u00E9e : ",
h.conf,
"/100",
h.conf >= 80 ? " — levée soumise au four-eyes" : "")),
h.q && h.q.decision === "FP_PENDING" && (React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "8px 10px", borderRadius: 9, background: T.amberSoft } },
React.createElement("span", { style: { fontSize: 10.5, fontWeight: 700, color: T.inkMid, flex: 1 } },
"\u23F3 Lev\u00E9e propos\u00E9e par ",
h.q.by,
" \u2014 confirmation four-eyes requise (confiance ",
h.conf,
"%)."),
React.createElement("button", { onClick: function () { var r = screenConfirmFp(h, user); if (!r.err)
re();
else {
setNote(r.err);
} }, disabled: !canQ, style: { padding: "7px 14px", borderRadius: 9, border: "none", background: canQ ? T.green : T.line, color: "#fff", fontSize: 10.5, fontWeight: 800, cursor: canQ ? "pointer" : "not-allowed" } }, "\u2713 Confirmer la lev\u00E9e (2\u1D49 signature)"),
note && note.indexOf("Four-eyes") === 0 && React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color: T.red } }, note))),
!h.q && (React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
React.createElement("input", { placeholder: "Note de qualification (obligatoire pour lever)", value: note, onChange: function (e) { setNote(e.target.value); }, style: { flex: "1 1 280px", padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11 } }),
React.createElement("button", { onClick: function () { if (canQ) {
screenQualify(h, "TP", note || null, user);
re();
} }, disabled: !canQ, style: { padding: "8px 15px", borderRadius: 9, border: "none", background: canQ ? T.red : T.line, color: "#fff", fontSize: 11, fontWeight: 800, cursor: canQ ? "pointer" : "not-allowed" } }, "\u2713 Vrai positif \u2014 escalader"),
React.createElement("button", { onClick: function () { if (canQ && note) {
screenQualify(h, "FP", note, user);
re();
} }, disabled: !canQ || !note, title: !note ? "Note obligatoire" : "", style: { padding: "8px 15px", borderRadius: 9, border: "1px solid " + T.green, background: "transparent", color: T.green, fontSize: 11, fontWeight: 800, cursor: (canQ && note) ? "pointer" : "not-allowed" } }, "\u2715 Faux positif \u2014 lever")))))));
}),
rows.length > 25 && React.createElement("div", { style: { fontSize: 10, color: T.inkSoft } },
"\u2026 et ",
rows.length - 25,
" autre(s).")));
}

function ScreeningBatchPanel({ user }: { user?: any }) {
const [uniCid, setUniCid] = useState("");
const [uniRes, setUniRes] = useState("");
const [, bump] = useState(0);
const re = function () { bump(function (x) { return x + 1; }); };
const card = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
const canRun = user && ["CO", "CO_SR", "AML", "MLRO", "ADMIN"].indexOf(user.role) >= 0;
return (React.createElement("div", null,
React.createElement("div", { style: Object.assign({}, card, { marginBottom: 14 }) },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 } }, "\u21BB Re-screening du portefeuille \u2014 Perpetual KYC"),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 12 } },
KYCS_DATA.length,
" dossiers repass\u00E9s contre les listes du jour. Chaque run est trac\u00E9."),
React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
React.createElement("button", { onClick: function () { if (canRun) {
screenBatchRun(user);
re();
} }, disabled: !canRun, title: canRun ? "" : "Réservé Compliance / AML", style: { padding: "10px 20px", borderRadius: 9, border: "none", background: canRun ? T.olive600 : T.line, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: canRun ? "pointer" : "not-allowed" } },
"\u25B6 Lancer le re-screening (run #",
SCREEN_BATCH_RUNS + 1,
")"),
React.createElement("select", { value: uniCid, onChange: function (e) { setUniCid(e.target.value); setUniRes(""); }, style: { padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5 } },
React.createElement("option", { value: "" }, "\u2014 ou un dossier pr\u00E9cis \u2014"),
KYCS_DATA.slice(0, 60).map(function (k) { var c = clientById[k.clientId] || {}; return React.createElement("option", { key: k.code, value: k.code },
c.name,
" \u00B7 ",
k.code); })),
React.createElement("button", { onClick: function () { var k = KYCS_DATA.find(function (x) { return x.code === uniCid; }); if (k && canRun) {
setUniRes(screenRescreenOne(k, user));
re();
} }, disabled: !canRun || !uniCid, style: { padding: "8px 15px", borderRadius: 9, border: "1px solid " + T.olive600, background: "transparent", color: T.olive700, fontSize: 11, fontWeight: 800, cursor: (canRun && uniCid) ? "pointer" : "not-allowed" } }, "\u21BB Re-screener ce dossier"),
uniRes && React.createElement("span", { style: { fontSize: 10.5, fontWeight: 700, color: uniRes.indexOf("RAS") === 0 ? T.green : T.amber } }, uniRes))),
SCREEN_BATCH_LAST && (React.createElement("div", { style: Object.assign({}, card, { marginBottom: 14 }) },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 8 } },
"Rapport du run #",
SCREEN_BATCH_LAST.run,
" \u2014 ",
SCREEN_BATCH_LAST.at),
React.createElement("div", { style: { fontSize: 11, color: T.inkMid, marginBottom: 8 } },
SCREEN_BATCH_LAST.added.length,
" nouveau(x) hit(s) \u00B7 ",
SCREEN_BATCH_LAST.lifted.length,
" lev\u00E9e(s) automatique(s) (entr\u00E9e retir\u00E9e par le fournisseur)"),
SCREEN_BATCH_LAST.added.map(function (x, i) { return React.createElement("div", { key: "a" + i, style: { fontSize: 10.5, color: T.inkMid, padding: "3px 0" } },
"\u2795 ",
React.createElement("strong", { style: { color: T.ink } }, x.c.name),
" \u2014 nouveau hit ",
SCREEN_LISTS[x.list][0],
" (dossier ",
x.k.code,
") \u2192 \u00E0 qualifier dans l'atelier"); }),
SCREEN_BATCH_LAST.lifted.map(function (x, i) { return React.createElement("div", { key: "l" + i, style: { fontSize: 10.5, color: T.inkMid, padding: "3px 0" } },
"\u2796 ",
React.createElement("strong", { style: { color: T.ink } }, x.c.name),
" \u2014 lev\u00E9e automatique ",
x.listMeta[0]); }))),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 8 } }, "\u25A4 Listes & fournisseurs"),
Object.keys(SCREEN_LISTS).map(function (k) {
var m = SCREEN_LISTS[k];
return (React.createElement("div", { key: k, style: { display: "flex", gap: 10, alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontSize: 11.5, fontWeight: 700, color: T.ink, flex: 1 } }, m[0]),
React.createElement("span", { style: { fontFamily: "monospace", fontSize: 10.5, color: T.inkSoft } },
"version ",
m[1]),
React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: T.green, background: T.greenSoft, padding: "2px 9px", borderRadius: 9 } }, "\u2713 \u00C0 jour")));
}),
React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, marginTop: 8 } }, "OFAC SDN \u00B7 SECO SESAM \u00B7 UE (CFSP) et ONU consolid\u00E9es via SECO \u00B7 PEP & adverse media par fournisseur commercial."))));
}

function ScreeningTestPanel({ user }: { user?: any }) {
const [q, setQ] = useState("");
const [res, setRes] = useState(null);
const card = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
return (React.createElement("div", null,
React.createElement("div", { style: Object.assign({}, card, { marginBottom: 14 }) },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 } }, "\u2316 Test de screening \u2014 vrai moteur, vraie base"),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 12 } },
SANCTIONS_DB.length,
" entr\u00E9es OFAC / UE / SECO / ONU \u00B7 normalisation, alias, Levenshtein, tokens."),
React.createElement("div", { style: { display: "flex", gap: 8 } },
React.createElement("input", { placeholder: "Nom \u00E0 screener\u2026", value: q, onChange: function (e) { setQ(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter" && q.trim()) {
setRes(screenMatch(q, { limit: 5, min: 55 }));
pushParamAudit((user && user.name) || "—", "Screening — test de nom : « " + q + " »");
} }, style: { flex: 1, padding: "10px 13px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 12.5 } }),
React.createElement("button", { onClick: function () { if (q.trim()) {
setRes(screenMatch(q, { limit: 5, min: 55 }));
pushParamAudit((user && user.name) || "—", "Screening — test de nom : « " + q + " »");
} }, disabled: !q.trim(), style: { padding: "10px 20px", borderRadius: 9, border: "none", background: q.trim() ? T.olive600 : T.line, color: "#fff", fontSize: 12, fontWeight: 800, cursor: q.trim() ? "pointer" : "not-allowed" } }, "\u2316 Screener"))),
res && (React.createElement("div", { style: card },
res.length === 0 && React.createElement("div", { style: { padding: "12px 14px", borderRadius: 9, background: T.greenSoft, fontSize: 12, fontWeight: 700, color: T.green } },
"\u2713 Aucune correspondance \u2265 55% \u2014 \u00AB ",
q,
" \u00BB ne matche aucune entr\u00E9e des listes charg\u00E9es."),
res.map(function (m) {
return (React.createElement("div", { key: m.entry.id, style: { padding: "10px 13px", borderRadius: 10, border: "1.5px solid " + (m.score >= 85 ? T.red : m.score >= 70 ? T.amber : T.lineSoft), background: m.score >= 85 ? T.redSoft : m.score >= 70 ? T.amberSoft : T.cream, marginBottom: 8 } },
React.createElement("div", { style: { display: "flex", gap: 9, alignItems: "baseline", flexWrap: "wrap" } },
React.createElement("span", { style: { fontFamily: "monospace", fontSize: 13, fontWeight: 800, color: m.score >= 85 ? T.red : m.score >= 70 ? T.amber : T.inkMid } },
m.score,
"%"),
React.createElement("span", { style: { fontSize: 12, fontWeight: 800, color: T.ink, flex: 1 } }, m.entry.name),
React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: "#fff", background: m.entry.list === "ofac" ? T.red : T.violet, padding: "3px 9px", borderRadius: 9 } }, SCREEN_LISTS[m.entry.list] ? SCREEN_LISTS[m.entry.list][0] : m.entry.list.toUpperCase())),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkMid, marginTop: 3 } },
m.entry.type === "PERSON" ? "Personne" : "Entité",
m.entry.dob ? (" · née le " + m.entry.dob) : "",
m.entry.country && m.entry.country !== "—" ? (" · " + m.entry.country) : "",
" \u00B7 Programme : ",
React.createElement("strong", null, m.entry.program),
" \u00B7 r\u00E9f. ",
m.entry.ref),
React.createElement("div", { style: { fontSize: 9.5, color: T.inkSoft, marginTop: 2 } },
"Correspondance via \u00AB ",
m.via,
" \u00BB",
(m.entry.aliases || []).length ? (" · alias connus : " + m.entry.aliases.join(", ")) : "")));
})))));
}

export function ScreeningTabs({ user }: { user?: any }) {
const [t, setT] = useState("qualif");
return (React.createElement("div", null,
React.createElement("div", { style: { display: "flex", gap: 4, marginBottom: 16, background: T.surface, padding: 5, borderRadius: 12, border: `1px solid ${T.line}`, width: "fit-content" } }, [["qualif", "⚖ Qualification des hits"], ["batch", "↻ Re-screening & listes"], ["lev", "⌖ Test de screening"], ["watch", "▤ Watchlists & hits"], ["preuves", "🧪 Preuves moteur"]].map(([id, label]) => (React.createElement("button", { key: id, onClick: () => setT(id), style: { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: t === id ? T.olive600 : "transparent", color: t === id ? "#fff" : T.inkMid, fontSize: 13, fontWeight: t === id ? 700 : 500 } }, label)))),
t === "qualif" && React.createElement(ScreeningQualifPanel, { user: user }),
t === "batch" && React.createElement(ScreeningBatchPanel, { user: user }),
t === "lev" && React.createElement(ScreeningTestPanel, { user: user }),
t === "watch" && React.createElement(ScreeningScreen, null),
t === "preuves" && React.createElement(MoteurPreuvesPanel, null)));
}
