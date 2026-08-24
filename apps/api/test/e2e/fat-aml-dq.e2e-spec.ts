/**
 * FAT — Contrôle Data-Quality (GV-03, R376) contre le VRAI backend + Postgres. La complétude des
 * champs critiques d'un lot de flux est mesurée ; sous `completude_min` (98 %), les scénarios
 * dépendants sont « dégradés » et un signal DQ_DEGRADED (Niveau 1, ops) devient VISIBLE dans l'inbox
 * — jamais silencieux (R39 : un scénario aveugle est un faux négatif silencieux).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT AML DQ — data-quality pré-conditions (backend + Postgres réels)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const U = randomUUID();
  // 100 MT103 : champ « ordonnateur » manquant sur 8 (complétude 92 % < 98 %) ; « devise » complet.
  const flux = Array.from({ length: 100 }, (_, i) => ({
    id: `mt103-${i}`, devise: "CHF", ordonnateur: i < 8 ? "" : `ORD-${i}`,
  }));

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("complétude sous le seuil → DQ_DEGRADED persisté (Niveau 1), scénarios dépendants marqués", async () => {
    const r = await request(http).post("/v1/aml/eval/dq").set(bearer(T, U, "CO"))
      .send({ flux, champsCritiques: ["ordonnateur", "devise"], dependances: { ordonnateur: ["SF-04", "CB-03"] } });
    expect(r.status).toBe(201);
    const b = r.body;
    expect(b.completudeMin).toBe(98);
    const ord = b.parChamp.find((c: any) => c.champ === "ordonnateur");
    expect(ord.completude).toBe(92);
    expect(ord.degrade).toBe(true);
    expect(b.parChamp.find((c: any) => c.champ === "devise").degrade).toBe(false);
    expect(b.champsDegrades).toEqual(["ordonnateur"]);
    expect(b.scenariosDegrades).toEqual(["CB-03", "SF-04"]);
    expect(b.degraded).toBe(true);
    // « Jamais silencieux » : signal DQ_DEGRADED visible dans l'inbox, Niveau 1.
    expect(b.signal).toBeTruthy();
    const row = await prisma.amlGapSignal.findFirst({ where: { tenantId: T, id: b.signal.id } });
    expect(row!.scenarioCode).toBe("GV-03");
    expect(row!.niveau).toBe(1);
    const evt = await prisma.domainEvent.count({ where: { tenantId: T, type: "dq.degraded" } });
    expect(evt).toBeGreaterThanOrEqual(1);
    console.log("DQ-1 PASS — ordonnateur 92% < 98% → DQ_DEGRADED, scénarios", b.scenariosDegrades.join(","));
  });

  it("complétude au-dessus du seuil → aucune dégradation, aucun signal (mais rapport rendu)", async () => {
    const complet = Array.from({ length: 100 }, (_, i) => ({ id: `x-${i}`, devise: "CHF", ordonnateur: `ORD-${i}` }));
    const nAvant = await prisma.amlGapSignal.count({ where: { tenantId: T } });
    const r = await request(http).post("/v1/aml/eval/dq").set(bearer(T, U, "CO"))
      .send({ flux: complet, champsCritiques: ["ordonnateur", "devise"] });
    expect(r.body.degraded).toBe(false);
    expect(r.body.signal).toBeNull();
    expect(r.body.parChamp.every((c: any) => c.completude === 100)).toBe(true);
    const nApres = await prisma.amlGapSignal.count({ where: { tenantId: T } });
    expect(nApres).toBe(nAvant);
    console.log("DQ-2 PASS — 100% complet, aucun signal, rapport rendu");
  });

  it("idempotence : même lot dégradé rejoué → un seul signal (R48)", async () => {
    const body = { flux, champsCritiques: ["ordonnateur"], dependances: { ordonnateur: ["SF-04"] } };
    const a = await request(http).post("/v1/aml/eval/dq").set(bearer(T, U, "CO")).send(body);
    const b = await request(http).post("/v1/aml/eval/dq").set(bearer(T, U, "CO")).send(body);
    expect(a.body.signal.id).toBe(b.body.signal.id);
    console.log("DQ-3 PASS — idempotent");
  });

  it("garde : champsCritiques vide → 400 explicite", async () => {
    const r = await request(http).post("/v1/aml/eval/dq").set(bearer(T, U, "CO")).send({ flux, champsCritiques: [] });
    expect(r.status).toBe(400);
    console.log("DQ-4 PASS — champsCritiques vide → 400");
  });
});
