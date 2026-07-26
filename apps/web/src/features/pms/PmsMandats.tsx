import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";

// Écran « PMS » (Vague 7). INTÉGRER, pas refaire : couche COMPLIANCE sur les positions (importées
// d'un core), jamais un moteur de portefeuille. Mandats (R107 : adéquation LSFin bornée par le
// riskLevel client), valorisation → drift CONSTATÉ (R105, positions intactes), pre-trade bloquant
// (R106 : exclusions/concentration), registre de breaches (R108/R7 : clôture motivée). Le service
// porte les invariants ; aucune règle côté écran.

type Mandat = { id: string; nom: string; profilRequis: string; statut: string; clientId: string };
type Breach = { id: string; type: string; detail: string; statut: string; mandateId: string };
type Val = { totalChf: number; allocation: Record<string, number>; drifts: { classe: string; reelPct: number; ecartBp: number }[] };
const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });

export function PmsMandats() {
  const [clientId, setClientId] = useState("");
  const [mandats, setMandats] = useState<Mandat[]>([]);
  const [breaches, setBreaches] = useState<Breach[]>([]);
  const [val, setVal] = useState<Val | null>(null);
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  async function charger() {
    setMandats((await apiGetSourced<Mandat[]>(`/v1/pms/mandats${clientId ? "?clientId=" + clientId : ""}`, [])).data);
    setBreaches((await apiGetSourced<Breach[]>("/v1/pms/breaches", [])).data);
  }
  async function adequation() {
    setMsg("");
    const a = await apiGetSourced<{ alertes: string[] }>(`/v1/pms/clients/${clientId}/adequation`, { alertes: [] });
    setMsg(a.data.alertes.length ? `⚠ ${a.data.alertes.length} mandat(s) inadéquat(s) — revue requise (R107), jamais rétrogradé auto.` : "Adéquation OK — aucun mandat au-dessus du profil client.");
  }
  async function valoriser(id: string) {
    setVal(null);
    const v = await apiGetSourced<Val>(`/v1/pms/mandats/${id}/valoriser`, { totalChf: 0, allocation: {}, drifts: [] });
    setVal(v.data); charger();
    setMsg(v.data.drifts.length ? `${v.data.drifts.length} drift(s) constaté(s) — breach(es) inscrit(s), positions intactes (R105).` : "Aucun drift — allocation dans les bornes.");
  }
  async function clore(id: string) {
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/pms/breaches/${id}/clore`, { method: "POST", headers: auth(), body: JSON.stringify({ motif: motifs[id] ?? "" }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? "Breach clôturé (motivé)." : (b.message ?? "Motif requis (R7)."));
    if (r.ok) charger();
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>PMS — mandats, adéquation & breaches (R105→R108) · intégrer, pas refaire</h3>
    <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
      <input style={inp} placeholder="clientId (filtre)" value={clientId} onChange={(e) => setClientId(e.target.value)}/>
      <button style={btn} onClick={charger}>Charger mandats & breaches</button>
      <button style={{ ...btn, background: "#777" }} onClick={adequation} disabled={!clientId}>Vérifier l'adéquation (R107)</button>
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}

    <h4>Mandats — {mandats.length}</h4>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}>
        <th style={{ padding: 6 }}>Nom</th><th>Profil requis</th><th>Statut</th><th/></tr></thead>
      <tbody>
        {mandats.map((m) => <tr key={m.id} style={{ borderBottom: "1px solid #eee" }}>
          <td style={{ padding: 6, fontWeight: 600 }}>{m.nom}</td><td>{m.profilRequis}</td><td>{m.statut}</td>
          <td><button style={btn} onClick={() => valoriser(m.id)}>Valoriser (drift)</button></td></tr>)}
        {mandats.length === 0 && <tr><td colSpan={4} style={{ padding: 6, color: "#666" }}>Aucun mandat chargé.</td></tr>}
      </tbody>
    </table>

    {val && <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#f3f0e8" }}>
      <strong style={{ fontSize: 13 }}>Valorisation — total {val.totalChf.toLocaleString()} CHF · drift(s) : {val.drifts.length}</strong>
      <ul style={{ fontSize: 12 }}>
        {Object.entries(val.allocation).map(([c, v]) => <li key={c}>{c} : {v.toLocaleString()} CHF</li>)}
        {val.drifts.map((d, i) => <li key={i} style={{ color: "#c33" }}>⚠ {d.classe} {d.reelPct}% (écart {d.ecartBp} bp)</li>)}
      </ul>
    </div>}

    <h4 style={{ marginTop: 16 }}>Registre des breaches — {breaches.length}</h4>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}>
        <th style={{ padding: 6 }}>Type</th><th>Détail</th><th>Statut</th><th>Motif clôture</th><th/></tr></thead>
      <tbody>
        {breaches.map((b) => <tr key={b.id} style={{ borderBottom: "1px solid #eee" }}>
          <td style={{ padding: 6, fontWeight: 600 }}>{b.type}</td><td>{b.detail}</td>
          <td style={{ color: b.statut === "OUVERT" ? "#c33" : "#4A6B28", fontWeight: 700 }}>{b.statut}</td>
          <td>{b.statut === "OUVERT" && <input style={{ ...inp, width: 150 }} placeholder="motif (R7)" value={motifs[b.id] ?? ""}
            onChange={(e) => setMotifs({ ...motifs, [b.id]: e.target.value })}/>}</td>
          <td>{b.statut === "OUVERT" && <button style={btn} onClick={() => clore(b.id)}>Clôturer</button>}</td></tr>)}
        {breaches.length === 0 && <tr><td colSpan={5} style={{ padding: 6, color: "#666" }}>Aucun breach.</td></tr>}
      </tbody>
    </table>
  </div>;
}
