// Jetons de thème O-Live (SPEC-FRONT-CÂBLAGE v2 §1 · amendement A1/D3). Source unique des
// couleurs et espacements pour tout code NOUVEAU ou MODIFIÉ (règle du boy-scout : les écrans
// existants ne sont pas re-stylés préventivement). Vert dominant, or parcimonieux ;
// vert/ambre/rouge réservés aux statuts.
export const tokens = {
  color: {
    olive900: "#3A4D22",
    olive700: "#4A6B28",
    olive600: "#5A7D3A",
    leaf: "#7BA042",
    gold: "#C9A227",
    ink: "#1A2410",
    cream: "#FAFBF7",
    // statuts (sémantiques, jamais décoratifs)
    ok: "#4A6B28",
    warn: "#C9A227",
    danger: "#C0392B",
    muted: "#8A8F82",
    border: "#E6E9DF",
    surface: "#FAFBF7",
    // Accents PAR MODULE (comparaison front↔maquette 2026-07-29, lève l'écart G3) : la
    // maquette `demo/olive-demo.html` colore certaines familles ; valeurs recopiées VERBATIM
    // (une clé par famille, jamais un dégradé décoratif). Compliance & Risque = terracotta ;
    // Data & Intelligence (BI, Olivia/IA) = violet.
    accentCompliance: "#8C4A3C",
    accentComplianceBg: "#FBEDEA",
    accentData: "#7A5AF8",
    accentDataBg: "#F0E9FB",
  },
  radius: { sm: 6, md: 8, lg: 10 },
  space: (n: number) => n * 4,
  font: { sm: 12, base: 13, lg: 15 },
} as const;

export type Tokens = typeof tokens;
