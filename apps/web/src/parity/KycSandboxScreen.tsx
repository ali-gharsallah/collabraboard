import React, { useState, useEffect } from "react";
import { T } from "./tokens";
import { QUESTIONS_TEMPLATE } from "./kyc-detail-data";
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import { pushParamAudit } from "./param-audit-support";
import { sbTension, SbStress, sbProposer } from "./sandbox-support";

// Source : docs/reference/olive-demo.html 18937-19149 — KycSandboxScreen (bac à sable KYC sections & questions).
// Constantes KYC_SB_* + composant portés verbatim.

const KYC_SB_ENCOURS = ["DRAFT", "IN_PROGRESS", "UNDER_REVIEW", "PENDING_APPROVAL"];
const KYC_SB_LABELS = { identity: "Identité du client", ubo: "Ayants droit & contrôle", persons: "Personnes liées",
relation: "Relation d'affaires", sofsow: "Origine des fonds & de la fortune", mandat: "Mandat de gestion",
screening: "Screening", risk: "Profil de risque", aml: "AML / LBA", tax: "Fiscalité",
crossborder: "Cross-border", esg: "ESG", docs: "Documents (CDB)", workflow: "Workflow & validation" };
const KYC_SB_DROITS = ["EDIT", "VIEW", "REQUIRED", "HIDDEN"];

