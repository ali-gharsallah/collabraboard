import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner, DEMO_MESSAGE } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";  // contrat UX

// Écran « Screening avancé » (Vague 4). Adverse media & listes complémentaires. Techniquement,
// une « liste complémentaire » est un PARAMÈTRE d'entrée du même moteur ratifié (R100→R103) —
// PAS un moteur séparé. On lance un run sur la liste choisie (POST /v1/screening/run), la trace
// s'écrit toujours (R103), et les hits se qualifient (POST /v1/screening/hits/:id/qualify, R101).

type Hit = { id: string; clientId: string; entreeUid: string; score: number; statut: string };
type Cfg = { version: number; effectiveFrom: string; params: { moteur?: Record<string, number>; prefiltre?: Record<string, number>; motif?: string } };
const LISTES = ["ADVERSE_MEDIA", "PEP", "INTERPOL", "UN_SANCTIONS", "EU_SANCTIONS", "SECO"];
const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` });

export function ScreeningAvance() {
  const [clientId, setClientId] = useState("");
  const [liste, setListe] = useState("ADVERSE_MEDIA");
  const [nom, setNom] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [msg, setMsg] = useState("");
  const [cfg, setCfg] = useState<{ enVigueur: Cfg | null; versions: Cfg[] }>({ enVigueur: null, versions: [] });
  const [ech, setEch] = useState("100");                 // R268 knobs proposés à la publication
  const [pen, setPen] = useState("40");
  const [phon, setPhon] = useState(false);               // R271 méthode phonétique (off par défaut)
  const { ask, modal } = useConfirmGate();               // contrat UX : qualifier un hit = acte motivé (R7)

  async function lancer() {
    setMsg("");
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/screening/run`, { method: "POST", headers: auth(), body: JSON.stringify({
      liste, version: `${liste}-${new Date().toISOString().slice(0, 10)}`, seuil: 100, prefiltre: {},
      entries: nom ? [{ uid: "AM1", nom_complet: nom, alias: [] }] : [], clientIds: clientId ? [clientId] : undefined }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Run « ${liste} » tracé (R103) — ${b.hits?.length ?? 0} hit(s).` : (b.message ?? "Erreur"));
    charger();
  }
  async function charger() { setHits((await apiGetSourced<Hit[]>("/v1/screening/hits", [])).data); }
  // R270 — gouvernance du réglage : lire les versions (chargées à la demande, jamais au montage — MSW).
  async function chargerConfig() {
    const r = await apiGetSourced<{ enVigueur: Cfg | null; versions: Cfg[] }>("/v1/screening/config", { enVigueur: null, versions: [] });
    setCfg(r.data);
  }
  async function publierConfig(motif: string) {
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const moteur: Record<string, number | boolean> = {};
    if (ech.trim()) moteur.echelle = Number(ech);
    if (pen.trim()) moteur.penaliteTypeIncompatible = Number(pen);
    moteur.phonetique = phon;                             // R271 — méthode phonétique gouvernée
    const r = await fetch(`${base}/v1/screening/config`, { method: "POST", headers: auth(), body: JSON.stringify({ moteur, motif }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Config publiée — v${b.version} (effet ${String(b.effectiveFrom).slice(0, 10)}). Les runs futurs l'appliquent ; les runs passés gardent la leur (R48/R49).` : (b.message ?? "Erreur (motif requis ? R7)"));
    if (r.ok) chargerConfig();
  }
  async function qualifier(id: string, verdict: string, motif: string) {
    const base = apiBase();
    if (!base) { setMsg(DEMO_MESSAGE); return; }
    const r = await fetch(`${base}/v1/screening/hits/${id}/qualify`, { method: "POST", headers: auth(),
      body: JSON.stringify({ verdict, motif }) });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Hit qualifié ${verdict}.` : (b.message ?? "Erreur (motif requis ? R7)"));
    if (r.ok) charger();
  }

  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };
  return <div>
    {modal}
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Screening avancé — adverse media & listes complémentaires (R100→R103)</h3>
    <p style={{ fontSize: 12, color: "#777" }}>La liste complémentaire est un paramètre d'entrée du moteur ratifié, pas un moteur séparé.</p>

    {/* R268/R269/R270 — réglage GOUVERNÉ du moteur : versionné (R29), motivé (R7), jamais rétroactif. */}
    <section style={{ border: "1px solid #e5e0d5", borderRadius: 10, padding: 12, margin: "12px 0", background: "#faf8f3" }}>
      <h4 style={{ margin: "0 0 4px" }}>Réglage gouverné du moteur (R268/R269/R270)</h4>
      <p style={{ fontSize: 12, color: "#777", margin: "0 0 8px" }}>
        Les seuils du moteur sont <b>versionnés et datés</b> (R29) : publier une version est un acte motivé (R7), jamais rétroactif.
        Un run applique la version <b>en vigueur à sa date</b> ; le rejeu (R48/R49) rescore avec la config d'origine.
      </p>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        En vigueur : {cfg.enVigueur
          ? <b>v{cfg.enVigueur.version} — moteur {JSON.stringify(cfg.enVigueur.params?.moteur ?? {})}</b>
          : <span style={{ color: "#777" }}>défauts du moteur (aucune version publiée)</span>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 12 }}>échelle <input style={{ ...inp, width: 70 }} value={ech} onChange={(e) => setEch(e.target.value)}/></label>
        <label style={{ fontSize: 12 }}>pénalité type <input style={{ ...inp, width: 70 }} value={pen} onChange={(e) => setPen(e.target.value)}/></label>
        <label style={{ fontSize: 12 }} title="Rattrape les sonorités que Jaro-Winkler rate (Knight/Nite). Off par défaut.">
          <input type="checkbox" checked={phon} onChange={(e) => setPhon(e.target.checked)}/> phonétique (R271)</label>
        <button style={btn} onClick={() => ask({ title: "Publier une nouvelle version de la config (R7)",
          message: "Versionnée et datée (R29), jamais rétroactive : les runs futurs l'appliqueront, les runs passés gardent la leur (rejeu R48/R49).",
          input: { label: "Motif de la publication (R7)", placeholder: "obligatoire", required: true },
          confirmLabel: "Publier la version", onConfirm: (motif) => publierConfig(motif ?? "") })}>Publier une version</button>
        <button style={{ ...btn, background: "#777" }} onClick={chargerConfig}>Charger les versions</button>
      </div>
      {cfg.versions.length > 0 && <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 8 }}>
        <thead><tr style={{ textAlign: "left", color: "#777" }}><th style={{ padding: 4 }}>Version</th><th>Effet</th><th>Moteur</th><th>Motif</th></tr></thead>
        <tbody>{cfg.versions.map((v) => <tr key={v.version} style={{ borderTop: "1px solid #eee" }}>
          <td style={{ padding: 4 }}>v{v.version}</td><td>{String(v.effectiveFrom).slice(0, 10)}</td>
          <td>{JSON.stringify(v.params?.moteur ?? {})}</td><td style={{ color: "#777" }}>{v.params?.motif ?? ""}</td>
        </tr>)}</tbody>
      </table>}
    </section>
    <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
      <input style={inp} placeholder="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}/>
      <select style={inp} value={liste} onChange={(e) => setListe(e.target.value)}>{LISTES.map((l) => <option key={l}>{l}</option>)}</select>
      <input style={inp} placeholder="Nom d'entrée" value={nom} onChange={(e) => setNom(e.target.value)}/>
      <button style={btn} onClick={lancer}>Lancer</button>
      <button style={{ ...btn, background: "#777" }} onClick={charger}>Rafraîchir</button>
    </div>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#f3f0e8", fontSize: 13 }}>{msg}</div>}
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}>
        <th style={{ padding: 6 }}>Client</th><th>Entrée</th><th>Score</th><th>Statut</th><th/></tr></thead>
      <tbody>
        {hits.map((h) => <tr key={h.id} style={{ borderBottom: "1px solid #eee" }}>
          <td style={{ padding: 6 }}>{h.clientId.slice(0, 8)}</td><td>{h.entreeUid}</td>
          <td align="center">{h.score}</td><td>{h.statut}</td>
          <td>{h.statut !== "QUALIFIE" && <>
            <button style={{ ...btn, background: "#c33" }} onClick={() => ask({ title: `Qualifier le hit ${h.entreeUid} — Vrai positif (R101)`,
                message: "La qualification est motivée (R7), tracée et engage la suite de l'instruction.", danger: true,
                input: { label: "Motif de qualification (R7)", placeholder: "obligatoire", required: true },
                confirmLabel: "Qualifier en vrai positif", onConfirm: (motif) => qualifier(h.id, "VRAI_POSITIF", motif ?? "") })}>VP</button>{" "}
            <button style={{ ...btn, background: "#3a7" }} onClick={() => ask({ title: `Qualifier le hit ${h.entreeUid} — Faux positif (R101)`,
                message: "La qualification est motivée (R7) et tracée.",
                input: { label: "Motif de qualification (R7)", placeholder: "obligatoire", required: true },
                confirmLabel: "Qualifier en faux positif", onConfirm: (motif) => qualifier(h.id, "FAUX_POSITIF", motif ?? "") })}>FP</button></>}</td>
        </tr>)}
        {hits.length === 0 && <tr><td colSpan={5} style={{ padding: 6, color: "#666" }}>Aucun hit.</td></tr>}
      </tbody>
    </table>
  </div>;
}
