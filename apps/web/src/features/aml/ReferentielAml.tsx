import React, { useEffect, useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";

// Écran « Référentiel AML — scénarios & seuils » (Vague 8). Projection LISIBLE du canon ratifié :
// les 18 scénarios de surveillance R189→R206 (GET /v1/aml/referentiel) avec leurs seuils EFFECTIFS,
// pilotés par le registre R-Q (clés `aml*`). Changer un seuil = passer par l'écran Paramétrage
// (acte motivé, R126) — jamais en dur. Lecture pure : le référentiel relit les seuils à chaud.

type Scenario = { regle: string; type: string; niveau: 1 | 2; libelle: string; seuils: string[] };
type Ref = { scenarios: Scenario[]; seuils: Record<string, unknown> };

export function ReferentielAml() {
  const [ref, setRef] = useState<Ref | null>(null);

  async function charger() { setRef((await apiGetSourced<Ref | null>("/v1/aml/referentiel", null)).data); }
  useEffect(() => { charger(); }, []);

  const seuilVal = (k: string) => ref?.seuils ? JSON.stringify(ref.seuils[k]) : "—";
  const nivColor = (n: number) => n === 1 ? "#c33" : "#c93";
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Référentiel AML — 18 scénarios de surveillance (R189→R206) & seuils effectifs</h3>
    <p style={{ fontSize: 12, color: "#777" }}>Projection du canon ratifié. Les seuils sont pilotés par le registre R-Q
      (onglet Paramétrage) : un changement est un acte gouverné et motivé (R126), jamais codé en dur.</p>
    <button style={{ padding: 8, borderRadius: 8, border: "none", background: "#4A6B28", color: "#fff", cursor: "pointer", fontSize: 13 }} onClick={charger}>Rafraîchir</button>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 12 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #4A6B28" }}>
        <th style={{ padding: 6 }}>Règle</th><th>Type</th><th>Niv.</th><th>Scénario</th><th>Seuils effectifs</th></tr></thead>
      <tbody>
        {(ref?.scenarios ?? []).map((s) => <tr key={s.regle} style={{ borderBottom: "1px solid #eee" }}>
          <td style={{ padding: 6, fontWeight: 700 }}>{s.regle}</td>
          <td style={{ fontFamily: "monospace", fontSize: 11 }}>{s.type}</td>
          <td><span style={{ padding: "1px 7px", borderRadius: 10, background: nivColor(s.niveau), color: "#fff", fontSize: 11, fontWeight: 700 }}>N{s.niveau}</span></td>
          <td>{s.libelle}</td>
          <td style={{ fontSize: 11 }}>{s.seuils.length ? s.seuils.map((k) => <div key={k}><span style={{ color: "#888" }}>{k}</span> = <strong>{seuilVal(k)}</strong></div>) : <span style={{ color: "#aaa" }}>—</span>}</td>
        </tr>)}
        {!ref?.scenarios?.length && <tr><td colSpan={5} style={{ padding: 6, color: "#666" }}>Référentiel non chargé.</td></tr>}
      </tbody>
    </table>
    <p style={{ fontSize: 11, color: "#888", marginTop: 8 }}>Niveau 1 = sévère · Niveau 2 = signal. Le moteur SIGNALE, il ne décide jamais seul — la levée reste un acte humain (R39).</p>
  </div>;
}
