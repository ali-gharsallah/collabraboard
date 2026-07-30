// Source : docs/reference/olive-demo.html 29976–30011 — porté verbatim.
// CRM : relances planifiées (échéances) + opportunités dérivées des modules (couverture/PMS/dossier).
import CLIENTS from "../fixtures/CLIENTS.json";
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import { clientById } from "./components-data";
import { CONTACT_REPORTS } from "./contactreports-support";
import { pmsPortfolio } from "./pms-support";

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
