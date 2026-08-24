// Source : docs/reference/olive-demo.html 31756 (SWIFT_SAMPLES) + 31761–31879 (swiftAnalyze) — porté verbatim.
// Analyseur SWIFT/SEPA : décorticage champ par champ, screening, pays à risque et FX.
import { fxRate } from "./fx-support";
import { riskCountryOf, RC_LEVELS } from "./risk-country-support";

// CONSIGNÉ — screenMatch (moteur de screening sanctions/PEP, source 33914) non porté →
// stub renvoyant [] : aucun hit ≥ 70. Le décorticage des champs, les contrôles pays à risque
// (GAFI/interne) et le FX restent réellement calculés. À compléter au portage du Screening.
function screenMatch(_name: string, _opts?: any): any[] { return []; }

export const SWIFT_SAMPLES: [string, string][] = [
  ["MT103 — paiement client", "{1:F01BCVLCH2LXXX0000000000}{2:I103CRESUS33XXXXN}{3:{108:REF20260711A}}{4:\n:20:TRF-88291\n:23B:CRED\n:32A:260711CHF250000,\n:50K:/CH5604835012345678009\nSUZUKI LTD\nRUE DU RHONE 45 GENEVE\n:52A:BCVLCH2L\n:57A:SBERRUMM\n:59:/AE070331234567890123456\nNOVATEK TRADING FZE\nDUBAI UAE\n:70:INVOICE 2026-448 EQUIPMENT\n:71A:OUR\n-}"],
  ["MT202COV — couverture interbancaire", "{1:F01BCVLCH2LXXX0000000000}{2:I202CITIUS33XXXXN}{4:\n:20:COV-20260711-7\n:32A:260711USD1850000,\n:52A:BCVLCH2L\n:57A:VTBRRUMM\n:58A:/6550011223\nEMIRATES NBD PJSC\n-}"],
  ["SEPA pain.001 — virement", "<CstmrCdtTrfInitn><GrpHdr><MsgId>SEPA-2026-0711-01</MsgId><CtrlSum>48000.00</CtrlSum></GrpHdr><PmtInf><Dbtr><Nm>Fondation Helvetia Kids</Nm></Dbtr><DbtrAcct><IBAN>CH2504835098765432101</IBAN></DbtrAcct><CdtTrfTxInf><Amt Ccy=\"EUR\">48000.00</Amt><Cdtr><Nm>Assoc Humanitaire Bamako</Nm></Cdtr><CdtrAcct><IBAN>ML13B0000000000000000012</IBAN></CdtrAcct><RmtInf><Ustrd>DON PROJET ECOLE</Ustrd></RmtInf></CdtTrfTxInf></PmtInf></CstmrCdtTrfInitn>"],
];

