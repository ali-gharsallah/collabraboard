import React, { useState } from "react";
import { isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";

// Écran « Contact Reports » (Vague 5). Trace un compte rendu d'entretien (POST
// /v1/crm/clients/:id/entretiens, R188) — le type doit exister au paramétrage, les champs
// obligatoires sont contrôlés côté service. Le pré-remplissage IA (POST …/entretiens/pre-remplir)
// REFUSE explicitement sans port IA configuré (R138) : pas de brouillon fantôme, la saisie
// manuelle reste ouverte. Aucune règle côté écran.

const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });

export function ContactReports() {
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState("REVUE_ANNUELLE");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  async function creer() {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/crm/clients/${clientId}/entretiens`, { method: "POST", headers: auth(),
      body: JSON.stringify({ type, contenu: { note } }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Compte rendu tracé (${String(b.contactId ?? "").slice(0, 8)}, origine ${b.origine}).` : (b.message ?? "Erreur"));
  }
  async function preRemplir() {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/crm/clients/${clientId}/entretiens/pre-remplir`, { method: "POST", headers: auth(),
      body: JSON.stringify({ type }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? "Brouillon pré-rempli par l'IA (à valider par l'humain)." : `⛔ ${b.message ?? "Refus"} — saisie manuelle ouverte (R138).`);
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Contact Reports — compte rendu d'entretien (R188), pré-remplissage IA gouverné (R138)</h3>
    <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap", alignItems: "center" }}>
      <input style={inp} placeholder="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}/>
      <input style={inp} placeholder="type d'entretien (paramétré)" value={type} onChange={(e) => setType(e.target.value)}/>
      <button style={{ ...btn, background: "#777" }} onClick={preRemplir} disabled={!clientId}>Pré-remplir (IA)</button>
    </div>
    <textarea style={{ ...inp, width: "100%", minHeight: 90, boxSizing: "border-box" }} placeholder="Note d'entretien…"
      value={note} onChange={(e) => setNote(e.target.value)}/>
    <div style={{ marginTop: 8 }}>
      <button style={btn} onClick={creer} disabled={!clientId || !note}>Enregistrer le compte rendu</button>
    </div>
    {msg && <div style={{ margin: "10px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}
  </div>;
}
