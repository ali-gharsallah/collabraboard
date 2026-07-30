import React, { useState } from "react";
import { T } from "./tokens";
import CLIENTS from "../fixtures/CLIENTS.json";
import { CORROB_STATUS, corroborationFor } from "./corrob-support";
import { pushParamAudit } from "./param-audit-support";

// Source : docs/reference/olive-demo.html 32037–32099 — porté verbatim.
export function CorroborationScreen({ user }: { user?: any }) {
  const [cid, setCid] = useState("");
  const all = (CLIENTS as any[]).map(corroborationFor);
  const contra = all.filter(function (x) { return x.worst === "CONTRA"; });
  const check = all.filter(function (x) { return x.worst === "CHECK"; });
  const fiche = cid ? all.find(function (x) { return x.c.id === cid; }) : null;
  const card: React.CSSProperties = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>⚖ Corroboration KYC — déclaré × observé</div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>
          {CLIENTS.length} dossiers · <span style={{ color: T.red, fontWeight: 800 }}>{contra.length} contradiction(s)</span> · <span style={{ color: T.amber, fontWeight: 800 }}>{check.length} à vérifier</span> · {all.length - contra.length - check.length} corroborés
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14, alignItems: "start" }}>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 800, color: T.ink, marginBottom: 8 }}>Dossiers signalés</div>
          {contra.concat(check).slice(0, 18).map(function (x) {
            return (
              <div key={x.c.id} onClick={function () { setCid(x.c.id); }} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 9px", borderRadius: 9, cursor: "pointer", background: cid === x.c.id ? T.oliveSoft : "transparent", border: "1px solid " + (cid === x.c.id ? T.olive600 : "transparent") }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: x.worst === "CONTRA" ? T.red : T.amber, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: T.ink, flex: 1 }}>{x.c.name}</span>
                <span style={{ fontSize: 8.5, fontWeight: 800, color: x.worst === "CONTRA" ? T.red : T.amber }}>{CORROB_STATUS[x.worst][0]}</span>
              </div>
            );
          })}
          <select value={cid} onChange={function (e) { setCid(e.target.value); }} style={{ width: "100%", boxSizing: "border-box", marginTop: 10, padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11 }}>
            <option value="">— Tout dossier —</option>
            {(CLIENTS as any[]).slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) { return <option key={c.id} value={c.id}>{c.name}</option>; })}
          </select>
        </div>
        <div style={card}>
          {!fiche && <div style={{ fontSize: 11.5, color: T.inkSoft, fontStyle: "italic", padding: 20 }}>Sélectionnez un dossier — chaque fiche croise 5 axes : PEP, activité, SOW, résidence, correspondance.</div>}
          {fiche && (
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, flex: 1 }}>
                  {fiche.c.name} <span style={{ fontWeight: 400, color: T.inkSoft, fontSize: 11 }}>· {fiche.k.code || "—"} · risque {fiche.c.risk}</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, color: T[CORROB_STATUS[fiche.worst][1]], background: T[CORROB_STATUS[fiche.worst][1] + "Soft"], padding: "5px 13px", borderRadius: 12 }}>{CORROB_STATUS[fiche.worst][0]}</span>
              </div>
              {fiche.checks.map(function (x: any) {
                const st = CORROB_STATUS[x.st];
                return (
                  <div key={x.id} style={{ padding: "10px 13px", borderRadius: 10, border: "1.5px solid " + (x.st === "OK" ? T.lineSoft : T[st[1]] + "66"), background: x.st === "OK" ? T.cream : T[st[1] + "Soft"], marginBottom: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: T[st[1]] }}>{st[0]}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.ink }}>{x.decl}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: T.inkMid }}>Observé : {x.obs}</div>
                    {x.act !== "—" && <div style={{ fontSize: 10, fontWeight: 700, color: T.olive700, marginTop: 3 }}>→ {x.act}</div>}
                  </div>
                );
              })}
              {fiche.worst !== "OK" && <button onClick={function () { pushParamAudit((user && user.name) || "—", "Corroboration — clarification ouverte : " + fiche.c.name + " (" + fiche.checks.filter(function (x: any) { return x.st !== "OK"; }).map(function (x: any) { return x.id; }).join(", ") + ")"); }} style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>➕ Ouvrir une clarification (tracée)</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
