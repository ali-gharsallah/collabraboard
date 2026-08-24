import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";  // contrat UX

// Écran « Screening » (Vague 3, enrichi P-L6-3). Lance un screening (POST /v1/screening/run —
// trace TOUJOURS écrite, R103), liste les hits AVEC leur décomposition R411 (via/nom/type/DOB/nat
// telle que calculée par le moteur — l'écran n'invente AUCUN score), la version de liste et la
// config du run (R414). Bandeau d'âge des listes (R409 : GET /v1/screening/listes). Qualification
// d'un hit (motif obligatoire R7, auteur = jeton R101). VRAI_POSITIF PROPOSE l'escalade
// (gel/clarif/MROS), jamais exécutée (R39/R44). Aucune règle côté écran : le service porte les invariants.

type Decomp = { via: string; nameScore: number; typePenalty: number; dobContribution: number; natContribution: number };
type Hit = { id: string; clientId: string; entreeUid: string; score: number; statut: string;
  listeVersion?: string; runId?: string; detail?: Decomp | null };
type Run = { id: string; liste: string; listeVersion: string; seuil: number;
  config?: { moteur?: { phonetique?: boolean; phonetiqueMethode?: string; nationalite?: boolean } } };
type Liste = { source: string; version: string; importeLe: string; nEntrees: number; ageJours: number };
const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });

/** R411 — la décomposition vient du MOTEUR (portée par le hit) ; l'écran ne fait que l'afficher. */
function decomp(d?: Decomp | null): string {
  if (!d) return "—";
  const signe = (n: number) => (n > 0 ? `+${n}` : String(n));
  return `via « ${d.via} » · nom ${d.nameScore} · type ${signe(d.typePenalty)} · DOB ${signe(d.dobContribution)} · nat ${signe(d.natContribution)}`;
}
function configRun(r?: Run): string {
  if (!r) return "—";
  const m = r.config?.moteur ?? {};
  const phon = m.phonetique ? `phon:${m.phonetiqueMethode ?? "metaphone"}` : "phon:off";
  return `seuil ${r.seuil} · ${phon}${m.nationalite ? " · nat:on" : ""}`;
}

export function Screening() {
  const [clientId, setClientId] = useState("");
  const [nom, setNom] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [runs, setRuns] = useState<Map<string, Run>>(new Map());
  const [listes, setListes] = useState<Liste[]>([]);
  const [msg, setMsg] = useState("");
  const { ask, modal } = useConfirmGate();               // contrat UX : confirmation + pré-vol

  async function lancer() {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/screening/run`, { method: "POST", headers: auth(), body: JSON.stringify({
      liste: "SECO", version: "manuel", seuil: 100, prefiltre: {},
      entries: nom ? [{ uid: "M1", nom_complet: nom, alias: [] }] : [], clientIds: clientId ? [clientId] : undefined }) });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(b.message ?? "Erreur"); return; }
    setMsg(`Run tracé (R103) — périmètre ${b.run?.perimetre ?? "?"}, ${b.hits?.length ?? 0} hit(s).`);
    charger();
  }
  async function charger() {
    const [h, r, l] = await Promise.all([
      apiGetSourced<Hit[]>("/v1/screening/hits", []),
      apiGetSourced<Run[]>("/v1/screening/runs", []),
      apiGetSourced<Liste[]>("/v1/screening/listes", []),
    ]);
    setHits(h.data);
    setRuns(new Map(r.data.map((x) => [x.id, x])));
    setListes(l.data);
  }
  async function qualifier(id: string, verdict: string, motif: string) {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/screening/hits/${id}/qualify`, { method: "POST", headers: auth(),
      body: JSON.stringify({ verdict, motif }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Hit qualifié ${verdict}${verdict === "VRAI_POSITIF" ? " — escalade PROPOSÉE (jamais exécutée)" : ""}.` : (b.message ?? "Erreur (motif requis ? R7)"));
    if (r.ok) charger();
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  // R409 — âge des listes : > 7 j = vieillissante (ambre), > 30 j = périmée (rouge).
  const ageStyle = (j: number) => ({ padding: "3px 8px", borderRadius: 6, fontSize: 12,
    background: j > 30 ? "#f8d7da" : j > 7 ? "#fff3cd" : "#e6efdc",
    color: j > 30 ? "#842029" : j > 7 ? "#664d03" : "#2f4a15" });
  return <div>
    {modal}
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Screening (sanctions/PEP) — lancer & qualifier un hit (R100→R103)</h3>
    {listes.length > 0 && <div style={{ display: "flex", gap: 8, margin: "8px 0", flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#666" }}>Âge des listes (R409) :</span>
      {listes.map((l) => <span key={l.source} style={ageStyle(l.ageJours)}>
        {l.source}@{l.version} — {l.nEntrees} entrées — {l.ageJours} j</span>)}
    </div>}
    <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
      <input style={inp} placeholder="clientId (périmètre)" value={clientId} onChange={(e) => setClientId(e.target.value)}/>
      <input style={inp} placeholder="Nom d'entrée de liste" value={nom} onChange={(e) => setNom(e.target.value)}/>
      <button style={btn} onClick={lancer}>Lancer le screening</button>
      <button style={{ ...btn, background: "#777" }} onClick={charger}>Rafraîchir les hits</button>
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}>
        <th style={{ padding: 6 }}>Client</th><th>Entrée</th><th>Liste</th><th>Score</th>
        <th>Décomposition (R411 — moteur)</th><th>Config du run</th><th>Statut</th><th/></tr></thead>
      <tbody>
        {hits.map((h) => <tr key={h.id} style={{ borderBottom: "1px solid #eee" }}>
          <td style={{ padding: 6 }}>{h.clientId.slice(0, 8)}</td><td>{h.entreeUid}</td>
          <td style={{ fontSize: 12, color: "#555" }}>{h.listeVersion ?? "—"}</td>
          <td align="center">{h.score}</td>
          <td style={{ fontSize: 12, color: "#555" }}>{decomp(h.detail)}</td>
          <td style={{ fontSize: 12, color: "#555" }}>{configRun(h.runId ? runs.get(h.runId) : undefined)}</td>
          <td>{h.statut}</td>
          <td>{h.statut !== "QUALIFIE" && <>
            <button style={{ ...btn, background: "#c33" }} onClick={() => ask({ title: "Qualifier — VRAI POSITIF (R101/R7)", danger: true,
              message: "Escalade PROPOSÉE (gel/clarif/MROS), jamais exécutée automatiquement (R39/R44).",
              input: { label: "Motif de qualification", placeholder: "obligatoire (R7)", required: true }, confirmLabel: "Vrai positif",
              onConfirm: (motif) => qualifier(h.id, "VRAI_POSITIF", motif ?? "") })}>Vrai positif</button>{" "}
            <button style={{ ...btn, background: "#3a7" }} onClick={() => ask({ title: "Qualifier — FAUX POSITIF (R101/R7)",
              input: { label: "Motif de qualification", placeholder: "obligatoire (R7)", required: true }, confirmLabel: "Faux positif",
              onConfirm: (motif) => qualifier(h.id, "FAUX_POSITIF", motif ?? "") })}>Faux positif</button>
          </>}</td>
        </tr>)}
        {hits.length === 0 && <tr><td colSpan={8} style={{ padding: 6, color: "#666" }}>Aucun hit chargé.</td></tr>}
      </tbody>
    </table>
  </div>;
}
