import React, { useState } from "react";
import { T } from "./tokens";
import CLIENTS from "../fixtures/CLIENTS.json";
import ACCOUNT_REVIEWS_DATA from "../fixtures/ACCOUNT_REVIEWS_DATA.json";
import { clientById, kycsByClientId } from "./components-data";
import { CONTACT_REPORTS } from "./contactreports-support";
import { pmsEnrich } from "./pms-support";
import { clientVisibleTo } from "./cloison-support";
import { LEGAL_CONTRACTS, GED_DOCS } from "./legal-support";
import { pushParamAudit } from "./param-audit-support";
import { crmRelances, crmOpportunities, crmCoverage, crmNnmPlan, crmTierOf } from "./crm-support";

// Source : docs/reference/olive-demo.html 30049-30332 — CrmScreen + Crm360 (CRM Banque). Porté verbatim.
// GED_DOCS importé du module Legal (seed vide, alimenté par génération de contrats) — le seed documentaire
// de 30 clients du bloc GED (30340) n'est pas encore porté → compteur « Documents GED » à 0 jusqu'au port GED.

function Crm360({ user }: { user?: any }) {
const [cid, setCid] = useState("");
const card = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
const c = cid ? clientById[cid] : null;
const sel = (React.createElement("select", { value: cid, onChange: function (e: any) { setCid(e.target.value); }, style: { padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5, minWidth: 240 } },
React.createElement("option", { value: "" }, "— Client (vue 360°) —"),
(CLIENTS as any[]).filter(function (x: any) { return clientVisibleTo(user, x); }).sort(function (a: any, b: any) { return a.name.localeCompare(b.name); }).map(function (x: any) { return React.createElement("option", { key: x.id, value: x.id }, x.name); })));
if (!c)
return React.createElement("div", { style: card }, sel);
const t = crmTierOf(c);
const e = pmsEnrich(c);
const cov = crmCoverage(user).find(function (x: any) { return x.c.id === c.id; });
const contracts = (LEGAL_CONTRACTS as any[]).filter(function (k: any) { return k.clientId === c.id && k.status !== "TERMINATED"; });
const docs = (GED_DOCS as any[]).filter(function (d: any) { return d.clientId === c.id; });
const ars = (ACCOUNT_REVIEWS_DATA as any[]).filter(function (a: any) { return a.clientId === c.id; });
const contacts = (CONTACT_REPORTS as any[]).filter(function (r: any) { return r.clientId === c.id; }).sort(function (a: any, b: any) { return a.date < b.date ? 1 : -1; });
const kyc = (kycsByClientId[c.id] || []).slice(-1)[0] || {};
const B = function (l: any, v: any, col?: any) { return React.createElement("div", { style: { background: T.cream, borderRadius: 11, padding: "9px 12px" } },
React.createElement("div", { style: { fontSize: 8.5, color: T.inkSoft, textTransform: "uppercase" } }, l),
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: col || T.ink } }, v)); };
return (React.createElement("div", { style: card },
React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" } },
sel,
React.createElement("span", { style: { fontSize: 10, fontWeight: 800, color: "#fff", background: t.tier === "A" ? T.gold : t.tier === "B" ? T.olive600 : T.inkSoft, padding: "4px 12px", borderRadius: 10 } },
"TIER ",
t.tier),
c.exotic && React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color: T.amber } },
c.exoticIcon,
" ",
c.sector),
React.createElement("span", { style: { marginLeft: "auto", fontSize: 10.5, color: cov && cov.overdue ? T.red : T.green, fontWeight: 700 } }, cov && cov.last ? ("Dernier contact : " + cov.last + " (J-" + cov.days + (cov.overdue ? " — SLA " + t.sla + "j dépassé" : "") + ")") : "Jamais contacté")),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8, marginBottom: 14 } },
B("AUM", c.aum),
B("Valorisation PMS", "CHF " + Math.round(e.totalChf / 1000000) + "M"),
B("Perf YTD", (e.ytd > 0 ? "+" : "") + e.ytd + "%", e.ytd >= 0 ? T.green : T.red),
B("Risque", c.risk, c.risk === "HIGH" ? T.red : c.risk === "MEDIUM" ? T.amber : T.green),
B("KYC", kyc.code || "—"),
B("Contrats", contracts.length + " actifs")),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } },
React.createElement("div", null,
React.createElement("div", { style: { fontSize: 10.5, fontWeight: 800, color: T.olive700, textTransform: "uppercase", marginBottom: 6 } }, "Timeline relation"),
contacts.slice(0, 7).map(function (r: any) {
return (React.createElement("div", { key: r.id, style: { display: "flex", gap: 8, fontSize: 10.5, padding: "4px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkSoft, flexShrink: 0 } }, r.date),
React.createElement("span", { style: { color: T.olive700, flexShrink: 0 } }, r.channel),
React.createElement("span", { style: { color: T.inkMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.subject)));
}),
contacts.length === 0 && React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, fontStyle: "italic" } }, "Aucun contact consigné.")),
React.createElement("div", null,
React.createElement("div", { style: { fontSize: 10.5, fontWeight: 800, color: T.olive700, textTransform: "uppercase", marginBottom: 6 } }, "Dossier & juridique"),
[["Revues", ars.length ? ars.map(function (a: any) { return a.status; }).join(" · ") : "—"], ["Contrats actifs", contracts.map(function (k: any) { return k.label; }).slice(0, 2).join(" · ") || "—"], ["Documents GED", docs.length + " (" + docs.filter(function (d: any) { return d.status === "A_VALIDER"; }).length + " à valider)"], ["Langue de correspondance", c.corrLang || "FR"], ["Desk", c.desk || "—"]].map(function (x: any, i: number) {
return (React.createElement("div", { key: i, style: { display: "flex", gap: 8, fontSize: 10.5, padding: "4px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontWeight: 700, color: T.ink, width: 150, flexShrink: 0 } }, x[0]),
React.createElement("span", { style: { color: T.inkMid } }, x[1])));
})))));
}

