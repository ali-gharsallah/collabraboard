import React, { useState } from "react";
import { T } from "./tokens";
import CLIENTS from "../fixtures/CLIENTS.json";
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import ACCOUNT_REVIEWS_DATA from "../fixtures/ACCOUNT_REVIEWS_DATA.json";
import PROSPECTS_DATA from "../fixtures/PROSPECTS_DATA.json";
import { clientById, ExportBtn } from "./components-data";
import { Badge, KpiCard } from "./components";
import { wfNomenclature } from "./kyc-support";
import { PARAM_AUDIT, pushParamAudit } from "./param-audit-support";
import { AML_ALERTS, aiContextualizeAlert } from "./aml-workspace-support";
import { TRANSFER_ORDERS, XFER_STATUS_META } from "./transfers-support";
import { crmRelances, crmOpportunities } from "./crm-support";
import { pmsPortfolio } from "./pms-support";
import { STAFF_DATA, staffProfile } from "./formations-support";
import { regRelationRow, regFiche } from "./registre-support";
import { PROSPECT_LEADS } from "./prospection-support";
import { WF_MGMT_TEMPLATES } from "./wf-mgmt-support";

// CONSIGNÉ — moteurs non portés → stubs neutres :
//  · screenHits (Screening) → [] : « Hits à trancher » = 0.
//  · REPORTING_DATA (SAR/MROS/FINMA) → [] : compteurs déclarations = 0.
//  · MROS_REPORTS / mrosAckAge → [] / null : suivi MROS vide.
//  · BUSINESS_TRIPS → undefined : « Business Trips » = 0 (garde typeof).
// À rebrancher au portage Screening / Reporting / MROS / Business Trip.
const TX_DATA: any[] = [];
function screenHits(): any[] { return []; }
const REPORTING_DATA: any[] = [];
const MROS_REPORTS: any[] = [];
function mrosAckAge(_r: any): any { return null; }
const BUSINESS_TRIPS: any = undefined;

const REG_DEADLINES = [
  { date: "2026-01-31", label: "Statistiques BNS — situation annuelle", org: "BNS", done: true },
  { date: "2026-03-31", label: "FATCA — transmission 8966 via IDES (données 2025)", org: "IRS", done: true },
  { date: "2026-04-30", label: "Rapport annuel LBA à la Direction", org: "Interne / FINMA", done: true },
  { date: "2026-06-30", label: "CRS / EAR — transmission AFC (données 2025)", org: "AFC → OCDE", done: true },
  { date: "2026-09-30", label: "Reporting prudentiel semestriel", org: "FINMA", done: false },
  { date: "2027-03-31", label: "FATCA — transmission 8966 (données 2026)", org: "IRS", done: false },
  { date: "2027-06-30", label: "CRS / EAR — transmission AFC (données 2026)", org: "AFC → OCDE", done: false },
];

