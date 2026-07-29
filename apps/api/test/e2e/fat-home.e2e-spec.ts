/**
 * FAT — Écran Home, portes minces (amendement Ali 2026-07-27 : critère « zéro endpoint nouveau »
 * AMENDÉ). Côté API : le PÉRIMÈTRE par rôle est prouvé serveur (HO-01), le compteur de visas
 * compte MON rôle (HO-05), ADMIN ne voit aucune donnée client (HO-06). Aucune règle nouvelle :
 * la matrice A.3 applique le RBAC existant (Client.rmUserId, KycVisa.requiredRole).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT HOME — portes minces T1/T2 (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const A = randomUUID();
  const RM1 = randomUUID(), CO1 = randomUUID();

  const mkClient = async (rm?: string) => {
    const id = randomUUID();
    await seedTenantClient(prisma, A, id);
    if (rm) await prisma.client.update({ where: { id }, data: { rmUserId: rm } });
    return id;
  };
  const mkKyc = (clientId: string, status: string) => prisma.kycFile.create({ data: {
    tenantId: A, clientId, code: `K-${randomUUID().slice(0, 8)}`, year: 2026, countryCode: "CH",
    sequence: 1, workflow: "CDD", riskScore: 10, riskLevel: "LOW", status: status as any, createdBy: RM1 } });

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    // 3 clients de RM1 (3 dossiers) + 7 clients d'autres RM (7 dossiers) = 10 dossiers tenant
    for (let i = 0; i < 3; i++) await mkKyc(await mkClient(RM1), "IN_PROGRESS");
    for (let i = 0; i < 7; i++) await mkKyc(await mkClient(randomUUID()), "UNDER_REVIEW");
  });
  afterAll(async () => { await app.close(); });

  it("HO-01 : la projection respecte le rôle — RM compte sur SES clients, CO sur le tenant", async () => {
    const rm = await request(http).get("/v1/kyc").set(bearer(A, RM1, "RM"));
    expect(rm.status).toBe(200);
    expect(rm.body.length).toBe(3);                                       // RM1 : 3 dossiers de ses 3 clients
    const rmClients = new Set(rm.body.map((k: any) => k.clientId));
    const co = await request(http).get("/v1/kyc").set(bearer(A, CO1, "CO"));
    expect(co.body.length).toBe(10);                                      // CO : tout le tenant
    // Aucun objet hors périmètre RM dans SA réponse (l'écart des périmètres est SERVEUR)
    expect(co.body.filter((k: any) => !rmClients.has(k.clientId)).length).toBe(7);
    const filtre = await request(http).get("/v1/kyc?statut=UNDER_REVIEW").set(bearer(A, CO1, "CO"));
    expect(filtre.body.length).toBe(7);                                   // HO-03 : le compteur cliqué = la liste filtrée
    console.log("HO-01/03 PASS — RM 3, CO 10, filtre UNDER_REVIEW 7 (périmètre serveur)");
  });

  it("HO-05 : les visas en attente comptent MON rôle, pas les autres", async () => {
    const c = await mkClient(RM1);
    const k = await mkKyc(c, "UNDER_REVIEW");
    await prisma.kycVisa.create({ data: { kycFileId: k.id, sectionCode: "IDENTITY", requiredRole: "CO" as any, status: "PENDING" } });
    await prisma.kycVisa.create({ data: { kycFileId: k.id, sectionCode: "AML", requiredRole: "BRM" as any, status: "PENDING" } });
    const co = await request(http).get("/v1/kyc/visas/pending").set(bearer(A, CO1, "CO"));
    expect(co.status).toBe(200);
    expect(co.body.length).toBe(1);                                       // le SIEN (CO), pas les 2
    expect(co.body[0]).toMatchObject({ kycCode: k.code, section: "IDENTITY", requiredRole: "CO" });
    console.log("HO-05 PASS — CO compte 1 visa (le sien), pas 2");
  });

  it("HO-06 : ADMIN ne voit aucune donnée client — refus serveur typé", async () => {
    await request(http).get("/v1/kyc").set(bearer(A, randomUUID(), "ADMIN")).expect(403);
    await request(http).get("/v1/kyc/visas/pending").set(bearer(A, randomUUID(), "ADMIN")).expect(403);
    console.log("HO-06 PASS — ADMIN 403 sur les portes client (défense serveur, en plus du front)");
  });
});
