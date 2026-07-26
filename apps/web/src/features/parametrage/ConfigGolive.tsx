import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";

// Écran « Config à date & Go-live » (Vague 6). Reconstruit la configuration COMPLÈTE à une date
// (GET /v1/parametres/config?date=, R127) et gouverne l'activation (POST /v1/parametres/activer,
// R128) : pas de go-live sur un questionnaire troué — une clé requise manquante est NOMMÉE, et
// la signature du répondant bancaire est obligatoire. Aucune règle côté écran.

const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });

export function ConfigGolive() {
  const [date, setDate] = useState("");
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [signataire, setSignataire] = useState("");
  const [msg, setMsg] = useState("");
  const [statut, setStatut] = useState("");

  async function reconstruire() {
    const q = date ? `?date=${date}` : "";
    const d = await apiGetSourced<Record<string, unknown>>(`/v1/parametres/config${q}`, {});
    setConfig(d.data);
  }
  async function activer() {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/parametres/activer`, { method: "POST", headers: auth(), body: JSON.stringify({ signataire }) });
    const b = await r.json().catch(() => ({}));
    if (r.ok) { setStatut(b.statut ?? "ACTIF"); setMsg(`Go-live prononcé — tenant ${b.statut ?? "ACTIF"}.`); }
    else setMsg(`⛔ ${b.message ?? "Refus"} (R128).`);
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Config à date & Go-live — activation gouvernée (R127/R128)</h3>
    <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap", alignItems: "center" }}>
      <input style={inp} placeholder="date (vide = courant)" value={date} onChange={(e) => setDate(e.target.value)}/>
      <button style={{ ...btn, background: "#777" }} onClick={reconstruire}>Reconstruire la config (R127)</button>
    </div>
    {config && <div style={{ maxHeight: 300, overflow: "auto", background: "#f3f0e8", borderRadius: 8, padding: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <tbody>{Object.entries(config).map(([k, v]) => <tr key={k} style={{ borderBottom: "1px solid #e0dccb" }}>
          <td style={{ padding: 4, fontWeight: 600 }}>{k}</td>
          <td style={{ fontFamily: "monospace" }}>{JSON.stringify(v)}</td></tr>)}</tbody>
      </table>
    </div>}
    <div style={{ display: "flex", gap: 8, margin: "14px 0", flexWrap: "wrap", alignItems: "center" }}>
      <input style={{ ...inp, flex: 1 }} placeholder="signature du répondant bancaire (R128)" value={signataire} onChange={(e) => setSignataire(e.target.value)}/>
      <button style={btn} onClick={activer} disabled={!signataire}>Prononcer le go-live</button>
      {statut && <span style={{ padding: "4px 12px", borderRadius: 20, background: "#4A6B28", color: "#fff", fontWeight: 700 }}>{statut}</span>}
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: msg.startsWith("⛔") ? "#fbeaea" : "#f3f0e8", fontSize: 13 }}>{msg}</div>}
  </div>;
}
