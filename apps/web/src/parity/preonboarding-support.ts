// Source : docs/reference/olive-demo.html 21107–21162 (+ amlHash 14678, DOC_STRUCTURES 18123) — verbatim.
// Pré-onboarding : verdict rapide et sans friction, règles taguées par juridiction ; OCR simulé.

export function amlHash(str: string, mod: number) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h % mod;
}

const PRE_ONBOARD_SANCTIONED = ["KP", "IR", "SY", "CU"];
const PRE_ONBOARD_FATF_GREY = ["KY", "PA", "MC"];
export const PRE_ONBOARD_RULES: any[] = [
  { id: "PRE1", jurisdiction: "International", active: true, severity: "BLOCK",
    test: function (p: any) { return PRE_ONBOARD_SANCTIONED.indexOf(p.countryCode) >= 0; },
    message: "Pays sous sanctions internationales (ONU/UE/OFAC).",
    action: "Vérifier les listes de sanctions avant tout contact commercial — entrée en relation interdite en l'état." },
  { id: "PRE2", jurisdiction: "FINMA", active: true, severity: "CONDITIONAL",
    test: function (p: any) { return /crypto|actifs numériques|digital assets/i.test(p.sector || ""); },
    message: "Secteur crypto-actifs / actifs numériques.",
    action: "Due diligence sectorielle renforcée (EDD) requise avant ouverture — cf. Guide pratique FINMA valeurs patrimoniales virtuelles." },
  { id: "PRE3", jurisdiction: "UE (5AMLD)", active: true, severity: "CONDITIONAL",
    test: function (p: any) { return !!p.pep; },
    message: "Client identifié comme personne politiquement exposée (PEP).",
    action: "EDD renforcée + approbation senior management dès l'entrée en relation (5e directive anti-blanchiment UE)." },
  { id: "PRE4", jurisdiction: "International (GAFI)", active: true, severity: "CONDITIONAL",
    test: function (p: any) { return PRE_ONBOARD_FATF_GREY.indexOf(p.countryCode) >= 0; },
    message: "Juridiction sous surveillance renforcée / faible transparence fiscale.",
    action: "Vérifier la substance économique réelle et documenter la chaîne UBO complète avant ouverture." },
  { id: "PRE5", jurisdiction: "Interne", active: true, severity: "CONDITIONAL",
    test: function (p: any) { return ["TRUST", "HOLD", "FOND"].indexOf(p.type) >= 0; },
    message: "Structure complexe (trust / holding / fondation).",
    action: "UBO final doit être pré-identifié et documenté avant l'ouverture du dossier KYC." },
  { id: "PRE6", jurisdiction: "Interne", active: true, severity: "CONDITIONAL",
    test: function (p: any) { return /négoce|retail|distribution/i.test(p.sector || ""); },
    message: "Secteur à composante cash-intensive.",
    action: "Documenter le circuit de paiement attendu ; surveillance transactionnelle renforcée dès l'ouverture." },
  { id: "PRE7", jurisdiction: "FINMA", active: true, severity: "CONDITIONAL",
    test: function (p: any) { return (p.aumM || 0) > 0 && p.aumM < 0.25; },
    message: "AUM estimé sous le seuil minimum de segment (CHF 250k).",
    action: "Dérogation segment à valider avec un RM senior avant ouverture, ou orienter vers l'offre Mass Affluent." },
];
export function runPreOnboardingCheck(pseudo: any) {
  const hits = PRE_ONBOARD_RULES.filter(function (r) { return r.active && r.test(pseudo); });
  const blocking = hits.filter(function (r) { return r.severity === "BLOCK"; });
  const conditional = hits.filter(function (r) { return r.severity === "CONDITIONAL"; });
  const verdict = blocking.length ? "BLOCKED" : (conditional.length ? "CONDITIONAL" : "OK");
  return { verdict, blocking, conditional, hits };
}
// -- OCR (simulation) : extraction déterministe de champs plausibles (amlHash). --
export function ocrExtract(docType: string, existingName: string) {
  const samples: Record<string, [string, string][]> = {
    "Passeport": [["Elena Petrova", "RU"], ["Marco Rossi", "IT"], ["Fatima Al-Nouri", "AE"], ["Hans Gruber", "DE"]],
    "Carte d'identité": [["Julien Moreau", "FR"], ["Sofia Keller", "CH"], ["Liam O'Connor", "GB"]],
    "Registre du commerce": [["Alpine Ventures SA", "CH"], ["Riviera Trading Ltd", "FR"], ["Nordic Capital GmbH", "DE"]],
    "Justificatif de domicile": [["—", "CH"]],
  };
  const pool = samples[docType] || samples["Passeport"];
  const idx = amlHash((existingName || docType) + "|ocr", pool.length);
  const pick = pool[idx];
  const isCorp = docType === "Registre du commerce";
  return { name: existingName || pick[0], countryCode: pick[1], type: isCorp ? "SA" : "PP" };
}

export const DOC_STRUCTURES: any[] = [
  { id: "PP", name: "Personne physique", roles: ["Titulaire", "Ayant droit éco.", "Fondé de pouvoir"] },
  { id: "SA", name: "Société SA/AG", roles: ["Titulaire", "UBO", "Administrateur", "Actionnaire", "Signataire"] },
  { id: "SARL", name: "SARL/GmbH", roles: ["Titulaire", "UBO", "Gérant", "Associé"] },
  { id: "HOLD", name: "Holding", roles: ["Titulaire", "UBO", "Administrateur"] },
  { id: "TRUST", name: "Trust", roles: ["Settlor", "Trustee", "Bénéficiaire", "Protecteur"] },
  { id: "FOND", name: "Fondation", roles: ["Fondateur", "Conseil", "Bénéficiaire"] },
  { id: "FO", name: "Family Office", roles: ["Titulaire", "UBO", "Gérant mandaté"] },
];
