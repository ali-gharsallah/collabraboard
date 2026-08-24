import React from "react";
import "./tokens.css";

/**
 * UI v2 — composant 4 : EventTimeline (handoff §Bibliothèque).
 * Chronologie verticale : colonne de 9px (pastille + trait --border-soft 2px), titre 12,5px,
 * méta en Mono 11px muted. Le marqueur « vous êtes ici » est un anneau de 15px, bordure 3px
 * brand, fond blanc, titre en graisse 700 — le rejeu à date (R48) a un ancrage visuel.
 */
export type TimelineEvent = {
  id: string;
  titre: string;
  meta: string;                          // « 10.08.2026 · Camille Morel » — rendu en Mono
  mode?: "ok" | "warn" | "alert" | "info";
  ici?: boolean;                         // marqueur « vous êtes ici »
};

export function EventTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div>
      {events.map((e, i) => (
        <div key={e.id} style={{ display: "flex", gap: 12 }}>
          <span aria-hidden style={{ width: 15, flexShrink: 0, display: "flex",
            flexDirection: "column", alignItems: "center" }}>
            {e.ici
              ? <span style={{ width: 15, height: 15, borderRadius: "50%", boxSizing: "border-box",
                  border: "3px solid var(--brand)", background: "var(--bg-surface)", marginTop: 2 }} />
              : <span style={{ width: 9, height: 9, borderRadius: "50%", marginTop: 5,
                  background: e.mode ? `var(--${e.mode}-line)` : "var(--border-input)" }} />}
            {i < events.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 14,
              background: "var(--border-soft)", marginTop: 3 }} />}
          </span>
          <span style={{ paddingBottom: 16, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12.5, fontWeight: e.ici ? 700 : 500,
              color: "var(--text)", lineHeight: 1.35 }}>{e.titre}</span>
            <span className="mono" style={{ display: "block", fontSize: 11,
              color: "var(--text-muted)", marginTop: 2 }}>{e.meta}</span>
          </span>
        </div>))}
    </div>);
}
