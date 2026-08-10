import React from "react";
import "./tokens.css";
import { StatusChip } from "./StatusChip";

/**
 * UI v2 — composant 8 : DiffRow / DiffTable (handoff §Bibliothèque).
 * Comparaison avant/après. En screening, la grille passe à `180px 1fr 1fr 92px` avec une
 * colonne de CONCORDANCE (92 % · DIVERGE · EXACT · N/A) et un fond rouge pâle sur les lignes
 * divergentes — la divergence se voit à la ligne, pas seulement à la puce.
 */
export type DiffLigne = { attribut: string; gauche: React.ReactNode; droite: React.ReactNode;
  concordance: { label: string; mode: "pct" | "exact" | "diverge" | "na" } };

export const DIFF_GRID = "180px 1fr 1fr 92px";

export function DiffTable({ lignes, enteteGauche, enteteDroite, t }: {
  lignes: DiffLigne[]; enteteGauche: string; enteteDroite: string; t?: (cle: string) => string;
}) {
  const tr = t ?? ((s: string) => s);
  const chip = (c: DiffLigne["concordance"]) =>
    c.mode === "diverge" ? <StatusChip mode="alert">{c.label}</StatusChip>
    : c.mode === "exact" ? <StatusChip mode="ok">{c.label}</StatusChip>
    : c.mode === "na" ? <StatusChip mode="neutral">{c.label}</StatusChip>
    : <StatusChip mode="warn">{c.label}</StatusChip>;
  return (
    <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
      <div role="row" style={{ display: "grid", gridTemplateColumns: DIFF_GRID, alignItems: "center",
        padding: "0 16px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
        {[tr("Attribut"), enteteGauche, enteteDroite, tr("Concordance")].map((h) => (
          <span key={h} className="microlabel" style={{ padding: "9px 10px 9px 0" }}>{h}</span>))}
      </div>
      {lignes.map((l) => {
        const diverge = l.concordance.mode === "diverge";
        return (
          <div role="row" key={l.attribut} style={{ display: "grid", gridTemplateColumns: DIFF_GRID,
            alignItems: "center", padding: "0 16px", borderBottom: "1px solid var(--border-row)",
            background: diverge ? "var(--alert-card)" : "var(--bg-surface)" }}>
            <span style={{ padding: "11px 10px 11px 0", fontSize: 11.5, color: "var(--text-muted)" }}>{l.attribut}</span>
            <span style={{ padding: "11px 10px 11px 0", fontSize: 12.5, color: "var(--text-body)" }}>{l.gauche}</span>
            <span style={{ padding: "11px 10px 11px 0", fontSize: 12.5, fontWeight: diverge ? 600 : 400,
              color: diverge ? "var(--alert-text)" : "var(--text-body)" }}>{l.droite}</span>
            <span style={{ padding: "9px 0" }}>{chip(l.concordance)}</span>
          </div>);
      })}
    </section>);
}
