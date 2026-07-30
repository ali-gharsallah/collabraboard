// Source : docs/reference/olive-demo.html 29218–29251 — porté verbatim.
// Registre des relations d'affaires (art. 7 LBA) : reconstitution en direct de chaque ligne,
// fiche de contrôle par relation, échantillonnage d'audit stratifié reproductible.
import CLIENTS from "../fixtures/CLIENTS.json";
import ACCOUNT_REVIEWS_DATA from "../fixtures/ACCOUNT_REVIEWS_DATA.json";
import { kycsByClientId } from "./components-data";
import { wfNomenclature } from "./kyc-support";
import { amlHash } from "./preonboarding-support";

// CONSIGNÉ — sources hors périmètre parité :
//  · AML_ALERTS (alertes AML) → [] : idem aml.ts (non extrait en fixture) ⇒ aucune alerte NEW.
//  · MROS_REPORTS (déclarations MROS) → [] : identique à la source (var MROS_REPORTS = []).
// La complétude documentaire, l'UBO, le score de risque, les revues en retard et les hits de
// screening restent réellement calculés depuis KYC/AR — donc la vue registre est bien reconstituée.
const AML_ALERTS: any[] = [];
const MROS_REPORTS: any[] = [];

export function regRelationRow(c: any): any {
  const kycs = (kycsByClientId[c.id] || []).slice().sort(function (a, b) { return (a.revision || 1) - (b.revision || 1); });
  const first = kycs[0] || {}, k = kycs[kycs.length - 1] || {};
  const sc = k.screening || {};
  const hits = ["ofac", "seco", "pep", "adverse"].filter(function (x) { return sc[x] === "HIT"; });
  const alertsOpen = AML_ALERTS.filter(function (a) { return a.clientId === c.id && a.status === "NEW"; }).length;
  const mros = (typeof MROS_REPORTS !== "undefined") ? MROS_REPORTS.filter(function (r) { return r.clientId === c.id; }).length : 0;
  const reviews = (ACCOUNT_REVIEWS_DATA as any[]).filter(function (a) { return a.clientId === c.id; });
  const reviewLate = reviews.some(function (a) { return a.status === "OVERDUE"; }) || (k.nextReview && k.nextReview < "2026-07-11");
  return { c: c, k: k, opened: first.createdAt || k.createdAt || "—", wn: wfNomenclature(k), hits: hits, alertsOpen: alertsOpen, mros: mros, reviewLate: reviewLate, pct: (k.totalPct != null ? k.totalPct : 0) };
}
export function regFiche(row: any): any {
  const c = row.c, k = row.k;
  const checks: any[] = [];
  const eddLike = row.wn.code[0] === "H" || row.wn.code[0] === "P";
  checks.push({ label: "Identification du cocontractant — formulaire CDB " + (k.cdbForm || "A") + " (art. 3 LBA)", ok: row.pct >= 60, note: row.pct >= 60 ? "Pièces au dossier (" + row.pct + "%)" : "Dossier documentaire incomplet (" + row.pct + "%)" });
  checks.push({ label: "Ayant droit économique identifié (art. 4 LBA)", ok: !!(c.uboName || k.uboName), note: (c.uboName || k.uboName) ? ("UBO : " + (c.uboName || k.uboName) + (k.uboShare ? (" (" + k.uboShare + ")") : "")) : "UBO non renseigné" });
  checks.push({ label: "Profil de risque documenté et à jour", ok: k.riskScore != null, note: k.riskScore != null ? ("Score " + k.riskScore + " — gabarit " + row.wn.code) : "Score absent" });
  checks.push({ label: "Revue périodique dans les délais", ok: !row.reviewLate, note: row.reviewLate ? "Revue échue ou OVERDUE au registre" : "À jour" + (k.nextReview ? (" — prochaine " + k.nextReview) : "") });
  checks.push({ label: "Hits de screening qualifiés", ok: row.hits.length === 0 || row.alertsOpen === 0, note: row.hits.length === 0 ? "Aucun hit" : (row.alertsOpen > 0 ? (row.alertsOpen + " alerte(s) NEW non qualifiée(s)") : "Hits sous investigation/déclarés") });
  if (eddLike)
    checks.push({ label: "Clarifications complémentaires EDD (art. 6 al. 2 LBA)", ok: row.pct >= 100, note: row.pct >= 100 ? "Clarifications complètes" : "EDD exigée — dossier à " + row.pct + "%" });
  checks.push({ label: "Conservation des documents 10 ans (art. 7 al. 3 LBA)", ok: true, note: "GED Olive — rétention automatique, audit immuable" });
  const ko = checks.filter(function (x) { return !x.ok; }).length;
  const verdict = ko === 0 ? "CONFORME" : ko <= 2 ? "RÉSERVES" : "NON CONFORME";
  return { checks: checks, ko: ko, verdict: verdict };
}
export function regAuditSample(seed: number): any[] {
  const rows = (CLIENTS as any[]).map(regRelationRow);
  const pick = function (pool: any[], n: number, tag: string) { return pool.map(function (r) { return { r: r, h: amlHash("SMP" + seed + ":" + tag + ":" + r.c.id, 1000) }; }).sort(function (a, b) { return a.h - b.h; }).slice(0, n).map(function (x) { return x.r; }); };
  const hi = rows.filter(function (r) { return r.c.risk === "HIGH"; });
  const me = rows.filter(function (r) { return r.c.risk === "MEDIUM"; });
  const lo = rows.filter(function (r) { return r.c.risk === "LOW"; });
  return pick(hi, 4, "H").concat(pick(me, 4, "M"), pick(lo, 2, "L"));
}
