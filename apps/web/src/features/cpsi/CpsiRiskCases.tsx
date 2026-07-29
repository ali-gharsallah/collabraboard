import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// Écran « CPSI — Alertes & propositions de case » (porte CPSI, CP-12 + R252/PC-09..10). LECTURE :
// signaux scorés dédupliqués + alertes/near-miss (R80/R81). ACTION : ÉMETTRE les case_proposal
// depuis les corrélations R81 (≥2 scénarios même client) — idempotent. Le CPSI PROPOSE ; c'est le
// module riskcases (R133-R136) qui instruit (ouverture, transitions, reporting SLA) — la porte
// n'expose AUCUNE surface produit risk-case (CP-15/16/17 superseded, amendement R248-R252).

type Signal = { client: string; scenario: string; groupe: string; score: number; statut: string };
type Alerts = { signaux: Signal[]; alertes: Signal[]; nearMiss: Signal[]; correlations: Record<string, string[]> };
type Proposal = { client: string; scenarios: string[]; cle: string; emisePar: string; at: string };

const SEED_A: Alerts = {
  signaux: [{ client: "c-001", scenario: "SC_STRUCTURATION", groupe: "PEP", score: 72, statut: "ALERTE" },
    { client: "c-001", scenario: "SC_WIRES", groupe: "PEP", score: 61, statut: "ALERTE" },
    { client: "c-002", scenario: "SC_VELOCITE", groupe: "TRADING", score: 48, statut: "NEAR_MISS" }],
  alertes: [], nearMiss: [],
  correlations: { "c-001": ["SC_STRUCTURATION", "SC_WIRES"] } };
const SEED_P: Proposal[] = [{ client: "c-001", scenarios: ["SC_STRUCTURATION", "SC_WIRES"], cle: "c-001|SC_STRUCTURATION+SC_WIRES", emisePar: "demo", at: "2026-07-27" }];

const statutColor = (s: string) => s === "ALERTE" ? tokens.color.danger : s === "NEAR_MISS" ? tokens.color.gold : tokens.color.muted;

export function CpsiRiskCases() {
  const { data: al, isDemo } = useApiOrSeed<Alerts>("/v1/cpsi/alerts", SEED_A);
  const { data: props, reload: reloadProps } = useApiOrSeed<Proposal[]>("/v1/cpsi/case-proposals", SEED_P);
  const [msg, setMsg] = useState("");

  async function emettre() {
    setMsg("");
    try {
      const r = await apiPost<{ emises: Proposal[]; dejaExistantes: number }>("/v1/cpsi/case-proposals", {});
      setMsg(r.emises.length
        ? `${r.emises.length} proposition(s) émise(s) vers riskcases — l'instruction est humaine (R44).`
        : `Aucune nouvelle corrélation (${r.dejaExistantes} proposition(s) déjà émise(s) — idempotent).`);
      reloadProps();
    } catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }

  return <div>
    {isDemo && <DemoModeBanner/>}
    <h3>CPSI — Alertes scorées & propositions de case (R80/R81 · R252)</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>Un <strong>signal scoré</strong> par (client, scénario),
      classé <strong>ALERTE</strong> (score ≥ seuil X), near-miss ou analyse (R80). Le CPSI <strong>propose</strong> : une
      corrélation (≥2 scénarios, même client) émet un <code>case_proposal</code> idempotent, consommé et
      <strong> instruit par le module riskcases</strong> (R133-R136) — décision humaine (R44), voie MROS.</p>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#eef4e6", fontSize: 12 }}>{msg}</div>}

    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6, fontSize: 12 }}>
      <thead><tr style={{ textAlign: "left", color: tokens.color.muted }}>
        <th style={{ padding: "4px 6px" }}>Client</th><th>Scénario</th><th>Groupe</th><th>Score</th><th>Statut</th>
      </tr></thead>
      <tbody>
        {al.signaux.map((s, i) => <tr key={i} style={{ borderTop: `1px solid ${tokens.color.border}` }}>
          <td style={{ padding: "5px 6px" }}>{s.client}{al.correlations[s.client]?.length >= 2 && <span title="corrélation R81 (≥2 scénarios)" style={{ color: tokens.color.danger, marginLeft: 4 }}>⚭</span>}</td>
          <td>{s.scenario}</td><td>{s.groupe}</td><td style={{ fontWeight: 600 }}>{s.score}</td>
          <td><span style={{ color: statutColor(s.statut), fontWeight: 700 }}>{s.statut}</span></td>
        </tr>)}
      </tbody>
    </table>
    {!al.signaux.length && <div style={{ marginTop: 12, color: tokens.color.muted, fontSize: 13 }}>Aucun signal scoré.</div>}

    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
      <h4 style={{ margin: 0 }}>Propositions de case émises (→ riskcases)</h4>
      <button disabled={isDemoMode()} onClick={emettre} style={{ padding: "5px 12px", borderRadius: 6, border: "none",
        background: isDemoMode() ? "#ccc" : tokens.color.olive700, color: "#fff", cursor: "pointer", fontSize: 12 }}>
        Émettre les propositions</button>
    </div>
    {props.map((p) => <div key={p.cle} style={{ padding: 10, marginTop: 8, borderRadius: tokens.radius.md,
      background: tokens.color.surface, border: `1px solid ${tokens.color.border}`, fontSize: 12 }}>
      <strong>{p.client}</strong> · {p.scenarios.join(" + ")} <span style={{ color: tokens.color.muted }}>· clé {p.cle} · émise par {p.emisePar}</span>
      <div style={{ color: tokens.color.leaf, marginTop: 2 }}>À instruire dans « Dossiers de risque » (R133-R136) — le CPSI ne mute aucun case.</div>
    </div>)}
    {!props.length && <div style={{ marginTop: 8, color: tokens.color.muted, fontSize: 13 }}>Aucune proposition émise.</div>}
  </div>;
}
