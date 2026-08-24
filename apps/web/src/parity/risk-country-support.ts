// Source : docs/reference/olive-demo.html 31620–31637 — porté verbatim.
// Pays à risque (GAFI + politique interne) partagés : transferts, AML, SWIFT Lab, corroboration.
export const RISK_COUNTRIES: any[] = [
  { cc: "IR", name: "Iran", level: "FATF_BLACK", source: "GAFI 06/2026" },
  { cc: "KP", name: "Corée du Nord", level: "FATF_BLACK", source: "GAFI 06/2026" },
  { cc: "MM", name: "Myanmar", level: "FATF_BLACK", source: "GAFI 06/2026" },
  { cc: "SY", name: "Syrie", level: "FATF_GREY", source: "GAFI 06/2026" },
  { cc: "YE", name: "Yémen", level: "FATF_GREY", source: "GAFI 06/2026" },
  { cc: "HT", name: "Haïti", level: "FATF_GREY", source: "GAFI 06/2026" },
  { cc: "ML", name: "Mali", level: "FATF_GREY", source: "GAFI 06/2026" },
  { cc: "TR", name: "Turquie", level: "FATF_GREY", source: "GAFI 06/2026" },
  { cc: "RU", name: "Russie", level: "INTERNE", source: "Politique BOS 2026 — sanctions" },
  { cc: "BY", name: "Bélarus", level: "INTERNE", source: "Politique BOS 2026 — sanctions" },
  { cc: "PA", name: "Panama", level: "INTERNE", source: "Politique BOS — offshore" },
  { cc: "KY", name: "Îles Caïmans", level: "INTERNE", source: "Politique BOS — offshore" },
  { cc: "BS", name: "Bahamas", level: "INTERNE", source: "Politique BOS — offshore" },
  { cc: "AE", name: "Émirats (EAU)", level: "INTERNE", source: "Politique BOS — corridor surveillé" },
];
export function riskCountryOf(cc: string): any { return RISK_COUNTRIES.find(function (x) { return x.cc === cc; }) || null; }
export const RC_LEVELS: any = { FATF_BLACK: ["Liste noire GAFI", "red"], FATF_GREY: ["Liste grise GAFI", "amber"], INTERNE: ["Liste interne banque", "violet"] };
