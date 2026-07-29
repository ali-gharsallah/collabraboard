import React, { useState } from "react";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";
import { traduire, langue } from "../../lib/i18n";

/**
 * `veille` — R309-R311 (dégel V4, ratifié 2026-07-28). Les sources sont des PORTS (l'éteint
 * est AFFICHÉ) ; la qualification est HUMAINE et motivée ; la proposition Olivia est
 * VISIBLE (citations Rn) mais ne décide jamais ; un PERTINENT ouvre la tâche d'analyse —
 * la voie normale (amendement/R68/bac) fait le reste, jamais cet écran.
 */

type Src = { code: string; etat: string; items: number };
type Item = { empreinte: string; source: string; titre: string; date: string; statut: string;
  motif?: string | null; regles?: string[]; proposition?: { statut: string; regles: string[]; justification: string };
  surProposition?: string | null };

export function Regwatch() {
  const [sources, setSources] = useState<Src[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [msg, setMsg] = useState("");

  const charger = async () => {
    const r = await apiGetSourced<Item[] | null>("/v1/regwatch/items", null);
    setItems(r.isDemo ? null : r.data);
  };
  const qualifier = async (empreinte: string, statut: string) => {
    setMsg("");
    const motif = statut === "NON_PERTINENT" ? window.prompt("Motif (R7) :") ?? "" : undefined;
    const regles = statut === "PERTINENT" ? (window.prompt("Règles Rn impactées (virgule) :") ?? "").split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    try { await apiPost(`/v1/regwatch/items/${empreinte}/qualifier`, { statut, motif, regles }); await charger(); }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }             // le refus, TEL QUEL
  };
  const td = { fontSize: 12, borderTop: `1px solid ${tokens.color.border}`, padding: "3px 8px" };
  const couleur = (s: string) => s === "PERTINENT" ? tokens.color.olive700 : s === "NON_PERTINENT" ? tokens.color.muted : tokens.color.warn;
  const t = traduire(langue());        // cliquet i18n : UI par t(), les DONNÉES (titres, règles) verbatim
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>{t("Veille réglementaire — portée par sources, qualifiée par l'humain, rattachée au catalogue")}</h3>
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
      <button style={{ fontSize: 12 }} disabled={isDemoMode()} onClick={async () => {
        setMsg("");
        try { const r = await apiPost<{ sources: Src[] }>("/v1/regwatch/collecter", {}); setSources(r.sources); await charger(); }
        catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
      }}>{t("Collecter")}</button>
      <button onClick={charger} disabled={isDemoMode()} style={{ fontSize: 12 }}>{t("Charger")}</button>
    </div>
    {msg && <p style={{ fontSize: 12, color: tokens.color.olive700 }}>{msg}</p>}
    {sources && <p style={{ fontSize: 12 }}>{sources.map((s) =>
      <span key={s.code} style={{ marginRight: 12 }}><strong>{s.code}</strong> : {s.etat === "ETEINT"
        ? <span style={{ color: tokens.color.muted }}>{t("port éteint (credentials absents — rien n'est cassé)")}</span>
        : `${s.items} ${t("nouveau(x)")}`}</span>)}</p>}
    {items && <table style={{ borderCollapse: "collapse" }}><tbody>
      {items.map((i) => <tr key={i.empreinte}>
        <td style={td}>{i.date}</td>
        <td style={td}><strong>{i.titre}</strong>
          {i.proposition && <div style={{ fontSize: 11, color: tokens.color.accentData }}>
            {t("Olivia propose")} : {i.proposition.statut} ({i.proposition.regles.join(", ")}) — {i.proposition.justification} · {t("l'humain décide")}</div>}
          {i.regles && i.regles.length > 0 && <div style={{ fontSize: 11, color: tokens.color.muted }}>
            {t("règles")} : {i.regles.join(", ")}{i.surProposition ? ` · ${t("adoptée sur proposition IA (filiation tracée)")}` : ""}</div>}
        </td>
        <td style={{ ...td, color: couleur(i.statut) }}>{i.statut}</td>
        <td style={td}>{i.statut === "NON_TRAITE" && !isDemoMode() && <>
          <button style={{ fontSize: 11 }} onClick={() => qualifier(i.empreinte, "PERTINENT")}>{t("Pertinent")}</button>
          <button style={{ fontSize: 11, marginLeft: 4 }} onClick={() => qualifier(i.empreinte, "NON_PERTINENT")}>{t("Écarter")}</button></>}</td>
      </tr>)}
    </tbody></table>}
  </div>;
}
