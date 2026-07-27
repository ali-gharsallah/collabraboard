/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 14 (MOD-75 Business Trip, R222→R230).
 * Exécutés contre le VRAI backend. Spec-first depuis le Gherkin BT-01..10 (ratifié « OK pour R222..R238 »).
 * Cycle événementiel (R222) ; avis cross-border qui ne décide pas (R223) ; signaux KYC/certif (R224/R228/R237,
 * cert résolue depuis MOD-43 à la date du voyage) ; visa uniforme R15 + exclusion R13 (R225) ; contact reports
 * mesurés non coercés (R226/R39) ; rejeu grandfathering (R229) ; révision chaînée (R230).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT Vague 14 — MOD-75 Business Trip (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const A = randomUUID();
  const T = randomUUID();                     // le voyageur
  const DIR = randomUUID(), SUP = randomUUID(), COMP = randomUUID();

  const setS = (s: any) => prisma.tenant.update({ where: { id: A }, data: { settings: s } });
  const mkClient = async (id: string) => { await seedTenantClient(prisma, A, id); return id; };
  const mkKyc = (clientId: string, status: string) => prisma.kycFile.create({ data: {
    tenantId: A, clientId, code: `K-${randomUUID().slice(0, 8)}`, year: 2026, countryCode: "CH",
    sequence: 1, workflow: "CDD", riskScore: 10, riskLevel: "LOW", status: status as any, createdBy: T } });

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, A, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("BT-01 [R222] cycle de vie événementiel : DRAFT → PENDING_APPROVAL + TRIP_SUBMITTED", async () => {
    await setS({ tripApprovalMatrix: ["DIR"] });
    const trip = (await request(http).post("/v1/trips").set(bearer(A, T, "RM"))
      .send({ destinations: [], clients: [], dateStart: "2026-08-01", dateEnd: "2026-08-05", purpose: "revue" })).body;
    expect(trip.status).toBe("DRAFT");
    const sub = await request(http).post(`/v1/trips/${trip.id}/submit`).set(bearer(A, T, "RM"));
    expect(sub.status).toBe(201);
    expect(sub.body.status).toBe("PENDING_APPROVAL");
    const ev = await prisma.domainEvent.findMany({ where: { tenantId: A, type: "trip.submitted", aggregateId: trip.id } });
    expect(ev.length).toBe(1);
    console.log("BT-01 PASS — soumission DRAFT → PENDING_APPROVAL, événement TRIP_SUBMITTED");
  });

  it("BT-02 [R223] pré-contrôle cross-border par destination ; l'avis ne décide pas", async () => {
    await setS({ tripApprovalMatrix: ["DIR"], tripCrossBorderReferentiel: [{ jurisdiction: "SA", activite: "sollicitation", verdict: "INTERDITE", depuisLe: "2026-01-01" }] });
    const trip = (await request(http).post("/v1/trips").set(bearer(A, T, "RM"))
      .send({ destinations: ["FR", "SA"], clients: [], dateStart: "2026-08-01", dateEnd: "2026-08-05" })).body;
    await request(http).post(`/v1/trips/${trip.id}/submit`).set(bearer(A, T, "RM")).expect(201);
    const g = await request(http).get(`/v1/trips/${trip.id}`).set(bearer(A, DIR, "DIR"));
    const sa = g.body.advisories.find((a: any) => a.jurisdiction === "SA");
    expect(sa).toMatchObject({ activite: "sollicitation", verdict: "INTERDITE" });
    expect(g.body.status).toBe("PENDING_APPROVAL");                       // l'avis ne décide pas
    console.log("BT-02 PASS — avis SA sollicitation=INTERDITE attaché, statut inchangé");
  });

  it("BT-03 [R224] client sans KYC approuvé — INFORMATIF : signal, approbation possible", async () => {
    await setS({ tripApprovalMatrix: ["DIR"], tripKycCheckSeverity: "INFORMATIF" });
    const c = await mkClient(randomUUID()); await mkKyc(c, "IN_PROGRESS");
    const trip = (await request(http).post("/v1/trips").set(bearer(A, T, "RM"))
      .send({ destinations: [], clients: [c], dateStart: "2026-08-01", dateEnd: "2026-08-05" })).body;
    await request(http).post(`/v1/trips/${trip.id}/submit`).set(bearer(A, T, "RM")).expect(201);
    const g = await request(http).get(`/v1/trips/${trip.id}`).set(bearer(A, DIR, "DIR"));
    expect(g.body.signals.some((s: any) => s.type === "KYC_NOT_APPROVED")).toBe(true);
    const visa = await request(http).post(`/v1/trips/${trip.id}/visa`).set(bearer(A, DIR, "DIR")).send({ role: "DIR" });
    expect(visa.status).toBe(201);
    expect(visa.body.status).toBe("APPROVED");                           // INFORMATIF ne bloque pas
    console.log("BT-03 PASS — signal KYC_NOT_APPROVED (INFORMATIF), approbation possible");
  });

  it("BT-04 [R224] client sans KYC approuvé — BLOQUANT : le visa échoue", async () => {
    await setS({ tripApprovalMatrix: ["DIR"], tripKycCheckSeverity: "BLOQUANT_APPROBATION" });
    const c = await mkClient(randomUUID()); await mkKyc(c, "IN_PROGRESS");
    const trip = (await request(http).post("/v1/trips").set(bearer(A, T, "RM"))
      .send({ destinations: [], clients: [c], dateStart: "2026-08-01", dateEnd: "2026-08-05" })).body;
    await request(http).post(`/v1/trips/${trip.id}/submit`).set(bearer(A, T, "RM")).expect(201);
    const visa = await request(http).post(`/v1/trips/${trip.id}/visa`).set(bearer(A, DIR, "DIR")).send({ role: "DIR" });
    expect(visa.status).toBe(400);
    expect(JSON.stringify(visa.body)).toContain("TRIP_KYC_NOT_APPROVED");
    console.log("BT-04 PASS — KYC non approuvé BLOQUANT → visa refusé (TRIP_KYC_NOT_APPROVED)");
  });

  it("BT-05 [R225/R15] visa uniforme + matrice tenant : 2 visas, APPROVED quand les deux sont signés", async () => {
    await setS({ tripApprovalMatrix: ["SUPERIEUR"], tripJuridictionsRisque: ["SA"] });
    const trip = (await request(http).post("/v1/trips").set(bearer(A, T, "RM"))
      .send({ destinations: ["SA"], clients: [], dateStart: "2026-08-01", dateEnd: "2026-08-05" })).body;
    await request(http).post(`/v1/trips/${trip.id}/submit`).set(bearer(A, T, "RM")).expect(201);
    const g = await request(http).get(`/v1/trips/${trip.id}`).set(bearer(A, DIR, "DIR"));
    expect(g.body.visas.length).toBe(2);                                  // SUPERIEUR + COMPLIANCE (destination à risque)
    const v1 = await request(http).post(`/v1/trips/${trip.id}/visa`).set(bearer(A, SUP, "SUPERIEUR")).send({ role: "SUPERIEUR" });
    expect(v1.body.status).toBe("PENDING_APPROVAL");                      // encore 1 visa
    const v2 = await request(http).post(`/v1/trips/${trip.id}/visa`).set(bearer(A, COMP, "COMPLIANCE")).send({ role: "COMPLIANCE" });
    expect(v2.body.status).toBe("APPROVED");
    console.log("BT-05 PASS — 2 visas (SUPERIEUR+COMPLIANCE), APPROVED aux deux signatures");
  });

  it("BT-06 [R225/R13] auto-approbation interdite", async () => {
    await setS({ tripApprovalMatrix: ["SUPERIEUR"] });
    const trip = (await request(http).post("/v1/trips").set(bearer(A, T, "SUPERIEUR"))
      .send({ destinations: [], clients: [], dateStart: "2026-08-01", dateEnd: "2026-08-05" })).body;
    await request(http).post(`/v1/trips/${trip.id}/submit`).set(bearer(A, T, "SUPERIEUR")).expect(201);
    const self = await request(http).post(`/v1/trips/${trip.id}/visa`).set(bearer(A, T, "SUPERIEUR")).send({ role: "SUPERIEUR" });
    expect(self.status).toBe(403);
    expect(JSON.stringify(self.body)).toContain("TRIP_SELF_APPROVAL_FORBIDDEN");
    console.log("BT-06 PASS — le voyageur ne vise pas son propre voyage (R13)");
  });

  it("BT-07 [R226/R39] contact reports mesurés, jamais coercés", async () => {
    await setS({ tripApprovalMatrix: ["DIR"], tripContactReportDeadlineDays: 5 });
    const c1 = await mkClient(randomUUID()), c2 = await mkClient(randomUUID()), c3 = await mkClient(randomUUID());
    const trip = (await request(http).post("/v1/trips").set(bearer(A, T, "RM"))
      .send({ destinations: [], clients: [c1, c2, c3], dateStart: "2026-06-01", dateEnd: "2026-06-05" })).body;
    // un seul contact report produit (pour c1), après le voyage
    await prisma.crmContact.create({ data: { tenantId: A, clientId: c1, type: "REVUE", contenu: {}, origine: "MANUEL", par: T } });
    const m = await request(http).post(`/v1/trips/${trip.id}/contact-reports/mesurer`).set(bearer(A, T, "RM"));
    expect(m.body.manquants.length).toBe(2);                              // c2 et c3
    expect(m.body.bloque).toBe(false);
    console.log(`BT-07 PASS — ${m.body.manquants.length} reports manquants notifiés, rien n'est bloqué`);
  });

  it("BT-08 [R228/R237] certification expirée à la date du voyage", async () => {
    await setS({ tripApprovalMatrix: ["DIR"], tripCertificationRequise: [{ jurisdiction: "AE", code: "CROSS_BORDER_AE" }] });
    await request(http).post("/v1/formations/certifications").set(bearer(A, DIR, "CO"))
      .send({ userId: T, code: "CROSS_BORDER_AE", obtenueLe: "2025-09-01", expireLe: "2026-09-01" }).expect(201);
    const trip = (await request(http).post("/v1/trips").set(bearer(A, T, "RM"))
      .send({ destinations: ["AE"], clients: [], dateStart: "2026-09-10", dateEnd: "2026-09-15" })).body;
    await request(http).post(`/v1/trips/${trip.id}/submit`).set(bearer(A, T, "RM")).expect(201);
    const g = await request(http).get(`/v1/trips/${trip.id}`).set(bearer(A, DIR, "DIR"));
    expect(g.body.signals.some((s: any) => s.type === "CERTIFICATION_EXPIRED_AT_TRIP_DATE")).toBe(true);
    console.log("BT-08 PASS — certification CROSS_BORDER_AE expirée au 2026-09-10 → signal");
  });

  it("BT-09 [R229] rejeu avec grandfathering du référentiel", async () => {
    await setS({ tripApprovalMatrix: ["DIR"], tripCrossBorderReferentiel: [
      { jurisdiction: "SA", activite: "sollicitation", verdict: "SOUMISE_A_LICENCE", depuisLe: "2026-01-01" },   // V1
      { jurisdiction: "SA", activite: "sollicitation", verdict: "INTERDITE", depuisLe: "2026-06-01" },           // V2 (plus stricte)
    ] });
    const trip = (await request(http).post("/v1/trips").set(bearer(A, T, "RM"))
      .send({ destinations: ["SA"], clients: [], dateStart: "2026-08-01", dateEnd: "2026-08-05" })).body;
    await request(http).post(`/v1/trips/${trip.id}/submit`).set(bearer(A, T, "RM")).expect(201);
    const rejeu = await request(http).get(`/v1/trips/${trip.id}?asOf=2026-03-01`).set(bearer(A, DIR, "DIR"));
    const sa = rejeu.body.advisories.find((a: any) => a.jurisdiction === "SA" && a.activite === "sollicitation");
    expect(sa.verdict).toBe("SOUMISE_A_LICENCE");                         // la version d'alors (V1)
    expect(sa.referentielVersion).toBe("2026-01-01");
    console.log("BT-09 PASS — rejeu au 2026-03-01 : avis V1 (SOUMISE_A_LICENCE), grandfathering respecté");
  });

  it("BT-10 [R230] révision chaînée après approbation ; V1 intacte", async () => {
    await setS({ tripApprovalMatrix: ["DIR"] });
    const v1 = (await request(http).post("/v1/trips").set(bearer(A, T, "RM"))
      .send({ destinations: ["FR"], clients: [], dateStart: "2026-08-01", dateEnd: "2026-08-05" })).body;
    await request(http).post(`/v1/trips/${v1.id}/submit`).set(bearer(A, T, "RM")).expect(201);
    await request(http).post(`/v1/trips/${v1.id}/visa`).set(bearer(A, DIR, "DIR")).send({ role: "DIR" }).expect(201);
    const v2 = await request(http).post(`/v1/trips/${v1.id}/revise`).set(bearer(A, T, "RM")).send({ destinations: ["FR", "SG"] });
    expect(v2.status).toBe(201);
    expect(v2.body.status).toBe("PENDING_APPROVAL");
    expect(v2.body.revision).toBe(2);
    expect(v2.body.previousTripId).toBe(v1.id);
    const g1 = await request(http).get(`/v1/trips/${v1.id}`).set(bearer(A, DIR, "DIR"));
    expect(g1.body.status).toBe("APPROVED");                             // V1 reste intacte
    console.log("BT-10 PASS — révision V2 chaînée (PENDING_APPROVAL), V1 reste APPROVED");
  });
});
