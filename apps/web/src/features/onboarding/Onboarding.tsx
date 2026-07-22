import React, { useState } from "react";
import { isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";

// Écran « Onboarding / entrée en relation » (Vague 3). Ouvre une relation (POST /v1/onboarding),
// entre en collecte (POST /v1/onboarding/:id/transition vers COLLECTE) — LE MOTEUR crée alors le
// KYC (R118) et l'AIGUILLE en SDD/CDD/EDD selon le risque (structure/compte/pays). La trace de
// risque (riskTrace) est auditable. L'ouverture reste refusée sans KYC VALIDATED (R119).

const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });
type Trace = { rule: string; points: number; detail: string };

export function Onboarding() {
  const [prospect, setProspect] = useState("");
  const [clientId, setClientId] = useState("");
  const [structure, setStructure] = useState("PP");
  const [compte, setCompte] = useState("CURRENT");
  const [pays, setPays] = useState("CH");
  const [msg, setMsg] = useState("");
  const [aiguillage, setAiguillage] = useState<{ workflow: string; level: string; trace: Trace[] } | null>(null);

  async function aiguiller() {
    setMsg(""); setAiguillage(null);
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    // L'aiguillage est porté par le moteur KYC (diligence = risque). On crée le KYC : sa réponse
    // porte workflow + riskTrace. (Le pipeline onboarding consomme la même création, R118.)
    const r = await fetch(`${base}/v1/kyc`, { method: "POST", headers: auth(),
      body: JSON.stringify({ clientId, legalStructure: structure, accountType: compte, countryCode: pays, rmId: "rm" }) });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(b.message ?? "Erreur"); return; }
    setAiguillage({ workflow: b.workflow, level: b.riskLevel, trace: b.riskTrace ?? [] });
    setMsg(`Dossier KYC ${b.code ?? ""} créé — aiguillé en ${b.workflow}.`);
  }
  async function ouvrirRelation() {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/onboarding`, { method: "POST", headers: auth(), body: JSON.stringify({ prospectNom: prospect }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Relation ouverte (prospect ${String(b.id ?? "").slice(0, 8)}) — étape ${b.etape}.` : (b.message ?? "Erreur"));
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  const badge = (w: string) => ({ SDD: "#3a7", CDD: "#c93", EDD: "#c33" } as Record<string, string>)[w] ?? "#666";
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Onboarding — entrée en relation & aiguillage de diligence (R117/R118/R119)</h3>
    <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap", alignItems: "center" }}>
      <input style={inp} placeholder="Nom du prospect" value={prospect} onChange={(e) => setProspect(e.target.value)}/>
      <button style={btn} onClick={ouvrirRelation} disabled={!prospect}>Ouvrir la relation</button>
    </div>
    <h4 style={{ marginTop: 16 }}>Aiguillage — structure · compte · pays → niveau de diligence</h4>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input style={inp} placeholder="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}/>
      <select style={inp} value={structure} onChange={(e) => setStructure(e.target.value)}>
        {["PP", "SA", "SARL", "HOLDING", "DOMICILE", "TRUST", "FOUNDATION", "FUND"].map((s) => <option key={s}>{s}</option>)}
      </select>
      <select style={inp} value={compte} onChange={(e) => setCompte(e.target.value)}>
        {["CURRENT", "ADVISORY", "DISCRETIONARY", "LOMBARD"].map((s) => <option key={s}>{s}</option>)}
      </select>
      <input style={{ ...inp, width: 70 }} placeholder="pays" value={pays} onChange={(e) => setPays(e.target.value.toUpperCase())}/>
      <button style={btn} onClick={aiguiller} disabled={!clientId}>Aiguiller</button>
    </div>
    {msg && <div style={{ margin: "10px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}
    {aiguillage && <div style={{ marginTop: 10 }}>
      <span style={{ padding: "4px 12px", borderRadius: 20, background: badge(aiguillage.workflow), color: "#fff", fontWeight: 700 }}>
        {aiguillage.workflow}</span> <span style={{ fontSize: 13, color: "#555" }}>niveau {aiguillage.level}</span>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 8 }}>
        <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}><th style={{ padding: 6 }}>Règle</th><th>Points</th><th>Détail</th></tr></thead>
        <tbody>{aiguillage.trace.map((t, i) => <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
          <td style={{ padding: 6 }}>{t.rule}</td><td align="center">{t.points}</td><td>{t.detail}</td></tr>)}</tbody>
      </table>
    </div>}
  </div>;
}
