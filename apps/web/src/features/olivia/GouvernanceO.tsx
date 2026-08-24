import React, { useState } from "react";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";
import { tokens } from "../../theme/tokens";
import { traduire, langue } from "../../lib/i18n";

/**
 * Écran « Gouvernance O » (P-L8-3, packaging O1/O2/O3) — câblage des routes
 * /v1/olivia/gouvernance/*. Le CURSEUR d'autonomie par capacité (observe → suggere →
 * copilote_gouverne) est un ACTE DE GOUVERNANCE : chaque changement passe la porte de
 * confirmation et émet l'événement catalogué `olivia.curseur.change` (serveur). Le
 * rapport de valeur mensuel affiche les chiffres AVEC leurs définitions servies —
 * l'IA propose, l'humain décide (R44) : rien ici n'exécute quoi que ce soit.
 */

type Curseur = { niveaux: string[]; capacites: Record<string, string> };
const c = tokens.color;
const carte: React.CSSProperties = { background: "#fff", border: `1px solid ${c.border}`,
  borderRadius: tokens.radius.lg, padding: 14, marginBottom: 12 };

export function GouvernanceO() {
  const t = traduire(langue());
  const [curseur, setCurseur] = useState<Curseur | null>(null);
  const [rapport, setRapport] = useState<any>(null);
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [mois, setMois] = useState(String(new Date().getMonth() + 1));
  const [msg, setMsg] = useState("");
  const { ask, modal } = useConfirmGate();

  const chargerCurseur = async () =>
    setCurseur((await apiGetSourced<Curseur | null>("/v1/olivia/gouvernance/curseur", null)).data);
  const changer = (capacite: string, niveau: string) => ask({
    title: t("Changer le curseur d'autonomie"),
    message: `${capacite} → ${niveau}`,
    confirmLabel: t("Changer (événement catalogué)"),
    onConfirm: async () => {
      setMsg("");
      try { await apiPost("/v1/olivia/gouvernance/curseur", { capacite, niveau }); await chargerCurseur(); }
      catch (e) { setMsg((e as OliveError).message ?? t("Erreur")); }
    } });
  const chargerRapport = async () => {
    setMsg("");
    const r = await apiGetSourced<any>(`/v1/olivia/gouvernance/rapport-valeur?annee=${annee}&mois=${mois}`, null);
    setRapport(r.data); if (!r.data) setMsg(t("API connectée requise (mois 1..12)."));
  };

  const inp: React.CSSProperties = { padding: 7, borderRadius: tokens.radius.md, border: `1px solid ${c.border}`, fontSize: 12 };
  const btn: React.CSSProperties = { ...inp, cursor: "pointer", background: c.olive700, color: "#fff", border: "none" };
  const pastille = (niveau: string, actif: boolean) => ({
    ...inp, cursor: "pointer", fontWeight: actif ? 700 : 500,
    background: actif ? c.accentDataBg : "#fff",
    color: actif ? c.accentData : c.ink,
    border: `1px solid ${actif ? c.accentData : c.border}` } as React.CSSProperties);

  return <div>
    {modal}
    {isDemoMode() && <DemoModeBanner/>}
    <h3 style={{ color: c.ink }}>{t("Gouvernance O — curseur d'autonomie et rapport de valeur (R44)")}</h3>
    <p style={{ fontSize: 12, color: c.muted }}>
      {t("Le curseur borne ce qu'Olivia peut faire par capacité ; chaque action reste tracée actor: olivia@version, chaque changement émet un événement catalogué.")}</p>

    <div style={carte}>
      <button style={btn} onClick={chargerCurseur}>{t("Charger le curseur")}</button>
      {curseur && <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 10 }}>
        <thead><tr style={{ textAlign: "left", borderBottom: `2px solid ${c.olive700}` }}>
          <th style={{ padding: 6 }}>{t("Capacité")}</th><th style={{ padding: 6 }}>{t("Niveau")}</th></tr></thead>
        <tbody>{Object.entries(curseur.capacites).map(([cap, niveau]) => <tr key={cap}
          style={{ borderBottom: `1px solid ${c.border}` }}>
          <td style={{ padding: 6, fontWeight: 600 }}>{cap}</td>
          <td style={{ padding: 6, display: "flex", gap: 6 }}>
            {curseur.niveaux.map((n) => <button key={n} style={pastille(n, n === niveau)}
              onClick={() => n !== niveau && changer(cap, n)}>{n}</button>)}</td>
        </tr>)}</tbody>
      </table>}
    </div>

    <div style={carte}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input style={{ ...inp, width: 70 }} value={annee} onChange={(e) => setAnnee(e.target.value)}/>
        <select style={inp} value={mois} onChange={(e) => setMois(e.target.value)}>
          {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => <option key={m} value={m}>{m}</option>)}</select>
        <button style={btn} onClick={chargerRapport}>{t("Rapport de valeur mensuel")}</button>
      </div>
      {msg && <p style={{ fontSize: 12, color: c.danger }}>{msg}</p>}
      {rapport && <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          {[[t("Suggestions émises"), rapport.suggestions?.emises, rapport.definitions?.suggestions],
            [t("Dérives détectées"), rapport.derivesDetectees, rapport.definitions?.derives],
            [t("Changements de curseur"), rapport.changementsCurseur, ""],
            [t("Relances & repriorisations"), rapport.relancesEtRepriorisations, rapport.definitions?.relances]]
            .map(([titre, val, def]) => <div key={String(titre)} style={{ ...carte, flex: 1, minWidth: 150, marginBottom: 0 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: c.muted }}>{titre}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: c.accentData, fontVariantNumeric: "tabular-nums" }}>{String(val ?? 0)}</div>
              {def ? <div style={{ fontSize: 11, color: c.muted }}>{String(def)}</div> : null}
            </div>)}
        </div>
        <div style={{ fontSize: 12 }}>
          <b>{t("Par statut")}</b>{" : "}{JSON.stringify(rapport.suggestions?.parStatut ?? {})}{" · "}
          <b>{t("Portes humaines")}</b>{" : "}{JSON.stringify(rapport.portesHumaines ?? {})}
        </div>
      </div>}
    </div>
  </div>;
}
