import React, { useState } from "react";
import { T } from "./tokens";
import { pushParamAudit } from "./param-audit-support";
import { SB_RECOS, SB_SOURCES } from "./sandbox-support";

// Source : docs/reference/olive-demo.html 19561-19712 — OwnerSandboxScreen (comité de paramétrage, owner).
// Porté verbatim. Consomme le registre partagé SB_RECOS alimenté par les 4 bacs à sable (sbProposer).

export function OwnerSandboxScreen() {
const [, bump] = useState(0);
const re = function () { bump(function (x) { return x + 1; }); };
const [filtre, setFiltre] = useState("PROPOSEE");
const [sel, setSel] = useState({});
const [motifs, setMotifs] = useState({});
const [msg, setMsg] = useState(null);
const liste = SB_RECOS.filter(function (r) { return filtre === "TOUTES" || r.statut === filtre; });
const enAttente = SB_RECOS.filter(function (r) { return r.statut === "PROPOSEE"; });
const retenues = enAttente.filter(function (r) { return sel[r.id]; });
// ── Stress test : cumul des impacts des recommandations retenues ──
const cumul = {};
retenues.forEach(function (r) { (r.impacts || []).forEach(function (i) { cumul[i.k] = (cumul[i.k] || 0) + (+i.v || 0); }); });
const charge = (cumul["réponses à collecter"] || 0);
const eddPlus = (cumul["basculent en EDD"] || 0) + (cumul["clients vers EDD"] || 0);
const alertesPlus = (cumul["nouvelles alertes"] || 0);
const dossiers = (cumul["dossiers en cours impactés"] || 0);
const tension = charge * 1 + eddPlus * 8 + alertesPlus * 2 + dossiers * 0.5;
const niveau = tension >= 180 ? ["CRITIQUE", T.red] : (tension >= 80 ? ["ÉLEVÉE", T.amber] : (tension > 0 ? ["MAÎTRISÉE", T.green] : ["—", T.inkSoft]));
function accepter(r) {
try {
r.apply && r.apply();
}
catch (e) {
setMsg({ k: "err", t: "Application impossible : " + e.message });
return;
}
r.statut = "ACCEPTEE";
pushParamAudit("Owner application", "Recommandation " + r.id + " ACCEPTÉE (" + r.source + " · proposée par " + r.by + ") — " + r.titre + " · effet " + (r.dateEff || "immédiat"));
setMsg({ k: "ok", t: r.id + " acceptée et appliquée. Date de mise en vigueur : " + (r.dateEff || "immédiate") + " — les dossiers antérieurs restent régis par le paramétrage en vigueur (R29/R48)." });
re();
}
function refuser(r) {
var m = (motifs[r.id] || "").trim();
if (!m) {
setMsg({ k: "err", t: "R7 : un refus exige un motif." });
return;
}
r.statut = "REFUSEE";
r.motif = m;
pushParamAudit("Owner application", "Recommandation " + r.id + " REFUSÉE (" + r.source + ") — motif : " + m);
setMsg({ k: "ok", t: r.id + " refusée — motif enregistré et opposable." });
re();
}
const card = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 16, marginBottom: 14 };
const STC = { PROPOSEE: [T.amber, "En attente d'arbitrage"], ACCEPTEE: [T.green, "Acceptée"], REFUSEE: [T.red, "Refusée"] };
return (React.createElement("div", null,
React.createElement("div", { style: { marginBottom: 12 } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
React.createElement("div", { style: { fontSize: 21, fontWeight: 800, color: T.ink } }, "Comit\u00E9 de param\u00E9trage \u2014 owner de l'application"),
React.createElement("span", { style: { fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: T.violet + "18", color: T.violet } }, "ARBITRAGE \u00B7 R7 motif obligatoire au refus")),
React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginTop: 4, maxWidth: 1000, lineHeight: 1.6 } },
"Compliance, Central File, BRM et RM instruisent leurs r\u00E9glages dans leurs bacs \u00E0 sable respectifs et",
React.createElement("b", null, " proposent"),
" \u2014 jamais n'appliquent. Ici, l'owner voit chaque recommandation avec son impact mesur\u00E9, et surtout le ",
React.createElement("b", null, "cumul"),
" : un changement isol\u00E9 est anodin, dix simultan\u00E9s peuvent noyer les \u00E9quipes.")),
msg && React.createElement("div", { style: { marginBottom: 12, padding: "9px 12px", borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
background: msg.k === "ok" ? T.greenSoft : T.redSoft, color: msg.k === "ok" ? T.green : T.red, border: "1px solid " + (msg.k === "ok" ? T.green : T.red) + "30" } }, msg.t),
React.createElement("div", { style: Object.assign({}, card, { border: "2px solid " + niveau[1] + "55", background: niveau[1] + "08" }) },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" } },
React.createElement("div", { style: { minWidth: 150 } },
React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 } }, "Stress test cumul\u00E9"),
React.createElement("div", { style: { fontSize: 22, fontWeight: 800, color: niveau[1], marginTop: 2 } }, niveau[0]),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft } },
retenues.length,
" recommandation",
retenues.length > 1 ? "s" : "",
" retenue",
retenues.length > 1 ? "s" : "",
" sur ",
enAttente.length)),
React.createElement("div", { style: { flex: 1, display: "flex", gap: 10, flexWrap: "wrap" } },
Object.keys(cumul).length === 0 && React.createElement("span", { style: { fontSize: 11.5, color: T.inkSoft } }, "Cochez des recommandations pour simuler leur effet combin\u00E9 sur le comportement d'Olive."),
Object.keys(cumul).map(function (k) {
const v = cumul[k];
const bad = /EDD|impactés|collecter|nouvelles alertes/.test(k) && v > 0;
return (React.createElement("div", { key: k, style: { padding: "7px 13px", borderRadius: 9, background: "#fff", border: "1px solid " + (bad ? T.red : T.line) + "55", minWidth: 96 } },
React.createElement("div", { style: { fontSize: 17, fontWeight: 800, fontFamily: "monospace", color: bad ? T.red : T.ink } },
v > 0 ? "+" : "",
v),
React.createElement("div", { style: { fontSize: 9, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.3 } }, k)));
}))),
tension >= 80 && (React.createElement("div", { style: { marginTop: 10, fontSize: 11.5, color: niveau[1], lineHeight: 1.55, fontWeight: 600 } },
"\u26A0 Charge combin\u00E9e ",
niveau[0].toLowerCase(),
" : ",
charge > 0 ? charge + " réponses à collecter · " : "",
eddPlus > 0 ? eddPlus + " dossiers passant en EDD · " : "",
alertesPlus > 0 ? alertesPlus + " alertes nouvelles" : "",
". Envisagez d'\u00E9taler les dates de mise en vigueur plut\u00F4t que de tout appliquer le m\u00EAme jour."))),
React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" } }, ["PROPOSEE", "ACCEPTEE", "REFUSEE", "TOUTES"].map(function (f) {
const n = f === "TOUTES" ? SB_RECOS.length : SB_RECOS.filter(function (r) { return r.statut === f; }).length;
return (React.createElement("button", { key: f, onClick: function () { setFiltre(f); }, style: { padding: "6px 13px", borderRadius: 8,
border: "1px solid " + (filtre === f ? T.olive600 : T.line), background: filtre === f ? T.oliveSoft : "transparent",
color: filtre === f ? T.olive900 : T.inkMid, fontSize: 11, fontWeight: 700, cursor: "pointer" } },
f === "PROPOSEE" ? "En attente" : (f === "ACCEPTEE" ? "Acceptées" : (f === "REFUSEE" ? "Refusées" : "Toutes")),
" (",
n,
")"));
})),
liste.length === 0 && (React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12.5, color: T.inkSoft, lineHeight: 1.6 } },
"Aucune recommandation ",
filtre === "PROPOSEE" ? "en attente" : "dans ce filtre",
". Les bacs \u00E0 sable AML, KYC, BRM et Onboarding disposent d'un bouton ",
React.createElement("b", null, "\u00AB \u2696 Proposer au comit\u00E9 \u00BB"),
" : la proposition arrive ici avec son impact mesur\u00E9."))),
liste.map(function (r) {
const src = SB_SOURCES[r.source] || ["—", T.inkSoft];
const st = STC[r.statut] || [T.inkSoft, r.statut];
return (React.createElement("div", { key: r.id, style: Object.assign({}, card, { borderLeft: "4px solid " + src[1] }) },
React.createElement("div", { style: { display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" } },
r.statut === "PROPOSEE" && (React.createElement("input", { type: "checkbox", checked: !!sel[r.id], onChange: function (e) { var o = Object.assign({}, sel); o[r.id] = e.target.checked; setSel(o); }, style: { marginTop: 4, width: 16, height: 16, cursor: "pointer" } })),
React.createElement("div", { style: { flex: 1, minWidth: 280 } },
React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
React.createElement("span", { style: { fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: src[1] + "18", color: src[1] } }, src[0]),
React.createElement("span", { style: { fontSize: 13, fontWeight: 800, color: T.ink } }, r.titre),
React.createElement("span", { style: { fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: st[0] + "18", color: st[0] } }, st[1]),
React.createElement("span", { style: { fontSize: 10, color: T.inkSoft, fontFamily: "monospace" } }, r.id)),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkMid, marginTop: 5, lineHeight: 1.5 } }, r.detail),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginTop: 4 } },
"Propos\u00E9 par ",
React.createElement("b", null, r.by),
" \u00B7 ",
r.at,
" \u00B7 effet demand\u00E9 : ",
r.dateEff || "immédiat"),
React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" } }, (r.impacts || []).map(function (i) {
const bad = /EDD|impactés|collecter|nouvelles alertes/.test(i.k) && i.v > 0;
return React.createElement("span", { key: i.k, style: { fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
background: "#fff", border: "1px solid " + (bad ? T.red : T.line) + "66", color: bad ? T.red : T.inkMid } },
i.v > 0 ? "+" : "",
i.v,
" ",
i.k);
})),
r.statut === "REFUSEE" && React.createElement("div", { style: { fontSize: 11, color: T.red, marginTop: 7 } },
React.createElement("b", null, "Motif du refus (R7) :"),
" ",
r.motif)),
r.statut === "PROPOSEE" && (React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, minWidth: 250 } },
React.createElement("button", { onClick: function () { accepter(r); }, style: { padding: "7px 14px", borderRadius: 8, border: "none", background: T.olive700, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer" } }, "\u2713 Accepter et appliquer"),
React.createElement("input", { value: motifs[r.id] || "", onChange: function (e) { var o = Object.assign({}, motifs); o[r.id] = e.target.value; setMotifs(o); }, placeholder: "Motif du refus (obligatoire \u2014 R7)", style: { padding: "6px 9px", borderRadius: 7, border: "1px solid " + T.line, fontSize: 11 } }),
React.createElement("button", { onClick: function () { refuser(r); }, style: { padding: "7px 14px", borderRadius: 8, border: "1px solid " + T.red, background: "transparent", color: T.red, fontSize: 11.5, fontWeight: 800, cursor: "pointer" } }, "\u2715 Refuser"))))));
})));
}
