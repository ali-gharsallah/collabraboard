// Source : docs/reference/olive-demo.html 29976–30011 — porté verbatim.
// CRM : relances planifiées (échéances) + opportunités dérivées des modules (couverture/PMS/dossier).
import CLIENTS from "../fixtures/CLIENTS.json";
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import { clientById } from "./components-data";
import { CONTACT_REPORTS } from "./contactreports-support";
import { pmsPortfolio } from "./pms-support";
import { aumMOf } from "./demo-init";
import { clientVisibleTo } from "./cloison-support";
import { amlHash } from "./preonboarding-support";

export function crmRelances(): any[] {
  return (CONTACT_REPORTS as any[]).filter(function (r) { return r.nextStep && r.nextDate && !r.nextDone; })
    .map(function (r) {
      const late = r.nextDate < "2026-07-11";
      const days = Math.round((new Date("2026-07-11").getTime() - new Date(r.nextDate).getTime()) / 86400000);
      return { r: r, late: late, days: days };
    })
    .sort(function (a, b) { return (a.r.nextDate < b.r.nextDate) ? -1 : 1; });
}
export function crmOpportunities(): any[] {
  const cov: any[] = [], pfl: any[] = [], dos: any[] = [];
  (CLIENTS as any[]).forEach(function (c) {
    const contacts = (CONTACT_REPORTS as any[]).filter(function (r) { return r.clientId === c.id; }).map(function (r) { return r.date; }).sort();
    const last = contacts[contacts.length - 1];
    if (!last || last < "2026-01-12")
      cov.push({ type: "COUVERTURE", c: c, msg: "Aucun contact depuis " + (last ? "le " + last : "plus d'un an") + " — planifier une prise de contact", act: "Planifier un rendez-vous" });
  });
  (CLIENTS as any[]).forEach(function (c) {
    const pf = pmsPortfolio(c);
    if (pf.drift >= 10)
      pfl.push({ type: "PORTEFEUILLE", c: c, msg: "Dérive d'allocation " + pf.drift + "% vs profil " + pf.profile + " — occasion d'un entretien de rebalancement", act: "Proposer le rebalancement" });
  });
  (KYCS_DATA as any[]).forEach(function (k) {
    if ((k.totalPct || 0) < 50 && k.status !== "APPROVED") {
      const c = clientById[k.clientId];
      if (c)
        dos.push({ type: "DOSSIER", c: c, msg: "Dossier " + k.code + " à " + (k.totalPct || 0) + "% — la collecte documentaire est un motif de contact", act: "Organiser la collecte" });
    }
  });
  return cov.slice(0, 12).concat(pfl.slice(0, 10), dos.slice(0, 8));
}
// Source 30020-30048 (verbatim) — tiering AUM, SLA de couverture, plan NNM 2026.
export function crmTierOf(c: any) {
  const aM = aumMOf(c);
  if (aM >= 50)
    return { tier: "A", sla: 90, label: "Tier A — contact trimestriel" };
  if (aM >= 15)
    return { tier: "B", sla: 180, label: "Tier B — contact semestriel" };
  return { tier: "C", sla: 365, label: "Tier C — contact annuel" };
}
export function crmCoverage(user: any): any[] {
  return (CLIENTS as any[]).filter(function (c) { return clientVisibleTo(user, c); }).map(function (c) {
    const t = crmTierOf(c);
    const dates = (CONTACT_REPORTS as any[]).filter(function (r) { return r.clientId === c.id; }).map(function (r) { return r.date; }).sort();
    const last = dates[dates.length - 1] || null;
    const days = last ? Math.round((new Date("2026-07-11").getTime() - new Date(last).getTime()) / 86400000) : 9999;
    return { c: c, tier: t, last: last, days: days, overdue: days > t.sla, dueIn: t.sla - days };
  });
}
export function crmNnmPlan(user: any): any[] {
  const byRm: any = {};
  (CLIENTS as any[]).filter(function (c) { return clientVisibleTo(user, c); }).forEach(function (c) {
    const aM = aumMOf(c);
    const rm = c.rm || "—";
    byRm[rm] = byRm[rm] || { target: 0, real: 0, n: 0 };
    byRm[rm].target += aM * 0.05;
    byRm[rm].real += aM * 0.05 * (amlHash(c.id + "NNM", 140) / 100);
    byRm[rm].n++;
  });
  return Object.keys(byRm).map(function (rm) { const x = byRm[rm]; return { rm: rm, target: Math.round(x.target * 10) / 10, real: Math.round(x.real * 10) / 10, n: x.n, pct: Math.round(x.real / Math.max(0.1, x.target) * 100) }; }).sort(function (a, b) { return b.target - a.target; });
}
