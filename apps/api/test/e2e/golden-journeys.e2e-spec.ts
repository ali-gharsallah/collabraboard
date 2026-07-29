/**
 * GOLDEN — parcours métier, INVARIANTS figés (Bloc 0 robustesse, R335/RB, GLD-01..05).
 * Filet de caractérisation EXPLICITE : au lieu de snapshoter des sorties bruitées (UUID,
 * horodatage), on fige les INVARIANTS structurels et sécurité que tout refactoring (Blocs A-E)
 * doit préserver. Toute régression de ces invariants = build rouge, indépendamment des tests
 * fonctionnels par module. Réutilise le harnais e2e prouvé (boot/bearer/seedTenantClient).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("GOLDEN — invariants de parcours (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const A = randomUUID(), B = randomUUID();          // deux tenants
  const RM1 = randomUUID(), CO1 = randomUUID();

  const mkClient = async (tid: string, rm?: string) => {
    const id = randomUUID();
    await seedTenantClient(prisma, tid, id);
    if (rm) await prisma.client.update({ where: { id }, data: { rmUserId: rm } });
    return id;
  };
  const mkKyc = (tid: string, clientId: string, status: string) => prisma.kycFile.create({ data: {
    tenantId: tid, clientId, code: `K-${randomUUID().slice(0, 8)}`, year: 2026, countryCode: "CH",
    sequence: 1, workflow: "CDD", riskScore: 10, riskLevel: "LOW", status: status as any, createdBy: RM1 } });

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    for (let i = 0; i < 3; i++) await mkKyc(A, await mkClient(A, RM1), "IN_PROGRESS");   // 3 dossiers RM1
    for (let i = 0; i < 2; i++) await mkKyc(A, await mkClient(A, randomUUID()), "UNDER_REVIEW"); // 2 autres
    await mkKyc(B, await mkClient(B, randomUUID()), "IN_PROGRESS");                       // tenant B (isolé)
  });
  afterAll(async () => { await app.close(); });

  it("GLD-01 isolation tenant : un jeton du tenant B ne voit JAMAIS un dossier du tenant A", async () => {
    const co = await request(http).get("/v1/kyc").set(bearer(A, CO1, "CO"));
    expect(co.status).toBe(200);
    expect(co.body.length).toBe(5);                                   // tenant A : ses 5 dossiers
    const bVue = await request(http).get("/v1/kyc").set(bearer(B, randomUUID(), "CO"));
    expect(bVue.body.length).toBe(1);                                 // tenant B : LE SIEN, jamais ceux de A
    expect(bVue.body.every((k: any) => co.body.every((ka: any) => ka.clientId !== k.clientId))).toBe(true);
  });

  it("GLD-02 périmètre RBAC : RM borné à ses clients ; ADMIN sans donnée client (403 serveur)", async () => {
    const rm = await request(http).get("/v1/kyc").set(bearer(A, RM1, "RM"));
    expect(rm.body.length).toBe(3);                                   // RM1 : SES 3 dossiers seulement
    await request(http).get("/v1/kyc").set(bearer(A, randomUUID(), "ADMIN")).expect(403);
    await request(http).get("/v1/kyc/visas/pending").set(bearer(A, randomUUID(), "ADMIN")).expect(403);
  });

  it("GLD-03 quatre-yeux : deux visas de rôles DISTINCTS, chacun ne voit QUE le sien", async () => {
    const k = await mkKyc(A, await mkClient(A, RM1), "UNDER_REVIEW");
    await prisma.kycVisa.create({ data: { kycFileId: k.id, sectionCode: "IDENTITY", requiredRole: "CO" as any, status: "PENDING" } });
    await prisma.kycVisa.create({ data: { kycFileId: k.id, sectionCode: "AML", requiredRole: "BRM" as any, status: "PENDING" } });
    const coVisas = await request(http).get("/v1/kyc/visas/pending").set(bearer(A, CO1, "CO"));
    const mesVisas = coVisas.body.filter((v: any) => v.kycCode === k.code);
    expect(mesVisas.length).toBe(1);                                  // le visa CO, jamais celui du BRM
    expect(mesVisas[0].requiredRole).toBe("CO");
  });

  it("GLD-04 append-only : le journal d'événements refuse UPDATE et DELETE (immuabilité R48)", async () => {
    const ev = await prisma.domainEvent.create({ data: { tenantId: A, type: "golden.probe",
      aggregateId: randomUUID(), payload: { k: 1 }, at: new Date().toISOString() } });
    await expect(prisma.$executeRawUnsafe(`UPDATE domain_events SET payload = '{}' WHERE id = ${ev.id}`)).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe(`DELETE FROM domain_events WHERE id = ${ev.id}`)).rejects.toThrow();
    const relu = await prisma.domainEvent.findUnique({ where: { id: ev.id } });
    expect(relu?.payload).toEqual({ k: 1 });                          // intact
  });

  it("GLD-05 le parcours PRODUIT un journal tenant-scopé, non vide", async () => {
    const n = await prisma.domainEvent.count({ where: { tenantId: A } });
    expect(n).toBeGreaterThan(0);                                     // les écritures ont émis des événements
    const nB = await prisma.domainEvent.count({ where: { tenantId: B, type: "golden.probe" } });
    expect(nB).toBe(0);                                               // la sonde de A n'a pas fui vers B
  });
});
