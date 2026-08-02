import React from "react";
import { T } from "./tokens";
import { Badge, SectionTitle } from "./components";

// MOD-71 Signataires — porté verbatim depuis docs/reference/olive-demo.html 17915-17937.
// Données de démonstration issues de la maquette (invent NOTHING).
const sigs = [
  { name: "Zhang Wei", role: "Titulaire", mode: "Seule", limit: "Illimité", status: "Actif" },
  { name: "Li Mei (épouse)", role: "Mandataire", mode: "Conjointe", limit: "CHF 500k", status: "Actif" },
  { name: "Cabinet Tan & Co", role: "Fondé de pouvoir", mode: "Conjointe", limit: "CHF 1M", status: "Actif" },
  { name: "David Chen", role: "Procuration", mode: "Seule", limit: "CHF 100k", status: "Expirée" },
];

export default function SignatoriesScreen() {
  return React.createElement("div", null,
    React.createElement("div", { style: { background: T.surface, borderRadius: 14, border: `1px solid ${T.line}`, overflow: "hidden" } },
      React.createElement("div", { style: { padding: "16px 20px", borderBottom: `1px solid ${T.line}` } },
        React.createElement(SectionTitle, null, "Signataires — Zhang Wei Family Office")),
      React.createElement("table", { style: { width: "100%", borderCollapse: "collapse" } },
        React.createElement("thead", null,
          React.createElement("tr", { style: { background: T.lineSoft } }, ["Personne", "Rôle", "Mode de signature", "Plafond", "Statut"].map((h) => React.createElement("th", { key: h, style: { padding: "10px 20px", textAlign: "left", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 } }, h)))),
        React.createElement("tbody", null, sigs.map((s, i) => React.createElement("tr", { key: i, style: { borderBottom: `1px solid ${T.lineSoft}` } },
          React.createElement("td", { style: { padding: "14px 20px", fontSize: 13, fontWeight: 600, color: T.ink } }, s.name),
          React.createElement("td", { style: { padding: "14px 20px", fontSize: 12, color: T.inkMid } }, s.role),
          React.createElement("td", { style: { padding: "14px 20px" } },
            React.createElement(Badge, { text: s.mode, color: s.mode === "Conjointe" ? T.blue : T.olive700, bg: s.mode === "Conjointe" ? T.blueSoft : T.oliveSoft })),
          React.createElement("td", { style: { padding: "14px 20px", fontSize: 12, fontWeight: 600, color: T.inkMid } }, s.limit),
          React.createElement("td", { style: { padding: "14px 20px" } }, s.status === "Actif" ? React.createElement(Badge, { text: "Actif", color: T.green, bg: T.greenSoft }) : React.createElement(Badge, { text: "Expirée", color: T.red, bg: T.redSoft })))))));
}
