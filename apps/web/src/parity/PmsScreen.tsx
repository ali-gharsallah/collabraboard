import React, { useState } from "react";
import { T } from "./tokens";
import { SectionTitle } from "./components";
import { clientById } from "./components-data";
import CLIENTS from "../fixtures/CLIENTS.json";
import {
  PMS_UNIVERSE, PMS_CLS_LABEL, pmsPortfolio, pmsEnrich, pmsReportMd, pmsRebalanceProposal,
  pmsPreTradeCheck, pmsRebalanceFor, pmsSuitability, pmsRiskMetrics, settleOrders, settleTokenize,
} from "./pms-support";
import { amlHash } from "./preonboarding-support";

// pushParamAudit : piste d'audit (hors périmètre front) → no-op.
const pushParamAudit = (_actor: string, _msg: string) => {};

// Source : docs/reference/olive-demo.html 33434–33440 — porté verbatim.
function PmsSpark({ serie, bench }: { serie: number[]; bench: number[] }) {
  const W = 560, H = 120, all = serie.concat(bench), mn = Math.min.apply(null, all) - 1, mx = Math.max.apply(null, all) + 1;
  const pt = function (arr: number[]) { return arr.map(function (y, i) { return (i * (W / 11)).toFixed(1) + "," + ((H - (y - mn) / (mx - mn) * H)).toFixed(1); }).join(" "); };
  return (
    <svg width={W} height={H + 18} style={{ display: "block" }}>
      <polyline points={pt(bench)} fill="none" stroke={T.inkSoft} strokeWidth="1.5" strokeDasharray="4 3" />
      <polyline points={pt(serie)} fill="none" stroke={T.olive600} strokeWidth="2.5" />
      <text x="0" y={H + 14} fontSize="9" fill={T.inkSoft}>12 mois — mandat (vert) vs benchmark (pointillé)</text>
    </svg>
  );
}

