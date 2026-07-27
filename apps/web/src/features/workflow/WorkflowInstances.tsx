import React from "react";
import { tokens } from "../../theme/tokens";

// Écran « Workflow Instances » (SPEC-FRONT-CÂBLAGE v2, FE-WFI). En attente de canon : le backend
// ratifié n'expose que les DÉFINITIONS de workflow (R171-173), PAS d'instances en cours
// (steps/visas/events par dossier). Conformément à A1/FE-05, l'écran fonctionne en SEED LECTURE
// SEULE et n'appelle AUCUN endpoint fictif. Voir docs/ECARTS-FRONT.md.

type InstanceSeed = { code: string; type: string; statut: string; etape: string };
const SEED: InstanceSeed[] = [
  { code: "WF-DEMO-001", type: "KYC_ONBOARDING", statut: "EN_COURS", etape: "Collecte" },
  { code: "WF-DEMO-002", type: "REVUE_PERIODIQUE", statut: "EN_COURS", etape: "Visa CO" },
];

export function WorkflowInstances() {
  return <div>
    <div style={{ padding: 10, borderRadius: tokens.radius.md, background: "#fbf6e6",
      border: `1px solid ${tokens.color.gold}`, marginBottom: 12, fontSize: tokens.font.sm }}>
      Démonstration — service backend non ratifié (le canon n'expose que les <em>définitions</em> de
      workflow, pas les instances en cours). Écran en lecture seule ; aucune donnée réelle, aucune action.
    </div>
    <h3>Workflow Instances (démonstration)</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>Les instances en cours (étapes, visas,
      timeline append-only) nécessitent un service ratifié — en attente de canon (FE-WFI, cf. ECARTS-FRONT).</p>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: tokens.font.sm, marginTop: 8 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: `2px solid ${tokens.color.olive700}` }}>
        <th style={{ padding: 6 }}>Code</th><th>Type</th><th>Statut</th><th>Étape</th></tr></thead>
      <tbody>
        {SEED.map((i) => <tr key={i.code} style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
          <td style={{ padding: 6, fontFamily: "monospace" }}>{i.code}</td>
          <td>{i.type}</td><td>{i.statut}</td><td>{i.etape}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
