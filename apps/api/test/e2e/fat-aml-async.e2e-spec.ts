/**
 * FAT — Dispatch asynchrone aml-eval (file par tenant) contre le VRAI backend + Postgres. Sans
 * REDIS_URL la file est en mémoire (mono-instance) ; avec REDIS_URL elle passe sur Redis SANS
 * changer le contrat (doctrine du rate-limit). L'`enqueue` ne calcule rien ; le `drain` (tick du
 * worker) traite les jobs → signaux persistés. Scope tenant : un drain ne traite que SA file.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT AML async — dispatch en file (backend + Postgres réels)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const A = randomUUID(), B = randomUUID();
  const U = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, A, randomUUID());
    await seedTenantClient(prisma, B, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("enqueue ne calcule rien ; le drain traite → signaux persistés", async () => {
    const clients = [randomUUID(), randomUUID(), randomUUID()];
    for (const clientId of clients) {
      const q = await request(http).post("/v1/aml/eval/client-async").set(bearer(A, U, "CO"))
        .send({ clientId, scenarios: ["SF-01"], facts: { matchScore: 91 } });
      expect(q.status).toBe(201);
      expect(q.body.status).toBe("queued");
      expect(q.body.backend).toBe("memory");            // pas de REDIS_URL en test → mémoire
    }
    // AVANT le drain : rien n'est traité (asynchrone).
    expect(await prisma.amlGapSignal.count({ where: { tenantId: A } })).toBe(0);

    const d = await request(http).post("/v1/aml/eval/drain").set(bearer(A, U, "CO")).send({});
    expect(d.body.processed).toBe(3);
    expect(d.body.restant).toBe(0);
    expect(d.body.results.every((x: any) => x.raised === 1)).toBe(true);
    expect(await prisma.amlGapSignal.count({ where: { tenantId: A } })).toBe(3);
    console.log("ASYNC-1 PASS — 3 en file, drain → 3 signaux");
  });

  it("drain à vide → 0 job traité (idempotent, pas d'effet)", async () => {
    const d = await request(http).post("/v1/aml/eval/drain").set(bearer(A, U, "CO")).send({});
    expect(d.body.processed).toBe(0);
    console.log("ASYNC-2 PASS — file vide, 0 traité");
  });

  it("scope tenant : le drain de B ne traite pas les jobs de A", async () => {
    // A met un job en file, B draine : rien pour B, le job de A reste.
    await request(http).post("/v1/aml/eval/client-async").set(bearer(A, U, "CO"))
      .send({ clientId: randomUUID(), scenarios: ["SF-01"], facts: { matchScore: 91 } }).expect(201);
    const db = await request(http).post("/v1/aml/eval/drain").set(bearer(B, U, "CO")).send({});
    expect(db.body.processed).toBe(0);                  // file de B vide
    const da = await request(http).post("/v1/aml/eval/drain").set(bearer(A, U, "CO")).send({});
    expect(da.body.processed).toBe(1);                  // le job de A l'attendait toujours
    console.log("ASYNC-3 PASS — files isolées par tenant");
  });

  it("borne : drain max=1 ne traite qu'un job, laisse le reste en file", async () => {
    for (let i = 0; i < 3; i++) {
      await request(http).post("/v1/aml/eval/client-async").set(bearer(A, U, "CO"))
        .send({ clientId: randomUUID(), scenarios: ["SF-01"], facts: { matchScore: 91 } }).expect(201);
    }
    const d = await request(http).post("/v1/aml/eval/drain").set(bearer(A, U, "CO")).send({ max: 1 });
    expect(d.body.processed).toBe(1);
    expect(d.body.restant).toBe(2);
    await request(http).post("/v1/aml/eval/drain").set(bearer(A, U, "CO")).send({});  // vider
    console.log("ASYNC-4 PASS — drain borné à max");
  });
});
