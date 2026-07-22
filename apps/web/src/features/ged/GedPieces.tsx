import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";

// Écran « Pièces (GED) » (Vague 2 — consultation). Liste les pièces d'un client
// (GET /v1/ged/documents?clientId=), filtrées au rôle du jeton par le service (R110, relu à
// l'acte). La fiche (GET /v1/ged/documents/:id) montre les métadonnées et l'empreinte des
// versions — JAMAIS le contenu (R145). Un rôle non autorisé ne voit RIEN (filtrage au résultat).

type Piece = { id: string; clientId: string; typeCode: string; nom: string; statut: string; legalHold?: boolean };
type Version = { id: string; no: number; empreinte: string; creeAt: string };
type Fiche = { document: Piece; versions: Version[] };

export function GedPieces() {
  const [clientId, setClientId] = useState("");
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [charge, setCharge] = useState(false);

  async function charger() {
    setFiche(null);
    const p = await apiGetSourced<Piece[]>(`/v1/ged/documents?clientId=${clientId}`, []);
    setPieces(p.data); setCharge(true);
  }
  async function voir(id: string) {
    const f = await apiGetSourced<Fiche | null>(`/v1/ged/documents/${id}`, null);
    setFiche(f.data);
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Pièces (GED) — consultation filtrée au rôle (R110), sans jamais le contenu (R145)</h3>
    <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
      <input style={inp} placeholder="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}/>
      <button style={btn} onClick={charger} disabled={!clientId}>Lister les pièces</button>
    </div>

    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}>
        <th style={{ padding: 6 }}>Type</th><th>Nom</th><th>Statut</th><th>Gel</th><th/></tr></thead>
      <tbody>
        {pieces.map((p) => <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
          <td style={{ padding: 6, fontWeight: 600 }}>{p.typeCode}</td>
          <td>{p.nom}</td><td>{p.statut}</td><td align="center">{p.legalHold ? "🔒" : "—"}</td>
          <td><button style={btn} onClick={() => voir(p.id)}>Fiche</button></td>
        </tr>)}
        {charge && pieces.length === 0 && <tr><td colSpan={5} style={{ padding: 6, color: "#666" }}>
          Aucune pièce visible (aucune pièce, ou votre rôle n'a pas la lecture de ces types — R110).</td></tr>}
      </tbody>
    </table>

    {fiche && <div style={{ marginTop: 18, padding: 12, borderRadius: 8, background: "#f3f0e8" }}>
      <h4 style={{ marginTop: 0 }}>Fiche — {fiche.document.nom} ({fiche.document.typeCode})</h4>
      <p style={{ fontSize: 13, margin: "4px 0" }}>Statut : {fiche.document.statut}
        {fiche.document.legalHold ? " · sous gel légal 🔒" : ""}</p>
      <strong style={{ fontSize: 13 }}>Versions (empreinte — jamais le contenu, R145)</strong>
      <ul style={{ fontSize: 12, fontFamily: "monospace" }}>
        {fiche.versions.map((v) => <li key={v.id}>v{v.no} — {v.empreinte?.slice(0, 16)}…</li>)}
        {fiche.versions.length === 0 && <li style={{ color: "#666" }}>Aucune version.</li>}
      </ul>
    </div>}
  </div>;
}
