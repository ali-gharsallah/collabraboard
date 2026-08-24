import React, { useState } from "react";
import { T } from "./tokens";
import CLIENTS from "../fixtures/CLIENTS.json";
import { DOC_STRUCTURES, DOC_RULES_DEFAULT, computeRequiredDocs } from "./preonboarding-support";
import { pushParamAudit } from "./param-audit-support";
import { sbTension, SbStress, sbProposer } from "./sandbox-support";

// Source : docs/reference/olive-demo.html 19713-19856 — CfSandboxScreen (bac à sable Central File — matrice documentaire).
// DOC_LIST/DOC_RULES_DEFAULT/docRuleEval/computeRequiredDocs portés dans preonboarding-support (verbatim).

export default function CfSandboxScreen() {
const structs = DOC_STRUCTURES;
const [stId, setStId] = useState("PP");
const [regles, setRegles] = useState(function () { return DOC_RULES_DEFAULT.map(function (r: any) { return { id: r.id, label: r.label, desc: r.desc, on: r.on }; }); });
const [dateEff, setDateEff] = useState("2026-09-01");
const [msg, setMsg] = useState<any>(null);
const base = computeRequiredDocs(stId, DOC_RULES_DEFAULT);
const sim = computeRequiredDocs(stId, regles);
const nomsB = base.docs.map(function (d: any) { return d.doc; });
const nomsS = sim.docs.map(function (d: any) { return d.doc; });
const nouveaux = sim.docs.filter(function (d: any) { return nomsB.indexOf(d.doc) < 0; });
const retires = base.docs.filter(function (d: any) { return nomsS.indexOf(d.doc) < 0; });
const modifie = JSON.stringify(regles.map(function (r: any) { return r.on; })) !== JSON.stringify(DOC_RULES_DEFAULT.map(function (r: any) { return r.on; }));
const clients = (CLIENTS as any[]).filter(function (c: any) { return c.type === stId; });
const charge = clients.length * nouveaux.length;
const actives = regles.filter(function (r: any) { return r.on; }).length;
function toggle(id: any) { setRegles(regles.map(function (r: any) { return r.id === id ? Object.assign({}, r, { on: !r.on }) : r; })); }
function reset() { setRegles(DOC_RULES_DEFAULT.map(function (r: any) { return { id: r.id, label: r.label, desc: r.desc, on: r.on }; })); setMsg(null); }
function appliquer() {
if (!modifie) {
setMsg({ k: "err", t: "Aucune modification à appliquer." });
return;
}
regles.forEach(function (r: any) { var t = DOC_RULES_DEFAULT.find(function (x: any) { return x.id === r.id; }); if (t)
t.on = r.on; });
pushParamAudit("K. Weber (ADMIN)", "Matrice documentaire modifiée (effet " + dateEff + ") : " + actives + " règle(s) active(s) — structure " + sim.struct.name
+ " : " + nouveaux.length + " document(s) exigé(s) en plus, " + retires.length + " retiré(s), " + clients.length + " client(s) concerné(s)");
setMsg({ k: "ok", t: "Appliqué avec effet au " + dateEff + ". Les dossiers déjà validés restent conformes à la matrice en vigueur à leur validation (R29/R48)." });
}
function proposer() {
if (!modifie) {
setMsg({ k: "err", t: "Aucune modification à proposer." });
return;
}
var copie = regles.map(function (r: any) { return { id: r.id, on: r.on }; });
sbProposer({ source: "REF", by: "C. Dupont (Central File)", role: "CF", dateEff: dateEff,
titre: "Matrice documentaire — " + sim.struct.name,
detail: actives + " règle(s) active(s) · " + (nouveaux.length ? nouveaux.length + " document(s) en plus" : "") + (retires.length ? " · " + retires.length + " retiré(s)" : ""),
impacts: [{ k: "documents exigés en plus", v: nouveaux.length }, { k: "clients à relancer", v: nouveaux.length ? clients.length : 0 }, { k: "réponses à collecter", v: charge }],
apply: function () { copie.forEach(function (r: any) { var t = DOC_RULES_DEFAULT.find(function (x: any) { return x.id === r.id; }); if (t)
t.on = r.on; }); } });
setMsg({ k: "ok", t: "Recommandation soumise au comité de paramétrage." });
}
const card = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 16, marginBottom: 14 };
const kpi = function (v: any, l: any, c: any) {
return (React.createElement("div", { style: { padding: "9px 16px", borderRadius: 10, background: c + "12", border: "1px solid " + c + "30", minWidth: 112 } },
React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: c, fontFamily: "monospace" } }, v),
React.createElement("div", { style: { fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4 } }, l)));
};
return (React.createElement("div", null,
React.createElement("div", { style: { marginBottom: 12 } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
React.createElement("div", { style: { fontSize: 21, fontWeight: 800, color: T.ink } }, "Bac à sable Central File — matrice documentaire"),
React.createElement("span", { style: { fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: T.olive600 + "15", color: T.olive700 } }, "DRY-RUN · aucune écriture")),
React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginTop: 4, maxWidth: 980, lineHeight: 1.6 } },
"Activer une règle documentaire, c'est exiger une pièce de plus ",
React.createElement("b", null, "à chaque client concerné"),
". Le Central File voit ici ce que sa décision produit : documents requis, clients à relancer, charge de collecte.")),
msg && React.createElement("div", { style: { marginBottom: 12, padding: "9px 12px", borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
background: msg.k === "ok" ? T.greenSoft : T.redSoft, color: msg.k === "ok" ? T.green : T.red, border: "1px solid " + (msg.k === "ok" ? T.green : T.red) + "30" } }, msg.t),
React.createElement("div", { style: card },
React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } },
React.createElement("span", { style: { fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase" } }, "Structure"),
React.createElement("select", { value: stId, onChange: function (e: any) { setStId(e.target.value); }, style: { padding: "8px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12, minWidth: 250 } }, structs.map(function (x: any) { return React.createElement("option", { key: x.id, value: x.id },
x.name,
" — ",
(CLIENTS as any[]).filter(function (c: any) { return c.type === x.id; }).length,
" clients"); })),
React.createElement("span", { style: { fontSize: 11, color: T.inkSoft } },
"Colonnes : ",
sim.cols.join(" · ")))),
React.createElement("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 } },
kpi(base.docs.length + " → " + sim.docs.length, "documents requis", T.olive700),
kpi(nouveaux.length, "exigés en plus", nouveaux.length ? T.red : T.inkSoft),
kpi(retires.length, "retirés", retires.length ? T.green : T.inkSoft),
kpi(nouveaux.length ? clients.length : 0, "clients à relancer", T.violet),
kpi(charge, "pièces à collecter", T.amber)),
React.createElement(SbStress, { titre: "charge documentaire", unite: "part des règles activées", niveau: sbTension(charge, 0, 0, nouveaux.length ? clients.length : 0), sousTitre: "Combien de documents la structure exige selon le nombre de règles actives.", curIdx: Math.min(4, Math.round(actives / Math.max(1, regles.length) * 4)), points: [0, 0.25, 0.5, 0.75, 1].map(function (f: any) {
var n = Math.round(f * regles.length);
var rr = regles.map(function (r: any, i: any) { return Object.assign({}, r, { on: i < n }); });
return { x: n + " règles", v: computeRequiredDocs(stId, rr).docs.length };
}) }),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 14 } },
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 3 } }, "Règles documentaires"),
React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, marginBottom: 10 } },
actives,
" active",
actives > 1 ? "s" : "",
" sur ",
regles.length,
". Chaque règle décide quelles pièces deviennent obligatoires (M) selon la structure et le rôle."),
React.createElement("div", { style: { maxHeight: 300, overflowY: "auto" } }, regles.map(function (r: any) {
const ref = (DOC_RULES_DEFAULT.find(function (x: any) { return x.id === r.id; }) || {}).on;
return (React.createElement("div", { key: r.id, style: { display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("button", { onClick: function () { toggle(r.id); }, style: { padding: "3px 9px", borderRadius: 6, minWidth: 52,
border: "1px solid " + (r.on ? T.green : T.line), background: r.on ? T.greenSoft : "transparent",
color: r.on ? T.green : T.inkSoft, fontSize: 9.5, fontWeight: 800, cursor: "pointer" } }, r.on ? "Active" : "Inactive"),
React.createElement("div", { style: { flex: 1 } },
React.createElement("div", { style: { fontSize: 11.5, fontWeight: 700, color: T.ink } },
r.label,
React.createElement("span", { style: { fontSize: 9.5, color: T.inkSoft, fontFamily: "monospace", fontWeight: 400 } },
" · ",
r.id),
r.on !== ref && React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: T.violet, marginLeft: 6 } }, "modifiée")),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, lineHeight: 1.45, marginTop: 2 } }, r.desc))));
}))),
React.createElement("div", null,
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.red, marginBottom: 8 } },
"▲ Documents exigés en plus (",
nouveaux.length,
")"),
nouveaux.length === 0 && React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft } }, "Aucun — la matrice simulée n'ajoute rien."),
nouveaux.map(function (d: any) {
return (React.createElement("div", { key: d.doc, style: { display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderBottom: "1px solid " + T.lineSoft, fontSize: 11 } },
React.createElement("span", { style: { color: T.ink, flex: 1 } }, d.doc),
React.createElement("span", { style: { fontSize: 9.5, color: T.inkSoft } }, d.where.join(", "))));
})),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.green, marginBottom: 8 } },
"▼ Documents retirés (",
retires.length,
")"),
retires.length === 0 && React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft } }, "Aucun — aucune exigence levée."),
retires.map(function (d: any) {
return (React.createElement("div", { key: d.doc, style: { fontSize: 11, color: T.ink, padding: "5px 0", borderBottom: "1px solid " + T.lineSoft } }, d.doc));
})))),
React.createElement("div", { style: card },
React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } },
React.createElement("span", { style: { fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase" } }, "Date de mise en vigueur (R29)"),
React.createElement("input", { type: "date", value: dateEff, onChange: function (e: any) { setDateEff(e.target.value); }, style: { padding: "7px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12 } }),
React.createElement("button", { onClick: appliquer, disabled: !modifie, style: { padding: "9px 18px", borderRadius: 9, border: "none", background: modifie ? T.olive700 : T.line, color: "#fff", fontSize: 12, fontWeight: 800, cursor: modifie ? "pointer" : "not-allowed" } }, "Appliquer en production"),
React.createElement("button", { onClick: proposer, disabled: !modifie, style: { padding: "9px 18px", borderRadius: 9, border: "1px solid " + (modifie ? T.violet : T.line), background: "transparent", color: modifie ? T.violet : T.inkSoft, fontSize: 12, fontWeight: 800, cursor: modifie ? "pointer" : "not-allowed" } }, "⚖ Proposer au comité"),
React.createElement("button", { onClick: reset, style: { padding: "9px 16px", borderRadius: 9, border: "1px solid " + T.line, background: "transparent", color: T.inkMid, fontSize: 12, fontWeight: 700, cursor: "pointer" } }, "Réinitialiser"),
React.createElement("span", { style: { fontSize: 10.5, color: T.inkSoft } }, modifie ? "Modifications en attente — non écrites." : "Matrice identique à la production.")))));
}
