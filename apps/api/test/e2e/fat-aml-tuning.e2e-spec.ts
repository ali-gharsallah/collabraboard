/**
 * FAT — Gouvernance du tuning : backtesting PAR VERSION (GV-02, R375) contre le VRAI backend +
 * Postgres + moteur. Mesure l'impact d'un changement de seuils sur le rappel AVANT application :
 * une version candidate qui manque des TP historiques est SIGNALÉE (rollback proposé) ; une version
 * neutre ou plus fine ne dégrade pas. R44/R39 : le moteur mesure et propose, l'humain décide.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT AML tuning — backtest par version (backend + Postgres + moteur réels)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const U = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, randomUUID());
    await request(http).post("/v1/aml/ground-truth/seed").set(bearer(T, U, "CO")).expect(201);
  });
  afterAll(async () => { await app.close(); });

  it("version qui DÉGRADE le rappel (seuil PEP relevé au-delà des cas) → rollback proposé (R375)", async () => {
    // Le seuil en vigueur seuil_match_pep_flux = 78 ; les cas SF-01 déclenchent à un score ~94.
    // Le porter à 95 fait manquer ces cas → perte de rappel détectée.
    const r = await request(http).post("/v1/aml/eval/backtest-version").set(bearer(T, U, "CO"))
      .send({ overrides: { seuil_match_pep_flux: 95 } });
    expect(r.status).toBe(201);
    const b = r.body;
    expect(b.scenariosTouches).toContain("SF-01");
    expect(b.recallAfter).toBeLessThan(b.recallBefore);
    expect(b.degradation).toBe(true);
    expect(b.rollbackPropose).toBe(true);                       // R375 : dégradation → rollback proposé
    expect(b.regressions.some((x: any) => x.scenarioCode === "SF-01")).toBe(true);
    // Trace de gouvernance : la comparaison est un événement auditable.
    const evt = await prisma.domainEvent.count({ where: { tenantId: T, type: "aml.eval.version_compared" } });
    expect(evt).toBeGreaterThanOrEqual(1);
    console.log("TUNE-1 PASS — rappel", (b.recallBefore * 100).toFixed(0), "→", (b.recallAfter * 100).toFixed(0), "% rollback proposé");
  });

  it("version NEUTRE (seuil abaissé) → aucune dégradation, aucun rollback", async () => {
    const r = await request(http).post("/v1/aml/eval/backtest-version").set(bearer(T, U, "CO"))
      .send({ overrides: { seuil_match_pep_flux: 50 } });      // en-deçà des scores des cas → rien ne change
    const b = r.body;
    expect(b.degradation).toBe(false);
    expect(b.rollbackPropose).toBe(false);
    expect(b.regressions).toEqual([]);
    expect(b.recallAfter).toBe(b.recallBefore);
    console.log("TUNE-2 PASS — seuil abaissé, rappel stable", (b.recallAfter * 100).toFixed(0) + "%");
  });

  it("garde : overrides vide → 400 explicite (pas de comparaison vide silencieuse)", async () => {
    const r = await request(http).post("/v1/aml/eval/backtest-version").set(bearer(T, U, "CO")).send({ overrides: {} });
    expect(r.status).toBe(400);
    expect(String(r.body.message)).toContain("overrides requis");
    console.log("TUNE-3 PASS — overrides vide → 400");
  });
});
