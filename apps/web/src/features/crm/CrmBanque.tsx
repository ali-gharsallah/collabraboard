import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";

// Écran « CRM Banque » (Vague 5). Relit la relation d'un client : la timeline projette le
// journal (GET /v1/crm/clients/:id/timeline, R186) et les prochains gestes sont proposés
// (GET /v1/crm/clients/:id/gestes, R187) — jamais exécutés. L'accès est réservé au RM du
// client ou à un rôle à visibilité étendue (R186) : le service porte la garde.

type Evt = { at: string; type: string; source: string };
type Geste = { code?: string; label?: string; motif?: string } | string;

export function CrmBanque() {
  const [clientId, setClientId] = useState("");
  const [timeline, setTimeline] = useState<Evt[]>([]);
  const [gestes, setGestes] = useState<Geste[]>([]);
  const [charge, setCharge] = useState(false);

  async function charger() {
    const t = await apiGetSourced<Evt[]>(`/v1/crm/clients/${clientId}/timeline`, []);
    setTimeline(Array.isArray(t.data) ? t.data : []);
    const g = await apiGetSourced<Geste[]>(`/v1/crm/clients/${clientId}/gestes`, []);
    setGestes(Array.isArray(g.data) ? g.data : []);
    setCharge(true);
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>CRM Banque — relation client : timeline & prochains gestes (R186/R187)</h3>
    <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
      <input style={inp} placeholder="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}/>
      <button style={btn} onClick={charger} disabled={!clientId}>Ouvrir la relation</button>
    </div>
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 380px" }}>
        <h4>Timeline (projection du journal) — {timeline.length}</h4>
        <ul style={{ fontSize: 12, listStyle: "none", padding: 0 }}>
          {timeline.map((e, i) => <li key={i} style={{ padding: 6, borderBottom: "1px solid #eee" }}>
            <span style={{ padding: "2px 8px", borderRadius: 12, background: "#f3f0e8", fontSize: 11 }}>{e.source}</span>{" "}
            <strong>{e.type}</strong> <span style={{ color: "#888" }}>{e.at ? new Date(e.at).toLocaleString() : ""}</span></li>)}
          {charge && timeline.length === 0 && <li style={{ color: "#666" }}>Aucun événement (ou accès réservé au RM du client, R186).</li>}
        </ul>
      </div>
      <div style={{ flex: "1 1 280px" }}>
        <h4>Prochains gestes (proposés, jamais exécutés — R187) — {gestes.length}</h4>
        <ul style={{ fontSize: 13 }}>
          {gestes.map((g, i) => <li key={i}>{typeof g === "string" ? g : (g.label ?? g.code ?? JSON.stringify(g))}
            {typeof g !== "string" && g.motif ? <span style={{ color: "#888" }}> — {g.motif}</span> : null}</li>)}
          {charge && gestes.length === 0 && <li style={{ color: "#666" }}>Aucun geste proposé.</li>}
        </ul>
      </div>
    </div>
  </div>;
}
