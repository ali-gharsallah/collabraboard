import { QUESTIONS_TEMPLATE } from "./kyc-detail-data";

// Source : docs/reference/olive-demo.html 24568-24632 (anatomie R78) + 21766-21793 (sections KYC/AR/GAR) +
// 24736-24773 (champs & droits). Porté verbatim.

// ── Anatomie d'une section (R78) : questionnaire + droits + owner + validateur + échange ──
export const WF_SECTION_PHASES = ["Saisie RM", "Revue Compliance", "Clarifications AML", "Validation comité", "Approbation finale"];
export const WF_SECTION_RIGHTS: [string, string][] = [["HIDDEN", "Masqué"], ["VIEW", "Lecture"], ["EDIT", "Écriture"], ["REQUIRED", "Requis"]];
// Droits par rôle : Masqué exclusif ; Lecture/Écriture/Requis cumulables (multi-sélection).
export function sdRights(v: any) { return Array.isArray(v) ? v : (v ? [v] : []); }
export function sdToggleRight(sec: any, r: any, code: any) {
  var cur = sdRights(sec.droits[r]).slice();
  if (code === "HIDDEN") {
    sec.droits[r] = ["HIDDEN"];
    return;
  }
  cur = cur.filter(function (x: any) { return x !== "HIDDEN"; });
  var i = cur.indexOf(code);
  if (i >= 0) {
    cur.splice(i, 1);
    if (cur.length === 0)
      cur = [code];
  }
  else
    cur.push(code);
  sec.droits[r] = cur;
}
export const WF_SD_KEYROLES = ["RM", "CO", "CO Senior", "AML", "ESG", "Legal", "BRM", "Central File"];
export const WF_RIGHT_C: any = { HIDDEN: "#8A94A6", VIEW: "#C9A227", EDIT: "#5A7D3A", REQUIRED: "#B4491F" };
export function sdEnsureAnatomy(sec: any) {
  if (sec.owner === undefined)
    sec.owner = "RM";
  if (sec.wfPhase === undefined)
    sec.wfPhase = WF_SECTION_PHASES[0];
  if (sec.exchange === undefined)
    sec.exchange = true;
  if (sec.droits === undefined) {
    sec.droits = {};
    WF_SD_KEYROLES.forEach(function (r) {
      sec.droits[r] = (r === sec.owner ? ["EDIT"] : (r === sec.val ? ["REQUIRED"] : ["VIEW"]));
    });
  }
  return sec;
}
export const WF_SD_KINDS: any = {
  KYC: { titre: "KYC — Section Designer", note: "Visa par section (R1), rôle nommé (R2), remplaçant (R4)." },
  AR: { titre: "Account Review — Section Designer", note: "Même mécanique de visas, contenu de revue périodique (R24)." },
  GAR: { titre: "Grouped Account Review — Section Designer", note: "Revue groupée : comptes liés, vue consolidée, décision de groupe." }
};

