/**
 * FAT — Corpus GT AML gap en base (ground_truth_cases), backend + Postgres RÉELS.
 *
 * Le worker aml-eval (recall/précision) et Olivia consomment le corpus GT depuis la base, tenant-
 * scopé (RLS). Ce test vérifie le SEED (idempotent, RBAC, isolation tenant) contre le vrai Postgres :
 *   POST /v1/aml/ground-truth/seed  — sème les 130 cas (66 TP / 64 FP), idempotent par (tenant, caseId)
 *   GET  /v1/aml/ground-truth/db    — lecture tenant-scopée, filtrable (fam/label/scénario)
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT AML gap — corpus GT en base (backend + Postgres réels)", () => {
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

  it("seed : 130 cas (66 TP / 64 FP) en base, tenant A", async () => {
    const r = await request(http).post("/v1/aml/ground-truth/seed").set(bearer(A, U, "CO"));
    expect(r.status).toBe(201);
    expect(r.body.seeded).toBe(130);
    expect(r.body.total).toBe(130);
    const db = await request(http).get("/v1/aml/ground-truth/db").set(bearer(A, U, "CO"));
    expect(db.body.total).toBe(130);
    expect(db.body.tp).toBe(66);
    expect(db.body.fp).toBe(64);
    console.log("GT-1 PASS — 130 cas semés (66 TP / 64 FP)");
  });

  it("idempotent : re-semer ne crée aucun doublon (corpus régénéré par le générateur, jamais muté)", async () => {
    await request(http).post("/v1/aml/ground-truth/seed").set(bearer(A, U, "CO")).expect(201);
    const n = await prisma.groundTruthCase.count({ where: { tenantId: A } });
    expect(n).toBe(130);
    console.log("GT-2 PASS — re-seed idempotent, toujours 130");
  });

  it("filtrable : par famille et par label (matière du worker aml-eval)", async () => {
    const sf = await request(http).get("/v1/aml/ground-truth/db?fam=SF").set(bearer(A, U, "CO"));
    expect(sf.body.total).toBeGreaterThan(0);
    expect(sf.body.cases.every((c: any) => c.fam === "SF")).toBe(true);
    const fp = await request(http).get("/v1/aml/ground-truth/db?label=FP").set(bearer(A, U, "CO"));
    expect(fp.body.total).toBe(64);
    console.log("GT-3 PASS — filtres fam/label");
  });

  it("isolation tenant : le corpus de A n'est pas visible depuis B (RLS applicative)", async () => {
    const db = await request(http).get("/v1/aml/ground-truth/db").set(bearer(B, U, "CO"));
    expect(db.body.total).toBe(0);
    console.log("GT-4 PASS — tenant B ne voit pas le corpus de A");
  });

  it("RBAC : un rôle non habilité (RM) ne peut pas semer (R13)", async () => {
    const r = await request(http).post("/v1/aml/ground-truth/seed").set(bearer(B, U, "RM"));
    expect(r.status).toBe(403);
    console.log("GT-5 PASS — RM refusé au seed");
  });
});
