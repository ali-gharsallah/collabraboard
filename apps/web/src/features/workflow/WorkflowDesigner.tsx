import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";  // contrat UX

// Écran « Workflow Designer/Rules » (Vague 5). Une définition de workflow est un paramètre
// GOUVERNÉ (R171→R173) : le brouillon se modifie à volonté (POST/PATCH /v1/workflow/definitions),
// **publier** grave une version DATÉE, habilitée, motivée (POST …/:id/publier, R171/R7) — une
// version PUBLIEE est IMMUABLE. `resoudre(code, date)` rend la version applicable (R172,
// grandfathering structurel). Aucune règle côté écran : le service porte les invariants.

type Def = { id: string; code: string; version: number; statut: string; depuisLe?: string | null };
const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });

export function WorkflowDesigner() {
  const [code, setCode] = useState("KYC_STD");
  const [contenu, setContenu] = useState('{ "etapes": ["IDENTITY", "RISK"] }');
  const [defs, setDefs] = useState<Def[]>([]);
  const [depuisLe, setDepuisLe] = useState("2026-01-01");
  const [dateRes, setDateRes] = useState("2026-06-01");
  const [msg, setMsg] = useState("");
  const { ask, modal } = useConfirmGate();               // contrat UX : confirmation + pré-vol

  async function lister() { setDefs((await apiGetSourced<Def[]>(`/v1/workflow/definitions?code=${code}`, [])).data); }
  async function creerBrouillon() {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    let c: unknown; try { c = JSON.parse(contenu); } catch { setMsg("Contenu JSON invalide."); return; }
    const r = await fetch(`${base}/v1/workflow/definitions`, { method: "POST", headers: auth(), body: JSON.stringify({ code, contenu: c }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Brouillon créé (v${b.version}).` : (b.message ?? "Erreur"));
    if (r.ok) lister();
  }
  async function publier(id: string, motifArg: string) {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/workflow/definitions/${id}/publier`, { method: "POST", headers: auth(), body: JSON.stringify({ depuisLe, motif: motifArg }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Publiée (immuable, en vigueur au ${depuisLe}).` : (b.message ?? "Erreur (motif/date requis ? R7/R171)"));
    if (r.ok) lister();
  }
  async function resoudre() {
    const r = await apiGetSourced<Def | null>(`/v1/workflow/resoudre?code=${code}&date=${dateRes}`, null);
    setMsg(r.data ? `Au ${dateRes} : version applicable = v${r.data.version} (${r.data.statut}).` : `Aucune version applicable au ${dateRes}.`);
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  return <div>
    {modal}
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Workflow Designer / Rules — définition gouvernée & versionnée (R171→R173)</h3>
    <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap", alignItems: "center" }}>
      <input style={inp} placeholder="code (ex. KYC_STD)" value={code} onChange={(e) => setCode(e.target.value)}/>
      <button style={{ ...btn, background: "#777" }} onClick={lister}>Lister les versions</button>
    </div>
    <textarea style={{ ...inp, width: "100%", minHeight: 70, boxSizing: "border-box", fontFamily: "monospace" }}
      value={contenu} onChange={(e) => setContenu(e.target.value)}/>
    <div style={{ marginTop: 8 }}><button style={btn} onClick={creerBrouillon}>Créer un brouillon</button></div>

    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 12 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}>
        <th style={{ padding: 6 }}>Version</th><th>Statut</th><th>En vigueur</th><th/></tr></thead>
      <tbody>
        {defs.map((d) => <tr key={d.id} style={{ borderBottom: "1px solid #eee" }}>
          <td style={{ padding: 6 }}>v{d.version}</td>
          <td><span style={{ color: d.statut === "PUBLIEE" ? "#4A6B28" : "#c93", fontWeight: 700 }}>{d.statut}</span></td>
          <td>{d.depuisLe ?? "—"}</td>
          <td>{d.statut !== "PUBLIEE" && <button style={btn} onClick={() => ask({ title: "Publier la définition (R171/R7)", danger: true,
            message: `v${d.version} — une version PUBLIÉE est IMMUABLE. En vigueur à partir du ${depuisLe}.`,
            items: [{ label: depuisLe ? `Date de mise en vigueur : ${depuisLe}` : "Date de mise en vigueur manquante", ok: !!depuisLe }],
            input: { label: "Motif de publication", placeholder: "obligatoire (R7)", required: true }, confirmLabel: "Publier (immuable)",
            onConfirm: (m) => publier(d.id, m ?? "") })}>Publier</button>}</td>
        </tr>)}
        {defs.length === 0 && <tr><td colSpan={4} style={{ padding: 6, color: "#666" }}>Aucune version chargée.</td></tr>}
      </tbody>
    </table>

    <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap", alignItems: "center" }}>
      <input style={inp} placeholder="date mise en vigueur (publication)" value={depuisLe} onChange={(e) => setDepuisLe(e.target.value)}/>
      <span style={{ width: 12 }}/>
      <input style={inp} placeholder="résoudre à la date" value={dateRes} onChange={(e) => setDateRes(e.target.value)}/>
      <button style={{ ...btn, background: "#777" }} onClick={resoudre}>Résoudre à date (R172)</button>
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}
  </div>;
}
