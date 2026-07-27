import React from "react";
import { tokens } from "../theme/tokens";

// Composant UNIQUE de visa (SPEC-FRONT-CÂBLAGE v2 §1.1, invariant R15) : rôle requis, statut,
// signataire, horodatage. Le contrôle réel (exclusion 4-yeux R13, rôle) reste côté serveur ;
// ce composant AFFICHE l'état, il ne décide pas.
export type Visa = {
  section: string; roleRequis: string; statut: string;
  signePar?: string | null; signeAt?: string | null; verdict?: string | null;
};

export function VisaBadge({ visa }: { visa: Visa }) {
  const signe = visa.statut === "SIGNED";
  const couleur = signe ? tokens.color.ok : visa.statut === "REJECTED" ? tokens.color.danger : tokens.color.warn;
  return <div style={{ padding: 8, borderRadius: tokens.radius.md, border: `1px solid ${tokens.color.border}`,
    borderLeft: `4px solid ${couleur}`, background: tokens.color.surface, marginBottom: 6, fontSize: tokens.font.sm }}>
    <div><strong>{visa.section}</strong> <span style={{ color: tokens.color.muted }}>· rôle requis {visa.roleRequis}</span></div>
    <div style={{ color: couleur, fontWeight: 700 }}>{visa.statut}{visa.verdict ? ` · ${visa.verdict}` : ""}</div>
    {signe && <div style={{ color: tokens.color.muted, fontSize: 11 }}>
      signé par {visa.signePar}{visa.signeAt ? ` le ${new Date(visa.signeAt).toLocaleString()}` : ""}</div>}
  </div>;
}
