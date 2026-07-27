/**
 * R267/OF-10 — le fait « client clôturé » (lecture seule intégrale), calculé, jamais stocké
 * sur le client. Un client est clôturé s'il porte une clôture CLOTUREE ET qu'aucun KYC n'a
 * été créé APRÈS la clôture effective (R271 : le retour est un NOUVEL onboarding qui crée un
 * KYC Rn+1 chaîné — sa création rouvre la relation ; la clôture historique, elle, reste).
 * Partagé entre OffboardingService (bannière, obstacles) et KycService (refus d'écriture).
 */
export type EtatCloture = {
  cloture: boolean;
  le?: string;                 // clotureEffectiveAt ISO
  retentionJusqua?: string;    // ISO date (LBA art. 7)
  type?: string;               // type de la clôture (R271 : attribut de risque visible)
  offboardingId?: string;
};

export async function etatCloture(db: any, tenantId: string, clientId: string): Promise<EtatCloture> {
  const off = await db.offboardingFile.findFirst({
    where: { tenantId, clientId, statut: "CLOTUREE" },
    orderBy: { clotureEffectiveAt: "desc" } });
  if (!off) return { cloture: false };
  const retour = await db.kycFile.findFirst({
    where: { tenantId, clientId, createdAt: { gt: off.clotureEffectiveAt } },
    select: { id: true } });
  if (retour) return { cloture: false, type: off.type, offboardingId: off.id }; // relation rouverte (R271)
  return { cloture: true, le: off.clotureEffectiveAt?.toISOString(),
    retentionJusqua: off.retentionJusqua ? new Date(off.retentionJusqua).toISOString().slice(0, 10) : undefined,
    type: off.type, offboardingId: off.id };
}
