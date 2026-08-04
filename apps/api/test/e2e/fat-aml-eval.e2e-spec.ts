/**
 * FAT — Worker aml-eval : backtest du corpus GT (blocs 50–60) contre le VRAI backend + Postgres +
 * le moteur de détection partagé (src/aml). Sémantique du corpus (décision 5) : un cas TP ET un cas
 * FP DOIVENT déclencher → rappel attendu 100 % sur les blocs implémentés. Un rappel < 100 % = une
 * régression de détecteur ou de paramètre. Bloc 61 (2G) DÉFÉRÉ (observation absente du corpus).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT AML eval — worker backtest (backend + Postgres + moteur réels)", () => {
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

  it("backtest : rappel 100 % sur les blocs 50–60, bloc 61 différé, aucune règle non mappée", async () => {
    const r = await request(http).post("/v1/aml/eval/backtest").set(bearer(T, U, "CO"));
    expect(r.status).toBe(201);
    const b = r.body;
    expect(b.corpus).toBe(130);
    expect(b.evaluated + b.deferred2G).toBe(130);   // tout cas est évalué OU différé (2G)
    expect(b.deferred2G).toBeGreaterThan(0);          // bloc 61 (AN-*) présent et différé
    expect(b.unmapped).toBe(0);                       // tout scénario 50–60 a un détecteur
    expect(b.misses).toEqual([]);                     // corpus : TP ET FP déclenchent (recall 100 %)
    expect(b.recall).toBe(1);
    // Rappel par famille : 100 % partout où des cas ont été évalués.
    for (const [fam, s] of Object.entries<any>(b.parFamille)) {
      expect(s.recall).toBe(1);
      expect(s.raised).toBe(s.total);
      expect(fam).not.toBe("AN");                     // la famille 2G n'apparaît pas (différée)
    }
    console.log("EVAL-1 PASS — rappel", (b.recall * 100).toFixed(0) + "%", "évalués", b.evaluated, "différés 2G", b.deferred2G);
  });

  it("mesure, pas coercition (R39) : le backtest N'INONDE PAS l'inbox des signaux", async () => {
    const n = await prisma.amlGapSignal.count({ where: { tenantId: T } });
    expect(n).toBe(0);                                // aucun signal persisté par le backtest
    // …mais l'exécution est tracée (événement de mesure auditable).
    const evt = await prisma.domainEvent.count({ where: { tenantId: T, type: "aml.eval.completed" } });
    expect(evt).toBeGreaterThanOrEqual(1);
    console.log("EVAL-2 PASS — 0 signal inbox, événement aml.eval.completed émis");
  });

  it("garde : backtest sans corpus semé → 400 explicite (pas de rapport silencieux vide)", async () => {
    const T2 = randomUUID();
    await seedTenantClient(prisma, T2, randomUUID());
    const r = await request(http).post("/v1/aml/eval/backtest").set(bearer(T2, U, "CO"));
    expect(r.status).toBe(400);
    expect(String(r.body.message)).toContain("corpus GT non semé");
    console.log("EVAL-3 PASS — corpus vide → 400 explicite");
  });
});
