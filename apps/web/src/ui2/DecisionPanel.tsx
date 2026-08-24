import React, { useState } from "react";
import "./tokens.css";

/**
 * UI v2 — composant 7 : DecisionPanel (handoff §Bibliothèque).
 * Panneau de décision en colonne latérale : options en BOUTONS RADIO CARTES (bordure 1px
 * inactive, 1,5px brand + fond brand-surface active), champ Motif OBLIGATOIRE marqué d'un
 * astérisque rouge, encart « Effets de cette décision », bouton primaire pleine largeur,
 * mention du second regard. RÈGLES DURES : aucune décision sans motif — le bouton RESTE ACTIF
 * et met le champ en évidence au clic (jamais grisé sans explication) ; le motif est repris
 * TEL QUEL dans le registre réglementaire (et la mention le dit). Côté moteur, ce panneau est
 * le visage de la décision unifiée R474–R476 (/v1/decisions) : motif structuré, code + texte.
 */
export type DecisionOption = { id: string; titre: string; sous: string };

export function DecisionPanel({ titre, sousTitre, options, effets, boutonLabel, mention,
  noteMotif, onDecider, t }: {
  titre: string; sousTitre?: string; options: DecisionOption[]; effets: string[];
  boutonLabel: string; mention: string; noteMotif?: string;
  onDecider: (choix: { option: string; motif: string }) => void;
  t?: (cle: string) => string;
}) {
  const tr = t ?? ((s: string) => s);
  const [choix, setChoix] = useState<string | null>(null);
  const [motif, setMotif] = useState("");
  const [enEvidence, setEnEvidence] = useState(false);         // le refus s'EXPLIQUE, il ne grise pas
  const valider = () => {
    if (!choix || !motif.trim()) { setEnEvidence(true); return; }
    setEnEvidence(false);
    onDecider({ option: choix, motif: motif.trim() });
  };
  return (
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{titre}</div>
      {sousTitre && <div style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 10px" }}>{sousTitre}</div>}
      {options.map((o) => {
        const actif = choix === o.id;
        return (
          <button key={o.id} role="radio" aria-checked={actif} onClick={() => setChoix(o.id)}
            style={{ display: "flex", gap: 10, alignItems: "flex-start", width: "100%",
              textAlign: "left", padding: "10px 12px", marginBottom: 8, cursor: "pointer",
              fontFamily: "inherit", borderRadius: 10,
              border: actif ? "1.5px solid var(--brand)" : "1px solid var(--border-input)",
              background: actif ? "var(--brand-surface)" : "var(--bg-surface)" }}>
            <span aria-hidden style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
              marginTop: 2, boxSizing: "border-box",
              border: actif ? "4.5px solid var(--brand)" : "1.5px solid var(--border-input)",
              background: "var(--bg-surface)" }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{o.titre}</span>
              <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{o.sous}</span>
            </span>
          </button>);
      })}
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", margin: "10px 0 5px" }}>
        {tr("Motif")} <span aria-hidden style={{ color: "var(--alert-line)" }}>*</span></div>
      <textarea value={motif} onChange={(e) => { setMotif(e.target.value); if (e.target.value.trim()) setEnEvidence(false); }}
        rows={4} aria-label={tr("Motif")}
        style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", resize: "vertical",
          borderRadius: "var(--r-input)", fontFamily: "inherit", fontSize: 12.5, color: "var(--text)",
          background: "var(--bg-surface)",
          border: enEvidence ? "1.5px solid var(--alert-line)" : "1px solid var(--border-input)" }} />
      {enEvidence && <div role="alert" style={{ fontSize: 11, color: "var(--alert-text)", marginTop: 4 }}>
        {tr("Pas de motif, pas de décision — choisissez une issue et motivez-la (repris tel quel au registre).")}</div>}
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 5 }}>
        {noteMotif ?? tr("Ce texte sera repris tel quel dans le registre LBA et dans le rejeu d'audit.")}</div>
      <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "10px 12px", margin: "12px 0" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 }}>
          {tr("Effets de cette décision")}</div>
        {effets.map((e, i) => (
          <div key={i} style={{ fontSize: 11.5, color: "var(--text-body)", padding: "1.5px 0" }}>{e}</div>))}
      </div>
      <button onClick={valider} style={{ display: "block", width: "100%", padding: "11px 14px",
        borderRadius: "var(--r-input)", border: "1px solid var(--brand)", background: "var(--brand)",
        color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--brand-hover)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--brand)"; }}>{boutonLabel}</button>
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", textAlign: "center", marginTop: 7 }}>{mention}</div>
    </div>);
}
