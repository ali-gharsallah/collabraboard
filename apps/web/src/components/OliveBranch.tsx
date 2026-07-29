import React from "react";
import { P, STATE_COLOR } from "../theme/palette";

// ─── BRANCHE D'OLIVIER = frise du cycle de vie ───────────────────────────────
// Chaque feuille = une étape du lifecycle. Verte = validée · Dorée = en cours ·
// Grise = à venir · Rouge = alerte. La branche EST le logo, la frise ET l'indicateur
// d'état — cohérence marque/produit. Port fidèle de la maquette (demo/olive-demo.html).
export type Stage = { id: number | string; label: string; state: "done" | "current" | "pending" | "alert" };

export function OliveBranch({ stages, compact = false }: { stages: Stage[]; compact?: boolean }) {
  const W = compact ? 760 : 880, H = compact ? 150 : 250;
  const midY = H / 2;
  const n = Math.max(stages.length - 1, 1);
  const pos = stages.map((_s, i) => {
    const t = i / n;
    return { x: 60 + t * (W - 120), y: midY - Math.sin(t * Math.PI) * (compact ? 6 : 10) };
  });
  const petiole = 5, wMid = 11;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cycle de vie du client">
      {/* rameau */}
      <path d={`M 34 ${midY} ${pos.map((p) => `L ${p.x} ${p.y}`).join(" ")} L ${W - 34} ${midY}`}
        fill="none" stroke="#6B5838" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
      {/* olive à l'extrémité */}
      <ellipse cx={W - 30} cy={midY} rx="7" ry="9.5" fill={P.olive900} />
      <ellipse cx={W - 32} cy={midY - 3} rx="2" ry="3" fill="#fff" opacity="0.3" />
      {stages.map((s, i) => {
        const p = pos[i], color = STATE_COLOR[s.state] ?? P.inkSoft;
        const filled = s.state !== "pending";
        const up = i % 2 === 0, sign = up ? -1 : 1;
        const base = sign * petiole, tip = sign * (petiole + 40);
        const cBase = sign * (petiole + 6), cTip = sign * (petiole + 30);
        const rot = up ? (i % 4 === 0 ? -14 : 14) : (i % 4 === 1 ? 14 : -14);
        return (
          <g key={s.id}>
            <g transform={`translate(${p.x} ${p.y}) rotate(${rot})`}>
              <line x1="0" y1="0" x2="0" y2={base} stroke="#6B5838" strokeWidth="1.5" opacity="0.7" />
              {(s.state === "current" || s.state === "alert") && (
                <ellipse cx="0" cy={sign * (petiole + 20)} rx="12" ry="24" fill={color} opacity="0.18">
                  <animate attributeName="opacity" values="0.18;0.04;0.18" dur="2s" repeatCount="indefinite" />
                </ellipse>)}
              {/* feuille charnue */}
              <path d={`M 0 ${base} C ${wMid} ${cBase}, ${wMid} ${cTip}, 0 ${tip} C ${-wMid} ${cTip}, ${-wMid} ${cBase}, 0 ${base} Z`}
                fill={filled ? color : P.surface} stroke={color} strokeWidth={filled ? 0 : 1.6} opacity={filled ? 1 : 0.7} />
              <line x1="0" y1={base} x2="0" y2={tip} stroke={filled ? "#fff" : color} strokeWidth="1" opacity="0.5" />
              {[16, 26].map((d, k) => (
                <React.Fragment key={k}>
                  <line x1="0" y1={sign * (petiole + d)} x2={wMid * 0.55} y2={sign * (petiole + d - 5)} stroke={filled ? "#fff" : color} strokeWidth="0.7" opacity="0.4" />
                  <line x1="0" y1={sign * (petiole + d)} x2={-wMid * 0.55} y2={sign * (petiole + d - 5)} stroke={filled ? "#fff" : color} strokeWidth="0.7" opacity="0.4" />
                </React.Fragment>))}
            </g>
            {/* pastille d'étape + numéro + libellé */}
            <circle cx={p.x} cy={p.y} r="7.5" fill={P.surface} stroke={color} strokeWidth="2" />
            <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>{s.id}</text>
            <text x={p.x} y={p.y + (up ? 44 : -36)} textAnchor="middle" fontSize="10" fontWeight="600" fill={P.inkMid}>{s.label}</text>
          </g>);
      })}
      <ellipse cx={W - 20} cy={midY} rx="7" ry="9.5" fill={P.olive900} />
      <ellipse cx={W - 22} cy={midY - 3} rx="2" ry="3" fill="#fff" opacity="0.3" />
    </svg>);
}
