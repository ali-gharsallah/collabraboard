/**
 * FAT — Pont Analytique 2G (bloc 61, R399–R403) : AML gap × moteur CPSI Python, backend RÉEL.
 *
 * Le détecteur statistique n'existe QUE dans le service CPSI Python (décision 4 du journal
 * 2026-08-04). Ce test exerce le PONT de bout en bout contre le VRAI backend, le VRAI Postgres
 * (journal + signal append-only, RLS) et le VRAI moteur Python (shell-out NDJSON) :
 *   POST /v1/aml/signals/evaluate-2g { scenarioCode, clientId, observation } →
 *     la porte délègue à CPSI (aml_gap_2g), CPSI mesure l'observation contre les seuils tenant
 *     (R-Q), et — si le signal est levé — la porte PERSISTE un signal AML gap (chemin commun).
 * R44/R39 : CPSI mesure et explique, Nest orchestre, l'humain qualifie — rien n'est décidé ici.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT AML gap 2G — pont bloc 61 (backend + moteur CPSI Python réels)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const U = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("AN-01 déviant : CPSI mesure, le signal est levé et PERSISTÉ (append-only, explicable R44)", async () => {
    const clientId = randomUUID();
    const r = await request(http).post("/v1/aml/signals/evaluate-2g").set(bearer(T, U, "CO"))
      .send({ scenarioCode: "AN-01", clientId,
        observation: { value: 40, group_values: [10, 11, 9, 10, 12, 8, 11, 10, 9, 11] } });
    expect(r.status).toBe(201);
    expect(r.body.detection.raised).toBe(true);
    expect(r.body.detection.ruleRef).toBe("R399");
    expect(r.body.detection.signal).toBe("PEER_DEVIATION");
    expect(r.body.detection.niveau).toBe(2);
    expect(r.body.detection.explanation.length).toBeGreaterThan(0);       // R44 : explicable
    expect(r.body.detection.payload.zscore).toBeGreaterThanOrEqual(3.5);  // seuil R-Q tenant
    // Signal PERSISTÉ (bloc 61 emprunte le chemin commun des blocs 50–60).
    expect(r.body.signal).toBeTruthy();
    const row = await prisma.amlGapSignal.findFirst({ where: { tenantId: T, id: r.body.signal.id } });
    expect(row).toBeTruthy();
    expect(row!.scenarioCode).toBe("AN-01");
    expect(row!.ruleRef).toBe("R399");
    expect(row!.status).toBe("NEW");
    console.log("2G-1 PASS — signal", r.body.signal.id, "z", r.body.detection.payload.zscore);
  });

  it("AN-05 cohérent : CPSI mesure, AUCUN signal levé, AUCUNE persistance (le normal ne déclenche pas)", async () => {
    const clientId = randomUUID();
    const nAvant = await prisma.amlGapSignal.count({ where: { tenantId: T } });
    const r = await request(http).post("/v1/aml/signals/evaluate-2g").set(bearer(T, U, "CO"))
      .send({ scenarioCode: "AN-05", clientId,
        observation: { observed_income: 12500, declared_income: 12000 } });
    expect(r.status).toBe(201);
    expect(r.body.detection.raised).toBe(false);
    expect(r.body.detection.explanation).toBe("");                        // pas de signal → pas d'explication
    expect(r.body.signal).toBeNull();
    const nApres = await prisma.amlGapSignal.count({ where: { tenantId: T } });
    expect(nApres).toBe(nAvant);                                          // rien persisté
    console.log("2G-2 PASS — non déclenché, écart", r.body.detection.payload.ecartPct, "%");
  });

  it("idempotence : le même déclenchement 2G rejoué ne crée pas de doublon (R48)", async () => {
    const clientId = randomUUID();
    const obs = { observation: { value: 50, group_values: [10, 11, 9, 10, 12, 8, 11, 10, 9, 11] } };
    const a = await request(http).post("/v1/aml/signals/evaluate-2g").set(bearer(T, U, "CO"))
      .send({ scenarioCode: "AN-01", clientId, ...obs });
    const b = await request(http).post("/v1/aml/signals/evaluate-2g").set(bearer(T, U, "CO"))
      .send({ scenarioCode: "AN-01", clientId, ...obs });
    expect(a.body.signal.id).toBe(b.body.signal.id);                      // même signal, aucun doublon
    const n = await prisma.amlGapSignal.count({ where: { tenantId: T, clientId, scenarioCode: "AN-01" } });
    expect(n).toBe(1);
    console.log("2G-3 PASS — idempotent, 1 signal pour 2 appels");
  });

  it("garde d'invariant : un scénario des blocs 50–60 est REFUSÉ ici (il s'évalue en Nest, pas via CPSI)", async () => {
    const r = await request(http).post("/v1/aml/signals/evaluate-2g").set(bearer(T, U, "CO"))
      .send({ scenarioCode: "SF-01", clientId: randomUUID(),
        observation: { value: 40, group_values: [1, 2, 3] } });
    expect(r.status).toBe(400);
    expect(String(r.body.message)).toContain("Analytique 2G");
    console.log("2G-4 PASS — SF-01 refusé (décision 4 : blocs 50–60 en Nest, bloc 61 en CPSI)");
  });

  it("observation incomplète : CPSI refuse TYPÉ (default-deny), pas de 500 opaque, rien persisté", async () => {
    const nAvant = await prisma.amlGapSignal.count({ where: { tenantId: T } });
    const r = await request(http).post("/v1/aml/signals/evaluate-2g").set(bearer(T, U, "CO"))
      .send({ scenarioCode: "AN-01", clientId: randomUUID(), observation: { value: 40 } }); // group_values manquant
    expect(r.status).toBe(400);
    const nApres = await prisma.amlGapSignal.count({ where: { tenantId: T } });
    expect(nApres).toBe(nAvant);
    console.log("2G-5 PASS — observation incomplète → 4xx typé, rien persisté");
  });
});
