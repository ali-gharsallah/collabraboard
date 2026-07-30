// Source : docs/reference/olive-demo.html 24964–25052 — OIL (Olive Islamic Layer). Porté verbatim.
import { WF_ENGINE, WF_IDS, WF_TITULAIRES, WF_ACTEURS } from "./olive-wf-engine";

export const OIL_SECTEURS_EXCLUS = ["Alcool", "Tabac", "Jeux d'argent", "Armement", "Porc", "Finance conventionnelle", "Divertissement adulte"];
export function oilAnalyse(p: any) {
  const why: string[] = [];
  let label = "CONFORME";
  let purif = 0;
  if (OIL_SECTEURS_EXCLUS.includes(p.secteur)) { label = "NON CONFORME"; why.push("Activité principale illicite : " + p.secteur + " (exclusion sectorielle AAOIFI)."); }
  if (p.dette > 33) { label = "NON CONFORME"; why.push("Endettement porteur d'intérêt " + p.dette + "% > 33% de la capitalisation (riba)."); }
  else why.push("Endettement " + p.dette + "% ≤ 33% ✔");
  if (p.liq > 49) { label = "NON CONFORME"; why.push("Liquidités & créances " + p.liq + "% > 49% — l'actif s'apparente à de la dette négociée."); }
  else why.push("Liquidités & créances " + p.liq + "% ≤ 49% ✔");
  if (p.rnc > 5) { label = "NON CONFORME"; why.push("Revenus non conformes " + p.rnc + "% > 5% du chiffre d'affaires."); }
  else if (p.rnc > 0) { purif = p.rnc; why.push("Revenus non conformes " + p.rnc + "% ≤ 5% → purification de " + p.rnc + "% des dividendes (don caritatif)."); }
  else why.push("Aucun revenu non conforme ✔");
  if (p.structure) why.push("Structure : " + p.structure);
  return { label: label === "CONFORME" && purif > 0 ? "CONFORME · purification " + purif + "%" : label, ok: label === "CONFORME", why };
}
export const OIL_CATALOGUE: any[] = [
  { nom: "iShares MSCI World Islamic UCITS ETF", em: "BlackRock", secteur: "ETF actions screené", dette: 18, liq: 22, rnc: 1.2, fatwa: "Sharia Board iShares · 03.2026", structure: "Réplication d'indice screené MSCI Islamic" },
  { nom: "SP Funds S&P 500 Sharia Industry Exclusions ETF", em: "SP Funds / S&P DJI", secteur: "ETF actions screené", dette: 21, liq: 30, rnc: 0.8, fatwa: "S&P Shariah Supervisory Board · 01.2026", structure: "S&P 500 Shariah — exclusions sectorielles + ratios" },
  { nom: "S&P 500 ETF (non screené)", em: "générique", secteur: "ETF actions", dette: 41, liq: 38, rnc: 6.5, fatwa: null, structure: "Réplication S&P 500 intégral" },
  { nom: "Sukuk al-Ijara souverain 2029", em: "État AAA", secteur: "Sukuk", dette: 0, liq: 5, rnc: 0, fatwa: "Comité national · 06.2025", structure: "Adossé à des actifs loués (ijara) — pas de créance d'intérêt" },
  { nom: "Note capital protégé wa'd + murabaha", em: "Banque privée", secteur: "Produit structuré", dette: 12, liq: 35, rnc: 0, fatwa: null, structure: "Promesse unilatérale (wa'd) + dépôt murabaha — profil optionnel sans option conventionnelle" },
  { nom: "Obligation convertible classique", em: "corporate", secteur: "Finance conventionnelle", dette: 100, liq: 10, rnc: 100, fatwa: null, structure: "Coupon d'intérêt fixe (riba)" },
];
export const OIL_PRODUITS = ["Murabaha", "Ijara", "Sukuk", "Musharaka", "Mudaraba", "Wakala", "Takaful", "ETF Sharia", "Structuré (wa'd)"];
export const OIL_DOCS = ["Contrat maître", "Fatwa du Sharia Board", "Certificat de conformité annuel", "Rapport de purification", "Prospectus AAOIFI", "Registre des actifs sous-jacents"];
export const OIL_MATRICE: any = {};
OIL_PRODUITS.forEach(p => { OIL_MATRICE[p] = {}; OIL_DOCS.forEach(d => { OIL_MATRICE[p][d] = !((d === "Rapport de purification" && ["Murabaha", "Ijara", "Wakala", "Takaful"].includes(p)) || (d === "Registre des actifs sous-jacents" && ["Murabaha", "Wakala", "ETF Sharia"].includes(p))); }); });

