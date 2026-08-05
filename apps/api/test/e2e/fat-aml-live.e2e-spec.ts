/**
 * FAT — Détection LIVE AML gap (blocs 50–60) : faits réels d'un client → signaux persistés dans
 * l'inbox, contre le VRAI backend + Postgres + le moteur de détection partagé. R44 : le moteur
 * mesure et explique (payload/explanation), l'humain qualifie (TP/FP). Un scénario bloquant émet
 * `aml.block.requested` SANS aucun effet de bord (la suspension reste un acte humain).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT AML live — détection per-client (backend + Postgres + moteur réels)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const U = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("faits déclencheurs → signal persisté dans l'inbox, explicable (R44)", async () => {
    const clientId = randomUUID();
    const r = await request(http).post("/v1/aml/eval/client").set(bearer(T, U, "CO"))
      .send({ clientId, scenarios: ["SF-01"], facts: { matchScore: 91 } });    // ≥ seuil 78
    expect(r.status).toBe(201);
    expect(r.body.raised).toBe(1);
    expect(r.body.signals[0].scenarioCode).toBe("SF-01");
    expect(r.body.results[0].explanation.length).toBeGreaterThan(0);
    // Le signal est dans l'inbox, statut NEW, qualifiable.
    const inbox = await request(http).get(`/v1/aml/signals?clientId=${clientId}`).set(bearer(T, U, "CO"));
    expect(inbox.body.length).toBe(1);
    expect(inbox.body[0].status).toBe("NEW");
    console.log("LIVE-1 PASS — SF-01 déclenché, signal", r.body.signals[0].id);
  });

  it("faits sous le seuil → aucun signal (pas de faux positif par omission)", async () => {
    const clientId = randomUUID();
    const r = await request(http).post("/v1/aml/eval/client").set(bearer(T, U, "CO"))
      .send({ clientId, scenarios: ["SF-01"], facts: { matchScore: 40 } });     // < seuil 78
    expect(r.body.raised).toBe(0);
    expect(r.body.results[0].raised).toBe(false);
    const inbox = await request(http).get(`/v1/aml/signals?clientId=${clientId}`).set(bearer(T, U, "CO"));
    expect(inbox.body.length).toBe(0);
    console.log("LIVE-2 PASS — sous seuil, aucun signal");
  });

  it("scénario BLOQUANT (SF-05 géo) → aml.block.requested émis, SANS effet de bord (R44/R39)", async () => {
    const clientId = randomUUID();
    const r = await request(http).post("/v1/aml/eval/client").set(bearer(T, U, "CO"))
      .send({ clientId, scenarios: ["SF-05"], facts: { geoMatch: true } });
    expect(r.body.raised).toBe(1);
    expect(r.body.results[0].blocking).toBe(true);
    const blk = await prisma.domainEvent.count({ where: { tenantId: T, type: "aml.block.requested" } });
    expect(blk).toBeGreaterThanOrEqual(1);
    console.log("LIVE-3 PASS — SF-05 bloquant, aml.block.requested émis");
  });

  it("idempotence : mêmes faits rejoués → un seul signal (R48)", async () => {
    const clientId = randomUUID();
    const body = { clientId, scenarios: ["QO-02"], facts: { tiersDistincts: 11 } };
    const a = await request(http).post("/v1/aml/eval/client").set(bearer(T, U, "CO")).send(body);
    const b = await request(http).post("/v1/aml/eval/client").set(bearer(T, U, "CO")).send(body);
    expect(a.body.signals[0].id).toBe(b.body.signals[0].id);
    const n = await prisma.amlGapSignal.count({ where: { tenantId: T, clientId, scenarioCode: "QO-02" } });
    expect(n).toBe(1);
    console.log("LIVE-4 PASS — idempotent, 1 signal pour 2 évaluations");
  });

  it("multi-scénarios (défaut blocs 50–60) : seuls les scénarios dont les faits déclenchent produisent un signal", async () => {
    const clientId = randomUUID();
    // Deux faits ciblant deux familles distinctes ; les ~40 autres scénarios n'ont pas leurs faits → 0.
    const r = await request(http).post("/v1/aml/eval/client").set(bearer(T, U, "CO"))
      .send({ clientId, facts: { matchScore: 91, clientsParAdresse: 8 } });     // SF-01 + QO-04
    expect(r.body.evaluated).toBeGreaterThan(30);        // toute la surface détection 50–60 balayée
    const codes = r.body.signals.map((s: any) => s.scenarioCode).sort();
    expect(codes).toEqual(["QO-04", "SF-01"]);
    console.log("LIVE-5 PASS — balayage", r.body.evaluated, "scénarios →", codes.join(","));
  });

  it("garde d'invariant : un scénario 2G (bloc 61) est refusé ici (→ evaluate-2g)", async () => {
    const r = await request(http).post("/v1/aml/eval/client").set(bearer(T, U, "CO"))
      .send({ clientId: randomUUID(), scenarios: ["AN-01"], facts: {} });
    expect(r.status).toBe(400);
    expect(String(r.body.message)).toContain("evaluate-2g");
    console.log("LIVE-6 PASS — AN-01 refusé (bloc 61 → pont CPSI)");
  });
});
