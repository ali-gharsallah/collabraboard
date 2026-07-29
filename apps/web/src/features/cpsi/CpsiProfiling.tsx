import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// Écran « CPSI — Profil & score » (porte mince CPSI, CP-01/02/08). LECTURE : GET
// /v1/cpsi/clients/:id/score → score perpétuel + bande (R66) + drivers explicables dont la somme
// reconstitue le score (R67). Aucune écriture. Le calcul vient du moteur ratifié (la porte relaie).

type Driver = { source: string; contribution: number };
type Score = { clientId: string; score: number; bande: string; drivers: Driver[] };

const SEED: Score = { clientId: "demo", score: 62, bande: "MEDIUM",
  drivers: [{ source: "statique:pep", contribution: 15 }, { source: "statique:pays_risque", contribution: 6 },
    { source: "hit_screening@J-30", contribution: 8 }, { source: "review_defavorable@J-12", contribution: 9 }] };

const bandeColor = (b: string) => b === "HIGH" ? tokens.color.danger : b === "MEDIUM" ? tokens.color.gold : tokens.color.ok;

export function CpsiProfiling() {
  const [cid, setCid] = useState("");
  const [data, setData] = useState<Score | null>(null);
  const [demo, setDemo] = useState(false);
  const [err, setErr] = useState("");

  async function charger(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setData(null);
    const id = cid.trim(); if (!id) return;
    const r = await apiGetSourced<Score>(`/v1/cpsi/clients/${encodeURIComponent(id)}/score`, { ...SEED, clientId: id });
    setData(r.data); setDemo(r.isDemo);
  }

  const somme = data ? Math.round(data.drivers.reduce((s, d) => s + d.contribution, 0) * 100) / 100 : 0;
  return <div>
    {demo && <DemoModeBanner/>}
    <h3>CPSI — Profil & score perpétuel (R63/R67)</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>Le score est calculé par le moteur ratifié et
      <strong> rejouable à date</strong> (R48). Chaque score publie ses <strong>drivers</strong> dont la somme le
      reconstitue (R67) — aucun score boîte noire.</p>
    <form onSubmit={charger} style={{ display: "flex", gap: 8, margin: "10px 0" }}>
      <input value={cid} onChange={(e) => setCid(e.target.value)} placeholder="Identifiant client CPSI"
        style={{ flex: 1, padding: 8, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.color.border}` }}/>
      <button type="submit" style={{ padding: "8px 16px", borderRadius: tokens.radius.sm, border: "none",
        background: tokens.color.olive700, color: "#fff", cursor: "pointer" }}>Charger le score</button>
    </form>
    {err && <div style={{ color: tokens.color.danger, fontSize: 12 }}>{err}</div>}
    {data && <div style={{ padding: 14, borderRadius: tokens.radius.lg, background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontSize: 34, fontWeight: 800, color: tokens.color.ink }}>{data.score}</span>
        <span style={{ padding: "2px 10px", borderRadius: 999, background: bandeColor(data.bande), color: "#fff", fontSize: 12, fontWeight: 700 }}>{data.bande}</span>
        <span style={{ fontSize: 12, color: tokens.color.muted }}>client {data.clientId}</span>
      </div>
      <div style={{ marginTop: 12, fontWeight: 700, fontSize: 13 }}>Drivers (Σ = {somme})</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6, fontSize: 12 }}>
        <tbody>
          {data.drivers.map((d, i) => <tr key={i} style={{ borderTop: `1px solid ${tokens.color.border}` }}>
            <td style={{ padding: "4px 0", color: tokens.color.ink }}>{d.source}</td>
            <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600 }}>{d.contribution}</td>
          </tr>)}
        </tbody>
      </table>
      {isDemoMode() && <div style={{ marginTop: 8, fontSize: 11, color: tokens.color.muted }}>Données de démonstration — connectez l'API pour un score réel.</div>}
    </div>}
  </div>;
}
