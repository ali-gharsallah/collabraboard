import { randomUUID } from "crypto";

/**
 * File de travail aml-eval (dispatch asynchrone) — MÊME DOCTRINE que le rate-limit (login-rate.ts) :
 * in-memory par défaut (mono-instance / dev), Redis dès que `REDIS_URL` est posé (N instances app =
 * UNE file partagée). La file est PAR TENANT (clé scopée) : un drain ne traite jamais que les jobs
 * de son propre tenant — aucune fuite inter-tenant. `enqueueClient` ne calcule rien : la détection
 * réelle survient au `drain` (le tick du worker).
 */
export interface AmlEvalJob {
  id: string;
  kind: "client";
  userId: string;
  role: string;
  payload: unknown;
  enqueuedAt: string;
}

// Sous-ensemble Redis utilisé (ioredis-compatible) — une LISTE FIFO par tenant.
export interface RedisQueueMinimal {
  lpush(key: string, val: string): Promise<number>;
  rpop(key: string): Promise<string | null>;
  llen(key: string): Promise<number>;
}

export interface AmlEvalQueue {
  enqueue(tenantId: string, job: AmlEvalJob): Promise<void>;
  dequeue(tenantId: string): Promise<AmlEvalJob | null>;
  size(tenantId: string): Promise<number>;
  readonly backend: "memory" | "redis";
}

/** File en mémoire (mono-instance) — Map<tenant, job[]> FIFO. */
export class MemoryQueue implements AmlEvalQueue {
  readonly backend = "memory" as const;
  private q = new Map<string, AmlEvalJob[]>();
  async enqueue(tenantId: string, job: AmlEvalJob) { (this.q.get(tenantId) ?? this.q.set(tenantId, []).get(tenantId)!).push(job); }
  async dequeue(tenantId: string) { return this.q.get(tenantId)?.shift() ?? null; }
  async size(tenantId: string) { return this.q.get(tenantId)?.length ?? 0; }
}

/** File Redis (multi-instance) — une liste `aml:eval:queue:{tenant}` par tenant. */
export class RedisQueue implements AmlEvalQueue {
  readonly backend = "redis" as const;
  constructor(private client: RedisQueueMinimal) {}
  private key(tenantId: string) { return `aml:eval:queue:${tenantId}`; }
  async enqueue(tenantId: string, job: AmlEvalJob) { await this.client.lpush(this.key(tenantId), JSON.stringify(job)); }
  async dequeue(tenantId: string) { const v = await this.client.rpop(this.key(tenantId)); return v ? (JSON.parse(v) as AmlEvalJob) : null; }
  async size(tenantId: string) { return this.client.llen(this.key(tenantId)); }
}

/** Fabrique un job à partir du contexte + de la charge (id/horodatage posés ici). */
export function makeJob(kind: AmlEvalJob["kind"], userId: string, role: string, payload: unknown): AmlEvalJob {
  return { id: randomUUID(), kind, userId, role, payload, enqueuedAt: new Date().toISOString() };
}

/** File par défaut : Redis si `REDIS_URL` (ioredis chargé dynamiquement, comme le rate-limit), sinon mémoire. */
export function defaultQueue(): AmlEvalQueue {
  const url = process.env.REDIS_URL;
  if (!url) return new MemoryQueue();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const IORedis = require("ioredis");                                     // présent là où REDIS_URL l'est (compose/staging)
  return new RedisQueue(new IORedis(url) as RedisQueueMinimal);
}
