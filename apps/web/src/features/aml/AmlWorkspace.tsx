import React, { useEffect, useMemo, useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// AML INVESTIGATION WORKSPACE (canon vague écrans pilote partie 1, AW-01..08) — le poste de
// travail quotidien du CO, UN écran, 4 onglets. Application de R77 (séparation screening/AML),
// R80-R82 (signaux scorés), R83+R133-R136 (risk cases), R129-R132 (MROS), R44/R7, R48/R49.
// AUCUN chiffre calculé ici : les compteurs sont ceux des endpoints (AW-01) ; le scope est
// appliqué SERVEUR (AW-08) ; la timeline est un REJEU servi par la porte (AW-04, PC-14) ;
// le graphe REND `correlations` (R81), il ne déduit rien. Les filtres sont une PRÉFÉRENCE
// utilisateur (localStorage — pas un paramètre tenant, §1.3).

type Signal = { client: string; scenario: string; groupe: string; impact: number; frequence: number;
  score_brut: number; penalite_fp: number; score: number; seuil: number; statut: string };
type Alerts = { signaux: Signal[]; alertes: Signal[]; nearMiss: Signal[]; correlations: Record<string, string[]> };
type RiskCase = { id: string; clientId: string; statut: string; signalIds: string[]; slaSignale: boolean; createdAt: string };
type Hit = { id: string; statut?: string; nom?: string; liste?: string };

const SEED_ALERTS: Alerts = { signaux: [{ client: "c-demo", scenario: "SC_DEMO", groupe: "PEP", impact: 6,
  frequence: 1.2, score_brut: 7.2, penalite_fp: 0, score: 7.2, seuil: 5, statut: "ALERTE" }],
  alertes: [], nearMiss: [], correlations: { "c-demo": ["SC_DEMO", "SC_DEMO2"] } };
const FILTRES_CLE = "olive.aml.filtres";                                   // préférence UTILISATEUR (§1.3)

export function AmlWorkspace() {
  const [onglet, setOnglet] = useState<"signaux" | "cases" | "screening" | "reporting">("signaux");
  const [filtres, setFiltres] = useState<{ statut: string; scenario: string }>(() => {
    try { return JSON.parse(localStorage.getItem(FILTRES_CLE) ?? "") ?? { statut: "", scenario: "" }; }
    catch { return { statut: "", scenario: "" }; }
  });
  useEffect(() => { localStorage.setItem(FILTRES_CLE, JSON.stringify(filtres)); }, [filtres]);

  const { data: alerts, isDemo, reload: reloadAlerts } = useApiOrSeed<Alerts>("/v1/cpsi/alerts", SEED_ALERTS);
  const { data: cases, reload: reloadCases } = useApiOrSeed<RiskCase[]>("/v1/riskcases",
    [{ id: "rc-demo", clientId: "c-demo", statut: "NOUVELLE", signalIds: [], slaSignale: false, createdAt: "2026-07-01" }]);
  const { data: hits } = useApiOrSeed<Hit[]>("/v1/screening/hits", [{ id: "h-demo", nom: "Doe", liste: "SANCTIONS" }]);
  const { data: vol } = useApiOrSeed<{ total_signaux: number; par_scenario: Record<string, { signaux: number; alertes: number; near_miss: number }> }>(
    "/v1/cpsi/volumetrie", { total_signaux: 1, par_scenario: { SC_DEMO: { signaux: 1, alertes: 1, near_miss: 0 } } });
  // R281 (canon écarts anciens) : la chaîne hit→MROS traverse désormais LA PORTE (PC-18/19) —
  // l'écart PC-12 est soldé ; l'absence de maillon est une DONNÉE affichée, jamais un trou.
  type MaillonSla = { cle: string; t0?: string; t1?: string; t2?: string; maillonManquant: string | null;
    enAttenteMrosJours: number | null; joursHitEscalade: number | null; depassementHitEscalade: boolean };
  const { data: sla } = useApiOrSeed<{ seuils: { hitEscaladeJours: number; escaladeMrosJours: number }; chaine: MaillonSla[] }>(
    "/v1/cpsi/reporting/sla", { seuils: { hitEscaladeJours: 30, escaladeMrosJours: 5 },
      chaine: [{ cle: "demo|SC_A+SC_B", t0: "2026-07-01", t1: "2026-07-10", t2: undefined,
        maillonManquant: "sans MROS", enAttenteMrosJours: 12, joursHitEscalade: 9, depassementHitEscalade: false }] });

  const [drill, setDrill] = useState<Signal | null>(null);
  const [timeline, setTimeline] = useState<{ type: string; at: string }[] | null>(null);
  const [asOf, setAsOf] = useState("");
  const [msg, setMsg] = useState("");

  // Tri §1.3 : alertes scorées d'abord, puis score décroissant, puis âge (ordre serveur) — AUCUN re-calcul.
  const signauxTries = useMemo(() => {
    let xs = alerts.signaux.slice().sort((a, b) =>
      (a.statut === "ALERTE" ? 0 : 1) - (b.statut === "ALERTE" ? 0 : 1) || b.score - a.score);
    if (filtres.statut) xs = xs.filter((s) => s.statut === filtres.statut);
    if (filtres.scenario) xs = xs.filter((s) => s.scenario.includes(filtres.scenario));
    return xs;
  }, [alerts, filtres]);

  const agir = async (fn: () => Promise<unknown>) => {
    setMsg("");
    try { await fn(); reloadAlerts(); reloadCases(); }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }           // FE-04 : le message serveur tel quel
  };
  const chargerTimeline = async (client: string, date?: string) => {
    const r = await apiGetSourced<{ evenements: { type: string; at: string }[] }>(
      `/v1/cpsi/clients/${client}/timeline${date ? `?asOf=${encodeURIComponent(date)}` : ""}`, { evenements: [] });
    setTimeline(r.isDemo ? null : (r.data.evenements ?? []));
  };
  const ouvrirDrill = (s: Signal) => { setDrill(s); setTimeline(null); chargerTimeline(s.client); };
  const caseDuClient = (client: string) => cases.find((c) => c.clientId === client && c.statut !== "CLOTUREE");

  const tab = (id: typeof onglet, label: string) =>
    <button onClick={() => setOnglet(id)} style={{ padding: "6px 14px", border: "none", borderRadius: 6,
      cursor: "pointer", fontWeight: onglet === id ? 700 : 400,
      background: onglet === id ? tokens.color.olive700 : "#eee", color: onglet === id ? "#fff" : "#333" }}>{label}</button>;

  return <div>
    {isDemo && <DemoModeBanner/>}
    <h3>AML Investigation Workspace</h3>
    {/* Bandeau permanent R77 — les deux vocabulaires ne se confondent JAMAIS */}
    <div data-testid="bandeau-r77" style={{ padding: "8px 12px", marginBottom: 10, borderRadius: 8,
      background: "#F4F1E8", border: `1px solid ${tokens.color.border}`, fontSize: 12, color: tokens.color.muted }}>
      Screening (listes) et surveillance AML (scénarios) sont deux domaines distincts (R77) —
      franchissement · signal scoré · alerte scorée : libellés ratifiés.</div>
    {msg && <p style={{ color: tokens.color.danger, fontSize: 13 }}>{msg}</p>}
    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
      {tab("signaux", `Signaux scorés — ${alerts.signaux.length} (alertes : ${alerts.alertes.length})`)}
      {tab("cases", `Risk cases — ${cases.length}`)}
      {tab("screening", `Screening (listes) — ${hits.length}`)}
      {tab("reporting", "Reporting")}
    </div>

    {onglet === "signaux" && <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <select value={filtres.statut} onChange={(e) => setFiltres((f) => ({ ...f, statut: e.target.value }))} style={{ fontSize: 12 }}>
          <option value="">tous statuts</option><option>ALERTE</option><option>NEAR_MISS</option><option>ANALYSE</option></select>
        <input placeholder="filtre scénario" value={filtres.scenario}
          onChange={(e) => setFiltres((f) => ({ ...f, scenario: e.target.value }))} style={{ fontSize: 12, padding: 4 }}/>
        <span style={{ fontSize: 11, color: tokens.color.muted }}>filtres = préférence locale ; le périmètre, lui, est serveur (AW-08)</span>
      </div>
      <table cellPadding={5} style={{ fontSize: 12, width: "100%" }}><thead><tr>
        <th align="left">Client</th><th>Scénario</th><th>Groupe</th><th>Score</th><th>Statut</th><th/></tr></thead>
        <tbody>{signauxTries.map((s, i) => <tr key={i} style={{ background: s.statut === "ALERTE" ? "#FDF3F2" : undefined }}>
          <td>{s.client.slice(0, 8)}</td><td align="center">{s.scenario}</td><td align="center">{s.groupe}</td>
          <td align="center"><strong>{s.score}</strong></td>
          <td align="center">{s.statut === "ALERTE" ? "alerte scorée" : s.statut === "NEAR_MISS" ? "near-miss" : "analyse"}</td>
          <td><button onClick={() => ouvrirDrill(s)} style={{ fontSize: 11 }}>Drill</button></td>
        </tr>)}</tbody></table>

      {drill && <div style={{ marginTop: 12, padding: 12, borderRadius: tokens.radius.lg,
        background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>
        <h4>Signal {drill.scenario} · client {drill.client.slice(0, 8)}</h4>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 240px" }}>
            <strong style={{ fontSize: 13 }}>1 · Le fait — score décomposé (R67, AW-03)</strong>
            <div style={{ fontSize: 12 }}>valeur vs seuil du groupe {drill.groupe} : <strong>{drill.score}</strong> / seuil {drill.seuil}</div>
            <div style={{ fontSize: 12 }}>impact : {drill.impact} · fréquence : {drill.frequence} · score brut : {drill.score_brut}</div>
            <div style={{ fontSize: 12 }}>pénalité FP (R82) : {drill.penalite_fp} → score = max(0, {drill.score_brut} + {drill.penalite_fp}) = <strong>{drill.score}</strong></div>
          </div>
          <div style={{ flex: "1 1 260px" }}>
            <strong style={{ fontSize: 13 }}>2 · Timeline du client — PROJECTION du journal, rejouable (AW-04)</strong>
            <div style={{ display: "flex", gap: 6, margin: "4px 0" }}>
              <input placeholder="as_of ISO (rejeu à date)" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ fontSize: 11, padding: 3, width: 200 }}/>
              <button onClick={() => chargerTimeline(drill.client, asOf || undefined)} style={{ fontSize: 11 }}>Rejouer</button>
            </div>
            {timeline === null ? <div style={{ fontSize: 12, color: tokens.color.danger }}>indisponible</div>
              : timeline.map((e, i) => <div key={i} style={{ fontSize: 11, color: tokens.color.muted }}>{String(e.at).slice(0, 10)} · {e.type}</div>)}
          </div>
          <div style={{ flex: "1 1 220px" }}>
            <strong style={{ fontSize: 13 }}>3 · Corrélation (R81) — le graphe REND, il ne déduit rien</strong>
            <div style={{ fontSize: 12 }}>scénarios touchés : {(alerts.correlations[drill.client] ?? [drill.scenario]).join(" · ")}</div>
            <div style={{ fontSize: 12 }}>risk case lié : {caseDuClient(drill.client)
              ? <strong>{caseDuClient(drill.client)!.id.slice(0, 8)} ({caseDuClient(drill.client)!.statut})</strong>
              : <span style={{ color: tokens.color.muted }}>aucun</span>}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {caseDuClient(drill.client)
            ? <button style={{ fontSize: 12 }} onClick={() => agir(() =>
                apiPost(`/v1/riskcases/${caseDuClient(drill.client)!.id}/rattacher`, { signalId: `${drill.client}|${drill.scenario}` }))}>
                Rattacher au risk case</button>
            : <button style={{ fontSize: 12 }} onClick={() => agir(() =>
                apiPost("/v1/riskcases", { clientId: drill.client, signalIds: [`${drill.client}|${drill.scenario}`] }))}>
                Créer un risk case</button>}
          <button style={{ fontSize: 12 }} onClick={() => { const m = window.prompt("Motif du faux positif (obligatoire, R7)");
            if (m) agir(() => apiPost("/v1/cpsi/false-positives", { client: drill.client, scenario: drill.scenario, motif: m })); }}>
            Déclarer faux positif (motivé)</button>
          <button style={{ fontSize: 12 }} onClick={() => agir(async () => {
            const conv = await apiPost<{ id: string }>("/v1/olivia/conversations",
              { capacite: "C3", ancrageType: "RISK_CASE", ancrageId: caseDuClient(drill.client)?.id });
            setMsg(`Pré-analyse Olivia ouverte (conversation ${conv.id.slice(0, 8)}) — écran Olivia`);
          })} disabled={!caseDuClient(drill.client)}>Pré-analyse Olivia (C3)</button>
        </div>
      </div>}
    </div>}

    {onglet === "cases" && <table cellPadding={5} style={{ fontSize: 12 }}><thead><tr>
      <th align="left">Cas</th><th>Statut</th><th>Signaux</th><th>SLA</th></tr></thead>
      <tbody>{cases.map((c) => <tr key={c.id} style={{ background: c.slaSignale ? "#FFF8E7" : undefined }}>
        <td>{c.id.slice(0, 8)}</td><td align="center"><strong>{c.statut}</strong></td>
        <td align="center">{(c.signalIds ?? []).length}</td>
        <td align="center">{c.slaSignale ? <span style={{ color: "#C9A227", fontWeight: 700 }}>au-delà du SLA — notifié, rien de bloqué (R39)</span> : "—"}</td>
      </tr>)}</tbody></table>}

    {onglet === "screening" && <div>
      <p style={{ fontSize: 12, color: tokens.color.muted }}>Onglet SÉPARÉ (R77) : un hit de screening n&apos;est PAS une alerte AML.</p>
      <table cellPadding={5} style={{ fontSize: 12 }}><thead><tr><th align="left">Hit</th><th>Liste</th><th>Statut</th></tr></thead>
        <tbody>{hits.map((h) => <tr key={h.id}><td>{h.nom ?? h.id.slice(0, 8)}</td>
          <td align="center">{h.liste ?? "—"}</td><td align="center">{h.statut ?? "—"}</td></tr>)}</tbody></table>
    </div>}

    {onglet === "reporting" && <div>
      <p style={{ fontSize: 12, color: tokens.color.muted }}>Volumétrie servie par la porte (PC-13) ; chaîne hit→MROS servie par la porte (R281, PC-18 — le dépassement notifie, ne bloque jamais).</p>
      <div style={{ fontSize: 13 }}>Total signaux : <strong>{vol.total_signaux}</strong></div>
      <table cellPadding={5} style={{ fontSize: 12 }}><thead><tr>
        <th align="left">Scénario</th><th>Signaux</th><th>Alertes</th><th>Near-miss</th></tr></thead>
        <tbody>{Object.entries(vol.par_scenario ?? {}).map(([sc, v]) => <tr key={sc}>
          <td>{sc}</td><td align="center">{v.signaux}</td><td align="center">{v.alertes}</td><td align="center">{v.near_miss}</td></tr>)}</tbody></table>
      <h4 style={{ margin: "12px 0 4px" }}>Délai hit→MROS (R281 — seuils {sla.seuils.hitEscaladeJours} j / {sla.seuils.escaladeMrosJours} j)</h4>
      <table cellPadding={5} style={{ fontSize: 12 }}><thead><tr>
        <th align="left">Chaîne</th><th>t0 signal</th><th>t1 escalade</th><th>t2 MROS</th><th>État</th></tr></thead>
        <tbody>{sla.chaine.map((m) => <tr key={m.cle}>
          <td>{m.cle}</td>
          <td align="center">{m.t0 ? String(m.t0).slice(0, 10) : "—"}</td>
          <td align="center">{m.t1 ? String(m.t1).slice(0, 10) : "—"}</td>
          <td align="center">{m.t2 ? String(m.t2).slice(0, 10) : "—"}</td>
          <td>{m.maillonManquant === "sans MROS" && m.enAttenteMrosJours != null
            ? `en attente MROS : ${m.enAttenteMrosJours} jours`
            : m.maillonManquant ?? `complète (${m.joursHitEscalade ?? "?"} j)`}
            {m.depassementHitEscalade && " · dépassement notifié"}</td></tr>)}</tbody></table>
    </div>}
  </div>;
}
