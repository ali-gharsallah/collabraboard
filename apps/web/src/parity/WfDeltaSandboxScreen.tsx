import React, { useState } from "react";
import { T } from "./tokens";
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import { pushParamAudit } from "./param-audit-support";
import { sbTension, SbStress, sbProposer } from "./sandbox-support";

// Source : docs/reference/olive-demo.html 19856-20016 — WfDeltaSandboxScreen (bac à sable Workflow — visas & goulots).
// WF_KYC_SECTIONS_PARAM (21782), WF_SB_ROLES (19856), KYC_SB_ENCOURS inline (verbatim).

const WF_SB_ROLES = ["ARM", "CO", "CO Senior", "Resp. AML (MLRO)", "BRM", "Central File", "ESG Officer", "Legal", "Head of PB", "CEO"];
const KYC_SB_ENCOURS = ["DRAFT", "IN_PROGRESS", "UNDER_REVIEW", "PENDING_APPROVAL"];
const WF_KYC_SECTIONS_PARAM = [
{ code: "IDENT", label: "1. Identité du client", visa: true, val: "ARM", sup: "CO" },
{ code: "UBO", label: "2. Ayants droit & contrôle", visa: true, val: "CO", sup: "CO Senior" },
{ code: "LIEES", label: "3. Personnes liées", visa: false, val: "ARM", sup: "CO" },
{ code: "REL", label: "4. Relation d’affaires", visa: true, val: "ARM", sup: "CO" },
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

export default function WfDeltaSandboxScreen() {
const [draft, setDraft] = useState(function () { return WF_KYC_SECTIONS_PARAM.map(function (x: any) { return { code: x.code, label: x.label, visa: x.visa, val: x.val, sup: x.sup }; }); });
const [dateEff, setDateEff] = useState("2026-09-01");
const [msg, setMsg] = useState<any>(null);
const base = WF_KYC_SECTIONS_PARAM;
const enCours = (KYCS_DATA as any[]).filter(function (k: any) { return KYC_SB_ENCOURS.indexOf(k.status) >= 0; });
const modifie = JSON.stringify(draft.map(function (x: any) { return [x.visa, x.val, x.sup]; }))
!== JSON.stringify(base.map(function (x: any) { return [x.visa, x.val, x.sup]; }));
const visasA = base.filter(function (x: any) { return x.visa; });
const visasB = draft.filter(function (x: any) { return x.visa; });
const ajoutes = draft.filter(function (x: any) { var b = base.find(function (y: any) { return y.code === x.code; }); return x.visa && b && !b.visa; });
const retires = draft.filter(function (x: any) { var b = base.find(function (y: any) { return y.code === x.code; }); return !x.visa && b && b.visa; });
const reassignes = draft.filter(function (x: any) { var b = base.find(function (y: any) { return y.code === x.code; }); return x.visa && b && b.visa && b.val !== x.val; });
// charge par rôle = nb de sections à viser × dossiers en cours
const chargeA: any = {}, chargeB: any = {};
visasA.forEach(function (x: any) { chargeA[x.val] = (chargeA[x.val] || 0) + enCours.length; });
visasB.forEach(function (x: any) { chargeB[x.val] = (chargeB[x.val] || 0) + enCours.length; });
const totalB = Object.keys(chargeB).reduce(function (a: any, k: any) { return a + chargeB[k]; }, 0);
const rolesTries = Object.keys(chargeB).sort(function (a: any, b: any) { return chargeB[b] - chargeA[a]; });
const goulot = rolesTries.length ? rolesTries.reduce(function (m: any, k: any) { return chargeB[k] > (chargeB[m] || 0) ? k : m; }, rolesTries[0]) : null;
const partGoulot = goulot && totalB ? Math.round(chargeB[goulot] / totalB * 100) : 0;
// conflits : le suppléant est le validateur lui-même → aucun relais réel (R4)
const conflits = draft.filter(function (x: any) { return x.visa && x.val === x.sup; });
const deltaSign = totalB - Object.keys(chargeA).reduce(function (a: any, k: any) { return a + chargeA[k]; }, 0);
function maj(code: any, champ: any, v: any) { setDraft(draft.map(function (x: any) { return x.code === code ? Object.assign({}, x, (function () { var o: any = {}; o[champ] = v; return o; })()) : x; })); }
function reset() { setDraft(base.map(function (x: any) { return { code: x.code, label: x.label, visa: x.visa, val: x.val, sup: x.sup }; })); setMsg(null); }
function ecrire() { draft.forEach(function (x: any) { var t = base.find(function (y: any) { return y.code === x.code; }); if (t) {
t.visa = x.visa;
t.val = x.val;
t.sup = x.sup;
} }); }
function appliquer() {
if (!modifie) {
setMsg({ k: "err", t: "Aucune modification à appliquer." });
return;
}
ecrire();
pushParamAudit("K. Weber (ADMIN)", "Chaîne de visas KYC modifiée (effet " + dateEff + ") : " + visasB.length + " visa(s) requis (" + (ajoutes.length ? "+" + ajoutes.length : "") + (retires.length ? " −" + retires.length : "") + (reassignes.length ? " · " + reassignes.length + " réassigné(s)" : "") + ") — " + deltaSign + " signature(s) supplémentaire(s) sur " + enCours.length + " dossiers en cours");
setMsg({ k: "ok", t: "Appliqué avec effet au " + dateEff + ". Les dossiers déjà validés conservent la chaîne de visas en vigueur à leur validation (R29/R48)." });
}
function proposer() {
if (!modifie) {
setMsg({ k: "err", t: "Aucune modification à proposer." });
return;
}
var copie = draft.map(function (x: any) { return Object.assign({}, x); });
sbProposer({ source: "BRM", by: "H. Peters (Head of PB)", role: "HPB", dateEff: dateEff,
titre: "Chaîne de visas KYC — " + visasB.length + " visa(s)",
detail: (ajoutes.length ? ajoutes.length + " visa(s) ajouté(s)" : "") + (retires.length ? " · " + retires.length + " retiré(s)" : "") + (reassignes.length ? " · " + reassignes.length + " réassigné(s)" : "") + (goulot ? " · goulot : " + goulot + " (" + partGoulot + "%)" : ""),
impacts: [{ k: "signatures supplémentaires", v: deltaSign }, { k: "visas requis", v: visasB.length - visasA.length }, { k: "conflits de relais", v: conflits.length }],
apply: function () { copie.forEach(function (x: any) { var t = base.find(function (y: any) { return y.code === x.code; }); if (t) {
t.visa = x.visa;
t.val = x.val;
t.sup = x.sup;
} }); } });
setMsg({ k: "ok", t: "Recommandation soumise au comité de paramétrage." });
}
const card = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 16, marginBottom: 14 };
const kpi = function (v: any, l: any, c: any) {
return (React.createElement("div", { style: { padding: "9px 16px", borderRadius: 10, background: c + "12", border: "1px solid " + c + "30", minWidth: 112 } },
React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: c, fontFamily: "monospace" } }, v),
React.createElement("div", { style: { fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4 } }, l)));
};
const th = { padding: "8px 10px", textAlign: "left" as const, fontSize: 10, color: T.inkSoft, textTransform: "uppercase" as const, letterSpacing: 0.5 };
return (React.createElement("div", null,
React.createElement("div", { style: { marginBottom: 12 } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
React.createElement("div", { style: { fontSize: 21, fontWeight: 800, color: T.ink } }, "Bac à sable Workflow — visas & goulots"),
React.createElement("span", { style: { fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: T.olive600 + "15", color: T.olive700 } }, "DRY-RUN · aucune écriture")),
React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginTop: 4, maxWidth: 1000, lineHeight: 1.6 } },
"Ajouter un visa paraît prudent. En réalité on ajoute ",
React.createElement("b", null,
enCours.length,
" signatures"),
" à collecter — et souvent sur un rôle déjà saturé : le dossier attend. R39 : le système ",
React.createElement("b", null, "montre"),
" le goulot, il ne l'impose pas.")),
msg && React.createElement("div", { style: { marginBottom: 12, padding: "9px 12px", borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
background: msg.k === "ok" ? T.greenSoft : T.redSoft, color: msg.k === "ok" ? T.green : T.red, border: "1px solid " + (msg.k === "ok" ? T.green : T.red) + "30" } }, msg.t),
React.createElement("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 } },
kpi(visasA.length + " → " + visasB.length, "visas requis", T.olive700),
kpi((deltaSign > 0 ? "+" : "") + deltaSign, "signatures à collecter", deltaSign > 0 ? T.red : (deltaSign < 0 ? T.green : T.inkSoft)),
kpi(goulot ? partGoulot + "%" : "—", "part du goulot", partGoulot >= 40 ? T.red : T.amber),
kpi(conflits.length, "relais fictifs (R4)", conflits.length ? T.red : T.green),
kpi(enCours.length, "dossiers en cours", T.violet)),
React.createElement(SbStress, { titre: "signatures à collecter", unite: "nombre de sections avec visa", niveau: sbTension(deltaSign > 0 ? deltaSign : 0, 0, 0, conflits.length * 10), sousTitre: "La charge de signature croît avec chaque visa exigé — multipliée par les dossiers en cours.", curIdx: Math.min(4, Math.max(0, Math.round(visasB.length / Math.max(1, draft.length) * 4))), points: [0, 0.25, 0.5, 0.75, 1].map(function (f: any) {
var n = Math.round(f * draft.length);
return { x: n + " visas", v: n * enCours.length };
}) }),
goulot && partGoulot >= 40 && (React.createElement("div", { style: { background: T.redSoft, border: "1px solid " + T.red + "40", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 11.5, color: T.red, lineHeight: 1.55 } },
"⚠ ",
React.createElement("b", null,
"Goulot d'étranglement : ",
goulot),
" concentre ",
partGoulot,
"% des signatures (",
chargeB[goulot],
" sur ",
totalB,
"). Un rôle saturé, c'est un délai — pas un contrôle. Répartir les validateurs vaut mieux qu'ajouter un visa.")),
conflits.length > 0 && (React.createElement("div", { style: { background: T.amberSoft, border: "1px solid " + T.amber + "40", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 11.5, color: T.amber, lineHeight: 1.55 } },
"⚖ ",
React.createElement("b", null,
conflits.length,
" relais fictif",
conflits.length > 1 ? "s" : ""),
" : ",
conflits.map(function (x: any) { return x.code; }).join(", "),
" — le suppléant est le validateur lui-même. En cas d'absence, aucun relais réel (R4) : le dossier attend ou passe par une dérogation tracée.")),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14 } },
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 3 } }, "Chaîne de visas par section"),
React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, marginBottom: 10 } }, "Le validateur signe ; le suppléant est son relais nommé en cas d'absence (R4). Les deux doivent différer."),
React.createElement("table", { style: { width: "100%", borderCollapse: "collapse" } },
React.createElement("thead", null,
React.createElement("tr", { style: { background: T.lineSoft } }, ["Section", "Visa", "Validateur", "Suppléant (R4)"].map(function (h: any) { return React.createElement("th", { key: h, style: th }, h); }))),
React.createElement("tbody", null, draft.map(function (x: any) {
const b: any = base.find(function (y: any) { return y.code === x.code; }) || {};
const chg = x.visa !== b.visa || x.val !== b.val || x.sup !== b.sup;
return (React.createElement("tr", { key: x.code, style: { borderBottom: "1px solid " + T.lineSoft, background: chg ? T.oliveSoft + "55" : "transparent" } },
React.createElement("td", { style: { padding: "7px 10px", fontSize: 11.5, color: T.ink } }, x.label),
React.createElement("td", { style: { padding: "7px 10px" } },
React.createElement("button", { onClick: function () { maj(x.code, "visa", !x.visa); }, style: { padding: "3px 9px", borderRadius: 6, minWidth: 48,
border: "1px solid " + (x.visa ? T.green : T.line), background: x.visa ? T.greenSoft : "transparent", color: x.visa ? T.green : T.inkSoft, fontSize: 9.5, fontWeight: 800, cursor: "pointer" } }, x.visa ? "Requis" : "Aucun")),
React.createElement("td", { style: { padding: "7px 10px" } },
React.createElement("select", { value: x.val, disabled: !x.visa, onChange: function (e: any) { maj(x.code, "val", e.target.value); }, style: { padding: "3px 6px", borderRadius: 6, border: "1px solid " + (x.val !== b.val ? T.olive600 : T.line), fontSize: 10.5, opacity: x.visa ? 1 : 0.4 } }, WF_SB_ROLES.map(function (r: any) { return React.createElement("option", { key: r, value: r }, r); }))),
React.createElement("td", { style: { padding: "7px 10px" } },
React.createElement("select", { value: x.sup, disabled: !x.visa, onChange: function (e: any) { maj(x.code, "sup", e.target.value); }, style: { padding: "3px 6px", borderRadius: 6, border: "1px solid " + (x.visa && x.val === x.sup ? T.red : T.line), fontSize: 10.5, opacity: x.visa ? 1 : 0.4 } }, WF_SB_ROLES.map(function (r: any) { return React.createElement("option", { key: r, value: r }, r); })))));
})))),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 8 } }, "Charge de signature par rôle"),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 10 } },
"Sur les ",
enCours.length,
" dossiers en cours."),
rolesTries.map(function (r: any) {
const a = chargeA[r] || 0, b2 = chargeB[r] || 0, pct = totalB ? Math.round(b2 / totalB * 100) : 0;
return (React.createElement("div", { key: r, style: { marginBottom: 9 } },
React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 } },
React.createElement("span", { style: { color: T.ink, fontWeight: r === goulot ? 800 : 400 } },
r,
r === goulot ? " · goulot" : ""),
React.createElement("span", { style: { fontFamily: "monospace", color: b2 > a ? T.red : (b2 < a ? T.green : T.inkSoft) } },
a,
" → ",
b2)),
React.createElement("div", { style: { height: 6, background: T.lineSoft, borderRadius: 4, overflow: "hidden" } },
React.createElement("div", { style: { height: "100%", width: pct + "%", background: r === goulot && pct >= 40 ? T.red : T.olive600 } }))));
}),
rolesTries.length === 0 && React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft } }, "Aucun visa requis — aucune charge."))),
React.createElement("div", { style: card },
React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } },
React.createElement("span", { style: { fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase" } }, "Date de mise en vigueur (R29)"),
React.createElement("input", { type: "date", value: dateEff, onChange: function (e: any) { setDateEff(e.target.value); }, style: { padding: "7px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12 } }),
React.createElement("button", { onClick: appliquer, disabled: !modifie, style: { padding: "9px 18px", borderRadius: 9, border: "none", background: modifie ? T.olive700 : T.line, color: "#fff", fontSize: 12, fontWeight: 800, cursor: modifie ? "pointer" : "not-allowed" } }, "Appliquer en production"),
React.createElement("button", { onClick: proposer, disabled: !modifie, style: { padding: "9px 18px", borderRadius: 9, border: "1px solid " + (modifie ? T.violet : T.line), background: "transparent", color: modifie ? T.violet : T.inkSoft, fontSize: 12, fontWeight: 800, cursor: modifie ? "pointer" : "not-allowed" } }, "⚖ Proposer au comité"),
React.createElement("button", { onClick: reset, style: { padding: "9px 16px", borderRadius: 9, border: "1px solid " + T.line, background: "transparent", color: T.inkMid, fontSize: 12, fontWeight: 700, cursor: "pointer" } }, "Réinitialiser"),
React.createElement("span", { style: { fontSize: 10.5, color: T.inkSoft } }, modifie ? "Modifications en attente — non écrites." : "Chaîne identique à la production.")))));
}
