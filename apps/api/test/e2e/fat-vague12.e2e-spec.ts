/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 12 (Workflow Instances, FE-WFI).
 * Exécutés contre le VRAI backend. Écran : Workflow Instances — projection LECTURE SEULE du
 * workflow gouverné ratifié (dossier KYC : visas R13/R15 + timeline DomainEvents). Zéro invention :
 * l'instance EST le dossier KYC, créé par le chemin ratifié (POST /v1/kyc).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT Vague 12 — Workflow Instances (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const TID = randomUUID(); const CLIENT = randomUUID();
  const RM = randomUUID(); const CO_A = randomUUID(); const CO_B = randomUUID();
  let code: string; let id: string;

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, TID, CLIENT);
    const res = await request(http).post("/v1/kyc").set(bearer(TID, RM, "RM"))
      .send({ clientId: CLIENT, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM });
    code = res.body.code;
  });
  afterAll(async () => { await app.close(); });

  it("FAT-WFI-01 [CO] la liste des instances projette les dossiers KYC (code, type, statut, visas)", async () => {
    const r = await request(http).get("/v1/workflow-instances").set(bearer(TID, CO_A, "CO"));
    expect(r.status).toBe(200);
    const inst = r.body.find((i: any) => i.code === code);
    expect(inst).toBeDefined();
    expect(inst.type).toMatch(/^KYC:/);
    expect(inst.status).toBe("IN_PROGRESS");
    expect(inst.visas).toMatch(/^\d+\/\d+$/);          // « signés / total »
    id = inst.id;
    console.log(`FAT-WFI-01 PASS — instance ${code} projetée (type=${inst.type}, statut=${inst.status}, visas=${inst.visas})`);
  });

  it("FAT-WFI-02 [CO] le détail expose steps (sections) + visas uniformes (R15) ; un visa signé porte son signataire", async () => {
    // Un CO répond (devient préparateur), un AUTRE CO vise IDENTITY (four-eyes R13 respecté)
    await request(http).patch(`/v1/kyc/${code}/questions/IDE-Q3`).set(bearer(TID, CO_A, "CO")).send({ answer: "PEP: non" }).expect(200);
    await request(http).post(`/v1/kyc/${code}/visas/IDENTITY`).set(bearer(TID, CO_B, "CO")).send({ verdict: "OK" }).expect(201);
    const r = await request(http).get(`/v1/workflow-instances/${id}`).set(bearer(TID, CO_A, "CO"));
    expect(r.status).toBe(200);
    expect(r.body.steps.length).toBeGreaterThan(0);                        // les sections = les étapes
    const identity = r.body.visas.find((v: any) => v.section === "IDENTITY");
    expect(identity).toBeDefined();
    expect(identity.statut).not.toBe("PENDING");                           // signé
    expect(identity.signePar).toBe(CO_B);                                  // visa uniforme R15 : signataire porté
    console.log(`FAT-WFI-02 PASS — ${r.body.steps.length} steps, visa IDENTITY signé par ${identity.signePar} (statut=${identity.statut})`);
  });

  it("FAT-WFI-03 [CO] la timeline est fidèle à l'audit (DomainEvents de l'agrégat, ordre serveur — FE-20)", async () => {
    const r = await request(http).get(`/v1/workflow-instances/${id}/events`).set(bearer(TID, CO_A, "CO"));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.length).toBeGreaterThan(0);
    const types = r.body.map((e: any) => e.type);
    expect(types).toContain("kyc.created");                                // l'instance est née
    // ordre chronologique (les at sont non décroissants)
    const ats = r.body.map((e: any) => new Date(e.at).getTime());
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
    console.log(`FAT-WFI-03 PASS — timeline ${r.body.length} événements dans l'ordre (types: ${[...new Set(types)].join(", ")})`);
  });
});
