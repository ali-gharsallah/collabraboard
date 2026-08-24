import React from "react";
import "./tokens.css";

/**
 * UI v2 — composant 11 : SandboxSlider (handoff §Bibliothèque).
 * Curseur de paramètre du bac à sable : rail 4px border-soft, remplissage --brand (valeur
 * HUMAINE) ou --ai-line (proposition IA), poignée 16px bordure 3px. Le REPÈRE DE LA VALEUR
 * EN PRODUCTION est matérialisé par un trait vertical gris 2×12px avec son libellé sous le
 * rail — on ne bouge pas un seuil sans voir d'où l'on part.
 */
export function SandboxSlider({ label, affichage, min, max, step = 1, value, onChange,
  production, ia, minLabel, maxLabel }: {
  label: string; affichage: string; min: number; max: number; step?: number; value: number;
  onChange: (v: number) => void;
  production?: { valeur: number; label: string };   // repère : trait gris + libellé sous le rail
  ia?: boolean;                                     // proposition IA → remplissage violet
  minLabel?: string; maxLabel?: string;
}) {
  const fill = ia ? "var(--ai-line)" : "var(--brand)";
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", marginBottom: 7 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
        <span className="mono" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600,
          color: "var(--text)" }}>{affichage}</span>
      </div>
      <div style={{ position: "relative", height: 16 }}>
        <div aria-hidden style={{ position: "absolute", top: 6, left: 0, right: 0, height: 4,
          borderRadius: 2, background: "var(--border-soft)" }} />
        <div aria-hidden style={{ position: "absolute", top: 6, left: 0, height: 4,
          borderRadius: 2, width: `${pct(value)}%`, background: fill }} />
        {production && <div aria-hidden data-repere-production style={{ position: "absolute", top: 2,
          left: `${pct(production.valeur)}%`, width: 2, height: 12, background: "var(--text-muted)" }} />}
        <input type="range" className="ui2-slider" min={min} max={max} step={step} value={value}
          aria-label={label} onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: "absolute", inset: 0, ["--slider-fill" as never]: fill }} />
      </div>
      <div style={{ display: "flex", fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
        <span className="mono">{minLabel ?? String(min)}</span>
        <span className="mono" style={{ marginLeft: "auto" }}>{maxLabel ?? String(max)}</span>
      </div>
      {production && <div className="mono" style={{ position: "relative", fontSize: 10,
        color: "var(--text-muted)", height: 13 }}>
        <span style={{ position: "absolute", left: `${pct(production.valeur)}%`,
          transform: `translateX(${pct(production.valeur) < 12 ? "0" : "-50%"})` }}>{production.label}</span>
      </div>}
    </div>);
}
