import React, { useState } from "react";
import { isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";

// Écran « Rejeu KYC à date » (Vague 1, esprit R127). L'auditeur saisit un code de dossier et une
// date passée : O-Live reconstruit l'état du dossier À cette date UNIQUEMENT depuis le journal
// d'événements append-only (GET /v1/kyc/:code/a-date?date=…). N'existait pas / EN_COURS / VALIDE.

type EtatKyc = { code: string; dateDemandee: string; existeADate: boolean; statutADate: string;
  evenementsConsideres: { type: string; at: string }[] };
const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;

export function RejeuKyc() {
  const [code, setCode] = useState("");
  const [date, setDate] = useState("");   // yyyy-mm-dd
  const [etat, setEtat] = useState<EtatKyc | null>(null);
  const [err, setErr] = useState("");

  async function rejouer() {
    setErr(""); setEtat(null);
    const base = apiBase();
    if (!base) return;   // bandeau démo affiché par isDemoMode()
    const q = date ? `?date=${encodeURIComponent(new Date(date).toISOString())}` : "";
    const r = await fetch(`${base}/v1/kyc/${code}/a-date${q}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` } });
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).message ?? "Dossier introuvable"); return; }
    setEtat(await r.json());
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  const couleur = etat?.statutADate === "VALIDE" ? "#4A6B28" : etat?.statutADate === "EN_COURS" ? "#8a6d00" : "#8a3b3b";
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Rejeu KYC à date — voir un dossier tel qu'il était (audit, R127)</h3>
    <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
      <input style={inp} placeholder="code du dossier (KYC-…)" value={code} onChange={(e) => setCode(e.target.value)}/>
      <input style={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)}/>
      <button style={btn} onClick={rejouer} disabled={!code}>Rejouer à cette date</button>
    </div>
    {err && <p style={{ color: "#B5483C", fontSize: 13 }}>{err}</p>}
    {etat && <div style={{ padding: 12, borderRadius: 10, background: "#F4F1E8", fontSize: 13 }}>
      <div>Dossier <strong>{etat.code}</strong> au <strong>{etat.dateDemandee.slice(0, 10)}</strong> :</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: couleur, margin: "6px 0" }}>
        {etat.existeADate ? etat.statutADate : "N'EXISTAIT PAS à cette date"}</div>
      <div style={{ color: "#666" }}>Reconstruit depuis {etat.evenementsConsideres.length} événement(s) :
        {etat.evenementsConsideres.map((e) => ` ${e.type}@${e.at.slice(0, 19)}`).join(" ·")}</div>
    </div>}
  </div>;
}
