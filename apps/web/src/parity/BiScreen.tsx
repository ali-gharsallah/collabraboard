import React, { useState } from "react";
import { T } from "./tokens";
import CLIENTS from "../fixtures/CLIENTS.json";
import KYCS_DATA from "../fixtures/KYCS_DATA.json";
import { clientById, ExportBtn } from "./components-data";
import { AML_ALERTS } from "./aml-workspace-support";
import { CONTACT_REPORTS } from "./contactreports-support";
import { TRANSFER_ORDERS } from "./transfers-support";
import { biAggregate } from "./bi-support";

// CONSIGNÉ — TX_DATA (transactions) non extrait en fixture (idem aml.ts) → [].
// La vue « Top corridors transactionnels » et l'extraction Transactions ressortent vides ;
// tout le reste (segments, alertes, millésimes KYC) est réellement agrégé.
const TX_DATA: any[] = [];

// Source : docs/reference/olive-demo.html 33106–33118 (BiBars) — porté verbatim.
function BiBars({ rows, unit, color }: { rows: any[]; unit?: string; color?: string }) {
  const mx = Math.max.apply(null, rows.map(function (r) { return r.val; }).concat([1]));
  return (
    <div>
      {rows.slice(0, 12).map(function (r) {
        return (
          <div key={r.g} style={{ marginBottom: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: T.inkMid, marginBottom: 2 }}>
              <span style={{ fontWeight: 600, color: T.ink }}>{r.g}</span>
              <span style={{ fontFamily: "monospace" }}>{r.val}{unit || ""}</span>
            </div>
            <div style={{ height: 7, background: T.lineSoft, borderRadius: 4 }}>
              <div style={{ height: "100%", width: Math.max(2, Math.round(r.val / mx * 100)) + "%", background: color || T.olive600, borderRadius: 4 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Source : docs/reference/olive-demo.html 33119–33260 — porté verbatim.
export function BiScreen({ user }: { user?: any }) {
  void user;
  const [tab, setTab] = useState("views");
  const [dim, setDim] = useState("risk");
  const [mes, setMes] = useState("n");
  const card: React.CSSProperties = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  const DIMS: [string, string][] = [["risk", "Risque"], ["segment", "Segment"], ["country", "Pays"], ["rm", "RM"], ["type", "Type de structure"], ["lifecycle", "Statut lifecycle"]];
  const MES: [string, string][] = [["n", "Nb relations"], ["aum", "AUM (M CHF)"], ["alerts", "Alertes AML"], ["hits", "Hits screening"], ["contacts", "Contacts CRM"]];
  const explo = biAggregate(dim, mes);
  const byTypo: any = {};
  AML_ALERTS.forEach(function (a) { byTypo[a.alertType] = (byTypo[a.alertType] || 0) + 1; });
  const typoRows = Object.keys(byTypo).map(function (k) { return { g: k, val: byTypo[k] }; }).sort(function (a, b) { return b.val - a.val; });
  const corr: any = {};
  TX_DATA.forEach(function (t) { const key = t.from + " → " + t.to; corr[key] = (corr[key] || 0) + 1; });
  const corrRows = Object.keys(corr).map(function (k) { return { g: k, val: corr[k] }; }).sort(function (a, b) { return b.val - a.val; }).slice(0, 10);
  const years: any = {};
  (KYCS_DATA as any[]).forEach(function (k) { const y = (k.code || "").split("-")[1]; if (y) years[y] = (years[y] || 0) + 1; });
  const yearRows = Object.keys(years).sort().map(function (y) { return { g: y, val: years[y] }; });
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>▥ BI — Data & reporting sur mesure</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3 }}>{CLIENTS.length} relations · {AML_ALERTS.length} alertes · {TX_DATA.length} transactions · {CONTACT_REPORTS.length} contacts</div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: T.surface, padding: 5, borderRadius: 12, border: "1px solid " + T.line, width: "fit-content" }}>
        {[["views", "▦ Vues préconstruites"], ["explore", "🧮 Explorateur"], ["exports", "⬇ Extractions"]].map(function (x) {
          return <button key={x[0]} onClick={function () { setTab(x[0]); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === x[0] ? T.olive600 : "transparent", color: tab === x[0] ? "#fff" : T.inkMid, fontSize: 12.5, fontWeight: tab === x[0] ? 700 : 500 }}>{x[1]}</button>;
        })}
      </div>
      {tab === "views" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={card}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: T.ink, marginBottom: 10 }}>AUM par segment (M CHF)</div>
            <BiBars rows={biAggregate("segment", "aum")} unit="M" />
          </div>
          <div style={card}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: T.ink, marginBottom: 10 }}>Alertes AML par typologie</div>
            <BiBars rows={typoRows} color={T.red} />
          </div>
          <div style={card}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: T.ink, marginBottom: 10 }}>Top corridors transactionnels</div>
            <BiBars rows={corrRows} color={T.violet} />
          </div>
          <div style={card}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: T.ink, marginBottom: 10 }}>Dossiers KYC ouverts par millésime</div>
            <BiBars rows={yearRows} color={T.gold} />
          </div>
        </div>
      )}
      {tab === "explore" && (
        <div style={card}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase" }}>Dimension</span>
            {DIMS.map(function (d) { return <button key={d[0]} onClick={function () { setDim(d[0]); }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid " + (dim === d[0] ? T.olive600 : T.line), background: dim === d[0] ? T.oliveSoft : T.surface, color: dim === d[0] ? T.olive700 : T.inkMid, fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>{d[1]}</button>; })}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase" }}>Mesure</span>
            {MES.map(function (d) { return <button key={d[0]} onClick={function () { setMes(d[0]); }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid " + (mes === d[0] ? T.violet : T.line), background: mes === d[0] ? T.violetSoft : T.surface, color: mes === d[0] ? T.violet : T.inkMid, fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>{d[1]}</button>; })}
            <span style={{ marginLeft: "auto" }}>
              <ExportBtn filename={"bi-" + dim + "-" + mes + ".csv"} headers={[DIMS.find(function (d) { return d[0] === dim; })![1], MES.find(function (d) { return d[0] === mes; })![1]]} rows={function () { return explo.map(function (r) { return [r.g, r.val]; }); }} />
            </span>
          </div>
          <BiBars rows={explo} unit={mes === "aum" ? "M" : ""} />
        </div>
      )}
      {tab === "exports" && (
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 4 }}>⬇ Extractions CSV — jeux de données</div>
          <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 14 }}>Extractions brutes pour retraitement (Excel, data warehouse). Chaque extraction est auditée via le téléchargement.</div>
          {([
            ["Relations d'affaires", "relations.csv", ["ID", "Nom", "Type", "Pays", "Segment", "Risque", "AUM", "RM"], function () { return (CLIENTS as any[]).map(function (c) { return [c.id, c.name, c.typeLabel || "", c.country || "", c.segment || "", c.risk, c.aum || "", c.rm || ""]; }); }],
            ["Alertes AML", "alertes.csv", ["ID", "Client", "Typologie", "Statut", "Score"], function () { return AML_ALERTS.map(function (a) { return [a.id, a.clientName || a.clientId, a.alertType, a.status, a.score || ""]; }); }],
            ["Transactions", "transactions.csv", ["ID", "Date", "De", "Vers", "Montant", "Devise", "Client"], function () { return TX_DATA.map(function (t) { return [t.id, t.date, t.from, t.to, t.amt, t.cur, t.client]; }); }],
            ["Ordres de transfert", "ordres.csv", ["ID", "Client", "Bénéficiaire", "Pays", "Montant", "Devise", "Verdict", "Statut"], function () { return (TRANSFER_ORDERS as any[]).map(function (o) { return [o.id, o.clientName, o.beneficiary, o.destCC, o.amt, o.cur, o.controls.verdict, o.status]; }); }],
            ["Contacts CRM", "contacts.csv", ["ID", "Date", "Client", "Canal", "Sujet", "RM"], function () { return (CONTACT_REPORTS as any[]).map(function (r) { return [r.id, r.date, (clientById[r.clientId] || {}).name || r.clientId, r.channel, r.subject, r.rm || ""]; }); }],
          ] as any[]).map(function (x) {
            return (
              <div key={x[1]} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid " + T.lineSoft }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, flex: 1 }}>{x[0]}</span>
                <ExportBtn filename={x[1]} headers={x[2]} rows={x[3]} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
