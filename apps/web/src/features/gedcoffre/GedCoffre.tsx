import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";

// Écran « GED / documents (coffre, preuve) » (Vague 4). Consultation filtrée au rôle (R110) ;
// la fiche (GET /v1/ged/documents/:id) porte les VERSIONS d'une pièce — la preuve d'intégrité —
// et JAMAIS le contenu (R145 : le contenu ne passe que par le coffre vérifié). Routes GED
// inchangées. Écart signalé : la restitution de l'empreinte par version dépend d'un correctif
// GED hors périmètre (divergence champ fake/modèle `numero`/`sha256`) — la fiche liste les
// versions, la valeur d'empreinte peut ne pas être restituée tant que ce correctif n'est pas fait.

type Piece = { id: string; typeCode: string; nom: string; statut: string; legalHold?: boolean };
type Version = { id: string; numero?: number; no?: number; sha256?: string; empreinte?: string };
type Fiche = { document: Piece; versions: Version[] };

export function GedCoffre() {
  const [clientId, setClientId] = useState("");
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [charge, setCharge] = useState(false);

  async function charger() {
    setFiche(null);
    setPieces((await apiGetSourced<Piece[]>(`/v1/ged/documents?clientId=${clientId}`, [])).data);
    setCharge(true);
  }
  async function voir(id: string) { setFiche((await apiGetSourced<Fiche | null>(`/v1/ged/documents/${id}`, null)).data); }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>GED / documents — coffre & preuve d'intégrité (R110/R145)</h3>
    <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
      <input style={inp} placeholder="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}/>
      <button style={btn} onClick={charger} disabled={!clientId}>Lister les pièces</button>
    </div>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}>
        <th style={{ padding: 6 }}>Type</th><th>Nom</th><th>Statut</th><th>Gel</th><th/></tr></thead>
      <tbody>
        {pieces.map((p) => <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
          <td style={{ padding: 6, fontWeight: 600 }}>{p.typeCode}</td><td>{p.nom}</td><td>{p.statut}</td>
          <td align="center">{p.legalHold ? "🔒" : "—"}</td>
          <td><button style={btn} onClick={() => voir(p.id)}>Preuve</button></td>
        </tr>)}
        {charge && pieces.length === 0 && <tr><td colSpan={5} style={{ padding: 6, color: "#666" }}>Aucune pièce visible (rôle non autorisé ? R110).</td></tr>}
      </tbody>
    </table>
    {fiche && <div style={{ marginTop: 18, padding: 12, borderRadius: 8, background: "#f3f0e8" }}>
      <h4 style={{ marginTop: 0 }}>Preuve — {fiche.document.nom} ({fiche.document.typeCode})</h4>
      <strong style={{ fontSize: 13 }}>Versions (succession, empreinte au dépôt — jamais le contenu, R145)</strong>
      <ul style={{ fontSize: 12, fontFamily: "monospace" }}>
        {fiche.versions.map((v) => <li key={v.id}>v{v.numero ?? v.no ?? "?"} — {(v.sha256 ?? v.empreinte ?? "(empreinte non restituée — écart GED signalé)").slice(0, 24)}…</li>)}
        {fiche.versions.length === 0 && <li style={{ color: "#666" }}>Aucune version.</li>}
      </ul>
    </div>}
  </div>;
}
