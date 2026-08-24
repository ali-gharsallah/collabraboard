import React, { useState } from "react";
import { T } from "./tokens";
import { wfCarte, wfBouton } from "./wf-styles";
import { ctaHash, CTA_TOKENS, CTA_REGISTRE, CTA_MOUVEMENTS } from "./cta-support";

const pushParamAudit = (_a: string, _m: string) => {};

// Source : docs/reference/olive-demo.html 24843–24961 — porté verbatim.
export function CustodyTAScreen() {
  const [tab, setTab] = useState("registre");
  const [tkn, setTkn] = useState("TKN-001");
  const [nv, setNv] = useState<any>(null);
  const [tf, setTf] = useState<any>(null);
  const [msg, setMsg] = useState<any>(null);
  const [, force] = useState(0);
  const re2 = () => force(x => x + 1);
  const reg: any = CTA_REGISTRE[tkn] || {};
  const positions: any = {};
  Object.entries(CTA_REGISTRE).forEach(([t, hs]: any) => Object.entries(hs).forEach(([h, q]: any) => { positions[h] = positions[h] || []; positions[h].push({ t, q }); }));
  return (
    <div style={{ maxWidth: 1020 }}>
      <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>Custody = les positions · Transfer Agent = le registre nominatif · tokenisation = le même métier avec règlement instantané et registre hashé. Chaque mouvement est chaîné et journalisé.</div>
      {msg && <div style={{ borderRadius: 8, padding: "9px 14px", marginBottom: 12, fontSize: 13, background: msg.ok ? T.greenSoft : T.redSoft, border: `1px solid ${msg.ok ? T.green : T.red}`, color: msg.ok ? T.olive900 : T.red }} onClick={() => setMsg(null)}>{msg.texte}</div>}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {([["registre", "📒 Registre nominatif (TA)"], ["positions", "🏦 Positions (Custody)"], ["mvts", "⇄ Mouvements"]] as any[]).map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 15px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: `1px solid ${tab === k ? T.olive600 : T.line}`, background: tab === k ? T.oliveSoft : T.surface, color: tab === k ? T.olive900 : T.inkMid, fontWeight: tab === k ? 700 : 400 }}>{l}</button>)}
        <button style={{ ...wfBouton(T.olive600), marginLeft: "auto" }} onClick={() => setNv({ nom: "", type: "Immobilier tokenisé", parts: 1000 })}>＋ Tokeniser un actif</button>
      </div>
      {tab === "registre" && <div style={wfCarte}>
        <div style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 12 }}>
          <select value={tkn} onChange={e => setTkn(e.target.value)} style={{ border: `1px solid ${T.sage}`, borderRadius: 6, padding: "6px 9px" }}>{CTA_TOKENS.map(t => <option key={t.id} value={t.id}>{t.id} — {t.nom}</option>)}</select>
          <span style={{ fontSize: 11, color: T.inkSoft }}>{(CTA_TOKENS.find(t => t.id === tkn) || {}).type} · {(CTA_TOKENS.find(t => t.id === tkn) || {}).vni} · hash {(CTA_TOKENS.find(t => t.id === tkn) || {}).hash}</span>
          <button style={{ ...wfBouton(T.olive600), marginLeft: "auto" }} onClick={() => setTf({ de: Object.keys(reg)[0] || "", a: "", qte: 10 })}>⇄ Transférer des parts</button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>{["Titulaire", "Parts", "% du token"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 9px", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", borderBottom: `1px solid ${T.line}` }}>{h}</th>)}</tr></thead>
          <tbody>{Object.entries(reg).map(([h, q]: any) => <tr key={h}>
            <td style={{ padding: "7px 9px", borderBottom: `1px solid ${T.lineSoft}` }}>{h}</td>
            <td style={{ padding: "7px 9px", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 700 }}>{q}</td>
            <td style={{ padding: "7px 9px", borderBottom: `1px solid ${T.lineSoft}`, color: T.inkSoft }}>{Math.round(q * 1000 / (CTA_TOKENS.find(t => t.id === tkn) || { parts: 1 }).parts) / 10}%</td>
          </tr>)}</tbody>
        </table>
      </div>}
      {tab === "positions" && <div style={wfCarte}>{Object.entries(positions).map(([h, ps]: any) => <div key={h} style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.olive900 }}>{h}</div>
        {ps.map((p: any) => <div key={p.t} style={{ fontSize: 12.5, color: T.inkMid, padding: "3px 0 3px 14px" }}>{p.t} — {(CTA_TOKENS.find(t => t.id === p.t) || {}).nom} : <b>{p.q} parts</b></div>)}
      </div>)}</div>}
      {tab === "mvts" && <div style={wfCarte}>{CTA_MOUVEMENTS.map((m, i) => <div key={i} style={{ padding: "6px 10px", borderLeft: `3px solid ${(T as any).teal || T.blue}`, background: T.surface, marginBottom: 4, fontSize: 12, borderRadius: "0 6px 6px 0", border: `1px solid ${T.lineSoft}` }}>
        <span style={{ color: T.inkSoft, fontSize: 11 }}>{m.at} · {m.tkn} · hash {m.hash} ← {m.prev}</span> — {m.de} → <b>{m.a}</b> : {m.qte} parts
      </div>)}</div>}
      {nv && <div style={{ position: "fixed", inset: 0, background: "#1a241088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70 }} onClick={() => setNv(null)}>
        <div style={{ background: T.surface, borderRadius: 12, padding: "20px 24px", width: 460, boxShadow: "0 12px 40px #0005" }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.olive900, marginBottom: 10 }}>Tokeniser un actif</div>
          <input autoFocus value={nv.nom} onChange={e => setNv({ ...nv, nom: e.target.value })} placeholder="Actif (ex. : Œuvre d'art, PE fund…)" style={{ width: "100%", padding: "8px 11px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12.5, boxSizing: "border-box", marginBottom: 9 }} />
          <div style={{ display: "flex", gap: 9, marginBottom: 12 }}>
            <select value={nv.type} onChange={e => setNv({ ...nv, type: e.target.value })} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12 }}>{["Immobilier tokenisé", "Sukuk tokenisé", "Private equity tokenisé", "Œuvre d'art tokenisée", "Obligation tokenisée"].map(t => <option key={t}>{t}</option>)}</select>
            <input type="number" value={nv.parts} onChange={e => setNv({ ...nv, parts: +e.target.value || 0 })} style={{ width: 110, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12 }} />
          </div>
          <button disabled={!nv.nom.trim() || nv.parts < 1} style={wfBouton(nv.nom.trim() ? T.olive600 : T.line)} onClick={() => {
            const id = "TKN-" + String(CTA_TOKENS.length + 1).padStart(3, "0");
            CTA_TOKENS.push({ id, nom: nv.nom.trim(), type: nv.type, parts: nv.parts, vni: "à évaluer", hash: ctaHash(nv.nom + nv.parts) });
            CTA_REGISTRE[id] = { "Banque (compte propre)": nv.parts };
            pushParamAudit("Admin", "CTA — actif tokenisé : " + id);
            setTkn(id); setNv(null); setMsg({ ok: true, texte: id + " créé — " + nv.parts + " parts au compte propre, registre hashé." }); re2();
          }}>Créer le token</button>
        </div>
      </div>}
      {tf && <div style={{ position: "fixed", inset: 0, background: "#1a241088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70 }} onClick={() => setTf(null)}>
        <div style={{ background: T.surface, borderRadius: 12, padding: "20px 24px", width: 460, boxShadow: "0 12px 40px #0005" }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.olive900, marginBottom: 10 }}>Transférer des parts — {tkn}</div>
          <div style={{ display: "flex", gap: 9, marginBottom: 9 }}>
            <select value={tf.de} onChange={e => setTf({ ...tf, de: e.target.value })} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12 }}>{Object.keys(reg).map(h => <option key={h}>{h}</option>)}</select>
            <span style={{ alignSelf: "center" }}>→</span>
            <select value={tf.a} onChange={e => setTf({ ...tf, a: e.target.value })} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12 }}>
              <option value="">— destinataire —</option>
              {["Famille Keller", "Trust Aquila", "Holding Véga", "Banque (compte propre)", "Nouveau client OIL"].filter(h => h !== tf.de).map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
          <input type="number" value={tf.qte} onChange={e => setTf({ ...tf, qte: +e.target.value || 0 })} style={{ width: 120, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12, marginBottom: 12 }} />
          <div>
            <button disabled={!tf.a || tf.qte < 1} style={wfBouton(tf.a ? T.olive600 : T.line)} onClick={() => {
              if ((reg[tf.de] || 0) < tf.qte) { setMsg({ ok: false, texte: "Solde insuffisant : " + tf.de + " détient " + (reg[tf.de] || 0) + " parts." }); setTf(null); return; }
              reg[tf.de] -= tf.qte;
              if (reg[tf.de] === 0) delete reg[tf.de];
              reg[tf.a] = (reg[tf.a] || 0) + tf.qte;
              const prev = CTA_MOUVEMENTS.length ? CTA_MOUVEMENTS[CTA_MOUVEMENTS.length - 1].hash : "génèse";
              CTA_MOUVEMENTS.push({ at: "à l'instant", tkn, de: tf.de, a: tf.a, qte: tf.qte, hash: ctaHash(prev + tkn + tf.de + tf.a + tf.qte + CTA_MOUVEMENTS.length), prev });
              pushParamAudit("Admin", "CTA — transfert " + tkn);
              setTf(null); setMsg({ ok: true, texte: "Transfert réglé instantanément — mouvement chaîné au registre." }); re2();
            }}>Exécuter le transfert (DVP)</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
