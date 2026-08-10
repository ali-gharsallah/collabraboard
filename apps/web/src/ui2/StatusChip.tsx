import React from "react";
import "./tokens.css";

/**
 * UI v2 — composant 1 : StatusChip (handoff §Bibliothèque).
 * Puce de statut : 10,5–11px/600, padding 3px 8px, rayon 5px, couleurs de la table
 * sémantique — le LIBELLÉ porte l'information, la couleur la renforce (lisible sans elle).
 * Variantes : ok · warn · alert · info · neutral · ai — la sémantique réglementaire ne
 * sert JAMAIS à autre chose qu'au risque, à l'échéance et au statut de contrôle.
 */
export type ChipMode = "ok" | "warn" | "alert" | "info" | "neutral" | "ai";

const STYLES: Record<ChipMode, { bg: string; fg: string }> = {
  ok: { bg: "var(--ok-chip)", fg: "var(--ok-text)" },
  warn: { bg: "var(--warn-chip)", fg: "var(--warn-text)" },
  alert: { bg: "var(--alert-chip)", fg: "var(--alert-text)" },
  info: { bg: "var(--info-chip)", fg: "var(--info-text)" },
  neutral: { bg: "var(--bg-muted)", fg: "var(--text-secondary)" },
  ai: { bg: "var(--ai-chip)", fg: "var(--ai-text)" },
};

export function StatusChip({ mode, children }: { mode: ChipMode; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-block", fontSize: 10.5, fontWeight: 600, lineHeight: 1,
      padding: "3px 8px", borderRadius: "var(--r-chip)", letterSpacing: 0.2,
      textTransform: "uppercase", whiteSpace: "nowrap",
      background: STYLES[mode].bg, color: STYLES[mode].fg }}>{children}</span>);
}
