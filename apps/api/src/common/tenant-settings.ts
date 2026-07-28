import { NotFoundException } from "@nestjs/common";
import { DbClient } from "./tx";

/**
 * Lecture des `settings` du tenant — SOURCE UNIQUE (A2, audit-architecture). Le motif
 * `tenant.findFirst({ where: { id } })` puis `(settings ?? {})` était dupliqué dans ~7 services
 * (certains levant `NotFoundException` si le tenant manque, d'autres renvoyant `{}`). Centralisé ici ;
 * les wrappers locaux délèguent (signatures inchangées ⇒ graphe DI ratifié intact). `client` = `tx`
 * ou `this.prisma`. `orThrow` reproduit à l'identique la variante levant l'exception. Comportement
 * identique — aucune règle changée (le contenu de `settings` reste le référentiel gouverné R125-128).
 */
export async function loadSettings(client: DbClient, tenantId: string, orThrow = false): Promise<any> {
  const t = await client.tenant.findFirst({ where: { id: tenantId } });
  if (!t && orThrow) throw new NotFoundException("Tenant introuvable");
  return (t?.settings as any) ?? {};
}
