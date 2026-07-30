import React, { useState } from "react";
import { T } from "./tokens";
import { pushParamAudit } from "./param-audit-support";
import { API_SPEC, apiOpenapiYaml } from "./apidoc-support";

// Source : docs/reference/olive-demo.html 31257–31404 — porté verbatim.
export function ApiDocScreen({ user }: { user?: any }) {
  const [open, setOpen] = useState<any>(null);
  const card: React.CSSProperties = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  const MC: any = { GET: T.blue, POST: T.olive700, PATCH: T.amber, DELETE: T.red };
  return (
    <div>
      <div style={{ marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>⇌ API Olive — v1</div>
          <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 3 }}>Base https://olive.banque.ch/api/v1 · Authorization: Bearer (JWT RS256, 15 min) · Idempotency-Key sur tout POST · erreurs RFC 7807 · pagination cursor · versionnage par en-tête Accept.</div>
        </div>
        <button onClick={function () { const blob = new Blob([apiOpenapiYaml()], { type: "text/yaml" }); const u = URL.createObjectURL(blob); const el = document.createElement("a"); el.href = u; el.download = "olive-openapi-v1.yaml"; el.click(); URL.revokeObjectURL(u); pushParamAudit((user && user.name) || "—", "API — export OpenAPI 3.1"); }} style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid " + T.olive600, background: "transparent", color: T.olive700, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>⬇ OpenAPI 3.1 (yaml)</button>
      </div>
      {API_SPEC.map(function (g) {
        return (
          <div key={g[1]} style={Object.assign({}, card, { marginBottom: 12 })}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.olive700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{g[0]}</div>
            {g[2].map(function (e: any, i: number) {
              const k = g[1] + i;
              const isOpen = open === k;
              return (
                <div key={k} style={{ borderBottom: "1px solid " + T.lineSoft }}>
                  <div onClick={function () { setOpen(isOpen ? null : k); }} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "8px 0", cursor: "pointer" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 800, color: MC[e.m] || T.ink, width: 48, flexShrink: 0 }}>{e.m}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: T.ink, flex: "0 0 360px" }}>{e.p}</span>
                    <span style={{ fontSize: 10.5, color: T.inkMid, flex: 1 }}>{e.d}</span>
                    <span style={{ fontSize: 9, color: T.inkSoft }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                  {isOpen && (
                    <div style={{ background: T.cream, borderRadius: 10, padding: "11px 14px", marginBottom: 8 }}>
                      <div style={{ display: "flex", gap: 16, fontSize: 9.5, color: T.inkSoft, marginBottom: 8 }}>
                        <span>Scopes : <strong style={{ color: T.ink }}>{e.scopes}</strong></span>
                        <span>Rate limit : <strong style={{ color: T.ink }}>{e.rl}</strong></span>
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase" }}>Requête</div>
                      <pre style={{ whiteSpace: "pre-wrap", fontSize: 10, fontFamily: "monospace", color: T.inkMid, background: T.surface, borderRadius: 8, padding: "8px 10px", margin: "4px 0 8px", wordBreak: "break-all" }}>{e.req}</pre>
                      <div style={{ fontSize: 9, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase" }}>Réponse 200</div>
                      <pre style={{ whiteSpace: "pre-wrap", fontSize: 10, fontFamily: "monospace", color: T.inkMid, background: T.surface, borderRadius: 8, padding: "8px 10px", margin: "4px 0 8px", wordBreak: "break-all" }}>{e.res}</pre>
                      <div style={{ fontSize: 9, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 3 }}>Erreurs</div>
                      {e.err.map(function (er: any, j: number) { return <div key={j} style={{ fontSize: 10, color: T.inkMid, padding: "1px 0" }}><span style={{ fontFamily: "monospace", fontWeight: 800, color: T.red }}>{er[0]}</span> {er[1]}</div>; })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
