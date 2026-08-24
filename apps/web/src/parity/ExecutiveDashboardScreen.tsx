import React from "react";
import { T } from "./tokens";
import { KpiCard } from "./components";
import { ExportBtn } from "./components-data";
import { parseAumValue, formatAumTotal } from "./demo-init";
import CLIENTS from "../fixtures/CLIENTS.json";
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import ACCOUNT_REVIEWS_DATA from "../fixtures/ACCOUNT_REVIEWS_DATA.json";
import SCREEN_LABEL from "../fixtures/SCREEN_LABEL.json";

// CONSIGNÉ (cf. aml.ts / offboarding) : AML_ALERTS et REPORTING_DATA non portés → tableaux vides.
const AML_ALERTS: any[] = [];
const REPORTING_DATA: any[] = [];

// Source : docs/reference/olive-demo.html 20882–20983 — porté verbatim.
export function ExecutiveDashboardScreen({ user, go }: { user?: any; go?: (s: string) => void }) {
  void user;
  const C = CLIENTS as any[];
  const K = KYCS_DATA as any[];
  const totalAum = C.reduce(function (a, c) { return a + parseAumValue(c.aum); }, 0);
  const nClients = C.length;
  const nKyc = K.length;
  const nEdd = K.filter(function (k) { return k.workflow === "EDD"; }).length;
  const nPep = C.filter(function (c) { return c.pep; }).length;
  const alerts = AML_ALERTS;
  const sanctionsHits = alerts.filter(function (a) { return a.alertType === "SANCTIONS"; }).length;
  const openAlerts = alerts.filter(function (a) { return a.status === "NEW"; }).length;
  const sarCount = REPORTING_DATA.filter(function (r) { return r.type.indexOf("SAR") >= 0; }).length;
  const arOverdue = (ACCOUNT_REVIEWS_DATA as any[]).filter(function (a) { return a.status === "OVERDUE"; }).length;
  const approved = K.filter(function (k) { return k.status === "APPROVED"; }).length;
  const rejected = K.filter(function (k) { return k.status === "REJECTED"; }).length;
  const approvalRate = (approved + rejected) ? Math.round(approved / (approved + rejected) * 100) : 0;
  const PHASES = [["SAISIE", "Saisie RM"], ["COMPLIANCE", "Revue Compliance"], ["AML", "Clarifications AML"], ["COMITE", "Comité"], ["APPROBATION", "Approbation finale"]];
  const activeK = K.filter(function (k) { return k.status !== "APPROVED" && k.status !== "REJECTED"; });
  const funnel = PHASES.map(function (p) { return { id: p[0], label: p[1], n: activeK.filter(function (k) { return k.wfPhase === p[0]; }).length }; });
  const funnelMax = Math.max(1, funnel.reduce(function (a, f) { return Math.max(a, f.n); }, 0));
  const SEGMENTS = ["Mass Affluent", "Affluent", "HNWI", "UHNWI"];
  const segData = SEGMENTS.map(function (sg) { return { sg, n: C.filter(function (c) { return c.segment === sg; }).length }; });
  const RISKT: any[] = [["LOW", "Faible", T.green], ["MEDIUM", "Moyen", T.amber], ["HIGH", "Élevé", T.red]];
  const riskData = RISKT.map(function (r) { return { id: r[0], label: r[1], color: r[2], n: C.filter(function (c) { return c.risk === r[0]; }).length }; });
  const rmMap: any = {};
  C.forEach(function (c) { rmMap[c.rm] = (rmMap[c.rm] || 0) + parseAumValue(c.aum); });
  const topRms = Object.keys(rmMap).map(function (k) { return { rm: k, aum: rmMap[k] }; }).sort(function (a, b) { return b.aum - a.aum; }).slice(0, 5);
  const topRmMax = Math.max(1, topRms.reduce(function (a, r) { return Math.max(a, r.aum); }, 0));
  const secMap: any = {};
  C.forEach(function (c) { secMap[c.sector] = (secMap[c.sector] || 0) + 1; });
  const topSectors = Object.keys(secMap).map(function (k) { return { sector: k, n: secMap[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 6);
  const topSectorMax = Math.max(1, topSectors.reduce(function (a, r) { return Math.max(a, r.n); }, 0));
  const cMap: any = {};
  C.forEach(function (c) { if (!cMap[c.country]) cMap[c.country] = { flag: c.countryFlag, n: 0, sum: 0 }; cMap[c.country].n++; cMap[c.country].sum += c.score; });
  const topCountries = Object.keys(cMap).map(function (k) { return { name: k, flag: cMap[k].flag, n: cMap[k].n, avg: Math.round(cMap[k].sum / cMap[k].n) }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
  const card: any = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 18 };
  const barRow = function (label: string, n: number, max: number, color: string, extra?: string) {
    return (
      <div key={label} style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: T.inkMid }}>{label}</span>
          <span style={{ color, fontWeight: 700 }}>{n}{extra ? " " + extra : ""}</span>
        </div>
        <div style={{ height: 7, background: T.lineSoft, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: (n / max * 100) + "%", background: color, borderRadius: 4 }} />
        </div>
      </div>
    );
  };
  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Vue consolidée · Direction</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>{(SCREEN_LABEL as any).execdash}</div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>Portefeuille, risque et pipeline compliance — agrégés depuis les données réelles de la plateforme.</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <ExportBtn filename="dashboard-executif.csv" headers={["Métrique", "Valeur"]} rows={function () { return [["AUM total", formatAumTotal(totalAum)], ["Clients", nClients], ["KYC total", nKyc], ["EDD", nEdd], ["PEP", nPep], ["Hits sanctions", sanctionsHits], ["Alertes ouvertes", openAlerts], ["SAR/MROS", sarCount], ["Reviews en retard", arOverdue], ["Taux d'approbation", approvalRate + "%"]]; }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14 }}>
        <KpiCard label="AUM total" value={formatAumTotal(totalAum)} sub={nClients + " clients référencés"} color={T.olive600} icon="◑" />
        <KpiCard label="Dossiers KYC" value={nKyc} sub={nEdd + " en diligence EDD"} color={T.blue} icon="◎" />
        <KpiCard label="Taux d'approbation" value={approvalRate + "%"} sub={approved + " approuvés / " + rejected + " rejetés"} color={T.green} icon="✓" />
        <KpiCard label="Reviews en retard" value={arOverdue} sub="SLA à risque" color={T.red} icon="↻" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
        <KpiCard label="Clients PEP" value={nPep} sub="diligence renforcée" color={T.violet} icon="◬" />
        <KpiCard label="Hits sanctions" value={sanctionsHits} sub="OFAC / SECO" color={T.red} icon="⌖" />
        <KpiCard label="Alertes ouvertes" value={openAlerts} sub="file d'investigation AML" color={T.amber} icon="◈" />
        <KpiCard label="SAR / MROS" value={sarCount} sub="déclarations" color={T.leaf} icon="▤" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 12 }}>⌘ Pipeline KYC — dossiers actifs par étape</div>
          {funnel.map(function (f) { return barRow(f.label, f.n, funnelMax, T.olive600); })}
          <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 4 }}>Cycle de temps par étape (SLA) : Phase 2 — nécessite l'horodatage des franchissements (event sourcing déjà en place, agrégation à câbler).</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 12 }}>◑ Répartition par segment</div>
          {segData.map(function (d) { return barRow(d.sg, d.n, Math.max(1, nClients), T.gold); })}
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, margin: "14px 0 12px" }}>▲ Répartition par risque</div>
          {riskData.map(function (d) { return barRow(d.label, d.n, Math.max(1, nClients), d.color); })}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 12 }}>★ Top Relationship Managers — par AUM géré</div>
          {topRms.map(function (r) {
            return (
              <div key={r.rm} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: T.inkMid }}>{r.rm}</span>
                  <span style={{ color: T.olive700, fontWeight: 700 }}>{formatAumTotal(r.aum)}</span>
                </div>
                <div style={{ height: 7, background: T.lineSoft, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: (r.aum / topRmMax * 100) + "%", background: T.olive700, borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 12 }}>⬡ Top secteurs d'activité</div>
          {topSectors.map(function (sc) { return barRow(sc.sector, sc.n, topSectorMax, T.blue); })}
        </div>
      </div>
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 12 }}>🌐 Risque par pays — clients et score moyen</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>{topCountries.map(function (c) {
          const col = c.avg >= 60 ? T.red : c.avg >= 30 ? T.amber : T.green;
          return (
            <div key={c.name} onClick={function () { go && go("clients"); }} style={{ border: "1px solid " + T.line, borderLeft: "3px solid " + col, borderRadius: 10, padding: "10px 12px", cursor: go ? "pointer" : "default" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{c.flag} {c.name}</div>
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{c.n} client(s) · score moyen <span style={{ color: col, fontWeight: 700 }}>{c.avg}</span></div>
            </div>
          );
        })}</div>
      </div>
    </div>
  );
}
