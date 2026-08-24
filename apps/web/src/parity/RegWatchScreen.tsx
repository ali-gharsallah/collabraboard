import React, { useState } from "react";
import { T } from "./tokens";
import { Badge } from "./components";
import { REG_WATCH, regWatchAi } from "./regwatch-support";
import { pushParamAudit } from "./param-audit-support";

// Source : docs/reference/olive-demo.html 32987–33015 — porté verbatim.
export function RegWatchScreen() {
  const [sel, setSel] = useState<any>(null);
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Veille réglementaire</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Veille FINMA / FATF / CDB — assistée par IA</div>
      </div>
      <div style={{ background: T.surface, border: "1px solid " + T.line, borderRadius: 12, padding: "12px 16px", marginBottom: 14, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: T.inkMid }}>
          <strong style={{ color: T.ink }}>Responsable :</strong> Isabelle Vernet (CO Senior) · revue hebdo lundi 09h00
        </span>
        <span style={{ fontSize: 10.5, color: T.inkSoft, flex: 1 }}>
          Processus : <strong>Collecte (agent IA local)</strong> → Tri (CO) → Analyse d'impact → Décision Direction → Mise en œuvre (paramétrage/workflows) → Clôture tracée
        </span>
        <button onClick={function () { REG_WATCH.unshift({ src: "FINMA", date: "2026-07-11", title: "Comm. surveillance — stablecoins et garanties (collecte IA)", impact: "MOYEN", status: "À trier", summary: "Exigences précisées pour émetteurs de stablecoins ; impact possible sur les clients crypto-actifs.", owner: "Isabelle Vernet" }); pushParamAudit("Agent IA (local)", "Veille — 1 nouvelle publication collectée (FINMA)"); setSel(0); }} style={{ padding: "7px 14px", borderRadius: 9, border: "1px solid " + T.violet, background: T.violetSoft, color: T.violet, fontSize: 10.5, fontWeight: 800, cursor: "pointer" }}>🫒 Lancer la collecte IA (locale)</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, alignItems: "start" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
          {REG_WATCH.map((r, i) => (
            <div key={r.id} onClick={() => setSel(r.id)} style={{ padding: "12px 16px", borderTop: i ? `1px solid ${T.lineSoft}` : "none", cursor: "pointer", background: sel === r.id ? T.oliveSoft : "transparent", display: "flex", gap: 12, alignItems: "center" }}>
              <Badge text={r.src} color={T.blue} bg={T.blueSoft} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{r.title}</div>
                <div style={{ fontSize: 10.5, color: T.inkSoft, fontFamily: "monospace" }}>{r.date}</div>
              </div>
              <Badge text={r.impact} color={r.impact === "HIGH" ? T.red : T.amber} bg={r.impact === "HIGH" ? T.redSoft : T.amberSoft} />
            </div>
          ))}
        </div>
        <div style={{ background: T.violetSoft, border: `1px solid ${T.violet}30`, borderRadius: 14, padding: 16, minHeight: 120 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span>✨</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: T.ink }}>Assistant IA — analyse d'impact</span>
          </div>
          {!sel && <div style={{ fontSize: 12, color: T.inkSoft, fontStyle: "italic" }}>Sélectionnez une publication pour obtenir l'analyse d'impact sur votre dispositif.</div>}
          {sel && <div style={{ fontSize: 12.5, color: T.inkMid, lineHeight: 1.65 }}>{regWatchAi(REG_WATCH.find(r => r.id === sel))}</div>}
        </div>
      </div>
    </div>
  );
}
