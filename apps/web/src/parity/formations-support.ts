// Source : docs/reference/olive-demo.html 29394–29470 — porté verbatim.
// Formations & habilitations LBA (MOD-43) : certifications par collaborateur, suspension
// automatique si certification échue, contrôles de cohérence certification × activité tracée.
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import ACCOUNT_REVIEWS_DATA from "../fixtures/ACCOUNT_REVIEWS_DATA.json";
import { amlHash } from "./preonboarding-support";
import { PARAM_AUDIT, pushParamAudit } from "./param-audit-support";

// CONSIGNÉ — MROS_REPORTS (déclarations MROS) → [] : identique à la source (var MROS_REPORTS = []).
// Le contrôle de cohérence goAML ne se déclenche donc pas ; tous les autres croisements
// (piste d'audit, KYC assignés, revues) restent réellement calculés.
const MROS_REPORTS: any[] = [];

export const CERT_CATALOG: any[] = [
  { code: "LBA-INIT", label: "Formation LBA initiale", years: 99 },
  { code: "LBA-REC", label: "Recyclage LBA annuel", years: 1 },
  { code: "CDB20", label: "Certification CDB 20", years: 2 },
  { code: "LSFIN", label: "LSFin — profil investisseur", years: 2 },
  { code: "GOAML", label: "MROS / goAML", years: 2 },
];
export const STAFF_DATA: any[] = [
  { name: "Isabelle Vernet", role: "CO_SR", certs: ["LBA-INIT", "LBA-REC", "CDB20", "GOAML"] },
  { name: "Marc Dubois", role: "CO", certs: ["LBA-INIT", "LBA-REC", "CDB20"] },
  { name: "Sarah Zimmermann", role: "CO", certs: ["LBA-INIT", "LBA-REC", "CDB20"] },
  { name: "Paul Meier", role: "CO", certs: ["LBA-INIT", "LBA-REC", "CDB20"] },
  { name: "Nadia Keller", role: "MLRO", certs: ["LBA-INIT", "LBA-REC", "CDB20", "GOAML"] },
  { name: "Thomas Brunner", role: "HPB", certs: ["LBA-INIT", "LBA-REC"] },
  { name: "Ming Chen", role: "RM", certs: ["LBA-INIT", "LBA-REC", "LSFIN"] },
  { name: "Ralf Kessler", role: "RM", certs: ["LBA-INIT", "LBA-REC", "LSFIN"] },
  { name: "Lucie Morel", role: "RM", certs: ["LBA-INIT", "LBA-REC", "LSFIN"] },
  { name: "Sophie Berger", role: "RM", certs: ["LBA-INIT", "LBA-REC", "LSFIN"] },
  { name: "Valentina Rossi", role: "RM", certs: ["LBA-INIT", "LBA-REC", "LSFIN"] },
  { name: "Patrick Durand", role: "RM", certs: ["LBA-INIT", "LBA-REC", "LSFIN"] },
  { name: "Jean-Paul Favre", role: "RM", certs: ["LBA-INIT", "LBA-REC", "LSFIN"] },
  { name: "Ali Gharsallah", role: "RM", certs: ["LBA-INIT", "LBA-REC", "LSFIN"] },
  { name: "Sixtine Marchand", role: "RM", certs: ["LBA-INIT", "LBA-REC", "LSFIN"] },
];
export const STAFF_HABS: any = {
  RM: ["Saisie & complétion KYC", "Contact client / collecte documentaire"],
  CO: ["Visa de section KYC", "Qualification des hits de screening", "Revue périodique (Account Review)"],
  CO_SR: ["Visa de section KYC", "Qualification des hits de screening", "Validation MROS", "Approbation Intelligence Studio"],
  MLRO: ["Transmission MROS (goAML)", "Décision de blocage art. 10 LBA"],
  HPB: ["Visa d'approbation finale"],
};
const CERT_OVERRIDES: any = {};
export function staffCert(p: any, code: string): any {
  const ov = CERT_OVERRIDES[p.name + "|" + code];
  if (ov)
    return { code: code, label: (CERT_CATALOG.find(function (c) { return c.code === code; }) || {}).label, expiresAt: ov, status: "À JOUR", renewed: true };
  const cat: any = CERT_CATALOG.find(function (c) { return c.code === code; }) || {};
  if (cat.years === 99)
    return { code: code, label: cat.label, expiresAt: "—", status: "À JOUR" };
  const h = amlHash(p.name + "|" + code, 100);
  const st = h < 16 ? "ÉCHU" : h < 34 ? "ÉCHÉANCE" : "À JOUR";
  const exp = st === "ÉCHU" ? ("2026-0" + (1 + h % 5) + "-" + String(10 + h % 18).padStart(2, "0")) : st === "ÉCHÉANCE" ? ("2026-0" + (8 + h % 2) + "-" + String(10 + h % 18).padStart(2, "0")) : ("2027-0" + (1 + h % 9) + "-" + String(10 + h % 18).padStart(2, "0"));
  return { code: code, label: cat.label, expiresAt: exp, status: st };
}
export function staffProfile(p: any): any {
  const certs = p.certs.map(function (c: string) { return staffCert(p, c); });
  const expired = certs.filter(function (c: any) { return c.status === "ÉCHU"; });
  const soon = certs.filter(function (c: any) { return c.status === "ÉCHÉANCE"; });
  return { p: p, certs: certs, expired: expired, soon: soon, suspended: expired.length > 0, habs: STAFF_HABS[p.role] || [] };
}
export function renewCert(p: any, code: string, user: any) {
  CERT_OVERRIDES[p.name + "|" + code] = "2027-07-11";
  pushParamAudit((user && user.name) || "—", "Formations — recyclage enregistré : " + p.name + " · " + code + " (validité au 2027-07-11) — habilitations réévaluées");
}
export function trainingCrossChecks(): any[] {
  const out: any[] = [];
  STAFF_DATA.map(staffProfile).forEach(function (sp: any) {
    if (!sp.suspended)
      return;
    const name = sp.p.name;
    const acts = PARAM_AUDIT.filter(function (e) { return e.by === name; }).length;
    if (acts > 0)
      out.push({ sev: "HIGH", who: name, what: acts + " action(s) tracée(s) dans la piste d'audit alors que " + sp.expired.map(function (c: any) { return c.code; }).join(", ") + " est échu — actes à revalider" });
    const kycs = (KYCS_DATA as any[]).filter(function (k) { return k.co === name; }).length;
    if (kycs > 0)
      out.push({ sev: "MEDIUM", who: name, what: kycs + " dossier(s) KYC assigné(s) comme CO avec certification échue — réassignation ou recyclage requis" });
    const revs = (ACCOUNT_REVIEWS_DATA as any[]).filter(function (a) { return String(a.reviewer || "").indexOf(name) >= 0 && a.status !== "COMPLETED"; }).length;
    if (revs > 0)
      out.push({ sev: "MEDIUM", who: name, what: revs + " revue(s) périodique(s) en cours attribuée(s) — à réattribuer tant que le recyclage n'est pas fait" });
    if (typeof MROS_REPORTS !== "undefined") {
      const mros = MROS_REPORTS.filter(function (r) { return r.submittedBy === name; }).length;
      if (mros > 0 && sp.expired.some(function (c: any) { return c.code === "GOAML" || c.code === "LBA-REC"; }))
        out.push({ sev: "HIGH", who: name, what: mros + " déclaration(s) MROS transmise(s) — habilitation goAML à revalider immédiatement" });
    }
  });
  return out;
}
