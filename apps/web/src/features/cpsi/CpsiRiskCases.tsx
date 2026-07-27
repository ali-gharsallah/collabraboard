import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// Écran « CPSI — Alertes & risk cases » (porte mince CPSI, CP-12/15/17). LECTURE : signaux scorés
// dédupliqués + alertes/near-miss (R80/R81) et reporting SLA (R39, mesure sans bloquer). ACTION :
// ouvrir un risk case depuis une alerte (CP-15) — le moteur décide, la porte relaie ; décision humaine.

type Signal = { client: string; scenario: string; groupe: string; score: number; statut: string };
type Alerts = { signaux: Signal[]; alertes: Signal[]; nearMiss: Signal[]; correlations: Record<string, string[]> };
type Reporting = { par_etat: Record<string, number>; sla_jours: number; hors_sla: number };

const SEED_A: Alerts = {
  signaux: [{ client: "c-001", scenario: "SC_STRUCTURATION", groupe: "PEP", score: 72, statut: "ALERTE" },
    { client: "c-002", scenario: "SC_VELOCITE", groupe: "TRADING", score: 48, statut: "NEAR_MISS" }],
  alertes: [{ client: "c-001", scenario: "SC_STRUCTURATION", groupe: "PEP", score: 72, statut: "ALERTE" }],
  nearMiss: [{ client: "c-002", scenario: "SC_VELOCITE", groupe: "TRADING", score: 48, statut: "NEAR_MISS" }],
  correlations: { "c-001": ["SC_STRUCTURATION", "SC_WIRES"] } };
const SEED_R: Reporting = { par_etat: { NOUVELLE: 2, EN_ANALYSE: 1, CLOTUREE: 4, ESCALADEE: 1 }, sla_jours: 30, hors_sla: 0 };

const statutColor = (s: string) => s === "ALERTE" ? tokens.color.danger : s === "NEAR_MISS" ? tokens.color.gold : tokens.color.muted;

export function CpsiRiskCases() {
  const { data: al, isDemo, reload } = useApiOrSeed<Alerts>("/v1/cpsi/alerts", SEED_A);
  const { data: rep } = useApiOrSeed<Reporting>("/v1/cpsi/risk-cases/reporting", SEED_R);
  const [msg, setMsg] = useState("");

  async function ouvrir(s: Signal) {
    setMsg("");
    try {
      const rc = await apiPost<{ id: string; etat: string }>("/v1/cpsi/risk-cases", { alertes: [{ client: s.client, scenario: s.scenario }] });
      setMsg(`Risk case ${rc.id} ouvert (${rc.etat}) — instruction humaine à suivre.`); reload();
    } catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }

  return <div>
    {isDemo && <DemoModeBanner/>}
    <h3>CPSI — Alertes scorées & risk cases (R80/R81/R83)</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>Un <strong>signal scoré</strong> par (client, scénario),
      classé <strong>ALERTE</strong> (score ≥ seuil X), near-miss ou analyse (R80). Le reporting SLA <strong>mesure sans bloquer</strong> (R39).
      Ouvrir un case relaie le moteur — la décision reste humaine (R44).</p>

    <div style={{ display: "flex", gap: 6, fontSize: 12, margin: "8px 0", flexWrap: "wrap" }}>
      {Object.entries(rep.par_etat).map(([e, n]) => <span key={e} style={{ padding: "3px 10px", borderRadius: 999,
        background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>{e} : <strong>{n}</strong></span>)}
      <span style={{ padding: "3px 10px", borderRadius: 999, background: rep.hors_sla ? tokens.color.danger : tokens.color.ok, color: "#fff" }}>
        hors SLA ({rep.sla_jours}j) : {rep.hors_sla}</span>
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#eef4e6", fontSize: 12 }}>{msg}</div>}

    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6, fontSize: 12 }}>
      <thead><tr style={{ textAlign: "left", color: tokens.color.muted }}>
        <th style={{ padding: "4px 6px" }}>Client</th><th>Scénario</th><th>Groupe</th><th>Score</th><th>Statut</th><th></th>
      </tr></thead>
      <tbody>
        {al.signaux.map((s, i) => <tr key={i} style={{ borderTop: `1px solid ${tokens.color.border}` }}>
          <td style={{ padding: "5px 6px" }}>{s.client}{al.correlations[s.client]?.length >= 2 && <span title="corrélation R81 (≥2 scénarios)" style={{ color: tokens.color.danger, marginLeft: 4 }}>⚭</span>}</td>
          <td>{s.scenario}</td><td>{s.groupe}</td><td style={{ fontWeight: 600 }}>{s.score}</td>
          <td><span style={{ color: statutColor(s.statut), fontWeight: 700 }}>{s.statut}</span></td>
          <td style={{ textAlign: "right" }}>{s.statut === "ALERTE" &&
            <button disabled={isDemoMode()} onClick={() => ouvrir(s)} style={{ padding: "3px 10px", borderRadius: 6, border: "none",
              background: isDemoMode() ? "#ccc" : tokens.color.olive700, color: "#fff", cursor: "pointer", fontSize: 11 }}>Ouvrir un case</button>}</td>
        </tr>)}
      </tbody>
    </table>
    {!al.signaux.length && <div style={{ marginTop: 12, color: tokens.color.muted, fontSize: 13 }}>Aucun signal scoré.</div>}
  </div>;
}
