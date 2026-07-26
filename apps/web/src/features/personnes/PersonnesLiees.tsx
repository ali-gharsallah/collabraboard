import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";

// Écran « Personnes liées / UBO » (Vague 3). Crée une personne (POST /v1/personnes), la rattache
// à un dossier avec un rôle (POST /v1/personnes/:id/roles — R31 : cumul selon politique banque),
// déclare une relation bijective (POST /v1/personnes/relations — R34 : une arête, deux lectures)
// et relit la chaîne de contrôle (GET /v1/personnes/:id/relations). Écart signalé : le % de
// détention n'est PAS un attribut ratifié du modèle — non affiché, non fabriqué.

type Rel = { autre: string; type: string };
const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });

export function PersonnesLiees() {
  const [nom, setNom] = useState("");
  const [personId, setPersonId] = useState("");
  const [kycFileId, setKycFileId] = useState("");
  const [role, setRole] = useState("UBO");
  const [rels, setRels] = useState<Rel[]>([]);
  const [msg, setMsg] = useState("");

  async function creer() {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/personnes`, { method: "POST", headers: auth(), body: JSON.stringify({ nom }) });
    const b = await r.json().catch(() => ({}));
    if (r.ok) { setPersonId(b.id); setMsg(`Personne créée (${String(b.id).slice(0, 8)}).`); } else setMsg(b.message ?? "Erreur");
  }
  async function rattacher() {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/personnes/${personId}/roles`, { method: "POST", headers: auth(),
      body: JSON.stringify({ kycFileId, role }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Rôle ${role} rattaché au dossier (R31).` : (b.message ?? "Erreur"));
  }
  async function relations() {
    const d = await apiGetSourced<Rel[]>(`/v1/personnes/${personId}/relations`, []);
    setRels(d.data);
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Personnes liées / UBO — chaîne de contrôle (R31/R34)</h3>
    <p style={{ fontSize: 12, color: "#777" }}>Note : le % de détention n'est pas un attribut ratifié du modèle — la chaîne
      montre les rôles (UBO, contrôle) et les relations, pas un pourcentage fabriqué.</p>
    <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
      <input style={inp} placeholder="Nom de la personne" value={nom} onChange={(e) => setNom(e.target.value)}/>
      <button style={btn} onClick={creer} disabled={!nom}>Créer</button>
    </div>
    <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap", alignItems: "center" }}>
      <input style={inp} placeholder="personId" value={personId} onChange={(e) => setPersonId(e.target.value)}/>
      <input style={inp} placeholder="kycFileId (dossier)" value={kycFileId} onChange={(e) => setKycFileId(e.target.value)}/>
      <select style={inp} value={role} onChange={(e) => setRole(e.target.value)}>
        {["UBO", "DETENTEUR_CONTROLE", "TITULAIRE", "SETTLOR", "TRUSTEE", "BENEFICIAIRE", "SIGNATAIRE"].map((x) => <option key={x}>{x}</option>)}
      </select>
      <button style={btn} onClick={rattacher} disabled={!personId || !kycFileId}>Rattacher le rôle</button>
      <button style={{ ...btn, background: "#777" }} onClick={relations} disabled={!personId}>Voir les relations</button>
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}
    <h4>Relations de la personne — {rels.length}</h4>
    <ul style={{ fontSize: 13 }}>
      {rels.map((r, i) => <li key={i}>{r.type} → {r.autre.slice(0, 8)}</li>)}
      {rels.length === 0 && <li style={{ color: "#666" }}>Aucune relation chargée.</li>}
    </ul>
  </div>;
}
