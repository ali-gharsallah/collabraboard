// Source : docs/reference/olive-demo.html 29756–29832 — porté verbatim.
// Moteur Transferts & ordres : contrôles pré-exécution + création d'ordre. Partagé par Mobile
// Banking, Transferts & ordres, Settlement et le bouton rééquilibrage PMS.
import CLIENTS from "../fixtures/CLIENTS.json";
import { T } from "./tokens";
import { kycsByClientId } from "./components-data";

// CONSIGNÉ — moteurs non encore portés → stubs neutres (aucun blocage ajouté) :
//  · screenMatch (Screening sanctions/PEP) → [] (aucune correspondance).
//  · AML_ALERTS / MROS_REPORTS → [] (aucune alerte / communication).
//  · TX_DATA (monitoring transactionnel) → [] : un ordre exécuté y est poussé (idem aml.ts).
//  · wfEmit (event-sourcing paramétrage) → no-op.
// cbCountry (Cross-Border) : porté (cross-border-support) — consignation levée.
// À rebrancher au portage des modules Screening / AML / MROS.
import { PARAM_AUDIT, pushParamAudit } from "./param-audit-support";
import { cbCountry } from "./cross-border-support";
function screenMatch(_name: string, _opts?: any): any[] { return []; }
const AML_ALERTS: any[] = [];
const MROS_REPORTS: any[] = [];
const TX_DATA: any[] = [];
function wfEmit(_t: string, _d: any, _p: any) {}

export const XFER_CC_CITY: any = { US: "New York", GB: "Londres", FR: "Paris", DE: "Francfort", AE: "Dubaï", PA: "Panama", KY: "Cayman", BS: "Nassau", TR: "Istanbul", HK: "Hong Kong", SG: "Singapour", LU: "Luxembourg", MC: "Monaco", LI: "Vaduz", SA: "Riyad", QA: "Doha", IN: "Mumbai", JP: "Tokyo", CH: "Zürich", IT: "Milan", ES: "Madrid" };
export const XFER_STATUS_META: any = { PENDING_APPROVAL: ["En attente de validation", T.amber, "amberSoft"], EXECUTED: ["Exécuté", T.green, "greenSoft"], BLOCKED: ["Bloqué — contrôle", T.red, "redSoft"], REJECTED: ["Rejeté", T.inkSoft, "lineSoft"] };

export const TRANSFER_ORDERS: any[] = [];
let TRANSFER_SEQ = 71000;
const XFER_SANCTIONED = ["RU", "IR", "KP", "SY", "BY"];
const XFER_SENSITIVE = ["AE", "PA", "KY", "BS", "TR", "HK", "VG"];
function xferParseM(a: any) { const m = String(a || "").match(/([\d.]+)\s*M/i); return m ? parseFloat(m[1]) : 1; }

