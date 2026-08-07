import React, { useState } from "react";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";
import { tokens } from "../../theme/tokens";
import { traduire, langue } from "../../lib/i18n";

/**
 * Écran « Pré-revue IA » (R121–R124) — câblage des routes /v1/ia/prerevue/* jusqu'ici sans
 * consommateur front. L'IA RELÈVE des points sur un dossier KYC (R121, snapshot scellé
 * sha256, prompt versionné R124) ; CHAQUE point se TRAITE ou s'ÉCARTE par un humain, motif
 * à l'appui (R123) — l'écran n'exécute rien, il fait décider. Le verdict « traitement
 * requis » (bloquant de validation) est servi par l'API, jamais recalculé ici.
 */

type Point = { index?: number; type?: string; message?: string; statut?: string; motif?: string; cible?: string };
const c = tokens.color;
const carte: React.CSSProperties = { background: "#fff", border: `1px solid ${c.border}`,
  borderRadius: tokens.radius.lg, padding: 14, marginBottom: 12 };

export function PreRevue() {
  const t = traduire(langue());
  const [kycId, setKycId] = useState("");
  const [prerevueId, setPrerevueId] = useState("");
  const [points, setPoints] = useState<Point[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [verdict, setVerdict] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const { ask, modal } = useConfirmGate();

  const agir = async (fn: () => unknown) => {
    setMsg("");
    try { await fn(); } catch (e) { setMsg((e as OliveError).message ?? t("Erreur")); }
  };
  const demander = () => agir(async () => {
    const r = await apiPost<{ prerevueId: string; points: Point[] }>(`/v1/ia/prerevue/kyc/${kycId}`, {});
    setPrerevueId(r.prerevueId); setPoints(r.points.map((p, i) => ({ index: i, ...p }))); setMeta(null);
  });
  const relire = () => agir(async () => {
    const r = (await apiGetSourced<any>(`/v1/ia/prerevue/${prerevueId}`, null)).data;
    if (r) { setMeta(r); setPoints((r.points ?? []).map((p: Point, i: number) => ({ index: i, ...p }))); }
  });
  const verifier = () => agir(async () => {
    setVerdict((await apiGetSourced<any>(`/v1/ia/prerevue/kyc/${kycId}/traitement`, null)).data);
  });
  const traiter = (idx: number, statut: "TRAITE" | "ECARTE") => ask({
    title: statut === "TRAITE" ? t("Traiter le point (décision humaine, R123)") : t("Écarter le point — motif obligatoire (R123)"),
    message: points.find((p) => p.index === idx)?.message ?? "",
    input: statut === "ECARTE" ? { label: t("Motif"), placeholder: t("obligatoire"), required: true } : undefined,
    confirmLabel: statut === "TRAITE" ? t("Traiter") : t("Écarter"),
    onConfirm: (motif) => agir(async () => {
      await apiPost(`/v1/ia/prerevue/${prerevueId}/points/${idx}`, { statut, ...(motif ? { motif } : {}) });
      relire();
    }) });

  const inp: React.CSSProperties = { padding: 7, borderRadius: tokens.radius.md, border: `1px solid ${c.border}`, fontSize: 12 };
  const btn: React.CSSProperties = { ...inp, cursor: "pointer", background: c.olive700, color: "#fff", border: "none" };
  const badge = (s?: string): React.CSSProperties => ({
    fontSize: 11, borderRadius: 6, padding: "1px 8px", fontWeight: 600,
    background: s === "TRAITE" ? "#EAF3E4" : s === "ECARTE" ? c.accentComplianceBg : c.surface,
    color: s === "TRAITE" ? c.ok : s === "ECARTE" ? c.accentCompliance : c.muted });

  return <div>
    {modal}
    {isDemoMode() && <DemoModeBanner/>}
    <h3 style={{ color: c.ink }}>{t("Pré-revue IA du dossier (R121–R124) — l'IA relève, l'humain décide")}</h3>
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
      <input style={inp} placeholder={t("kycFileId")} value={kycId} onChange={(e) => setKycId(e.target.value)}/>
      <button style={btn} disabled={!kycId} onClick={demander}>{t("Lancer la pré-revue")}</button>
      <button style={{ ...btn, background: "#fff", color: c.ink, border: `1px solid ${c.border}` }}
        disabled={!kycId} onClick={verifier}>{t("Traitement requis ?")}</button>
      {verdict && <span style={badge(verdict.bloquant ? "ECARTE" : "TRAITE")}>
        {verdict.bloquant ? `${t("BLOQUANT — points ouverts :")} ${verdict.ouverts?.length ?? 0}` : t("non bloquant")}</span>}
    </div>
    {msg && <p style={{ fontSize: 12, color: c.danger }}>{msg}</p>}
    {meta && <p style={{ fontSize: 11, color: c.muted }}>
      {t("Snapshot scellé")}{" "}<span style={{ fontFamily: "monospace" }}>{String(meta.snapshotSha256 ?? "").slice(0, 16)}…</span>
      {" · "}{t("prompt")}{" v"}{String(meta.promptVersion ?? "?")}{" · "}{String(meta.modele ?? "")}</p>}
    {points.length > 0 && <div style={carte}>
      {points.map((p) => <div key={p.index} style={{ display: "flex", gap: 10, alignItems: "center",
        padding: "8px 0", borderTop: `1px solid ${c.surface}` }}>
        <span style={badge(p.statut)}>{p.statut ?? t("OUVERT")}</span>
        <span style={{ fontSize: 12, flex: 1 }}>{p.message ?? p.cible ?? ""}</span>
        {p.motif && <span style={{ fontSize: 11, color: c.muted }}>{p.motif}</span>}
        {!p.statut && <span style={{ display: "flex", gap: 6 }}>
          <button style={{ ...btn, padding: "4px 10px" }} onClick={() => traiter(p.index!, "TRAITE")}>{t("Traiter")}</button>
          <button style={{ ...btn, padding: "4px 10px", background: c.accentCompliance }}
            onClick={() => traiter(p.index!, "ECARTE")}>{t("Écarter")}</button></span>}
      </div>)}
    </div>}
    {prerevueId && <button style={{ ...btn, background: "#fff", color: c.ink, border: `1px solid ${c.border}` }}
      onClick={relire}>{t("Relire (R122 — snapshot opposable)")}</button>}
  </div>;
}
