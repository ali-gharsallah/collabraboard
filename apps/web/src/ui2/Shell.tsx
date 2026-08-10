import React, { useState } from "react";
import { Menu, X } from "lucide-react";
import "./tokens.css";

/**
 * UI v2 — la grille d'application (handoff §« Le shell applicatif »).
 *   Nav 248px fixe │ Header 60/92px │ Stepper 78px (parcours uniquement)
 *                  │ Contenu minmax(0,1fr) │ Colonne latérale 320–400px
 * Le SHELL NE DÉFILE JAMAIS : seuls les panneaux internes défilent (contenu et colonne
 * portent leur propre overflow). minmax(0,1fr) est indispensable pour que les tableaux
 * ne débordent pas.
 * RESPONSIVE (≤ 900px, media queries dans tokens.css) : la nav devient un TIROIR ouvert par
 * le bouton ☰ de la barre haute (voile de fermeture), les colonnes latérales s'empilent sous
 * le contenu, la page redevient défilante et les tableaux à grille défilent horizontalement
 * dans leur carte — le corps de page, lui, ne défile jamais latéralement.
 */
export function Ui2Shell({ nav, header, stepper, side, sideWidth = 340, sideGauche,
  sideGaucheWidth = 300, children }: {
  nav: React.ReactNode; header: React.ReactNode; stepper?: React.ReactNode;
  side?: React.ReactNode; sideWidth?: 320 | 340 | 380 | 400 | number;
  sideGauche?: React.ReactNode; sideGaucheWidth?: 262 | 300 | number;   // écrans 02 (262px) et 06 (300px)
  children: React.ReactNode;
}) {
  const [menuOuvert, setMenuOuvert] = useState(false);
  return (
    <div className="ui2" data-menu={menuOuvert ? "ouvert" : undefined}
      style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-app)" }}>
      <div className="ui2-nav-conteneur">{nav}</div>
      {menuOuvert && <button className="ui2-voile" aria-label="Fermer le menu"
        onClick={() => setMenuOuvert(false)} />}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div className="ui2-topbar" role="banner">
          <button aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMenuOuvert((v) => !v)}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, border: "none", borderRadius: 8, cursor: "pointer",
              background: "transparent", color: "var(--nav-text-strong)" }}>
            {menuOuvert ? <X size={19} strokeWidth={2} /> : <Menu size={19} strokeWidth={2} />}</button>
          <span aria-hidden style={{ width: 24, height: 24, borderRadius: 7,
            background: "var(--brand)", display: "inline-flex", alignItems: "center",
            justifyContent: "center" }}>
            <span style={{ width: 7, height: 10, borderRadius: "50%", background: "var(--gold)" }} /></span>
          <span className="mono" style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1,
            color: "var(--nav-text-strong)" }}>O-LIVE</span>
        </div>
        <div className="ui2-entete">{header}</div>
        {stepper && <div className="ui2-stepper" style={{ height: "var(--stepper-h)", flexShrink: 0,
          background: "var(--bg-surface)", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", padding: "0 22px", boxSizing: "border-box" }}>{stepper}</div>}
        <div className="ui2-corps" style={{ flex: 1, minHeight: 0, display: "grid",
          gridTemplateColumns: `${sideGauche ? `${sideGaucheWidth}px ` : ""}minmax(0,1fr)${side ? ` ${sideWidth}px` : ""}` }}>
          {sideGauche && <aside className="ui2-cote-gauche" style={{ overflowY: "auto",
            borderRight: "1px solid var(--border)", padding: 18, boxSizing: "border-box" }}>{sideGauche}</aside>}
          <main style={{ minWidth: 0, overflowY: "auto", padding: 22, boxSizing: "border-box" }}>
            {children}
          </main>
          {side && <aside className="ui2-cote" style={{ overflowY: "auto", background: "var(--bg-subtle)",
            borderLeft: "1px solid var(--border)", padding: 18, boxSizing: "border-box" }}>{side}</aside>}
        </div>
      </div>
    </div>);
}
