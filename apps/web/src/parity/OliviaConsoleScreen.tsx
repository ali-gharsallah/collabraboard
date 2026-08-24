import React, { useState } from "react";
import { T } from "./tokens";
import { OLIVIA_AGENTS, OLIVIA_AGENT_SUITE, OLIVIA_SUITES, OLIVIA_AGENT_GUIDE } from "./olivia-support";

// Source : docs/reference/olive-demo.html 32205-… — OliviaConsoleScreen (Olivia AI Core, swarm
// de 12 agents en 6 Officer Suites). Le SHELL (bannière IA-locale, en-tête, guide, grille des
// suites) est porté verbatim. La console interactive (olivaSwarmRun : classification → agents →
// blackboard/handoffs → executive summary/trace, + Islamic Finance Agent shariahScreen, + chartes
// système) relève du MOTEUR SWARM GOUVERNÉ (backend/OLIVE_PROOFS) : consignée, jamais recréée.

export default function OliviaConsoleScreen() {
  const [showGuide, setShowGuide] = useState(false);
  const card: any = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  return React.createElement("div", null,
    // ── Bannière « IA 100% locale » ──
    React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderRadius: 12, background: T.oliveSoft, border: "1px solid " + T.olive600 + "33", marginBottom: 14 } },
      React.createElement("span", { style: { fontSize: 16 } }, "🔒"),
      React.createElement("span", { style: { fontSize: 11.5, color: T.inkMid, flex: 1 } },
        React.createElement("strong", { style: { color: T.ink } }, "IA 100% locale."),
        " Tous les agents tournent sur l'infrastructure de la banque — aucun appel internet, aucune donnée ne quitte l'établissement."),
      React.createElement("button", { onClick: function () { setShowGuide(!showGuide); }, style: { padding: "7px 14px", borderRadius: 9, border: "1px solid " + T.olive600, background: showGuide ? T.olive600 : "transparent", color: showGuide ? "#fff" : T.olive700, fontSize: 10.5, fontWeight: 800, cursor: "pointer" } }, showGuide ? "Masquer le guide" : "📖 Guide des agents")),
    showGuide && React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 } }, OLIVIA_AGENT_GUIDE.map(function (g: any) {
      return React.createElement("div", { key: g.name, style: { background: T.surface, border: "1px solid " + T.line, borderRadius: 12, padding: 14 } },
        React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 4 } }, g.icon, " ", g.name),
        React.createElement("div", { style: { fontSize: 10.5, color: T.inkMid, marginBottom: 6 } }, g.what),
        React.createElement("div", { style: { fontSize: 10, color: T.olive700, fontStyle: "italic" } }, g.how));
    })),
    // ── En-tête Olivia AI Core ──
    React.createElement("div", { style: { marginBottom: 16, display: "flex", alignItems: "center", gap: 14 } },
      React.createElement("div", { style: { width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg," + T.olive700 + "," + T.leaf + ")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 } }, "🫒"),
      React.createElement("div", null,
        React.createElement("div", { style: { fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 } }, "Olivia AI Core"),
        React.createElement("div", { style: { fontSize: 22, fontWeight: 700, color: T.ink } }, "Orchestrateur IA — Private Banking"),
        React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft, marginTop: 2 } },
          "« Olivia prepares, explains and protects. You decide. We comply. » Architecture ",
          React.createElement("strong", null, "swarm"),
          " : 12 agents coopératifs organisés en 6 Officer Suites — blackboard partagé, handoffs explicites, lignée traçable. Moteurs déterministes en production, pas d'appel LLM externe."),
        React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 8 } }, [["🧠", "SMART"], ["🛡", "RELIABLE"], ["✓", "COMPLIANT"], ["🔒", "CONFIDENTIAL"]].map(function (c) {
          return React.createElement("span", { key: c[1], style: { fontSize: 9, fontWeight: 800, letterSpacing: 1, color: T.olive700, background: T.oliveSoft, padding: "4px 11px", borderRadius: 14 } }, c[0], " ", c[1]);
        })))),
    // ── Grille des 6 Officer Suites × 12 agents ──
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 } }, OLIVIA_SUITES.map(function (suite) {
      var members = OLIVIA_AGENTS.filter(function (a: any) { return OLIVIA_AGENT_SUITE[a.id] === suite; });
      return React.createElement("div", { key: suite, style: { background: T.surface, border: "1px solid " + T.line, borderRadius: 12, padding: "12px 14px" } },
        React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: T.olive700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 9, paddingBottom: 7, borderBottom: "1px solid " + T.lineSoft } },
          suite, " ",
          React.createElement("span", { style: { color: T.inkSoft, fontWeight: 600 } }, "· ", members.length, " agent", members.length > 1 ? "s" : "")),
        members.map(function (a: any) {
          return React.createElement("div", { key: a.id, style: { marginBottom: 9 } },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 2 } },
              React.createElement("span", { style: { fontSize: 13 } }, a.icon),
              React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: T.ink } }, a.name)),
            React.createElement("div", { style: { fontSize: 9, color: T.inkSoft, lineHeight: 1.4 } }, a.mission),
            React.createElement("div", { style: { fontSize: 8, color: T.olive700, fontStyle: "italic", marginTop: 1 } }, "⚙ ", a.poweredBy));
        }));
    })),
    // ── Console interactive : moteur swarm gouverné → consignée ──
    React.createElement("div", { style: Object.assign({}, card, { borderStyle: "dashed" }) },
      React.createElement("div", { style: { fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 8 } }, "Poser une question à Olivia"),
      React.createElement("div", { style: { fontSize: 11.5, color: T.inkMid, lineHeight: 1.65 } },
        "La console de dialogue (classification de la question → sélection d'agents → exécution swarm sur blackboard partagé avec handoffs explicites → Executive Summary, trace d'exécution, Risk Indicators, Recommendations et Required Human Actions), ainsi que l'Islamic Finance Agent (dépistage Sharia) et les chartes système par agent, sont produits par le ",
        React.createElement("strong", null, "moteur swarm gouverné"),
        " (côté backend, sous OLIVE_PROOFS). Cet écran de parité présente fidèlement le catalogue d'agents et l'architecture ; le raisonnement déterministe et sa piste d'audit ne sont pas recréés hors moteur."));
}
