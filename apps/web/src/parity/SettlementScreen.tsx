import React, { useState } from "react";
import { T } from "./tokens";
import { clientById } from "./components-data";
import { pushParamAudit } from "./param-audit-support";
import { settleOrders, STL_STATUS, STL_NEXT } from "./settlement-support";

// Source : docs/reference/olive-demo.html 31563–31691 — porté verbatim.
export function SettlementScreen({ user }: { user?: any }) {
  const [sel, setSel] = useState<any>(null);
  const [, bump] = useState(0);
  const re = function () { bump(function (x) { return x + 1; }); };
  const card: React.CSSProperties = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  const canOps = user && ["CO", "CO_SR", "ADMIN", "DIR", "MLRO"].indexOf(user.role) >= 0;
  const ORD = settleOrders();
  const byS: any = {};
  ORD.forEach(function (o) { byS[o.status] = (byS[o.status] || 0) + 1; });
  const selO = sel ? ORD.find(function (o) { return o.token === sel; }) : null;
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>⛓ Exécution & Settlement</div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>Tout ordre — paiement ou titres — est tokenisé en ordre de règlement : jeton unique, hachage chaîné, jambes cash/titres (DVP), cut-offs.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
        {["CREATED", "VALIDATED", "SENT", "SETTLED"].map(function (st) {
          return (
            <div key={st} style={{ background: T.surface, border: "1px solid " + T.line, borderRadius: 12, padding: "11px 14px" }}>
              <div style={{ fontSize: 17, fontWeight: 800, fontFamily: "monospace", color: T[STL_STATUS[st][1]] || T.ink }}>{byS[st] || 0}</div>
              <div style={{ fontSize: 9, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4 }}>{STL_STATUS[st][0]}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 14, alignItems: "start" }}>
        <div style={card}>
          {ORD.map(function (o) {
            const st = STL_STATUS[o.status];
            return (
              <div key={o.token} onClick={function () { setSel(o.token); }} style={{ display: "flex", gap: 9, alignItems: "center", padding: "8px 10px", borderRadius: 9, cursor: "pointer", background: sel === o.token ? T.oliveSoft : "transparent", border: "1px solid " + (sel === o.token ? T.olive600 : "transparent") }}>
                <span style={{ fontSize: 12 }}>{o.kind === "SEC" ? "▦" : "➢"}</span>
                <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 800, color: T.olive700, width: 140, flexShrink: 0 }}>{o.token}</span>
                <span style={{ fontSize: 10.5, color: T.inkMid, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.legs[0].detail}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: T[st[1]] || T.inkSoft, background: (T[st[1] + "Soft"] || T.cream), padding: "3px 9px", borderRadius: 9, flexShrink: 0 }}>{st[0]}</span>
                {STL_NEXT[o.status] && <button onClick={function (e) { e.stopPropagation(); if (canOps) { o.status = STL_NEXT[o.status]; pushParamAudit((user && user.name) || "—", "Settlement — " + o.token + " → " + o.status); re(); } }} disabled={!canOps} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid " + T.olive600, background: "transparent", color: canOps ? T.olive700 : T.line, fontSize: 9, fontWeight: 800, cursor: canOps ? "pointer" : "not-allowed", flexShrink: 0 }}>▶ {STL_STATUS[STL_NEXT[o.status]][0]}</button>}
              </div>
            );
          })}
        </div>
        <div style={card}>
          {!selO && <div style={{ fontSize: 11, color: T.inkSoft, fontStyle: "italic" }}>Sélectionnez un ordre — le détail montre le jeton, le hachage chaîné et les jambes de règlement.</div>}
          {selO && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 8 }}>{selO.token}</div>
              {[["Type", selO.kind === "SEC" ? "Ordre titres (DVP)" : "Ordre de paiement"], ["Client", selO.clientName || (clientById[selO.clientId] || {}).name || "—"], ["Hash", "0x" + selO.hash], ["Hash précédent", "0x" + selO.prevHash], ["Créé le", selO.at]].map(function (x, i) {
                return (
                  <div key={i} style={{ marginBottom: 7 }}>
                    <div style={{ fontSize: 9, color: T.inkSoft, textTransform: "uppercase" }}>{x[0]}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: T.ink, fontFamily: i >= 2 ? "monospace" : "inherit", wordBreak: "break-all" }}>{x[1]}</div>
                  </div>
                );
              })}
              <div style={{ fontSize: 9, color: T.inkSoft, textTransform: "uppercase", marginBottom: 5 }}>Jambes de règlement</div>
              {selO.legs.map(function (l: any, i: number) {
                return (
                  <div key={i} style={{ padding: "8px 10px", borderRadius: 9, background: T.cream, marginBottom: 6 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 800, color: l.type === "TITRES" ? T.violet : T.olive700 }}>{l.type} · via {l.via}{l.cutoff ? (" · cut-off " + l.cutoff) : ""}</div>
                    <div style={{ fontSize: 10.5, color: T.inkMid, marginTop: 2 }}>{l.detail}</div>
                  </div>
                );
              })}
              <div style={{ fontSize: 9.5, color: T.inkSoft, marginTop: 6 }}>La tokenisation (hachage chaîné) rend chaque ordre référençable de bout en bout — même mécanique que l'audit trail HMAC du backend.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
