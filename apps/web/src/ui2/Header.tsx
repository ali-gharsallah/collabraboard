import React from "react";
import "./tokens.css";

/**
 * UI v2 — les DEUX variantes de header, pas une de plus (handoff §« Header »).
 * Liste (60px) : titre 16px/600 · sous-titre contextuel en Mono 11,5px · filtres · action.
 * Dossier (92px) : avatar 44px (carré 11px pour une entité, rond pour une personne) ·
 * nom 17px/600 + puces · ligne d'identifiants en Mono 12px · 2–3 actions.
 */

export function Ui2HeaderListe({ titre, sousTitre, filtres, action, t }: {
  titre: string; sousTitre?: string; filtres?: React.ReactNode; action?: React.ReactNode;
  t?: (cle: string) => string;
}) {
  const tr = t ?? ((s: string) => s);
  return (
    <header style={{ height: "var(--header-liste-h)", flexShrink: 0, display: "flex",
      alignItems: "center", gap: 14, padding: "0 22px", background: "var(--bg-surface)",
      borderBottom: "1px solid var(--border)", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.2, margin: 0,
        color: "var(--text)", whiteSpace: "nowrap" }}>{tr(titre)}</h1>
      {sousTitre && <span className="mono" style={{ fontSize: 11.5, color: "var(--text-muted)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sousTitre}</span>}
      <span style={{ flex: 1 }} />
      {filtres}
      {action}
    </header>);
}

export function Ui2HeaderDossier({ nom, identifiants, initiales, personne, puces, actions, t }: {
  nom: string; identifiants: string; initiales: string;
  personne?: boolean;                  // rond pour une personne, carré (rayon 11) pour une entité
  puces?: React.ReactNode; actions?: React.ReactNode;
  t?: (cle: string) => string;
}) {
  const tr = t ?? ((s: string) => s);
  void tr;
  return (
    <header style={{ height: "var(--header-dossier-h)", flexShrink: 0, display: "flex",
      alignItems: "center", gap: 14, padding: "0 22px", background: "var(--bg-surface)",
      borderBottom: "1px solid var(--border)", boxSizing: "border-box" }}>
      <span aria-hidden style={{ width: 44, height: 44, flexShrink: 0,
        borderRadius: personne ? "50%" : 11, background: "var(--brand-surface)",
        border: "1px solid var(--brand-border)", color: "var(--brand)", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600 }}>{initiales}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: "var(--text)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nom}</span>
          {puces}
        </span>
        <span className="mono" style={{ display: "block", fontSize: 12, color: "var(--text-muted)",
          marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{identifiants}</span>
      </span>
      <span style={{ display: "flex", gap: 8, flexShrink: 0 }}>{actions}</span>
    </header>);
}

/** Bouton primaire / secondaire du shell — les seuls styles de bouton de l'étape 1. */
export function Ui2Bouton({ children, primaire, onClick }: {
  children: React.ReactNode; primaire?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} style={{ padding: "7px 13px", borderRadius: "var(--r-input)",
      cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
      border: primaire ? "1px solid var(--brand)" : "1px solid var(--border-input)",
      background: primaire ? "var(--brand)" : "var(--bg-surface)",
      color: primaire ? "#fff" : "var(--text-secondary)", whiteSpace: "nowrap" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = primaire ? "var(--brand-hover)" : "var(--bg-subtle)";
        if (!primaire) e.currentTarget.style.borderColor = "var(--brand-border)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = primaire ? "var(--brand)" : "var(--bg-surface)";
        if (!primaire) e.currentTarget.style.borderColor = "var(--border-input)"; }}>
      {children}
    </button>);
}
