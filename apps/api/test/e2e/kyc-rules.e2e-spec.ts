/**
 * E2E — règles moteur R2 / R13 / R52 / R84 / R85 / R86 contre l'API réelle
 * (NestFactory + supertest + Postgres jetable). Auth : JWT RS256 (TenantMiddleware).
 *
 * Prérequis : `npm run test:e2e:setup` (docker Postgres :5433 + prisma db push + post-deploy),
 * puis `npm run test:e2e`. Workflow SDD → sections IDENTITY+SOF, visa IDENTITY/CO.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

const body = (r: request.Response) => JSON.stringify(r.body);

describe("KYC — règles moteur (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: any;
  const TID = randomUUID(), CLIENT = randomUUID();
  const RM = randomUUID(), CO_A = randomUUID(), CO_B = randomUUID(), CO_SR = randomUUID();
  let code: string;

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, TID, CLIENT);
    const res = await request(http).post("/v1/kyc").set(bearer(TID, RM, "RM"))
      .send({ clientId: CLIENT, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM });
    expect(res.status).toBeLessThan(300);
    code = res.body.code;
  });
  afterAll(async () => { await app.close(); });

  it("R13 — contributeur d'une section exclu de son visa", async () => {
    // CO_A répond à IDE-Q3 (droit CO) → devient préparateur de IDENTITY
    await request(http).patch(`/v1/kyc/${code}/questions/IDE-Q3`)
      .set(bearer(TID, CO_A, "CO")).send({ answer: "PEP: non" }).expect(200);
    const r = await request(http).post(`/v1/kyc/${code}/visas/IDENTITY`)
      .set(bearer(TID, CO_A, "CO")).send({ verdict: "OK" });
    expect(r.status).toBe(409);
    expect(body(r)).toContain("R13");
  });

  it("R86 — verdict NOK sans message refusé ; OK persisté", async () => {
    await request(http).post(`/v1/kyc/${code}/visas/IDENTITY`)
      .set(bearer(TID, CO_B, "CO")).send({ verdict: "NOK", message: "" }).expect(400);
    const ok = await request(http).post(`/v1/kyc/${code}/visas/IDENTITY`)
      .set(bearer(TID, CO_B, "CO")).send({ verdict: "OK" });
    expect(ok.status).toBeLessThan(300);
    expect(ok.body.verdict).toBe("OK");
  });

  it("R2 — visa à validateur nommé : seul lui signe", async () => {
    const res = await request(http).post("/v1/kyc").set(bearer(TID, RM, "RM"))
      .send({ clientId: CLIENT, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM });
    const code2 = res.body.code;
    // Erratum E4 (recette Vague 1) : la sous-requête était tenant-AVEUGLE (WHERE code = …).
    // Le `code` KYC n'est unique QUE par tenant (KYC-{an}-{pays}-{seq}, séquence par tenant) :
    // dès qu'une seconde suite e2e crée un dossier de même code sous un autre tenant, la
    // sous-requête rend >1 ligne (21000). On la scope au tenant — correction stricte, multi-tenant.
    await prisma.$executeRaw`UPDATE kyc_visas SET validateur = ${CO_A}::uuid
      WHERE section_code = 'IDENTITY'
        AND kyc_file_id = (SELECT id FROM kyc_files WHERE code = ${code2} AND tenant_id = ${TID}::uuid)`;
    const bad = await request(http).post(`/v1/kyc/${code2}/visas/IDENTITY`)
      .set(bearer(TID, CO_B, "CO")).send({ verdict: "OK" });
    expect(bad.status).toBe(403);
    expect(body(bad)).toContain("R2");
    const good = await request(http).post(`/v1/kyc/${code2}/visas/IDENTITY`)
      .set(bearer(TID, CO_A, "CO")).send({ verdict: "OK" });
    expect(good.status).toBeLessThan(300);
  });

  it("R84 — édition exclusive : prise, refus concurrent, demande, libération", async () => {
    const take = await request(http).post(`/v1/kyc/${code}/lock`).set(bearer(TID, RM, "RM"));
    expect(take.status).toBeLessThan(300);
    const conflict = await request(http).post(`/v1/kyc/${code}/lock`).set(bearer(TID, CO_A, "CO"));
    expect(conflict.status).toBe(409);
    const req = await request(http).post(`/v1/kyc/${code}/request-hand`).set(bearer(TID, CO_A, "CO"));
    expect(req.status).toBeLessThan(300);
    const rel = await request(http).post(`/v1/kyc/${code}/release`).set(bearer(TID, RM, "RM"));
    expect(rel.status).toBeLessThan(300);
  });

  it("R85 — passage de main : message obligatoire puis avance", async () => {
    await request(http).post(`/v1/kyc/${code}/handoff/next`)
      .set(bearer(TID, RM, "RM")).send({ message: "" }).expect(400);
    const ok = await request(http).post(`/v1/kyc/${code}/handoff/next`)
      .set(bearer(TID, RM, "RM")).send({ message: "à toi RM" });
    expect(ok.status).toBeLessThan(300);
  });

  it("R52 — validation finale : créateur (four-eyes) et contributeur (R52) exclus, tiers OK", async () => {
    // créateur RM → four-eyes (409) avant même le contrôle de rôle
    const creator = await request(http).post(`/v1/kyc/${code}/validate`).set(bearer(TID, RM, "RM"));
    expect(creator.status).toBe(409);
    expect(body(creator)).toContain("Four-eyes");
    // contributeur CO_A (rôle habilité) → R52
    const contrib = await request(http).post(`/v1/kyc/${code}/validate`).set(bearer(TID, CO_A, "CO_SR"));
    expect(contrib.status).toBe(409);
    expect(body(contrib)).toContain("R52");
    // tiers non-contributeur habilité → VALIDATED (visa IDENTITY signé OK)
    // R14 : l'engagement de responsabilité est requis pour la signature finale (gardé APRÈS
    // four-eyes/R52, d'où les 409 ci-dessus sans engagement) — le tiers signe avec engagement.
    const done = await request(http).post(`/v1/kyc/${code}/validate`).set(bearer(TID, CO_SR, "CO_SR")).send({ engagement: true });
    expect(done.status).toBeLessThan(300);
    expect(done.body.status).toBe("VALIDATED");
  });
});
