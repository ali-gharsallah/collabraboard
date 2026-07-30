import React, { useState } from "react";
import { T } from "./tokens";
import { SWIFT_SAMPLES, swiftAnalyze } from "./swift-support";
import { pushParamAudit } from "./param-audit-support";

// Source : docs/reference/olive-demo.html 31880–32036 — porté verbatim.
export function SwiftLabScreen({ user }: { user?: any }) {
  const [txt, setTxt] = useState(SWIFT_SAMPLES[0][1]);
  const [res, setRes] = useState<any>(null);
  const card: React.CSSProperties = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  const LC: any = { OK: T.green, ATTENTION: T.amber, KO: T.red };
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>🔬 Analyseur SWIFT / SEPA</div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>Décorticage champ par champ — MT103, MT202/COV, pain.001 — chaque composante passée au screening, aux pays à risque et au FX.</div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {SWIFT_SAMPLES.map(function (x, i) {
          return <button key={i} onClick={function () { setTxt(x[1]); setRes(null); }} style={{ padding: "6px 13px", borderRadius: 8, border: "1px solid " + T.line, background: T.surface, color: T.inkMid, fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>{x[0]}</button>;
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
        <div style={card}>
          <textarea value={txt} onChange={function (e) { setTxt(e.target.value); }} rows={15} style={{ width: "100%", boxSizing: "border-box", fontFamily: "monospace", fontSize: 10.5, padding: "10px 12px", borderRadius: 10, border: "1px solid " + T.line, resize: "vertical" }} />
          <button onClick={function () { setRes(swiftAnalyze(txt)); pushParamAudit((user && user.name) || "—", "SWIFT Lab — analyse d'un message"); }} style={{ marginTop: 8, padding: "9px 18px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>🔬 Décortiquer</button>
        </div>
        <div style={card}>
          {!res && <div style={{ fontSize: 11, color: T.inkSoft, fontStyle: "italic" }}>Collez un message (ou prenez un exemple) puis « Décortiquer ».</div>}
          {res && (
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: T.olive700, marginBottom: 10 }}>{res.type}</div>
              {res.fields.map(function (f: any, i: number) {
                return (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "5px 0", borderBottom: "1px solid " + T.lineSoft }}>
                    <span style={{ fontFamily: "monospace", fontSize: 9.5, fontWeight: 800, color: T.violet, width: 64, flexShrink: 0 }}>{f.tag}</span>
                    <span style={{ fontSize: 10, color: T.inkSoft, width: 130, flexShrink: 0 }}>{f.label}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: T.ink, flex: 1, wordBreak: "break-all" }}>
                      {f.val}
                      {f.note ? <span style={{ fontWeight: 400, color: T.inkSoft }}> — {f.note}</span> : null}
                    </span>
                  </div>
                );
              })}
              <div style={{ fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", margin: "12px 0 6px" }}>Contrôles</div>
              {res.checks.map(function (c: any, i: number) {
                return (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "4px 0" }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: LC[c.level], padding: "2px 9px", borderRadius: 8, width: 74, textAlign: "center", flexShrink: 0 }}>{c.level}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: T.ink, width: 180, flexShrink: 0 }}>{c.label}</span>
                    <span style={{ fontSize: 10, color: T.inkMid, flex: 1 }}>{c.note}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
