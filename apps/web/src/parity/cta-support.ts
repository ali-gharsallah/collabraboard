// Source : docs/reference/olive-demo.html 24834–24842 — Custody & Transfer Agent (tokenisation).
export function ctaHash(s: string) { let h = 5381; for (const c of s) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, "0"); }
export const CTA_TOKENS: any[] = [
  { id: "TKN-001", nom: "Immeuble Rue du Rhône 42, Genève", type: "Immobilier tokenisé", parts: 1000, vni: "CHF 12'400 / part", hash: ctaHash("RHONE42") },
  { id: "TKN-002", nom: "Sukuk al-Ijara souverain 2029", type: "Sukuk tokenisé", parts: 500, vni: "CHF 1'000 / part", hash: ctaHash("SUKUK29") },
];
export const CTA_REGISTRE: any = { "TKN-001": { "Famille Keller": 600, "Trust Aquila": 250, "Banque (compte propre)": 150 }, "TKN-002": { "Holding Véga": 300, "Famille Keller": 200 } };
export const CTA_MOUVEMENTS: any[] = [{ at: "J-12", tkn: "TKN-001", de: "Banque (compte propre)", a: "Trust Aquila", qte: 250, hash: ctaHash("M1"), prev: "génèse" }];
