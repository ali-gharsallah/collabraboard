// Source : docs/reference/olive-demo.html 21107–21162 (+ amlHash 14678, DOC_STRUCTURES 18123,
// computeDocsByPerson 18219) — verbatim.
// Pré-onboarding : verdict rapide et sans friction, règles taguées par juridiction ; OCR simulé.
import PERSONS_DATA from "../fixtures/PERSONS_DATA.json";

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

// Source 18132–18272 (verbatim) — matrice documentaire : liste des pièces, règles, moteur.
export const DOC_LIST: string[] = [
  "Passeport / pièce d'identité",
  "Justificatif de domicile",
  "Contrat d'ouverture de compte",
  "Formulaire A (ayant droit éco.)",
  "Formulaire K (détenteur du contrôle)",
  "Formulaire S (fondation)",
  "Formulaire T (trust)",
  "Questionnaire AML / LBA",
  "Source of Wealth (SOW)",
  "Source of Funds (SOF)",
  "Déclaration PEP",
  "Consentement screening sanctions",
  "Auto-certification CRS",
  "Formulaire FATCA (W-8BEN/W-9)",
  "Extrait du registre du commerce",
  "Statuts / actes constitutifs",
  "Registre des actions",
  "Procès-verbal du conseil",
  "Procuration",
  "Trust Deed",
  "Charte de fondation",
  "États financiers",
  "Profil de transactions attendu",
];
export const DOC_RULES_DEFAULT: any[] = [
  { id: "R1", label: "Socle KYC obligatoire", desc: "Identité, domicile, ouverture, AML, PEP, screening, CRS/FATCA → obligatoires pour tout titulaire ou UBO.", on: true },
  { id: "R2", label: "Ayant droit économique (Form. A)", desc: "Formulaire A obligatoire pour tout ayant droit économique / UBO (CDB 20 art. 27).", on: true },
  { id: "R3", label: "Détenteur du contrôle (Form. K)", desc: "Formulaire K obligatoire pour l'UBO des sociétés opérationnelles non cotées (CDB 20 art. 20).", on: true },
  { id: "R4", label: "Documents corporate", desc: "Extrait RC, statuts, registre des actions, PV du conseil → obligatoires pour les structures sociétés.", on: true },
  { id: "R5", label: "Trust (Form. T)", desc: "Trust Deed et formulaire T obligatoires pour Settlor, Trustee et le compte.", on: true },
  { id: "R6", label: "Fondation (Form. S)", desc: "Charte de fondation et formulaire S obligatoires pour Fondateur, Conseil et le compte.", on: true },
  { id: "R7", label: "Origine des avoirs (EDD)", desc: "SOW et SOF obligatoires pour titulaire et UBO.", on: true },
];
// Source : docs/reference/olive-demo.html 18063-18071 — DOC_GED / gedCode (codification GED par document). Verbatim.
export const DOC_GED: any = {}; // codification GED par document (auto-générée si absente)
export function gedCode(label: string) {
  if (DOC_GED[label])
    return DOC_GED[label];
  var slug = label.normalize("NFD").replace(/[^a-zA-Z ]/g, "").split(" ").filter(Boolean).map(function (w: any) { return w[0]; }).join("").toUpperCase().slice(0, 4);
  var code = "GED-" + slug + "-" + String(Object.keys(DOC_GED).length + 1).padStart(3, "0");
  DOC_GED[label] = code;
  return code;
}
export function docRuleEval(doc: any, struct: any, role: any, rules: any) {
  var on = function (id: any) { return rules.some(function (r: any) { return r.id === id && r.on; }); };
  // ── Colonne "Compte" : documents exigés au niveau du compte / de l'entité ──
  if (role === "Compte") {
    if (on("R1") && /ouverture|AML|screening|CRS|FATCA/i.test(doc))
      return { v: "M", rule: "R1" };
    if (on("R7") && /Profil de transactions/.test(doc))
      return { v: "M", rule: "R7" };
    if (on("R4") && /registre du commerce|Statuts|Registre des actions|conseil|États financiers/i.test(doc) && ["SA", "SARL", "HOLD", "FO"].indexOf(struct.id) >= 0)
      return { v: "M", rule: "R4" };
    if (on("R5") && /Trust Deed|Formulaire T/.test(doc) && struct.id === "TRUST")
      return { v: "M", rule: "R5" };
    if (on("R6") && /Charte de fondation|Formulaire S/.test(doc) && struct.id === "FOND")
      return { v: "M", rule: "R6" };
    return { v: "O", rule: null };
  }
  // ── Colonnes personnes / relations : documents rattachés à chaque intervenant ──
  var uboish = /UBO|Ayant droit|Settlor|Fondateur/.test(role);
  var holderish = /Titulaire|UBO|Ayant droit/.test(role);
  if (on("R1") && /Passeport|domicile|Déclaration PEP/i.test(doc))
    return { v: "M", rule: "R1" };
  if (on("R2") && /Formulaire A/.test(doc) && uboish)
    return { v: "M", rule: "R2" };
  if (on("R3") && /Formulaire K/.test(doc) && /UBO/.test(role) && ["SA", "SARL", "HOLD", "FO"].indexOf(struct.id) >= 0)
    return { v: "M", rule: "R3" };
  if (on("R7") && /Source of Wealth|Source of Funds/.test(doc) && holderish)
    return { v: "M", rule: "R7" };
  if (/Procuration/.test(doc) && /Fondé de pouvoir|Signataire|mandaté/.test(role))
    return { v: "M", rule: "R1" };
  return { v: "O", rule: null };
}
// Calcule le set documentaire requis pour une structure (Compte + rôles).
export function computeRequiredDocs(structId: any, rules: any) {
  rules = rules || DOC_RULES_DEFAULT;
  var struct = DOC_STRUCTURES.find(function (s: any) { return s.id === structId; }) || DOC_STRUCTURES[0];
  var cols = ["Compte"].concat(struct.roles);
  var docs: any[] = [];
  DOC_LIST.forEach(function (doc: any) {
    var where = cols.filter(function (col: any) { return docRuleEval(doc, struct, col, rules).v === "M"; });
    if (where.length)
      docs.push({ doc: doc, where: where, account: where.indexOf("Compte") >= 0 });
  });
  return { struct: struct, cols: cols, docs: docs };
}
// Source : docs/reference/olive-demo.html 18219 — computeDocsByPerson (verbatim).
export function computeDocsByPerson(structId: any, persons?: any, rules?: any) {
  rules = rules || DOC_RULES_DEFAULT;
  var struct = DOC_STRUCTURES.find(function (x: any) { return x.id === structId; }) || DOC_STRUCTURES[0];
  // Intervenants de démonstration si non fournis : le titulaire cumule les 2 premiers
  // rôles (démontre la fusion multi-rôles), le reste est réparti.
  if (!persons) {
    persons = [];
    var rr = struct.roles.slice();
    persons.push({ name: null, roles: ["Compte"].concat(rr.slice(0, 2)) });
    rr.slice(2).forEach(function (role: any, i: number) {
      var nm = (typeof PERSONS_DATA !== "undefined" && (PERSONS_DATA as any[])[i + 3] && ((PERSONS_DATA as any[])[i + 3].name || (PERSONS_DATA as any[])[i + 3].fullName)) || ("Intervenant " + (i + 1));
      persons.push({ name: nm, roles: [role] });
    });
  }
  return persons.map(function (p: any) {
    var mand: any[] = [], opt: any[] = [];
    DOC_LIST.forEach(function (doc: any) {
      var isM = false, isO = false, via: any[] = [];
      p.roles.forEach(function (col: any) {
        var v = docRuleEval(doc, struct, col, rules).v;
        if (v === "M") {
          isM = true;
          via.push(col);
        }
        else if (v === "O") {
          isO = true;
          if (!isM)
            via.push(col);
        }
      });
      if (isM)
        mand.push({ doc: doc, via: via }); // dédup native : 1 itération par type
      else if (isO)
        opt.push({ doc: doc, via: via });
    });
    return { name: p.name, roles: p.roles, mandatory: mand, optional: opt };
  });
}
