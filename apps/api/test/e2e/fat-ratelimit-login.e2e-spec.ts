/**
 * FAT — SÉCURITÉ (dette qualité §7 du canon du dégel, 2026-07-28) : rate limiting du login
 * R296. Les portes PUBLIQUES (auth/methode, auth/login, mobile/auth/login) se protègent
 * SERVEUR : au-delà de `login_rate_limite` (clé R-Q — essais par fenêtre), la réponse est
 * un 429 TYPÉ — la MÊME forme que l'identifiant existe ou non (pattern OL-34 : le limiteur
 * ne devient jamais un oracle d'existence). Fenêtre glissante en mémoire d'instance —
 * écart multi-instances consigné.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

describe("FAT RATE LIMIT — §7 : le login se protège serveur (R296), 429 typé, jamais un oracle", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const ADMIN = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, randomUUID());
    // Domaine résolu → le tenant existe au sens du login deux temps (R296)
    await request(http).post("/v1/parametres/valeur/loginDomaines").set(bearer(T, ADMIN, "ADMIN"))
      .send({ valeur: ["gwb-ratelimit.ch"], motif: "R296 : domaine de test rate limit" }).expect(201);
  });
  afterAll(async () => { await app.close(); });

  it("RL-01 [R296] /v1/auth/login : au-delà du seuil, 429 TYPÉ — même forme pour un email inconnu (jamais un oracle)", async () => {
    const connu = "alice@gwb-ratelimit.ch", inconnu = "personne@domaine-inconnu-xyz.ch";
    let premier429 = -1;
    for (let i = 0; i < 12; i++) {
      const r = await request(http).post("/v1/auth/login").send({ email: connu, password: "mauvais-mdp" });
      if (r.status === 429) { premier429 = i; expect(JSON.stringify(r.body)).toContain("R296"); break; }
      expect([400, 401, 403]).toContain(r.status);                          // avant le seuil : refus d'identifiants
    }
    expect(premier429).toBeGreaterThanOrEqual(5);                           // le seuil existe…
    expect(premier429).toBeLessThan(12);                                    // …et il a fini par tomber
    // L'email INCONNU épuise son propre compteur vers la MÊME réponse 429 — indistinguable
    let r429: any = null;
    for (let i = 0; i < 12; i++) {
      const r = await request(http).post("/v1/auth/login").send({ email: inconnu, password: "x" });
      if (r.status === 429) { r429 = r; break; }
    }
    expect(r429).toBeTruthy();
    expect(JSON.stringify(r429.body)).toContain("R296");                    // même forme — rien de révélé
    console.log(`RL-01 PASS — 429 typé au ${premier429 + 1}e essai, identique connu/inconnu`);
  });

  it("RL-02 [R296] le compteur est PAR identifiant : un autre email passe ; /v1/auth/methode se protège aussi", async () => {
    // L'email saturé au RL-01 est bloqué, un AUTRE email répond normalement
    const bloque = await request(http).post("/v1/auth/login").send({ email: "alice@gwb-ratelimit.ch", password: "x" });
    expect(bloque.status).toBe(429);
    const autre = await request(http).post("/v1/auth/login").send({ email: "bob@gwb-ratelimit.ch", password: "x" });
    expect([400, 401, 403]).toContain(autre.status);                        // pas de punition collective
    // methode (temps 1) : même garde — l'énumération de domaines se paie aussi
    let premier429 = -1;
    for (let i = 0; i < 40; i++) {
      const r = await request(http).post("/v1/auth/methode").send({ email: `probe@gwb-ratelimit.ch` });
      if (r.status === 429) { premier429 = i; break; }
      expect(r.status).toBe(201);
    }
    expect(premier429).toBeGreaterThan(0);
    console.log(`RL-02 PASS — compteur par identifiant ; methode 429 au ${premier429 + 1}e essai`);
  });

  it("RL-03 [R296/R316] la porte MOBILE se protège pareil : login mobile saturé → 429 typé", async () => {
    const identite = randomUUID();                                          // identité inexistante — même forme
    let premier429 = -1;
    for (let i = 0; i < 12; i++) {
      const r = await request(http).post("/v1/mobile/auth/login").send({ identite, mfa: "000000" });
      if (r.status === 429) { premier429 = i; expect(JSON.stringify(r.body)).toContain("R296"); break; }
      expect([401, 404]).toContain(r.status);
    }
    expect(premier429).toBeGreaterThan(0);
    console.log(`RL-03 PASS — mobile 429 au ${premier429 + 1}e essai`);
  });
});

// ── Partie 3 du solde 4 écarts (ratifié 2026-07-29) : le STORE du rate limit est PARTAGEABLE —
//    N instances app = UN quota (jamais N×). L'adaptateur Redis est prêt (REDIS_URL) ; ici il
//    se prouve contre un stub in-process (démon Docker indisponible en session — le test
//    « 2 instances compose » se rejoue en staging, consigné). ──
describe("FAT RATE LIMIT — store PARTAGÉ : deux limiteurs, un quota (RL-04)", () => {
  it("RL-04 [R296/§3.5] deux instances de limiteur sur UN store → le quota est GLOBAL ; l'adaptateur Redis compte pareil", async () => {
    const { LoginRateLimiter, MemoireRateStore, RedisRateStore, LIMITES } = await import("../../src/modules/auth/login-rate");
    // 1. Store mémoire PARTAGÉ entre deux « instances app »
    const store = new MemoireRateStore();
    const app1 = new LoginRateLimiter(store), app2 = new LoginRateLimiter(store);
    let refus = 0;
    for (let i = 0; i < LIMITES.login.max; i++)
      await (i % 2 === 0 ? app1 : app2).garder("login|partage@gwb.ch", LIMITES.login);   // 8 essais RÉPARTIS
    try { await app2.garder("login|partage@gwb.ch", LIMITES.login); } catch { refus++; }
    expect(refus).toBe(1);                                                  // le 9e refuse GLOBALEMENT — pas 8 par instance
    // 2. L'adaptateur REDIS (stub in-process : zremrangebyscore/zadd/zcard/pexpire) — même contrat
    const zsets = new Map<string, Map<string, number>>();
    const stub = {
      zremrangebyscore: async (k: string, _min: number, max: number) => {
        const z = zsets.get(k) ?? new Map(); for (const [m, s] of z) if (s <= max) z.delete(m); zsets.set(k, z); },
      zadd: async (k: string, score: number, membre: string) => { const z = zsets.get(k) ?? new Map(); z.set(membre, score); zsets.set(k, z); },
      zcard: async (k: string) => (zsets.get(k) ?? new Map()).size,
      pexpire: async () => 1,
    };
    const redisStore = new RedisRateStore(stub as any);
    const r1 = new LoginRateLimiter(redisStore), r2 = new LoginRateLimiter(redisStore);
    let refusRedis = 0;
    for (let i = 0; i < LIMITES.login.max; i++) await (i % 2 ? r1 : r2).garder("login|redis@gwb.ch", LIMITES.login);
    try { await r1.garder("login|redis@gwb.ch", LIMITES.login); } catch { refusRedis++; }
    expect(refusRedis).toBe(1);
    console.log("RL-04 PASS — quota GLOBAL sur store partagé (mémoire ET adaptateur Redis)");
  });
});
