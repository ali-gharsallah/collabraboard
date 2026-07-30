// Source : docs/reference/olive-demo.html 33083–33105 — porté verbatim.
// BI — Data & reporting sur mesure : agrégation dimension × mesure sur les données vivantes.
import CLIENTS from "../fixtures/CLIENTS.json";
import { kycsByClientId, clientLifecycleStatus } from "./components-data";
import { AML_ALERTS } from "./aml-workspace-support";
import { CONTACT_REPORTS } from "./contactreports-support";

export function biAggregate(dim: string, mes: string): any[] {
  const groups: any = {};
  const dimOf = function (c: any) {
    if (dim === "risk") return c.risk;
    if (dim === "segment") return c.segment || "—";
    if (dim === "country") return c.country || "—";
    if (dim === "rm") return c.rm || "—";
    if (dim === "type") return c.typeLabel || "—";
    if (dim === "lifecycle") return (clientLifecycleStatus(c) as any).label;
    return "—";
  };
  (CLIENTS as any[]).forEach(function (c) {
    const g = dimOf(c);
    groups[g] = groups[g] || { n: 0, aum: 0, alerts: 0, hits: 0, contacts: 0 };
    groups[g].n++;
    const mm = String(c.aum || "").match(/([\d.]+)\s*M/i);
    groups[g].aum += mm ? parseFloat(mm[1]) : 0;
    groups[g].alerts += AML_ALERTS.filter(function (x) { return x.clientId === c.id; }).length;
    const k = (kycsByClientId[c.id] || []).slice(-1)[0] || {};
    const sc = k.screening || {};
    groups[g].hits += ["ofac", "seco", "pep", "adverse"].filter(function (x) { return sc[x] === "HIT"; }).length;
    groups[g].contacts += (CONTACT_REPORTS as any[]).filter(function (x) { return x.clientId === c.id; }).length;
  });
  const rows = Object.keys(groups).map(function (g) {
    const v = groups[g];
    const val = mes === "n" ? v.n : mes === "aum" ? Math.round(v.aum * 10) / 10 : mes === "alerts" ? v.alerts : mes === "hits" ? v.hits : v.contacts;
    return { g: g, val: val };
  }).sort(function (x, y) { return y.val - x.val; });
  return rows;
}
