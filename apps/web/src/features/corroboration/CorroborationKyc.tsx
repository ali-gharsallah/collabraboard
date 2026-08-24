import React, { useState } from "react";
import { isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";  // contrat UX

// Écran « Corroboration KYC » (Vague 5). Quand un champ d'identité DIVERGE entre dossiers,
// le CO le signale (POST /v1/personnes/:id/corroboration, R36) : O-Live ouvre un dossier
// Central File et émet une tâche de corroboration par dossier concerné — mais NE MODIFIE
// AUCUNE donnée avant décision humaine. `constats` = { kycFileId: constat }.

const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });

export function CorroborationKyc() {
  const [personId, setPersonId] = useState("");
  const [champ, setChamp] = useState("nom");
  const [dossierId, setDossierId] = useState("");
  const [constat, setConstat] = useState("");
  const [msg, setMsg] = useState("");
  const { ask, modal } = useConfirmGate();               // contrat UX : confirmation + pré-vol

  async function signaler() {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/personnes/${personId}/corroboration`, { method: "POST", headers: auth(),
      body: JSON.stringify({ champ, constats: dossierId ? { [dossierId]: constat } : {} }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok
      ? `Divergence signalée sur « ${champ} » → dossier Central File ouvert + tâche de corroboration (R36). Aucune donnée modifiée.`
      : (b.message ?? "Erreur"));
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  return <div>
    {modal}
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Corroboration KYC — divergence d'identité → Central File (R36)</h3>
    <p style={{ fontSize: 12, color: "#777" }}>Le signalement ouvre un dossier et une tâche ; il ne modifie AUCUNE donnée
      avant décision humaine (le système signale, l'humain tranche).</p>
    <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap", alignItems: "center" }}>
      <input style={inp} placeholder="personId" value={personId} onChange={(e) => setPersonId(e.target.value)}/>
      <select style={inp} value={champ} onChange={(e) => setChamp(e.target.value)}>
        {["nom", "naissance", "nationalite", "adresse"].map((c) => <option key={c}>{c}</option>)}
      </select>
      <input style={inp} placeholder="kycFileId (dossier concerné)" value={dossierId} onChange={(e) => setDossierId(e.target.value)}/>
      <input style={{ ...inp, flex: 1 }} placeholder="constat (ex. « Nom A vs Nom B »)" value={constat} onChange={(e) => setConstat(e.target.value)}/>
      <button style={btn} disabled={!personId} onClick={() => ask({ title: "Signaler une divergence d'identité (R36)",
        message: "Ouvre un dossier Central File + une tâche de corroboration. Aucune donnée n'est modifiée avant décision humaine.",
        items: [{ label: `Champ : ${champ}`, ok: true }, { label: dossierId ? `Dossier ${dossierId} : ${constat || "(sans constat)"}` : "Aucun dossier ciblé", ok: !!dossierId }],
        confirmLabel: "Signaler", onConfirm: signaler })}>Signaler la divergence</button>
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}
  </div>;
}
