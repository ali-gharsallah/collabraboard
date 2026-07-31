import React, { useState } from "react";
import { T } from "./tokens";
import CLIENTS from "../fixtures/CLIENTS.json";
import SCREEN_LABEL from "../fixtures/SCREEN_LABEL.json";
import { KpiCard, StatsToggle } from "./components";
import { fl } from "./contactreports-support";
import { pushParamAudit } from "./param-audit-support";
import { NBA_ACTIONS, nbaSignalFor, nbaEmailDraft } from "./nba-support";

// Source : docs/reference/olive-demo.html 21673-21813 — NextBestActionScreen (Assistant IA — next best action).
// Détection gain/perte/opportunité par client (calcul déterministe amlHash) + email argumenté éditable. Porté verbatim.

export default function NextBestActionScreen({ user }: { user?: any }) {
const [emailFor, setEmailFor] = useState<any>(null);
const scoped = (user && (user.role === "RM" || user.role === "ARM")) ? (CLIENTS as any[]).filter(function (c: any) { return c.rm === user.name; }) : (CLIENTS as any[]);
const withSignal = scoped.map(function (c: any) { return { client: c, signal: nbaSignalFor(c) }; }).filter(function (x: any) { return x.signal; })
.sort(function (a: any, b: any) { return b.signal.magnitude - a.signal.magnitude; });
const gains = withSignal.filter(function (x: any) { return x.signal.type === "GAIN"; }).length;
const losses = withSignal.filter(function (x: any) { return x.signal.type === "LOSS"; }).length;
const opps = withSignal.filter(function (x: any) { return x.signal.type === "OPP"; }).length;
return (React.createElement("div", null,
React.createElement("div", { style: { marginBottom: 16 } },
React.createElement("div", { style: { fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 } }, "Assistant IA"),
React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: T.ink } }, (SCREEN_LABEL as any).nextbestaction),
React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft, marginTop: 2 } }, "Analyse du portefeuille — détection de gain/perte potentiel et suggestion d'action, avec email argumenté prêt à l'envoi. Calcul déterministe sur les données de démonstration — connexion à un flux de marché réel en Phase 2.")),
React.createElement(StatsToggle, null,
React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 16 } },
React.createElement(KpiCard, { label: "Signaux détectés", value: withSignal.length, sub: scoped.length + " client(s) analysé(s)", color: T.olive600, icon: "✦" }),
React.createElement(KpiCard, { label: "Gains potentiels", value: gains, sub: "prise de profit à envisager", color: T.green, icon: "📈" }),
React.createElement(KpiCard, { label: "Pertes potentielles", value: losses, sub: "rebalancement à envisager", color: T.red, icon: "📉" }),
React.createElement(KpiCard, { label: "Opportunités", value: opps, sub: "placements à proposer", color: T.gold, icon: "✨" }))),
React.createElement("div", { style: { background: T.surface, borderRadius: 14, border: "1px solid " + T.line, overflow: "hidden" } },
withSignal.length === 0 && React.createElement("div", { style: { padding: 24, textAlign: "center", color: T.inkSoft, fontSize: 12.5 } }, "Aucun signal détecté pour votre portefeuille actuellement."),
withSignal.map(function (x: any) {
var cfg = NBA_ACTIONS[x.signal.type];
var col = cfg.color === "green" ? T.green : cfg.color === "red" ? T.red : cfg.color === "gold" ? T.gold : T.amber;
var bg = cfg.color === "green" ? T.greenSoft : cfg.color === "red" ? T.redSoft : cfg.color === "gold" ? T.amberSoft : T.amberSoft;
return (React.createElement("div", { key: x.client.id, style: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid " + T.lineSoft } },
React.createElement("span", { style: { fontSize: 20 } }, cfg.icon),
React.createElement("div", { style: { flex: 1, minWidth: 0 } },
React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: T.ink } },
x.client.countryFlag,
" ",
x.client.name),
React.createElement("div", { style: { fontSize: 11, color: T.inkSoft } },
x.client.segment,
" · ",
x.client.aum,
" · RM ",
x.client.rm)),
React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: col, background: bg, padding: "4px 10px", borderRadius: 20 } },
cfg.label,
x.signal.magnitude ? (" · " + x.signal.magnitude + "%") : ""),
React.createElement("button", { onClick: function () { setEmailFor(x); }, style: { padding: "7px 14px", borderRadius: 8, border: "1px solid " + T.olive600, background: T.surface, color: T.olive700, fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" } }, "📧 Préparer l'email")));
})),
emailFor && (function () {
const em = nbaEmailDraft(emailFor.client, emailFor.signal);
return (React.createElement("div", { onClick: function () { setEmailFor(null); }, style: { position: "fixed", inset: 0, background: "rgba(20,26,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 340, padding: 20 } },
React.createElement("div", { onClick: function (e: any) { e.stopPropagation(); }, style: { background: T.surface, borderRadius: 16, width: 560, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto", padding: 22 } },
React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 2 } },
em.cfg.icon,
" Email pré-configuré — ",
emailFor.client.name),
React.createElement("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 14 } }, "Argumentaire généré automatiquement, éditable avant envoi."),
React.createElement("div", { style: { marginBottom: 10 } },
React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 4 } }, fl("nextBestAction", "emailSubject")),
React.createElement("input", { defaultValue: em.subject, style: { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 12.5, boxSizing: "border-box" } })),
React.createElement("div", { style: { marginBottom: 14 } },
React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 4 } }, fl("nextBestAction", "emailBody")),
React.createElement("textarea", { defaultValue: em.body, style: { width: "100%", minHeight: 200, padding: 10, borderRadius: 9, border: "1px solid " + T.line, fontSize: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.6 } })),
React.createElement("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" } },
React.createElement("button", { onClick: function () { setEmailFor(null); }, style: { padding: "9px 16px", borderRadius: 9, border: "1px solid " + T.line, background: T.surface, color: T.inkMid, fontSize: 12.5, cursor: "pointer" } }, "Fermer"),
React.createElement("button", { onClick: function () { pushParamAudit((user && user.name) || "RM", "Email NBA préparé pour " + emailFor.client.name + " (" + emailFor.signal.type + ")"); setEmailFor(null); }, style: { padding: "9px 18px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer" } }, "✓ Marquer comme envoyé")))));
})()));
}
