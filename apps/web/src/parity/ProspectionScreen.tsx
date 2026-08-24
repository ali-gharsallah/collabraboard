import React, { useState } from "react";
import { T } from "./tokens";
import { PROSPECTION_CHANNELS, PROSPECTION_EVENTS, PROSPECTION_LOG, crossSellFor, CONTACT_REPORTS } from "./prospection-support";

// pushParamAudit : piste d'audit (hors périmètre front) → no-op.
const pushParamAudit = (_actor: string, _msg: string) => {};

// Source : docs/reference/olive-demo.html 31405–31468 — porté verbatim.
export function ProspectionScreen({ user }: { user?: any }) {
  const [tab, setTab] = useState("sourcing");
  const [, bump] = useState(0);
  const re = function () { bump(function (x) { return x + 1; }); };
  const card: any = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  const xs = crossSellFor(user);
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>🧲 Pré-prospection</div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>{PROSPECTION_CHANNELS.length} canaux · {PROSPECTION_EVENTS.length} événements à venir · {xs.length} opportunités de cross-selling sur la base existante</div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: T.surface, padding: 5, borderRadius: 12, border: "1px solid " + T.line, width: "fit-content" }}>
        {([["sourcing", "🧭 Où chercher"], ["events", "🎪 Événements"], ["crosssell", "⤴ Cross-selling"], ["journal", "📓 Journal"]] as any[]).map(function (x) {
          return <button key={x[0]} onClick={function () { setTab(x[0]); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === x[0] ? T.olive600 : "transparent", color: tab === x[0] ? "#fff" : T.inkMid, fontSize: 12.5, fontWeight: tab === x[0] ? 700 : 500 }}>{x[1]}</button>;
        })}
      </div>
      {tab === "sourcing" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{PROSPECTION_CHANNELS.map(function (ch) {
          return (
            <div key={ch.id} style={card}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>{ch.icon} {ch.label}</div>
              <div style={{ fontSize: 10.5, color: T.inkMid, marginBottom: 6 }}>{ch.how}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.olive700 }}>{ch.stats}</div>
            </div>
          );
        })}</div>
      )}
      {tab === "events" && (
        <div style={card}>{PROSPECTION_EVENTS.map(function (e, i) {
          return (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: "1px solid " + T.lineSoft }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: T.olive700, background: T.oliveSoft, padding: "4px 10px", borderRadius: 9, width: 86, textAlign: "center", flexShrink: 0 }}>{e.date}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: T.ink }}>{e.label} <span style={{ fontWeight: 400, color: T.inkSoft }}>· cible : {e.cible}</span></div>
                <div style={{ fontSize: 10, color: T.inkMid }}>→ {e.todo}</div>
              </div>
              <span style={{ fontSize: 10, color: T.inkSoft, width: 110, textAlign: "right" }}>{e.rm}</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: e.status === "Inscrit" ? T.green : e.status === "Organisateur" ? T.violet : T.amber }}>{e.status}</span>
            </div>
          );
        })}</div>
      )}
      {tab === "crosssell" && (
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 8 }}>⤴ Offres dérivées des données Olive — {xs.length}</div>
          {xs.map(function (o, i) {
            return (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "7px 0", borderBottom: "1px solid " + T.lineSoft }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: T.violet, width: 170, flexShrink: 0 }}>{o.offer}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.ink, width: 170, flexShrink: 0 }}>{o.c.name}</span>
                <span style={{ fontSize: 10.5, color: T.inkMid, flex: 1 }}>{o.why}{o.link ? (" · " + o.link) : ""}</span>
                <button onClick={function () { CONTACT_REPORTS.unshift({ id: "CR-" + (6000 + CONTACT_REPORTS.length), clientId: o.c.id, personName: o.c.uboName, channel: "Rendez-vous", date: "2026-07-11", rm: (user && user.name) || o.c.rm, subject: "Cross-sell : " + o.offer, notes: o.why, nextStep: "Présenter l'offre " + o.offer, nextDate: "2026-07-25", nextDone: false }); pushParamAudit((user && user.name) || "—", "Prospection — cross-sell poussé au CRM : " + o.offer + " pour " + o.c.name); re(); }} style={{ padding: "4px 11px", borderRadius: 8, border: "1px solid " + T.olive600, background: "transparent", color: T.olive700, fontSize: 9.5, fontWeight: 800, cursor: "pointer" }}>→ CRM</button>
              </div>
            );
          })}
        </div>
      )}
      {tab === "journal" && (
        <div style={card}>{PROSPECTION_LOG.map(function (l, i) {
          return (
            <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "7px 0", borderBottom: "1px solid " + T.lineSoft, fontSize: 10.5 }}>
              <span style={{ fontFamily: "monospace", color: T.inkSoft, flexShrink: 0 }}>{l.at}</span>
              <span style={{ fontWeight: 700, color: T.olive700, flexShrink: 0 }}>{l.who}</span>
              <span style={{ color: T.inkMid }}>{l.what}</span>
            </div>
          );
        })}</div>
      )}
    </div>
  );
}
