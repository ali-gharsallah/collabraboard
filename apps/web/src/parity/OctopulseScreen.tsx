import React, { useState } from "react";
import { T } from "./tokens";
import { clientById } from "./components-data";
import { amlHash } from "./preonboarding-support";
import { pushParamAudit } from "./param-audit-support";
import { OCTOPULSE_CFG, OCTOPULSE_INCIDENTS } from "./octopulse-support";

// Source : docs/reference/olive-demo.html 31477–31562 — porté verbatim.
export function OctopulseScreen({ user }: { user?: any }) {
  const [, bump] = useState(0);
  const re = function () { bump(function (x) { return x + 1; }); };
  const card: React.CSSProperties = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  const SEV: any = { HIGH: ["red"], MEDIUM: ["amber"], LOW: ["green"] };
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>🐙 Octopulse — Operational Risk</div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>Solution OppRisk intégrée à Olive par API — incidents opérationnels rattachés aux relations et aux modules.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, alignItems: "start" }}>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 }}>⇌ Connecteur</div>
          {[["Statut", OCTOPULSE_CFG.connected ? "● Connecté" : "○ Déconnecté", OCTOPULSE_CFG.connected ? T.green : T.red], ["Endpoint", OCTOPULSE_CFG.url, T.inkMid], ["Clé API", OCTOPULSE_CFG.apiKey, T.inkMid], ["Dernière sync", OCTOPULSE_CFG.lastSync, T.inkMid]].map(function (x: any, i: number) {
            return (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: T.inkSoft, textTransform: "uppercase" }}>{x[0]}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: x[2], fontFamily: i > 0 ? "monospace" : "inherit" }}>{x[1]}</div>
              </div>
            );
          })}
          <button onClick={function () { OCTOPULSE_CFG.lastSync = "2026-07-11 " + (10 + amlHash("SYNC" + Math.random(), 10)) + ":0" + amlHash("S2" + Math.random(), 9); pushParamAudit((user && user.name) || "—", "Octopulse — synchronisation manuelle des incidents"); re(); }} style={{ padding: "8px 15px", borderRadius: 9, border: "1px solid " + T.olive600, background: "transparent", color: T.olive700, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>↻ Synchroniser</button>
          <div style={{ fontSize: 9.5, color: T.inkSoft, marginTop: 10 }}>Flux : incidents (Octopulse → Olive) · événements compliance transfer.blocked, alert.created (Olive → Octopulse) — webhooks signés HMAC.</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 }}>Incidents synchronisés — {OCTOPULSE_INCIDENTS.length}</div>
          {OCTOPULSE_INCIDENTS.map(function (x: any) {
            const c = x.clientId ? clientById[x.clientId] : null;
            return (
              <div key={x.id} style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid " + T.lineSoft, background: T.cream, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 3 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 800, color: T.olive700 }}>{x.id}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: T[SEV[x.sev][0]], background: T[SEV[x.sev][0] + "Soft"], padding: "2px 8px", borderRadius: 8 }}>{x.sev}</span>
                  <span style={{ fontSize: 10, color: T.inkSoft }}>{x.at} · {x.cat}</span>
                  {c && <span style={{ fontSize: 10, fontWeight: 700, color: T.ink, marginLeft: "auto" }}>{c.name}</span>}
                </div>
                <div style={{ fontSize: 11, color: T.inkMid }}>{x.what}</div>
                <div style={{ fontSize: 10, color: T.olive700, fontWeight: 700, marginTop: 3 }}>Mesure : {x.ameliore}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
