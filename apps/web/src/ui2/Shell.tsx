import React from "react";
import "./tokens.css";

/**
 * UI v2 — la grille d'application (handoff §« Le shell applicatif »).
 *   Nav 248px fixe │ Header 60/92px │ Stepper 78px (parcours uniquement)
 *                  │ Contenu minmax(0,1fr) │ Colonne latérale 320–400px
 * Le SHELL NE DÉFILE JAMAIS : seuls les panneaux internes défilent (contenu et colonne
 * portent leur propre overflow). minmax(0,1fr) est indispensable pour que les tableaux
 * ne débordent pas. Sous 1280px la colonne latérale se replie (tiroir — étape ultérieure).
 */
export function Ui2Shell({ nav, header, stepper, side, sideWidth = 340, children }: {
  nav: React.ReactNode; header: React.ReactNode; stepper?: React.ReactNode;
  side?: React.ReactNode; sideWidth?: 320 | 340 | 380 | 400 | number;
  children: React.ReactNode;
}) {
  return (
    <div className="ui2" style={{ display: "flex", height: "100vh", overflow: "hidden",
      background: "var(--bg-app)" }}>
      {nav}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {header}
        {stepper && <div style={{ height: "var(--stepper-h)", flexShrink: 0,
          background: "var(--bg-surface)", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", padding: "0 22px", boxSizing: "border-box" }}>{stepper}</div>}
        <div style={{ flex: 1, minHeight: 0, display: "grid",
          gridTemplateColumns: side ? `minmax(0,1fr) ${sideWidth}px` : "minmax(0,1fr)" }}>
          <main style={{ minWidth: 0, overflowY: "auto", padding: 22, boxSizing: "border-box" }}>
            {children}
          </main>
          {side && <aside style={{ overflowY: "auto", background: "var(--bg-subtle)",
            borderLeft: "1px solid var(--border)", padding: 18, boxSizing: "border-box" }}>{side}</aside>}
        </div>
      </div>
    </div>);
}
