import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";

// Écran « Next Best Action » (SPEC-FRONT-CÂBLAGE v2, FE-NBA) — R44 strict : suggestion IA,
// décision humaine. Branché en LECTURE sur le canon ratifié R187 (GET /v1/crm/clients/:id/gestes) :
// prochains gestes proposés par client, avec leur signal déclencheur. Aucune exécution automatique,
// aucune action chaînée.
// ⚠ Écart signalé (ECARTS-FRONT) : il n'existe PAS de route de DÉCISION NBA ratifiée
// (POST /nba/:id/decision ACCEPT|ADJUST|REJECT). Les actions sont donc présentées mais désactivées —
// la décision tracée est en attente de canon. On n'invente pas l'endpoint.

type Geste = { geste: string; signal: string; source: string; echeance?: string };

export function NextBestAction() {
  const [clientId, setClientId] = useState("");
  const [gestes, setGestes] = useState<Geste[] | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [msg, setMsg] = useState("");

  async function charger() {
    setMsg(""); setGestes(null);
    if (!clientId.trim()) { setMsg("Renseigner un identifiant client."); return; }
    const r = await apiGetSourced<Geste[]>(`/v1/crm/clients/${clientId.trim()}/gestes`, []);
    setGestes(r.data); setIsDemo(r.isDemo);
  }

  const inp = { padding: 6, borderRadius: 6, border: "1px solid #ccc", fontSize: 13 };
  const btn = (label: string) =>
    <button disabled title="Route de décision NBA non ratifiée (voir ECARTS-FRONT)"
      style={{ ...inp, background: "#eee", color: "#999", border: "1px solid #ddd", cursor: "not-allowed" }}>{label}</button>;

  return <div>
    {isDemo && <DemoModeBanner/>}
    <h3>Next Best Action — suggestion IA, décision humaine (R44)</h3>
    <p style={{ fontSize: 12, color: "#777" }}>Prochains gestes proposés par client (R187), avec leur signal. Rien n'est exécuté
      automatiquement. La décision (Accepter / Ajuster / Rejeter) reste humaine — la route de décision tracée est <strong>en attente de canon</strong> (écart signalé).</p>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input style={{ ...inp, width: 300 }} placeholder="Identifiant client" value={clientId}
        onChange={(e) => setClientId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && charger()}/>
      <button onClick={charger} disabled={isDemoMode() && !clientId}
        style={{ ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" }}>Voir les suggestions</button>
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 12 }}>{msg}</div>}
    {gestes && gestes.length === 0 && <div style={{ marginTop: 12, color: "#666", fontSize: 13 }}>Aucun geste proposé pour ce client.</div>}
    {gestes && gestes.map((g, i) => <div key={i} style={{ padding: 12, marginTop: 10, borderRadius: 10, background: "#FAFBF7", border: "1px solid #eee" }}>
      <div style={{ fontWeight: 700 }}>{g.geste}</div>
      <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Signal : {g.signal} <span style={{ color: "#aaa" }}>· {g.source}{g.echeance ? ` · ${g.echeance}` : ""}</span></div>
      <div style={{ fontSize: 11, color: "#7BA042", margin: "6px 0" }}>Suggestion IA — décision humaine requise</div>
      <div style={{ display: "flex", gap: 6 }}>{btn("Accepter")}{btn("Ajuster")}{btn("Rejeter")}</div>
    </div>)}
  </div>;
}
