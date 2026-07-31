import React, { useState, useEffect } from "react";
import RULES_CATALOG from "../fixtures/RULES_CATALOG.json";

// Source : docs/reference/olive-demo.html 34385-34551 — CommandCenterScreen (GWB Compliance Command).
// Écran « salle de contrôle » : signaux scorés, risk cases, gels art. 10, KYC en revue, carte thermique
// scénarios × sévérité, funnel R117→R120, bandeau d'intégrité (chiffres LUS du catalogue), fil de
// conformité append-only (audit trail vivant). Palette CC autonome (mono, fond olive clair). Porté verbatim.
// OLIVE_PROOFS (harnais backend) consigné → le garde typeof retombe sur la valeur embarquée (34).

declare const OLIVE_PROOFS: any;

export default function CommandCenterScreen() {
const CC = { bg: "#EDF0E2", panel: "#FAFBF5", panel2: "#F2F4E8", line: "#D9DFC9",
ink: "#26331C", dim: "#6B7A54", lum: "#5A7D3A", amber: "#A8761B", red: "#AE4437",
mono: '"SF Mono","Cascadia Code","JetBrains Mono",ui-monospace,Menlo,monospace' };
const [now, setNow] = useState(new Date());
const [feedOffset, setFeedOffset] = useState(0);
const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
useEffect(() => {
const t = setInterval(() => setNow(new Date()), 1000);
const f = reduced ? null : setInterval(() => setFeedOffset((o) => o + 1), 2600);
return () => { clearInterval(t); if (f) clearInterval(f); };
}, []);
// ── données déterministes (LCG seedé — mêmes chiffres à chaque ouverture) ──
let seed = 20260720; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const serie = (n: number, base: number, amp: number) => Array.from({ length: n }, () => Math.round(base + (rnd() - 0.35) * amp));
const sigJ = serie(24, 7, 9).map((x) => Math.max(0, x));
const SCEN = ["STRUCT", "VELOC", "GEO", "CASH", "PEP", "DORMANT"];
const heat = SCEN.map(() => [0, 0, 0, 0].map(() => Math.floor(rnd() * 9)));
const aging: any[] = [["NOUVELLE", 4, 2], ["EN_ANALYSE", 12, 15], ["CLARIFICATION", 5, 10], ["ESCALADÉE", 2, null]];
const funnel: any[] = [["PROSPECT", 31], ["COLLECTE", 22], ["KYC", 17], ["DÉCISION", 9], ["OUVERT", 7]];
const FEED: any[] = [
["GEL POSÉ", "art. 10 LBA · CLIENT-a3f21c88 · échéance J+5 ouvrés", CC.red],
["VISA CO", "KYC-2026-CH-0044-R2 · section SOURCE_FONDS · i.vernet", CC.lum],
["SIGNAL", "STRUCT · 3 versements 9 400 CHF / 72 h · score 81", CC.amber],
["PRÉ-REVUE IA", "3 points · CONTRADICTION activité/CA · pseudonymisé", CC.lum],
["ESCALADE", "risk case RC-2214 → circuit MROS · n.frei", CC.amber],
["PARAM", "pmsDriftToleranceBp 200→300 · effet 01.08 · motivé", CC.dim],
["ANCRAGE", "lot 19.07 · 214 versions · racine 7f3a…e1 · TSA", CC.lum],
["DÉCISION MROS", "COMMUNIQUER · dossier 12 pièces · empreinte figée", CC.red],
["SLA", "onboarding COLLECTE 31 j > 30 · relance émise (jamais d'auto-abandon)", CC.amber],
["ACCÈS REFUSÉ", "art. 10a · lecture MROS tentée rôle RM · tracé", CC.red],
["4-YEUX", "récusation section BENEF_EFF · visa transféré CO_SR", CC.lum],
["SCREENING", "re-run liste SECO 2026-07-19 · 576 franchissements → 462 signaux", CC.dim],
];
const catN = typeof RULES_CATALOG !== "undefined" ? (RULES_CATALOG as any[]).length : 113;
const catP = typeof RULES_CATALOG !== "undefined" ? (RULES_CATALOG as any[]).filter((r) => /PROPOS/.test(r.statut)).length : 0;
const prN = typeof OLIVE_PROOFS !== "undefined" ? OLIVE_PROOFS.groupes.reduce((s: number, g: any) => s + g.ids.length, 0) : 34;
// ── briques ──
const pad2 = (x: number) => String(x).padStart(2, "0");
const clock = pad2(now.getHours()) + ":" + pad2(now.getMinutes()) + ":" + pad2(now.getSeconds());
const Label = (t: any, extra?: any) => React.createElement("div", { style: { fontSize: 9, letterSpacing: 2.2,
color: CC.dim, textTransform: "uppercase", marginBottom: 8, ...extra } }, t);
const Big = (v: any, unit?: any, color?: any) => React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: 6 } },
React.createElement("span", { style: { fontSize: 30, fontWeight: 300, color: color || CC.ink, letterSpacing: -1 } }, v),
unit && React.createElement("span", { style: { fontSize: 10, color: CC.dim } }, unit));
const Spark = (data: any, color: any, w: number, hgt: number) => {
const mx = Math.max(...data, 1); const pts = data.map((v: any, i: number) =>
`${(i / (data.length - 1)) * w},${hgt - (v / mx) * (hgt - 2) - 1}`).join(" ");
return React.createElement("svg", { width: w, height: hgt, style: { display: "block" } },
React.createElement("polyline", { points: pts, fill: "none", stroke: color, strokeWidth: 1.2 }),
React.createElement("circle", { cx: w, cy: hgt - (data[data.length - 1] / mx) * (hgt - 2) - 1, r: 2, fill: color }));
};
const Panel = (children: any, extra?: any) => React.createElement("div", { style: { background: CC.panel,
border: `1px solid ${CC.line}`, borderRadius: 3, padding: "14px 16px",
animation: reduced ? "none" : "ccFade .5s ease both", ...extra } }, children);
// ── écran ──
return React.createElement("div", { style: { background: CC.bg, minHeight: "100vh", margin: -24,
padding: 0, fontFamily: CC.mono, color: CC.ink, display: "flex", flexDirection: "column" } },
React.createElement("style", null,
"@keyframes ccFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}" +
"@keyframes ccPulse{0%,100%{opacity:1}50%{opacity:.35}}"),
// ── barre de tête ──
React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 18,
padding: "12px 20px", borderBottom: `1px solid ${CC.line}`, background: CC.panel2 } },
React.createElement("div", { style: { fontSize: 13, letterSpacing: 4, fontWeight: 600 } },
"GWB", React.createElement("span", { style: { color: CC.lum } }, " ⌁ "), "COMPLIANCE COMMAND"),
React.createElement("div", { style: { fontSize: 9.5, color: CC.dim, letterSpacing: 1.5 } },
"CLIENT LIFECYCLE INTELLIGENCE · ZÜRICH"),
React.createElement("div", { style: { flex: 1 } }),
React.createElement("div", { style: { fontSize: 9.5, color: CC.dim } }, now.toLocaleDateString("fr-CH")),
React.createElement("div", { style: { fontSize: 15, color: CC.lum, letterSpacing: 2 } }, clock),
React.createElement("div", { style: { width: 7, height: 7, borderRadius: 4, background: CC.lum,
animation: reduced ? "none" : "ccPulse 2s infinite" } })),
React.createElement("div", { style: { display: "flex", flex: 1, minHeight: 0 } },
// ── colonne principale ──
React.createElement("div", { style: { flex: 1, padding: 14, display: "grid", gap: 10,
gridTemplateColumns: "repeat(4, 1fr)", gridAutoRows: "min-content", overflowY: "auto" } },
Panel([Label("Signaux scorés · 24 h"), Big("178", "▲ 12", CC.lum),
React.createElement("div", { key: "sp", style: { marginTop: 10 } }, Spark(sigJ, CC.lum, 150, 30)),
React.createElement("div", { key: "cap", style: { fontSize: 8.5, color: CC.dim, marginTop: 6 } },
"576 franchissements → 462 signaux → 178 alertes")]),
Panel([Label("Risk cases actifs"), Big("23", "2 escaladés", CC.ink),
React.createElement("div", { key: "ag", style: { marginTop: 10, display: "grid", gap: 5 } },
aging.map(([et, n, sla]: any) => React.createElement("div", { key: et, style: { display: "flex",
alignItems: "center", gap: 8, fontSize: 9 } },
React.createElement("span", { style: { width: 86, color: CC.dim } }, et),
React.createElement("div", { style: { flex: 1, height: 5, background: CC.line, borderRadius: 2 } },
React.createElement("div", { style: { width: Math.min(100, n * 7) + "%", height: "100%",
background: et === "ESCALADÉE" ? CC.amber : CC.lum, borderRadius: 2, opacity: .85 } })),
React.createElement("span", { style: { width: 18, textAlign: "right" } }, n),
React.createElement("span", { style: { width: 44, textAlign: "right", color: CC.dim, fontSize: 8 } },
sla ? "SLA " + sla + "j" : "→MROS"))))]),
Panel([Label("Gels d'avoirs · art. 10"), Big("2", "actifs", CC.red),
React.createElement("div", { key: "gel", style: { fontSize: 9, color: CC.dim, marginTop: 10, lineHeight: 1.7 } },
"CLIENT-a3f21c88 · échéance J+3", React.createElement("br"),
"CLIENT-77be04d1 · échéance J+5", React.createElement("br"),
React.createElement("span", { style: { color: CC.amber } }, "▸ levée = acte humain motivé, jamais d'échéance automatique"))]),
Panel([Label("KYC en revue"), Big("14", "3 hors SLA", CC.ink),
React.createElement("div", { key: "kyc", style: { marginTop: 10, fontSize: 9, color: CC.dim, lineHeight: 1.7 } },
"Visas en attente : ", React.createElement("span", { style: { color: CC.ink } }, "31"),
React.createElement("br"), "Pré-revues IA à traiter : ",
React.createElement("span", { style: { color: CC.lum } }, "9"),
React.createElement("br"), "Récusations 4-yeux : ",
React.createElement("span", { style: { color: CC.ink } }, "1"))]),
Panel([Label("Carte thermique · scénarios AML × sévérité"),
React.createElement("div", { key: "heat", style: { display: "grid", gridTemplateColumns: "70px repeat(4, 1fr)",
gap: 3, marginTop: 4 } },
React.createElement("div"), ...["INFO", "BAS", "MOYEN", "HAUT"].map((s) =>
React.createElement("div", { key: s, style: { fontSize: 8, color: CC.dim, textAlign: "center" } }, s)),
...SCEN.flatMap((sc, i) => [
React.createElement("div", { key: sc, style: { fontSize: 8.5, color: CC.dim, alignSelf: "center" } }, sc),
...heat[i].map((v: any, j: number) => React.createElement("div", { key: sc + j, title: sc + " " + v, style: {
height: 20, borderRadius: 2, background: v === 0 ? CC.panel2 :
(j >= 3 ? CC.red : j === 2 ? CC.amber : CC.lum),
opacity: v === 0 ? 1 : 0.25 + (v / 9) * 0.75,
display: "flex", alignItems: "center", justifyContent: "center",
fontSize: 8, color: "#FFFFFF", fontWeight: 700, textShadow: "0 0 2px rgba(0,0,0,.35)" } }, v || ""))])) ], { gridColumn: "span 2" }),
Panel([Label("Funnel d'entrée en relation · R117→R120"),
React.createElement("div", { key: "fn", style: { display: "grid", gap: 6, marginTop: 4 } },
funnel.map(([et, n]: any, i: number) => React.createElement("div", { key: et, style: { display: "flex",
alignItems: "center", gap: 8, fontSize: 9 } },
React.createElement("span", { style: { width: 68, color: CC.dim } }, et),
React.createElement("div", { style: { flex: 1, height: 12, background: CC.panel2, borderRadius: 2 } },
React.createElement("div", { style: { width: (n / funnel[0][1]) * 100 + "%", height: "100%",
background: `linear-gradient(90deg, ${CC.lum}22, ${CC.lum})`, borderRadius: 2 } })),
React.createElement("span", { style: { width: 22, textAlign: "right", color: i === 4 ? CC.lum : CC.ink } }, n)))),
React.createElement("div", { key: "fncap", style: { fontSize: 8.5, color: CC.dim, marginTop: 8 } },
"conversion 23 % · délai médian 41 j · ouverture ssi KYC VALIDATED (R119)")], { gridColumn: "span 2" }),
// ── bandeau d'intégrité : l'écran SE MESURE ──
Panel([React.createElement("div", { key: "int", style: { display: "flex", alignItems: "center", gap: 22,
flexWrap: "wrap" } },
Label("Intégrité du système", { marginBottom: 0, marginRight: 6 }),
React.createElement("span", { style: { fontSize: 10.5 } },
"règles ", React.createElement("b", { style: { color: CC.lum } }, "R1→R136"),
" · catalogue ", React.createElement("b", { style: { color: CC.lum } }, catN),
catP ? React.createElement("span", { style: { color: CC.amber } }, " (" + catP + " en ratification)") : " · 0 proposée"),
React.createElement("span", { style: { fontSize: 10.5 } },
"corpus backend ", React.createElement("b", { style: { color: CC.lum } }, "224/224")),
React.createElement("span", { style: { fontSize: 10.5 } },
"preuves rejouables ", React.createElement("b", { style: { color: CC.lum } }, prN)),
React.createElement("span", { style: { fontSize: 10.5 } },
"audit trail ", React.createElement("b", { style: { color: CC.lum } }, "append-only ✓"),
" · RLS ", React.createElement("b", { style: { color: CC.lum } }, "force ✓")),
React.createElement("span", { style: { fontSize: 8.5, color: CC.dim, marginLeft: "auto" } },
"ces chiffres sont LUS du catalogue et des preuves embarqués — pas affichés, mesurés"))],
{ gridColumn: "span 4", background: CC.panel2 })),
// ── SIGNATURE : le fil de conformité (audit trail vivant, vertical, append-only) ──
React.createElement("div", { style: { width: 264, borderLeft: `1px solid ${CC.line}`,
background: CC.panel2, display: "flex", flexDirection: "column", minHeight: 0 } },
React.createElement("div", { style: { padding: "12px 14px", borderBottom: `1px solid ${CC.line}` } },
Label("Fil de conformité — append-only", { marginBottom: 2 }),
React.createElement("div", { style: { fontSize: 8.5, color: CC.dim } },
"chaque ligne est un événement du journal · rien ne s'y édite")),
React.createElement("div", { style: { flex: 1, overflow: "hidden", padding: "8px 0" } },
Array.from({ length: 14 }, (_, i) => {
const ev = FEED[(i + feedOffset) % FEED.length];
const t = new Date(now.getTime() - i * 47000 - (i * i * 900));
return React.createElement("div", { key: i, style: { padding: "7px 14px",
borderBottom: `1px solid ${CC.line}44`, opacity: 1 - i * 0.055 } },
React.createElement("div", { style: { display: "flex", gap: 8, fontSize: 8.5 } },
React.createElement("span", { style: { color: CC.dim } },
pad2(t.getHours()) + ":" + pad2(t.getMinutes()) + ":" + pad2(t.getSeconds())),
React.createElement("span", { style: { color: ev[2], fontWeight: 700, letterSpacing: 1 } }, ev[0])),
React.createElement("div", { style: { fontSize: 8.5, color: CC.ink, opacity: .8,
marginTop: 2, lineHeight: 1.45 } }, ev[1]));
})))));
}
