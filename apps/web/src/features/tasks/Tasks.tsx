import React from "react";
import { tokens } from "../../theme/tokens";

// Écran « Tâches » (SPEC-FRONT-CÂBLAGE v2, FE-TASK). En attente de canon : le backend ratifié n'expose
// pas de service de BACKLOG de tâches (liste + complétion) — seules existent la réassignation
// (workload.reassigner, R184) et des lectures internes (charge, gestes CRM). Conformément à A1/FE-05,
// l'écran fonctionne en SEED LECTURE SEULE, sans endpoint fictif ni complétion inventée. Voir ECARTS-FRONT.

type TaskSeed = { type: string; statut: string; echeance: string; assignee: string };
const SEED: TaskSeed[] = [
  { type: "REVUE_KYC", statut: "OUVERTE", echeance: "2026-08-01", assignee: "RM-demo" },
  { type: "RAPPEL_DOC", statut: "EN_COURS", echeance: "2026-07-28", assignee: "CO-demo" },
];

export function Tasks() {
  return <div>
    <div style={{ padding: 10, borderRadius: tokens.radius.md, background: "#fbf6e6",
      border: `1px solid ${tokens.color.gold}`, marginBottom: 12, fontSize: tokens.font.sm }}>
      Démonstration — service backend non ratifié (pas de service de backlog « lister / compléter » ;
      seule la réassignation existe sous <code>workload</code>). Écran en lecture seule ; aucune action.
    </div>
    <h3>Tâches (démonstration)</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>Le backlog actionnable (liste,
      complétion événementielle) nécessite un service ratifié — en attente de canon (FE-TASK, cf. ECARTS-FRONT).
      Bouton « Compléter » absent (capacité non ratifiée, A1/D1).</p>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: tokens.font.sm, marginTop: 8 }}>
      <thead><tr style={{ textAlign: "left", borderBottom: `2px solid ${tokens.color.olive700}` }}>
        <th style={{ padding: 6 }}>Type</th><th>Statut</th><th>Échéance</th><th>Assigné</th></tr></thead>
      <tbody>
        {SEED.map((t, i) => <tr key={i} style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
          <td style={{ padding: 6 }}>{t.type}</td><td>{t.statut}</td><td>{t.echeance}</td><td>{t.assignee}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
