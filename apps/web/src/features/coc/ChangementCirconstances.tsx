import React, { useState } from "react";
import { isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";

// Écran « Change of Circumstances » (Vague 3). Enregistre un changement sur une personne
// (POST /v1/personnes/:id/coc — R30). La donnée vit sur la personne ; les dossiers reçoivent des
// ÉVÉNEMENTS TRACÉS (propagation), AUCUNE bascule d'état par effet de bord. Un changement sur un
// champ d'IDENTITÉ (nom, naissance, nationalité) DÉCLENCHE un re-screening (R42) — proposé, jamais
// exécuté. L'écran affiche la matérialité (champ identité ⇒ circuit re-screening).

const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });
const IDENTITE = new Set(["nom", "naissance", "nationalite"]);

export function ChangementCirconstances() {
  const [personId, setPersonId] = useState("");
  const [champ, setChamp] = useState("nom");
  const [valeur, setValeur] = useState("");
  const [document, setDocument] = useState("");
  const [msg, setMsg] = useState("");

  async function enregistrer() {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/personnes/${personId}/coc`, { method: "POST", headers: auth(),
      body: JSON.stringify({ champ, valeur, document: document || undefined }) });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(b.message ?? "Erreur"); return; }
    setMsg(IDENTITE.has(champ)
      ? `Changement enregistré sur « ${champ} » (IDENTITÉ) → re-screening DÉCLENCHÉ (R42) + propagation aux dossiers, sans bascule d'état.`
      : `Changement enregistré sur « ${champ} » → propagation aux dossiers (événement tracé), sans re-screening automatique.`);
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  const materiel = IDENTITE.has(champ);
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Change of Circumstances — matérialité & circuit (R30/R42)</h3>
    <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap", alignItems: "center" }}>
      <input style={inp} placeholder="personId" value={personId} onChange={(e) => setPersonId(e.target.value)}/>
      <select style={inp} value={champ} onChange={(e) => setChamp(e.target.value)}>
        {["nom", "naissance", "nationalite", "adresse", "profession", "telephone"].map((c) => <option key={c}>{c}</option>)}
      </select>
      <input style={inp} placeholder="nouvelle valeur" value={valeur} onChange={(e) => setValeur(e.target.value)}/>
      <input style={inp} placeholder="document (optionnel)" value={document} onChange={(e) => setDocument(e.target.value)}/>
      <button style={btn} onClick={enregistrer} disabled={!personId || !valeur}>Enregistrer le changement</button>
    </div>
    <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, fontSize: 13,
      background: materiel ? "#fbeaea" : "#eef3e8", border: `1px solid ${materiel ? "#c33" : "#4A6B28"}` }}>
      {materiel ? "⚠ Champ d'IDENTITÉ — changement MATÉRIEL : déclenche un re-screening (R42)." : "Champ non-identité — propagation tracée aux dossiers, sans re-screening automatique."}
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}
  </div>;
}
