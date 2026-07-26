import React, { useEffect, useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";

// Écran « Registre LBA » (Vague 4). Piste d'audit AGRÉGÉE — traçabilité, pas un nouveau moteur.
// Le registre compose des journaux append-only EXISTANTS, cloisonnés au tenant (RLS) :
// communications MROS (GET /v1/mros), verdicts de transaction en revue (GET /v1/transactions/revue),
// passages de screening (GET /v1/screening/runs). Lecture pure — rien ne change d'état.

type Comm = { id: string; decision: string; dossierSha256: string; decideAt?: string };
type Verdict = { id: string; txRef: string; verdict: string };
type Run = { id: string; liste: string; listeVersion: string; nbHits: number; at?: string };
type Ligne = { quand: string; type: string; detail: string };

export function RegistreLBA() {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function charger() {
    const comms = (await apiGetSourced<Comm[]>("/v1/mros", [])).data;
    const verdicts = (await apiGetSourced<Verdict[]>("/v1/transactions/revue", [])).data;
    const runs = (await apiGetSourced<Run[]>("/v1/screening/runs", [])).data;
    const l: Ligne[] = [
      ...comms.map((c) => ({ quand: c.decideAt ?? "", type: "MROS", detail: `Décision ${c.decision} — empreinte ${c.dossierSha256?.slice(0, 12)}…` })),
      ...verdicts.map((v) => ({ quand: "", type: "TRANSACTION", detail: `${v.txRef} — verdict ${v.verdict}` })),
      ...runs.map((r) => ({ quand: r.at ?? "", type: "SCREENING", detail: `${r.liste} @ ${r.listeVersion} — ${r.nbHits} hit(s)` })),
    ].sort((a, b) => (b.quand || "").localeCompare(a.quand || ""));
    setLignes(l); setLoaded(true);
  }
  useEffect(() => { charger(); }, []);

  const color = (t: string) => ({ MROS: "#c33", TRANSACTION: "#c93", SCREENING: "#4A6B28" } as Record<string, string>)[t] ?? "#666";
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Registre LBA — piste d'audit agrégée (traçabilité, cloisonnée RLS)</h3>
    <p style={{ fontSize: 12, color: "#777" }}>Agrégation de journaux append-only existants (MROS · transactions · screening) —
      pas un nouveau moteur. Chaque ligne renvoie à sa source opposable.</p>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 10 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}>
        <th style={{ padding: 6 }}>Type</th><th>Détail</th><th>Quand</th></tr></thead>
      <tbody>
        {lignes.map((l, i) => <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
          <td style={{ padding: 6 }}><span style={{ padding: "2px 8px", borderRadius: 12, background: color(l.type), color: "#fff", fontSize: 11, fontWeight: 700 }}>{l.type}</span></td>
          <td>{l.detail}</td><td>{l.quand ? new Date(l.quand).toLocaleString() : "—"}</td>
        </tr>)}
        {loaded && lignes.length === 0 && <tr><td colSpan={3} style={{ padding: 6, color: "#666" }}>Registre vide pour ce tenant.</td></tr>}
      </tbody>
    </table>
  </div>;
}
