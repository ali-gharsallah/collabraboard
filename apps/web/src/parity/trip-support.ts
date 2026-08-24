// Source : docs/reference/olive-demo.html 43024-43064 — BUSINESS_TRIPS, XB_C, TRIP_ST, SOLIC,
// DEST_QUOTAS_SEED, RM_OVERRIDES_SEED, INDIGITA_DB, IND_C, ROLE_GATE. Porté VERBATIM.

export const BUSINESS_TRIPS: any[] = [{ "id": "BT-2026-014", "rm": "Sophie Marchand", "city": "Dubaï", "country": "EAU", "countryCode": "AE", "flag": "🇦🇪", "from": "2026-07-08", "to": "2026-07-11", "purpose": "Visite clientèle", "clients": ["Arslan Family Office", "Leroy Assoc."], "status": "PENDING", "xbRisk": "MEDIUM", "licenceRequired": false, "solicitation": "conditional", "budget": "CHF 4 200", "approvals": [{ "role": "RM", "label": "Demande RM", "state": "done" }, { "role": "MGR", "label": "Responsable d'équipe", "state": "done" }, { "role": "XB", "label": "Compliance Cross-Border", "state": "current" }, { "role": "HPB", "label": "Head of Private Banking", "state": "pending" }] }, { "id": "BT-2026-013", "rm": "Ralf Kessler", "city": "Singapour", "country": "Singapour", "countryCode": "SG", "flag": "🇸🇬", "from": "2026-07-02", "to": "2026-07-06", "purpose": "Prospection", "clients": ["Mancini GmbH"], "status": "APPROVED", "xbRisk": "MEDIUM", "licenceRequired": true, "solicitation": "conditional", "budget": "CHF 6 800", "approvals": [{ "role": "RM", "label": "Demande RM", "state": "done" }, { "role": "MGR", "label": "Responsable d'équipe", "state": "done" }, { "role": "XB", "label": "Compliance Cross-Border", "state": "done" }, { "role": "HPB", "label": "Head of Private Banking", "state": "done" }] }, { "id": "BT-2026-012", "rm": "Valentina Rossi", "city": "New York", "country": "États-Unis", "countryCode": "US", "flag": "🇺🇸", "from": "2026-07-15", "to": "2026-07-18", "purpose": "Visite clientèle", "clients": ["Roy Family Office"], "status": "PENDING", "xbRisk": "HIGH", "licenceRequired": true, "solicitation": "forbidden", "budget": "CHF 7 500", "approvals": [{ "role": "RM", "label": "Demande RM", "state": "done" }, { "role": "MGR", "label": "Responsable d'équipe", "state": "current" }, { "role": "XB", "label": "Compliance Cross-Border", "state": "pending" }, { "role": "HPB", "label": "Head of Private Banking", "state": "pending" }] }, { "id": "BT-2026-011", "rm": "Sophie Marchand", "city": "Paris", "country": "France", "countryCode": "FR", "flag": "🇫🇷", "from": "2026-06-24", "to": "2026-06-25", "purpose": "Conférence", "clients": [], "status": "APPROVED", "xbRisk": "LOW", "licenceRequired": false, "solicitation": "allowed", "budget": "CHF 1 100", "approvals": [{ "role": "RM", "label": "Demande RM", "state": "done" }, { "role": "MGR", "label": "Responsable d'équipe", "state": "done" }, { "role": "XB", "label": "Compliance Cross-Border", "state": "done" }, { "role": "HPB", "label": "Head of Private Banking", "state": "done" }] }, { "id": "BT-2026-010", "rm": "Jean-Paul Favre", "city": "Londres", "country": "Royaume-Uni", "countryCode": "GB", "flag": "🇬🇧", "from": "2026-07-21", "to": "2026-07-23", "purpose": "Visite clientèle", "clients": ["Mohamed Demir", "Ito Holding"], "status": "DRAFT", "xbRisk": "MEDIUM", "licenceRequired": false, "solicitation": "conditional", "budget": "CHF 2 900", "approvals": [{ "role": "RM", "label": "Demande RM", "state": "current" }, { "role": "MGR", "label": "Responsable d'équipe", "state": "pending" }, { "role": "XB", "label": "Compliance Cross-Border", "state": "pending" }, { "role": "HPB", "label": "Head of Private Banking", "state": "pending" }] }, { "id": "BT-2026-009", "rm": "Ming Chen", "city": "Hong Kong", "country": "Hong Kong", "countryCode": "HK", "flag": "🇭🇰", "from": "2026-06-10", "to": "2026-06-14", "purpose": "Prospection", "clients": ["Johansson SA"], "status": "REJECTED", "xbRisk": "HIGH", "licenceRequired": true, "solicitation": "forbidden", "budget": "CHF 5 400", "approvals": [{ "role": "RM", "label": "Demande RM", "state": "done" }, { "role": "MGR", "label": "Responsable d'équipe", "state": "done" }, { "role": "XB", "label": "Compliance Cross-Border", "state": "alert" }, { "role": "HPB", "label": "Head of Private Banking", "state": "pending" }] }];

