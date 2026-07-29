import React from "react";
import { P } from "../theme/palette";

// Logo O-Live — brand-concept officiel (port fidèle de la maquette) : pastille dégradé olive
// + brin d'olivier stylisé (tige, 4 feuilles miroir, olive dorée en tête).
export function OliveLogo({ size = 1, tagline = true }: { size?: number; tagline?: boolean }) {
  const s = 36 * size;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 * size }}>
      <div style={{ width: s, height: s, borderRadius: 10 * size, flexShrink: 0,
        background: `linear-gradient(135deg,${P.olive700},${P.leaf})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={s * 0.6} height={s * 0.6} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 22 C12 15 12 8 12 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          <ellipse cx="8" cy="8.5" rx="2.7" ry="1.4" fill="#fff" transform="rotate(-35 8 8.5)" />
          <ellipse cx="16" cy="10.5" rx="2.7" ry="1.4" fill="#fff" transform="rotate(35 16 10.5)" />
          <ellipse cx="8.5" cy="13.5" rx="2.5" ry="1.3" fill="#fff" opacity="0.85" transform="rotate(-35 8.5 13.5)" />
          <ellipse cx="15.5" cy="15" rx="2.5" ry="1.3" fill="#fff" opacity="0.85" transform="rotate(35 15.5 15)" />
          <circle cx="12" cy="3" r="1.9" fill={P.goldLight} />
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 18 * size, fontWeight: 800, color: P.ink, letterSpacing: -0.5, lineHeight: 1 }}>
          O<span style={{ color: P.olive600 }}>-</span>Live</div>
        {tagline && <div style={{ fontSize: 8 * size, color: P.inkSoft, letterSpacing: 2, textTransform: "uppercase", marginTop: 2 }}>
          Client Lifecycle Intelligence</div>}
      </div>
    </div>);
}