export default function CrmScreen({ user }: { user?: any }) {
const [tab, setTab] = useState("c360");
const [chF, setChF] = useState("ALL");
const [nf, setNf] = useState<any>({ clientId: "", channel: "Rendez-vous", subject: "", nextStep: "", nextDate: "" });
const [, bump] = useState(0);
const re = function () { bump(function (x) { return x + 1; }); };
const card = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
const INP = { padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5, boxSizing: "border-box" as const };
const rel = crmRelances();
const relLate = rel.filter(function (x: any) { return x.late; });
const opps = crmOpportunities();
const rows = (CONTACT_REPORTS as any[]).slice().sort(function (a: any, b: any) { return a.date < b.date ? 1 : -1; }).filter(function (r: any) { return chF === "ALL" || r.channel === chF; });
const RMS: any = {};
(CONTACT_REPORTS as any[]).forEach(function (r: any) { if (r.rm)
(RMS[r.rm] = RMS[r.rm] || []).push(r); });
return (React.createElement("div", null,
React.createElement("div", { style: { marginBottom: 16 } },
React.createElement("div", { style: { fontSize: 19, fontWeight: 800, color: T.ink } }, "📇 CRM Banque"),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft, marginTop: 3 } },
(CONTACT_REPORTS as any[]).length,
" contacts · ",
rel.length,
" relances (",
React.createElement("span", { style: { color: relLate.length ? T.red : T.green, fontWeight: 700 } },
relLate.length,
" échues"),
") · ",
opps.length,
" opportunités")),
React.createElement("div", { style: { display: "flex", gap: 4, marginBottom: 16, background: T.surface, padding: 5, borderRadius: 12, border: "1px solid " + T.line, width: "fit-content" } }, [["journal", "📇 Journal"], ["relances", "🔔 Relances & opportunités"], ["activite", "📊 Activité RM"]].map(function (x) {
return (React.createElement("button", { key: x[0], onClick: function () { setTab(x[0]); }, style: { padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === x[0] ? T.olive600 : "transparent", color: tab === x[0] ? "#fff" : T.inkMid, fontSize: 12.5, fontWeight: tab === x[0] ? 700 : 500 } },
x[1],
x[0] === "relances" && relLate.length > 0 && React.createElement("span", { style: { marginLeft: 6, fontSize: 9, fontWeight: 800, background: T.red, color: "#fff", padding: "1px 6px", borderRadius: 8 } }, relLate.length)));
})),
tab === "c360" && React.createElement(Crm360, { user: user }),
tab === "tiering" && (function () {
var cov = crmCoverage(user);
var byT: any = { A: [], B: [], C: [] };
cov.forEach(function (x: any) { byT[x.tier.tier].push(x); });
var nnm = crmNnmPlan(user);
return (React.createElement("div", null,
React.createElement("div", { style: Object.assign({}, card, { marginBottom: 14 }) },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 8 } }, "🎯 Tiering & SLA de couverture"),
["A", "B", "C"].map(function (tt) {
var list = byT[tt];
var late = list.filter(function (x: any) { return x.overdue; });
return (React.createElement("div", { key: tt, style: { display: "flex", gap: 10, alignItems: "baseline", padding: "7px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontSize: 11, fontWeight: 800, color: "#fff", background: tt === "A" ? T.gold : tt === "B" ? T.olive600 : T.inkSoft, padding: "3px 11px", borderRadius: 9, width: 64, textAlign: "center", flexShrink: 0 } },
"Tier ",
tt),
React.createElement("span", { style: { fontSize: 11, color: T.inkMid, flex: 1 } },
list.length,
" relations · SLA ",
tt === "A" ? "90" : tt === "B" ? "180" : "365",
" j"),
React.createElement("span", { style: { fontSize: 11, fontWeight: 800, color: late.length ? T.red : T.green } },
late.length,
" hors SLA")));
}),
React.createElement("div", { style: { marginTop: 10 } }, cov.filter(function (x: any) { return x.overdue; }).sort(function (a: any, b: any) { return b.days - a.days; }).slice(0, 8).map(function (x: any) {
return (React.createElement("div", { key: x.c.id, style: { display: "flex", gap: 9, fontSize: 10.5, padding: "4px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontWeight: 800, color: T.red, width: 70, flexShrink: 0 } },
"J-",
x.days === 9999 ? "∞" : x.days),
React.createElement("span", { style: { fontWeight: 700, color: T.ink, width: 180, flexShrink: 0 } }, x.c.name),
React.createElement("span", { style: { color: T.inkMid, flex: 1 } }, x.tier.label),
React.createElement("span", { style: { color: T.inkSoft } }, x.c.rm)));
}))),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 8 } }, "📈 Plan NNM 2026 — cible 5% de l'AUM par relation"),
nnm.slice(0, 10).map(function (x: any) {
return (React.createElement("div", { key: x.rm, style: { marginBottom: 9 } },
React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "baseline", fontSize: 10.5, marginBottom: 3 } },
React.createElement("span", { style: { fontWeight: 700, color: T.ink, width: 150, flexShrink: 0 } }, x.rm),
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkMid } },
"réalisé ",
x.real,
"M / cible ",
x.target,
"M"),
React.createElement("span", { style: { fontWeight: 800, color: x.pct >= 100 ? T.green : x.pct >= 60 ? T.amber : T.red } },
x.pct,
"%")),
React.createElement("div", { style: { height: 6, background: T.lineSoft, borderRadius: 3 } },
React.createElement("div", { style: { height: "100%", width: Math.min(100, x.pct) + "%", background: x.pct >= 100 ? T.green : x.pct >= 60 ? T.amber : T.red, borderRadius: 3 } }))));
}))));
})(),
tab === "journal" && (React.createElement("div", null,
React.createElement("div", { style: Object.assign({}, card, { marginBottom: 14 }) },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 8 } }, "➕ Consigner un contact"),
React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
React.createElement("select", { value: nf.clientId, onChange: function (e: any) { setNf(Object.assign({}, nf, { clientId: e.target.value })); }, style: Object.assign({}, INP, { flex: "1 1 200px" }) },
React.createElement("option", { value: "" }, "— Client —"),
(CLIENTS as any[]).slice().sort(function (a: any, b: any) { return a.name.localeCompare(b.name); }).map(function (c: any) { return React.createElement("option", { key: c.id, value: c.id }, c.name); })),
React.createElement("select", { value: nf.channel, onChange: function (e: any) { setNf(Object.assign({}, nf, { channel: e.target.value })); }, style: INP }, ["Rendez-vous", "Appel téléphonique", "Email", "Visioconférence", "Business Trip"].map(function (x) { return React.createElement("option", { key: x, value: x }, x); })),
React.createElement("input", { placeholder: "Sujet / résumé", value: nf.subject, onChange: function (e: any) { setNf(Object.assign({}, nf, { subject: e.target.value })); }, style: Object.assign({}, INP, { flex: "2 1 220px" }) }),
React.createElement("input", { placeholder: "Prochaine action (opt.)", value: nf.nextStep, onChange: function (e: any) { setNf(Object.assign({}, nf, { nextStep: e.target.value })); }, style: Object.assign({}, INP, { flex: "1 1 180px" }) }),
React.createElement("input", { type: "date", value: nf.nextDate, onChange: function (e: any) { setNf(Object.assign({}, nf, { nextDate: e.target.value })); }, style: INP }),
React.createElement("button", { onClick: function () { if (nf.clientId && nf.subject) {
var c = clientById[nf.clientId];
(CONTACT_REPORTS as any[]).unshift({ id: "CR-" + (5000 + (CONTACT_REPORTS as any[]).length), clientId: c.id, personName: c.uboName, channel: nf.channel, date: "2026-07-11", rm: (user && user.name) || c.rm, subject: nf.subject, notes: nf.subject, nextStep: nf.nextStep || null, nextDate: nf.nextDate || null, nextDone: false });
pushParamAudit((user && user.name) || "—", "CRM — contact consigné : " + c.name + " (" + nf.channel + ")");
setNf({ clientId: "", channel: "Rendez-vous", subject: "", nextStep: "", nextDate: "" });
re();
} }, disabled: !(nf.clientId && nf.subject), style: { padding: "9px 16px", borderRadius: 9, border: "none", background: (nf.clientId && nf.subject) ? T.olive600 : T.line, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: (nf.clientId && nf.subject) ? "pointer" : "not-allowed" } }, "✓ Consigner")),
React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, marginTop: 8 } }, "Pour la rédaction assistée par IA (brouillon, similaires), utilisez l'écran Contact Reports.")),
React.createElement("div", { style: card },
React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" } },
["ALL", "Rendez-vous", "Appel téléphonique", "Email", "Visioconférence", "Business Trip"].map(function (v) {
return (React.createElement("button", { key: v, onClick: function () { setChF(v); }, style: { padding: "5px 11px", borderRadius: 8, border: "1px solid " + (chF === v ? T.olive600 : T.line), background: chF === v ? T.oliveSoft : T.surface, color: chF === v ? T.olive700 : T.inkMid, fontSize: 10.5, fontWeight: 700, cursor: "pointer" } }, v === "ALL" ? "Tous canaux" : v));
}),
React.createElement("span", { style: { fontSize: 11, color: T.inkSoft, marginLeft: "auto", alignSelf: "center" } },
rows.length,
" contact(s)")),
rows.slice(0, 40).map(function (r: any) {
var c = clientById[r.clientId] || {};
return (React.createElement("div", { key: r.id, style: { display: "flex", gap: 9, alignItems: "baseline", fontSize: 10.5, padding: "5px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkSoft, width: 74, flexShrink: 0 } }, r.date),
React.createElement("span", { style: { fontWeight: 700, color: T.ink, width: 170, flexShrink: 0 } }, c.name || r.clientId),
React.createElement("span", { style: { color: T.olive700, width: 120, flexShrink: 0 } }, r.channel),
React.createElement("span", { style: { color: T.inkMid, flex: 1 } }, r.subject),
React.createElement("span", { style: { color: T.inkSoft, width: 110, flexShrink: 0, textAlign: "right" } }, r.rm),
r.nextStep && !r.nextDone && React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: r.nextDate && r.nextDate < "2026-07-11" ? T.red : T.amber, whiteSpace: "nowrap" } },
"→ ",
r.nextDate || "")));
}),
rows.length > 40 && React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, marginTop: 6 } },
"… et ",
rows.length - 40,
" autres (export via BI).")))),
tab === "relances" && (React.createElement("div", null,
React.createElement("div", { style: Object.assign({}, card, { marginBottom: 14 }) },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 8 } },
"🔔 Relances planifiées — ",
rel.length,
", dont ",
relLate.length,
" échue(s)"),
rel.slice(0, 15).map(function (x: any) {
var c = clientById[x.r.clientId] || {};
return (React.createElement("div", { key: x.r.id, style: { display: "flex", gap: 9, alignItems: "center", padding: "6px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: x.late ? T.red : T.amber, background: x.late ? T.redSoft : T.amberSoft, padding: "3px 9px", borderRadius: 9, width: 86, textAlign: "center", flexShrink: 0 } }, x.late ? ("J+" + x.days) : x.r.nextDate),
React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: T.ink, width: 170, flexShrink: 0 } }, c.name || ""),
React.createElement("span", { style: { fontSize: 10.5, color: T.inkMid, flex: 1 } }, x.r.nextStep),
React.createElement("span", { style: { fontSize: 10, color: T.inkSoft, width: 110, textAlign: "right" } }, x.r.rm),
React.createElement("button", { onClick: function () { x.r.nextDone = true; pushParamAudit((user && user.name) || "—", "CRM — relance clôturée : " + (c.name || "") + " (" + x.r.nextStep + ")"); re(); }, style: { padding: "5px 11px", borderRadius: 8, border: "1px solid " + T.green, background: "transparent", color: T.green, fontSize: 9.5, fontWeight: 800, cursor: "pointer" } }, "✓ Fait")));
})),
React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 4 } }, "💡 Opportunités dérivées des modules"),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 10 } }),
opps.slice(0, 12).map(function (o: any, i: number) {
return (React.createElement("div", { key: i, style: { display: "flex", gap: 9, alignItems: "baseline", padding: "5px 0", borderBottom: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontSize: 8.5, fontWeight: 800, color: o.type === "COUVERTURE" ? T.amber : o.type === "PORTEFEUILLE" ? T.violet : T.olive700, width: 96, flexShrink: 0 } }, o.type),
React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: T.ink, width: 170, flexShrink: 0 } }, o.c.name),
React.createElement("span", { style: { fontSize: 10.5, color: T.inkMid, flex: 1 } }, o.msg),
React.createElement("span", { style: { fontSize: 9.5, fontWeight: 700, color: T.olive700, whiteSpace: "nowrap" } }, o.act)));
})))),
tab === "activite" && (React.createElement("div", { style: card },
React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 } }, "📊 Activité par RM — 12 mois glissants"),
Object.keys(RMS).sort(function (a, b) { return RMS[b].length - RMS[a].length; }).map(function (rm) {
var list = RMS[rm];
var myClients = (CLIENTS as any[]).filter(function (c: any) { return c.rm === rm; });
var covered = myClients.filter(function (c: any) { return (CONTACT_REPORTS as any[]).some(function (r: any) { return r.clientId === c.id && r.date >= "2026-04-11"; }); }).length;
var covPct = myClients.length ? Math.round(covered / myClients.length * 100) : 0;
var late = rel.filter(function (x: any) { return x.late && x.r.rm === rm; }).length;
var mx = Math.max.apply(null, Object.keys(RMS).map(function (k) { return RMS[k].length; }));
return (React.createElement("div", { key: rm, style: { marginBottom: 9 } },
React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "baseline", fontSize: 10.5, marginBottom: 3 } },
React.createElement("span", { style: { fontWeight: 700, color: T.ink, width: 150, flexShrink: 0 } }, rm),
React.createElement("span", { style: { fontFamily: "monospace", color: T.inkMid } },
list.length,
" contacts"),
React.createElement("span", { style: { color: covPct >= 60 ? T.green : covPct >= 35 ? T.amber : T.red } },
"couverture 90 j : ",
covPct,
"% (",
covered,
"/",
myClients.length,
")"),
late > 0 && React.createElement("span", { style: { color: T.red, fontWeight: 700 } },
"· ",
late,
" relance(s) échue(s)")),
React.createElement("div", { style: { height: 6, background: T.lineSoft, borderRadius: 3 } },
React.createElement("div", { style: { height: "100%", width: Math.round(list.length / mx * 100) + "%", background: T.olive600, borderRadius: 3 } }))));
})))));
}