// ── Sections paramétrables par type de revue ──
export const WF_AR_SECTIONS_PARAM: any[] = [
  { code: "KYCREF", label: "1. Rafraîchissement KYC & données client", visa: true, val: "ARM", sup: "CO" },
  { code: "TX", label: "2. Transactions de la période", visa: true, val: "CO", sup: "Resp. AML (MLRO)" },
  { code: "SCREEN", label: "3. Re-screening (sanctions, PEP, adverse media)", visa: true, val: "Resp. AML (MLRO)", sup: "CO Senior" },
  { code: "DOCS", label: "4. Documents expirés / à renouveler", visa: true, val: "Central File", sup: "CO" },
  { code: "RISK", label: "5. Re-scoring du profil de risque", visa: true, val: "BRM", sup: "CO Senior" },
  { code: "DECIDE", label: "6. Recommandation & décision de revue", visa: true, val: "CO Senior", sup: "Head of PB" }
];
export const WF_GAR_SECTIONS_PARAM: any[] = [
  { code: "SCOPE", label: "1. Périmètre du groupe — comptes & entités liés", visa: true, val: "CO", sup: "CO Senior" },
  { code: "CONSO", label: "2. Vue consolidée des avoirs & flux", visa: true, val: "CO", sup: "BRM" },
  { code: "INTRA", label: "3. Cohérence intra-groupe (flux croisés)", visa: true, val: "Resp. AML (MLRO)", sup: "CO Senior" },
  { code: "UBO", label: "4. UBO & structure de contrôle commune", visa: true, val: "CO Senior", sup: "Legal" },
  { code: "DECIDE", label: "5. Décision de groupe", visa: true, val: "Head of PB", sup: "CEO" }
];
export const WF_KYC_ROLES = ["ARM", "CO", "CO Senior", "Resp. AML (MLRO)", "BRM", "Legal", "ESG Officer", "Central File", "Head of PB", "CEO"];
export const WF_KYC_SECTIONS_PARAM: any[] = [
  { code: "IDENT", label: "1. Identité du client", visa: true, val: "ARM", sup: "CO" },
  { code: "UBO", label: "2. Ayants droit & contrôle", visa: true, val: "CO", sup: "CO Senior" },
  { code: "LIEES", label: "3. Personnes liées", visa: false, val: "ARM", sup: "CO" },
  { code: "REL", label: "4. Relation d’affaires", visa: true, val: "ARM", sup: "CO" },
  { code: "SOF", label: "5. Origine fonds & fortune", visa: true, val: "CO", sup: "CO Senior" },
  { code: "SCREEN", label: "6. Screening", visa: true, val: "Resp. AML (MLRO)", sup: "CO Senior" },
  { code: "RISK", label: "7. Profil de risque", visa: true, val: "BRM", sup: "CO Senior" },
  { code: "AML", label: "8. AML / LBA", visa: true, val: "Resp. AML (MLRO)", sup: "CO Senior" },
  { code: "FISC", label: "9. Fiscalité", visa: true, val: "CO", sup: "Legal" },
  { code: "XB", label: "10. Cross-border", visa: true, val: "Legal", sup: "CO Senior" },
  { code: "ESG", label: "11. ESG", visa: false, val: "ESG Officer", sup: "CO" },
  { code: "DOCS", label: "12. Documents (CDB)", visa: true, val: "Central File", sup: "CO" },
  { code: "FINAL", label: "13. Workflow & validation", visa: true, val: "Head of PB", sup: "CEO" }
];

// ── Champs & droits (paramfields) : défauts par section, alimentés des vrais champs KYC production ──
export const WF_FIELD_DEFAULTS: any = {
  "KYC/IDENT": ["Dénomination légale", "Forme juridique", "Pays d'incorporation", "N° de registre"],
  "KYC/UBO": ["UBO — nom", "% détention", "Formulaire A/K", "Chaîne de contrôle"],
  "KYC/SOF": ["Source des fonds", "Source de la fortune", "Justificatifs", "Cohérence patrimoniale"],
  "KYC/SCREEN": ["Hits sanctions", "Statut PEP", "Adverse media", "Qualification des hits"],
  "KYC/FISC": ["Résidence fiscale", "TIN", "Statut FATCA", "Auto-certification CRS"],
  "AR/TX": ["Volume période", "Transactions atypiques", "Cohérence avec profil", "Commentaire CO"],
  "GAR/CONSO": ["Avoirs consolidés", "Flux intra-groupe", "Écarts détectés", "Commentaire"]
};
// Les défauts KYC reflètent les VRAIS champs des écrans production (une seule vérité, R-Q)
export const WF_PROD_SEC2PARAM: any = { identity: "IDENT", ubo: "UBO", sofsow: "SOF", screening: "SCREEN", tax: "FISC" };
try {
  Object.entries(WF_PROD_SEC2PARAM).forEach(function (e: any) {
    var s = e[0], c = e[1];
    if (typeof QUESTIONS_TEMPLATE !== "undefined" && (QUESTIONS_TEMPLATE as any)[s])
      WF_FIELD_DEFAULTS["KYC/" + c] = (QUESTIONS_TEMPLATE as any)[s].map(function (q: any) { return q.q; });
  });
}
catch (_) { }
export const WF_FIELDS: any = {};
export function wfChamps(ctx: any, code: any) {
  const k = ctx + "/" + code;
  if (!WF_FIELDS[k])
    WF_FIELDS[k] = (WF_FIELD_DEFAULTS[k] || ["Synthèse", "Justificatif", "Commentaire", "Décision"])
      .map(function (n: any) { return { name: n, mode: "RW" }; });
  return WF_FIELDS[k];
}
export const WF_MODES: [string, string][] = [["OFF", "Désactivé"], ["READ", "Lecture"], ["RW", "Lecture & écriture"]];
