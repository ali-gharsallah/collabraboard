import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import { flagActif } from "./feature-flags";

// ═══ Bloc A robustesse (R336/LK) — VERROU OPTIMISTE sur les tables d'état mutables ═══════════
// O-Live est CRUD-primaire (pas event-sourcé) : le verrou optimiste vit sur les TABLES D'ÉTAT
// (pattern `UPDATE … WHERE id AND version = :v`, version++), pas sur le journal append-only.
// Deux compliance officers modifiant le même dossier KYC : l'un réussit, l'autre reçoit 409 et
// recharge (jamais d'écrasement silencieux, jamais de 4-yeux corrompu). Aucun retry serveur.

export class ConcurrencyConflictError extends Error {
  constructor(public readonly aggregateId: string, public readonly expectedVersion: number) {
    super("concurrent_modification");
    this.name = "ConcurrencyConflictError";
  }
}

// Délégué Prisma minimal (ex. prisma.kycFile) : on n'a besoin que de updateMany.
type Delegate = { updateMany: (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }> };

/**
 * UPDATE gardé par la version. Tente d'abord `WHERE id AND version = expected` (version++).
 *  - succès (1 ligne) → pas de conflit.
 *  - 0 ligne (version périmée ou id absent) :
 *      • FF_OPTIMISTIC_LOCKING = ON  → lève ConcurrencyConflictError (→ 409 via le filtre).
 *      • OFF (legacy / SHADOW) → signale (onShadowConflict) qu'un conflit AURAIT eu lieu, puis
 *        applique quand même sans garde de version (comportement legacy inchangé, observation).
 * `enforce` permet de forcer le mode en test, sinon lit le flag.
 */
export async function majVersionnee(
  model: Delegate, id: string, expectedVersion: number, data: Record<string, unknown>,
  opts: { enforce?: boolean; onShadowConflict?: (id: string, expected: number) => void } = {},
): Promise<void> {
  const enforced = opts.enforce ?? flagActif("FF_OPTIMISTIC_LOCKING");
  const garde = await model.updateMany({ where: { id, version: expectedVersion }, data: { ...data, version: { increment: 1 } } });
  if (garde.count === 1) return;                                     // pas de conflit
  if (enforced) throw new ConcurrencyConflictError(id, expectedVersion);
  opts.onShadowConflict?.(id, expectedVersion);                     // shadow : un conflit aurait eu lieu
  await model.updateMany({ where: { id }, data: { ...data, version: { increment: 1 } } });   // legacy : applique
}

// Le conflit remonte à l'API en HTTP 409 typé (le client recharge — aucun retry aveugle serveur).
@Catch(ConcurrencyConflictError)
export class ConcurrencyConflictFilter implements ExceptionFilter {
  catch(err: ConcurrencyConflictError, host: ArgumentsHost) {
    host.switchToHttp().getResponse().status(HttpStatus.CONFLICT).json({
      error: "concurrent_modification",
      aggregate_id: err.aggregateId,
      expected_version: err.expectedVersion,
      message: "Le dossier a été modifié entre-temps. Rechargez avant de soumettre.",
    });
  }
}
