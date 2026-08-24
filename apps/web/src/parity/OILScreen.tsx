import React, { useState } from "react";
import { T } from "./tokens";
import { wfCarte, wfBouton } from "./wf-styles";
import { WF_ENGINE, WF_IDS, WF_TITULAIRES, WfBranche, wfPreuve4Yeux } from "./olive-wf-engine";
import { oilAnalyse, oilAdvisor, OIL_SECTEURS_EXCLUS, OIL_CATALOGUE, OIL_PRODUITS, OIL_DOCS, OIL_MATRICE } from "./oil-support";

const pushParamAudit = (_a: string, _m: string) => {};

// Source : docs/reference/olive-demo.html 25053–25193 — porté verbatim.
export function OILScreen({ go }: { go?: (s: string) => void }) {
  const [tab, setTab] = useState("analyser");
  const [pa, setPa] = useState<any>({ nom: "Mon instrument", secteur: "ETF actions", dette: 25, liq: 30, rnc: 2 });
  const [res, setRes] = useState<any>(null);
  const [q, setQ] = useState("");
  const [rep, setRep] = useState<any>(null);
  const [nvp, setNvp] = useState("");
  const [msg, setMsg] = useState<any>(null);
  const [, force] = useState(0);
  const re2 = () => force(x => x + 1);
  const boardIds = WF_IDS.filter(id => id.indexOf("OIL-") === 0);
  const chip = (ok: boolean, l: string) => <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 11, background: ok ? T.greenSoft : T.redSoft, color: ok ? T.green : T.red, border: `1px solid ${ok ? T.green : T.red}` }}>{l}</span>;
  return (
    <div style={{ maxWidth: 1020 }}>
      {msg && <div style={{ borderRadius: 8, padding: "9px 14px", marginBottom: 12, fontSize: 13, background: msg.ok ? T.greenSoft : T.redSoft, border: `1px solid ${msg.ok ? T.green : T.red}`, color: msg.ok ? T.olive900 : T.red }} onClick={() => setMsg(null)}>{msg.texte}</div>}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {([["analyser", "☪ Sharia Analyser"], ["catalogue", "▦ Produits conformes"], ["board", "⚖ Sharia Board"], ["matrice", "🗂 Matrice documentaire"], ["advisor", "🤖 AI Advisor"], ["audit", "🔍 Sharia Audit"]] as any[]).map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12.5, cursor: "pointer", border: `1px solid ${tab === k ? T.olive600 : T.line}`, background: tab === k ? T.oliveSoft : T.surface, color: tab === k ? T.olive900 : T.inkMid, fontWeight: tab === k ? 700 : 400 }}>{l}</button>)}
      </div>
      {tab === "analyser" && <div style={wfCarte}>
        <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12 }}>Screening AAOIFI : secteur + ratios (dette ≤ 33%, liquidités & créances ≤ 49%, revenus non conformes ≤ 5% → purification). Le label est expliqué ligne par ligne.</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1fr 1fr 1fr auto", gap: 9, alignItems: "end", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: T.inkSoft, marginBottom: 3 }}>Instrument</div>
            <input value={pa.nom} onChange={e => setPa({ ...pa, nom: e.target.value })} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12, boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.inkSoft, marginBottom: 3 }}>Secteur</div>
            <select value={pa.secteur} onChange={e => setPa({ ...pa, secteur: e.target.value })} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12 }}>{["ETF actions", "ETF actions screené", "Sukuk", "Produit structuré", "Immobilier", "Technologie", "Santé"].concat(OIL_SECTEURS_EXCLUS).map(x => <option key={x}>{x}</option>)}</select>
          </div>
          {([["dette", "Dette %"], ["liq", "Liq.+créances %"], ["rnc", "Rev. non conf. %"]] as any[]).map(([k, l]) => <div key={k}>
            <div style={{ fontSize: 10, color: T.inkSoft, marginBottom: 3 }}>{l}</div>
            <input type="number" value={pa[k]} onChange={e => setPa({ ...pa, [k]: +e.target.value || 0 })} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12, boxSizing: "border-box" }} />
          </div>)}
          <button style={wfBouton(T.olive600)} onClick={() => setRes(oilAnalyse(pa))}>Analyser</button>
        </div>
        {res && <div style={{ background: T.cream, border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ marginBottom: 8 }}>{chip(res.ok, "LABEL : " + res.label)}</div>
          {res.why.map((w: string, i: number) => <div key={i} style={{ fontSize: 12.5, color: T.inkMid, margin: "3px 0" }}>• {w}</div>)}
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 8 }}>Le label devient opposable après validation du Sharia Board (onglet ⚖) — l'analyseur éclaire, le Board décide.</div>
        </div>}
      </div>}
      {tab === "catalogue" && <div style={wfCarte}>
        <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>Produits structurés & ETF — label calculé en direct par l'analyseur.</div>
        {OIL_CATALOGUE.map((p, i) => {
          const a = oilAnalyse(p);
          return <div key={i} style={{ padding: "10px 4px", borderBottom: `1px solid ${T.lineSoft}` }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <b style={{ color: T.ink, fontSize: 13 }}>{p.nom}</b>
              <span style={{ fontSize: 11, color: T.inkSoft }}>{p.em}</span>
              {chip(a.ok, a.label)}
              {p.fatwa ? <span style={{ fontSize: 10.5, color: T.olive700 }}>📜 {p.fatwa}</span> : <span style={{ fontSize: 10.5, color: T.amber }}>📜 fatwa à obtenir → Sharia Board</span>}
            </div>
            <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3 }}>{p.structure} · dette {p.dette}% · liq. {p.liq}% · rev. n-c {p.rnc}%</div>
          </div>;
        })}
      </div>}
      {tab === "board" && <div style={wfCarte}>
        <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>Le Sharia Board tourne sur le moteur de workflow : visas par section, 4-yeux (R13), refus motivé (R7), fatwa = validation finale avec engagement (R14). Signature dans le Bac à sable.</div>
        <div style={{ display: "flex", gap: 9, marginBottom: 12 }}>
          <input value={nvp} onChange={e => setNvp(e.target.value)} placeholder="Nouveau produit à soumettre au Board…" style={{ flex: 1, padding: "8px 11px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12.5 }} />
          <button disabled={!nvp.trim()} style={wfBouton(nvp.trim() ? T.olive600 : T.line)} onClick={() => {
            const id = "OIL-2026-" + String(boardIds.length + 1).padStart(3, "0");
            WF_ENGINE.createDossier(id, { sections: [{ id: "QUANT", label: "Analyse quantitative (ratios AAOIFI)", validator: "Dr. Y. Al-Amine (Sharia analyst)" }, { id: "SCHOL1", label: "Revue scholar — structure contractuelle", validator: "Sheikh M. Osmani" }, { id: "SCHOL2", label: "Revue scholar — substance économique", validator: "Dr. A. El-Gamal" }], finalValidator: "Président du Sharia Board" });
            WF_IDS.push(id);
            WF_TITULAIRES[id] = "Sharia Board — " + nvp.trim();
            pushParamAudit("Admin", "OIL — produit soumis au Sharia Board : " + id);
            setNvp(""); setMsg({ ok: true, texte: id + " créé — le circuit de fatwa est ouvert." }); re2();
          }}>Soumettre au Board</button>
        </div>
        {boardIds.map(id => {
          const d = WF_ENGINE.d(id);
          return <div key={id} style={{ padding: "9px 4px", borderBottom: `1px solid ${T.lineSoft}` }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <b style={{ color: T.olive900 }}>{id}</b>
              <span style={{ color: T.inkMid, fontSize: 13 }}>{WF_TITULAIRES[id]}</span>
              <button style={{ ...wfBouton(T.olive600), marginLeft: "auto", padding: "5px 12px", fontSize: 12 }} onClick={() => go && go("sandbox")}>Signer les visas →</button>
            </div>
            <WfBranche d={d} />
          </div>;
        })}
      </div>}
      {tab === "matrice" && <div style={wfCarte}>
        <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>Documents requis par type de produit islamique (même mécanique que la matrice KYC, R26) — cliquer une cellule pour basculer, journalisé.</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11.5, minWidth: 760 }}>
            <thead><tr>
              <th style={{ textAlign: "left", padding: "6px 9px", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", borderBottom: `1px solid ${T.line}` }}>Produit</th>
              {OIL_DOCS.map(d => <th key={d} style={{ textAlign: "center", padding: "6px 7px", fontSize: 9.5, color: T.inkSoft, borderBottom: `1px solid ${T.line}` }}>{d}</th>)}
            </tr></thead>
            <tbody>{OIL_PRODUITS.map(p => <tr key={p}>
              <td style={{ padding: "7px 9px", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 700, color: T.ink }}>{p}</td>
              {OIL_DOCS.map(d => <td key={d} onClick={() => { OIL_MATRICE[p][d] = !OIL_MATRICE[p][d]; pushParamAudit("Admin", "OIL matrice — " + p + " / " + d); re2(); }} style={{ textAlign: "center", padding: "7px", borderBottom: `1px solid ${T.lineSoft}`, cursor: "pointer", color: OIL_MATRICE[p][d] ? T.green : T.inkSoft, fontWeight: 800 }}>{OIL_MATRICE[p][d] ? "✓" : "—"}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </div>}
      {tab === "advisor" && <div style={{ ...wfCarte, border: `1px solid ${T.violet}55`, background: T.violetSoft }}>
        <div style={{ fontSize: 12, color: T.inkMid, marginBottom: 10 }}>Olivia Sharia — l'IA éclaire (règles, structures, purification), le Sharia Board décide (R44).</div>
        <div style={{ display: "flex", gap: 9, marginBottom: 10 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ex. : cette note structurée avec wa'd est-elle conforme ? le sukuk et le riba ?" style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.violet}66`, fontSize: 12.5 }} />
          <button style={wfBouton(T.violet)} onClick={() => setRep(oilAdvisor(q))}>Demander</button>
        </div>
        {rep && <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px" }}>{rep.map((r: string, i: number) => <div key={i} style={{ fontSize: 12.5, color: T.inkMid, margin: "4px 0" }}>{r.startsWith("—") ? <i style={{ color: T.violet }}>{r}</i> : "• " + r}</div>)}</div>}
      </div>}
      {tab === "audit" && <div style={wfCarte}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.olive900, marginBottom: 8 }}>Contrôles Sharia — calculés en direct</div>
        {([["Produits labellisés CONFORME avec fatwa documentée", OIL_CATALOGUE.filter(p => oilAnalyse(p).ok).every(p => !!p.fatwa), OIL_CATALOGUE.filter(p => oilAnalyse(p).ok && !p.fatwa).map(p => p.nom).join(", ")], ["4-yeux respecté sur les dossiers du Board", wfPreuve4Yeux().filter((v: any) => v.dossier.indexOf("OIL-") === 0).every((v: any) => !v.preparateurs.has(v.validateur)), ""], ["Purification déclarée pour tout produit à revenus non conformes ≤ 5%", OIL_CATALOGUE.filter(p => p.rnc > 0 && p.rnc <= 5).every(p => oilAnalyse(p).label.indexOf("purification") >= 0), ""]] as any[]).map(([l, ok, detail], i) => <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 4px", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 13 }}>
          <span style={{ fontWeight: 800, color: ok ? T.green : T.red, minWidth: 20 }}>{ok ? "✔" : "✖"}</span>
          <span style={{ color: T.ink }}>{l}</span>
          {!ok && detail && <span style={{ fontSize: 11, color: T.red }}>→ {detail}</span>}
        </div>)}
        <div style={{ fontSize: 13, fontWeight: 700, color: T.olive900, margin: "14px 0 6px" }}>Journal des dossiers du Board</div>
        {WF_ENGINE.audit().filter((e: any) => (e.dossierId || "").indexOf("OIL-") === 0).map((ev: any) => <div key={ev.seq} style={{ padding: "5px 10px", borderLeft: `3px solid ${T.leaf}`, background: T.surface, marginBottom: 4, fontSize: 12, borderRadius: "0 6px 6px 0", border: `1px solid ${T.lineSoft}` }}>
          <span style={{ color: T.inkSoft, fontSize: 11 }}>#{ev.seq} · {"" + ev.at} · {ev.actor || "system"}</span> — <b>{ev.type}</b>{ev.sectionId ? " · " + ev.sectionId : ""}
        </div>)}
      </div>}
    </div>
  );
}
