import React from "react";
import { T } from "./tokens";
import { pushParamAudit } from "./param-audit-support";

// Source : docs/reference/olive-demo.html — helpers partagés des bacs à sable (18556, 18869-18936).
// Formatteur, jauge de tension (stress), graphe SbStress (point de rupture), registre du comité de
// paramétrage (SB_RECOS + sbProposer), sources. Réutilisés par sbaml/sbkyc/sbbrm/sbonb et sbowner.

export function amlSbFmt(v) {
if (typeof v !== "number")
return String(v);
return (Math.abs(v) < 10 ? v.toFixed(2) : Math.round(v).toLocaleString("fr-CH"));
}
export function sbTension(charge, edd, alertes, dossiers) {
var t = (charge || 0) * 1 + (edd || 0) * 8 + (alertes || 0) * 2 + (dossiers || 0) * 0.5;
return t >= 180 ? ["CRITIQUE", T.red, t] : (t >= 80 ? ["ÉLEVÉE", T.amber, t] : (t > 0 ? ["MAÎTRISÉE", T.green, t] : ["AU REPOS", T.inkSoft, 0]));
}
export function SbStress(props) {
const pts = props.points || [], cur = props.curIdx == null ? -1 : props.curIdx;
const max = Math.max.apply(null, pts.map(function (p) { return p.v; }).concat([1]));
// Point de rupture = une hausse DISPROPORTIONNÉE par rapport aux autres crans.
// Une croissance régulière (chaque cran coûte pareil) n'est pas une falaise : c'est un coût linéaire,
// prévisible, qu'on assume. La falaise, c'est quand un cran coûte plusieurs fois les autres.
var sauts = [];
for (var i = 1; i < pts.length; i++)
sauts.push(pts[i].v - pts[i - 1].v);
var positifs = sauts.filter(function (d) { return d > 0; }).sort(function (a, b) { return a - b; });
var median = positifs.length ? positifs[Math.floor(positifs.length / 2)] : 0;
var rupt = -1, bond = 0;
for (var j = 0; j < sauts.length; j++) {
var d = sauts[j];
if (d > bond && d >= Math.max(3, 0.3 * max) && (positifs.length < 2 || d >= 2 * median)) {
bond = d;
rupt = j + 1;
}
}
const niv = props.niveau || ["AU REPOS", T.inkSoft, 0];
return (React.createElement("div", { style: { background: T.surface, border: "2px solid " + niv[1] + "44", borderRadius: 14, padding: 16, marginBottom: 14, background: niv[1] + "08" } },
React.createElement("div", { style: { display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" } },
React.createElement("div", { style: { minWidth: 158 } },
React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 } },
"Stress test \u2014 ",
props.titre),
React.createElement("div", { style: { fontSize: 21, fontWeight: 800, color: niv[1], marginTop: 2 } }, niv[0]),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, lineHeight: 1.45, marginTop: 2 } }, props.sousTitre)),
React.createElement("div", { style: { flex: 1, minWidth: 300 } },
React.createElement("div", { style: { fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 } },
"Comportement autour du r\u00E9glage \u2014 ",
props.unite),
React.createElement("div", { style: { display: "flex", alignItems: "flex-end", gap: 8, height: 74 } }, pts.map(function (p, i) {
const h = Math.max(4, Math.round(p.v / max * 62));
const isCur = i === cur, isRupt = i === rupt;
return (React.createElement("div", { key: i, style: { flex: 1, textAlign: "center" } },
React.createElement("div", { style: { fontSize: 9.5, fontWeight: 800, color: isCur ? T.olive900 : (isRupt ? T.red : T.inkSoft), marginBottom: 3 } }, p.v),
React.createElement("div", { style: { height: h, borderRadius: "4px 4px 0 0",
background: isCur ? T.olive600 : (isRupt ? T.red + "88" : T.line),
border: isCur ? "2px solid " + T.olive900 : (isRupt ? "1px solid " + T.red : "none") } }),
React.createElement("div", { style: { fontSize: 9, color: isCur ? T.olive900 : T.inkSoft, fontWeight: isCur ? 800 : 400, marginTop: 3 } }, p.x)));
})),
rupt >= 0 && (React.createElement("div", { style: { fontSize: 10.5, color: T.red, marginTop: 7, lineHeight: 1.5 } },
"\u26A0 ",
React.createElement("b", null, "Point de rupture"),
" entre ",
pts[rupt - 1].x,
" et ",
pts[rupt].x,
" : ",
bond,
" de plus d'un cran \u00E0 l'autre. Un r\u00E9glage juste avant la falaise est fragile \u2014 la moindre d\u00E9rive des donn\u00E9es le fait basculer.")),
rupt < 0 && pts.length > 0 && (React.createElement("div", { style: { fontSize: 10.5, color: T.green, marginTop: 7 } }, "\u2713 R\u00E9ponse progressive autour du r\u00E9glage \u2014 pas de falaise d\u00E9tect\u00E9e."))))));
}
export let SB_RECOS: any[] = [];
export let SB_RECO_SEQ = 0;
export function sbProposer(r) {
SB_RECO_SEQ++;
SB_RECOS.unshift(Object.assign({ id: "RECO-" + String(SB_RECO_SEQ).padStart(3, "0"), at: "à l'instant",
statut: "PROPOSEE", motif: "" }, r));
pushParamAudit(r.by || "Utilisateur", "Recommandation soumise au comité de paramétrage — " + r.source + " : " + r.titre);
return SB_RECOS[0];
}
export const SB_SOURCES: any = { AML: ["Bac à sable AML", T.red], KYC: ["Bac à sable KYC", T.violet], BRM: ["Bac à sable BRM", T.amber], ONB: ["Bac à sable Onboarding", T.olive600], REF: ["Référentiel", T.inkSoft] };
