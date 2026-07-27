/**
 * Écriture d'événement de domaine — SOURCE UNIQUE (A2, audit-architecture). La forme
 * `{ tenantId, type, aggregateId, payload, at }` était réécrite à l'identique dans ~35 services ;
 * une correction (champ ajouté, source d'horloge changée) devait être répétée 35 fois. Elle vit
 * désormais ici ; les services délèguent via leur wrapper `emit` (signatures locales inchangées ⇒
 * graphe DI ratifié intact). `client` = un `tx` de transaction interactive OU `this.prisma`.
 * `tenantId` peut être `null` (événements vendeur cross-tenant, R177). Comportement identique.
 */
export function emitEvent(client: any, tenantId: string | null, type: string, aggregateId: string, payload: any) {
  return client.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
}