// Source : docs/reference/olive-demo.html 32510–32563 — porté verbatim.
function GlobalKpiPanel() {
  const parseM = function (a: any) { const m = String(a || "").match(/([\d.]+)\s*(M|k)/i); return m ? (parseFloat(m[1]) * (m[2].toUpperCase() === "K" ? 0.001 : 1)) : 0; };
  const kycEnCours = (KYCS_DATA as any[]).filter(function (k) { return ["APPROVED", "REJECTED"].indexOf(k.status) < 0; }).length;
  const kycRenf = (KYCS_DATA as any[]).filter(function (k) { const c = wfNomenclature(k).code; return c[0] === "H" || c[0] === "P"; }).length;
  const scrHits = (KYCS_DATA as any[]).filter(function (k) { const sc = k.screening || {}; return sc.ofac === "HIT" || sc.seco === "HIT" || sc.pep === "HIT" || sc.adverse === "HIT"; }).length;
  const txHigh = TX_DATA.filter(function (t) { return t.risk === "HIGH"; }).length;
  const aumTot = Math.round((CLIENTS as any[]).reduce(function (a, c) { return a + parseM(c.aum); }, 0));
  const GROUPS: any[] = [
    ["🎯 Prospection & Onboarding", [
      ["Leads pipeline", PROSPECT_LEADS.length, "tous statuts", T.olive600, "📋"],
      ["GO onboardables", PROSPECT_LEADS.filter(function (l) { return l.onboardableStatus === "GO"; }).length, "prêts", T.green, "✓"],
      ["Onboardings en cours", (PROSPECTS_DATA as any[]).filter(function (p) { return !p.entered; }).length, "parcours actifs", T.leaf, "🌱"],
      ["Clients entrés", (PROSPECTS_DATA as any[]).filter(function (p) { return p.entered; }).length, "relations ouvertes", T.olive700, "🏦"]
    ]],
    ["◎ KYC", [
      ["Dossiers KYC", KYCS_DATA.length, "toutes révisions", T.olive600, "◎"],
      ["En cours / révision", kycEnCours, "dont " + kycRenf + " renforcés (H*/P*)", T.amber, "⏳"],
      ["Approuvés", (KYCS_DATA as any[]).filter(function (k) { return k.status === "APPROVED"; }).length, "four-eyes OK", T.green, "✓"],
      ["Complétude moyenne", Math.round((KYCS_DATA as any[]).reduce(function (a, k) { return a + (k.totalPct || 0); }, 0) / KYCS_DATA.length) + "%", "sections signées", T.olive700, "▤"]
    ]],
    ["👥 Clients", [
      ["Clients actifs", CLIENTS.length, "portefeuille", T.olive600, "👥"],
      ["Risque HIGH", (CLIENTS as any[]).filter(function (c) { return c.risk === "HIGH"; }).length, "surveillance renforcée", T.red, "▲"],
      ["PEP", (CLIENTS as any[]).filter(function (c) { return c.pep || (c.tags || []).indexOf("PEP-Hit") >= 0; }).length, "exposition politique", T.violet, "◆"],
      ["AUM total", "CHF " + aumTot + "M", "sous gestion", T.olive700, "◈"]
    ]],
    ["⌖ Screening & AML", [
      ["Dossiers avec hit", scrHits, "/ " + KYCS_DATA.length + " screenés", T.red, "⌖"],
      ["Alertes AML", AML_ALERTS.length, "6 typologies", T.amber, "⚠"],
      ["Alertes NEW", AML_ALERTS.filter(function (a) { return a.status === "NEW"; }).length, "à investiguer", T.red, "●"],
    ]],
    ["🗺 Transactions", [
      ["Flux 30 jours", TX_DATA.length, "transactions", T.olive600, "⇄"],
      ["Risque élevé", txHigh, "corridors à risque", T.red, "▲"],
      ["Ordres de transfert", TRANSFER_ORDERS.length, "registre du jour", T.olive600, "➢"],
      ["En attente four-eyes", TRANSFER_ORDERS.filter(function (o) { return o.status === "PENDING_APPROVAL"; }).length, "à valider", T.amber, "👁"],
      ["Ordres bloqués", TRANSFER_ORDERS.filter(function (o) { return o.status === "BLOCKED"; }).length, "contrôle pré-exécution", T.red, "⛔"]
    ]],
    ["🛡 Gouvernance", [
      ["Workflows actifs", WF_MGMT_TEMPLATES.filter(function (t) { return t.active; }).length + "/" + WF_MGMT_TEMPLATES.length, "gabarits nommés", T.olive600, "🗺"],
      ["Événements d'audit", PARAM_AUDIT.length, "piste immuable", T.olive700, "📜"],
    ]],
  ];
  return (
    <div>
      <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 14 }}>Tous les indicateurs opérationnels, regroupés par domaine — calculés en direct. Les écrans fonctionnels restent épurés.</div>
      {GROUPS.map(function (g) {
        return (
          <div key={g[0]} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.olive700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{g[0]}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>{g[1].map(function (k: any) { return <KpiCard key={k[0]} label={k[0]} value={String(k[1])} sub={k[2]} color={k[3]} icon={k[4]} />; })}</div>
          </div>
        );
      })}
    </div>
  );
}

