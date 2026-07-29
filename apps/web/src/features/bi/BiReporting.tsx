import React, { useState } from "react";
import { apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";
import { traduire, langue } from "../../lib/i18n";

/**
 * `bi` — R314-R315 (dégel V6, ratifié 2026-07-28). Le constructeur n'interroge QUE des
 * vues de PROJECTION déclarées (liste blanche servie — zéro SQL libre) ; le scope
 * s'applique au BACKEND (un RM n'agrège que ses clients). Un export massif est un acte
 * d'audit (notifié SO) — servi, jamais bloqué. Les refus R314 s'affichent tels quels.
 */

type Vue = { code: string; source: string; dimensions: string[]; mesures: string[]; sensibilite: string };

export function BiReporting() {
  const [vues, setVues] = useState<Vue[] | null>(null);
  const [vue, setVue] = useState("");
  const [dims, setDims] = useState<string[]>([]);
  const [resultat, setResultat] = useState<any | null>(null);
  const [msg, setMsg] = useState("");

  const charger = async () => {
    try { const r = await apiPost<Vue[]>("/v1/bi/annuaire", {}); setVues(r); if (r[0]) { setVue(r[0].code); setDims([r[0].dimensions[0]]); } }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  };
  const courante = vues?.find((v) => v.code === vue);
  const td = { fontSize: 12, borderTop: `1px solid ${tokens.color.border}`, padding: "3px 8px" };
  const t = traduire(langue());        // tour 3 du cliquet : contenu d'écran par t() — clés FR
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>{t("BI — Reporting sur mesure (projections déclarées seulement — zéro SQL libre)")}</h3>
    <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
      <button onClick={charger} disabled={isDemoMode()} style={{ fontSize: 12 }}>{t("Charger l'annuaire")}</button>
      {vues && <select value={vue} onChange={(e) => { setVue(e.target.value); setDims([vues.find((v) => v.code === e.target.value)!.dimensions[0]]); }} style={{ fontSize: 12 }}>
        {vues.map((v) => <option key={v.code}>{v.code}</option>)}</select>}
      {courante && courante.dimensions.map((d) => <label key={d} style={{ fontSize: 12 }}>
        <input type="checkbox" checked={dims.includes(d)}
          onChange={(e) => setDims(e.target.checked ? [...dims, d] : dims.filter((x) => x !== d))}/> {d}</label>)}
      <button style={{ fontSize: 12 }} disabled={isDemoMode() || !courante} onClick={async () => {
        setMsg("");
        try { setResultat(await apiPost("/v1/bi/requete", { vue, dimensions: dims, mesures: courante!.mesures })); }
        catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }         // le refus R314, TEL QUEL
      }}>{t("Interroger")}</button>
    </div>
    {msg && <p style={{ fontSize: 12, color: tokens.color.olive700 }}>{msg}</p>}
    {resultat && <div>
      <p style={{ fontSize: 12, color: tokens.color.muted }}>{resultat.source} {t("ligne(s) source (scopées BACKEND) · sensibilité")} {resultat.sensibilite}</p>
      <table style={{ borderCollapse: "collapse" }}><tbody>
        {resultat.lignes.map((l: any, i: number) => <tr key={i}>
          {dims.map((d) => <td key={d} style={td}><strong>{String(l[d])}</strong></td>)}
          {"n" in l && <td style={td}>{l.n}</td>}
          {"volume" in l && <td style={td}>{Number(l.volume).toLocaleString("fr-CH")}</td>}
        </tr>)}
      </tbody></table>
    </div>}
  </div>;
}
