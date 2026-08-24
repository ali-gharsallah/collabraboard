import React, { useState } from "react";
import { T } from "./tokens";
import CLIENTS from "../fixtures/CLIENTS.json";
import { TRANSFER_ORDERS, transferCreate, transferApprove, transferReject, XFER_CC_CITY, XFER_STATUS_META } from "./transfers-support";

// Source : docs/reference/olive-demo.html 29856–29969 — porté verbatim.
export function TransfersScreen({ user }: { user?: any }) {
  const [tab, setTab] = useState("orders");
  const [f, setF] = useState<any>({ clientId: "", beneficiary: "", iban: "", destCC: "GB", amt: "", cur: "CHF", type: "SWIFT", motif: "" });
  const [selId, setSelId] = useState<any>(null);
  const [justif, setJustif] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [, bump] = useState(0);
  const re = function () { bump(function (x) { return x + 1; }); };
  const card: React.CSSProperties = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 20 };
  const INP: React.CSSProperties = { padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11.5, boxSizing: "border-box" };
  const canApprove = user && ["CO", "CO_SR", "DIR", "ADMIN", "HPB", "CEO"].indexOf(user.role) >= 0;
  const pend = TRANSFER_ORDERS.filter(function (o) { return o.status === "PENDING_APPROVAL"; }).length;
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>⇄ Transactions & Transferts</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3 }}>
          {TRANSFER_ORDERS.length} ordres au registre · {pend} en attente de validation four-eyes. Chaque ordre passe la chaîne de contrôle AVANT exécution ; un ordre exécuté alimente le monitoring transactionnel (carte & règles AML).
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: T.surface, padding: 5, borderRadius: 12, border: "1px solid " + T.line, width: "fit-content" }}>
        {[["orders", "▤ Ordres & validations"], ["new", "➕ Nouvel ordre"]].map(function (x) {
          return (
            <button key={x[0]} onClick={function () { setTab(x[0]); setErrMsg(""); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === x[0] ? T.olive600 : "transparent", color: tab === x[0] ? "#fff" : T.inkMid, fontSize: 12.5, fontWeight: tab === x[0] ? 700 : 500 }}>
              {x[1]}
              {x[0] === "orders" && pend > 0 && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, background: T.amber, color: "#fff", padding: "1px 6px", borderRadius: 8 }}>{pend}</span>}
            </button>
          );
        })}
      </div>
      {tab === "new" && (
        <div style={card}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>➕ Saisie d'un ordre de paiement</div>
          <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 14 }}>À la soumission, la chaîne de contrôle s'exécute : sanctions, screening bénéficiaire, plausibilité, dossier, MROS art. 9a, cross-border. L'ordre part ensuite en validation four-eyes.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 760 }}>
            <select value={f.clientId} onChange={function (e) { setF(Object.assign({}, f, { clientId: e.target.value })); }} style={INP}>
              <option value="">— Client débiteur —</option>
              {(CLIENTS as any[]).slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) { return <option key={c.id} value={c.id}>{c.name} · {c.aum}</option>; })}
            </select>
            <input placeholder="Bénéficiaire (nom)" value={f.beneficiary} onChange={function (e) { setF(Object.assign({}, f, { beneficiary: e.target.value })); }} style={INP} />
            <input placeholder="IBAN bénéficiaire" value={f.iban} onChange={function (e) { setF(Object.assign({}, f, { iban: e.target.value })); }} style={INP} />
            <select value={f.destCC} onChange={function (e) { setF(Object.assign({}, f, { destCC: e.target.value })); }} style={INP}>
              {["GB", "US", "FR", "DE", "AE", "PA", "KY", "BS", "TR", "HK", "SG", "LU", "MC", "LI", "SA", "QA", "RU", "CH", "IT", "ES", "JP", "IN"].map(function (cc) { return <option key={cc} value={cc}>{cc} — {XFER_CC_CITY[cc] || cc}</option>; })}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="Montant (M)" type="number" step="0.1" value={f.amt} onChange={function (e) { setF(Object.assign({}, f, { amt: e.target.value })); }} style={Object.assign({}, INP, { flex: 1 })} />
              <select value={f.cur} onChange={function (e) { setF(Object.assign({}, f, { cur: e.target.value })); }} style={INP}>{["CHF", "USD", "EUR", "GBP", "AED"].map(function (x) { return <option key={x} value={x}>{x}</option>; })}</select>
              <select value={f.type} onChange={function (e) { setF(Object.assign({}, f, { type: e.target.value })); }} style={INP}>{["SWIFT", "SEPA", "Interne"].map(function (x) { return <option key={x} value={x}>{x}</option>; })}</select>
            </div>
            <input placeholder="Motif économique" value={f.motif} onChange={function (e) { setF(Object.assign({}, f, { motif: e.target.value })); }} style={INP} />
          </div>
          <button onClick={function () { if (f.clientId && f.beneficiary && parseFloat(f.amt) > 0) { const o = transferCreate(f, user); setSelId(o.id); setTab("orders"); setF({ clientId: "", beneficiary: "", iban: "", destCC: "GB", amt: "", cur: "CHF", type: "SWIFT", motif: "" }); re(); } }} disabled={!(f.clientId && f.beneficiary && parseFloat(f.amt) > 0)} style={{ marginTop: 14, padding: "10px 20px", borderRadius: 9, border: "none", background: (f.clientId && f.beneficiary && parseFloat(f.amt) > 0) ? T.olive600 : T.line, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: (f.clientId && f.beneficiary && parseFloat(f.amt) > 0) ? "pointer" : "not-allowed" }}>▶ Soumettre — contrôle pré-exécution</button>
        </div>
      )}
      {tab === "orders" && (
        <div style={card}>
          {TRANSFER_ORDERS.map(function (o) {
            const meta = XFER_STATUS_META[o.status];
            const open = selId === o.id;
            const vm = o.controls.verdict;
            return (
              <div key={o.id} style={{ marginBottom: 8 }}>
                <div onClick={function () { setSelId(open ? null : o.id); setErrMsg(""); setJustif(""); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderRadius: 9, border: "1.5px solid " + (open ? T.olive600 : T.lineSoft), background: open ? T.oliveSoft : T.cream, cursor: "pointer", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 10.5, color: T.olive700 }}>{o.id}</span>
                  <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: T.ink, minWidth: 200 }}>{o.clientName} <span style={{ color: T.inkSoft }}>→</span> {o.beneficiary} <span style={{ fontWeight: 400, color: T.inkSoft }}>· {o.destCC}</span></span>
                  <span style={{ fontFamily: "monospace", fontSize: 11.5, fontWeight: 800, color: T.ink }}>{o.amt}M {o.cur}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: vm === "PASS" ? T.green : vm === "WARN" ? T.amber : T.red }}>{vm}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: meta[1], background: T[meta[2]], padding: "3px 10px", borderRadius: 12, whiteSpace: "nowrap" }}>{meta[0]}</span>
                </div>
                {open && (
                  <div style={{ background: T.cream, borderRadius: 10, padding: "12px 16px", marginTop: 4 }}>
                    <div style={{ fontSize: 10, color: T.inkSoft, marginBottom: 8 }}>
                      Saisi par {o.createdBy} le {o.createdAt} · {o.type} · Motif : {o.motif || "—"}
                      {o.executedAt && <> · Exécuté le {o.executedAt} par {o.approvedBy}</>}
                      {o.justification && <> · Dérogation : {o.justification}</>}
                    </div>
                    {o.controls.checks.map(function (ch: any, i: number) {
                      return (
                        <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "4px 0", borderBottom: "1px solid " + T.lineSoft }}>
                          <span style={{ fontWeight: 800, color: ch.level === "OK" ? T.green : ch.level === "COND" ? T.amber : T.red }}>{ch.level === "OK" ? "✓" : ch.level === "COND" ? "⚠" : "✗"}</span>
                          <span style={{ fontSize: 11, color: T.ink, width: 230, flexShrink: 0, fontWeight: 600 }}>{ch.label}</span>
                          <span style={{ fontSize: 10.5, color: T.inkSoft }}>{ch.note}</span>
                        </div>
                      );
                    })}
                    {o.status === "PENDING_APPROVAL" && (
                      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {o.controls.verdict === "WARN" && <input placeholder="Justification de dérogation (obligatoire)" value={justif} onChange={function (e) { setJustif(e.target.value); }} style={{ flex: "1 1 280px", padding: "8px 11px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 11 }} />}
                        <button onClick={function () { const r = transferApprove(o, user, justif || null); if (r.err) { setErrMsg(r.err); } else { setErrMsg(""); } re(); }} disabled={!canApprove} title={canApprove ? "" : "Réservé : Compliance / Direction"} style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: canApprove ? T.green : T.line, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: canApprove ? "pointer" : "not-allowed" }}>✓ Valider &amp; exécuter (four-eyes)</button>
                        <button onClick={function () { transferReject(o, user); re(); }} disabled={!canApprove} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid " + T.red, background: "transparent", color: T.red, fontSize: 11.5, fontWeight: 800, cursor: canApprove ? "pointer" : "not-allowed" }}>✕ Rejeter</button>
                        {errMsg && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.red }}>{errMsg}</span>}
                      </div>
                    )}
                    {o.status === "BLOCKED" && (
                      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: T.red, flex: 1 }}>⛔ Contrôle bloquant — l'ordre ne peut pas être validé. Options : rejet, ou qualification du hit par Compliance puis nouvelle saisie.</span>
                        <button onClick={function () { transferReject(o, user); re(); }} disabled={!canApprove} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid " + T.red, background: "transparent", color: T.red, fontSize: 11.5, fontWeight: 800, cursor: canApprove ? "pointer" : "not-allowed" }}>✕ Rejeter l'ordre</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
