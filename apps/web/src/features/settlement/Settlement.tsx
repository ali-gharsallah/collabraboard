import React, { useEffect, useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";

// Écran « Settlement / exécution » (Vague 4). Le core banking est un PORT (R167→R169) : on
// INTÈGRE, on ne réimplémente pas de moteur de portefeuille. Phase 1 LECTURE SEULE :
// GET /v1/corebanking/etat restitue l'état de synchronisation (lots, quarantaine). Sans port
// configuré, POST /v1/corebanking/importer REFUSE explicitement (R114/R167) — jamais un simulacre.
// Le statut d'exécution d'une transaction se lit côté client (GET /v1/transactions/:id/statut-client).

type Etat = { lots: number; enQuarantaine: number };
const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });

export function Settlement() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [txId, setTxId] = useState("");
  const [statut, setStatut] = useState<string>("");
  const [msg, setMsg] = useState("");

  async function charger() {
    const d = await apiGetSourced<Etat>("/v1/corebanking/etat", { lots: 0, enQuarantaine: 0 });
    setEtat(d.data);
  }
  useEffect(() => { charger(); }, []);

  async function importer() {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/corebanking/importer`, { method: "POST", headers: auth(), body: JSON.stringify({ type: "POSITIONS" }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? "Lot importé." : `⛔ ${b.message ?? "Refus"} — aucune donnée simulée (R167).`);
  }
  async function statutTx() {
    const d = await apiGetSourced<{ statut?: string }>(`/v1/transactions/${txId}/statut-client`, {});
    setStatut(d.data.statut ?? "—");
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Settlement / exécution — le core est un PORT, pas un moteur (R167→R169)</h3>
    <p style={{ fontSize: 12, color: "#777" }}>Phase 1 : lecture seule. Avaloq/Temenos/Finnova/ERI s'intègrent via un
      connecteur ; sans connecteur, l'import est refusé explicitement — jamais de donnée inventée.</p>
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
      <div style={{ flex: "1 1 220px", padding: 16, borderRadius: 10, background: "#f3f0e8", border: "1px solid #e0dccb" }}>
        <div style={{ fontSize: 13, color: "#555" }}>Lots de synchronisation</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: "#4A6B28" }}>{etat?.lots ?? 0}</div>
        <div style={{ fontSize: 12, color: etat?.enQuarantaine ? "#c33" : "#555" }}>{etat?.enQuarantaine ?? 0} en quarantaine</div>
      </div>
    </div>
    <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap", alignItems: "center" }}>
      <button style={btn} onClick={importer}>Importer un lot (core)</button>
      <span style={{ width: 12 }}/>
      <input style={inp} placeholder="verdictId d'une transaction" value={txId} onChange={(e) => setTxId(e.target.value)}/>
      <button style={{ ...btn, background: "#777" }} onClick={statutTx} disabled={!txId}>Statut d'exécution</button>
      {statut && <span style={{ padding: "4px 12px", borderRadius: 20, background: "#4A6B28", color: "#fff", fontWeight: 700 }}>{statut}</span>}
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#fbeaea", fontSize: 13 }}>{msg}</div>}
  </div>;
}
