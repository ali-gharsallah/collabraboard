import { createHash } from "crypto";
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import { flagActif } from "./feature-flags";

// ═══ Bloc B robustesse (R337/IDM) — IDEMPOTENCE des commandes ════════════════════════════════
// Un retry réseau (mobile, timeout proxy bancaire) rejoue un POST → sans garde, double dossier /
// double visa. Le `command_id` (généré client, en-tête Idempotency-Key) est consommé UNE fois ;
// le rejeu retourne la réponse snapshotée, aucun nouvel effet. Consommation DANS LA MÊME
// transaction que la commande (atomicité : un échec ne consomme pas la clé → retry légitime).

export class IdempotencyKeyReuseError extends Error {
  constructor(public readonly commandId: string) { super("idempotency_key_reuse"); this.name = "IdempotencyKeyReuseError"; }
}

const sha256 = (o: unknown) => createHash("sha256").update(JSON.stringify(o ?? null)).digest("hex");

type Ctx = { commandId: string; tenantId: string; aggregateId: string; payload: unknown };
type PrismaLike = {
  processedCommand: { findUnique: (a: any) => Promise<any>; create: (a: any) => Promise<any> };
  $transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
};

/**
 * Exécute `fn` de façon idempotente. Sous FF_IDEMPOTENCY :
 *  - clé déjà consommée + MÊME payload  → REJEU : réponse snapshotée, `fn` NON exécuté (replayed).
 *  - clé déjà consommée + payload DIFFÉRENT → IdempotencyKeyReuseError (→ 422).
 *  - clé neuve → `fn(tx)` ET insertion `processed_commands` DANS LA MÊME transaction.
 * Flag off (legacy) : la clé est ignorée (`fn` exécuté), `replayed:false`.
 */
export async function executerIdempotent<T>(
  prisma: PrismaLike, ctx: Ctx, fn: (tx: any) => Promise<T>, opts: { enforce?: boolean } = {},
): Promise<{ replayed: boolean; response: T }> {
  if (!(opts.enforce ?? flagActif("FF_IDEMPOTENCY")))
    return { replayed: false, response: await prisma.$transaction(fn) };   // legacy : clé ignorée
  const hash = sha256(ctx.payload);
  const deja = await prisma.processedCommand.findUnique({ where: { commandId: ctx.commandId } });
  if (deja) {
    if (deja.resultHash !== hash) throw new IdempotencyKeyReuseError(ctx.commandId);
    return { replayed: true, response: deja.responseSnapshot as T };       // rejeu, aucun effet
  }
  return prisma.$transaction(async (tx) => {
    const response = await fn(tx);
    await tx.processedCommand.create({ data: { commandId: ctx.commandId, tenantId: ctx.tenantId,
      aggregateId: ctx.aggregateId, resultHash: hash, responseSnapshot: response as any } });
    return { replayed: false, response };
  });
}

// Réutilisation de clé (même command_id, payload différent) → HTTP 422 typé.
@Catch(IdempotencyKeyReuseError)
export class IdempotencyReuseFilter implements ExceptionFilter {
  catch(err: IdempotencyKeyReuseError, host: ArgumentsHost) {
    host.switchToHttp().getResponse().status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      error: "idempotency_key_reuse", command_id: err.commandId,
      message: "Cette clé d'idempotence a déjà été utilisée avec un contenu différent.",
    });
  }
}
