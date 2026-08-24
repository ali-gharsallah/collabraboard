import React, { useState } from "react";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";
import { tokens } from "../../theme/tokens";
import { traduire, langue } from "../../lib/i18n";

/**
 * Écran « Capacité équipe » (R183→R185) — câblage des routes /v1/workload/* jusqu'ici sans
 * consommateur front. La charge par équipe est une TRANSPARENCE STRUCTURELLE : mesures
 * servies (jamais recalculées ici), signal de surcharge SANS déplacement automatique
 * (l'alerte propose, le responsable réassigne — R44), réassignation motivée (R7) et
 * tracée par le service. Un tiers non responsable est refusé PAR LE SERVICE (FE-04 :
 * son message s'affiche tel quel).
 */

type Membre = { userId: string; nom?: string; role?: string; [k: string]: unknown };
const c = tokens.color;
const carte: React.CSSProperties = { background: "#fff", border: `1px solid ${c.border}`,
  borderRadius: tokens.radius.lg, padding: 14, marginBottom: 12 };

/** Jauge de charge : la couleur est un STATUT (ok/warn/danger), jamais décorative. */
function Jauge({ valeur, max }: { valeur: number; max: number }) {
  const part = Math.min(1, max > 0 ? valeur / max : 0);
  const teinte = part >= 1 ? c.danger : part >= 0.8 ? c.warn : c.ok;
  return <div style={{ height: 6, borderRadius: 3, background: c.surface, minWidth: 120 }}>
    <div style={{ height: 6, borderRadius: 3, width: `${part * 100}%`, background: teinte }}/></div>;
}

export function CapaciteEquipe() {
  const t = traduire(langue());
  const [role, setRole] = useState("compliance");
  const [equipe, setEquipe] = useState<{ equipeRole: string; membres: Membre[] } | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const { ask, modal } = useConfirmGate();

  const agir = async (fn: () => unknown) => {
    setMsg("");
    try { await fn(); } catch (e) { setMsg((e as OliveError).message ?? t("Erreur")); }
  };
  const charger = () => agir(async () =>
    setEquipe((await apiGetSourced<any>(`/v1/workload/equipes/${role}`, null)).data));
  const voirPoints = (userId: string) => agir(async () =>
    setDetail({ userId, ...(await apiGetSourced<any>(`/v1/workload/points/${userId}`, null)).data }));
  const signaler = () => ask({
    title: t("Signaler les surcharges de l'équipe"),
    message: t("Le signal ALERTE le responsable — aucune tâche n'est déplacée automatiquement (R184)."),
    confirmLabel: t("Signaler"),
    onConfirm: () => agir(async () => { await apiPost(`/v1/workload/equipes/${role}/surcharges`, {}); charger(); }) });
  const snapshot = () => agir(async () => { await apiPost(`/v1/workload/equipes/${role}/snapshot-rh`, {}); charger(); });
  const reassigner = (taskId: string) => ask({
    title: t("Réassigner la tâche — motif obligatoire (R7)"),
    message: taskId,
    input: { label: t("versUserId · motif (séparés par |)"), placeholder: "uuid | motif", required: true },
    confirmLabel: t("Réassigner"),
    onConfirm: (saisie) => agir(async () => {
      const [versUserId, ...reste] = String(saisie ?? "").split("|");
      await apiPost(`/v1/workload/taches/${taskId.trim()}/reassigner`,
        { versUserId: versUserId.trim(), motif: reste.join("|").trim() });
      charger();
    }) });

  const inp: React.CSSProperties = { padding: 7, borderRadius: tokens.radius.md, border: `1px solid ${c.border}`, fontSize: 12 };
  const btn: React.CSSProperties = { ...inp, cursor: "pointer", background: c.olive700, color: "#fff", border: "none" };
  const num = (v: unknown) => typeof v === "number" ? v : Number(v ?? 0) || 0;

  return <div>
    {modal}
    {isDemoMode() && <DemoModeBanner/>}
    <h3 style={{ color: c.ink }}>{t("Capacité équipe (R183–R185) — l'alerte propose, le responsable décide")}</h3>
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
      <input style={inp} value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("rôle d'équipe")}/>
      <button style={btn} onClick={charger}>{t("Charger la charge")}</button>
      <button style={{ ...btn, background: c.warn, color: c.ink }} onClick={signaler}>{t("Signaler surcharges")}</button>
      <button style={{ ...btn, background: "#fff", color: c.ink, border: `1px solid ${c.border}` }}
        onClick={snapshot}>{t("Snapshot RH (barème versionné)")}</button>
    </div>
    {msg && <p style={{ fontSize: 12, color: c.danger }}>{msg}</p>}
    {equipe && <div style={carte}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ textAlign: "left", borderBottom: `2px solid ${c.olive700}` }}>
          <th style={{ padding: 6 }}>{t("Membre")}</th><th>{t("Rôle")}</th>
          <th>{t("Charge (points servis)")}</th><th/></tr></thead>
        <tbody>{equipe.membres?.map((m) => {
          const pts = num(m.points ?? m.charge ?? m.pointsOuverts);
          const cap = num(m.capacite ?? m.capaciteEffective) || Math.max(pts, 1);
          return <tr key={m.userId} style={{ borderBottom: `1px solid ${c.border}` }}>
            <td style={{ padding: 6, fontWeight: 600 }}>{m.nom ?? m.userId}</td>
            <td>{String(m.role ?? "—")}</td>
            <td style={{ padding: 6 }}><div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Jauge valeur={pts} max={cap}/>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{pts}{" / "}{cap}</span></div></td>
            <td><button style={{ ...btn, padding: "4px 10px", background: "#fff", color: c.ink,
              border: `1px solid ${c.border}` }} onClick={() => voirPoints(m.userId)}>{t("Détail")}</button></td>
          </tr>; })}</tbody>
      </table>
    </div>}
    {detail && <div style={carte}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: c.muted, margin: "0 0 8px" }}>
        {t("Points de charge —")}{" "}{detail.userId}</p>
      {(detail.taches ?? detail.points ?? []).length > 0
        ? (detail.taches ?? detail.points).map((p: any, i: number) =>
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0",
            borderTop: `1px solid ${c.surface}` }}>
            <span style={{ fontSize: 12, flex: 1 }}>{p.titre ?? p.type ?? p.id ?? JSON.stringify(p)}</span>
            {p.points !== undefined && <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{String(p.points)}</span>}
            {p.id && <button style={{ ...btn, padding: "4px 10px" }} onClick={() => reassigner(String(p.id))}>{t("Réassigner")}</button>}
          </div>)
        : <pre style={{ fontSize: 11, overflowX: "auto" }}>{JSON.stringify(detail, null, 2)}</pre>}
    </div>}
  </div>;
}
