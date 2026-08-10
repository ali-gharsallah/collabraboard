import React from "react";
import "./tokens.css";
import { StatusChip, ChipMode } from "./StatusChip";

/**
 * UI v2 — composant 3 : WorkQueueRow (handoff §Bibliothèque).
 * Ligne de file de travail. Grille `5px 1.6fr 1fr 1fr 0.9fr 100px` : barre de priorité,
 * client, ACTION ATTENDUE EN TOUTES LETTRES (jamais un statut à décoder), étape, échéance,
 * risque. Le fond prend la teinte pâle d'alerte au niveau critique.
 * PIÈGE DU HANDOFF encodé ici : l'en-tête partage EXACTEMENT la même grid-template-columns
 * ET les mêmes paddings de cellule que les lignes — la grille vit dans UNE constante.
 */
export const WQ_GRID = "5px 1.6fr 1fr 1fr 0.9fr 100px";
const CELL_PAD = "14px 10px 14px 0";

export type WorkQueueItem = {
  id: string;
  client: string;
  sous?: string;                         // « Trust · Jersey · CDB 20 art. 39 » (maquette 01)
  action: string;                        // « Qualifier un hit sanctions », pas « SCREENING_HIT »
  etape: string;
  echeance: string;                      // ISO ou libellé — rendu en Mono
  echeanceMode?: "ok" | "warn" | "alert";
  risque: { label: string; mode: ChipMode };
  priorite: "ok" | "warn" | "alert";     // barre 5×34 + fond pâle si alert
};

export function WorkQueueHeader({ t }: { t?: (cle: string) => string }) {
  const tr = t ?? ((s: string) => s);
  const th = (lbl: string) => (
    <span key={lbl} className="microlabel" style={{ padding: "10px 10px 10px 0" }}>{tr(lbl)}</span>);
  return (
    <div role="row" style={{ display: "grid", gridTemplateColumns: WQ_GRID, alignItems: "center",
      padding: "0 20px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
      <span />
      {["Client", "Action attendue", "Étape", "Échéance", "Risque"].map(th)}
    </div>);
}

export function WorkQueueRow({ item, onOpen }: { item: WorkQueueItem; onOpen: (id: string) => void }) {
  const critique = item.priorite === "alert";
  return (
    <button role="row" onClick={() => onOpen(item.id)} style={{ display: "grid",
      gridTemplateColumns: WQ_GRID, alignItems: "center", width: "100%", textAlign: "left",
      padding: "0 20px", border: "none", borderBottom: "1px solid var(--border-row)",
      cursor: "pointer", fontFamily: "inherit",
      background: critique ? "var(--alert-card)" : "var(--bg-surface)" }}
      onMouseEnter={(e) => { if (!critique) e.currentTarget.style.background = "var(--bg-subtle)"; }}
      onMouseLeave={(e) => { if (!critique) e.currentTarget.style.background = "var(--bg-surface)"; }}>
      <span aria-hidden style={{ width: 5, height: 34, borderRadius: 3,
        background: `var(--${item.priorite}-line)` }} />
      <span style={{ padding: CELL_PAD, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.client}</span>
        {item.sous && <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)",
          marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.sous}</span>}
      </span>
      <span style={{ padding: CELL_PAD, fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.35 }}>{item.action}</span>
      <span style={{ padding: CELL_PAD, fontSize: 12, color: "var(--text-muted)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.etape}</span>
      <span className="mono" style={{ padding: CELL_PAD, fontSize: 11.5, whiteSpace: "nowrap",
        fontWeight: item.echeanceMode === "alert" ? 600 : 400,
        color: item.echeanceMode ? `var(--${item.echeanceMode}-text)` : "var(--text-muted)" }}>{item.echeance}</span>
      <span style={{ padding: "14px 0" }}><StatusChip mode={item.risque.mode}>{item.risque.label}</StatusChip></span>
    </button>);
}
