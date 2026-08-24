import React, { useState } from "react";
import { T } from "./tokens";
import { Badge } from "./components";
import { ExportBtn } from "./components-data";
import { AML_ALERTS, aiContextualizeAlert } from "./aml-workspace-support";

// Source : docs/reference/olive-demo.html 33016–33082 — porté verbatim.
export function InvestScreen() {
  const alerts = AML_ALERTS;
  const byClient: any = {};
  alerts.forEach(a => { (byClient[a.clientId] = byClient[a.clientId] || []).push(a); });
  const cases = Object.keys(byClient).filter(k => byClient[k].length >= 2).map((k, i) => ({ id: "CASE-2026-" + String(i + 1).padStart(3, "0"), clientId: k, clientName: byClient[k][0].clientName, alerts: byClient[k] }));
  const [sel, setSel] = useState<any>(null);
  const c = cases.find(x => x.id === sel);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Investigation financière</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Cas compliance — alertes reliées</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <ExportBtn filename="cas-compliance.csv" headers={["Cas", "Client", "Nb alertes", "Types"]} rows={() => cases.map(x => [x.id, x.clientName, x.alerts.length, x.alerts.map((a: any) => a.alertType).join("+")])} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
          {cases.map((x, i) => (
            <div key={x.id} onClick={() => setSel(x.id)} style={{ padding: "12px 16px", borderTop: i ? `1px solid ${T.lineSoft}` : "none", cursor: "pointer", background: sel === x.id ? T.oliveSoft : "transparent" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 11.5, color: T.olive700 }}>{x.id}</span>
                <Badge text={x.alerts.length + " alertes"} color={T.red} bg={T.redSoft} />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, marginTop: 3 }}>{x.clientName}</div>
            </div>
          ))}
          {cases.length === 0 && <div style={{ padding: 16, fontSize: 12, color: T.inkSoft, fontStyle: "italic" }}>Aucun cas (un cas = ≥2 alertes reliées au même client).</div>}
        </div>
        <div>
          {!c && <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 24, fontSize: 12.5, color: T.inkSoft, fontStyle: "italic" }}>Sélectionnez un cas : un cas regroupe toutes les alertes d'un même client pour une investigation unifiée (contexte KYC, UBO, transactions) au lieu d'un traitement alerte par alerte.</div>}
          {c && (() => {
            const ctx = aiContextualizeAlert(c.alerts[0]);
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: T.violetSoft, border: `1px solid ${T.violet}30`, borderRadius: 14, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span>✨</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: T.ink }}>Synthèse IA du cas {c.id}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: T.inkMid, lineHeight: 1.65 }}>
                    {c.alerts.length} alertes convergentes sur <strong>{c.clientName}</strong> ({c.alerts.map((a: any) => a.alertLabel).join(" · ")}). {ctx.summary}
                  </div>
                </div>
                <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
                  {c.alerts.map((a: any, i: number) => (
                    <div key={a.id} style={{ padding: "11px 16px", borderTop: i ? `1px solid ${T.lineSoft}` : "none", display: "flex", gap: 12, alignItems: "center" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 10.5, color: T.inkSoft }}>{a.id}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, flex: 1 }}>{a.alertLabel}</span>
                      <span style={{ fontSize: 11, color: T.inkSoft }}>{a.source}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, fontFamily: "monospace", color: a.matchConfidence >= 85 ? T.red : T.amber }}>{a.matchConfidence}%</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
