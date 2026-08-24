import React, { useState } from "react";
import { T } from "./tokens";
import { ExportBtn } from "./components-data";
import { pushParamAudit } from "./param-audit-support";
import { MROS_REPORTS, mrosAckAge } from "./compliance-support";
import { CRS_PARTNERS, crsReportable, fatcaReportable, crsXml, fatcaXml, regDownloadXml, REG_DEADLINES, sarGoamlXml, esisuisseView, REG_PRODUCTION } from "./reporting-support";

// Source : docs/reference/olive-demo.html 32815-32986 — ReportingScreen (Reporting réglementaire).
// 5 onglets : CRS/EAR · FATCA · SAR/goAML · esisuisse · échéancier. XML générés à la demande depuis le
// portefeuille réel, chaque génération auditée. Porté verbatim.

export default function ReportingScreen({ user }: { user?: any }) {
const [tab, setTab] = useState("crs");
const [, bump] = useState(0);
const re = function () { bump(function (x) { return x + 1; }); };
const card = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
const by = crsReportable();
const ccs = Object.keys(by).sort();
const nCrs = ccs.reduce(function (a, cc) { return a + by[cc].length; }, 0);
const missing = ccs.reduce(function (a, cc) { return a + by[cc].filter(function (r: any) { return !r.selfCert; }).length; }, 0);
const fat = fatcaReportable();
return (React.createElement("div", null,
React.createElement("div", { style: { marginBottom: 16 } },
React.createElement("div", { style: { fontSize: 19, fontWeight: 800, color: T.ink } }, "▤ Reporting réglementaire — EAR / CRS · FATCA · échéancier"),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft, marginTop: 3 } },
nCrs,
" relations déclarables CRS vers ",
ccs.length,
" juridictions partenaires (",
missing,
" auto-certifications à collecter) · ",
fat.length,
" relations FATCA. XML générés à la demande depuis le portefeuille réel — chaque génération est auditée.")),
React.createElement("div", { style: { display: "flex", gap: 4, marginBottom: 16, background: T.surface, padding: 5, borderRadius: 12, border: "1px solid " + T.line, width: "fit-content" } }, [["crs", "▤ CRS / EAR"], ["fatca", "🇺🇸 FATCA"], ["sar", "🚨 SAR / goAML"], ["esisuisse", "🛟 esisuisse"], ["cal", "📅 Échéancier"]].map(function (x) {
return (React.createElement("button", { key: x[0], onClick: function () { setTab(x[0]); }, style: { padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === x[0] ? T.olive600 : "transparent", color: tab === x[0] ? "#fff" : T.inkMid, fontSize: 12.5, fontWeight: tab === x[0] ? 700 : 500 } }, x[1]));
})),
tab === "crs" && (React.createElement("div", null,
React.createElement("div", { style: Object.assign({}, card, { marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }) },
React.createElement("div", { style: { flex: 1, minWidth: 260 } },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink } }, "Campagne 2026 (données au 31.12.2025) — transmise à l'AFC le 26.06.2026"),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginTop: 2 } }, "Prochaine échéance : 30.06.2027. Les XML ci-dessous régénèrent l'état courant par juridiction (schéma OCDE CRS v2 simplifié).")),
React.createElement("button", { onClick: function () { ccs.forEach(function (cc) { regDownloadXml("CRS-2026-" + cc + ".xml", crsXml(cc, by[cc]), user, "CRS " + cc); }); re(); }, style: { padding: "9px 16px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer" } },
"⬇ Générer tous les XML (",
ccs.length,
")")),
ccs.map(function (cc) {
var rows = by[cc];
var miss = rows.filter(function (r: any) { return !r.selfCert; }).length;
return (React.createElement("div", { key: cc, style: Object.assign({}, card, { marginBottom: 10 }) },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 } },
React.createElement("span", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, flex: 1 } },
CRS_PARTNERS[cc],
" (",
cc,
") — ",
rows.length,
" relation(s) déclarable(s)",
miss > 0 && React.createElement("span", { style: { color: T.amber } },
" · ",
miss,
" auto-cert. manquante(s)")),
React.createElement("button", { onClick: function () { regDownloadXml("CRS-2026-" + cc + ".xml", crsXml(cc, rows), user, "CRS " + cc); re(); }, style: { padding: "7px 13px", borderRadius: 8, border: "1px solid " + T.line, background: T.surface, color: T.olive700, fontSize: 10.5, fontWeight: 800, cursor: "pointer" } }, "⬇ XML CRS")),
rows.map(function (r: any) {
return (React.createElement("div", { key: r.c.id, style: { display: "flex", gap: 9, alignItems: "baseline", fontSize: 10.5, padding: "3px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontWeight: 700, color: T.ink, flex: 1 } },
r.c.name,
" ",
React.createElement("span", { style: { fontWeight: 400, color: T.inkSoft } },
"· ",
r.c.typeLabel || "—")),
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkSoft } }, r.tin),
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkMid, width: 80, textAlign: "right" } }, r.c.aum),
React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: r.selfCert ? T.green : T.amber, background: r.selfCert ? T.greenSoft : T.amberSoft, padding: "2px 8px", borderRadius: 9, whiteSpace: "nowrap" } }, r.selfCert ? "Auto-cert. OK" : "À collecter")));
})));
}))),
tab === "fatca" && (React.createElement("div", { style: card },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 } },
React.createElement("div", { style: { flex: 1 } },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink } },
"FATCA — ",
fat.length,
" relation(s) avec indices US"),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginTop: 2 } }, "Transmission 8966 via IDES (accord FATCA Suisse-US, modèle 2). Documentation W-9 / W-8BEN-E par relation.")),
React.createElement("button", { onClick: function () { regDownloadXml("FATCA-8966-2026.xml", fatcaXml(fat), user, "FATCA 8966"); re(); }, style: { padding: "9px 16px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer" } }, "⬇ Générer 8966 (XML)")),
fat.length === 0 && React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft, fontStyle: "italic" } }, "Aucune relation avec indices US dans le portefeuille."),
fat.map(function (r: any) {
return (React.createElement("div", { key: r.c.id, style: { display: "flex", gap: 9, alignItems: "baseline", fontSize: 10.5, padding: "4px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontWeight: 700, color: T.ink, flex: 1 } },
r.c.name,
" ",
React.createElement("span", { style: { fontWeight: 400, color: T.inkSoft } },
"· ",
r.c.typeLabel || "—")),
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkSoft } }, r.giin),
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkMid, width: 80, textAlign: "right" } }, r.c.aum),
React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: r.status === "Documenté" ? T.green : T.amber, background: r.status === "Documenté" ? T.greenSoft : T.amberSoft, padding: "2px 8px", borderRadius: 9, whiteSpace: "nowrap" } },
r.form,
" — ",
r.status)));
}))),
(tab === "crs" || tab === "fatca") && (function () {
var key = tab === "crs" ? "CRS" : "FATCA";
var prod = REG_PRODUCTION[key];
var issues: any[] = [];
if (tab === "crs") {
var byC = crsReportable();
Object.keys(byC).forEach(function (cc) { byC[cc].forEach(function (x: any) { if (!x.selfCert)
issues.push("Auto-certification manquante : " + x.c.name + " (" + cc + ")"); }); });
issues = issues.slice(0, 6);
}
else {
issues = fatcaReportable().filter(function (x: any) { return x.form !== "W-9" && x.status !== "Documenté"; }).slice(0, 6).map(function (x: any) { return "Formulaire " + x.form + " à renouveler : " + x.c.name; });
}
var NEXT: any = { "PRÉPARÉ": "VALIDÉ", "VALIDÉ": "DÉPOSÉ" };
return (React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", borderRadius: 12, background: issues.length ? T.amberSoft : T.greenSoft, marginBottom: 14 } },
React.createElement("span", { style: { fontSize: 10.5, fontWeight: 800, color: T.ink } },
"Production ",
key,
" 2025 : ",
prod.status,
prod.by ? (" — " + prod.by) : ""),
React.createElement("span", { style: { fontSize: 10, color: T.inkMid, flex: 1 } }, issues.length ? ("⚠ " + issues.length + " contrôle(s) de complétude : " + issues[0] + (issues.length > 1 ? " (+" + (issues.length - 1) + ")" : "")) : "✓ Contrôles de complétude passés — prêt au dépôt"),
NEXT[prod.status] && React.createElement("button", { onClick: function () { prod.status = NEXT[prod.status]; prod.by = (user && user.name) || "—"; pushParamAudit((user && user.name) || "—", "Reporting " + key + " — " + prod.status); re(); }, disabled: prod.status === "PRÉPARÉ" && issues.length > 0, title: issues.length ? "Lever les contrôles avant validation" : "", style: { padding: "6px 13px", borderRadius: 9, border: "none", background: (prod.status === "PRÉPARÉ" && issues.length > 0) ? T.line : T.olive600, color: "#fff", fontSize: 10, fontWeight: 800, cursor: (prod.status === "PRÉPARÉ" && issues.length > 0) ? "not-allowed" : "pointer" } },
"▶ ",
NEXT[prod.status])));
})(),
tab === "sar" && (React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 4 } }, "🚨 Communications MROS — format goAML 4.0"),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 12 } }, "Art. 9 LBA (soupçon fondé) et art. 305ter al. 2 CP (droit de communication). Rédaction & suivi dans le Compliance Center ; export goAML ici."),
MROS_REPORTS.length === 0 && React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, fontStyle: "italic" } }, "Aucune communication — les dossiers se créent depuis une alerte AML (Compliance Center → MROS)."),
MROS_REPORTS.map(function (r: any) {
var a = mrosAckAge(r);
return (React.createElement("div", { key: r.ref, style: { display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontFamily: "monospace", fontSize: 11, fontWeight: 800, color: T.olive700, width: 120, flexShrink: 0 } }, r.ref),
React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: T.ink, flex: 1 } }, r.clientName || "—"),
React.createElement("span", { style: { fontSize: 10, color: T.inkSoft } },
r.status || "—",
a ? (" · J+" + a.days + " (" + a.level + ")") : ""),
React.createElement("button", { onClick: function () { var blob = new Blob([sarGoamlXml(r)], { type: "application/xml" }); var u = URL.createObjectURL(blob); var el = document.createElement("a"); el.href = u; el.download = r.ref + "-goaml.xml"; el.click(); URL.revokeObjectURL(u); pushParamAudit((user && user.name) || "—", "SAR — export goAML : " + r.ref); }, style: { padding: "5px 12px", borderRadius: 8, border: "1px solid " + T.olive600, background: "transparent", color: T.olive700, fontSize: 9.5, fontWeight: 800, cursor: "pointer" } }, "⬇ goAML XML")));
}))),
tab === "esisuisse" && (function () {
var rows = esisuisseView();
var totDep = rows.reduce(function (a, x) { return a + x.dep; }, 0), totCov = rows.reduce(function (a, x) { return a + x.covered; }, 0);
return (React.createElement("div", { style: card },
React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 4, flexWrap: "wrap" } },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, flex: 1 } }, "🛟 esisuisse — garantie des dépôts (vue client unique)"),
React.createElement(ExportBtn, { filename: "esisuisse-vue-client-unique.csv", headers: ["Client", "ID", "Dépôts CHF", "Couvert (≤100k)", "Non couvert"], rows: function () { return rows.map(function (x) { return [x.c.name, x.c.id, x.dep, x.covered, x.uncovered]; }); } })),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 12 } },
"Plafond CHF 100'000 par déposant (art. 37h LB) · la vue client unique doit être productible sous 24–48 h · ",
rows.length,
" déposants · dépôts CHF ",
totDep.toLocaleString("fr-CH"),
" · couverts CHF ",
totCov.toLocaleString("fr-CH"),
" (",
Math.round(totCov / Math.max(1, totDep) * 100),
"%)."),
rows.slice(0, 20).map(function (x) {
return (React.createElement("div", { key: x.c.id, style: { display: "flex", gap: 10, alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid " + T.lineSoft, fontSize: 10.5 } },
React.createElement("span", { style: { fontWeight: 700, color: T.ink, flex: 1 } }, x.c.name),
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkMid } },
"dépôts ",
x.dep.toLocaleString("fr-CH")),
React.createElement("span", { style: { fontFamily: "monospace", fontWeight: 800, color: T.green } },
"couvert ",
x.covered.toLocaleString("fr-CH")),
React.createElement("span", { style: { fontFamily: "monospace", color: x.uncovered > 0 ? T.amber : T.inkSoft } },
"hors garantie ",
x.uncovered.toLocaleString("fr-CH"))));
}),
rows.length > 20 && React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, marginTop: 6 } }, "… export CSV pour la vue complète.")));
})(),
tab === "cal" && (React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 } }, "📅 Échéancier réglementaire — vue banque"),
REG_DEADLINES.map(function (d: any, i: number) {
var past = d.date <= "2026-07-11";
return (React.createElement("div", { key: i, style: { display: "flex", gap: 10, alignItems: "baseline", padding: "7px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontFamily: "monospace", fontSize: 10.5, fontWeight: 800, color: past ? T.inkSoft : T.olive700, width: 84, flexShrink: 0 } }, d.date),
React.createElement("span", { style: { fontSize: 11.5, color: T.ink, flex: 1, fontWeight: 600 } }, d.label),
React.createElement("span", { style: { fontSize: 10, color: T.inkSoft, width: 110 } }, d.org),
React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: d.done ? T.green : past ? T.red : T.amber, background: d.done ? T.greenSoft : past ? T.redSoft : T.amberSoft, padding: "3px 10px", borderRadius: 10, whiteSpace: "nowrap" } }, d.done ? "✓ Transmis" : past ? "⚠ En retard" : "À venir")));
})))));
}
