import React, { useEffect, useState } from "react";
import { apiGetSourced, isDemoMode } from "../lib/api";
import { tokens } from "../theme/tokens";

// R267/OF-10 (canon vague écrans pilote, partie 5) : un client CLOTUREE est en LECTURE SEULE
// intégrale pour la durée de rétention (LBA art. 7). La bannière est servie par le backend
// (`GET /v1/offboarding/statut/:clientId` — fait CALCULÉ, jamais stocké sur le client) et
// s'affiche sur TOUS les écrans du client (critère 5.6-4 : client, KYC, comptes). En mode
// démo (pas d'API), rien ne s'affiche — on ne simule jamais un état de clôture (R167).
type Etat = { cloture: boolean; le?: string; retentionJusqua?: string; type?: string };

export function BanniereCloture({ clientId }: { clientId?: string | null }) {
  const [etat, setEtat] = useState<Etat | null>(null);
  useEffect(() => {
    let actif = true;
    setEtat(null);
    if (!clientId || isDemoMode()) return;
    apiGetSourced<Etat>(`/v1/offboarding/statut/${clientId}`, { cloture: false })
      .then((r) => { if (actif && !r.isDemo) setEtat(r.data); });
    return () => { actif = false; };
  }, [clientId]);
  if (!etat?.cloture) return null;
  return <div data-testid="banniere-cloture" style={{ padding: "10px 14px", marginBottom: 12,
    borderRadius: tokens.radius.lg, background: "#FDF3F2", border: `1px solid ${tokens.color.danger}`,
    color: tokens.color.danger, fontSize: 13, fontWeight: 600 }}>
    Dossier clôturé le {etat.le?.slice(0, 10)} — lecture seule — rétention jusqu&apos;au {etat.retentionJusqua}
  </div>;
}
