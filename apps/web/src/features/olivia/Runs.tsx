import React, { useEffect, useState } from "react";
import { apiGet, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// ÉCRAN RUNS — Olivia v2 (R266, SW-17/18) : la supervision est un écran de PREMIÈRE CLASSE —
// mesure, pas coercition (R39). Liste (statut, mission, budget consommé/restant, portes en
// attente) · détail = TIMELINE d'étapes (le journal R260, rien d'autre) · STOP propre
// (commanditaire/ops — le serveur décide, le refus s'affiche tel quel, FE-04) · vue agrégée
// tenant. SW-18 (pattern R177/HO-02) : l'interrupteur /v1/olivia/missions gouverne l'écran —
// missions_actives vide ⇒ v2 ÉTEINTE, l'écran se neutralise (bandeau, AUCUN appel runs).

type Run = { id: string; missionCode: string; statut: string; roleCode: string;
  budget: { maxEtapes: number; maxDureeS: number; maxCoutTokens: number };
  consomme: { etapes: number; duree_s: number; tokens: number };
  porteEnAttente?: boolean; livrableMessageId?: string | null; createdAt: string };
type Etape = { seq: number; type: string; agentCode?: string; outilCode?: string;
  entreeEmpreinte?: string; sortie?: unknown; at: string };

const badge = (fond: string): React.CSSProperties =>
  ({ fontSize: 11, padding: "1px 8px", borderRadius: 999, background: fond, color: "#fff" });
const COULEURS: Record<string, string> = { TERMINE: "#2e7d32", EN_COURS: "#1565c0",
  PAUSE_PORTE: "#e65100", INTERROMPU: "#616161", EPUISE: "#8e24aa", ECHOUE: "#c62828", PLANIFIE: "#455a64" };

export function Runs() {
  const [actives, setActives] = useState<string[] | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [detail, setDetail] = useState<(Run & { timeline: Etape[] }) | null>(null);
  const [agregat, setAgregat] = useState<Record<string, unknown> | null>(null);
  const [refus, setRefus] = useState("");

  const charger = async () => setRuns(await apiGet<Run[]>("/v1/olivia/runs", []));
  useEffect(() => {
    // SW-18 : l'INTERRUPTEUR d'abord — v2 éteinte ⇒ aucun autre appel (prouvé MSW en test)
    apiGet<{ actives: string[] }>("/v1/olivia/missions", { actives: [] })
      .then((m) => { setActives(m.actives); if (m.actives.length) charger(); });
  }, []);

  const stopper = async (id: string) => {
    setRefus("");
    try { await apiPost(`/v1/olivia/runs/${id}/stop`, {}); await charger(); setDetail(null); }
    catch (e) { setRefus((e as OliveError).message); }                    // FE-04 : refus serveur tel quel
  };
  const ouvrirDetail = async (id: string) =>
    setDetail(await apiGet<Run & { timeline: Etape[] }>(`/v1/olivia/runs/${id}`, null as never));
  const voirAgregat = async () => {
    setRefus("");
    try { setAgregat(await apiGet<Record<string, unknown>>("/v1/olivia/runs/agregat", {})); }
    catch (e) { setRefus((e as OliveError).message); }
  };

  if (actives === null) return <p>chargement…</p>;
  if (actives.length === 0)
    return <div>
      {isDemoMode() && <DemoModeBanner/>}
      <h3>Runs — Olivia v2</h3>
      <p data-testid="v2-eteinte" style={{ padding: 10, borderRadius: 8, background: "#fff3e0", fontSize: 13 }}>
        v2 éteinte — aucune mission active pour cet établissement (SW-18 : activation explicite
        de <code>missions_actives</code>, pattern R177). Aucun écran de runs n&apos;est monté.</p>
    </div>;

  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Runs — le swarm sous supervision (R266 : mesure, pas coercition)</h3>
    {refus && <p style={{ color: tokens.color.danger, fontSize: 12 }}>{refus}</p>}
    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
      <thead><tr style={{ textAlign: "left", color: tokens.color.muted }}>
        <th>Mission</th><th>Statut</th><th>Rôle</th><th>Budget (étapes · tokens)</th><th>Porte</th><th/></tr></thead>
      <tbody>{runs.map((r) => <tr key={r.id} style={{ borderTop: `1px solid ${tokens.color.border}` }}>
        <td>{r.missionCode}</td>
        <td><span style={badge(COULEURS[r.statut] ?? "#555")}>{r.statut}</span></td>
        <td>{r.roleCode}</td>
        <td>{r.consomme?.etapes ?? 0}/{r.budget?.maxEtapes} · {r.consomme?.tokens ?? 0}/{r.budget?.maxCoutTokens}</td>
        <td>{r.porteEnAttente ? <span style={badge("#e65100")}>porte en attente (R263)</span> : "—"}</td>
        <td style={{ whiteSpace: "nowrap" }}>
          <button style={{ fontSize: 11 }} onClick={() => ouvrirDetail(r.id)}>Timeline</button>{" "}
          {(r.statut === "EN_COURS" || r.statut === "PAUSE_PORTE") &&
            <button style={{ fontSize: 11 }} onClick={() => stopper(r.id)}>STOP</button>}
        </td></tr>)}
      </tbody></table>

    {detail && <div style={{ marginTop: 12, padding: 10, borderRadius: tokens.radius.lg,
      background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>
      <h4 style={{ margin: "0 0 6px" }}>Timeline — {detail.missionCode} <span style={badge(COULEURS[detail.statut] ?? "#555")}>{detail.statut}</span></h4>
      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
        {detail.timeline.map((e) => <li key={e.seq} style={{ marginBottom: 3 }}>
          <strong>{e.type}</strong>{e.agentCode ? ` · ${e.agentCode}` : ""}{e.outilCode ? ` → ${e.outilCode}` : ""}
          {e.entreeEmpreinte && <span style={{ color: tokens.color.muted }}> · empreinte {e.entreeEmpreinte.slice(0, 10)}…</span>}
          {e.sortie != null && <span style={{ color: tokens.color.muted }}> · {JSON.stringify(e.sortie).slice(0, 90)}</span>}
        </li>)}
      </ol>
      <p style={{ fontSize: 11, color: tokens.color.muted }}>Chaque étape est un événement chaîné (R260) — le
        rejeu certifié vit sur la route d&apos;audit <code>/replay</code> (R265).</p>
    </div>}

    <div style={{ marginTop: 12 }}>
      <button style={{ fontSize: 12 }} onClick={voirAgregat}>Vue agrégée tenant</button>
      {agregat && <pre data-testid="agregat" style={{ fontSize: 11, padding: 8, background: "#fff",
        border: `1px solid ${tokens.color.border}`, borderRadius: 6, whiteSpace: "pre-wrap" }}>
        {JSON.stringify(agregat, null, 1)}</pre>}
      <p style={{ fontSize: 11, color: tokens.color.muted }}>Les dépassements de tendance NOTIFIENT, ne bloquent jamais (R39).</p>
    </div>
  </div>;
}
