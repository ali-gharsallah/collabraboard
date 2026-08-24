import React, { useState } from "react";
import { T } from "./tokens";
import { Badge, SectionTitle } from "./components";
import { AML_SCENARIOS } from "./aml-workspace-support";
import { TX_HUBS, TX_HUB_CC, TX_DATA, TX_RISK_C, TX_CONTINENTS } from "./tx-support";
import { CPSI_PAYS_RISQUE } from "./cpsi-engine-support";
import { FilterBar } from "../components/FilterBar";

// Source : docs/reference/olive-demo.html 43589-43909 — TransactionsRiskScreen (carte corridors / top flux / liste).
// Porté en React.createElement. Filtre « Risque » porté sur FilterBar (R404, R-FB.1).

export function TransactionsRiskScreen() {
const [txView, setTxView] = useState("carte");
const W = 900, H = 450;
const proj = (lon, lat) => [(lon + 180) / 360 * W, (78 - Math.max(-58, Math.min(78, lat))) / 136 * H];
const [selTx, setSelTx] = useState(null);
const [riskFilter, setRiskFilter] = useState("ALL");
const txs = TX_DATA.filter(t => riskFilter === "ALL" || t.risk === riskFilter);
const totalVol = TX_DATA.reduce((s, t) => s + t.amt, 0).toFixed(1);
const highCount = TX_DATA.filter(t => t.risk === "HIGH").length;
const hubsUsed = [...new Set(TX_DATA.flatMap(t => [t.from, t.to]))];
const countries = [...new Set(hubsUsed.map(h => TX_HUB_CC[h]))];
// volume agrégé par hub (pour la taille des nœuds)
const hubVol = {};
TX_DATA.forEach(t => { hubVol[t.from] = (hubVol[t.from] || 0) + t.amt; hubVol[t.to] = (hubVol[t.to] || 0) + t.amt; });
const arcPath = (a, b) => { const [x1, y1] = proj(...TX_HUBS[a]); const [x2, y2] = proj(...TX_HUBS[b]); const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; const dx = x2 - x1, dy = y2 - y1; const d = Math.sqrt(dx * dx + dy * dy); const lift = Math.min(90, d * 0.28); const cx = mx - dy / d * lift, cy = my - Math.abs(dx) / d * lift - 6; return { p: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`, x2, y2 }; };
  // Coloriage des pays par niveau de risque (CPSI_PAYS_RISQUE) — élevé rouge · moyen jaune · faible vert.
  const paysRiskColor = (cc) => { const r = (CPSI_PAYS_RISQUE as any)[cc]; if (r == null) return null; return r >= 3 ? T.red : (r >= 2 ? T.gold : T.green); };
  // KPI / tops sous la carte — top 5 grandes transactions, entrantes CH, sortantes CH (demande Ali).
  const CH_HUBS = hubsUsed.filter(h => TX_HUB_CC[h] === "🇨🇭");
  const isCH = (h) => CH_HUBS.indexOf(h) >= 0;
  const byAmt = (a, b) => b.amt - a.amt;
  const topBig = [...TX_DATA].sort(byAmt).slice(0, 5);
  const topIn = TX_DATA.filter(t => isCH(t.to) && !isCH(t.from)).sort(byAmt).slice(0, 5);
  const topOut = TX_DATA.filter(t => isCH(t.from) && !isCH(t.to)).sort(byAmt).slice(0, 5);
  const txRow5 = (t) => React.createElement("div", { key: t.id, onClick: () => setSelTx(selTx === t.id ? null : t.id), style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, cursor: "pointer", background: selTx === t.id ? T.oliveSoft : "transparent", borderBottom: `1px solid ${T.lineSoft}` } },
    React.createElement("span", { style: { fontSize: 10.5, fontFamily: "monospace", color: T.inkSoft, width: 62, flexShrink: 0 } }, t.id),
    React.createElement("span", { style: { fontSize: 11.5, fontWeight: 700, color: T.ink, flex: 1 } }, TX_HUB_CC[t.from] + " " + t.from + " → " + TX_HUB_CC[t.to] + " " + t.to),
    React.createElement("span", { style: { fontSize: 12, fontWeight: 800, fontFamily: "monospace", color: T[TX_RISK_C[t.risk]] } }, t.amt + "M"));
  const topPanel = (title, arr) => React.createElement("div", { key: title, style: { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14 } },
    React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 } }, title),
    arr.map(txRow5),
    arr.length === 0 && React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, fontStyle: "italic" } }, "Aucune"));
  const kpiTile = (v, l, c) => React.createElement("div", { key: l, style: { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 16px" } },
    React.createElement("div", { style: { fontSize: 22, fontWeight: 800, color: c, fontFamily: "monospace" } }, v),
    React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 } }, l));
return (React.createElement("div", null,
React.createElement("div", { style: { display: "flex", gap: 4, marginBottom: 16, background: T.surface, padding: 5, borderRadius: 12, border: `1px solid ${T.line}`, width: "fit-content" } }, [["carte", "◉ Carte des corridors"], ["flux", "⇄ Top flux & détail"], ["liste", "▤ Transactions"]].map(([id, label]) => (React.createElement("button", { key: id, onClick: () => setTxView(id), style: { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: txView === id ? T.olive600 : "transparent", color: txView === id ? "#fff" : T.inkMid, fontSize: 13, fontWeight: txView === id ? 700 : 500 } }, label)))),
txView === "flux" && (() => {
const CH = hubsUsed.filter(h => TX_HUB_CC[h] === "🇨🇭");
const isCH = h => CH.indexOf(h) >= 0;
const topIn = TX_DATA.filter(t => isCH(t.to) && !isCH(t.from)).sort((a, b) => b.amt - a.amt).slice(0, 5);
const topOut = TX_DATA.filter(t => isCH(t.from) && !isCH(t.to)).sort((a, b) => b.amt - a.amt).slice(0, 5);
const sel = TX_DATA.find(t => t.id === selTx);
const Row = (t) => (React.createElement("div", { key: t.id, onClick: () => setSelTx(selTx === t.id ? null : t.id), style: { display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, cursor: "pointer", background: selTx === t.id ? T.oliveSoft : "transparent", borderBottom: `1px solid ${T.lineSoft}` } },
React.createElement("span", { style: { fontSize: 10.5, fontFamily: "monospace", color: T.inkSoft, width: 64 } }, t.id),
React.createElement("span", { style: { fontSize: 11.5, fontWeight: 700, color: T.ink, flex: 1 } },
TX_HUB_CC[t.from],
" ",
t.from,
" \u2192 ",
TX_HUB_CC[t.to],
" ",
t.to),
React.createElement("span", { style: { fontSize: 12, fontWeight: 800, fontFamily: "monospace", color: T[TX_RISK_C[t.risk]] } },
t.amt,
"M")));
return (React.createElement("div", { style: { marginBottom: 16 } },
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } },
React.createElement("div", { style: { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14 } },
React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 } }, "\u2B07 Top 5 transactions entrantes (vers la Suisse)"),
topIn.map(Row),
topIn.length === 0 && React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, fontStyle: "italic" } }, "Aucune")),
React.createElement("div", { style: { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14 } },
React.createElement("div", { style: { fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 } }, "\u2B06 Top 5 transactions sortantes (depuis la Suisse)"),
topOut.map(Row),
topOut.length === 0 && React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, fontStyle: "italic" } }, "Aucune"))),
sel && (React.createElement("div", { style: { marginTop: 14, background: T.surface, border: `1.5px solid ${T[TX_RISK_C[sel.risk]]}`, borderRadius: 14, padding: 18 } },
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 } },
React.createElement("span", { style: { fontSize: 14, fontWeight: 800, color: T.ink } },
"D\u00E9tail transaction ",
sel.id),
React.createElement(Badge, { text: "Risque " + sel.risk, color: T[TX_RISK_C[sel.risk]], bg: T[TX_RISK_C[sel.risk]] + "18" }),
React.createElement("button", { onClick: () => setSelTx(null), style: { marginLeft: "auto", padding: "5px 11px", borderRadius: 7, border: `1px solid ${T.line}`, background: T.surface, color: T.inkMid, fontSize: 11, cursor: "pointer" } }, "Fermer")),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 } }, [["Date", sel.date], ["Origine", TX_HUB_CC[sel.from] + " " + sel.from], ["Destination", TX_HUB_CC[sel.to] + " " + sel.to], ["Montant", sel.amt + " M " + (sel.cur || "CHF")], ["Client", sel.client], ["Type", sel.type], ["Corridor", (TX_HUB_CC[sel.from] || "") + "→" + (TX_HUB_CC[sel.to] || "")], ["Scénarios AML évalués", AML_SCENARIOS.filter(x => x.on).length + " actifs — " + (sel.risk === "HIGH" ? "AML-03 déclenché" : "aucun hit")]].map(([k, v]) => (React.createElement("div", { key: k },
React.createElement("div", { style: { fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 } }, k),
React.createElement("div", { style: { fontSize: 12.5, fontWeight: 700, color: T.ink, marginTop: 2 } }, v)))))))));
})(),
txView === "carte" && React.createElement(React.Fragment, null,
React.createElement("div", { style: { background: T.surface, borderRadius: 14, padding: 20, border: `1px solid ${T.line}`, marginBottom: 16 } },
React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 } },
React.createElement(SectionTitle, null, "Flux de transactions internationaux"),
React.createElement(FilterBar, { filters: [{ id: "risque", label: "Risque", value: riskFilter, allValue: "ALL", onChange: setRiskFilter, options: [["ALL", "Tous"], ["HIGH", "Élevé"], ["MEDIUM", "Moyen"], ["LOW", "Faible"]] }], shown: txs.length, total: TX_DATA.length, onReset: () => setRiskFilter("ALL"), style: { marginBottom: 0, flex: "0 0 auto", minWidth: 0 } })),
React.createElement("div", { style: { overflowX: "auto" } },
React.createElement("svg", { width: "100%", viewBox: `0 0 ${W} ${H}`, style: { minWidth: 640, borderRadius: 12, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)" } },
React.createElement("defs", null,
React.createElement("linearGradient", { id: "txOcean", x1: "0", y1: "0", x2: "0", y2: "1" },
React.createElement("stop", { offset: "0%", stopColor: "#DCEBF5" }),
React.createElement("stop", { offset: "55%", stopColor: "#C7E0EF" }),
React.createElement("stop", { offset: "100%", stopColor: "#AFD2E6" })),
React.createElement("linearGradient", { id: "txLand", x1: "0", y1: "0", x2: "0", y2: "1" },
React.createElement("stop", { offset: "0%", stopColor: T.sage }),
React.createElement("stop", { offset: "100%", stopColor: T.olive600 })),
React.createElement("filter", { id: "txGlow", x: "-40%", y: "-40%", width: "180%", height: "180%" },
React.createElement("feGaussianBlur", { stdDeviation: "2.4", result: "b" }),
React.createElement("feMerge", null,
React.createElement("feMergeNode", { in: "b" }),
React.createElement("feMergeNode", { in: "SourceGraphic" })))),
React.createElement("rect", { x: "0", y: "0", width: W, height: H, fill: "url(#txOcean)" }),
[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map(lon => { const [x] = proj(lon, 0); return React.createElement("line", { key: "gx" + lon, x1: x, y1: 0, x2: x, y2: H, stroke: "#ffffff", strokeWidth: "0.5", opacity: "0.28" }); }),
[-60, -30, 0, 30, 60].map(lat => { const [, y] = proj(0, lat); return React.createElement("line", { key: "gy" + lat, x1: 0, y1: y, x2: W, y2: y, stroke: "#ffffff", strokeWidth: "0.5", opacity: "0.28" }); }),
TX_CONTINENTS.map((poly, i) => { const d = "M " + poly.r.map(([lo, la]) => { const [x, y] = proj(lo, la); return `${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" L ") + " Z"; const rc = paysRiskColor(poly.cc); return (React.createElement("g", { key: "c" + i },
React.createElement("path", { d: d, fill: "#8FA98C", opacity: "0.28", transform: "translate(0,2.5)" }),
React.createElement("path", { d: d, fill: rc || "url(#txLand)", fillOpacity: rc ? 0.6 : 1, stroke: rc || "#5F7A4F", strokeWidth: rc ? 0.9 : 0.6 }))); }),
(() => {
const hi = {};
txs.forEach(t => { if (t.risk === "HIGH") {
hi[t.from] = 1;
hi[t.to] = 1;
} });
return (React.createElement("g", null,
txs.map(t => {
const { p } = arcPath(t.from, t.to);
const c = T[TX_RISK_C[t.risk]];
const on = selTx === t.id;
const dim = selTx && !on;
const dur = (t.risk === "HIGH" ? 2.4 : t.risk === "MEDIUM" ? 3.2 : 4.2) + "s";
return (React.createElement("g", { key: t.id, opacity: dim ? 0.12 : 1 },
React.createElement("path", { d: p, fill: "none", stroke: c, strokeWidth: on ? 4 : 2.4, opacity: on ? 1 : 0.72, filter: on ? "url(#txGlow)" : undefined, style: { cursor: "pointer" }, onClick: () => setSelTx(on ? null : t.id) }),
!dim && React.createElement("circle", { r: on ? 3.2 : 2.2, fill: "#ffffff", stroke: c, strokeWidth: "1" },
React.createElement("animateMotion", { dur: dur, repeatCount: "indefinite", path: p }))));
}),
hubsUsed.map(h => {
const [x, y] = proj(...TX_HUBS[h]);
const r = 4 + Math.sqrt(hubVol[h]) * 1.5;
const danger = !!hi[h];
const col = danger ? T.red : T.olive700;
return (React.createElement("g", { key: h },
danger && React.createElement("circle", { cx: x, cy: y, r: r, fill: "none", stroke: T.red, strokeWidth: "1.4" },
React.createElement("animate", { attributeName: "r", values: `${r};${r + 9}`, dur: "1.8s", repeatCount: "indefinite" }),
React.createElement("animate", { attributeName: "opacity", values: "0.6;0", dur: "1.8s", repeatCount: "indefinite" })),
React.createElement("circle", { cx: x, cy: y, r: r, fill: col, opacity: "0.92", filter: "url(#txGlow)" }),
React.createElement("circle", { cx: x, cy: y, r: r * 0.45, fill: "#ffffff", opacity: "0.85" }),
React.createElement("text", { x: x, y: y - r - 4, textAnchor: "middle", fontSize: "9.5", fontWeight: "700", fill: T.ink, stroke: "#ffffff", strokeWidth: "2.4", style: { paintOrder: "stroke" } }, h)));
})));
})())),
React.createElement("div", { style: { display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" } },
[["Risque élevé", "red"], ["Moyen", "amber"], ["Faible", "green"]].map(([l, c]) => (React.createElement("span", { key: l, style: { fontSize: 11, color: T.inkMid, display: "flex", alignItems: "center", gap: 6 } },
React.createElement("span", { style: { width: 18, height: 3, background: T[c], display: "inline-block", borderRadius: 2 } }),
l))),
React.createElement("span", { style: { fontSize: 11, color: T.inkMid, display: "flex", alignItems: "center", gap: 6, marginLeft: 4, paddingLeft: 10, borderLeft: `1px solid ${T.line}` } }, "Pays :"),
[["Élevé", T.red], ["Moyen", T.gold], ["Faible", T.green]].map(([l, c]) => React.createElement("span", { key: "pl" + l, style: { fontSize: 11, color: T.inkMid, display: "flex", alignItems: "center", gap: 5 } }, React.createElement("span", { style: { width: 12, height: 12, background: c, opacity: 0.6, display: "inline-block", borderRadius: 3 } }), l)),
React.createElement("span", { style: { fontSize: 11, color: T.inkSoft } }, "Cliquez un corridor (ou une ligne du tableau) pour l'isoler."))),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 } }, kpiTile("CHF " + totalVol + "M", "Volume total", T.olive700), kpiTile(highCount, "Transactions à risque élevé", T.red), kpiTile(TX_DATA.length, "Transactions", T.blue), kpiTile(countries.length, "Pays / hubs", T.violet)),
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 16 } }, topPanel("⬆ Top 5 grandes transactions", topBig), topPanel("⬇ Top 5 entrantes (vers la Suisse)", topIn), topPanel("⬆ Top 5 sortantes (depuis la Suisse)", topOut)),
React.createElement("div", { style: { background: T.surface, borderRadius: 14, border: `1px solid ${T.line}`, overflow: "hidden", marginBottom: 16 } }, React.createElement("div", { style: { padding: "12px 20px", borderBottom: `1px solid ${T.line}`, fontSize: 14, fontWeight: 700, color: T.ink } }, "Transactions (" + txs.length + ")"), React.createElement("div", { style: { overflowX: "auto" } }, React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 } }, React.createElement("thead", null, React.createElement("tr", { style: { background: T.cream } }, ["Référence", "Date", "Corridor", "Client", "Type", "Montant", "Risque"].map(h => React.createElement("th", { key: h, style: { textAlign: "left", padding: "10px 16px", fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 } }, h)))), React.createElement("tbody", null, txs.map(t => { const on = selTx === t.id; const c = T[TX_RISK_C[t.risk]]; return React.createElement("tr", { key: t.id, onClick: () => setSelTx(on ? null : t.id), style: { borderTop: `1px solid ${T.lineSoft}`, cursor: "pointer", background: on ? T.oliveSoft : "transparent" } }, React.createElement("td", { style: { padding: "10px 16px", fontFamily: "monospace", color: T.inkMid } }, t.id), React.createElement("td", { style: { padding: "10px 16px", color: T.inkMid } }, t.date), React.createElement("td", { style: { padding: "10px 16px", fontWeight: 600, color: T.ink } }, TX_HUB_CC[t.from] + " " + t.from + " → " + TX_HUB_CC[t.to] + " " + t.to), React.createElement("td", { style: { padding: "10px 16px", color: T.ink } }, t.client), React.createElement("td", { style: { padding: "10px 16px" } }, React.createElement("span", { style: { fontSize: 11, padding: "2px 8px", borderRadius: 5, background: T.cream, border: `1px solid ${T.line}`, color: T.inkMid } }, t.type)), React.createElement("td", { style: { padding: "10px 16px", fontWeight: 700, color: T.ink } }, t.cur + " " + t.amt + "M"), React.createElement("td", { style: { padding: "10px 16px" } }, React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: c, background: c + "18", padding: "2px 9px", borderRadius: 6 } }, t.risk))); })))))),
txView === "liste" && React.createElement(React.Fragment, null,
React.createElement("div", { style: { background: T.surface, borderRadius: 14, border: `1px solid ${T.line}`, overflow: "hidden" } },
React.createElement("div", { style: { padding: "12px 20px", borderBottom: `1px solid ${T.line}`, fontSize: 14, fontWeight: 700, color: T.ink } },
"Transactions (",
txs.length,
")"),
React.createElement("div", { style: { overflowX: "auto" } },
React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 } },
React.createElement("thead", null,
React.createElement("tr", { style: { background: T.cream } }, ["Référence", "Date", "Corridor", "Client", "Type", "Montant", "Risque"].map(h => React.createElement("th", { key: h, style: { textAlign: "left", padding: "10px 16px", fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 } }, h)))),
React.createElement("tbody", null, txs.map(t => {
const on = selTx === t.id;
const c = T[TX_RISK_C[t.risk]];
return (React.createElement("tr", { key: t.id, onClick: () => setSelTx(on ? null : t.id), style: { borderTop: `1px solid ${T.lineSoft}`, cursor: "pointer", background: on ? T.oliveSoft : "transparent" } },
React.createElement("td", { style: { padding: "10px 16px", fontFamily: "monospace", color: T.inkMid } }, t.id),
React.createElement("td", { style: { padding: "10px 16px", color: T.inkMid } }, t.date),
React.createElement("td", { style: { padding: "10px 16px", fontWeight: 600, color: T.ink } },
TX_HUB_CC[t.from],
" ",
t.from,
" \u2192 ",
TX_HUB_CC[t.to],
" ",
t.to),
React.createElement("td", { style: { padding: "10px 16px", color: T.ink } }, t.client),
React.createElement("td", { style: { padding: "10px 16px" } },
React.createElement("span", { style: { fontSize: 11, padding: "2px 8px", borderRadius: 5, background: T.cream, border: `1px solid ${T.line}`, color: T.inkMid } }, t.type)),
React.createElement("td", { style: { padding: "10px 16px", fontWeight: 700, color: T.ink } },
t.cur,
" ",
t.amt,
"M"),
React.createElement("td", { style: { padding: "10px 16px" } },
React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: c, background: c + "18", padding: "2px 9px", borderRadius: 6 } }, t.risk))));
}))))))));
}
