import CLIENTS from "../fixtures/CLIENTS.json";
import { kycsByClientId } from "./components-data";
import { amlHash } from "./preonboarding-support";
import { pmsEnrich } from "./pms-support";
import { pushParamAudit } from "./param-audit-support";

// Source : docs/reference/olive-demo.html 32732-32812 — Reporting réglementaire (CRS/FATCA/goAML/esisuisse/échéancier).
// Générateurs XML (schémas OCDE simplifiés) + éligibilités calculées sur le portefeuille réel. Porté verbatim.

export const CRS_PARTNERS: any = { FR: "France", DE: "Allemagne", GB: "Royaume-Uni", IT: "Italie", ES: "Espagne", BR: "Brésil", SG: "Singapour", HK: "Hong Kong", AE: "Émirats arabes unis", JP: "Japon", TR: "Turquie", MX: "Mexique", CN: "Chine", RU: "—" };
export function crsReportable(): any {
  const by: any = {};
  (CLIENTS as any[]).forEach(function (c) {
    if (c.countryCode === "CH" || c.countryCode === "US")
      return;
    if (!CRS_PARTNERS[c.countryCode])
      return;
    const k = (kycsByClientId[c.id] || []).slice(-1)[0] || {};
    (by[c.countryCode] = by[c.countryCode] || []).push({ c: c, k: k, selfCert: (k.totalPct || 0) >= 60, tin: "TIN-" + c.countryCode + "-" + String(1000 + amlHash(c.id + "TIN", 9000)) });
  });
  return by;
}
export function fatcaReportable(): any[] {
  return (CLIENTS as any[]).filter(function (c) { return c.countryCode === "US" || (c.tags || []).indexOf("FATCA") >= 0; }).map(function (c) {
    const k = (kycsByClientId[c.id] || []).slice(-1)[0] || {};
    const w9 = amlHash(c.id + "W9", 10) < 8;
    return { c: c, k: k, form: w9 ? "W-9" : "W-8BEN-E", giin: "GIIN-98Q" + String(100 + amlHash(c.id + "GN", 900)) + ".00000.LE.756", status: w9 ? "Documenté" : "À collecter" };
  });
}
function xferXmlEsc(v: any) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
export function crsXml(cc: any, rows: any[]) {
  const L = ['<?xml version="1.0" encoding="UTF-8"?>'];
  L.push('<crs:CRS_OECD xmlns:crs="urn:oecd:ties:crs:v2" version="2.0">');
  L.push('  <crs:MessageSpec><crs:SendingCompanyIN>CHE-OLIVE-756</crs:SendingCompanyIN><crs:TransmittingCountry>CH</crs:TransmittingCountry><crs:ReceivingCountry>' + cc + '</crs:ReceivingCountry><crs:MessageType>CRS</crs:MessageType><crs:ReportingPeriod>2025-12-31</crs:ReportingPeriod></crs:MessageSpec>');
  rows.forEach(function (r) {
    L.push('  <crs:AccountReport>');
    L.push('    <crs:AccountHolder><crs:Name>' + xferXmlEsc(r.c.name) + '</crs:Name><crs:ResCountryCode>' + cc + '</crs:ResCountryCode><crs:TIN>' + r.tin + '</crs:TIN><crs:Type>' + xferXmlEsc(r.c.typeLabel || "") + '</crs:Type></crs:AccountHolder>');
    L.push('    <crs:AccountBalance currCode="CHF">' + xferXmlEsc(r.c.aum || "0") + '</crs:AccountBalance>');
    L.push('    <crs:DocStatus>' + (r.selfCert ? "SELF_CERT_OK" : "SELF_CERT_MISSING") + '</crs:DocStatus>');
    L.push('  </crs:AccountReport>');
  });
  L.push('</crs:CRS_OECD>');
  return L.join("\n");
}
export function fatcaXml(rows: any[]) {
  const L = ['<?xml version="1.0" encoding="UTF-8"?>'];
  L.push('<ftc:FATCA_OECD xmlns:ftc="urn:oecd:ties:fatca:v2" version="2.0">');
  L.push('  <ftc:MessageSpec><ftc:SendingCompanyIN>CHE-OLIVE-756</ftc:SendingCompanyIN><ftc:TransmittingCountry>CH</ftc:TransmittingCountry><ftc:ReceivingCountry>US</ftc:ReceivingCountry><ftc:MessageType>FATCA</ftc:MessageType><ftc:ReportingPeriod>2025-12-31</ftc:ReportingPeriod></ftc:MessageSpec>');
  rows.forEach(function (r) {
    L.push('  <ftc:AccountReport><ftc:AccountHolder><ftc:Name>' + xferXmlEsc(r.c.name) + '</ftc:Name><ftc:Form>' + r.form + '</ftc:Form><ftc:GIIN>' + r.giin + '</ftc:GIIN></ftc:AccountHolder><ftc:AccountBalance currCode="CHF">' + xferXmlEsc(r.c.aum || "0") + '</ftc:AccountBalance></ftc:AccountReport>');
  });
  L.push('</ftc:FATCA_OECD>');
  return L.join("\n");
}
export function regDownloadXml(name: string, xml: string, user: any, what: string) {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  pushParamAudit((user && user.name) || "—", "Reporting réglementaire — " + what + " généré et téléchargé (" + name + ")");
}
export const REG_DEADLINES: any[] = [
  { date: "2026-01-31", label: "Statistiques BNS — situation annuelle", org: "BNS", done: true },
  { date: "2026-03-31", label: "FATCA — transmission 8966 via IDES (données 2025)", org: "IRS", done: true },
  { date: "2026-04-30", label: "Rapport annuel LBA à la Direction", org: "Interne / FINMA", done: true },
  { date: "2026-06-30", label: "CRS / EAR — transmission AFC (données 2025)", org: "AFC → OCDE", done: true },
  { date: "2026-09-30", label: "Reporting prudentiel semestriel", org: "FINMA", done: false },
  { date: "2027-03-31", label: "FATCA — transmission 8966 (données 2026)", org: "IRS", done: false },
  { date: "2027-06-30", label: "CRS / EAR — transmission AFC (données 2026)", org: "AFC → OCDE", done: false },
];
export function sarGoamlXml(r: any) {
  const L = ['<?xml version="1.0" encoding="UTF-8"?>', '<report xmlns="urn:goaml:4.0">',
    '  <rentity_id>OLIVE-CH-001</rentity_id>', '  <submission_code>E</submission_code>', '  <report_code>STR</report_code>',
    '  <submission_date>2026-07-11</submission_date>', '  <currency_code_local>CHF</currency_code_local>',
    '  <reporting_person><first_name>Nadia</first_name><last_name>Keller</last_name><title>MLRO</title></reporting_person>',
    '  <transaction>', '    <transactionnumber>' + (r.ref || "—") + '</transactionnumber>',
    '    <involved_subject><name>' + ((r.clientName || "—").replace(/&/g, "&amp;")) + '</name></involved_subject>',
    '    <reason>' + ((r.summary || r.motif || "Soupçon fondé art. 9 LBA — voir annexe").replace(/&/g, "&amp;")) + '</reason>', '  </transaction>', '</report>'];
  return L.join("\n");
}
export function esisuisseView(): any[] {
  return (CLIENTS as any[]).map(function (c) {
    const e = pmsEnrich(c);
    const dep = Math.round(e.cash + amlHash(c.id + "DEP", 180000)); // dépôts en compte (cash mandat + comptes courants)
    const covered = Math.min(100000, dep);
    return { c: c, dep: dep, covered: covered, uncovered: dep - covered };
  }).sort(function (a, b) { return b.dep - a.dep; });
}
export const REG_PRODUCTION: any = { CRS: { status: "PRÉPARÉ", by: null }, FATCA: { status: "PRÉPARÉ", by: null } };