export const XB_C: any = { LOW: "green", MEDIUM: "amber", HIGH: "red" };
export const TRIP_ST: any = {
  DRAFT: { l: "Brouillon", c: "inkSoft", bg: "cream" },
  PENDING: { l: "En approbation", c: "amber", bg: "amberSoft" },
  APPROVED: { l: "Approuvé", c: "green", bg: "greenSoft" },
  REJECTED: { l: "Refusé", c: "red", bg: "redSoft" },
};
export const SOLIC: any = {
  allowed: { l: "Sollicitation autorisée", c: "green", ic: "✓" },
  conditional: { l: "Sollicitation conditionnelle", c: "amber", ic: "!" },
  forbidden: { l: "Sollicitation interdite", c: "red", ic: "✕" },
};
export const DEST_QUOTAS_SEED: any[] = [
  { country: "France", flag: "🇫🇷", code: "FR", bankDays: 30 },
  { country: "Allemagne", flag: "🇩🇪", code: "DE", bankDays: 30 },
  { country: "Italie", flag: "🇮🇹", code: "IT", bankDays: 25 },
  { country: "Royaume-Uni", flag: "🇬🇧", code: "GB", bankDays: 20 },
  { country: "EAU", flag: "🇦🇪", code: "AE", bankDays: 15 },
  { country: "Singapour", flag: "🇸🇬", code: "SG", bankDays: 10 },
  { country: "Hong Kong", flag: "🇭🇰", code: "HK", bankDays: 5 },
  { country: "États-Unis", flag: "🇺🇸", code: "US", bankDays: 5 },
];
export const RM_OVERRIDES_SEED: any[] = [
  { rm: "Sophie Marchand", code: "AE", days: 20 },
  { rm: "Ralf Kessler", code: "SG", days: 15 },
  { rm: "Valentina Rossi", code: "US", days: 8 },
];
// Indigita — moteur cross-border (verdicts par juridiction, démo)
export const INDIGITA_DB: any = {
  FR: { status: "AUTORISÉ", solic: "Autorisée (prof.)", lic: "Non requise", contact: "Visite & démarchage OK", prod: "Produits transfrontaliers UE (LSFin)" },
  DE: { status: "AUTORISÉ", solic: "Autorisée (prof.)", lic: "Non requise", contact: "Visite & démarchage OK", prod: "Produits transfrontaliers UE (LSFin)" },
  IT: { status: "AUTORISÉ", solic: "Autorisée (prof.)", lic: "Non requise", contact: "Visite & démarchage OK", prod: "Produits transfrontaliers UE (LSFin)" },
  GB: { status: "CONDITIONNEL", solic: "Conditionnelle", lic: "Non requise", contact: "Visite OK, démarchage encadré", prod: "Restrictions FCA sur certains fonds" },
  AE: { status: "CONDITIONNEL", solic: "Conditionnelle", lic: "Selon zone (DIFC/onshore)", contact: "Visite OK", prod: "Pas de produits non enregistrés" },
  SG: { status: "CONDITIONNEL", solic: "Conditionnelle", lic: "Requise (MAS)", contact: "Visite encadrée", prod: "Accredited investors uniquement" },
  HK: { status: "BLOQUÉ", solic: "Interdite (active)", lic: "Requise (SFC)", contact: "Reverse solicitation uniquement", prod: "Professional investors, restrictions SFC" },
  US: { status: "BLOQUÉ", solic: "Interdite", lic: "Requise (SEC/FINRA)", contact: "Reverse solicitation documentée", prod: "Aucun démarchage de US persons" },
};
export const IND_C: any = { "AUTORISÉ": "green", "CONDITIONNEL": "amber", "BLOQUÉ": "red" };
export const ROLE_GATE: any = { RM: ["ARM"], MGR: ["ARM", "BRM", "DIR"], XB: ["CO", "CO_SR", "AML"], HPB: ["HPB", "CEO"] };
