import React, { useEffect, useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";

// Écran « Dashboard exécutif » (Vague 3, minimal). AGRÈGE des stocks listables et cloisonnés au
// tenant (RLS) : onboardings par étape (GET /v1/onboarding), dossiers de risque par statut
// (GET /v1/riskcases), hits de screening par statut (GET /v1/screening/hits). Lecture pure — le
// COO voit « où sont les dossiers et ce qui bloque » sans qu'aucun état ne bouge.

type Onboarding = { id: string; etape: string; slaSignale?: boolean };
type Dossier = { id: string; statut: string };
type Hit = { id: string; statut: string };
const count = <T,>(rows: T[], key: (r: T) => string): Record<string, number> =>
  rows.reduce((a, r) => { const k = key(r); a[k] = (a[k] ?? 0) + 1; return a; }, {} as Record<string, number>);

export function Dashboard() {
  const [obs, setObs] = useState<Onboarding[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function charger() {
    setObs((await apiGetSourced<Onboarding[]>("/v1/onboarding", [])).data);
    setDossiers((await apiGetSourced<Dossier[]>("/v1/riskcases", [])).data);
    setHits((await apiGetSourced<Hit[]>("/v1/screening/hits", [])).data);
    setLoaded(true);
  }
  useEffect(() => { charger(); }, []);

  const parEtape = count(obs, (o) => o.etape);
  const slaBloques = obs.filter((o) => o.slaSignale).length;
  const parStatut = count(dossiers, (d) => d.statut);
  const hitsParStatut = count(hits, (h) => h.statut);

  const card = (titre: string, data: Record<string, number>, total: number, alerte?: string) =>
    <div style={{ flex: "1 1 260px", padding: 16, borderRadius: 10, background: "#f3f0e8", border: "1px solid #e0dccb" }}>
      <div style={{ fontSize: 13, color: "#555" }}>{titre}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: "#4A6B28" }}>{total}</div>
      {alerte && <div style={{ fontSize: 12, color: "#c33", fontWeight: 600 }}>{alerte}</div>}
      <ul style={{ fontSize: 12, marginTop: 6, paddingLeft: 16 }}>
        {Object.entries(data).map(([k, v]) => <li key={k}>{k} : <strong>{v}</strong></li>)}
        {total === 0 && <li style={{ color: "#888" }}>—</li>}
      </ul>
    </div>;

  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Dashboard exécutif — stock par état & goulots (lecture, cloisonnée RLS)</h3>
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}>
      {card("Onboardings par étape", parEtape, obs.length, slaBloques ? `${slaBloques} en alerte SLA (goulot)` : undefined)}
      {card("Dossiers de risque par statut", parStatut, dossiers.length)}
      {card("Hits de screening par statut", hitsParStatut, hits.length)}
    </div>
    {loaded && obs.length === 0 && dossiers.length === 0 && hits.length === 0 &&
      <p style={{ fontSize: 13, color: "#666", marginTop: 12 }}>Aucun stock pour ce tenant.</p>}
  </div>;
}
