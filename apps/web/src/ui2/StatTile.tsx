import React from "react";
import "./tokens.css";

/**
 * UI v2 — composant 2 : StatTile (handoff §Bibliothèque).
 * Carte d'indicateur : libellé 11,5px muted, valeur Mono 28–31px/600, note de contexte,
 * accent sémantique optionnel en border-left 3px. RÈGLE : toute tuile est CLIQUABLE et
 * mène à la liste des dossiers qui la composent — un chiffre sans chemin n'existe pas.
 * Survol : élévation 0 2px 8px (token --shadow-tile-hover).
 */
export function StatTile({ label, valeur, note, accent, onOpen }: {
  label: string; valeur: React.ReactNode; note?: string;
  accent?: "ok" | "warn" | "alert" | "info";
  onOpen: () => void;                    // OBLIGATOIRE : la tuile ouvre sa liste
}) {
  const accentCouleur = accent ? `var(--${accent}-line)` : undefined;
  return (
    <button onClick={onOpen} style={{ display: "block", textAlign: "left", width: "100%",
      background: "var(--bg-surface)", border: "1px solid var(--border)",
      borderLeft: accentCouleur ? `3px solid ${accentCouleur}` : "1px solid var(--border)",
      borderRadius: "var(--r-card)", padding: "16px 18px", cursor: "pointer",
      fontFamily: "inherit", boxShadow: "var(--shadow-card)" }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-tile-hover)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-card)"; }}>
      <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      <span className="mono" style={{ display: "block", fontSize: 29, fontWeight: 600,
        lineHeight: 1, color: "var(--text)", margin: "7px 0 5px" }}>{valeur}</span>
      {note && <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{note}</span>}
    </button>);
}