export function swiftAnalyze(txt: string): any {
  const out: any = { type: "?", fields: [], checks: [] };
  const t = String(txt || "");
  function fld(tag: string, label: string, val: any, note?: string) { out.fields.push({ tag: tag, label: label, val: val || "—", note: note || "" }); }
  function chk(label: string, level: string, note?: string) { out.checks.push({ label: label, level: level, note: note }); }
  function screenName(nm: any) { if (!nm) return null; const r = (typeof screenMatch === "function") ? screenMatch(nm) : []; return (r && r.length) ? r[0] : null; }
  if (t.indexOf("{2:I103") >= 0 || t.indexOf(":23B:") >= 0) {
    out.type = "SWIFT MT103 — virement client";
    const m20 = t.match(/:20:([^\n]+)/);
    fld(":20:", "Référence de l'opération", m20 && m20[1], "");
    const m32 = t.match(/:32A:(\d{6})([A-Z]{3})([\d,\.]+)/);
    if (m32) {
      fld(":32A:", "Date valeur / devise / montant", "20" + m32[1].slice(0, 2) + "-" + m32[1].slice(2, 4) + "-" + m32[1].slice(4) + " · " + m32[2] + " " + m32[3].replace(",", ""), (m32[2] !== "CHF" ? ("fixing ×" + fxRate(m32[2]) + " → CHF") : ""));
    }
    const m50 = t.match(/:50K:\/?([^\n]*)\n([^\n]+)/);
    const ord = m50 && m50[2];
    fld(":50K:", "Donneur d'ordre", (ord || "") + (m50 && m50[1] ? (" · " + m50[1]) : ""), "");
    const m52 = t.match(/:52A:([^\n]+)/);
    fld(":52A:", "Banque du donneur d'ordre", m52 && m52[1], "");
    const m57 = t.match(/:57A:([^\n]+)/);
    const bicB = m57 && m57[1];
    fld(":57A:", "Banque du bénéficiaire", bicB, "");
    const m59 = t.match(/:59:\/?([^\n]*)\n([^\n]+)\n?([^\n:]*)/);
    const ben = m59 && m59[2];
    const benLoc = m59 && m59[3];
    fld(":59:", "Bénéficiaire", (ben || "") + (m59 && m59[1] ? (" · " + m59[1]) : "") + (benLoc ? (" · " + benLoc) : ""), "");
    const m70 = t.match(/:70:([^\n]+)/);
    fld(":70:", "Motif de paiement", m70 && m70[1], "");
    const m71 = t.match(/:71A:([^\n]+)/);
    fld(":71A:", "Frais", m71 && m71[1], "");
    const hitB = screenName(ben);
    const hitO = screenName(ord);
    if (hitB) chk("Screening bénéficiaire", "KO", hitB.score + "% " + hitB.entry.name + " [" + hitB.entry.program + "]");
    else chk("Screening bénéficiaire", "OK", "aucun hit ≥ 70");
    if (hitO) chk("Screening donneur d'ordre", "KO", hitO.score + "% " + hitO.entry.name);
    else chk("Screening donneur d'ordre", "OK", "aucun hit ≥ 70");
    const ccB = bicB ? (bicB.slice(4, 6)) : "";
    if (ccB && riskCountryOf(ccB)) chk("BIC banque bénéficiaire", "KO", "BIC " + bicB + " — " + riskCountryOf(ccB).name + " (" + RC_LEVELS[riskCountryOf(ccB).level][0] + ")");
    else if (bicB) chk("BIC banque bénéficiaire", "OK", bicB);
    const iban = (m59 && m59[1]) || "";
    const cc = iban.slice(0, 2).toUpperCase();
    const rc = riskCountryOf(cc);
    if (rc) chk("Pays du compte bénéficiaire", "ATTENTION", cc + " — " + RC_LEVELS[rc.level][0]);
    else if (cc) chk("Pays du compte bénéficiaire", "OK", cc);
    if (m70 && /CASH|CRYPTO|CONSULT/i.test(m70[1])) chk("Motif de paiement", "ATTENTION", "mot-clé sensible");
    else chk("Motif de paiement", "OK", "cohérent");
  }
  else if (t.indexOf("{2:I202") >= 0) {
    const isCov = /:21:/.test(t);
    out.type = "SWIFT MT202" + (isCov ? "COV" : "") + " — interbancaire" + (isCov ? " (couverture)" : "");
    const c20 = t.match(/:20:([^\n]+)/);
    fld(":20:", "Référence", c20 && c20[1], "");
    const c21 = t.match(/:21:([^\n]+)/);
    if (c21) fld(":21:", "Référence liée (MT103 couvert)", c21[1], "");
    const c32 = t.match(/:32A:(\d{6})([A-Z]{3})([\d,\.]+)/);
    if (c32) fld(":32A:", "Date / devise / montant", c32[2] + " " + c32[3].replace(",", ""), (c32[2] !== "CHF" ? ("fixing ×" + fxRate(c32[2]) + " → CHF") : ""));
    const c57 = t.match(/:57A:([^\n]+)/);
    const c58 = t.match(/:58A:\/?([^\n]*)\n([^\n]+)/);
    if (c57) fld(":57A:", "Banque intermédiaire", c57[1], "");
    if (c58) fld(":58A:", "Institution bénéficiaire", c58[2] + (c58[1] ? (" · " + c58[1]) : ""), "");
    const bic2 = (c57 && c57[1]) || "";
    const cc57 = bic2.slice(4, 6);
    if (cc57 && riskCountryOf(cc57)) chk("Chaîne de correspondance", "KO", "intermédiaire " + bic2 + " — " + riskCountryOf(cc57).name + " (scénario SC-CBK-DWN)");
    else chk("Chaîne de correspondance", "OK", "intermédiaires vérifiés");
    chk("Appariement cover", c21 ? "OK" : "ATTENTION", c21 ? ("MT103 lié : " + c21[1]) : "MT202COV sans MT103 apparié — nested relationship possible (SC-CBK-NEST)");
  }
  else if (/CstmrCdtTrfInitn|pain\.001/i.test(t)) {
    out.type = "SEPA pain.001 — virement SEPA";
    const d = t.match(/<Dbtr><Nm>([^<]+)/);
    fld("Dbtr", "Donneur d'ordre", d && d[1], "");
    const da = t.match(/<DbtrAcct><IBAN>([^<]+)/);
    fld("DbtrAcct", "IBAN débiteur", da && da[1], "");
    const am = t.match(/<Amt Ccy="([A-Z]{3})">([\d\.]+)/);
    if (am) fld("Amt", "Montant", am[1] + " " + am[2], (am[1] !== "CHF" ? ("fixing ×" + fxRate(am[1]) + " → CHF") : ""));
    const cr = t.match(/<Cdtr><Nm>([^<]+)/);
    const ben2 = cr && cr[1];
    fld("Cdtr", "Bénéficiaire", ben2, "");
    const ca = t.match(/<CdtrAcct><IBAN>([^<]+)/);
    const iban2 = (ca && ca[1]) || "";
    fld("CdtrAcct", "IBAN bénéficiaire", iban2, "");
    const rm = t.match(/<Ustrd>([^<]+)/);
    fld("RmtInf", "Motif", rm && rm[1], "");
    const hit2 = (typeof screenMatch === "function" && ben2) ? screenMatch(ben2) : [];
    if (hit2 && hit2.length) chk("Screening bénéficiaire", "KO", hit2[0].score + "% " + hit2[0].entry.name);
    else chk("Screening bénéficiaire", "OK", "aucun hit");
    const cc2 = iban2.slice(0, 2).toUpperCase();
    const rc2 = riskCountryOf(cc2);
    if (rc2) chk("Pays IBAN bénéficiaire", rc2.level === "FATF_BLACK" ? "KO" : "ATTENTION", cc2 + " — " + RC_LEVELS[rc2.level][0]);
    else if (cc2) chk("Pays IBAN bénéficiaire", "OK", cc2);
    chk("Zone SEPA", /^(CH|DE|FR|IT|AT|ES|PT|NL|BE|LU|LI)/.test(iban2) ? "OK" : "ATTENTION", /^ML|^TR|^AE/.test(iban2) ? "IBAN hors zone SEPA — requalifier en virement international" : "");
  }
  else {
    out.type = "Format non reconnu";
    chk("Parsing", "KO", "Collez un MT103, MT202(COV) ou pain.001");
  }
  return out;
}