// Seed du Sharia Board dans le moteur workflow (IIFE top-level de la maquette, 25011–25026).
(function () {
  WF_ENGINE.createDossier("OIL-2026-001", { sections: [
    { id: "QUANT", label: "Analyse quantitative (ratios AAOIFI)", validator: "Dr. Y. Al-Amine (Sharia analyst)" },
    { id: "SCHOL1", label: "Revue scholar — structure contractuelle", validator: "Sheikh M. Osmani" },
    { id: "SCHOL2", label: "Revue scholar — substance économique", validator: "Dr. A. El-Gamal" },
  ], finalValidator: "Président du Sharia Board" });
  WF_ENGINE.editField("Structuration produits", "OIL-2026-001", "QUANT", "ratios");
  WF_ENGINE.submitForVisa("OIL-2026-001", "QUANT");
  WF_ENGINE.grantVisa("Dr. Y. Al-Amine (Sharia analyst)", "OIL-2026-001", "QUANT");
  WF_ENGINE.editField("Structuration produits", "OIL-2026-001", "SCHOL1", "contrat wa'd");
  WF_ENGINE.submitForVisa("OIL-2026-001", "SCHOL1");
  WF_IDS.push("OIL-2026-001");
  WF_TITULAIRES["OIL-2026-001"] = "Sharia Board — Note wa'd + murabaha";
  WF_ACTEURS.push("Dr. Y. Al-Amine (Sharia analyst)", "Sheikh M. Osmani", "Dr. A. El-Gamal", "Président du Sharia Board");
})();

export function oilAdvisor(q: string) {
  const s = (q || "").toLowerCase();
  const r: string[] = [];
  if (/riba|int[eé]r[eê]t/.test(s)) r.push("Riba : tout intérêt garanti sur une dette est prohibé — remplacer par marge commerciale (murabaha), loyer (ijara) ou partage de profit (musharaka/mudaraba).");
  if (/gharar|incertitude|d[eé]riv/.test(s)) r.push("Gharar : l'incertitude excessive invalide le contrat — les dérivés spéculatifs sont exclus ; le wa'd (promesse unilatérale) permet des profils optionnels conformes.");
  if (/murabaha/.test(s)) r.push("Murabaha : achat-revente avec marge convenue — la banque doit réellement détenir l'actif, même un instant ; documenter la séquence des transferts de propriété.");
  if (/ijara/.test(s)) r.push("Ijara : location d'un actif tangible — la banque supporte les risques de propriétaire ; l'entretien structurel ne peut pas être transféré au client.");
  if (/sukuk/.test(s)) r.push("Sukuk : certificats adossés à des actifs — vérifier le true sale et le registre des sous-jacents (pas une obligation déguisée).");
  if (/purif/.test(s)) r.push("Purification : les revenus non conformes ≤ 5% sont donnés à des œuvres — calculer au prorata des dividendes, documenter dans le rapport annuel.");
  if (/etf|indice|s&p|blackrock|ishares/.test(s)) r.push("ETF : exiger un indice screené (MSCI Islamic, S&P Shariah) avec board dédié — un ETF non screené échoue aux ratios (voir Sharia Analyser).");
  if (/zakat/.test(s)) r.push("Zakat : 2,5% des actifs zakatables — la banque peut calculer et proposer le prélèvement, jamais l'imposer.");
  if (/tokenis|token|digital/.test(s)) r.push("Tokenisation : conforme si le token représente un actif tangible identifié (registre des sous-jacents) — un token de dette porteuse d'intérêt reste du riba.");
  if (!r.length) r.push("Précisez l'instrument ou le concept (murabaha, ijara, sukuk, riba, gharar, purification, ETF, zakat, tokenisation) — ou utilisez le Sharia Analyser avec les ratios du produit.");
  r.push("— L'IA éclaire, le Sharia Board décide (R44) : toute qualification passe par le workflow de validation.");
  return r;
}
