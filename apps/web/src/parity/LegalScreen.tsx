import React, { useState } from "react";
import { T } from "./tokens";
import CLIENTS from "../fixtures/CLIENTS.json";
import { clientById } from "./components-data";
import { clientVisibleTo } from "./cloison-support";
import { pushParamAudit } from "./param-audit-support";
import { LEGAL_TYPES, LEGAL_STATUS, LEGAL_CONTRACTS, legalGenerate, GED_DOCS } from "./legal-support";

// Source : docs/reference/olive-demo.html 31951–32036 — porté verbatim.
export function LegalScreen({ user }: { user?: any }) {
  const [tab, setTab] = useState("contrats");
  const [fSt, setFSt] = useState("ALL");
  const [gCid, setGCid] = useState("");
  const [gType, setGType] = useState("MANDAT");
  const [gPrev, setGPrev] = useState("");
  const [, bump] = useState(0);
  const re = function () { bump(function (x) { return x + 1; }); };
  const card: React.CSSProperties = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  const visible = LEGAL_CONTRACTS.filter(function (k) { const cc = clientById[k.clientId]; return !cc || clientVisibleTo(user, cc); });
  const rows = visible.filter(function (x) { return fSt === "ALL" || x.status === fSt; });
  const expiring = visible.filter(function (x) { return x.status === "EXPIRING"; });
  const canGen = user && ["RM", "ARM", "LEGAL", "CO_SR", "ADMIN", "DIR"].indexOf(user.role) >= 0;
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>§ Legal — Contrats</div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>
          {visible.length} contrats · <span style={{ color: T.amber, fontWeight: 800 }}>{expiring.length} échéances &lt; 90 j</span> · génération depuis le golden record → GED (05-CONTRAT)
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: T.surface, padding: 5, borderRadius: 12, border: "1px solid " + T.line, width: "fit-content" }}>
        {[["contrats", "§ Contrathèque"], ["echeancier", "⏳ Échéancier"], ["generer", "⚡ Générer un contrat"]].map(function (x) {
          return <button key={x[0]} onClick={function () { setTab(x[0]); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === x[0] ? T.olive600 : "transparent", color: tab === x[0] ? "#fff" : T.inkMid, fontSize: 12.5, fontWeight: tab === x[0] ? 700 : 500 }}>{x[1]}</button>;
        })}
      </div>
      {tab === "contrats" && (
        <div style={card}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {["ALL", "ACTIVE", "EXPIRING", "NEGO", "DRAFT", "TERMINATED"].map(function (v) {
              return <button key={v} onClick={function () { setFSt(v); }} style={{ padding: "5px 11px", borderRadius: 8, border: "1px solid " + (fSt === v ? T.olive600 : T.line), background: fSt === v ? T.oliveSoft : T.surface, color: fSt === v ? T.olive700 : T.inkMid, fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>{v === "ALL" ? "Tous" : LEGAL_STATUS[v][0]}</button>;
            })}
            <span style={{ marginLeft: "auto", alignSelf: "center", fontSize: 11, color: T.inkSoft }}>{rows.length} contrat(s)</span>
          </div>
          {rows.slice(0, 30).map(function (k) {
            const c = clientById[k.clientId] || {};
            const st = LEGAL_STATUS[k.status];
            return (
              <div key={k.id} style={{ display: "flex", gap: 9, alignItems: "center", padding: "7px 0", borderBottom: "1px solid " + T.lineSoft, fontSize: 10.5 }}>
                <span style={{ fontFamily: "monospace", color: T.olive700, fontWeight: 800, width: 76, flexShrink: 0 }}>{k.id}</span>
                <span style={{ fontWeight: 700, color: T.ink, flex: 1, minWidth: 200 }}>{k.label}</span>
                <span style={{ color: T.inkSoft, width: 150, flexShrink: 0 }}>{c.name || ""}</span>
                <span style={{ fontFamily: "monospace", color: T.inkMid }}>v{k.version} · {k.lang} · éch. {k.expiresAt}{k.autoRenew ? " ↻" : ""}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: T[st[1]] || T.inkSoft, background: (T[st[1] + "Soft"] || T.cream), padding: "3px 9px", borderRadius: 9 }}>{st[0]}</span>
              </div>
            );
          })}
        </div>
      )}
      {tab === "echeancier" && (
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 }}>⏳ Échéances &lt; 90 jours — {expiring.length}</div>
          {expiring.map(function (k) {
            const c = clientById[k.clientId] || {};
            return (
              <div key={k.id} style={{ display: "flex", gap: 9, alignItems: "center", padding: "8px 0", borderBottom: "1px solid " + T.lineSoft }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: T.amber, background: T.amberSoft, padding: "3px 10px", borderRadius: 9, width: 82, textAlign: "center", flexShrink: 0 }}>{k.expiresAt}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.ink, flex: 1 }}>{k.label} — {c.name || ""}</span>
                <span style={{ fontSize: 10, color: T.inkSoft }}>{k.autoRenew ? "renouvellement automatique" : "renégociation requise"}</span>
                <button onClick={function () { k.status = "ACTIVE"; k.version++; k.expiresAt = "2027-" + k.expiresAt.slice(5); pushParamAudit((user && user.name) || "—", "Legal — contrat renouvelé : " + k.id + " (" + (c.name || "") + ") v" + k.version); re(); }} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid " + T.green, background: "transparent", color: T.green, fontSize: 9.5, fontWeight: 800, cursor: "pointer" }}>↻ Renouveler</button>
              </div>
            );
          })}
        </div>
      )}
      {tab === "generer" && (
        <div style={card}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <select value={gCid} onChange={function (e) { setGCid(e.target.value); setGPrev(""); }} style={{ padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5, minWidth: 220 }}>
              <option value="">— Client —</option>
              {(CLIENTS as any[]).filter(function (c) { return clientVisibleTo(user, c); }).sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) { return <option key={c.id} value={c.id}>{c.name}</option>; })}
            </select>
            <select value={gType} onChange={function (e) { setGType(e.target.value); setGPrev(""); }} style={{ padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5 }}>
              {LEGAL_TYPES.map(function (t) { return <option key={t[0]} value={t[0]}>{t[1]}</option>; })}
            </select>
            <button onClick={function () { const c = clientById[gCid]; if (c && canGen) { setGPrev(legalGenerate(c, gType, user)); } }} disabled={!gCid || !canGen} style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: (gCid && canGen) ? T.olive600 : T.line, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: (gCid && canGen) ? "pointer" : "not-allowed" }}>⚡ Générer (golden record)</button>
            {gPrev && <button onClick={function () { const c = clientById[gCid]; const t = LEGAL_TYPES.find(function (x) { return x[0] === gType; })!; LEGAL_CONTRACTS.unshift({ id: "CTR-" + (4000 + LEGAL_CONTRACTS.length), clientId: c.id, type: gType, label: t[1], status: "DRAFT", signedAt: "—", expiresAt: "2027-07-11", autoRenew: false, lang: c.corrLang || "FR", version: 1 }); GED_DOCS.unshift({ id: "DOC-" + (7000 + GED_DOCS.length), clientId: c.id, name: t[1] + " — " + c.name + ".md", code: "05-CONTRAT", lang: c.corrLang || "FR", version: 1, sizeKb: Math.max(1, Math.round(gPrev.length / 1024)), status: "A_VALIDER", uploadedBy: (user && user.name) || "—", at: "2026-07-11" }); pushParamAudit((user && user.name) || "—", "Legal — contrat généré : " + t[1] + " pour " + c.name + " → GED 05-CONTRAT"); setGPrev(""); setTab("contrats"); re(); }} style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid " + T.olive600, background: "transparent", color: T.olive700, fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>💾 Enregistrer → contrathèque + GED</button>}
          </div>
          {!gPrev && <div style={{ fontSize: 11, color: T.inkSoft, fontStyle: "italic" }}>Le gabarit est rempli avec les données du golden record : identité, profil PMS, frais, langue de correspondance, RM.</div>}
          {gPrev && <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, lineHeight: 1.6, color: T.inkMid, background: T.cream, borderRadius: 10, padding: 16, fontFamily: "inherit" }}>{gPrev}</pre>}
        </div>
      )}
    </div>
  );
}
