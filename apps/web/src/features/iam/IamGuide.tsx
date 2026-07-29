import React, { useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

/**
 * `iamguide` — IM-05 (canon triage écrans, ratifié 2026-07-28) : le guide IAM, LECTURE SEULE
 * stricte (aucun non-GET), pattern cpsiguide. Le contenu est SERVI (GET /v1/admin/iam/guide —
 * route signalée à l'étape 0.d) : règles ratifiées, matrice rôles×surfaces EFFECTIVE, état réel
 * du tenant — DATÉ. « Exporter (PDF) » = l'écran lui-même (window.print) : le document remis à
 * l'auditeur est exactement ce qui est affiché.
 */

type Guide = { genereAt: string; modeAuth: string; regles: { code: string; texte: string }[];
  matrice: Record<string, string>; utilisateurs: { total: number; parRole: Record<string, number>; mfaActifs: number } };

export function IamGuide() {
  const [g, setG] = useState<Guide | null>(null);
  const charger = async () => {
    const r = await apiGetSourced<Guide | null>("/v1/admin/iam/guide", null);
    setG(r.isDemo ? null : r.data);
  };
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Guide IAM (iamguide) — les règles en vigueur, servies et datées</h3>
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
      <button onClick={charger} disabled={isDemoMode()} style={{ fontSize: 12 }}>Charger</button>
      {g && <button onClick={() => window.print()} style={{ fontSize: 12 }}>Exporter (PDF)</button>}
    </div>
    {g && <div>
      <p style={{ fontSize: 12, color: tokens.color.muted }}>Généré le {g.genereAt} · mode : {g.modeAuth} ·
        {" "}{g.utilisateurs.total} utilisateurs ({g.utilisateurs.mfaActifs} MFA actifs)</p>
      <h4 style={{ margin: "8px 0 4px" }}>Règles ratifiées</h4>
      {g.regles.map((r) => <p key={r.code} style={{ fontSize: 12, margin: "3px 0" }}><strong>{r.code}</strong> — {r.texte}</p>)}
      <h4 style={{ margin: "8px 0 4px" }}>Matrice rôles × surfaces (effective)</h4>
      <table cellPadding={4} style={{ borderCollapse: "collapse", fontSize: 12 }}><tbody>
        {Object.entries(g.matrice).map(([role, surface]) => <tr key={role} style={{ borderTop: `1px solid ${tokens.color.border}` }}>
          <td><strong>{role}</strong>{g.utilisateurs.parRole[role] != null && <span style={{ color: tokens.color.muted }}> ({g.utilisateurs.parRole[role]})</span>}</td>
          <td>{surface}</td></tr>)}
      </tbody></table>
    </div>}
  </div>;
}
