/**
 * Données du globe des flux — SÉPARÉES du canvas (V2-M22).
 *
 * Pourquoi : la table des transactions se lit PAR-DESSUS le globe, mais elle ne doit pas
 * attendre son chargement. Le canvas (d3 + atlas mondial, ~52 kB gz) reste paresseux ; ces
 * données et l'habillage qui les affiche pèsent ~2 kB et partent avec l'écran. La substance
 * s'affiche tout de suite, le décor arrive derrière.
 */
export type Statut = "ok" | "watch" | "alert";
export type Flux = { a: string; b: string; v: number; n: number; s: Statut };

export const CITY: Record<string, { name: string; c: [number, number] }> = {
  zurich: { name: "Zurich", c: [8.54, 47.37] }, geneve: { name: "Genève", c: [6.14, 46.20] },
  londres: { name: "Londres", c: [-0.13, 51.51] }, luxembourg: { name: "Luxembourg", c: [6.13, 49.61] },
  francfort: { name: "Francfort", c: [8.68, 50.11] }, jersey: { name: "Jersey", c: [-2.10, 49.21] },
  newyork: { name: "New York", c: [-74.01, 40.71] }, panama: { name: "Panama", c: [-79.52, 8.98] },
  saopaulo: { name: "São Paulo", c: [-46.63, -23.55] }, dubai: { name: "Dubaï", c: [55.27, 25.20] },
  riyad: { name: "Riyad", c: [46.72, 24.71] }, beyrouth: { name: "Beyrouth", c: [35.50, 33.89] },
  nairobi: { name: "Nairobi", c: [36.82, -1.29] }, mumbai: { name: "Mumbai", c: [72.88, 19.08] },
  singapour: { name: "Singapour", c: [103.82, 1.35] }, hongkong: { name: "Hong Kong", c: [114.17, 22.32] },
  tokyo: { name: "Tokyo", c: [139.69, 35.69] }, sydney: { name: "Sydney", c: [151.21, -33.87] },
};

// Statuts : ok = nominal · watch = sous surveillance · alert = alerte AML ouverte.
export const FLOWS: Flux[] = [
  { a: "zurich", b: "londres", v: 412, n: 1840, s: "ok" },
  { a: "geneve", b: "luxembourg", v: 388, n: 1210, s: "ok" },
  { a: "zurich", b: "francfort", v: 301, n: 1595, s: "ok" },
  { a: "geneve", b: "jersey", v: 274, n: 430, s: "watch" },
  { a: "zurich", b: "newyork", v: 268, n: 920, s: "ok" },
  { a: "geneve", b: "dubai", v: 233, n: 512, s: "watch" },
  { a: "zurich", b: "singapour", v: 219, n: 688, s: "ok" },
  { a: "geneve", b: "beyrouth", v: 141, n: 186, s: "alert" },
  { a: "zurich", b: "hongkong", v: 137, n: 474, s: "watch" },
  { a: "geneve", b: "panama", v: 118, n: 96, s: "alert" },
  { a: "zurich", b: "riyad", v: 112, n: 204, s: "watch" },
  { a: "geneve", b: "saopaulo", v: 96, n: 248, s: "ok" },
  { a: "zurich", b: "tokyo", v: 88, n: 361, s: "ok" },
  { a: "geneve", b: "nairobi", v: 74, n: 132, s: "alert" },
  { a: "zurich", b: "mumbai", v: 69, n: 277, s: "ok" },
  { a: "geneve", b: "sydney", v: 52, n: 164, s: "ok" },
];

// Couleurs des flux — assombries pour rester lisibles sur fond clair (le vert pâle de la
// maquette sombre disparaissait sur la page).
export const COLOR: Record<Statut, string> = { ok: "#5C8A2A", watch: "#B07B12", alert: "#C0473A" };
export const LABEL: Record<Statut, string> = { ok: "nominal", watch: "surveillance", alert: "alerte AML" };

// Paliers de risque pays — classification de DÉMONSTRATION inspirée des listes GAFI. Elle
// n'engage aucune position de la banque : la vraie matrice pays est une config gouvernée.
// L'échelle va du VERT au ROUGE : un pays sans risque se lit sans légende, et le palier
// « modéré » prend un olive sourd, très proche du fond de la page — l'œil n'est attiré que par
// ce qui mérite l'attention. La maquette du designer utilisait deux gris ardoise pour ces deux
// paliers : lisibles, mais le globe restait froid et détaché de la page olive (demande PO).
// V2-M22 : la scène passe en TONS CLAIRS, ceux de la page (--bg-app). Le globe n'est plus une
// vignette sombre posée dans l'écran, c'est le FOND de l'écran ; les transactions se lisent
// par-dessus. Un fond doit rester un fond : les teintes sont donc désaturées, et « modéré » se
// confond presque avec la page — seuls l'ambre et le rouge accrochent l'œil.
export const RISK_TIERS = [
  { id: "critique", label: "Critique", fill: "#DBA79C", stroke: "#C4796A" },
  { id: "eleve", label: "Élevé", fill: "#E4C592", stroke: "#C79E5F" },
  { id: "modere", label: "Modéré", fill: "#E4E9DA", stroke: "#D2D9C4" },
  { id: "faible", label: "Faible", fill: "#BFD79B", stroke: "#9CBB6F" },
];
export const RISK_BY_COUNTRY: Record<string, string> = {};
const assign = (tier: string, noms: string[]) => noms.forEach((n) => { RISK_BY_COUNTRY[n] = tier; });
assign("critique", ["Iran", "North Korea", "Myanmar", "Syria", "Afghanistan", "Yemen", "Somalia",
  "Libya", "Sudan", "South Sudan", "Venezuela", "Belarus", "Russia", "Haiti"]);
assign("eleve", ["Lebanon", "Panama", "Nigeria", "Mali", "Burkina Faso", "Niger", "Chad",
  "Democratic Republic of the Congo", "Cameroon", "Mozambique", "Tanzania", "Zimbabwe", "Angola",
  "Iraq", "Turkey", "Ukraine", "Kazakhstan", "Uzbekistan", "Turkmenistan", "Tajikistan",
  "Kyrgyzstan", "Pakistan", "Bangladesh", "Cambodia", "Laos", "Philippines", "Vietnam", "Nepal",
  "Guinea", "Sierra Leone", "Liberia", "Central African Republic", "Republic of the Congo",
  "Equatorial Guinea", "Eritrea", "Nicaragua", "Bolivia", "Paraguay", "Honduras", "Guatemala",
  "Algeria", "Egypt", "Jordan", "Azerbaijan", "Armenia", "Georgia", "Mongolia", "Papua New Guinea",
  "Madagascar", "Zambia", "Uganda", "Kenya", "Ethiopia", "Ghana", "Ivory Coast", "Senegal",
  "Benin", "Togo"]);
assign("faible", ["Switzerland", "Liechtenstein", "Germany", "France", "Austria", "Netherlands",
  "Belgium", "Luxembourg", "Denmark", "Norway", "Sweden", "Finland", "Iceland", "Ireland",
  "United Kingdom", "Spain", "Portugal", "Italy", "Czechia", "Slovakia", "Slovenia", "Poland",
  "Estonia", "Latvia", "Lithuania", "Canada", "United States of America", "Australia",
  "New Zealand", "Japan", "Singapore", "South Korea", "Chile", "Uruguay", "Israel", "Qatar",
  "Greece", "Hungary", "Croatia"]);

