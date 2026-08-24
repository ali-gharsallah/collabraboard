import React, { useState } from "react";
import { T } from "./tokens";
import { FX_CCYS, fxHistory } from "./fx-support";

// Source : docs/reference/olive-demo.html 31692–31754 — porté verbatim.
export function FxScreen({ user }: { user?: any }) {
  void user;
  const [base, setBase] = useState("USD");
  const [amt, setAmt] = useState("1000000");
  const card: any = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  const MONTHS = ["Août", "Sept", "Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil"];
  const hist = fxHistory(base);
  const cur = hist[11];
  const prev = hist[10];
  const chg = Math.round((cur / prev - 1) * 10000) / 100;
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>💱 Multi-devise & taux de change</div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>{FX_CCYS.length} devises · fixing 2026-07-11 · historisation 12 mois par paire</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 }}>Fixings vs CHF</div>
          {FX_CCYS.filter(function (c) { return c !== "CHF"; }).map(function (c) {
            const h = fxHistory(c);
            const v = h[11];
            const d = Math.round((h[11] / h[10] - 1) * 10000) / 100;
            return (
              <div key={c} onClick={function () { setBase(c); }} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 9, cursor: "pointer", background: base === c ? T.oliveSoft : "transparent", border: "1px solid " + (base === c ? T.olive600 : "transparent") }}>
                <span style={{ fontFamily: "monospace", fontWeight: 800, color: T.ink, width: 74, flexShrink: 0 }}>{c}/CHF</span>
                <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 800, color: T.olive700, width: 80, flexShrink: 0 }}>{v.toFixed(4)}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: d >= 0 ? T.green : T.red, width: 60, flexShrink: 0 }}>{d >= 0 ? "▲" : "▼"} {Math.abs(d)}%</span>
                <svg width="130" height="26" style={{ flexShrink: 0 }}>{h.map(function (p, i) {
                  if (i === 0) return null;
                  const mn = Math.min.apply(null, h), mx = Math.max.apply(null, h), sp = mx - mn || 1;
                  const x1 = (i - 1) / 11 * 126 + 2, x2 = i / 11 * 126 + 2;
                  const y1 = 22 - ((h[i - 1] - mn) / sp) * 18, y2 = 22 - ((p - mn) / sp) * 18;
                  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={h[11] >= h[0] ? "#5A7D3A" : "#B5483C"} strokeWidth="1.6" />;
                })}</svg>
              </div>
            );
          })}
        </div>
        <div>
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 8 }}>Historique {base}/CHF — 12 mois</div>
            {hist.map(function (v, i) {
              return (
                <div key={i} style={{ display: "flex", gap: 9, alignItems: "center", padding: "3px 0", fontSize: 10.5, borderBottom: "1px solid " + T.lineSoft }}>
                  <span style={{ color: T.inkSoft, width: 46, flexShrink: 0 }}>{MONTHS[i]}</span>
                  <div style={{ flex: 1, height: 6, background: T.lineSoft, borderRadius: 3 }}>
                    <div style={{ height: "100%", width: Math.round((v - Math.min.apply(null, hist)) / (Math.max.apply(null, hist) - Math.min.apply(null, hist) || 1) * 100) + "%", background: T.olive600, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontFamily: "monospace", fontWeight: i === 11 ? 800 : 400, color: i === 11 ? T.olive700 : T.inkMid, width: 60, textAlign: "right" }}>{v.toFixed(4)}</span>
                </div>
              );
            })}
            <div style={{ fontSize: 10, color: chg >= 0 ? T.green : T.red, fontWeight: 800, marginTop: 6 }}>Variation mensuelle : {chg >= 0 ? "+" : ""}{chg}%</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 8 }}>Convertisseur</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={amt} onChange={function (e) { setAmt(e.target.value.replace(/[^\d.]/g, "")); }} style={{ flex: 1, padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 12, fontFamily: "monospace" }} />
              <span style={{ fontWeight: 800, color: T.ink }}>{base}</span>
              <span style={{ color: T.inkSoft }}>→</span>
              <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 800, color: T.olive700 }}>CHF {(parseFloat(amt || "0") * cur).toLocaleString("fr-CH", { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
