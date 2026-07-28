/**
 * FAT — DÉGEL VAGUE 1 (canon dégel complet ratifié 2026-07-28, mapping +3) :
 * R297 [canon R294] flux transactionnel = UN journal canonique (TF-01..03) ·
 * R298 [canon R295] txrisk = SURFACE du moteur CPSI (TF-04..06) ·
 * R299 [canon R296] FX = lecture d'exposition (TF-07/08) ·
 * R300 [canon R297] SWIFT = laboratoire d'analyse (TF-09..12).
 * Port de TEST déterministe gaté par env (doctrine OLIVIA_FAKE_PORT) — fixtures en TEST
 * uniquement, jamais en prod (R167).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

describe("FAT DÉGEL V1 — R297 : le journal SANS port (TF-01)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const RM = randomUUID();

  beforeAll(async () => {
    delete process.env.TXFLUX_FAKE_PORT;                  // AUCUN port : le refus est la règle
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("TF-01 [R297] port absent → refus gracieux TYPÉ, zéro donnée — jamais une fixture en prod", async () => {
    const imp = await request(http).post("/v1/txflux/importer").set(bearer(T, RM, "RM")).send({});
    expect(imp.status).toBe(400);
    expect(JSON.stringify(imp.body)).toContain("R297");                     // refus typé, pas un silence
    const etat = await request(http).get("/v1/txflux/etat").set(bearer(T, RM, "RM"));
    expect(etat.status).toBe(200);
    expect(etat.body.portConfigure).toBe(false);                            // l'écran REND cet état
    const flux = await request(http).get("/v1/txflux").set(bearer(T, RM, "RM"));
    expect(flux.status).toBe(200);
    expect(flux.body).toEqual([]);                                          // zéro donnée simulée
    console.log("TF-01 PASS — refus gracieux typé sans port, zéro donnée");
  });
});

describe("FAT DÉGEL V1 — R297 : journal canonique, idempotent, IMMUABLE (TF-02/03)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const RM = randomUUID();

  beforeAll(async () => {
    process.env.TXFLUX_FAKE_PORT = "1";                   // port de TEST déterministe (R167 : test only)
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { delete process.env.TXFLUX_FAKE_PORT; await app.close(); });

  it("TF-02 [R297/R286] même ref_externe livrée deux fois → UNE transaction (idempotence par (source, ref_externe))", async () => {
    const un = await request(http).post("/v1/txflux/importer").set(bearer(T, RM, "RM")).send({});
    expect(un.status).toBe(201);
    expect(un.body.importees).toBeGreaterThanOrEqual(3);                    // la fixture déterministe
    const deux = await request(http).post("/v1/txflux/importer").set(bearer(T, RM, "RM")).send({});
    expect(deux.status).toBe(201);
    expect(deux.body.importees).toBe(0);                                    // rien de nouveau — dédupliqué
    expect(deux.body.dejaConnues).toBeGreaterThanOrEqual(3);
    const n = await prisma.transaction.count({ where: { tenantId: T } });
    expect(n).toBe(un.body.importees);                                      // pas un doublon en base
    console.log("TF-02 PASS — idempotence par (source, ref_externe)");
  });

  it("TF-03 [R297/R48] le journal est IMMUABLE : UPDATE et DELETE lèvent une exception (trigger append-only)", async () => {
    const tx = await prisma.transaction.findFirst({ where: { tenantId: T } });
    expect(tx).toBeTruthy();
    await expect(prisma.$executeRawUnsafe(
      `UPDATE transactions SET montant = 0 WHERE id = '${tx!.id}'`)).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe(
      `DELETE FROM transactions WHERE id = '${tx!.id}'`)).rejects.toThrow(/append-only/);
    console.log("TF-03 PASS — UPDATE/DELETE interdits par trigger");
  });
});
