import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";

// Écran « Dossiers de risque » (Vague 2 — instruction). Relit la file des dossiers
// (GET /v1/riskcases), instruit un dossier en APPEND-ONLY (POST/GET /v1/riskcases/:id/notes, R134)
// et le fait avancer (POST /v1/riskcases/:id/transition, R133/R136 ; un état terminal exige un
// motif, R7). Aucune règle côté écran : le service ratifié porte les invariants.

type Dossier = { id: string; statut: string; clientId: string };
type Note = { id?: string; texte: string; auteur?: string; at?: string };
const TRANSITIONS: Record<string, string[]> = {
  NOUVELLE: ["EN_ANALYSE"], EN_ANALYSE: ["CLARIFICATION", "CLOTUREE", "ESCALADEE"],
  CLARIFICATION: ["EN_ANALYSE"], CLOTUREE: [], ESCALADEE: ["CLOTUREE"],
};
const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });

export function DossiersRisque() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [sel, setSel] = useState<Dossier | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [texte, setTexte] = useState("");
  const [vers, setVers] = useState("");
  const [motif, setMotif] = useState("");
  const [msg, setMsg] = useState("");

  async function charger() {
    setMsg("");
    const d = await apiGetSourced<Dossier[]>("/v1/riskcases", []);
    setDossiers(d.data);
  }
  async function ouvrir(d: Dossier) {
    setSel(d); setVers(""); setMotif(""); setMsg("");
    const n = await apiGetSourced<Note[]>(`/v1/riskcases/${d.id}/notes`, []);
    setNotes(n.data);
  }
  async function ajouterNote() {
    if (!sel) return;
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/riskcases/${sel.id}/notes`, { method: "POST", headers: auth(),
      body: JSON.stringify({ texte }) });
    if (r.ok) { setTexte(""); ouvrir(sel); } else { setMsg((await r.json().catch(() => ({}))).message ?? "Erreur"); }
  }
  async function transitionner() {
    if (!sel || !vers) return;
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/riskcases/${sel.id}/transition`, { method: "POST", headers: auth(),
      body: JSON.stringify({ vers, motif: motif || undefined }) });
    const body = await r.json().catch(() => ({}));
    if (r.ok) { setMsg(`Dossier → ${body.statut ?? vers}`); charger(); ouvrir({ ...sel, statut: body.statut ?? vers }); }
    else { setMsg(body.message ?? "Transition refusée"); }
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  const cibles = sel ? (TRANSITIONS[sel.statut] ?? []) : [];
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Dossiers de risque — instruction (notes append-only R134 · transitions R133/R7)</h3>
    <button style={btn} onClick={charger}>Charger les dossiers</button>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}

    <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
      <div style={{ flex: "0 0 320px" }}>
        <h4>File — {dossiers.length}</h4>
        <ul style={{ listStyle: "none", padding: 0, fontSize: 13 }}>
          {dossiers.map((d) => <li key={d.id} onClick={() => ouvrir(d)}
            style={{ padding: 8, marginBottom: 4, borderRadius: 6, cursor: "pointer",
              background: sel?.id === d.id ? "#4A6B28" : "#f3f0e8", color: sel?.id === d.id ? "#fff" : "#333" }}>
            {d.id.slice(0, 8)} — <strong>{d.statut}</strong></li>)}
          {dossiers.length === 0 && <li style={{ color: "#666" }}>Aucun dossier chargé.</li>}
        </ul>
      </div>

      {sel && <div style={{ flex: 1 }}>
        <h4>Dossier {sel.id.slice(0, 8)} — statut {sel.statut}</h4>

        <div style={{ margin: "10px 0" }}>
          <strong style={{ fontSize: 13 }}>Notes d'instruction (chronologique, non modifiables)</strong>
          <ul style={{ fontSize: 13 }}>
            {notes.map((n, i) => <li key={n.id ?? i}>{n.texte}</li>)}
            {notes.length === 0 && <li style={{ color: "#666" }}>Aucune note.</li>}
          </ul>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...inp, flex: 1 }} placeholder="Nouvelle note…" value={texte} onChange={(e) => setTexte(e.target.value)}/>
            <button style={btn} onClick={ajouterNote} disabled={!texte}>Ajouter</button>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <strong style={{ fontSize: 13 }}>Faire avancer le dossier</strong>
          {cibles.length === 0 ? <p style={{ fontSize: 13, color: "#666" }}>État terminal — aucune transition.</p> :
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <select style={inp} value={vers} onChange={(e) => setVers(e.target.value)}>
              <option value="">— vers —</option>
              {cibles.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input style={{ ...inp, flex: 1 }} placeholder="Motif (requis pour clôture/escalade)" value={motif} onChange={(e) => setMotif(e.target.value)}/>
            <button style={btn} onClick={transitionner} disabled={!vers}>Transition</button>
          </div>}
        </div>
      </div>}
    </div>
  </div>;
}