// Source : docs/reference/olive-demo.html 33501–33545 — porté verbatim.
function PmsMandateExtras({ c, user }: { c: any; user?: any }) {
  const [, bump] = useState(0);
  const re = function () { bump(function (x) { return x + 1; }); };
  const [pushed, setPushed] = useState(false);
  const rbl = pmsRebalanceFor(c);
  const suit = pmsSuitability(c);
  const rk = pmsRiskMetrics(c);
  const SC: any = { OK: T.green, ATTENTION: T.amber, KO: T.red };
  const box: any = { background: T.cream, borderRadius: 12, padding: "13px 15px" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
      <div style={box}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: T.ink, marginBottom: 8 }}>⚖ Rééquilibrage vers l'allocation cible</div>
        {rbl.length === 0 && <div style={{ fontSize: 10.5, color: T.green, fontWeight: 700 }}>✓ Mandat dans les bornes (±1 pt)</div>}
        {rbl.map(function (o) {
          return (
            <div key={o.isin} style={{ display: "flex", gap: 7, alignItems: "baseline", fontSize: 10, padding: "3px 0", borderBottom: "1px solid " + T.lineSoft }}>
              <span style={{ fontWeight: 800, color: o.side === "BUY" ? T.green : T.red, width: 34, flexShrink: 0 }}>{o.side}</span>
              <span style={{ color: T.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</span>
              <span style={{ fontFamily: "monospace", color: T.inkMid, flexShrink: 0 }}>{o.current}%→{o.target}% · CHF {Math.round(o.chf / 1000)}k</span>
            </div>
          );
        })}
        {rbl.length > 0 && <button disabled={pushed} onClick={function () { const ords = settleOrders(); rbl.forEach(function (o, i) { const qty = Math.max(1, Math.round(o.chf / (20 + amlHash(o.isin + "SP", 480)))); const src: any = { kind: "SEC", id: "ORD-R-" + (600 + ords.length + i), side: o.side, isin: o.isin, name: o.name, qty, ccy: o.ccy, cash: o.chf, clientId: c.id }; const tk = settleTokenize(src); ords.unshift(Object.assign({}, src, tk, { status: "CREATED", at: "2026-07-11" })); }); pushParamAudit((user && user.name) || "—", "PMS — rééquilibrage " + c.name + " : " + rbl.length + " ordre(s) → Settlement"); setPushed(true); re(); }} style={{ marginTop: 8, padding: "7px 13px", borderRadius: 9, border: "none", background: pushed ? T.line : T.olive600, color: "#fff", fontSize: 10.5, fontWeight: 800, cursor: pushed ? "not-allowed" : "pointer" }}>{pushed ? "✓ Ordres envoyés au Settlement" : "⛓ Générer les ordres (" + rbl.length + ") → Settlement"}</button>}
      </div>
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: T.ink, flex: 1 }}>✓ Adéquation LSFin</span>
          <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: SC[suit.worst], padding: "3px 10px", borderRadius: 9 }}>{suit.worst}</span>
        </div>
        {suit.checks.map(function (x) {
          return (
            <div key={x.id} style={{ display: "flex", gap: 7, alignItems: "baseline", fontSize: 10, padding: "3px 0", borderBottom: "1px solid " + T.lineSoft }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: SC[x.st], flexShrink: 0, alignSelf: "center" }} />
              <span style={{ color: T.ink, flex: 1 }}>{x.label}</span>
              <span style={{ fontFamily: "monospace", color: T.inkMid, flexShrink: 0 }}>{x.val}</span>
            </div>
          );
        })}
      </div>
      <div style={box}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: T.ink, marginBottom: 8 }}>📉 Risque du mandat</div>
        {([["Volatilité annualisée", rk.volA + "%"], ["Max drawdown 12 m", rk.mdd + "%"], ["VaR 95% · 1 mois", "CHF " + rk.var95.toLocaleString("fr-CH")], ["SRRI", rk.srri + " / 7"]] as any[]).map(function (x, i) {
          return (
            <div key={i} style={{ display: "flex", gap: 7, alignItems: "baseline", fontSize: 10.5, padding: "4px 0", borderBottom: "1px solid " + T.lineSoft }}>
              <span style={{ color: T.inkMid, flex: 1 }}>{x[0]}</span>
              <span style={{ fontFamily: "monospace", fontWeight: 800, color: T.ink }}>{x[1]}</span>
            </div>
          );
        })}
        <div style={{ marginTop: 6, display: "flex", gap: 3 }}>{[1, 2, 3, 4, 5, 6, 7].map(function (n) { return <span key={n} style={{ flex: 1, height: 7, borderRadius: 3, background: n <= rk.srri ? (rk.srri <= 3 ? T.green : rk.srri <= 5 ? T.amber : T.red) : T.lineSoft }} />; })}</div>
      </div>
    </div>
  );
}

