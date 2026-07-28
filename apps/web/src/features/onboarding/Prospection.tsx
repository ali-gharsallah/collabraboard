import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

/**
 * `prospection` — application du canon triage final (verdict 0b.1 ratifié 2026-07-28) :
 * l'état PROSPECT est DÉJÀ modélisé par R117 (onboardings.etape) — cet écran est un RENDU
 * du funnel filtré, aucune règle ni modèle nouveau. L'acte (avancer l'étape) vit dans
 * l'écran Onboarding.
 */

type Ob = { id: string; prospectNom?: string; etape: string; createdAt?: string };

export function Prospection() {
  const [obs, setObs] = useState<Ob[] | null>(null);
  const charger = async () => {
    const r = await apiGetSourced<Ob[] | null>("/v1/onboarding", null);
    setObs(r.isDemo ? null : r.data);
  };
  const prospects = (obs ?? []).filter((o) => o.etape === "PROSPECT");
  const parEtape = new Map<string, number>();
  (obs ?? []).forEach((o) => parEtape.set(o.etape, (parEtape.get(o.etape) ?? 0) + 1));
  const td = { fontSize: 12, borderTop: `1px solid ${tokens.color.border}`, padding: "3px 8px" };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Pré-prospection — le funnel R117, filtré PROSPECT (rendu, l&apos;acte vit dans Onboarding)</h3>
    <button onClick={charger} disabled={isDemoMode()} style={{ fontSize: 12, marginBottom: 10 }}>Charger</button>
    {obs && <div>
      <p style={{ fontSize: 12, color: tokens.color.muted }}>{[...parEtape.entries()].map(([e, c]) => `${e} : ${c}`).join(" · ") || "funnel vide"}</p>
      <table style={{ borderCollapse: "collapse" }}><tbody>
        {prospects.map((o) => <tr key={o.id}>
          <td style={td}><strong>{o.prospectNom ?? o.id}</strong></td>
          <td style={td}>{o.etape}</td>
          <td style={{ ...td, color: tokens.color.muted }}>→ écran Onboarding</td>
        </tr>)}
        {prospects.length === 0 && <tr><td style={{ fontSize: 12, color: tokens.color.muted }}>Aucun prospect</td></tr>}
      </tbody></table>
    </div>}
  </div>;
}
