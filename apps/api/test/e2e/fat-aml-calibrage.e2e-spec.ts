/**
 * FAT — Revue annuelle de calibrage (GV-04, R377) contre le VRAI backend + Postgres. Consolide la
 * couverture (matrice typologies × scénarios), la performance (corpus GT + signaux live) et les
 * écarts (angles morts ; placeholders documentés laissés vides par la spec — jamais comblés). R44 :
 * le système consolide, l'humain vise (four-eyes) et archive.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT AML calibrage — revue annuelle GV-04 (backend + Postgres réels)", () => {
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

  it("consolide couverture 64 scénarios / 12 familles, matrice GAFI+OBA-FINMA, événement émis", async () => {
    const r = await request(http).post("/v1/aml/eval/calibrage-annuel").set(bearer(T, U, "MLRO"));
    expect(r.status).toBe(201);
    const b = r.body;
    expect(b.matriceReference).toBe("GAFI+OBA-FINMA");
    expect(b.couverture.totalScenarios).toBe(64);
    expect(b.couverture.familles).toBe(12);
    expect(b.couverture.couverts).toBe(64);            // chaque scénario a >= 1 cas GT réel
    expect(b.couverture.sansMatiere).toBe(0);
    expect(b.anglesMorts).toEqual([]);
    expect(b.visa.requis).toBe(true);
    const evt = await prisma.domainEvent.count({ where: { tenantId: T, type: "tuning.calibrage.annuel" } });
    expect(evt).toBeGreaterThanOrEqual(1);
    console.log("CAL-1 PASS — couverts", b.couverture.couverts + "/" + b.couverture.totalScenarios, b.couverture.familles, "familles");
  });

  it("surface le placeholder documenté (GV-04 FP laissé vide par la spec) — jamais compté comme perf", async () => {
    const r = await request(http).post("/v1/aml/eval/calibrage-annuel").set(bearer(T, U, "MLRO"));
    const gv04 = r.body.placeholdersDocumentes.find((p: any) => p.code === "GV-04");
    expect(gv04).toBeTruthy();
    expect(gv04.count).toBe(1);
    // Le placeholder n'est pas compté dans la performance FP de GV-04.
    const s = r.body.scenarios.find((x: any) => x.code === "GV-04");
    expect(s.gt.placeholders).toBe(1);
    expect(s.gt.fp).toBe(0);                            // le seul FP de GV-04 est le placeholder vide
    console.log("CAL-2 PASS — placeholder GV-04 surfacé, hors performance");
  });

  it("performance live : un signal qualifié TP remonte dans la revue", async () => {
    const clientId = randomUUID();
    // Déclenche SF-01 puis qualifie TP.
    const ev = await request(http).post("/v1/aml/eval/client").set(bearer(T, U, "CO"))
      .send({ clientId, scenarios: ["SF-01"], facts: { matchScore: 91 } });
    await request(http).post(`/v1/aml/signals/${ev.body.signals[0].id}/qualify`).set(bearer(T, U, "MLRO"))
      .send({ outcome: "TP", motif: "origine politique confirmée" }).expect(201);
    const r = await request(http).post("/v1/aml/eval/calibrage-annuel").set(bearer(T, U, "MLRO"));
    const sf01 = r.body.scenarios.find((x: any) => x.code === "SF-01");
    expect(sf01.live.tp).toBeGreaterThanOrEqual(1);
    expect(r.body.parFamille.SF.liveTp).toBeGreaterThanOrEqual(1);
    console.log("CAL-3 PASS — SF-01 live TP", sf01.live.tp);
  });

  it("RBAC : un rôle non compliance (RM) ne peut pas générer la revue (R13)", async () => {
    const r = await request(http).post("/v1/aml/eval/calibrage-annuel").set(bearer(T, U, "RM"));
    expect(r.status).toBe(400);
    console.log("CAL-4 PASS — RM refusé");
  });
});
