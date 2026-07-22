import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";

// Écran « Account Review » (Vague 3, revue périodique). ORCHESTRATION de primitives RATIFIÉES —
// AUCUN agrégat « revue » inventé : conduire une revue = re-screener (POST /v1/screening/run,
// trace R103) puis consigner la décision via les visas KYC gouvernés (four-eyes, auteur = jeton).
// La liste des runs (GET /v1/screening/runs) est la preuve de fraîcheur relue.

type Run = { id: string; liste: string; listeVersion: string; nbHits: number; at: string };
const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });

export function AccountReview() {
  const [clientId, setClientId] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [msg, setMsg] = useState("");

  async function conduireRevue() {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/screening/run`, { method: "POST", headers: auth(), body: JSON.stringify({
      liste: "SECO", version: `revue-${new Date().toISOString().slice(0, 10)}`, seuil: 100, prefiltre: {},
      entries: [], clientIds: clientId ? [clientId] : undefined }) });
    setMsg(r.ok ? "Revue conduite — re-screening tracé (R103). Consignez la conclusion via les visas KYC (four-eyes)." : "Erreur");
    charger();
  }
  async function charger() {
    const d = await apiGetSourced<Run[]>("/v1/screening/runs", []);
    setRuns(d.data);
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Account Review — revue périodique (orchestration, zéro canon inventé)</h3>
    <p style={{ fontSize: 12, color: "#777" }}>Déclencheur → re-screening (trace R103) → décision consignée par les visas
      KYC gouvernés (four-eyes, auteur = jeton). Aucun agrégat « revue » n'est fabriqué : la revue compose des primitives ratifiées.</p>
    <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
      <input style={inp} placeholder="clientId à revoir" value={clientId} onChange={(e) => setClientId(e.target.value)}/>
      <button style={btn} onClick={conduireRevue}>Conduire la revue (re-screening)</button>
      <button style={{ ...btn, background: "#777" }} onClick={charger}>Historique des revues</button>
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}
    <h4>Passages de re-screening (preuve de fraîcheur, R103) — {runs.length}</h4>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}>
        <th style={{ padding: 6 }}>Liste</th><th>Version</th><th>Hits</th><th>Quand</th></tr></thead>
      <tbody>
        {runs.map((r) => <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
          <td style={{ padding: 6 }}>{r.liste}</td><td>{r.listeVersion}</td><td align="center">{r.nbHits}</td>
          <td>{r.at ? new Date(r.at).toLocaleString() : "—"}</td></tr>)}
        {runs.length === 0 && <tr><td colSpan={4} style={{ padding: 6, color: "#666" }}>Aucune revue chargée.</td></tr>}
      </tbody>
    </table>
  </div>;
}
