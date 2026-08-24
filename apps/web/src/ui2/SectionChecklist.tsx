import React from "react";
import "./tokens.css";
import { Check, CircleDot, Circle } from "lucide-react";

/**
 * UI v2 — composant 6 : SectionChecklist (handoff §Bibliothèque).
 * Colonne des sections d'un dossier (262–300px) : jauge de progression 5px en tête, puis une
 * ligne par section — pastille d'état (✓ vert · ◐ ambre · ○ gris), libellé, compteur d'éléments
 * manquants poussé à droite. La section COURANTE est une carte blanche à bordure brand.
 */
export type SectionEtat = { code: string; label: string; etat: "visee" | "encours" | "vide";
  manquants?: number };

export function SectionChecklist({ sections, courante, onOuvrir, pied, t }: {
  sections: SectionEtat[]; courante: string; onOuvrir: (code: string) => void;
  pied?: React.ReactNode; t?: (cle: string) => string;
}) {
  const tr = t ?? ((s: string) => s);
  const faites = sections.filter((s) => s.etat === "visee").length;
  const pastille = (s: SectionEtat) => s.etat === "visee"
    ? <Check size={13} strokeWidth={2.5} style={{ color: "var(--ok-line)" }} />
    : s.etat === "encours"
      ? <CircleDot size={13} strokeWidth={2} style={{ color: "var(--warn-line)" }} />
      : <Circle size={13} strokeWidth={2} style={{ color: "var(--border-input)" }} />;
  return (
    <div style={{ width: 262, flexShrink: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 7 }}>
        <span className="microlabel">{tr("Sections")}</span>
        <span className="mono" style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600 }}>
          {faites} / {sections.length}</span>
      </div>
      <div aria-hidden style={{ height: 5, borderRadius: 3, background: "var(--border-soft)",
        overflow: "hidden", marginBottom: 12 }}>
        <span style={{ display: "block", height: "100%", width: `${(faites / Math.max(1, sections.length)) * 100}%`,
          background: "var(--brand-light)" }} />
      </div>
      {sections.map((s) => {
        const actif = s.code === courante;
        return (
          <button key={s.code} onClick={() => onOuvrir(s.code)} aria-current={actif ? "true" : undefined}
            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
              padding: "8px 10px", marginBottom: 2, cursor: "pointer", fontFamily: "inherit",
              borderRadius: 9,
              border: actif ? "1px solid var(--brand-border)" : "1px solid transparent",
              background: actif ? "var(--bg-surface)" : "transparent",
              boxShadow: actif ? "var(--shadow-card)" : "none" }}>
            <span aria-hidden style={{ display: "flex", flexShrink: 0 }}>{pastille(s)}</span>
            <span style={{ fontSize: 12.5, fontWeight: actif ? 600 : 400,
              color: s.etat === "vide" && !actif ? "var(--text-muted)" : "var(--text)",
              minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
            {s.manquants ? <span className="mono" style={{ marginLeft: "auto", flexShrink: 0,
              fontSize: 10.5, fontWeight: 600, color: "var(--warn-text)",
              background: "var(--warn-chip)", borderRadius: 8, padding: "1px 7px" }}>{s.manquants}</span> : null}
          </button>);
      })}
      {pied && <div style={{ marginTop: "auto", paddingTop: 12 }}>{pied}</div>}
    </div>);
}