// Source : docs/reference/olive-demo.html 33546–33781 — porté verbatim.
export function PmsScreen({ user }: { user?: any }) {
  const [tab, setTab] = useState("mand");
  const [selCid, setSelCid] = useState<string | null>(null);
  const [ptCid, setPtCid] = useState("");
  const [ptIsin, setPtIsin] = useState("");
  const [ptPct, setPtPct] = useState(5);
  const [ptRes, setPtRes] = useState<any>(null);
  const [dCid, setDCid] = useState("");
  const card: any = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  const pfs = (CLIENTS as any[]).map(pmsPortfolio);
  const nBr = pfs.reduce(function (a, p) { return a + p.breaches.length; }, 0);
  const nDrift = pfs.filter(function (p) { return p.drift >= 8; }).length;
  const VC: any = { PASS: [T.green, T.greenSoft], WARN: [T.amber, T.amberSoft], BLOCK: [T.red, T.redSoft] };
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>▦ PMS — Portfolio Management System</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3 }}>{pfs.length} mandats · {nBr} breach(es) de conformité investissement · {nDrift} portefeuille(s) en dérive ≥ 8% vs allocation cible. L'angle Olive : chaque ordre est contrôlé AVANT exécution (suitability LSFin, concentration, ESG, Shariah).</div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: T.surface, padding: 5, borderRadius: 12, border: "1px solid " + T.line, width: "fit-content" }}>
        {([["mand", "▦ Mandats"], ["detail", "📈 Mandat détail"], ["ctrl", "⚖ Contrôles & dérives"], ["pretrade", "🧪 Pre-Trade Check"]] as any[]).map(function (x) {
          return <button key={x[0]} onClick={function () { setTab(x[0]); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === x[0] ? T.olive600 : "transparent", color: tab === x[0] ? "#fff" : T.inkMid, fontSize: 12.5, fontWeight: tab === x[0] ? 700 : 500 }}>{x[1]}</button>;
        })}
      </div>
      {tab === "mand" && (
        <div style={card}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ textAlign: "left", color: T.inkSoft, textTransform: "uppercase", fontSize: 9 }}>{["Client", "Mandat", "Profil LSFin", "Devise", "Valeur", "Perf YTD", "vs bench", "Dérive", "Breaches"].map(function (h) { return <th key={h} style={{ padding: "7px 10px", borderBottom: "1px solid " + T.line }}>{h}</th>; })}</tr>
              </thead>
              <tbody>{pfs.map(function (pf) {
                const open = selCid === pf.c.id;
                const d = pf.perfYtd - pf.bench;
                return (
                  <React.Fragment key={pf.c.id}>
                    <tr onClick={function () { setSelCid(open ? null : pf.c.id); }} style={{ cursor: "pointer", background: open ? T.oliveSoft : "transparent" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: T.ink }}>{pf.c.name}{pf.islamic && <span title="Mandat islamique"> ☪</span>}{pf.esgExcl && <span title="Exclusions ESG"> 🌱</span>}</td>
                      <td style={{ padding: "8px 10px", color: T.inkMid }}>{pf.mandate}</td>
                      <td style={{ padding: "8px 10px", color: T.inkMid }}>{pf.profile}</td>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace", color: T.inkMid }}>{pf.refCcy}</td>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace", color: T.ink, fontWeight: 700 }}>{pf.totalM.toFixed(1)}M</td>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: 700, color: pf.perfYtd >= 0 ? T.green : T.red }}>{pf.perfYtd > 0 ? "+" : ""}{pf.perfYtd}%</td>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace", color: d >= 0 ? T.green : T.red }}>{d >= 0 ? "+" : ""}{Math.round(d * 10) / 10}%</td>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace", color: pf.drift >= 8 ? T.red : pf.drift >= 5 ? T.amber : T.green }}>{pf.drift}%</td>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace", color: pf.breaches.length ? T.red : T.inkSoft }}>{pf.breaches.length || "—"}</td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={9} style={{ padding: "0 10px 12px" }}>
                          <div style={{ background: T.cream, borderRadius: 10, padding: "12px 16px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 6 }}>Positions ({pf.positions.length})</div>
                                {pf.positions.map(function (p: any) {
                                  return (
                                    <div key={p.ins.isin} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 10.5, padding: "3px 0", borderBottom: "1px solid " + T.lineSoft }}>
                                      <span style={{ flex: 1, color: T.ink, fontWeight: 600 }}>{p.ins.name}</span>
                                      <span style={{ fontFamily: "monospace", fontSize: 9, color: T.inkSoft }}>{p.ins.isin}</span>
                                      <span style={{ color: T.inkSoft, width: 66 }}>{PMS_CLS_LABEL[p.ins.cls]}</span>
                                      <span style={{ fontFamily: "monospace", width: 44, textAlign: "right", color: T.ink }}>{p.weight}%</span>
                                      <span style={{ fontFamily: "monospace", width: 52, textAlign: "right", color: T.inkMid }}>{p.valM.toFixed(2)}M</span>
                                      <span style={{ fontFamily: "monospace", width: 48, textAlign: "right", fontWeight: 700, color: p.perf >= 0 ? T.green : T.red }}>{p.perf > 0 ? "+" : ""}{p.perf}%</span>
                                    </div>
                                  );
                                })}
                              </div>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 6 }}>Allocation vs cible ({pf.profile})</div>
                                {Object.keys(pf.prof.target).map(function (k) {
                                  const a = pf.alloc[k] || 0, t = pf.prof.target[k];
                                  return (
                                    <div key={k} style={{ marginBottom: 5 }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: T.inkMid }}>
                                        <span>{PMS_CLS_LABEL[k]}</span>
                                        <span style={{ fontFamily: "monospace" }}>{a}% / cible {t}%</span>
                                      </div>
                                      <div style={{ position: "relative", height: 6, background: T.lineSoft, borderRadius: 3 }}>
                                        <div style={{ position: "absolute", height: "100%", width: Math.min(100, a) + "%", background: Math.abs(a - t) >= 6 ? T.amber : T.olive600, borderRadius: 3 }} />
                                        <div style={{ position: "absolute", left: Math.min(100, t) + "%", top: -2, width: 2, height: 10, background: T.ink }} />
                                      </div>
                                    </div>
                                  );
                                })}
                                {pf.breaches.length > 0 && (
                                  <div style={{ marginTop: 10 }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: T.red, textTransform: "uppercase", marginBottom: 4 }}>Breaches ({pf.breaches.length})</div>
                                    {pf.breaches.map(function (b: any, i: number) { return <div key={i} style={{ fontSize: 10, color: T.inkMid, marginBottom: 3 }}>⚠ <strong>{b.type}</strong> — {b.msg}</div>; })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      )}
      {tab === "detail" && (function () {
        const c = dCid ? (clientById as any)[dCid] : null;
        const e = c ? pmsEnrich(c) : null;
        return (
          <div style={{ background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 }}>
            {c && <PmsMandateExtras key={c.id} c={c} user={user} />}
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
              <select value={dCid} onChange={function (ev) { setDCid(ev.target.value); }} style={{ padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5, minWidth: 240 }}>
                <option value="">— Mandat / client —</option>
                {(CLIENTS as any[]).slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (x) { return <option key={x.id} value={x.id}>{x.name}</option>; })}
              </select>
              {e && <button onClick={function () { const blob = new Blob([pmsReportMd(c, e)], { type: "text/markdown" }); const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = "rapport-gestion-" + c.id + ".md"; a.click(); URL.revokeObjectURL(u); pushParamAudit((user && user.name) || "—", "PMS — rapport de gestion téléchargé : " + c.name); }} style={{ marginLeft: "auto", padding: "8px 15px", borderRadius: 9, border: "1px solid " + T.olive600, background: "transparent", color: T.olive700, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>⬇ Rapport de gestion</button>}
            </div>
            {!e && <div style={{ fontSize: 11.5, color: T.inkSoft, fontStyle: "italic" }}>Sélectionnez un mandat.</div>}
            {e && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 14 }}>{([["Valorisation", "CHF " + e.totalChf.toLocaleString("fr-CH")], ["Liquidités", "CHF " + e.cash.toLocaleString("fr-CH")], ["Perf YTD", (e.ytd > 0 ? "+" : "") + e.ytd + "%"], ["Frais gestion", e.mgmtFee + "% p.a."], ["TER", e.ter + "%"]] as any[]).map(function (k, i) {
                  return (
                    <div key={i} style={{ background: T.cream, borderRadius: 11, padding: "10px 13px" }}>
                      <div style={{ fontSize: 9, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4 }}>{k[0]}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", color: i === 2 ? (e.ytd >= 0 ? T.green : T.red) : T.ink }}>{k[1]}</div>
                    </div>
                  );
                })}</div>
                <PmsSpark serie={e.perf} bench={e.bench} />
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14 }}>
                  <thead>
                    <tr style={{ background: T.lineSoft }}>{["Instrument", "ISIN", "Qté", "Prix", "Valeur CHF", "Poids", "P&L %", "P&L CHF"].map(function (h) { return <th key={h} style={{ padding: "8px 10px", textAlign: h === "Instrument" ? "left" : "right", fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase" }}>{h}</th>; })}</tr>
                  </thead>
                  <tbody>{e.positions.map(function (p: any, i: number) {
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid " + T.lineSoft }}>
                        <td style={{ padding: "7px 10px", fontSize: 11, fontWeight: 700, color: T.ink }}>{p.name || p.isin}</td>
                        <td style={{ padding: "7px 10px", fontSize: 10, fontFamily: "monospace", color: T.inkSoft, textAlign: "right" }}>{p.isin || "—"}</td>
                        <td style={{ padding: "7px 10px", fontSize: 10.5, fontFamily: "monospace", textAlign: "right" }}>{p.qty.toLocaleString("fr-CH")}</td>
                        <td style={{ padding: "7px 10px", fontSize: 10.5, fontFamily: "monospace", textAlign: "right" }}>{p.priceNow}</td>
                        <td style={{ padding: "7px 10px", fontSize: 10.5, fontFamily: "monospace", textAlign: "right" }}>{p.valueChf.toLocaleString("fr-CH")}</td>
                        <td style={{ padding: "7px 10px", fontSize: 10.5, fontFamily: "monospace", textAlign: "right" }}>{p.pct}%</td>
                        <td style={{ padding: "7px 10px", fontSize: 10.5, fontFamily: "monospace", fontWeight: 800, textAlign: "right", color: p.pnlPct >= 0 ? T.green : T.red }}>{(p.pnlPct > 0 ? "+" : "") + p.pnlPct}%</td>
                        <td style={{ padding: "7px 10px", fontSize: 10.5, fontFamily: "monospace", textAlign: "right", color: p.pnlChf >= 0 ? T.green : T.red }}>{p.pnlChf.toLocaleString("fr-CH")}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}
      {tab === "ctrl" && (
        <div>
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 }}>⚖ Breaches de conformité investissement — {nBr} au total</div>
            {["SUITABILITY", "CONCENTRATION", "RESTRICTION ESG", "SHARIAH"].map(function (tp) {
              const list: any[] = [];
              pfs.forEach(function (pf) { pf.breaches.filter(function (b: any) { return b.type === tp; }).forEach(function (b: any) { list.push({ pf, b }); }); });
              if (!list.length) return null;
              return (
                <div key={tp} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: T.red, textTransform: "uppercase", marginBottom: 5 }}>{tp} — {list.length}</div>
                  {list.slice(0, 6).map(function (x, i) { return <div key={i} style={{ fontSize: 10.5, color: T.inkMid, padding: "3px 0", borderBottom: "1px solid " + T.lineSoft }}><strong style={{ color: T.ink }}>{x.pf.c.name}</strong> — {x.b.msg}</div>; })}
                  {list.length > 6 && <div style={{ fontSize: 9.5, color: T.inkSoft, marginTop: 3 }}>… et {list.length - 6} autre(s)</div>}
                </div>
              );
            })}
          </div>
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 4 }}>Dérives d'allocation — propositions de rebalancement</div>
            <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 12 }}>Portefeuilles en dérive ≥ 8% vs cible. Les propositions sont générées par classe (vendre le surpondéré, acheter le sous-pondéré) — l'exécution reste une décision du gérant, tracée.</div>
            {pfs.filter(function (p) { return p.drift >= 8; }).sort(function (a, b) { return b.drift - a.drift; }).slice(0, 10).map(function (pf) {
              const mv = pmsRebalanceProposal(pf);
              return (
                <div key={pf.c.id} style={{ padding: "9px 12px", borderRadius: 9, background: T.cream, marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, flex: 1 }}>{pf.c.name} <span style={{ fontWeight: 400, color: T.inkSoft }}>· {pf.profile} · {pf.totalM.toFixed(1)}M</span></span>
                    <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 800, color: T.red }}>dérive {pf.drift}%</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: T.inkMid }}>{mv.map(function (m: any) { return (m.delta > 0 ? "Vendre " : "Acheter ") + PMS_CLS_LABEL[m.cls] + " " + m.amtM.toFixed(2) + "M (" + (m.delta > 0 ? "+" : "") + m.delta + "%)"; }).join(" · ") || "Ajustements mineurs par classe"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {tab === "pretrade" && (
        <div>
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>🧪 Pre-Trade Check — le contrôle AVANT l'ordre</div>
            <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 12 }}>Simulez un ordre : le moteur vérifie suitability LSFin, concentration, restrictions ESG, conformité Shariah et plancher de liquidités. Un BLOCK est bloquant ; chaque contrôle est tracé dans la piste d'audit.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select value={ptCid} onChange={function (e) { setPtCid(e.target.value); setPtRes(null); }} style={{ flex: "1 1 220px", padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5 }}>
                <option value="">— Portefeuille —</option>
                {pfs.map(function (pf) { return <option key={pf.c.id} value={pf.c.id}>{pf.c.name} · {pf.profile}{pf.islamic ? " ☪" : ""}{pf.esgExcl ? " 🌱" : ""}</option>; })}
              </select>
              <select value={ptIsin} onChange={function (e) { setPtIsin(e.target.value); setPtRes(null); }} style={{ flex: "1 1 260px", padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5 }}>
                <option value="">— Instrument —</option>
                {PMS_UNIVERSE.filter(function (x) { return x.cls !== "LIQ"; }).map(function (x) { return <option key={x.isin} value={x.isin}>{x.name} · {PMS_CLS_LABEL[x.cls]} · risque {x.riskLvl}</option>; })}
              </select>
              <select value={ptPct} onChange={function (e) { setPtPct(parseInt(e.target.value)); setPtRes(null); }} style={{ padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5 }}>{[2, 5, 8, 12, 18].map(function (v) { return <option key={v} value={v}>{v}% du portefeuille</option>; })}</select>
              <button onClick={function () { const pf = pfs.find(function (x) { return x.c.id === ptCid; }); const ins = PMS_UNIVERSE.find(function (x) { return x.isin === ptIsin; }); if (pf && ins) setPtRes(pmsPreTradeCheck(pf, ins, ptPct, user)); }} disabled={!ptCid || !ptIsin} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: (ptCid && ptIsin) ? T.olive600 : T.line, color: "#fff", fontSize: 12, fontWeight: 800, cursor: (ptCid && ptIsin) ? "pointer" : "not-allowed" }}>▶ Exécuter le contrôle</button>
            </div>
          </div>
          {ptRes && (
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: VC[ptRes.verdict][0], background: VC[ptRes.verdict][1], padding: "6px 16px", borderRadius: 12 }}>{ptRes.verdict === "PASS" ? "✓ PASS — ordre autorisé" : ptRes.verdict === "WARN" ? "⚠ WARN — dérogation requise" : "⛔ BLOCK — ordre bloqué"}</span>
                <span style={{ fontSize: 10.5, color: T.inkSoft }}>{ptRes.fails} contrôle(s) en échec · consigné dans la piste d'audit</span>
              </div>
              {ptRes.checks.map(function (ch: any, i: number) {
                return (
                  <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "5px 0", borderBottom: "1px solid " + T.lineSoft }}>
                    <span style={{ fontWeight: 800, color: ch.ok ? T.green : T.red }}>{ch.ok ? "✓" : "✗"}</span>
                    <span style={{ fontSize: 11.5, color: T.ink, width: 230, flexShrink: 0 }}>{ch.label}</span>
                    <span style={{ fontSize: 10.5, color: T.inkSoft }}>{ch.note}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
