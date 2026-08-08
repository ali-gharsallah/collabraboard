import React, { useState } from "react";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";
import { traduire, langue } from "../../lib/i18n";
import { Builder } from "../builder/Builder";

/**
 * Bloc WD (R432–R438) — écran UNIQUE « Workflow Designer », même position que la démo
 * fusionnée (groupe Workflow). Onglet Designer = le Builder EXISTANT (canvas contraint
 * R304-R308/R437 : composants du catalogue seulement — réutilisé, pas dupliqué) ; onglet
 * Import IA = pipeline WIR servi par /v1/workflow-designer/* : DRAFT_AI visuellement
 * distinct et NON publiable, zones illisibles AVEC coordonnées, nœuds sous seuil marqués
 * À VÉRIFIER (R438) — l'écran n'affiche que le servi, ne décide rien.
 */

type Wir = { label: string; nodes: any[]; edges: any[]; meta: any };
type Etat = { wirId: string; wir: Wir; statut: string; anomalies: any[];
  zonesIllisibles: any[]; historique: any[] };
const c = tokens.color;
const carte: React.CSSProperties = { background: "#fff", border: `1px solid ${c.border}`,
  borderRadius: tokens.radius.lg, padding: 14, marginBottom: 12 };
const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function patchIr(wirId: string, patch: Record<string, unknown>) {
  const base = (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;
  if (!base) return;
  const r = await fetch(`${base}/v1/workflow-designer/${wirId}/ir`, { method: "PATCH",
    headers: { "Content-Type": "application/json",
      Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` },
    body: JSON.stringify({ patch }) });
  if (!r.ok) throw await r.json();
}

export function DesignerWd() {
  const t = traduire(langue());
  const [onglet, setOnglet] = useState<"designer" | "import">("designer");
  const [etat, setEtat] = useState<Etat | null>(null);
  const [msg, setMsg] = useState("");

  const agir = async (fn: () => Promise<unknown>) => {
    setMsg("");
    try { await fn(); } catch (e) { setMsg((e as OliveError).message ?? t("Erreur")); }
  };
  const recharger = async (id: string) =>
    setEtat((await apiGetSourced<Etat | null>(`/v1/workflow-designer/${id}`, null)).data);
  const importer = () => agir(async () => {
    const r = await apiPost<{ wirId: string }>("/v1/workflow-designer/import",
      { imageBase64: PNG_1PX, mediaType: "image/png", nomFichier: "import-simule.png" });
    await recharger(r.wirId);
  });
  const editer = (noeud: string, label: string) => agir(async () => {
    await patchIr(etat!.wirId, { noeud, label });
    await recharger(etat!.wirId);
  });
  const ratifier = () => agir(async () => {
    await apiPost(`/v1/workflow-designer/${etat!.wirId}/ratify`, {});
    await recharger(etat!.wirId);
    setMsg(t("Ratifié — publication via Gouvernance → Workflows (circuit existant, R436)."));
  });

  const badge = (s: string) => <span style={{ padding: "2px 10px", borderRadius: 11, fontSize: 11,
    fontWeight: 800, color: "#fff",
    background: s === "DRAFT_AI" ? c.warn : s === "DRAFT_HUMAN" ? c.accentData : c.ok }}>
    {s === "DRAFT_AI" ? t("DRAFT_AI — jamais activable (R433)") : s}</span>;
  const btn: React.CSSProperties = { padding: 7, borderRadius: tokens.radius.md, fontSize: 12,
    cursor: "pointer", background: c.olive700, color: "#fff", border: "none" };

  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
      {([["designer", t("Designer (canvas)")], ["import", t("Import IA")]] as const).map(([id, label]) =>
        <button key={id} onClick={() => setOnglet(id)} style={{ ...btn,
          background: onglet === id ? c.olive700 : "#fff", color: onglet === id ? "#fff" : c.ink,
          border: `1px solid ${c.border}` }}>{label}</button>)}
    </div>
    {onglet === "designer" && <Builder/>}
    {onglet === "import" && <div>
      <p style={{ fontSize: 12, color: c.muted }}>
        {t("Toute source devient un WorkflowIR : DRAFT_AI (jamais activable), validation R434 à l'ingestion, visa 4-yeux (R435), publication via le circuit Gouvernance seulement (R436).")}</p>
      {!etat && <button style={btn} onClick={importer}>{t("Importer une image (simulée)")}</button>}
      {msg && <p style={{ fontSize: 12, color: c.danger }}>{msg}</p>}
      {etat && <div style={carte}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          {badge(etat.statut)}
          {etat.wir.meta.ratifiePar && <span style={{ fontSize: 11, color: c.ok, fontWeight: 700 }}>
            {t("ratifié par")}{" "}{etat.wir.meta.ratifiePar}</span>}
          <span style={{ fontSize: 11, color: c.muted, fontFamily: "monospace" }}>
            {String(etat.wir.meta.hashFichier ?? "").slice(0, 20)}</span>
        </div>
        {etat.wir.nodes.map((n: any) => <div key={n.id} style={{ display: "flex", gap: 8,
          alignItems: "center", padding: "5px 0", borderTop: `1px solid ${c.surface}` }}>
          <code style={{ fontSize: 11 }}>{n.id}</code>
          <input defaultValue={n.label} aria-label={`noeud-${n.id}`}
            onBlur={(e) => e.target.value !== n.label && editer(n.id, e.target.value)}
            style={{ flex: 1, padding: 5, borderRadius: 7, border: `1px solid ${c.border}`, fontSize: 12 }}/>
          <span style={{ fontSize: 11, fontWeight: 700, minWidth: 54 }}>{n.ownerRole ?? "—"}</span>
          {n.aVerifier && <span style={{ fontSize: 10, color: c.warn, fontWeight: 800 }}>{t("À VÉRIFIER (R438)")}</span>}
        </div>)}
        {etat.zonesIllisibles.length > 0 && <div style={{ marginTop: 8, fontSize: 11, color: c.accentCompliance }}>
          <b>{t("Zones illisibles :")}</b>{" "}
          {etat.zonesIllisibles.map((z: any, i: number) =>
            <span key={i}>{`(x:${z.x}, y:${z.y}, ${z.largeur}×${z.hauteur}) — ${z.raison} `}</span>)}
        </div>}
        {etat.anomalies.length > 0 && <div style={{ marginTop: 8, fontSize: 11, color: c.danger }}>
          <b>{t("Anomalies R434 (listées, jamais corrigées) :")}</b>
          {etat.anomalies.map((a: any, i: number) => <div key={i}>{a.code}{" — "}{a.detail}</div>)}
        </div>}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {etat.statut !== "DRAFT_AI" && !etat.wir.meta.ratifiePar &&
            <button style={btn} onClick={ratifier}>{t("Ratifier — visa R15 (importeur ≠ ratifieur)")}</button>}
          <button style={{ ...btn, background: "#fff", color: c.ink, border: `1px solid ${c.border}` }}
            onClick={() => { setEtat(null); setMsg(""); }}>{t("Nouvel import")}</button>
        </div>
      </div>}
    </div>}
  </div>;
}
