import React, { useState } from "react";
import { T } from "./tokens";
import CLIENTS from "../fixtures/CLIENTS.json";
import { pmsPortfolio } from "./pms-support";
import { transferCreate } from "./transfers-support";

// Source : docs/reference/olive-demo.html 32100–32196 — porté verbatim.
export function MobileBankingScreen({ user }: { user?: any }) {
  void user;
  const [pin, setPin] = useState("");
  const [logged, setLogged] = useState(false);
  const [mtab, setMtab] = useState("comptes");
  const [pf, setPf] = useState<any>({ ben: "", iban: "", cc: "CH", amt: "" });
  const [lastOrder, setLastOrder] = useState<any>(null);
  const cl: any = (CLIENTS as any[]).find(function (c) { return c.exotic; }) || (CLIENTS as any[])[2];
  const port = pmsPortfolio(cl);
  const aumM = (function () { const m = String(cl.aum || "12M").match(/([\d.]+)/); return m ? parseFloat(m[1]) : 12; })();
  const HELLO: any = { FR: "Bonjour", EN: "Good morning", DE: "Guten Tag", IT: "Buongiorno" };
  const fmt = function (x: number) { return x.toLocaleString("fr-CH", { maximumFractionDigits: 0 }); };
  const phone: any = { width: 372, margin: "0 auto", background: "#111", borderRadius: 38, padding: "14px 10px", boxShadow: "0 24px 60px rgba(0,0,0,0.35)" };
  const scr: any = { background: T.cream, borderRadius: 26, minHeight: 640, overflow: "hidden", display: "flex", flexDirection: "column" };
  const XFER_STATUS_L: any = { DRAFT: "Brouillon", PENDING_APPROVAL: "En validation (four-eyes)", EXECUTED: "Exécuté", BLOCKED: "Bloqué — compliance", REJECTED: "Rejeté" };
  return (
    <div>
      <div style={phone}>
        <div style={scr}>
          <div style={{ background: T.olive700, color: "#fff", padding: "16px 18px" }}>
            <div style={{ fontSize: 10, opacity: 0.75, letterSpacing: 2 }}>BANQUE OLIVE SUISSE</div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{logged ? ((HELLO[cl.corrLang] || "Bonjour") + ", " + (cl.uboName || cl.name).split(" ")[0]) : "Olive Mobile"}</div>
          </div>
          {!logged && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
              <div style={{ fontSize: 12, color: T.inkMid }}>Code PIN</div>
              <div style={{ display: "flex", gap: 8 }}>{[0, 1, 2, 3].map(function (i) { return <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid " + T.olive700, background: pin.length > i ? T.olive700 : "transparent" }} />; })}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,64px)", gap: 8 }}>{([1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"] as any[]).map(function (k, i) {
                return <button key={i} disabled={k === ""} onClick={function () { if (k === "⌫") setPin(pin.slice(0, -1)); else { const np = pin + String(k); if (np.length >= 4) { setLogged(true); setPin(""); } else setPin(np); } }} style={{ height: 52, borderRadius: 14, border: "1px solid " + T.line, background: k === "" ? "transparent" : T.surface, fontSize: 17, fontWeight: 700, color: T.ink, cursor: k === "" ? "default" : "pointer" }}>{k}</button>;
              })}</div>
              <div style={{ fontSize: 9.5, color: T.inkSoft }}>Face ID · e-banking contract {cl.id} · {cl.corrLang}</div>
            </div>
          )}
          {logged && (
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 6px" }}>
              {mtab === "comptes" && (
                <div>{([["Compte courant CHF", "CH93 0076 2011 6238 5295 7", aumM * 0.06 * 1000000], ["Dépôt titres", "Portefeuille " + port.profile, aumM * 0.9 * 1000000], ["Compte USD", "CH11 0076 2011 6238 5301 4", aumM * 0.04 * 1000000]] as any[]).map(function (a, i) {
                  return (
                    <div key={i} style={{ background: T.surface, border: "1px solid " + T.line, borderRadius: 16, padding: "13px 15px", marginBottom: 9 }}>
                      <div style={{ fontSize: 10, color: T.inkSoft }}>{a[0]}</div>
                      <div style={{ fontSize: 19, fontWeight: 800, color: T.ink, fontFamily: "monospace" }}>{fmt(a[2])} <span style={{ fontSize: 10, color: T.inkSoft }}>{i === 2 ? "USD" : "CHF"}</span></div>
                      <div style={{ fontSize: 9, color: T.inkSoft }}>{a[1]}</div>
                    </div>
                  );
                })}</div>
              )}
              {mtab === "portefeuille" && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: T.ink, marginBottom: 8 }}>Positions — profil {port.profile}</div>
                  {port.positions.slice(0, 7).map(function (p: any, i: number) {
                    const ins = p.ins || p;
                    return (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid " + T.lineSoft }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: T.ink, flex: 1 }}>{ins.name || ins.isin}</span>
                        <span style={{ fontFamily: "monospace", fontSize: 10.5, color: T.inkMid }}>{(p.weight !== undefined ? p.weight : p.pct) || 0}%</span>
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 9.5, color: port.drift >= 10 ? T.amber : T.green, marginTop: 8, fontWeight: 700 }}>{port.drift >= 10 ? ("Dérive d'allocation " + port.drift + "% — votre conseiller vous contactera") : "Allocation conforme à votre profil"}</div>
                </div>
              )}
              {mtab === "payer" && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: T.ink, marginBottom: 8 }}>Nouveau paiement</div>
                  {([["Bénéficiaire", "ben"], ["IBAN", "iban"]] as any[]).map(function (x) { return <input key={x[1]} placeholder={x[0]} value={pf[x[1]]} onChange={function (e) { const o: any = {}; o[x[1]] = e.target.value; setPf(Object.assign({}, pf, o)); }} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 11, border: "1px solid " + T.line, fontSize: 12, marginBottom: 8 }} />; })}
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <select value={pf.cc} onChange={function (e) { setPf(Object.assign({}, pf, { cc: e.target.value })); }} style={{ padding: "10px 12px", borderRadius: 11, border: "1px solid " + T.line, fontSize: 12 }}>{["CH", "FR", "DE", "IT", "GB", "AE", "US", "RU"].map(function (c) { return <option key={c} value={c}>{c}</option>; })}</select>
                    <input placeholder="Montant CHF" value={pf.amt} onChange={function (e) { setPf(Object.assign({}, pf, { amt: e.target.value })); }} style={{ flex: 1, padding: "10px 12px", borderRadius: 11, border: "1px solid " + T.line, fontSize: 12 }} />
                  </div>
                  <button onClick={function () { const amtChf = parseFloat(pf.amt) || 0; if (pf.ben && amtChf > 0) { const o = transferCreate({ clientId: cl.id, beneficiary: pf.ben, iban: pf.iban || "—", destCC: pf.cc, amt: Math.round(amtChf / 1000000 * 100) / 100, cur: "CHF", type: pf.cc === "CH" ? "SIC" : "SWIFT", motif: "Paiement mobile" }, { name: "Olive Mobile · " + (cl.uboName || cl.name), role: "RM" }); setLastOrder(o); setPf({ ben: "", iban: "", cc: "CH", amt: "" }); } }} disabled={!(pf.ben && parseFloat(pf.amt) > 0)} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: (pf.ben && parseFloat(pf.amt) > 0) ? T.olive600 : T.line, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>Payer</button>
                  {lastOrder && (
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, background: lastOrder.status === "BLOCKED" ? T.redSoft : lastOrder.status === "EXECUTED" ? T.greenSoft : T.amberSoft }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: lastOrder.status === "BLOCKED" ? T.red : lastOrder.status === "EXECUTED" ? T.green : T.amber }}>{XFER_STATUS_L[lastOrder.status] || lastOrder.status}</div>
                      <div style={{ fontSize: 9.5, color: T.inkMid, marginTop: 3 }}>Ordre {lastOrder.id} — {lastOrder.controls.checks.length} contrôles ({lastOrder.controls.verdict}). {lastOrder.status === "BLOCKED" ? "Votre banque vous contactera." : lastOrder.status === "PENDING_APPROVAL" ? "Validation par votre banque en cours." : "Merci."}</div>
                    </div>
                  )}
                </div>
              )}
              {mtab === "messages" && (
                <div>{([["Votre conseiller " + (cl.rm || ""), "Votre revue annuelle est planifiée. Documents à signer dans l'app."], ["Banque Olive Suisse", "Vos documents fiscaux " + (cl.corrLang) + " sont disponibles (GED)."]] as any[]).map(function (m, i) {
                  return (
                    <div key={i} style={{ background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: "11px 13px", marginBottom: 8 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 800, color: T.ink }}>{m[0]}</div>
                      <div style={{ fontSize: 10.5, color: T.inkMid, marginTop: 2 }}>{m[1]}</div>
                    </div>
                  );
                })}</div>
              )}
            </div>
          )}
          {logged && (
            <div style={{ display: "flex", borderTop: "1px solid " + T.line, background: T.surface }}>{([["comptes", "💳", "Comptes"], ["portefeuille", "▦", "Titres"], ["payer", "➢", "Payer"], ["messages", "✉", "Messages"]] as any[]).map(function (x) {
              return (
                <button key={x[0]} onClick={function () { setMtab(x[0]); }} style={{ flex: 1, padding: "10px 0 12px", border: "none", background: "transparent", cursor: "pointer", color: mtab === x[0] ? T.olive700 : T.inkSoft }}>
                  <div style={{ fontSize: 15 }}>{x[1]}</div>
                  <div style={{ fontSize: 8.5, fontWeight: mtab === x[0] ? 800 : 500 }}>{x[2]}</div>
                </button>
              );
            })}</div>
          )}
        </div>
      </div>
    </div>
  );
}
