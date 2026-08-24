import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";
import { traduire, langue } from "../../lib/i18n";

/**
 * Écran « Surveillance ES » — VUES PAR REJEU du sidecar event-sourcé (série ES,
 * docs/SURVEILLANCE-ES.md). LECTURE SEULE par construction : l'API n'expose aucune
 * écriture, le module reste dormant/shadow tant que la bascule humaine ES-4 n'est pas
 * actée, et L'ÉTAT DU MONOLITHE FAIT FOI — le bandeau le rappelle en permanence.
 * Discours autorisé (§7) : les timelines listées ici sont reconstruites par rejeu de
 * faits immuables ; jamais « O-Live est event-sourcé ».
 */

const c = tokens.color;
const carte: React.CSSProperties = { background: "#fff", border: `1px solid ${c.border}`,
  borderRadius: tokens.radius.lg, padding: 14, marginBottom: 12 };

function BandeauShadow({ actif }: { actif: boolean | undefined }) {
  const t = traduire(langue());
  return <div style={{ padding: "8px 12px", borderRadius: tokens.radius.md, marginBottom: 12,
    background: actif ? "#EAF3E4" : "#FdF6E3", border: `1px solid ${actif ? c.ok : c.gold}`,
    fontSize: 12, color: c.ink }}>
    {actif ? t("Souscripteur ACTIF — les vues par rejeu suivent l'outbox en continu.")
      : t("Module en SHADOW (dormant) — vues par rejeu, lecture seule ; l'état du monolithe fait foi. La bascule est une décision humaine (ES-4).")}
  </div>;
}

export function SurveillanceEs() {
  const t = traduire(langue());
  const [etat, setEtat] = useState<any>(null);
  const [onglet, setOnglet] = useState<"alertes" | "hits" | "pep">("alertes");
  const [lignes, setLignes] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any>(null);

  const charger = async (vue: typeof onglet = onglet) => {
    setOnglet(vue); setTimeline(null);
    const [e, l] = await Promise.all([
      apiGetSourced<any>("/v1/surveillance-es/etat", null),
      apiGetSourced<any[]>(`/v1/surveillance-es/${vue}`, [])]);
    setEtat(e.data); setLignes(l.data ?? []);
  };

  const btn: React.CSSProperties = { padding: 7, borderRadius: tokens.radius.md, fontSize: 12,
    cursor: "pointer", background: c.olive700, color: "#fff", border: "none" };
  const badge = (s: string): React.CSSProperties => ({
    fontSize: 11, borderRadius: 6, padding: "1px 8px", fontWeight: 600,
    background: ["QUALIFIE", "PEPISE", "DISPOSEE"].includes(s) ? "#EAF3E4"
      : ["REJETE", "LEVE"].includes(s) ? c.accentComplianceBg : c.surface,
    color: ["QUALIFIE", "PEPISE", "DISPOSEE"].includes(s) ? c.ok
      : ["REJETE", "LEVE"].includes(s) ? c.accentCompliance : c.muted });
  const ONGLETS: [typeof onglet, string][] = [["alertes", t("Alertes (ES-2)")],
    ["hits", t("Hits screening (ES-6)")], ["pep", t("Décisions PEP (ES-7)")]];

  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3 style={{ color: c.ink }}>{t("Surveillance ES — l'état est une fonction du rejeu (lecture seule)")}</h3>
    <BandeauShadow actif={etat?.actif}/>
    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
      {ONGLETS.map(([id, label]) => <button key={id} onClick={() => charger(id)}
        style={{ ...btn, background: onglet === id && lignes ? c.olive700 : "#fff",
          color: onglet === id && lignes ? "#fff" : c.ink,
          border: `1px solid ${c.border}` }}>{label}</button>)}
      {etat?.souscripteur && <span style={{ fontSize: 11, color: c.muted }}>
        {t("curseur")}{" "}{String(etat.souscripteur.lastSeq)}{" · "}
        {t("faits")}{" "}{String(etat.souscripteur.nbFaits)}{" · "}
        {t("quarantaine")}{" "}{String(etat.souscripteur.nbQuarantaine)}</span>}
    </div>
    <div style={carte}>
      {lignes.length === 0 && <p style={{ fontSize: 12, color: c.muted }}>
        {t("Aucun fait consommé pour cette vue (le souscripteur naît au présent, R286 — pas de backfill inventé).")}</p>}
      {lignes.map((l, i) => {
        const id = l.alerteId ?? l.hitId ?? l.personId ?? String(i);
        return <div key={id} style={{ display: "flex", gap: 10, alignItems: "center",
          padding: "8px 0", borderTop: `1px solid ${c.surface}` }}>
          <span style={badge(String(l.statut ?? ""))}>{String(l.statut ?? "—")}</span>
          <code style={{ fontSize: 11 }}>{id}</code>
          <span style={{ fontSize: 12, color: c.muted, flex: 1 }}>
            {[l.scenario, l.clientId, l.entreeUid, l.verdict, l.motifRejet, l.decideurLevee]
              .filter(Boolean).join(" · ")}</span>
          {l.timeline && <button style={{ ...btn, padding: "3px 10px", background: "#fff", color: c.ink,
            border: `1px solid ${c.border}` }} onClick={() => setTimeline(l)}>{t("Timeline")}</button>}
        </div>; })}
    </div>
    {timeline && <div style={carte}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: c.muted, margin: "0 0 8px" }}>
        {t("Timeline rejouée —")}{" "}{timeline.hitId ?? timeline.personId ?? timeline.alerteId}</p>
      {(timeline.timeline ?? []).map((f: any, i: number) => <div key={i}
        style={{ display: "flex", gap: 10, padding: "4px 0", fontSize: 12,
          borderInlineStart: `3px solid ${c.olive600}`, paddingInlineStart: 10, marginInlineStart: 4 }}>
        <span style={{ fontVariantNumeric: "tabular-nums", color: c.muted }}>
          {f.at ? new Date(f.at).toLocaleString() : ""}</span>
        <code style={{ fontSize: 11 }}>{f.type}</code>
      </div>)}
    </div>}
  </div>;
}
