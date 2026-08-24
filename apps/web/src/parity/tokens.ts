// Charte « Encre & Olive » — palette T VERBATIM de docs/reference/olive-demo.html
// (spec de parité §1.1). Source de vérité unique des couleurs pour les écrans de parité.
// Vert olive domine · or avec parcimonie · crème aère · fonctionnelles INTOUCHABLES.
export const T = {
  olive900: "#3A4D22", olive700: "#4A6B28", olive600: "#5A7D3A", olive500: "#6B8E3D",
  leaf: "#7BA042", leafLight: "#A4C56B", sage: "#C9D6B0",
  gold: "#C9A227", goldLight: "#E3C75A",
  ink: "#1A2410", inkMid: "#4A5740", inkSoft: "#8A9578", line: "#E8EDE0", lineSoft: "#F2F5EC",
  cream: "#FAFBF7", surface: "#FFFFFF", oliveSoft: "#EEF3E4",
  green: "#3D9970", greenSoft: "#E8F3ED", amber: "#D99A2B", amberSoft: "#FBF2E0",
  red: "#C44536", redSoft: "#FBEAE7", blue: "#3E6B8A", blueSoft: "#E9F0F5",
  violet: "#7E57C2", violetSoft: "#EFE9F7",
} as const;
export type Tokens = typeof T;
