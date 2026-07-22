import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";

// Écran « File d'alertes » (Vague 1). Liste les alertes AML d'un client (GET /v1/aml/clients/:id/signaux)
// et permet la DÉCISION : ouvrir un dossier de risque rattaché à l'alerte (POST /v1/riskcases, R133).
// La file des dossiers ouverts est relue (GET /v1/riskcases). Aucune décision côté écran : le
// service porte les invariants (R133→R136).

type Signal = { id: string; type: string; regle: string; niveau: number; motif: string; bloquant: boolean };
type Dossier = { id: string; statut: string; clientId: string };
const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });

export function AlertsQueue() {
  const [clientId, setClientId] = useState("");
  const [signaux, setSignaux] = useState<Signal[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [msg, setMsg] = useState("");

  async function charger() {
    setMsg("");
    const s = await apiGetSourced<Signal[]>(`/v1/aml/clients/${clientId}/signaux`, []);
    setSignaux(s.data);
    const d = await apiGetSourced<Dossier[]>("/v1/riskcases", []);
    setDossiers(d.data);
  }
  async function ouvrir(signalId: string) {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/riskcases`, { method: "POST", headers: auth(),
      body: JSON.stringify({ clientId, signalIds: [signalId] }) });
    const body = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Dossier de risque ouvert (${String(body.caseId ?? "").slice(0, 8)})` : (body.message ?? "Erreur"));
    if (r.ok) charger();
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>File d'alertes — instruire une alerte = ouvrir un dossier de risque (R133)</h3>
    <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
      <input style={inp} placeholder="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}/>
      <button style={btn} onClick={charger} disabled={!clientId}>Charger les alertes</button>
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}

    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}>
        <th style={{ padding: 6 }}>Règle</th><th>Type</th><th>Niveau</th><th>Bloquant</th><th>Motif</th><th/></tr></thead>
      <tbody>
        {signaux.map((s) => <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
          <td style={{ padding: 6, fontWeight: 600 }}>{s.regle}</td>
          <td>{s.type}</td>
          <td align="center">{s.niveau}</td>
          <td align="center">{s.bloquant ? "⛔" : "—"}</td>
          <td>{s.motif}</td>
          <td><button style={btn} onClick={() => ouvrir(s.id)}>Ouvrir un dossier</button></td>
        </tr>)}
        {signaux.length === 0 && <tr><td colSpan={6} style={{ padding: 6, color: "#666" }}>Aucune alerte chargée.</td></tr>}
      </tbody>
    </table>

    <h4 style={{ marginTop: 18 }}>Dossiers de risque ouverts — {dossiers.length}</h4>
    <ul style={{ fontSize: 13 }}>
      {dossiers.map((d) => <li key={d.id}>{d.id.slice(0, 8)} — statut {d.statut}</li>)}
    </ul>
  </div>;
}
