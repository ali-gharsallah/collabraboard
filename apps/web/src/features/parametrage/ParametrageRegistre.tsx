import React, { useEffect, useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";

// Écran « Registre de paramétrage » (Vague 6). Tout le paramétrage vit sous « Paramètres »
// (R125). Le registre R-Q se GÉNÈRE du canon (GET /v1/parametres/registre) ; écrire une valeur
// est changer une RÈGLE : typé, motivé (R7/R126), daté, JAMAIS rétroactif (POST /valeur/:cle).
// La valeur d'alors se relit à une date (R127). Aucune règle côté écran.

type Entree = { cle: string; type: string; defaut: unknown; regle: string; requis: boolean; description: string };
const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });

export function ParametrageRegistre() {
  const [registre, setRegistre] = useState<Entree[]>([]);
  const [sel, setSel] = useState<Entree | null>(null);
  const [valeur, setValeur] = useState("");
  const [motif, setMotif] = useState("");
  const [effetAt, setEffetAt] = useState("");
  const [dateRelecture, setDateRelecture] = useState("");
  const [msg, setMsg] = useState("");

  async function charger() { setRegistre((await apiGetSourced<Entree[]>("/v1/parametres/registre", [])).data); }
  useEffect(() => { charger(); }, []);

  function choisir(e: Entree) { setSel(e); setValeur(""); setMotif(""); setEffetAt(""); setMsg(""); }
  function parse(t: string, raw: string): unknown {
    if (t === "int") return Number(raw);
    if (t === "bool") return raw === "true";
    if (t === "json") { try { return JSON.parse(raw); } catch { return raw; } }
    return raw;
  }
  async function ecrire() {
    if (!sel) return;
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/parametres/valeur/${sel.cle}`, { method: "POST", headers: auth(),
      body: JSON.stringify({ valeur: parse(sel.type, valeur), motif, effetAt: effetAt || undefined }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? `« ${sel.cle} » écrit (motivé, daté${effetAt ? " au " + effetAt : ""}).` : (b.message ?? "Refus (motif ? type ? rétroactif ?)"));
  }
  async function relire() {
    if (!sel) return;
    const q = dateRelecture ? `?date=${dateRelecture}` : "";
    const d = await apiGetSourced<unknown>(`/v1/parametres/valeur/${sel.cle}${q}`, null);
    setMsg(`« ${sel.cle} »${dateRelecture ? " au " + dateRelecture : " (courant)"} = ${JSON.stringify(d.data)} (R127).`);
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Registre de paramétrage (R-Q) — changer un paramètre = changer une règle (R125→R127)</h3>
    <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 420px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}>
            <th style={{ padding: 6 }}>Clé</th><th>Type</th><th>Règle</th><th>Requis</th></tr></thead>
          <tbody>
            {registre.map((e) => <tr key={e.cle} onClick={() => choisir(e)}
              style={{ borderBottom: "1px solid #eee", cursor: "pointer", background: sel?.cle === e.cle ? "#f3f0e8" : undefined }}>
              <td style={{ padding: 6, fontWeight: 600 }}>{e.cle}</td><td>{e.type}</td><td>{e.regle}</td>
              <td align="center">{e.requis ? "●" : "—"}</td></tr>)}
            {registre.length === 0 && <tr><td colSpan={4} style={{ padding: 6, color: "#666" }}>Registre non chargé.</td></tr>}
          </tbody>
        </table>
      </div>
      {sel && <div style={{ flex: "1 1 300px" }}>
        <h4>{sel.cle} <span style={{ fontSize: 11, color: "#888" }}>({sel.type} · {sel.regle})</span></h4>
        <p style={{ fontSize: 12, color: "#555" }}>{sel.description}</p>
        <div style={{ display: "grid", gap: 8 }}>
          <input style={inp} placeholder={`nouvelle valeur (${sel.type})`} value={valeur} onChange={(e) => setValeur(e.target.value)}/>
          <input style={inp} placeholder="motif (obligatoire, R7)" value={motif} onChange={(e) => setMotif(e.target.value)}/>
          <input style={inp} placeholder="date d'effet (optionnelle, jamais passée — R126)" value={effetAt} onChange={(e) => setEffetAt(e.target.value)}/>
          <button style={btn} onClick={ecrire} disabled={!valeur || !motif}>Écrire (motivé, daté)</button>
          <hr style={{ border: "none", borderTop: "1px solid #eee" }}/>
          <input style={inp} placeholder="relire à la date (R127)" value={dateRelecture} onChange={(e) => setDateRelecture(e.target.value)}/>
          <button style={{ ...btn, background: "#777" }} onClick={relire}>Valeur d'alors</button>
        </div>
      </div>}
    </div>
    {msg && <div style={{ margin: "12px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}
  </div>;
}
