import React from "react";
import "./tokens.css";
import { StatusChip, ChipMode } from "./StatusChip";

/**
 * UI v2 — composant 8 : ImpactPreview (handoff §Bibliothèque).
 * Prévisualisation de propagation : la liste des dossiers touchés AVANT que l'événement soit
 * émis (principe n°3 — l'événement est visible avant d'être émis). Chaque dossier porte son
 * StatusChip d'effet (REVUE ANTICIPÉE · ONBOARDING IMPACTÉ · SANS EFFET) et une ligne qui dit
 * précisément ce qui sera rouvert ou créé. Les dossiers SANS EFFET restent listés, en
 * opacity 0.7 — leur présence est une information (rien n'est masqué).
 */
export type ImpactDossier = { nom: string; effet: { label: string; mode: ChipMode };
  detail: string; sansEffet?: boolean };

export function ImpactPreview({ titre, note, dossiers, pied, t }: {
  titre: string; note?: string; dossiers: ImpactDossier[]; pied?: string;
  t?: (cle: string) => string;
}) {
  return (
    <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "13px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{titre}</span>
        {note && <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{note}</span>}
      </div>
      {dossiers.map((d) => (
        <div key={d.nom} data-sans-effet={d.sansEffet ? "true" : undefined}
          style={{ padding: "9px 0", borderBottom: "1px solid var(--border-row)",
            opacity: d.sansEffet ? 0.7 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{d.nom}</span>
            <span style={{ marginLeft: "auto" }}><StatusChip mode={d.effet.mode}>{d.effet.label}</StatusChip></span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-body)", marginTop: 3 }}>{d.detail}</div>
        </div>))}
      {pied && <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9,
        lineHeight: 1.5 }}>{pied}</div>}
    </section>);
}
