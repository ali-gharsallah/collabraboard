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

/**
 * DiffRow (composant 10) — la forme SIMPLE : deux colonnes égales, « Au dossier — <année> »
 * en corps normal, « Constaté — <année> » en warn-text graisse 500. Utilisé en revue périodique
 * (delta R467) et en changement de circonstances ; `encadre` matérialise le constat dans un
 * cadre ambre (écran 07 — le changement se voit avant d'être émis).
 */
export function DiffRow({ labelGauche, gauche, sousGauche, labelDroite, droite, sousDroite,
  encadre }: {
  labelGauche: string; gauche: React.ReactNode; sousGauche?: string;
  labelDroite: string; droite: React.ReactNode; sousDroite?: string; encadre?: boolean;
}) {
  // toujours UN conteneur par côté — un fragment éclaterait les enfants en items de grille
  const cadre = (contenu: React.ReactNode, cote: "gauche" | "droite") => (
    <div style={!encadre ? { minWidth: 0 } : { padding: "10px 12px", borderRadius: 10,
      border: cote === "droite" ? "1.5px solid var(--warn-card-border)" : "1px solid var(--border)",
      background: cote === "droite" ? "var(--warn-card)" : "var(--bg-subtle)" }}>{contenu}</div>);
  return (
    <div style={{ display: "grid", gridTemplateColumns: encadre ? "1fr 22px 1fr" : "1fr 1fr",
      gap: encadre ? 8 : 18, alignItems: encadre ? "stretch" : "start" }}>
      {cadre(<>
        <div className="microlabel" style={{ marginBottom: 4 }}>{labelGauche}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-body)" }}>{gauche}</div>
        {sousGauche && <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3 }}>{sousGauche}</div>}
      </>, "gauche")}
      {encadre && <div aria-hidden style={{ alignSelf: "center", textAlign: "center",
        color: "var(--text-muted)", fontSize: 14 }}>→</div>}
      {cadre(<>
        <div className="microlabel" style={{ marginBottom: 4 }}>{labelDroite}</div>
        <div style={{ fontSize: 12.5, color: "var(--warn-text)", fontWeight: 500 }}>{droite}</div>
        {sousDroite && <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3 }}>{sousDroite}</div>}
      </>, "droite")}
    </div>);
}

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
