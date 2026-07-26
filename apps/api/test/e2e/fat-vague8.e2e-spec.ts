/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 8 (Référentiel AML : scénarios & seuils).
 * Exécutés contre le VRAI backend. Écran : Référentiel AML (18 scénarios R189→R206 + seuils).
 * Zéro invention : projection du canon ratifié (A-69..A-86) ; seuils pilotés par le registre R-Q.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT Vague 8 — Référentiel AML (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const TID = randomUUID(); const CO = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, TID, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("FAT-AMLCAT-01 [CO] le référentiel expose les 18 scénarios (R189→R206) + seuils effectifs", async () => {
    const r = await request(http).get("/v1/aml/referentiel").set(bearer(TID, CO, "CO"));
    expect(r.status).toBe(200);
    expect(r.body.scenarios.length).toBe(18);                       // R189→R206
    const regles = r.body.scenarios.map((s: any) => s.regle);
    expect(regles).toContain("R189"); expect(regles).toContain("R192"); expect(regles).toContain("R206");
    // chaque scénario porte code/type/niveau/libellé
    const structuring = r.body.scenarios.find((s: any) => s.regle === "R189");
    expect(structuring.type).toBe("STRUCTURING");
    expect([1, 2]).toContain(structuring.niveau);
    // seuils effectifs = défauts du canon (non surchargés)
    expect(r.body.seuils.structuringSeuilChf).toBe(100000);
    console.log(`FAT-AMLCAT-01 PASS — ${r.body.scenarios.length} scénarios (R189→R206), seuils effectifs (structuringSeuilChf=${r.body.seuils.structuringSeuilChf})`);
  });

  it("FAT-AMLCAT-02 [CO] un seuil changé au registre (R126) se reflète dans le référentiel (R125→R127)", async () => {
    // Changement gouverné du seuil (acte motivé) via le registre R-Q — jamais en dur
    await request(http).post("/v1/parametres/valeur/amlStructuringSeuilChf").set(bearer(TID, CO, "CO"))
      .send({ valeur: 50000, motif: "Durcissement de la détection structuring." }).expect(201);
    const r = await request(http).get("/v1/aml/referentiel").set(bearer(TID, CO, "CO"));
    expect(r.body.seuils.structuringSeuilChf).toBe(50000);         // la nouvelle valeur effective
    console.log(`FAT-AMLCAT-02 PASS — seuil structuring abaissé au registre (100000 → 50000) reflété dans le référentiel (R125→R127)`);
  });
});
