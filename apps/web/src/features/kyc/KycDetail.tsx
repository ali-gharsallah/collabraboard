import React, { useEffect, useState } from "react";
import { DemoModeBanner } from "../../components/DemoModeBanner";

// Détail dossier : sections → questions (droits appliqués côté serveur),
// visas de section, validation four-eyes. Miroir produit de l'écran démo.
export function KycDetail({ code }: { code: string }) {
  const [kyc, setKyc] = useState<any>(null);
  const [err, setErr] = useState("");
  const base = (window as any).OLIVE_API_URL;
  const H = { "Content-Type": "application/json",
    Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` };
  const load = () => fetch(`${base}/v1/kyc/${code}`, { headers: H })
    .then(r => r.json()).then(setKyc);
  useEffect(() => { if (base) load(); }, [code]);
  if (!base) return <DemoModeBanner/>;
  if (!kyc) return <p>Chargement…</p>;

  async function call(path: string, method: string, body?: any) {
    setErr("");
    const r = await fetch(`${base}${path}`, { method, headers: H,
      body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) setErr((await r.json()).message ?? "Erreur"); else load();
  }
  return <div>
    <h3>{kyc.code} — {kyc.workflow} · score {kyc.riskScore} · {kyc.status}</h3>
    {err && <p style={{ color: "#B5483C" }}>{err}</p>}
    {kyc.sections.map((s: any) => <div key={s.code} style={{ marginBottom: 14 }}>
      <h4>{s.label} {kyc.visas.filter((v: any) => v.sectionCode === s.code)
        .map((v: any) => <button key={v.requiredRole} disabled={v.status === "SIGNED"}
          onClick={() => call(`/v1/kyc/${code}/visas/${s.code}`, "POST")}
          style={{ marginLeft: 8, fontSize: 11 }}>
          {v.status === "SIGNED" ? `✓ visa ${v.requiredRole}` : `Signer (${v.requiredRole})`}</button>)}
      </h4>
      {s.questions.map((q: any) => <div key={q.code} style={{ display: "flex", gap: 8, padding: "4px 0" }}>
        <span style={{ width: 380, fontSize: 13 }}>{q.label}</span>
        <input defaultValue={q.answer ?? ""} disabled={q.right !== "EDIT" && q.right !== "REQUIRED"}
          onBlur={e => e.target.value !== (q.answer ?? "") &&
            call(`/v1/kyc/${code}/questions/${q.code}`, "PATCH", { answer: e.target.value })}
          style={{ flex: 1, padding: 6, borderRadius: 6,
            border: "1px solid #ccc", fontSize: 12 }}/>
        <span style={{ fontSize: 10, color: "#888", width: 70 }}>{q.right}</span>
      </div>)}
    </div>)}
    <button onClick={() => call(`/v1/kyc/${code}/validate`, "POST")}
      disabled={kyc.status === "VALIDATED"}
      style={{ padding: "10px 18px", background: "#4A6B28", color: "#fff",
        border: "none", borderRadius: 8, cursor: "pointer" }}>
      Validation finale (four-eyes)</button>
  </div>;
}
