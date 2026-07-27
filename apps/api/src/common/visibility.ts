/**
 * Périmètre de visibilité « soi / équipe / tout » — SOURCE UNIQUE (A2, audit-architecture). La règle
 * « rôle voit-tout → périmètre nul ; sinon soi + les collaborateurs des équipes dont il est responsable
 * (`workloadResponsables`) » était copiée entre `tasks` (R240) et `formations` (R236). Centralisée ici ;
 * les services l'appellent avec LEUR clé `voitTout` (taskVisibiliteRoles / trainingVisibiliteRoles) et
 * leurs `settings` déjà chargés. Retourne `null` = voit-tout (aucune restriction), sinon l'ensemble
 * autorisé (soi + équipe). Comportement identique — le filtrage/narrowing reste à l'appelant.
 */
export async function teamScope(
  client: any, tenantId: string, role: string, userId: string, settings: any, voitToutRoles: string[],
): Promise<Set<string> | null> {
  if (voitToutRoles.includes(role)) return null;                         // voit-tout : aucun périmètre
  const equipes = (settings.workloadResponsables ?? [])
    .filter((r: any) => r.responsableRole === role).map((r: any) => r.equipeRole);
  const scope = new Set<string>([userId]);                               // soi, toujours
  if (equipes.length) {
    const membres = await client.user.findMany({ where: { tenantId, role: { in: equipes } } });
    membres.forEach((m: any) => scope.add(m.id));
  }
  return scope;
}
