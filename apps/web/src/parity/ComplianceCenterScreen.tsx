import React, { useState } from "react";
import { T } from "./tokens";
import { KpiCard } from "./components";
import { AmlEncyclopediaScreen } from "./AmlEncyclopediaScreen";
import { AML_ALERTS } from "./aml-workspace-support";
import {
  amlRuleStats, amlProposals, AML_RULE_VERSIONS, amlNextVersion, amlApproveProposal, amlRejectProposal,
  MROS_REPORTS, MROS_POLICY, MROS_STATUS_META, mrosDraftFromAlert, mrosAckAge, mrosDownloadXml, mrosValidate,
  lbaAnnualReport, lbaDownloadReport,
} from "./compliance-support";

// Source : docs/reference/olive-demo.html 28792-29212 — ComplianceCenterScreen (6 onglets), porté verbatim.
// Onglet « Règles AML » = AmlEncyclopediaScreen (déjà porté). Moteur : compliance-support.

export function ComplianceCenterScreen({ user }: { user?: any }) {
const [tab, setTab] = useState("rules");
const [selCell, setSelCell] = useState(null);
const [mrosSel, setMrosSel] = useState(null);
const [mrosAlertId, setMrosAlertId] = useState("");
const [, bump] = useState(0);
const re = function () { bump(function (x) { return x + 1; }); };
const stats = amlRuleStats();
const proposals = amlProposals();
const card = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
const canApprove = user && ["CO_SR", "DIR", "ADMIN", "CEO", "HPB"].indexOf(user.role) >= 0;
const FREQ_BUCKETS = [["Très rare", "< 2%"], ["Rare", "2–10%"], ["Occasionnel", "10–25%"], ["Fréquent", "25–50%"], ["Très fréquent", "≥ 50%"]];
const IMP_BUCKETS = [["Faible", "≤ 8 pts"], ["Modéré", "9–12 pts"], ["Élevé", "13–19 pts"], ["Critique", "20–29 pts"], ["Sévère", "≥ 30 pts"]];
const freqIdx = function (f) { return f < 2 ? 0 : f < 10 ? 1 : f < 25 ? 2 : f < 50 ? 3 : 4; };
const impIdx = function (p) { return p <= 8 ? 0 : p <= 12 ? 1 : p <= 19 ? 2 : p <= 29 ? 3 : 4; };
const cellColor = function (lvl) { return lvl <= 2 ? T.green : lvl <= 4 ? T.amber : lvl <= 6 ? "#E8862E" : T.red; };
const grid = {};
stats.rules.filter(function (r) { return r.on; }).forEach(function (r) { var key = freqIdx(r.freq) + "-" + impIdx(r.pts); (grid[key] = grid[key] || []).push(r); });
const versionedRules = Object.keys(AML_RULE_VERSIONS).filter(function (id) { return AML_RULE_VERSIONS[id].length > 0; });
const TABS = [["rules", "▤ Règles AML"], ["dash", "▦ Dashboard"], ["heat", "🔥 Heat map"], ["studio", "✦ Intelligence Studio"], ["mros", "📨 Déclarations MROS"], ["direction", "📋 Rapport Direction"]];
const mrosCandidates = AML_ALERTS.filter(function (a) { return a.status !== "REPORTED" && !MROS_REPORTS.some(function (r) { return r.alertId === a.id; }); }).slice(0, 20);
return (React.createElement("div", null,
React.createElement("div", { style: { marginBottom: 16 } },
React.createElement("div", { style: { fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 } }, "Compliance Center"),
React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: T.ink } }, "Gouvernance des r\u00E8gles AML \u2014 consultation, performance, am\u00E9lioration continue"),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft, marginTop: 2 } }, "Principe non n\u00E9gociable : l'IA propose, l'humain d\u00E9ploie. Chaque changement est versionn\u00E9, justifi\u00E9, simul\u00E9 et r\u00E9versible.")),
React.createElement("div", { style: { display: "flex", gap: 4, marginBottom: 18, background: T.surface, padding: 5, borderRadius: 12, border: "1px solid " + T.line, width: "fit-content" } }, TABS.map(function (tb) {
return (React.createElement("button", { key: tb[0], onClick: function () { setTab(tb[0]); }, style: { padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === tb[0] ? T.olive600 : "transparent", color: tab === tb[0] ? "#fff" : T.inkMid, fontSize: 12.5, fontWeight: tab === tb[0] ? 700 : 500 } }, tb[1]));
})),
tab === "rules" && React.createElement(AmlEncyclopediaScreen, { user: user }),
        tab === "dash" && (React.createElement("div", null,
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 16 } },
React.createElement(KpiCard, { label: "R\u00E8gles actives", value: stats.rules.filter(function (r) { return r.on; }).length + "/" + stats.rules.length, sub: "8 cat\u00E9gories", color: T.olive600, icon: "\u25A4" }),
React.createElement(KpiCard, { label: "Alertes g\u00E9n\u00E9r\u00E9es", value: stats.alerts.total, sub: stats.alerts.tp + " TP · " + stats.alerts.fp + " FP", color: T.blue, icon: "\u26A0" }),
React.createElement(KpiCard, { label: "Taux de faux positifs", value: stats.alerts.fpPct + "%", sub: "issues des investigations", color: stats.alerts.fpPct >= 60 ? T.red : T.amber, icon: "\u25CE" }),
React.createElement(KpiCard, { label: "Propositions IA en attente", value: proposals.filter(function (p) { return p.status === "PENDING"; }).length, sub: "validation Compliance requise", color: T.violet, icon: "\u2726" }),
React.createElement(KpiCard, { label: "Versions d\u00E9ploy\u00E9es", value: versionedRules.reduce(function (a, id) { return a + AML_RULE_VERSIONS[id].length; }, 0), sub: versionedRules.length + " règle(s) modifiée(s)", color: T.teal || T.olive700, icon: "\u238C" })),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } },
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 12 } }, "D\u00E9clenchements par cat\u00E9gorie"),
(function () {
var byCat = {};
stats.rules.forEach(function (r) { byCat[r.cat] = (byCat[r.cat] || 0) + r.hits; });
var mx = Math.max.apply(null, Object.keys(byCat).map(function (c) { return byCat[c]; }).concat([1]));
return Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; }).map(function (c) {
return (React.createElement("div", { key: c, style: { marginBottom: 9 } },
React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 2 } },
React.createElement("span", { style: { fontSize: 11, color: T.inkMid } }, c),
React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: T.ink, fontFamily: "monospace" } }, byCat[c])),
React.createElement("div", { style: { height: 5, background: T.lineSoft, borderRadius: 3, overflow: "hidden" } },
React.createElement("div", { style: { height: "100%", width: (100 * byCat[c] / mx) + "%", background: T.olive600 } }))));
});
})()),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 12 } }, "Top r\u00E8gles par fr\u00E9quence \u2014 candidates \u00E0 l'optimisation"),
stats.rules.filter(function (r) { return r.hits > 0; }).sort(function (a, b) { return b.freq - a.freq; }).slice(0, 7).map(function (r) {
return (React.createElement("div", { key: r.id, style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontFamily: "monospace", fontWeight: 800, fontSize: 10.5, color: T.olive700, width: 34 } }, r.id),
React.createElement("span", { style: { flex: 1, fontSize: 11, color: T.inkMid } }, r.label),
React.createElement("span", { style: { fontSize: 10.5, fontWeight: 800, color: r.freq >= 50 ? T.red : T.amber, fontFamily: "monospace" } },
r.freq,
"%"),
React.createElement("span", { style: { fontSize: 9.5, fontWeight: 700, color: r.fpPct >= 60 ? T.red : T.inkSoft } },
"FP ",
r.fpPct,
"%")));
}))))),
tab === "heat" && (React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 } }, "\uD83D\uDD25 Heat map compliance \u2014 fr\u00E9quence \u00D7 impact"),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 16 } }, "Chaque r\u00E8gle active est positionn\u00E9e selon sa fr\u00E9quence de d\u00E9clenchement (portefeuille r\u00E9el) et son impact (poids en points de risque). Cliquer une cellule pour le d\u00E9tail."),
React.createElement("div", { style: { display: "flex", gap: 8 } },
React.createElement("div", { style: { display: "flex", flexDirection: "column", justifyContent: "space-around", paddingBottom: 34 } }, IMP_BUCKETS.slice().reverse().map(function (b) { return React.createElement("div", { key: b[0], style: { fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textAlign: "right", width: 64 } },
b[0],
React.createElement("div", { style: { fontSize: 8, fontWeight: 500 } }, b[1])); })),
React.createElement("div", { style: { flex: 1 } },
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5 } }, [4, 3, 2, 1, 0].map(function (ii) {
return [0, 1, 2, 3, 4].map(function (fi) {
var key = fi + "-" + ii;
var rules = grid[key] || [];
var lvl = fi + ii;
var col = cellColor(lvl);
var sel = selCell === key;
return (React.createElement("div", { key: key, onClick: function () { setSelCell(sel ? null : key); }, style: { minHeight: 64, borderRadius: 9, background: col + (rules.length ? "2E" : "12"), border: (sel ? "2px" : "1px") + " solid " + (sel ? T.ink : col + "55"), cursor: "pointer", padding: "7px 9px" } },
rules.length > 0 && React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: col, fontFamily: "monospace" } }, rules.length),
React.createElement("div", { style: { fontSize: 8.5, fontFamily: "monospace", color: T.inkMid, lineHeight: 1.5 } },
rules.slice(0, 3).map(function (r) { return r.id; }).join(" "),
rules.length > 3 ? " +" + (rules.length - 3) : "")));
});
})),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5, marginTop: 6 } }, FREQ_BUCKETS.map(function (b) { return React.createElement("div", { key: b[0], style: { fontSize: 9.5, fontWeight: 700, color: T.inkSoft, textAlign: "center" } },
b[0],
React.createElement("div", { style: { fontSize: 8, fontWeight: 500 } }, b[1])); })))),
selCell && (grid[selCell] || []).length > 0 && (React.createElement("div", { style: { marginTop: 16, paddingTop: 14, borderTop: "1px solid " + T.line } },
React.createElement("div", { style: { fontSize: 11, fontWeight: 800, color: T.ink, marginBottom: 8 } },
"R\u00E8gles de la cellule \u2014 ",
IMP_BUCKETS[parseInt(selCell.split("-")[1])][0],
" \u00D7 ",
FREQ_BUCKETS[parseInt(selCell.split("-")[0])][0]),
(grid[selCell] || []).map(function (r) {
return (React.createElement("div", { key: r.id, style: { display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderBottom: "1px solid " + T.lineSoft, fontSize: 11 } },
React.createElement("span", { style: { fontFamily: "monospace", fontWeight: 800, color: T.olive700, width: 34 } }, r.id),
React.createElement("span", { style: { flex: 1, color: T.inkMid } }, r.label),
React.createElement("span", { style: { fontFamily: "monospace", color: T.ink, fontWeight: 700 } },
r.pts,
" pts"),
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkMid } },
r.freq,
"%"),
React.createElement("span", { style: { fontSize: 9.5, fontWeight: 700, color: r.fpPct >= 60 ? T.red : T.inkSoft } },
"FP ",
r.fpPct,
"%")));
}))))),
tab === "direction" && (function () {
var rep = lbaAnnualReport();
return (React.createElement("div", null,
React.createElement("div", { style: Object.assign({}, card, { marginBottom: 14 }) },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
React.createElement("div", { style: { flex: 1 } },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink } },
"\uD83D\uDCCB Rapport annuel LBA \u00E0 la Direction \u2014 ",
rep.period),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginTop: 3 } },
rep.entity,
" \u00B7 ",
rep.author,
" \u00B7 art. 25a OBA-FINMA \u2014 consolid\u00E9 en direct depuis tous les modules ; le t\u00E9l\u00E9chargement est audit\u00E9.")),
React.createElement("button", { onClick: function () { lbaDownloadReport(user); re(); }, style: { padding: "9px 16px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer", flexShrink: 0 } }, "\u2B07 T\u00E9l\u00E9charger (Markdown)"))),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 } },
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 6 } }, "1 \u00B7 Relations d'affaires"),
React.createElement("div", { style: { fontSize: 11, color: T.inkMid, lineHeight: 1.8 } },
rep.relations.total,
" relations \u2014 HIGH ",
rep.relations.byRisk.HIGH,
" \u00B7 MEDIUM ",
rep.relations.byRisk.MEDIUM,
" \u00B7 LOW ",
rep.relations.byRisk.LOW,
React.createElement("br", null),
rep.relations.edd,
" en diligence renforc\u00E9e (H*/P*)",
React.createElement("br", null),
"Registre art. 7 : ",
rep.relations.verd["CONFORME"] || 0,
" conformes \u00B7 ",
rep.relations.verd["RÉSERVES"] || 0,
" r\u00E9serves \u00B7 ",
React.createElement("strong", { style: { color: T.red } },
rep.relations.verd["NON CONFORME"] || 0,
" non conformes"),
" \u00B7 ",
rep.relations.late,
" revues en retard")),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 6 } }, "2 \u00B7 Dispositif & 3 \u00B7 Screening"),
React.createElement("div", { style: { fontSize: 11, color: T.inkMid, lineHeight: 1.8 } },
rep.dispositif.rules,
"/",
rep.dispositif.rulesTotal,
" r\u00E8gles actives \u00B7 ",
rep.dispositif.params,
" seuils \u00B7 ",
rep.dispositif.wf,
" workflows",
React.createElement("br", null),
rep.screening.hits,
" dossiers avec hit \u00B7 ",
rep.screening.alerts,
" alertes \u00B7 ",
React.createElement("strong", { style: { color: T.amber } },
rep.screening.alNew,
" NEW \u00E0 qualifier"),
React.createElement("br", null),
"Faux positifs estim\u00E9s : ",
rep.screening.fpPct,
"%")),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 6 } }, "4 \u00B7 MROS & 6 \u00B7 Cross-border"),
React.createElement("div", { style: { fontSize: 11, color: T.inkMid, lineHeight: 1.8 } },
rep.mros.total,
" d\u00E9clarations \u00B7 ",
rep.mros.submitted,
" transmises goAML \u00B7 ",
rep.mros.pending,
" en attente d'accus\u00E9 hors politique",
React.createElement("br", null),
"Country manual ",
rep.crossborder.juris,
" juridictions \u00B7 ",
rep.crossborder.checks,
" check(s) pr\u00E9-voyage trac\u00E9s")),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 6 } }, "5 \u00B7 Formations & habilitations"),
React.createElement("div", { style: { fontSize: 11, color: T.inkMid, lineHeight: 1.8 } },
rep.formations.staff,
" collaborateurs expos\u00E9s",
React.createElement("br", null),
React.createElement("strong", { style: { color: rep.formations.susp ? T.red : T.green } },
rep.formations.susp,
" habilitation(s) suspendue(s)"),
" \u00B7 ",
rep.formations.checks,
" contr\u00F4le(s) de coh\u00E9rence ouverts"))),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: T.olive700, textTransform: "uppercase", marginBottom: 8 } }, "7 \u00B7 Recommandations \u00E0 la Direction"),
rep.reco.map(function (x, i) { return React.createElement("div", { key: i, style: { fontSize: 11.5, color: T.inkMid, padding: "5px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("strong", { style: { color: T.olive700 } },
i + 1,
"."),
" ",
x); }))));
})(),
tab === "mros" && (React.createElement("div", null,
React.createElement("div", { style: Object.assign({}, card, { marginBottom: 14 }) },
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 } }, "\uD83D\uDCE8 Communication de soup\u00E7on \u2014 MROS (art. 9 LBA \u00B7 format goAML)"),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 12 } }, "Olivia pr\u00E9pare la d\u00E9claration structur\u00E9e depuis une alerte (motif de soup\u00E7on d\u00E9riv\u00E9 des r\u00E8gles r\u00E9ellement d\u00E9clench\u00E9es, flux li\u00E9s). Seul un r\u00F4le Compliance senior / MLRO valide et transmet. Interdiction d'informer le client (art. 10a LBA)."),
React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
React.createElement("select", { value: mrosAlertId, onChange: function (e) { setMrosAlertId(e.target.value); }, style: { flex: "1 1 320px", padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5 } },
React.createElement("option", { value: "" }, "\u2014 Choisir une alerte \u00E0 d\u00E9clarer \u2014"),
mrosCandidates.map(function (a) { return React.createElement("option", { key: a.id, value: a.id },
a.id,
" \u00B7 ",
a.clientName,
" \u00B7 ",
a.alertLabel,
" (",
a.matchConfidence,
"%)"); })),
React.createElement("button", { onClick: function () { var a = AML_ALERTS.find(function (x) { return x.id === mrosAlertId; }); if (a) {
var r = mrosDraftFromAlert(a, user);
setMrosSel(r.ref);
setMrosAlertId("");
re();
} }, disabled: !mrosAlertId, style: { padding: "8px 16px", borderRadius: 9, border: "none", background: mrosAlertId ? T.violet : T.line, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: mrosAlertId ? "pointer" : "not-allowed" } }, "\u2726 Pr\u00E9parer la d\u00E9claration (Olivia)"))),
React.createElement("div", { style: Object.assign({}, card, { marginBottom: 14 }) },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 } },
"Registre des d\u00E9clarations \u2014 ",
MROS_REPORTS.length,
" (",
MROS_REPORTS.filter(function (r) { return r.status === "DRAFT"; }).length,
" brouillon(s), ",
MROS_REPORTS.filter(function (r) { return r.status !== "DRAFT"; }).length,
" transmise(s))"),
(function () {
var pend = MROS_REPORTS.map(function (r) { return { r: r, age: mrosAckAge(r) }; }).filter(function (x) { return x.age; });
if (!pend.length)
return null;
var worst = pend.reduce(function (a, x) { return x.age.days > a.age.days ? x : a; }, pend[0]);
var lvl = worst.age.level;
return (React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 9, marginBottom: 10, background: lvl === "ESC" ? T.redSoft : lvl === "RELANCE" ? T.amberSoft : T.oliveSoft, border: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontSize: 13 } }, lvl === "ESC" ? "⏰" : "⏳"),
React.createElement("span", { style: { fontSize: 11, color: T.inkMid, flex: 1 } },
React.createElement("strong", null, pend.length),
" transmission(s) en attente d'accus\u00E9 MROS \u2014 la plus ancienne : ",
React.createElement("strong", null, worst.r.ref),
" \u00E0 J+",
worst.age.days,
lvl === "ESC" ? (" — escalade MLRO (politique J+" + MROS_POLICY.escalade + ")") : lvl === "RELANCE" ? (" — relance recommandée (politique J+" + MROS_POLICY.relance + ")") : "")));
})(),
MROS_REPORTS.length === 0 && React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft, fontStyle: "italic" } }, "Aucune d\u00E9claration \u2014 pr\u00E9parez-en une depuis une alerte ci-dessus."),
MROS_REPORTS.map(function (r) {
var meta = MROS_STATUS_META[r.status] || MROS_STATUS_META.DRAFT;
var sel = mrosSel === r.ref;
return (React.createElement("div", { key: r.ref, onClick: function () { setMrosSel(sel ? null : r.ref); }, style: { display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, border: "1.5px solid " + (sel ? T.olive600 : T.lineSoft), background: sel ? T.oliveSoft : T.cream, cursor: "pointer", marginBottom: 6 } },
React.createElement("span", { style: { fontFamily: "monospace", fontWeight: 800, fontSize: 11, color: T.olive700 } }, r.ref),
React.createElement("span", { style: { flex: 1, fontSize: 11.5, fontWeight: 700, color: T.ink } },
r.clientName,
" ",
React.createElement("span", { style: { fontWeight: 500, color: T.inkSoft } },
"\u00B7 alerte ",
r.alertId)),
React.createElement("span", { style: { fontSize: 9.5, color: T.inkSoft } }, r.status === "DRAFT" ? ("créée " + r.createdAt) : ("transmise " + (r.submittedAt || "—"))),
(function () { var age = mrosAckAge(r); if (!age)
return null; return React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: age.level === "ESC" ? T.red : age.level === "RELANCE" ? T.amber : T.olive700, fontFamily: "monospace" } },
"J+",
age.days); })(),
React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: meta[1], background: T[meta[2]], padding: "3px 10px", borderRadius: 12, whiteSpace: "nowrap" } }, meta[0])));
})),
mrosSel && (function () {
var r = MROS_REPORTS.find(function (x) { return x.ref === mrosSel; });
if (!r)
return null;
var canSubmit = user && ["CO_SR", "DIR", "ADMIN", "CEO", "HPB"].indexOf(user.role) >= 0;
return (React.createElement("div", { style: card },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 } },
React.createElement("span", { style: { fontSize: 14, fontWeight: 800, color: T.ink, flex: 1 } },
"D\u00E9claration ",
r.ref,
" \u2014 ",
r.clientName),
React.createElement("button", { onClick: function () { mrosDownloadXml(r); }, style: { padding: "8px 14px", borderRadius: 9, border: "1px solid " + T.line, background: T.surface, color: T.olive700, fontSize: 11.5, fontWeight: 800, cursor: "pointer" } }, "\u2B07 Export goAML (XML)"),
r.status === "DRAFT" && React.createElement("button", { onClick: function () { mrosValidate(r, user); re(); }, disabled: !canSubmit, title: canSubmit ? "" : "Réservé : MLRO / Compliance senior", style: { padding: "8px 16px", borderRadius: 9, border: "none", background: canSubmit ? T.green : T.line, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: canSubmit ? "pointer" : "not-allowed" } }, "\u2713 Valider & transmettre au MROS")),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } },
React.createElement("div", null,
React.createElement("div", { style: { fontSize: 9.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 4 } }, "Base l\u00E9gale"),
React.createElement("div", { style: { fontSize: 11, color: T.inkMid, marginBottom: 10 } }, r.legalBasis),
React.createElement("div", { style: { fontSize: 9.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 4 } }, "Entit\u00E9 d\u00E9clarante"),
React.createElement("div", { style: { fontSize: 11, color: T.inkMid, marginBottom: 10 } }, r.reportingEntity),
React.createElement("div", { style: { fontSize: 9.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 4 } }, "Personne / relation concern\u00E9e"),
React.createElement("div", { style: { fontSize: 11, color: T.inkMid, marginBottom: 10 } },
r.subject.name,
" \u00B7 ",
r.subject.structure,
" \u00B7 ",
r.subject.country,
React.createElement("br", null),
"UBO : ",
r.subject.ubo,
" \u00B7 AUM : ",
r.subject.aum,
" \u00B7 KYC ",
React.createElement("span", { style: { fontFamily: "monospace" } }, r.kycCode)),
React.createElement("div", { style: { fontSize: 9.5, fontWeight: 800, color: T.red, textTransform: "uppercase", marginBottom: 4 } }, "D\u00E9lais & confidentialit\u00E9"),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkMid, marginBottom: 8 } }, r.deadlineNote),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkMid } }, r.blockingNote)),
React.createElement("div", null,
React.createElement("div", { style: { fontSize: 9.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 4 } }, "Motif de soup\u00E7on (d\u00E9riv\u00E9 du moteur \u2014 explicable)"),
r.suspicionGrounds.map(function (g, i) { return React.createElement("div", { key: i, style: { fontSize: 10.5, color: T.inkMid, marginBottom: 3 } },
"\u2022 ",
g); }),
React.createElement("div", { style: { fontSize: 9.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", margin: "10px 0 4px" } },
"Transactions li\u00E9es (",
r.linkedTx.length,
")"),
r.linkedTx.length === 0 && React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, fontStyle: "italic" } }, "Aucun flux enregistr\u00E9 pour cette relation."),
r.linkedTx.map(function (t) {
return (React.createElement("div", { key: t.id, style: { display: "flex", gap: 8, fontSize: 10, color: T.inkMid, padding: "3px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontFamily: "monospace", color: T.olive700 } }, t.id),
React.createElement("span", null, t.date),
React.createElement("span", { style: { flex: 1 } }, t.corridor),
React.createElement("span", { style: { fontFamily: "monospace" } }, t.amt),
React.createElement("span", { style: { fontWeight: 800, color: t.risk === "HIGH" ? T.red : t.risk === "MEDIUM" ? T.amber : T.green } }, t.risk)));
}),
r.status !== "DRAFT" && React.createElement("div", { style: { marginTop: 10, fontSize: 10.5, color: T.inkMid } },
React.createElement("strong", null, "Transmise"),
" le ",
r.submittedAt,
" par ",
r.submittedBy,
r.ackAt && React.createElement(React.Fragment, null,
" \u00B7 accus\u00E9 MROS le ",
r.ackAt),
" \u2014 alerte ",
r.alertId,
" cl\u00F4tur\u00E9e ",
React.createElement("strong", null, "REPORTED"),
".")))));
})())),
tab === "studio" && (React.createElement("div", null,
React.createElement("div", { style: { background: "linear-gradient(135deg," + T.olive700 + "14," + T.violet + "14)", border: "1px solid " + T.line, borderRadius: 14, padding: "16px 20px", marginBottom: 14 } },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 4 } }, "\u2726 Olive AML Intelligence Studio"),
React.createElement("div", { style: { fontSize: 11, color: T.inkMid, lineHeight: 1.6 } },
"Boucle d'am\u00E9lioration continue : ",
React.createElement("strong", null, "Alertes \u2192 Investigations analystes \u2192 Learning Engine \u2192 Proposition IA \u2192 Validation Compliance \u2192 Simulation \u2192 Nouvelle version \u2192 Production"),
". Aucune r\u00E8gle n'est appliqu\u00E9e automatiquement \u2014 l'IA propose, l'humain d\u00E9ploie. Le moteur de cette d\u00E9mo est d\u00E9terministe et explicable : il mesure fr\u00E9quence et faux positifs sur le portefeuille r\u00E9el.")),
proposals.length === 0 && React.createElement("div", { style: Object.assign({}, card, { fontSize: 12, color: T.inkSoft, fontStyle: "italic" }) }, "Aucune proposition en attente \u2014 toutes les r\u00E8gles \u00E0 fort taux de faux positifs ont \u00E9t\u00E9 trait\u00E9es."),
proposals.map(function (p) {
var done = p.status !== "PENDING";
return (React.createElement("div", { key: p.id, style: Object.assign({}, card, { marginBottom: 12, opacity: done ? 0.65 : 1 }) },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 } },
React.createElement("span", { style: { fontSize: 10, fontWeight: 800, fontFamily: "monospace", color: T.violet, background: T.violetSoft, padding: "2px 9px", borderRadius: 7 } }, p.id),
React.createElement("span", { style: { fontSize: 13, fontWeight: 800, color: T.ink, flex: 1 } }, p.title),
done && React.createElement("span", { style: { fontSize: 9.5, fontWeight: 800, color: p.status === "ACCEPTED" ? T.green : T.red, background: p.status === "ACCEPTED" ? T.greenSoft : T.redSoft, padding: "3px 10px", borderRadius: 12 } }, p.status === "ACCEPTED" ? "✓ APPROUVÉE" : "✕ REJETÉE")),
React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 5 } }, "\u00C9vidence (Explainable AI)"),
p.evidence.map(function (e, i) { return React.createElement("div", { key: i, style: { fontSize: 11.5, color: T.inkMid, marginBottom: 3 } },
"\u2022 ",
e); }),
React.createElement("div", { style: { margin: "12px 0", padding: "11px 14px", background: T.ink, borderRadius: 9, fontFamily: "monospace", fontSize: 11, color: "#D8E4C8", lineHeight: 1.6 } }, p.proposedCondition),
React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 6 } }, "Simulation sur le portefeuille (obligatoire avant activation)"),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 } }, [["Alertes", p.sim.before + " → " + p.sim.after, T.blue],
["Faux positifs", p.sim.fpBefore + "% → " + p.sim.fpAfter + "%", p.sim.fpAfter < p.sim.fpBefore ? T.green : T.amber],
["Charge analystes", "−" + p.sim.chargeReduction + "%", T.green],
["Nouvelle version", amlNextVersion(p.ruleId), T.violet]].map(function (x) {
return (React.createElement("div", { key: x[0], style: { padding: "9px 11px", background: T.cream, borderRadius: 9, textAlign: "center" } },
React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: x[2], fontFamily: "monospace" } }, x[1]),
React.createElement("div", { style: { fontSize: 8.5, color: T.inkSoft, textTransform: "uppercase", marginTop: 2 } }, x[0])));
})),
!done && (React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
React.createElement("button", { onClick: function () { amlApproveProposal(p, user); re(); }, disabled: !canApprove, title: canApprove ? "" : "Réservé : Compliance senior / Direction / MLRO", style: { padding: "8px 18px", borderRadius: 9, border: "none", background: canApprove ? T.green : T.line, color: "#fff", fontSize: 12, fontWeight: 800, cursor: canApprove ? "pointer" : "not-allowed" } },
"\u2713 Approuver & d\u00E9ployer ",
amlNextVersion(p.ruleId)),
React.createElement("button", { onClick: function () { amlRejectProposal(p, user); re(); }, style: { padding: "8px 16px", borderRadius: 9, border: "1px solid " + T.red, background: T.surface, color: T.red, fontSize: 12, fontWeight: 700, cursor: "pointer" } }, "\u2715 Rejeter"),
!canApprove && React.createElement("span", { style: { fontSize: 10, color: T.inkSoft, fontStyle: "italic" } },
"Votre r\u00F4le (",
(user && user.roleLabel) || "—",
") peut consulter mais pas approuver \u2014 s\u00E9paration des r\u00F4les.")))));
}),
versionedRules.length > 0 && (React.createElement("div", { style: Object.assign({}, card, { marginBottom: 12 }) },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 } }, "\u238C Versions & r\u00E9versibilit\u00E9"),
versionedRules.map(function (id) {
return (React.createElement("div", { key: id, style: { marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid " + T.lineSoft } },
React.createElement("div", { style: { fontSize: 11.5, fontWeight: 800, color: T.olive700, fontFamily: "monospace", marginBottom: 4 } }, id),
AML_RULE_VERSIONS[id].map(function (v, i) {
return (React.createElement("div", { key: i, style: { fontSize: 10.5, color: T.inkMid, marginBottom: 2 } },
React.createElement("strong", { style: { fontFamily: "monospace", color: T.ink } }, v.v),
" \u00B7 ",
v.kind === "REVERT" ? "↩ Revert" : "Gate risque ≥ MEDIUM",
" \u00B7 auteur : ",
v.author,
" \u00B7 approbateur : ",
v.approver,
" \u00B7 ",
v.date,
" \u2014 ",
React.createElement("em", null, v.justification)));
})));
}))),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 } }, "Gouvernance"),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 } }, [["👥 Séparation des rôles", "L'IA propose, l'analyste consulte, seul un rôle senior approuve."],
["📜 Journal d'audit complet", "Chaque proposition, approbation, rejet et revert écrit dans la piste d'audit réelle."],
["💬 Explainable AI", "Chaque recommandation cite ses évidences chiffrées, mesurées sur le portefeuille."],
["⎌ Réversibilité", "Retour à la version précédente en un clic — versionné lui aussi."],
["🧪 Simulation obligatoire", "Impact alertes / FP / charge calculé avant toute activation."],
["📊 KPI avant/après", "Fréquence et taux de FP recalculés en continu après déploiement."]].map(function (f) {
return (React.createElement("div", { key: f[0], style: { padding: "10px 12px", background: T.cream, borderRadius: 9 } },
React.createElement("div", { style: { fontSize: 11.5, fontWeight: 700, color: T.ink, marginBottom: 3 } }, f[0]),
React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, lineHeight: 1.4 } }, f[1])));
})))))));
}
