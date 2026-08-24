/**
 * Écriture d'événement de domaine — SOURCE UNIQUE (A2, audit-architecture). La forme
 * `{ tenantId, type, aggregateId, payload, at }` était réécrite à l'identique dans ~35 services ;
 * une correction (champ ajouté, source d'horloge changée) devait être répétée 35 fois. Elle vit
 * désormais ici ; les services délèguent via leur wrapper `emit` (signatures locales inchangées ⇒
 * graphe DI ratifié intact). `client` = un `tx` de transaction interactive OU `this.prisma`.
 * `tenantId` peut être `null` (événements vendeur cross-tenant, R177).
 *
 * P-L5-2 (dette C6 · R339/EV) — le CATALOGUE régit l'écriture (docs/contracts/events-catalog.ts) :
 * un type SCHÉMATISÉ est validé (zod) AVANT insertion — échec = EvenementNonConformeError, jamais
 * d'écriture partielle (dans une transaction interactive, le throw annule tout) — et eventVersion
 * est posé depuis le catalogue. Un type EN ATTENTE (inventaire de migration douce) passe sans
 * validation (version défaut). Un type ABSENT des deux listes est REFUSÉ. Les événements déjà
 * stockés ne sont JAMAIS touchés (R49) — la lecture reste régie par les upcasters.
 */
import { DbClient } from "./tx";
import { SCHEMAS_EVENEMENTS, TYPES_EN_ATTENTE } from "../contracts/events-catalog";

export class EvenementNonConformeError extends Error {
  constructor(public type: string, detail: string) {
    super(`C6 : événement « ${type} » refusé au write — ${detail}`);
    this.name = "EvenementNonConformeError";
  }
}

/** `at` optionnel : la quasi-totalité des émissions datent « maintenant » (défaut) ; un site qui
 *  CORRÈLE délibérément son horodatage avec un autre enregistrement (ex. cpsi_events jumeau,
 *  horodatage de génération d'un export) le passe explicitement — sans sortir du catalogue. */
export function emitEvent(client: DbClient, tenantId: string | null, type: string, aggregateId: string, payload: any, at?: string) {
  const entree = SCHEMAS_EVENEMENTS[type];
  if (entree) {
    const r = entree.schema.safeParse(payload ?? {});
    if (!r.success)
      throw new EvenementNonConformeError(type,
        r.error.issues.map((i) => `${i.path.join(".") || "payload"} : ${i.message}`).join(" ; "));
    return client.domainEvent.create({ data: {
      tenantId, type, aggregateId, payload, eventVersion: entree.version, at: at ?? new Date().toISOString() } });
  }
  if (!TYPES_EN_ATTENTE.has(type))
    throw new EvenementNonConformeError(type, "type inconnu du catalogue (ni schéma, ni liste d'attente) — déclarer le type avant de l'émettre");
  return client.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: at ?? new Date().toISOString() } });
}