export function transferControls(o: any) {
  const checks: any[] = [];
  const ok = function (l: string, n: string) { checks.push({ ok: true, level: "OK", label: l, note: n }); };
  const cond = function (l: string, n: string) { checks.push({ ok: true, level: "COND", label: l, note: n }); };
  const ko = function (l: string, n: string) { checks.push({ ok: false, level: "KO", label: l, note: n }); };
  const c: any = (CLIENTS as any[]).find(function (x) { return x.id === o.clientId; }) || {};
  const k: any = ((kycsByClientId as any)[o.clientId] || []).slice(-1)[0] || {};
  // 1. Pays de destination
  if (XFER_SANCTIONED.indexOf(o.destCC) >= 0)
    ko("Sanctions — pays de destination", "Destination sous sanctions (" + o.destCC + ") — exécution interdite, gel le cas échéant (art. 10 LBA / SECO)");
  else if (XFER_SENSITIVE.indexOf(o.destCC) >= 0)
    cond("Pays de destination", "Corridor sensible (" + o.destCC + ") — documentation du motif économique requise");
  else
    ok("Pays de destination", "Corridor standard (" + o.destCC + ")");
  // 2. Screening du bénéficiaire
  const bm = screenMatch(o.beneficiary, { limit: 1, min: 70 })[0];
  if (bm && bm.score >= 85)
    ko("Screening bénéficiaire", "Correspondance " + bm.score + "% avec " + bm.entry.name + " [" + bm.entry.program + " · " + bm.entry.ref + "] — qualification humaine obligatoire avant toute exécution");
  else if (bm)
    cond("Screening bénéficiaire", "Correspondance partielle " + bm.score + "% avec " + bm.entry.name + " (" + bm.entry.ref + ") — vérifier l'identité du bénéficiaire");
  else
    ok("Screening bénéficiaire", "OFAC / SECO / UE / ONU : aucune correspondance (moteur de noms, listes du 2026-07-10)");
  // 3. Plausibilité économique
  const aum = xferParseM(c.aum);
  const pctAum = aum > 0 ? Math.round(o.amt / aum * 1000) / 10 : 0;
  if (pctAum > 20)
    cond("Plausibilité économique", "Montant = " + pctAum + "% des avoirs (" + (c.aum || "—") + ") — justificatif à joindre au dossier (art. 6 LBA)");
  else
    ok("Plausibilité économique", "Montant = " + pctAum + "% des avoirs — cohérent avec le profil");
  // 4. État du dossier client
  if (k.status !== "APPROVED")
    cond("Dossier KYC", "Dossier " + (k.status || "—") + " — exécution possible, régularisation à suivre");
  else
    ok("Dossier KYC", "KYC " + k.code + " approuvé");
  const alNew = AML_ALERTS.filter(function (a) { return a.clientId === o.clientId && a.status === "NEW"; }).length;
  if (alNew > 0)
    cond("Alertes AML ouvertes", alNew + " alerte(s) NEW sur la relation — visa Compliance requis sur l'ordre");
  else
    ok("Alertes AML ouvertes", "Aucune alerte ouverte");
  // 5. Relation sous communication MROS — art. 9a
  const mros = MROS_REPORTS.filter(function (r) { return r.clientId === o.clientId && r.status !== "DRAFT"; }).length;
  if (mros > 0)
    cond("Communication MROS (art. 9a LBA)", "Relation sous communication — exécution des ordres poursuivie SANS informer le client, traçabilité renforcée");
  else
    ok("Communication MROS (art. 9a LBA)", "Aucune communication en cours");
  // 6. Cross-border — réception d'ordres depuis le pays du client
  const cb = cbCountry(c.countryCode);
  if (cb && cb.rules.ORDER[0] === "NON")
    cond("Cross-border — réception d'ordres", "Depuis " + cb.country + " : uniquement ordre non sollicité initié par le client — à documenter");
  else if (cb && cb.rules.ORDER[0] === "COND")
    cond("Cross-border — réception d'ordres", cb.rules.ORDER[1] || "Sous conditions");
  else
    ok("Cross-border — réception d'ordres", "Sans restriction");
  const kos = checks.filter(function (x) { return !x.ok; }).length;
  const conds = checks.filter(function (x) { return x.level === "COND"; }).length;
  const verdict = kos > 0 ? "BLOCK" : conds > 0 ? "WARN" : "PASS";
  return { checks, verdict, kos, conds };
}
export function transferCreate(f: any, user: any) {
  const c: any = (CLIENTS as any[]).find(function (x) { return x.id === f.clientId; }) || {};
  const o: any = { id: "ORD-" + (++TRANSFER_SEQ), createdAt: "2026-07-11", createdBy: (user && user.name) || "—",
    clientId: f.clientId, clientName: c.name || "—", beneficiary: f.beneficiary, iban: f.iban, destCC: f.destCC,
    amt: parseFloat(f.amt) || 0, cur: f.cur, type: f.type, motif: f.motif, status: "PENDING_APPROVAL",
    justification: null, approvedBy: null, executedAt: null };
  o.controls = transferControls(o);
  if (o.controls.verdict === "BLOCK") o.status = "BLOCKED";
  TRANSFER_ORDERS.unshift(o);
  return o;
}

