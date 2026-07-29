import React from "react";
import { P, STATE_COLOR } from "../theme/palette";

// ─── BRANCHE D'OLIVIER = frise du cycle de vie ───────────────────────────────
// Chaque feuille = une étape du lifecycle. Verte = validée · Dorée = en cours ·
// Grise = à venir · Rouge = alerte. La branche EST le logo, la frise ET l'indicateur
// d'état — cohérence marque/produit. Port fidèle de la maquette (demo/olive-demo.html).
export type Stage = { id: number | string; label: string; state: "done" | "current" | "pending" | "alert"; desc?: string };

const stateColor = (s: Stage["state"]) =>
  s === "done" ? P.leaf : s === "current" ? P.gold : s === "alert" ? P.red : P.inkSoft;

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

// ─── BRANCHE VERTICALE = frise du cycle de vie en pied de carte de visite ────
// Port fidèle de la maquette (parcours d'onboarding, demo/olive-demo.html §14231) :
// tige verticale qui « pousse », feuilles alternées gauche/droite, pastille numérotée,
// libellé + description. Verte = validée · Dorée = en cours · Rouge = alerte · Grise = à venir.
export function OliveBranchVertical({ stages }: { stages: Stage[] }) {
  const ROW_H = 96, CY = 30;
  return (
    <div style={{ marginTop: 10 }}>
      {stages.map((s, i) => {
        const col = stateColor(s.state);
        const filled = s.state !== "pending";
        const last = i === stages.length - 1;
        const leftSide = i % 2 === 0;
        const leafScale = i === 0 ? 0.62 : 0.82;
        const lrot = leftSide ? -50 : 50;
        const delay = i * 0.4;
        return (
          <div key={s.id} style={{ display: "flex", gap: 16, position: "relative" }}>
            {!last && <div style={{ position: "absolute", left: 30.75, top: CY, bottom: -CY, width: 2.5,
              background: s.state === "done" ? P.leaf : "#6B5838", opacity: s.state === "done" ? 1 : 0.5, borderRadius: 2,
              transformOrigin: "top", animation: `branchDraw 0.8s ease ${delay + 0.2}s both`, zIndex: 0 }} />}
            <div style={{ width: 64, flexShrink: 0, position: "relative", zIndex: 1 }}>
              <svg width="64" height={last ? CY + 16 : ROW_H} viewBox={`0 0 64 ${last ? CY + 16 : ROW_H}`} style={{ overflow: "visible", display: "block" }} aria-hidden>
                {(s.state === "current" || s.state === "alert") && (
                  <ellipse cx={leftSide ? 14 : 50} cy={CY - 14} rx="9" ry="16" fill={col} opacity="0.16">
                    <animate attributeName="opacity" values="0.16;0.04;0.16" dur="2.4s" repeatCount="indefinite" />
                  </ellipse>)}
                <g style={{ transformOrigin: `32px ${CY}px`, animation: `oliveGrow 1.1s cubic-bezier(.34,1.4,.5,1) ${delay}s both` }}>
                  <line x1="32" y1={CY} x2={leftSide ? 24 : 40} y2={CY - 6} stroke="#6B5838" strokeWidth="1.6" opacity="0.7" />
                  <g transform={`translate(${leftSide ? 24 : 40} ${CY - 6}) rotate(${lrot}) scale(${leafScale})`}>
                    <path d="M 0 0 C 11 -6, 11 -34, 0 -42 C -11 -34, -11 -6, 0 0 Z" fill={filled ? col : P.surface} stroke={col} strokeWidth={filled ? 0 : 1.8} opacity={filled ? 1 : 0.7} />
                    <line x1="0" y1="0" x2="0" y2="-42" stroke={filled ? "#fff" : col} strokeWidth="1.1" opacity="0.5" />
                    <line x1="0" y1="-16" x2="6.5" y2="-10" stroke={filled ? "#fff" : col} strokeWidth="0.8" opacity="0.4" />
                    <line x1="0" y1="-16" x2="-6.5" y2="-10" stroke={filled ? "#fff" : col} strokeWidth="0.8" opacity="0.4" />
                    <line x1="0" y1="-28" x2="5.5" y2="-22" stroke={filled ? "#fff" : col} strokeWidth="0.8" opacity="0.4" />
                    <line x1="0" y1="-28" x2="-5.5" y2="-22" stroke={filled ? "#fff" : col} strokeWidth="0.8" opacity="0.4" />
                  </g>
                  <circle cx="32" cy={CY} r="6.5" fill={P.surface} stroke={col} strokeWidth="2" />
                  <text x="32" y={CY + 3} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={col}>{s.state === "done" ? "✓" : s.id}</text>
                </g>
              </svg>
            </div>
            <div style={{ flex: 1, paddingTop: CY - 22, paddingBottom: last ? 0 : 18, animation: `fadeUp 0.5s ease ${delay + 0.3}s both` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: s.state === "pending" ? P.inkSoft : P.ink }}>{s.label}</span>
                {s.state === "current" && <span style={{ fontSize: 10, fontWeight: 700, color: P.gold, background: P.amberSoft, padding: "2px 7px", borderRadius: 4 }}>EN COURS</span>}
                {s.state === "alert" && <span style={{ fontSize: 10, fontWeight: 700, color: P.red, background: P.redSoft, padding: "2px 7px", borderRadius: 4 }}>ALERTE</span>}
              </div>
              {s.desc && <div style={{ fontSize: 12, color: P.inkSoft, marginTop: 3 }}>{s.desc}</div>}
            </div>
          </div>);
      })}
    </div>);
}