export function KycSandboxScreen() {
const secs = Object.keys(QUESTIONS_TEMPLATE).map(function (id) { return { id: id, label: KYC_SB_LABELS[id] || id }; });
const [secId, setSecId] = useState(secs[0].id);
const [draft, setDraft] = useState(function () {
return (QUESTIONS_TEMPLATE[secs[0].id] || []).map(function (q) { return { id: q.id, q: q.q, right: q.right, neuf: false }; });
});
const [nq, setNq] = useState("");
const [nqRight, setNqRight] = useState("REQUIRED");
const [dateEff, setDateEff] = useState("2026-09-01");
const [msg, setMsg] = useState(null);
useEffect(function () {
setDraft((QUESTIONS_TEMPLATE[secId] || []).map(function (q) { return { id: q.id, q: q.q, right: q.right, neuf: false }; }));
setMsg(null);
setNq("");
}, [secId]);
const base = QUESTIONS_TEMPLATE[secId] || [];
const orig = {};
base.forEach(function (q) { orig[q.id] = q.right; });
const durcies = draft.filter(function (q) { return q.right === "REQUIRED" && orig[q.id] !== "REQUIRED"; });
const relachees = draft.filter(function (q) { return q.right !== "REQUIRED" && orig[q.id] === "REQUIRED"; });
const masquees = draft.filter(function (q) { return q.right === "HIDDEN" && orig[q.id] !== "HIDDEN"; });
const modifie = durcies.length || relachees.length || masquees.length || draft.some(function (q) { return q.neuf; })
|| draft.some(function (q) { return orig[q.id] && orig[q.id] !== q.right; });
const reqAvant = base.filter(function (q) { return q.right === "REQUIRED"; }).length;
const reqApres = draft.filter(function (q) { return q.right === "REQUIRED"; }).length;
const reqGlobalAvant = Object.keys(QUESTIONS_TEMPLATE).reduce(function (a, k) {
return a + QUESTIONS_TEMPLATE[k].filter(function (q) { return q.right === "REQUIRED"; }).length;
}, 0);
const enCours = KYCS_DATA.filter(function (k) { return KYC_SB_ENCOURS.indexOf(k.status) >= 0; });
const approuves = KYCS_DATA.filter(function (k) { return k.status === "APPROVED"; });
const nouvExig = durcies.length + draft.filter(function (q) { return q.neuf && q.right === "REQUIRED"; }).length;
const impactes = nouvExig > 0 ? enCours : [];
const charge = impactes.length * nouvExig;
const parRm = {};
impactes.forEach(function (k) { parRm[k.rm] = (parRm[k.rm] || 0) + nouvExig; });
const topRm = Object.keys(parRm).sort(function (a, b) { return parRm[b] - parRm[a]; }).slice(0, 3);
function setRight(id, v) { setDraft(draft.map(function (q) { return q.id === id ? Object.assign({}, q, { right: v }) : q; })); }
function ajouter() {
if (!nq.trim()) {
setMsg({ k: "err", t: "Libellé de la question requis." });
return;
}
var code = (secId.slice(0, 3).toUpperCase()) + "-Q" + (draft.length + 1);
setDraft(draft.concat([{ id: code, q: nq.trim(), right: nqRight, neuf: true }]));
setNq("");
setMsg(null);
}
function reset() { setDraft(base.map(function (q) { return { id: q.id, q: q.q, right: q.right, neuf: false }; })); setMsg(null); }
function appliquer() {
if (!modifie) {
setMsg({ k: "err", t: "Aucune modification à appliquer." });
return;
}
QUESTIONS_TEMPLATE[secId] = draft.map(function (q) {
var ex = base.find(function (b) { return b.id === q.id; });
return ex ? Object.assign({}, ex, { right: q.right })
: { id: q.id, q: q.q, a: "", right: q.right, by: "—", at: "—", changed: false };
});
pushParamAudit("K. Weber (ADMIN)", "Questionnaire KYC « " + (secs.find(function (x) { return x.id === secId; }) || {}).label + " » modifié (effet " + dateEff + ") : "
+ (durcies.length ? durcies.length + " question(s) rendue(s) obligatoire(s) · " : "")
+ (relachees.length ? relachees.length + " assouplie(s) · " : "")
+ (masquees.length ? masquees.length + " masquée(s) · " : "")
+ draft.filter(function (q) { return q.neuf; }).length + " ajoutée(s) — " + impactes.length + " dossier(s) en cours impacté(s), "
+ approuves.length + " approuvé(s) protégé(s) par grandfathering");
setMsg({ k: "ok", t: "Appliqué avec effet au " + dateEff + ". Les " + approuves.length + " dossiers approuvés conservent le questionnaire en vigueur à leur validation (R29/R48)." });
}
const card = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 16, marginBottom: 14 };
const kpi = function (v, l, c) {
return (React.createElement("div", { style: { padding: "9px 16px", borderRadius: 10, background: c + "12", border: "1px solid " + c + "30", minWidth: 112 } },
React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: c, fontFamily: "monospace" } }, v),
React.createElement("div", { style: { fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4 } }, l)));
};
const th = { padding: "8px 10px", textAlign: "left", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 };
return (React.createElement("div", null,
React.createElement("div", { style: { marginBottom: 12 } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
React.createElement("div", { style: { fontSize: 21, fontWeight: 800, color: T.ink } }, "Bac \u00E0 sable KYC \u2014 sections & questions"),
React.createElement("span", { style: { fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: T.olive600 + "15", color: T.olive700 } }, "DRY-RUN \u00B7 aucune \u00E9criture")),
React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginTop: 4, maxWidth: 960, lineHeight: 1.6 } },
"Changer un questionnaire est le param\u00E9trage le plus lourd de cons\u00E9quences : rendre une question obligatoire rend ",
React.createElement("b", null, "incomplets d'un coup tous les dossiers en cours"),
". Ici, on voit combien \u2014 et qui devra faire le travail \u2014 avant d'\u00E9crire quoi que ce soit.")),
msg && React.createElement("div", { style: { marginBottom: 12, padding: "9px 12px", borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
background: msg.k === "ok" ? T.greenSoft : T.redSoft, color: msg.k === "ok" ? T.green : T.red, border: "1px solid " + (msg.k === "ok" ? T.green : T.red) + "30" } }, msg.t),
React.createElement("div", { style: card },
React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } },
React.createElement("span", { style: { fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase" } }, "Section"),
React.createElement("select", { value: secId, onChange: function (e) { setSecId(e.target.value); }, style: { padding: "8px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12, minWidth: 280 } }, secs.map(function (x) { return React.createElement("option", { key: x.id, value: x.id },
x.label,
" \u2014 ",
QUESTIONS_TEMPLATE[x.id].length,
" questions"); })),
React.createElement("span", { style: { fontSize: 11, color: T.inkSoft } },
"Obligatoires : ",
React.createElement("b", { className: "mono" }, reqAvant),
" \u2192 ",
React.createElement("b", { style: { color: reqApres > reqAvant ? T.red : (reqApres < reqAvant ? T.green : T.ink) } }, reqApres),
" \u00B7 toutes sections : ",
reqGlobalAvant))),
React.createElement("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 } },
kpi(impactes.length, "dossiers en cours impactés", impactes.length ? T.red : T.inkSoft),
kpi(approuves.length, "approuvés protégés (R29)", T.green),
kpi(charge, "réponses à collecter", T.violet),
kpi(durcies.length + draft.filter(function (q) { return q.neuf && q.right === "REQUIRED"; }).length, "nouvelles exigences", T.amber),
kpi(relachees.length, "exigences levées", T.olive700)),
React.createElement(SbStress, { titre: "charge induite", unite: "nombre de questions rendues obligatoires", niveau: sbTension(charge, 0, 0, impactes.length), sousTitre: "Chaque exigence nouvelle se multiplie par le nombre de dossiers en cours.", curIdx: Math.min(nouvExig, 4), points: [0, 1, 2, 3, 4].map(function (n) { return { x: n === 0 ? "aucune" : "+" + n, v: n * enCours.length }; }) }),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 3 } }, "Questions de la section"),
React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, marginBottom: 10 } }, "REQUIRED = contribution obligatoire (bloque la validation) \u00B7 HIDDEN = la question n'atteint jamais le r\u00F4le."),
React.createElement("table", { style: { width: "100%", borderCollapse: "collapse" } },
React.createElement("thead", null,
React.createElement("tr", { style: { background: T.lineSoft } }, ["Question", "Droit actuel", "Droit simulé", "Impact"].map(function (h) { return React.createElement("th", { key: h, style: th }, h); }))),
React.createElement("tbody", null, draft.map(function (q) {
const av = orig[q.id];
const durcie = q.right === "REQUIRED" && av !== "REQUIRED";
const relachee = q.right !== "REQUIRED" && av === "REQUIRED";
return (React.createElement("tr", { key: q.id, style: { borderBottom: "1px solid " + T.lineSoft } },
React.createElement("td", { style: { padding: "8px 10px", fontSize: 11.5, color: T.ink } },
q.q,
React.createElement("div", { style: { fontSize: 9.5, color: T.inkSoft, fontFamily: "monospace" } },
q.id,
q.neuf ? " · NOUVELLE" : "")),
React.createElement("td", { style: { padding: "8px 10px", fontSize: 11, color: T.inkSoft, fontFamily: "monospace" } }, av || "—"),
React.createElement("td", { style: { padding: "8px 10px" } },
React.createElement("select", { value: q.right, onChange: function (e) { setRight(q.id, e.target.value); }, style: { padding: "4px 7px", borderRadius: 7, border: "1px solid " + (av && av !== q.right ? T.olive600 : T.line), fontSize: 11, fontWeight: av && av !== q.right ? 800 : 400 } }, KYC_SB_DROITS.map(function (d) { return React.createElement("option", { key: d, value: d }, d); }))),
React.createElement("td", { style: { padding: "8px 10px", fontSize: 10.5, fontWeight: 700 } },
durcie && React.createElement("span", { style: { color: T.red } },
"\u25B2 ",
enCours.length,
" dossiers en cours devront r\u00E9pondre"),
relachee && React.createElement("span", { style: { color: T.green } }, "\u25BC exigence lev\u00E9e"),
q.right === "HIDDEN" && av !== "HIDDEN" && React.createElement("span", { style: { color: T.amber } }, "\u2298 masqu\u00E9e pour les r\u00F4les"),
!durcie && !relachee && !(q.right === "HIDDEN" && av !== "HIDDEN") && React.createElement("span", { style: { color: T.inkSoft } }, "\u2014"))));
}))),
React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" } },
React.createElement("input", { value: nq, onChange: function (e) { setNq(e.target.value); }, placeholder: "Nouvelle question \u00E0 ajouter \u00E0 la section", style: { flex: "1 1 340px", padding: "8px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12 } }),
React.createElement("select", { value: nqRight, onChange: function (e) { setNqRight(e.target.value); }, style: { padding: "8px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12 } }, KYC_SB_DROITS.map(function (d) { return React.createElement("option", { key: d, value: d }, d); })),
React.createElement("button", { onClick: ajouter, style: { padding: "8px 15px", borderRadius: 8, border: "none", background: T.olive600, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer" } }, "Ajouter"),
React.createElement("button", { onClick: reset, style: { padding: "8px 15px", borderRadius: 8, border: "1px solid " + T.line, background: "transparent", color: T.inkMid, fontSize: 11.5, fontWeight: 700, cursor: "pointer" } }, "R\u00E9initialiser"))),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 } },
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: impactes.length ? T.red : T.inkSoft, marginBottom: 8 } },
"\u25B2 Dossiers en cours impact\u00E9s (",
impactes.length,
")"),
impactes.length === 0 && React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft } }, "Aucun \u2014 le param\u00E9trage simul\u00E9 n'ajoute aucune exigence."),
impactes.slice(0, 10).map(function (k) {
return (React.createElement("div", { key: k.code, style: { display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderBottom: "1px solid " + T.lineSoft, fontSize: 11 } },
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkSoft } }, k.code),
React.createElement("span", { style: { color: T.ink, fontWeight: 600, flex: 1 } }, k.clientName),
React.createElement("span", { style: { color: T.inkSoft } }, k.status),
React.createElement("span", { style: { fontFamily: "monospace", color: k.totalPct < 60 ? T.red : T.amber } },
k.totalPct,
"%")));
}),
impactes.length > 10 && React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginTop: 6 } },
"+ ",
impactes.length - 10,
" autres\u2026")),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 8 } }, "Qui fera le travail ?"),
topRm.length === 0 && React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft } }, "Aucune charge induite."),
topRm.map(function (rm) {
return (React.createElement("div", { key: rm, style: { display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid " + T.lineSoft, fontSize: 11.5 } },
React.createElement("span", { style: { color: T.ink } }, rm),
React.createElement("span", { style: { fontFamily: "monospace", fontWeight: 800, color: T.violet } },
parRm[rm],
" r\u00E9ponse",
parRm[rm] > 1 ? "s" : "")));
}),
React.createElement("div", { style: { marginTop: 10, fontSize: 10.5, color: T.inkSoft, lineHeight: 1.5 } }, "Une exigence nouvelle n'est jamais gratuite : elle se paie en temps de gestionnaire. Le voir avant d'appliquer, c'est pouvoir l'\u00E9taler dans le temps."))),
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
var draftCopie = draft.map(function (q) { return Object.assign({}, q); }), sid = secId, baseCopie = base;
sbProposer({ source: "KYC", by: "C. Dupont (Central File)", role: "CF", dateEff: dateEff,
titre: "Questionnaire « " + (KYC_SB_LABELS[secId] || secId) + " »",
detail: (durcies.length ? durcies.length + " question(s) rendue(s) obligatoire(s)" : "") + (relachees.length ? " · " + relachees.length + " assouplie(s)" : "") + (draft.filter(function (q) { return q.neuf; }).length ? " · " + draft.filter(function (q) { return q.neuf; }).length + " ajoutée(s)" : ""),
impacts: [{ k: "dossiers en cours impactés", v: impactes.length }, { k: "réponses à collecter", v: charge }, { k: "nouvelles exigences", v: nouvExig }],
apply: function () {
QUESTIONS_TEMPLATE[sid] = draftCopie.map(function (q) {
var ex = baseCopie.find(function (b) { return b.id === q.id; });
return ex ? Object.assign({}, ex, { right: q.right }) : { id: q.id, q: q.q, a: "", right: q.right, by: "—", at: "—", changed: false };
});
} });
setMsg({ k: "ok", t: "Recommandation soumise au comité de paramétrage." });
}, disabled: !modifie, style: { padding: "9px 18px", borderRadius: 9, border: "1px solid " + (modifie ? T.violet : T.line), background: "transparent", color: modifie ? T.violet : T.inkSoft, fontSize: 12, fontWeight: 800, cursor: modifie ? "pointer" : "not-allowed" } }, "\u2696 Proposer au comit\u00E9"),
React.createElement("span", { style: { fontSize: 10.5, color: T.inkSoft } }, modifie ? "Modifications en attente — non écrites." : "Questionnaire identique à la production.")))));
}
