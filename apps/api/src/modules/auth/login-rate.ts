import { HttpException, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

/**
 * R296 (dette §7, 2026-07-28 · store partagé §3.5 ratifié 2026-07-29) — RATE LIMITING des
 * portes de login PUBLIQUES. Fenêtre GLISSANTE par identifiant : au-delà du seuil, 429
 * TYPÉ — la MÊME réponse que l'identifiant existe ou non (le limiteur n'est jamais un
 * oracle, OL-34). Le COMPTE vit dans un STORE enfichable : mémoire d'instance par défaut
 * (dev/mono-instance) ; Redis PARTAGÉ dès que REDIS_URL est posé — N instances app = UN
 * quota, jamais N× (l'écart multi-instances est levé PAR CONSTRUCTION côté code ; la
 * preuve « 2 instances compose » se rejoue en staging, consigné).
 */

export const LIMITES = {
  login: { max: 8, fenetreMs: 60_000 },      // temps 2 (mot de passe) — serré
  methode: { max: 30, fenetreMs: 60_000 },   // temps 1 (résolution) — l'énumération se paie aussi
} as const;

type Limite = { max: number; fenetreMs: number };

// Le contrat du store : enregistre la tentative et rend le compte DANS la fenêtre (elle comprise).
export interface RateStore {
  compterEtAjouter(cle: string, fenetreMs: number, now: number): Promise<number>;
}

export class MemoireRateStore implements RateStore {
  private tentatives = new Map<string, number[]>();
  async compterEtAjouter(cle: string, fenetreMs: number, now: number): Promise<number> {
    const recentes = (this.tentatives.get(cle) ?? []).filter((t) => now - t < fenetreMs);
    recentes.push(now);
    this.tentatives.set(cle, recentes);
    if (this.tentatives.size > 10_000)                       // balayage opportuniste des clés froides
      for (const [k, v] of this.tentatives) if (v.every((t) => now - t >= fenetreMs)) this.tentatives.delete(k);
    return recentes.length;
  }
}

// Sous-ensemble Redis utilisé (ioredis-compatible) — fenêtre glissante par sorted-set.
export interface RedisMinimal {
  zremrangebyscore(cle: string, min: number, max: number): Promise<unknown>;
  zadd(cle: string, score: number, membre: string): Promise<unknown>;
  zcard(cle: string): Promise<number>;
  pexpire(cle: string, ms: number): Promise<unknown>;
}

export class RedisRateStore implements RateStore {
  constructor(private client: RedisMinimal) {}
  async compterEtAjouter(cle: string, fenetreMs: number, now: number): Promise<number> {
    const k = `olive:rl:${cle}`;
    await this.client.zremrangebyscore(k, 0, now - fenetreMs);              // purge la fenêtre passée
    await this.client.zadd(k, now, `${now}:${randomUUID()}`);               // chaque tentative compte
    const n = await this.client.zcard(k);
    await this.client.pexpire(k, fenetreMs);                                // la clé meurt avec sa fenêtre
    return n;
  }
}

// Le store par défaut de l'app : Redis si REDIS_URL (ioredis chargé dynamiquement — la
// dépendance vit en staging/prod, jamais requise en dev), mémoire d'instance sinon.
export function storeDepuisEnv(): RateStore {
  const url = process.env.REDIS_URL;
  if (!url) return new MemoireRateStore();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const IORedis = require("ioredis");                                       // présent là où REDIS_URL l'est (compose/staging)
  return new RedisRateStore(new IORedis(url) as RedisMinimal);
}

@Injectable()
export class LoginRateLimiter {
  private store: RateStore;
  constructor(store?: RateStore) { this.store = store ?? storeDepuisEnv(); }

  // Enregistre la tentative PUIS refuse au-delà du seuil — chaque appel compte, réussi ou non.
  async garder(cle: string, limite: Limite): Promise<void> {
    const n = await this.store.compterEtAjouter(cle, limite.fenetreMs, Date.now());
    if (n > limite.max) throw new HttpException(
      "R296 : trop de tentatives de connexion — réessayez plus tard (fenêtre glissante, même réponse quel que soit l'identifiant)", 429);
  }
}
