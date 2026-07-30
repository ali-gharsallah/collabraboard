import React, { useState } from "react";
import { T } from "./tokens";
import CLIENTS from "../fixtures/CLIENTS.json";
import { Badge } from "./components";
import { ExportBtn } from "./components-data";
import { wfNomColor, wfNomBg } from "./kyc-support";
import { pushParamAudit } from "./param-audit-support";
import { regRelationRow, regFiche, regAuditSample } from "./registre-support";

// Source : docs/reference/olive-demo.html 29252–29400 — porté verbatim.
export function RegistreLbaScreen({ user }: { user?: any }) {
  const [tab, setTab] = useState("reg");
  const [riskF, setRiskF] = useState("ALL");
  const [lateOnly, setLateOnly] = useState(false);
  const [selId, setSelId] = useState<any>(null);
  const [seed, setSeed] = useState(0);
  const card: React.CSSProperties = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  const rows = (CLIENTS as any[]).map(regRelationRow).filter(function (r) {
    if (riskF !== "ALL" && r.c.risk !== riskF) return false;
    if (lateOnly && !r.reviewLate) return false;
    return true;
  });
  const allRows = (CLIENTS as any[]).map(regRelationRow);
  const nLate = allRows.filter(function (r) { return r.reviewLate; }).length;
  const nInc = allRows.filter(function (r) { return r.pct < 100; }).length;
  const nEdd = allRows.filter(function (r) { return r.wn.code[0] === "H" || r.wn.code[0] === "P"; }).length;
  const sample = seed > 0 ? regAuditSample(seed) : null;
  const VER_C: any = { CONFORME: [T.green, T.greenSoft], "RÉSERVES": [T.amber, T.amberSoft], "NON CONFORME": [T.red, T.redSoft] };
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>📖 Registre des relations d'affaires</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3 }}>
          Art. 7 LBA — obligation d'établir, d'organiser et de conserver les documents. {CLIENTS.length} relations · {nEdd} en diligence renforcée · {nLate} revue(s) en retard · {nInc} dossiers documentaires incomplets. Chaque ligne est reconstituée en direct depuis le dossier — c'est la vue que la société d'audit échantillonne.
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: T.surface, padding: 5, borderRadius: 12, border: "1px solid " + T.line, width: "fit-content" }}>
        {[["reg", "▤ Registre"], ["sample", "🎲 Échantillonnage d'audit"]].map(function (x) {
          return <button key={x[0]} onClick={function () { setTab(x[0]); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === x[0] ? T.olive600 : "transparent", color: tab === x[0] ? "#fff" : T.inkMid, fontSize: 12.5, fontWeight: tab === x[0] ? 700 : 500 }}>{x[1]}</button>;
        })}
      </div>
      {tab === "reg" && (
        <div style={card}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            {["ALL", "HIGH", "MEDIUM", "LOW"].map(function (v) {
              return <button key={v} onClick={function () { setRiskF(v); }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid " + (riskF === v ? T.olive600 : T.line), background: riskF === v ? T.oliveSoft : T.surface, color: riskF === v ? T.olive700 : T.inkMid, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{v === "ALL" ? "Tous risques" : v}</button>;
            })}
            <button onClick={function () { setLateOnly(!lateOnly); }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid " + (lateOnly ? T.red : T.line), background: lateOnly ? T.redSoft : T.surface, color: lateOnly ? T.red : T.inkMid, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>⏰ Revues en retard</button>
            <span style={{ fontSize: 11, color: T.inkSoft, marginLeft: "auto" }}>{rows.length} relation(s)</span>
            <ExportBtn filename="registre-relations-affaires-art7-LBA.csv" headers={["Relation", "Cocontractant", "Structure", "Pays", "Ouverture", "UBO", "Risque", "Gabarit", "Complétude", "Hits", "Alertes NEW", "MROS", "Revue en retard"]} rows={function () { return rows.map(function (r) { return [r.c.id, r.c.name, r.c.typeLabel || "—", r.c.country || "—", r.opened, (r.c.uboName || "—"), r.c.risk, r.wn.code, r.pct + "%", r.hits.join("/") || "—", r.alertsOpen, r.mros, r.reviewLate ? "OUI" : "non"]; }); }} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ textAlign: "left", color: T.inkSoft, textTransform: "uppercase", fontSize: 9 }}>
                  {["Relation", "Cocontractant", "Pays", "Ouverture", "UBO (art. 4)", "Risque", "Gabarit", "Complétude", "Screening", "Alertes", "MROS", "Contrôle"].map(function (h) { return <th key={h} style={{ padding: "7px 10px", borderBottom: "1px solid " + T.line }}>{h}</th>; })}
                </tr>
              </thead>
              <tbody>
                {rows.map(function (r) {
                  const f = regFiche(r);
                  const vc = VER_C[f.verdict];
                  const open = selId === r.c.id;
                  return (
                    <React.Fragment key={r.c.id}>
                      <tr onClick={function () { setSelId(open ? null : r.c.id); }} style={{ cursor: "pointer", background: open ? T.oliveSoft : "transparent" }}>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", color: T.olive700, fontWeight: 700 }}>{r.c.id}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 700, color: T.ink }}>{r.c.name}<div style={{ fontSize: 9, fontWeight: 400, color: T.inkSoft }}>{r.c.typeLabel || ""}</div></td>
                        <td style={{ padding: "8px 10px", color: T.inkMid }}>{r.c.country || "—"}</td>
                        <td style={{ padding: "8px 10px", color: T.inkMid, fontFamily: "monospace" }}>{String(r.opened).slice(0, 10)}</td>
                        <td style={{ padding: "8px 10px", color: T.inkMid }}>{r.c.uboName || "—"}</td>
                        <td style={{ padding: "8px 10px" }}><Badge text={r.c.risk} color={r.c.risk === "HIGH" ? T.red : r.c.risk === "MEDIUM" ? T.amber : T.green} bg={r.c.risk === "HIGH" ? T.redSoft : r.c.risk === "MEDIUM" ? T.amberSoft : T.greenSoft} /></td>
                        <td style={{ padding: "8px 10px" }}><Badge text={r.wn.code} color={wfNomColor(r.wn.code)} bg={wfNomBg(r.wn.code)} /></td>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", color: r.pct >= 100 ? T.green : r.pct >= 60 ? T.amber : T.red }}>{r.pct}%</td>
                        <td style={{ padding: "8px 10px", fontSize: 10, color: r.hits.length ? T.red : T.green }}>{r.hits.length ? r.hits.join("/").toUpperCase() : "CLEAR"}</td>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", color: r.alertsOpen ? T.amber : T.inkSoft }}>{r.alertsOpen || "—"}</td>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", color: r.mros ? T.violet : T.inkSoft }}>{r.mros || "—"}</td>
                        <td style={{ padding: "8px 10px" }}><span style={{ fontSize: 9, fontWeight: 800, color: vc[0], background: vc[1], padding: "3px 9px", borderRadius: 10, whiteSpace: "nowrap" }}>{f.verdict}</span></td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={12} style={{ padding: "0 10px 12px" }}>
                            <div style={{ background: T.cream, borderRadius: 10, padding: "12px 16px" }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 8 }}>Fiche de contrôle — {r.c.name}</div>
                              {f.checks.map(function (ch: any, i: number) {
                                return (
                                  <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "4px 0", borderBottom: "1px solid " + T.lineSoft }}>
                                    <span style={{ fontWeight: 800, color: ch.ok ? T.green : T.red }}>{ch.ok ? "✓" : "✗"}</span>
                                    <span style={{ fontSize: 11, color: T.ink, flex: 1 }}>{ch.label}</span>
                                    <span style={{ fontSize: 10, color: T.inkSoft }}>{ch.note}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === "sample" && (
        <div>
          <div style={Object.assign({}, card, { marginBottom: 14 })}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>🎲 Échantillonnage d'audit — stratifié par risque</div>
            <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 12 }}>Méthode de la société d'audit : 10 relations (4 HIGH · 4 MEDIUM · 2 LOW), tirage reproductible — le même numéro de tirage redonne exactement le même échantillon, exigence de traçabilité.</div>
            <button onClick={function () { setSeed(seed + 1); setSelId(null); pushParamAudit((user && user.name) || "—", "Registre LBA — tirage d'échantillon d'audit n°" + (seed + 1) + " (10 relations, stratifié)"); }} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{seed === 0 ? "▶ Tirer l'échantillon n°1" : "↻ Nouveau tirage (n°" + (seed + 1) + ")"}</button>
          </div>
          {sample && (function () {
            const fiches = sample.map(function (r) { return { r: r, f: regFiche(r) }; });
            const conf = fiches.filter(function (x) { return x.f.verdict === "CONFORME"; }).length;
            return (
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 }}>
                  Tirage n°{seed} — conformité de l'échantillon : <span style={{ color: conf >= 8 ? T.green : conf >= 6 ? T.amber : T.red }}>{conf}/10 conformes</span> · {fiches.filter(function (x) { return x.f.verdict === "RÉSERVES"; }).length} avec réserves · {fiches.filter(function (x) { return x.f.verdict === "NON CONFORME"; }).length} non conforme(s)
                </div>
                {fiches.map(function (x) {
                  const vc = VER_C[x.f.verdict];
                  const open = selId === x.r.c.id;
                  return (
                    <div key={x.r.c.id} style={{ marginBottom: 8 }}>
                      <div onClick={function () { setSelId(open ? null : x.r.c.id); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, border: "1.5px solid " + (open ? T.olive600 : T.lineSoft), background: open ? T.oliveSoft : T.cream, cursor: "pointer" }}>
                        <Badge text={x.r.c.risk} color={x.r.c.risk === "HIGH" ? T.red : x.r.c.risk === "MEDIUM" ? T.amber : T.green} bg={x.r.c.risk === "HIGH" ? T.redSoft : x.r.c.risk === "MEDIUM" ? T.amberSoft : T.greenSoft} />
                        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: T.ink }}>{x.r.c.name} <span style={{ fontWeight: 400, color: T.inkSoft }}>· {x.r.c.id} · {x.r.wn.code} · {x.r.pct}%</span></span>
                        <span style={{ fontSize: 9, fontWeight: 800, color: vc[0], background: vc[1], padding: "3px 10px", borderRadius: 12 }}>{x.f.verdict}</span>
                      </div>
                      {open && (
                        <div style={{ background: T.cream, borderRadius: 10, padding: "10px 16px", marginTop: 4 }}>
                          {x.f.checks.map(function (ch: any, i: number) {
                            return (
                              <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "3px 0" }}>
                                <span style={{ fontWeight: 800, color: ch.ok ? T.green : T.red }}>{ch.ok ? "✓" : "✗"}</span>
                                <span style={{ fontSize: 11, color: T.ink, flex: 1 }}>{ch.label}</span>
                                <span style={{ fontSize: 10, color: T.inkSoft }}>{ch.note}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
