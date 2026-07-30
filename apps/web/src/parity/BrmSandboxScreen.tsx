import React, { useState } from "react";
import { T } from "./tokens";
import { CPSI, cpsiPopulation, cpsiScore } from "./cpsi-engine-support";
import { pushParamAudit } from "./param-audit-support";
import { sbTension, SbStress, sbProposer } from "./sandbox-support";

// Source : docs/reference/olive-demo.html 19144-19327 — BrmSandboxScreen (bac à sable BRM pondérations & bandes).
// BRM_LBL + composant portés verbatim.

const BRM_LBL = {
pays_risque: "Risque pays", structure_risque: "Risque structure", pep: "Statut PEP", secteur_risque: "Risque activité",
alerte_fondee: "Alerte fondée", alerte_non_fondee: "Alerte non fondée", hit_screening: "Hit de screening",
review_defavorable: "Revue défavorable", coc_sensible: "CoC sensible", velocite_tx: "Vélocité transactionnelle",
};

export function BrmSandboxScreen() {
const [cfg, setCfg] = useState(function () { return JSON.parse(JSON.stringify(CPSI.cfg)); });
const [dateEff, setDateEff] = useState("2026-09-01");
const [msg, setMsg] = useState(null);
const base = CPSI.cfg;
const modifie = JSON.stringify(cfg) !== JSON.stringify(base);
const pop = cpsiPopulation();
const avant = pop.map(function (cl) { return { cl: cl, s: cpsiScore(cl, base) }; });
const apres = pop.map(function (cl) { return { cl: cl, s: cpsiScore(cl, cfg) }; });
const stA = { LOW: 0, MEDIUM: 0, HIGH: 0 }, stB = { LOW: 0, MEDIUM: 0, HIGH: 0 };
avant.forEach(function (x) { stA[x.s.bande] = (stA[x.s.bande] || 0) + 1; });
apres.forEach(function (x) { stB[x.s.bande] = (stB[x.s.bande] || 0) + 1; });
const bascules = [];
for (var i = 0; i < pop.length; i++) {
if (avant[i].s.bande !== apres[i].s.bande)
bascules.push({ cl: pop[i], de: avant[i].s.bande, vers: apres[i].s.bande, sa: avant[i].s.score, sb: apres[i].s.score });
}
const versHigh = bascules.filter(function (b) { return b.vers === "HIGH"; });
const quitteHigh = bascules.filter(function (b) { return b.de === "HIGH"; });
function setPoids(grp, k, v) { var c = JSON.parse(JSON.stringify(cfg)); c[grp][k] = parseFloat(v) || 0; setCfg(c); }
function setBande(i, v) { var c = JSON.parse(JSON.stringify(cfg)); c.bandes[i] = parseFloat(v) || 0; setCfg(c); }
function setHalf(v) { var c = JSON.parse(JSON.stringify(cfg)); c.half_life_jours = parseFloat(v) || 1; setCfg(c); }
function reset() { setCfg(JSON.parse(JSON.stringify(CPSI.cfg))); setMsg(null); }
function appliquer() {
if (!modifie) {
setMsg({ k: "err", t: "Aucune modification à appliquer." });
return;
}
CPSI.cfg = JSON.parse(JSON.stringify(cfg));
CPSI.pop = null;
pushParamAudit("K. Weber (ADMIN)", "CPSI — pondérations/bandes modifiées (effet " + dateEff + ") : bandes [" + cfg.bandes.join(", ") + "], demi-vie " + cfg.half_life_jours + " j — "
+ bascules.length + " client(s) changent de bande dont " + versHigh.length + " vers HIGH (EDD) et " + quitteHigh.length + " sortant de HIGH");
setMsg({ k: "ok", t: "Appliqué avec effet au " + dateEff + ". Les dossiers validés avant cette date conservent leur classification (R29/R48) ; le nouveau calcul s'applique aux évaluations postérieures." });
}
const card = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 16, marginBottom: 14 };
const kpi = function (v, l, c) {
return (React.createElement("div", { style: { padding: "9px 16px", borderRadius: 10, background: c + "12", border: "1px solid " + c + "30", minWidth: 116 } },
React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: c, fontFamily: "monospace" } }, v),
React.createElement("div", { style: { fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4 } }, l)));
};
const BANDC = { LOW: T.green, MEDIUM: T.amber, HIGH: T.red };
const barre = function (st, total) {
return (React.createElement("div", { style: { display: "flex", height: 26, borderRadius: 7, overflow: "hidden", border: "1px solid " + T.line } }, ["LOW", "MEDIUM", "HIGH"].map(function (b) {
const n = st[b] || 0;
if (!n)
return null;
return React.createElement("div", { key: b, style: { flex: n, background: BANDC[b] + "33", borderRight: "1px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: BANDC[b] } }, n);
})));
};
const curseur = function (grp, k) {
const v = cfg[grp][k], ref = base[grp][k];
return (React.createElement("div", { key: k, style: { marginBottom: 9 } },
React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 } },
React.createElement("span", { style: { color: T.ink } }, BRM_LBL[k] || k),
React.createElement("span", { style: { fontFamily: "monospace", fontWeight: 800, color: v !== ref ? T.olive700 : T.inkSoft } },
v,
v !== ref ? " (réf. " + ref + ")" : "")),
React.createElement("input", { type: "range", min: "0", max: "30", step: "1", value: v, onChange: function (e) { setPoids(grp, k, e.target.value); }, style: { width: "100%" } })));
};
return (React.createElement("div", null,
React.createElement("div", { style: { marginBottom: 12 } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
React.createElement("div", { style: { fontSize: 21, fontWeight: 800, color: T.ink } }, "Bac \u00E0 sable BRM \u2014 pond\u00E9rations & bandes"),
React.createElement("span", { style: { fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: T.olive600 + "15", color: T.olive700 } }, "DRY-RUN \u00B7 aucune \u00E9criture")),
React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginTop: 4, maxWidth: 980, lineHeight: 1.6 } },
"Le BRM arbitre le poids de chaque facteur de risque. Un point de pond\u00E9ration d\u00E9place des dossiers d'une bande \u00E0 l'autre \u2014 donc du CDD vers l'",
React.createElement("b", null, "EDD"),
", avec la charge de travail que \u00E7a implique. Le portefeuille entier (",
pop.length,
" clients) est recalcul\u00E9 en direct.")),
msg && React.createElement("div", { style: { marginBottom: 12, padding: "9px 12px", borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
background: msg.k === "ok" ? T.greenSoft : T.redSoft, color: msg.k === "ok" ? T.green : T.red, border: "1px solid " + (msg.k === "ok" ? T.green : T.red) + "30" } }, msg.t),
React.createElement("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 } },
kpi(bascules.length, "clients qui changent de bande", bascules.length ? T.violet : T.inkSoft),
kpi(versHigh.length, "basculent vers HIGH (EDD)", T.red),
kpi(quitteHigh.length, "sortent de HIGH", T.green),
kpi(stA.HIGH + " → " + stB.HIGH, "HIGH avant → après", T.red),
kpi(cfg.bandes.join(" / "), "bandes LOW / MEDIUM", T.olive700)),
React.createElement(SbStress, { titre: "dossiers en EDD", unite: "bande MEDIUM (seuil haut)", niveau: sbTension(0, versHigh.length, 0, bascules.length), sousTitre: "Combien de dossiers basculent en diligence renforc\u00E9e selon o\u00F9 l'on place la bande.", curIdx: 2, points: [-20, -10, 0, 10, 20].map(function (d) {
var b = cfg.bandes[1] + d;
var c2 = JSON.parse(JSON.stringify(cfg));
c2.bandes = [cfg.bandes[0], b];
var n = 0;
pop.forEach(function (cl) { if (cpsiScore(cl, c2).bande === "HIGH")
n++; });
return { x: String(b), v: n };
}) }),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } },
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 10 } }, "Pond\u00E9rations \u2014 facteurs statiques"),
Object.keys(cfg.poids_statique).map(function (k) { return curseur("poids_statique", k); }),
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.ink, margin: "14px 0 10px" } }, "Pond\u00E9rations \u2014 signaux"),
Object.keys(cfg.poids_signaux).map(function (k) { return curseur("poids_signaux", k); })),
React.createElement("div", null,
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 10 } }, "Bandes & m\u00E9moire"),
React.createElement("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 } },
React.createElement("label", { style: { fontSize: 11, color: T.inkMid } },
"LOW <",
React.createElement("input", { type: "number", value: cfg.bandes[0], onChange: function (e) { setBande(0, e.target.value); }, style: { width: 64, marginLeft: 6, padding: "4px 7px", borderRadius: 6, border: "1px solid " + T.line, fontFamily: "monospace", fontSize: 11 } })),
React.createElement("label", { style: { fontSize: 11, color: T.inkMid } },
"MEDIUM <",
React.createElement("input", { type: "number", value: cfg.bandes[1], onChange: function (e) { setBande(1, e.target.value); }, style: { width: 64, marginLeft: 6, padding: "4px 7px", borderRadius: 6, border: "1px solid " + T.line, fontFamily: "monospace", fontSize: 11 } })),
React.createElement("label", { style: { fontSize: 11, color: T.inkMid } },
"Demi-vie",
React.createElement("input", { type: "number", value: cfg.half_life_jours, onChange: function (e) { setHalf(e.target.value); }, style: { width: 70, marginLeft: 6, padding: "4px 7px", borderRadius: 6, border: "1px solid " + T.line, fontFamily: "monospace", fontSize: 11 } }),
" j")),
React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 } }, "R\u00E9partition actuelle"),
barre(stA, pop.length),
React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, margin: "10px 0 4px" } }, "R\u00E9partition simul\u00E9e"),
barre(stB, pop.length),
React.createElement("div", { style: { display: "flex", gap: 14, marginTop: 8, fontSize: 10.5 } }, ["LOW", "MEDIUM", "HIGH"].map(function (b) {
return (React.createElement("span", { key: b, style: { color: BANDC[b], fontWeight: 700 } },
b,
" ",
stA[b] || 0,
" \u2192 ",
stB[b] || 0));
}))),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 8 } },
"Clients qui changent de bande (",
bascules.length,
")"),
bascules.length === 0 && React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft } }, "Aucun \u2014 la pond\u00E9ration simul\u00E9e ne d\u00E9place personne."),
React.createElement("div", { style: { maxHeight: 210, overflowY: "auto" } }, bascules.slice(0, 14).map(function (b) {
return (React.createElement("div", { key: b.cl.id, style: { display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderBottom: "1px solid " + T.lineSoft, fontSize: 11 } },
React.createElement("span", { style: { color: T.ink, fontWeight: 600, flex: 1 } }, b.cl.name),
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkSoft } },
b.sa,
" \u2192 ",
b.sb),
React.createElement("span", { style: { fontWeight: 800, color: BANDC[b.de], fontSize: 10 } }, b.de),
React.createElement("span", { style: { color: T.inkSoft } }, "\u2192"),
React.createElement("span", { style: { fontWeight: 800, color: BANDC[b.vers], fontSize: 10 } },
b.vers,
b.vers === "HIGH" ? " · EDD" : "")));
})),
bascules.length > 14 && React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginTop: 6 } },
"+ ",
bascules.length - 14,
" autres\u2026")))),
React.createElement("div", { style: card },
React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } },
React.createElement("span", { style: { fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase" } }, "Date de mise en vigueur (R29)"),
React.createElement("input", { type: "date", value: dateEff, onChange: function (e) { setDateEff(e.target.value); }, style: { padding: "7px 10px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 12 } }),
React.createElement("button", { onClick: appliquer, disabled: !modifie, style: { padding: "9px 18px", borderRadius: 9, border: "none", background: modifie ? T.olive700 : T.line, color: "#fff", fontSize: 12, fontWeight: 800, cursor: modifie ? "pointer" : "not-allowed" } }, "Appliquer en production"),
React.createElement("button", { onClick: function () {
if (!modifie) {
setMsg({ k: "err", t: "Aucune modification à proposer." });
return;
}
var cfgCopie = JSON.parse(JSON.stringify(cfg));
sbProposer({ source: "BRM", by: "L. Romano (BRM)", role: "BRM", dateEff: dateEff,
titre: "Pondérations & bandes du score",
detail: "bandes [" + cfgCopie.bandes.join(", ") + "] · demi-vie " + cfgCopie.half_life_jours + " j · PEP " + cfgCopie.poids_statique.pep + " · pays " + cfgCopie.poids_statique.pays_risque,
impacts: [{ k: "clients changent de bande", v: bascules.length }, { k: "basculent en EDD", v: versHigh.length }, { k: "sortent de HIGH", v: quitteHigh.length }],
apply: function () { CPSI.cfg = JSON.parse(JSON.stringify(cfgCopie)); CPSI.pop = null; } });
setMsg({ k: "ok", t: "Recommandation soumise au comité de paramétrage." });
}, disabled: !modifie, style: { padding: "9px 18px", borderRadius: 9, border: "1px solid " + (modifie ? T.violet : T.line), background: "transparent", color: modifie ? T.violet : T.inkSoft, fontSize: 12, fontWeight: 800, cursor: modifie ? "pointer" : "not-allowed" } }, "\u2696 Proposer au comit\u00E9"),
React.createElement("button", { onClick: reset, style: { padding: "9px 16px", borderRadius: 9, border: "1px solid " + T.line, background: "transparent", color: T.inkMid, fontSize: 12, fontWeight: 700, cursor: "pointer" } }, "R\u00E9initialiser"),
React.createElement("span", { style: { fontSize: 10.5, color: T.inkSoft } }, modifie ? "Modifications en attente — non écrites." : "Configuration identique à la production.")))));
}
