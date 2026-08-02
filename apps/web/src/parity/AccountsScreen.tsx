import React from "react";
import { T } from "./tokens";
import { Badge, SectionTitle } from "./components";

// Écran « Comptes » — porté verbatim depuis docs/reference/olive-demo.html 17890-17914.
// Données de démonstration issues de la maquette (invent NOTHING).
const accts = [
  { num: "CH93 **** 5295 7", client: "Zhang Wei FO", type: "Courant", ccy: "CHF", bal: "12.4M", status: "Actif" },
  { num: "CH52 **** 8841 2", client: "Zhang Wei FO", type: "Titres", ccy: "USD", bal: "31.8M", status: "Actif" },
  { num: "CH18 **** 2207 9", client: "Roberto Galliano", type: "Courant", ccy: "EUR", bal: "1.8M", status: "Actif" },
  { num: "CH71 **** 4419 3", client: "Meridian Trust", type: "Courant", ccy: "CHF", bal: "0", status: "En attente KYC" },
];

export default function AccountsScreen() {
  return React.createElement("div", null,
    React.createElement("div", { style: { background: T.surface, borderRadius: 14, border: `1px solid ${T.line}`, overflow: "hidden" } },
      React.createElement("div", { style: { padding: "16px 20px", borderBottom: `1px solid ${T.line}` } },
        React.createElement(SectionTitle, null, "Comptes")),
      React.createElement("table", { style: { width: "100%", borderCollapse: "collapse" } },
        React.createElement("thead", null,
          React.createElement("tr", { style: { background: T.lineSoft } }, ["IBAN", "Titulaire", "Type", "Devise", "Solde", "Statut"].map((h) => React.createElement("th", { key: h, style: { padding: "10px 20px", textAlign: "left", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 } }, h)))),
        React.createElement("tbody", null, accts.map((a, i) => React.createElement("tr", { key: i, style: { borderBottom: `1px solid ${T.lineSoft}` } },
          React.createElement("td", { style: { padding: "14px 20px", fontFamily: "monospace", fontSize: 12, color: T.inkMid } }, a.num),
          React.createElement("td", { style: { padding: "14px 20px", fontSize: 13, fontWeight: 600, color: T.ink } }, a.client),
          React.createElement("td", { style: { padding: "14px 20px", fontSize: 12, color: T.inkMid } }, a.type),
          React.createElement("td", { style: { padding: "14px 20px", fontSize: 12, fontWeight: 600, color: T.inkMid } }, a.ccy),
          React.createElement("td", { style: { padding: "14px 20px", fontSize: 13, fontWeight: 700, color: T.ink } },
            a.bal,
            " ",
            a.bal !== "0" && React.createElement("span", { style: { fontSize: 10, color: T.inkSoft } }, a.ccy)),
          React.createElement("td", { style: { padding: "14px 20px" } }, a.status === "Actif" ? React.createElement(Badge, { text: "Actif", color: T.green, bg: T.greenSoft }) : React.createElement(Badge, { text: a.status, color: T.amber, bg: T.amberSoft })))))));
}
