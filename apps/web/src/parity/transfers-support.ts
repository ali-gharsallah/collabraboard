// Source : docs/reference/olive-demo.html 29756–29832 — porté verbatim.
// Moteur Transferts & ordres : contrôles pré-exécution + création d'ordre. Partagé par Mobile
// Banking, Transferts & ordres, Settlement et le bouton rééquilibrage PMS.
import CLIENTS from "../fixtures/CLIENTS.json";
import { kycsByClientId } from "./components-data";

// CONSIGNÉ — moteurs non encore portés → stubs neutres (aucun blocage ajouté) :
//  · screenMatch (Screening sanctions/PEP) → [] (aucune correspondance).
//  · cbCountry (Cross-Border) → null (sans restriction).
//  · AML_ALERTS / MROS_REPORTS → [] (aucune alerte / communication).
// À rebrancher au portage des modules Screening / Cross-Border / AML / MROS.
function screenMatch(_name: string, _opts?: any): any[] { return []; }
function cbCountry(_cc: string): any { return null; }
const AML_ALERTS: any[] = [];
const MROS_REPORTS: any[] = [];

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