// Source : docs/reference/olive-demo.html 32564–32814 — porté verbatim.
export function CentralDashboardScreen({ user }: { user?: any }) {
  const [dashTab, setDashTab] = useState("home");
  const [tasks, setTasks] = useState<any[]>([
    { id: "T-101", label: "Compléter section SOF/SOW — Zhang Wei FO", owner: "S. Marchand", deadline: "2026-07-01", done: false },
    { id: "T-102", label: "Lever hit screening — Al-Maktoum SA", owner: "I. Vernet", deadline: "2026-07-05", done: false },
    { id: "T-103", label: "Account Review — Nordic Wealth", owner: "R. Kessler", deadline: "2026-06-28", done: false },
  ]);
  const today = "2026-07-03";
  const kOpen = (KYCS_DATA as any[]).filter(k => !["APPROVED", "REJECTED"].includes(k.status)).length;
  const arLate = (ACCOUNT_REVIEWS_DATA as any[]).filter(a => a.status === "OVERDUE").length;
  const groups: any = {};
  (CLIENTS as any[]).forEach(c => { if (c.uboName) { groups[c.uboName] = (groups[c.uboName] || 0) + 1; } });
  const grpN = Object.keys(groups).filter(g => groups[g] > 1).length;
  const trips = (typeof BUSINESS_TRIPS !== "undefined") ? (BUSINESS_TRIPS as any[]).length : 0;
  const alerts = AML_ALERTS;
  const sanc = alerts.filter(a => a.alertType === "SANCTIONS").length;
  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16 };
  const dashTabBar = function (active: string) {
    return (
      <div style={{ display: "flex", gap: 4, marginBottom: 18, background: T.surface, padding: 5, borderRadius: 12, border: "1px solid " + T.line, width: "fit-content" }}>
        {[["home", "▦ Vue d'ensemble"], ["cockpit", "🎯 Mon cockpit"], ["kpi", "📊 KPI"]].map(function (x) {
          return <button key={x[0]} onClick={function () { setDashTab(x[0]); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: active === x[0] ? T.olive600 : "transparent", color: active === x[0] ? "#fff" : T.inkMid, fontSize: 12.5, fontWeight: active === x[0] ? 700 : 500 }}>{x[1]}</button>;
        })}
      </div>
    );
  };
  if (dashTab === "kpi") {
    return <div>{dashTabBar("kpi")}<GlobalKpiPanel /></div>;
  }
  if (dashTab === "cockpit") {
    const role = (user && user.role) || "RM";
    const uname = (user && user.name) || "";
    const Sec = function (title: string, items: any[], color?: string) {
      return (
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 800, color: color || T.olive700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{title}</div>
          {items.length === 0 && <div style={{ fontSize: 11, color: T.inkSoft, fontStyle: "italic" }}>Rien à traiter — à jour.</div>}
          {items.slice(0, 6).map(function (it, i) {
            return (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 10.5, padding: "4px 0", borderBottom: "1px solid " + T.lineSoft }}>
                <span style={{ fontWeight: 700, color: T.ink, flexShrink: 0 }}>{it[0]}</span>
                <span style={{ color: T.inkMid, flex: 1 }}>{it[1]}</span>
                {it[2] && <span style={{ fontSize: 9, fontWeight: 800, color: it[3] || T.amber, whiteSpace: "nowrap" }}>{it[2]}</span>}
              </div>
            );
          })}
          {items.length > 6 && <div style={{ fontSize: 9.5, color: T.inkSoft, marginTop: 4 }}>… et {items.length - 6} autre(s)</div>}
        </div>
      );
    };
    const isRm = ["RM", "ARM"].indexOf(role) >= 0;
    const isCo = ["CO", "CO_SR", "AML", "MLRO"].indexOf(role) >= 0;
    const secs: any[] = [];
    if (isRm) {
      const mine = (CLIENTS as any[]).filter(function (c) { return c.rm === uname; });
      const scope = mine.length ? mine : (CLIENTS as any[]).slice(0, 12);
      const scopeIds = scope.map(function (c: any) { return c.id; });
      secs.push(Sec("Mes dossiers KYC en cours", (KYCS_DATA as any[]).filter(function (k) { return scopeIds.indexOf(k.clientId) >= 0 && k.status === "IN_PROGRESS"; }).map(function (k) { const c = clientById[k.clientId] || {}; return [c.name || k.clientId, k.code + " — " + (k.totalPct || 0) + "%", (k.totalPct || 0) < 50 ? "à compléter" : null, T.amber]; })));
      secs.push(Sec("Mes relances CRM", crmRelances().filter(function (x) { return x.r.rm === uname || !mine.length; }).map(function (x) { const c = clientById[x.r.clientId] || {}; return [c.name || "", x.r.nextStep, x.late ? ("J+" + x.days) : x.r.nextDate, x.late ? T.red : T.amber]; })));
      secs.push(Sec("Mes ordres de transfert", TRANSFER_ORDERS.filter(function (o) { return o.createdBy === uname || !mine.length; }).map(function (o) { return [o.clientName, o.beneficiary + " · " + o.amt + "M " + o.cur, XFER_STATUS_META[o.status][0], o.status === "BLOCKED" ? T.red : o.status === "PENDING_APPROVAL" ? T.amber : T.green]; })));
      secs.push(Sec("Opportunités sur mon portefeuille", crmOpportunities().filter(function (o) { return !mine.length || o.c.rm === uname; }).map(function (o) { return [o.c.name, o.msg, o.act, T.olive700]; }), T.violet));
    }
    else if (isCo) {
      secs.push(Sec("Alertes AML à qualifier", AML_ALERTS.filter(function (a) { return a.status === "NEW"; }).slice(0, 20).map(function (a) { return [a.clientName || a.clientId, a.alertType, "NEW", T.red]; }), T.red));
      secs.push(Sec("Revues périodiques en retard", (ACCOUNT_REVIEWS_DATA as any[]).filter(function (a) { return a.status === "OVERDUE"; }).map(function (a) { const c = clientById[a.clientId] || {}; return [c.name || a.clientId, a.trigger, "OVERDUE", T.red]; })));
      secs.push(Sec("Ordres en attente four-eyes", TRANSFER_ORDERS.filter(function (o) { return o.status === "PENDING_APPROVAL"; }).map(function (o) { return [o.clientName, o.beneficiary + " · " + o.amt + "M " + o.cur, o.controls.verdict, o.controls.verdict === "WARN" ? T.amber : T.green]; })));
      secs.push(Sec("Suivi MROS", MROS_REPORTS.map(function (r) { const a = mrosAckAge(r); return [r.ref, r.clientName || "", a ? ("J+" + a.days + " — " + a.level) : r.status, a && a.level !== "OK" ? T.red : T.green]; }), T.violet));
    }
    else {
      const rels = (CLIENTS as any[]).map(regRelationRow);
      const nc = rels.filter(function (r) { return regFiche(r).verdict === "NON CONFORME"; });
      secs.push(Sec("Registre art. 7 — relations non conformes", nc.map(function (r) { return [r.c.name, r.wn.code + " · " + r.pct + "%", "NON CONFORME", T.red]; }), T.red));
      secs.push(Sec("Habilitations suspendues", STAFF_DATA.map(staffProfile).filter(function (x) { return x.suspended; }).map(function (x) { return [x.p.name, x.p.role + " — " + x.expired.map(function (c: any) { return c.code; }).join(", "), "SUSPENDU", T.red]; })));
      secs.push(Sec("Ordres bloqués & en attente", TRANSFER_ORDERS.filter(function (o) { return o.status !== "EXECUTED" && o.status !== "REJECTED"; }).map(function (o) { return [o.clientName, o.beneficiary + " · " + o.amt + "M " + o.cur, XFER_STATUS_META[o.status][0], o.status === "BLOCKED" ? T.red : T.amber]; })));
      secs.push(Sec("Échéances réglementaires à venir", REG_DEADLINES.filter(function (d) { return !d.done; }).map(function (d) { return [d.date, d.label, d.org, T.olive700]; }), T.violet));
    }
    return (
      <div>
        {dashTabBar("cockpit")}
        <div style={{ marginBottom: 12, fontSize: 11.5, color: T.inkSoft }}>Cockpit adapté au rôle <strong style={{ color: T.ink }}>{(user && user.roleLabel) || role}</strong> — les listes de travail du jour, dérivées en direct des modules.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{secs}</div>
      </div>
    );
  }
  const W = (label: string, value: any, sub: string, color: string) => (
    <div style={card}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color, fontFamily: "monospace" }}>{value}</div>
      <div style={{ fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 2 }}>{sub}</div>}
    </div>
  );
  return (
    <div>
      {dashTabBar("home")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        {([
          ["◎", "KYC en cours", (KYCS_DATA as any[]).filter(function (k) { return k.status === "IN_PROGRESS"; }).length, "dossiers"],
          ["⌖", "Hits à trancher", screenHits().filter(function (h) { return !h.q; }).length, "screening"],
          ["◬", "Alertes NEW", AML_ALERTS.filter(function (a) { return a.status === "NEW"; }).length, "AML"],
          ["➢", "Ordres en attente", TRANSFER_ORDERS.filter(function (o) { return o.status === "PENDING_APPROVAL"; }).length, "four-eyes"],
          ["🗂", "Relances échues", crmRelances().filter(function (x) { return x.late; }).length, "CRM"],
          ["↻", "Revues en retard", (ACCOUNT_REVIEWS_DATA as any[]).filter(function (a) { return a.status === "OVERDUE"; }).length, "Account Review"],
          ["▦", "Dérives ≥10%", (CLIENTS as any[]).filter(function (c) { return pmsPortfolio(c).drift >= 10; }).length, "PMS"],
          ["🎓", "Habilitations échues", STAFF_DATA.map(staffProfile).filter(function (x) { return x.suspended; }).length, "suspensions"],
        ] as any[]).map(function (x, i) {
          return (
            <div key={i} style={{ background: T.surface, border: "1px solid " + T.line, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 17 }}>{x[0]}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: x[2] > 0 ? T.ink : T.green }}>{x[2]}</div>
                <div style={{ fontSize: 9, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4 }}>{x[1]} · {x[3]}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ background: T.surface, border: "1px solid " + T.line, borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: T.olive700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>⚡ Activité récente — tous modules</div>
        {PARAM_AUDIT.slice(0, 6).map(function (e, i) {
          return (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 10.5, padding: "3px 0", borderBottom: "1px solid " + T.lineSoft }}>
              <span style={{ fontFamily: "monospace", color: T.inkSoft, flexShrink: 0 }}>{e.at}</span>
              <span style={{ fontWeight: 700, color: T.olive700, flexShrink: 0 }}>{e.by}</span>
              <span style={{ color: T.inkMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.what}</span>
            </div>
          );
        })}
        {PARAM_AUDIT.length === 0 && <div style={{ fontSize: 10.5, color: T.inkSoft, fontStyle: "italic" }}>Aucune action tracée pour l'instant — agissez dans un module.</div>}
      </div>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Vue d'ensemble</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Dashboard central</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <ExportBtn filename="dashboard.csv" headers={["Widget", "Valeur"]} rows={() => [["KYC en cours", kOpen], ["Reviews en retard", arLate], ["Groupes clients", grpN], ["Business trips", trips], ["Alertes AML", alerts.length], ["Sanctions", sanc]]} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        {W("KYC en cours", kOpen, "tous workflows", T.olive600)}
        {W("Account Reviews en retard", arLate, "action requise", T.red)}
        {W("Group Account Reviews", grpN, "clients d'un même groupe (UBO commun)", T.violet)}
        {W("Business Trips", trips, "missions actives/planifiées", T.gold)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        {W("Alertes AML", alerts.length, "file d'investigation", T.amber)}
        {W("Alertes sanctions", sanc, "OFAC / SECO", T.red)}
        {W("Déclarations SAR/MROS", REPORTING_DATA.filter(r => r.type.indexOf("SAR") >= 0).length, "1 transmise · 1 en préparation", T.blue)}
        {W("Reporting FINMA / Legal", REPORTING_DATA.filter(r => r.type.indexOf("SAR") < 0).length, "réglementaire", T.leaf)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 }}>⏰ Tâches & deadlines paramétrables</div>
          {tasks.map((t, i) => {
            const late = !t.done && t.deadline < today;
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < tasks.length - 1 ? `1px solid ${T.lineSoft}` : "none", opacity: t.done ? 0.5 : 1 }}>
                <button onClick={() => setTasks(ts => ts.map(x => x.id === t.id ? { ...x, done: !x.done } : x))} style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${t.done ? T.green : T.line}`, background: t.done ? T.greenSoft : T.surface, color: T.green, fontSize: 11, cursor: "pointer" }}>{t.done ? "✓" : ""}</button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, textDecoration: t.done ? "line-through" : "none" }}>{t.label}</div>
                  <div style={{ fontSize: 10.5, color: T.inkSoft }}>{t.owner}</div>
                </div>
                <input type="date" value={t.deadline} onChange={e => { const v = e.target.value; setTasks(ts => ts.map(x => x.id === t.id ? { ...x, deadline: v } : x)); pushParamAudit((user && user.name), "Deadline " + t.id + " → " + v); }} style={{ padding: "4px 7px", borderRadius: 7, border: `1px solid ${late ? T.red : T.line}`, fontSize: 11, color: late ? T.red : T.inkMid }} />
                {late && <Badge text="DÉPASSÉE" color={T.red} bg={T.redSoft} />}
              </div>
            );
          })}
          <div style={{ marginTop: 8, fontSize: 10.5, color: T.inkSoft }}>Tout dépassement de deadline est tracé dans la piste d'audit (Admin → Audit paramètres).</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 }}>◈ Alertes AML par type</div>
          {["SANCTIONS", "PEP", "ADVERSE_MEDIA"].map(tp => {
            const n = alerts.filter(a => a.alertType === tp).length;
            const col = tp === "SANCTIONS" ? T.red : tp === "PEP" ? T.violet : T.amber;
            return (
              <div key={tp} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: T.inkMid }}>{tp === "ADVERSE_MEDIA" ? "Presse négative" : tp}</span>
                  <span style={{ color: col, fontWeight: 700 }}>{n}</span>
                </div>
                <div style={{ height: 6, background: T.lineSoft, borderRadius: 3 }}>
                  <div style={{ height: "100%", width: (alerts.length ? Math.round(n / alerts.length * 100) : 0) + "%", background: col, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 6, fontSize: 11, color: T.inkMid, background: T.oliveSoft, padding: "9px 11px", borderRadius: 8, lineHeight: 1.5 }}>
            Estimation IA : {alerts.length ? Math.round(alerts.filter(a => aiContextualizeAlert(a).suggestedAction === "CLEAR").length / alerts.length * 100) : 0}% de faux positifs probables, clôturables avec justification en un clic.
          </div>
        </div>
      </div>
    </div>
  );
}
