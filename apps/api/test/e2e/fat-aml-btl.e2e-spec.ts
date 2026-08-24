/**
 * FAT — Campagne Below-The-Line (GV-01, R374) contre le VRAI backend + Postgres. Échantillonne les
 * transactions JUSTE SOUS le seuil d'un scénario pour revue Compliance : bande = [80 %, 100 %) du
 * seuil, taux d'échantillon tenant, échantillon STRATIFIÉ DÉTERMINISTE. R44/R39 : la campagne
 * propose un échantillon, l'humain revoit ; un TP sous seuil ⇒ proposition de baisse (backtest-version).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT AML BTL — campagne below-the-line (backend + Postgres réels)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const U = randomUUID();
  // Seuil SF-01 = seuil_match_pep_flux = 78 ; bande 80–100 % ⇒ [62.4, 78).
  const enBande = Array.from({ length: 100 }, (_, i) => ({ ref: `tx-in-${i}`, metric: 63 + i * 0.14 })); // 63 … ~76.9
  const dessus = Array.from({ length: 10 }, (_, i) => ({ ref: `tx-hi-${i}`, metric: 78 + i })); // ≥ seuil : déjà en alerte
  const dessous = Array.from({ length: 10 }, (_, i) => ({ ref: `tx-lo-${i}`, metric: 40 + i })); // < bande

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("échantillonne SEULEMENT la bande [80 %, seuil), taille = ceil(inBand × taux)", async () => {
    const r = await request(http).post("/v1/aml/eval/btl").set(bearer(T, U, "CO"))
      .send({ scenarioCode: "SF-01", population: [...enBande, ...dessus, ...dessous] });
    expect(r.status).toBe(201);
    const b = r.body;
    expect(b.seuil).toBe(78);
    expect(b.bandePct).toEqual([80, 100]);
    expect(b.populationTotal).toBe(120);
    expect(b.populationInBand).toBe(100);                     // ni ≥ seuil ni < 80 %
    expect(b.sampleSize).toBe(2);                             // ceil(100 × 2 %)
    expect(b.sample.length).toBe(2);
    expect(b.sample.every((x: any) => x.metric >= b.bande.low && x.metric < b.bande.high)).toBe(true);
    // Trace de gouvernance auditable.
    const evt = await prisma.domainEvent.count({ where: { tenantId: T, type: "tuning.btl.campagne" } });
    expect(evt).toBeGreaterThanOrEqual(1);
    console.log("BTL-1 PASS — inBand", b.populationInBand, "échantillon", b.sampleSize, b.sample.map((x: any) => x.ref).join(","));
  });

  it("déterministe : deux campagnes sur la même population → le même échantillon", async () => {
    const send = () => request(http).post("/v1/aml/eval/btl").set(bearer(T, U, "CO"))
      .send({ scenarioCode: "SF-01", population: enBande });
    const a = await send(); const b = await send();
    expect(a.body.sample.map((x: any) => x.ref)).toEqual(b.body.sample.map((x: any) => x.ref));
    console.log("BTL-2 PASS — échantillon reproductible", a.body.sample.map((x: any) => x.ref).join(","));
  });

  it("bande vide → échantillon vide (rien à revoir sous la ligne)", async () => {
    const r = await request(http).post("/v1/aml/eval/btl").set(bearer(T, U, "CO"))
      .send({ scenarioCode: "SF-01", population: dessous });   // tous < 80 % du seuil
    expect(r.body.populationInBand).toBe(0);
    expect(r.body.sampleSize).toBe(0);
    expect(r.body.sample).toEqual([]);
    console.log("BTL-3 PASS — hors bande → échantillon vide");
  });

  it("garde : un scénario 2G (bloc 61) est refusé (campagne BTL côté CPSI)", async () => {
    const r = await request(http).post("/v1/aml/eval/btl").set(bearer(T, U, "CO"))
      .send({ scenarioCode: "AN-01", population: enBande });
    expect(r.status).toBe(400);
    console.log("BTL-4 PASS — AN-01 refusé");
  });
});