// Source : docs/reference/olive-demo.html 29833–29852 — validation four-eyes + rejet.
export function transferApprove(o: any, user: any, justification: string | null): any {
  if (o.createdBy === (user && user.name))
    return { err: "Four-eyes : le valideur doit différer du créateur de l'ordre" };
  if (o.controls.verdict === "WARN" && !justification)
    return { err: "Verdict WARN : une justification de dérogation est obligatoire" };
  o.status = "EXECUTED";
  o.approvedBy = (user && user.name) || "—";
  o.executedAt = "2026-07-11";
  o.justification = justification || null;
  const city = XFER_CC_CITY[o.destCC] || "Zürich";
  TX_DATA.push({ id: "TX-" + (60000 + TRANSFER_ORDERS.length), date: "2026-07-11", from: "Genève", to: city, amt: o.amt, cur: o.cur, client: o.clientName, type: o.type, risk: o.controls.verdict === "WARN" ? "HIGH" : XFER_SENSITIVE.indexOf(o.destCC) >= 0 ? "MEDIUM" : "LOW" });
  pushParamAudit((user && user.name) || "—", "Transferts — ordre " + o.id + " VALIDÉ et EXÉCUTÉ (four-eyes : " + o.createdBy + " → " + o.approvedBy + ")" + (justification ? (" — dérogation : " + justification) : ""));
  wfEmit("PARAM_CHANGED", null, { subjectId: "XFER/" + o.id, actor: (user && user.name) || "—", payload: { action: "EXECUTE", amt: o.amt } });
  return { ok: true };
}
export function transferReject(o: any, user: any) {
  o.status = "REJECTED";
  o.approvedBy = (user && user.name) || "—";
  pushParamAudit((user && user.name) || "—", "Transferts — ordre " + o.id + " REJETÉ (" + o.controls.verdict + ")");
}

// Source : docs/reference/olive-demo.html 43528–43542 — seed des ordres du jour (tous états).
(function seedTransfers() {
  const mk = function (cid: string, ben: string, iban: string, cc: string, amt: number, cur: string, type: string, motif: string, by: string) { return transferCreate({ clientId: cid, beneficiary: ben, iban: iban, destCC: cc, amt: amt, cur: cur, type: type, motif: motif }, { name: by }); };
  const ids = (CLIENTS as any[]).slice(0, 30).map(function (c) { return c.id; });
  mk(ids[2], "Continental Assets Ltd", "GB29NWBK60161331926819", "GB", 1.8, "USD", "SWIFT", "Acquisition immobilière", "Lucie Morel");
  mk(ids[5], "Al Faisal Trading FZE", "AE070331234567890123456", "AE", 3.2, "AED", "SWIFT", "Contrat commercial", "Ming Chen");
  mk(ids[8], "Novatek Energia OOO", "RU0204452560040702810", "RU", 0.9, "USD", "SWIFT", "Fourniture équipement", "Ralf Kessler");
  const o4 = mk(ids[11], "Fondation Helvetia Kids", "CH5604835012345678009", "CH", 0.25, "CHF", "SEPA", "Don caritatif", "Sophie Berger");
  const o5 = mk(ids[14], "Meyer & Cie Notaires", "CH9300762011623852957", "CH", 1.1, "CHF", "SEPA", "Frais d'acte", "Patrick Durand");
  [o4, o5].forEach(function (o, i) { if (o.status === "PENDING_APPROVAL") { transferApprove(o, { name: "Isabelle Vernet" }, "Ordre récurrent documenté au dossier"); o.executedAt = "2026-07-0" + (8 + i); } });
  PARAM_AUDIT.splice(0, 7); // les seeds ne polluent pas la piste du jour
})();
