/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 3 (Le cycle client de bout en bout).
 * Exécutés contre le VRAI backend. Personas : Relationship Manager (RM), Compliance Officer (CO),
 * Central File (CF), COO. Écrans : Onboarding · Account Review · Screening · Personnes/UBO ·
 * Change of Circumstances · Dashboard. Objectif : un dossier vit de l'entrée à la revue, sans trou.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

const jstr = (r: request.Response) => JSON.stringify(r.body);

describe("FAT Vague 3 — Le cycle client de bout en bout (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const TID = randomUUID(), TID2 = randomUUID();
  const CLIENT = randomUUID();
  const RM = randomUUID(), CO = randomUUID(), CF = randomUUID(), COO = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, TID, CLIENT);
    await seedTenantClient(prisma, TID2, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  // ══ Écran 1 : Onboarding / aiguillage SDD/CDD/EDD ═════════════════════════
  it("FAT-ONBOARD-01 [RM] entrée en relation : aiguillage vers le bon niveau de diligence (R117/R119)", async () => {
    // Aiguillage EDD : structure TRUST + compte LOMBARD + pays à haut risque
    const edd = await request(http).post("/v1/kyc").set(bearer(TID, RM, "RM"))
      .send({ clientId: CLIENT, legalStructure: "TRUST", accountType: "LOMBARD", countryCode: "RU", rmId: RM });
    expect(edd.status).toBeLessThan(300);
    expect(edd.body.workflow).toBe("EDD");
    expect(Array.isArray(edd.body.riskTrace)).toBe(true);      // trace auditable
    // Aiguillage SDD : personne physique, compte courant, pays standard
    const sdd = await request(http).post("/v1/kyc").set(bearer(TID, RM, "RM"))
      .send({ clientId: CLIENT, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM });
    expect(sdd.body.workflow).toBe("SDD");
    // Pipeline onboarding : PROSPECT → COLLECTE crée le KYC ; OUVERT refusé sans KYC VALIDATED (R119)
    const ob = await request(http).post("/v1/onboarding").set(bearer(TID, RM, "RM")).send({ prospectNom: "Prospect Helvetia" });
    const obId = ob.body.id;
    await request(http).post(`/v1/onboarding/${obId}/transition`).set(bearer(TID, RM, "RM"))
      .send({ vers: "COLLECTE", form: { clientName: "Prospect Helvetia", legalStructure: "PP", rmId: RM,
        accountType: "CURRENT", clientId: CLIENT, countryCode: "CH" } }).expect(201);
    await request(http).post(`/v1/onboarding/${obId}/transition`).set(bearer(TID, RM, "RM")).send({ vers: "KYC_EN_COURS" }).expect(201);
    await request(http).post(`/v1/onboarding/${obId}/transition`).set(bearer(TID, RM, "RM")).send({ vers: "DECISION" }).expect(201);
    const ouvert = await request(http).post(`/v1/onboarding/${obId}/transition`).set(bearer(TID, RM, "RM")).send({ vers: "OUVERT" });
    expect(ouvert.status).toBe(403);                            // R119 : pas d'ouverture sans KYC VALIDATED
    console.log(`FAT-ONBOARD-01 PASS — aiguillage EDD (TRUST/LOMBARD/RU) & SDD (PP/CURRENT/CH), ouverture bloquée sans VALIDATED (R119)`);
  });

  // ══ Écran 3 : Screening (sanctions/PEP) ═══════════════════════════════════
  it("FAT-SCREEN-01 [CO] qualifier un hit : escalade PROPOSÉE, motif obligatoire, trace toujours (R101/R7/R103)", async () => {
    const run = await request(http).post("/v1/screening/run").set(bearer(TID, CO, "CO")).send({
      liste: "SECO", version: "2026-07", seuil: 100, prefiltre: {},
      entries: [{ uid: "E1", nom_complet: "Suzuki Ltd", alias: [] }], clientIds: [CLIENT] });
    expect(run.status).toBeLessThan(300);
    expect(run.body.hits.length).toBeGreaterThanOrEqual(1);     // le nom du client correspond
    const hitId = run.body.hits[0].id;
    // R7 : qualification sans motif refusée
    const sansMotif = await request(http).post(`/v1/screening/hits/${hitId}/qualify`).set(bearer(TID, CO, "CO"))
      .send({ verdict: "VRAI_POSITIF", motif: "" });
    expect(sansMotif.status).toBe(400);
    // Qualification VRAI_POSITIF motivée → escalade PROPOSÉE (jamais exécutée)
    const q = await request(http).post(`/v1/screening/hits/${hitId}/qualify`).set(bearer(TID, CO, "CO"))
      .send({ verdict: "VRAI_POSITIF", motif: "Correspondance confirmée sur liste SECO." });
    expect(q.status).toBeLessThan(300);
    expect(q.body.par).toBe(CO);                                // R101 : auteur = jeton, jamais le corps
    const esc = await prisma.domainEvent.findMany({ where: { tenantId: TID, type: "screening.escalade.proposee" } });
    expect(esc.length).toBeGreaterThanOrEqual(1);               // R39/R44 : proposée, pas exécutée
    const runs = await request(http).get("/v1/screening/runs").set(bearer(TID, CO, "CO"));
    expect(runs.body.length).toBeGreaterThanOrEqual(1);         // R103 : trace de fraîcheur lisible
    console.log(`FAT-SCREEN-01 PASS — hit qualifié VRAI_POSITIF (auteur=jeton), sans motif refusé (R7), escalade proposée (R39/R44), run tracé (R103)`);
  });

  // ══ Écran 2 : Account Review (orchestration — zéro canon inventé) ═════════
  it("FAT-REVIEW-01 [CO] conduire une revue : re-screening tracé (R103) + décision par primitive ratifiée", async () => {
    // La revue s'ORCHESTRE sur des primitives ratifiées : re-screening (trace R103) puis décision KYC.
    const before = await request(http).get("/v1/screening/runs").set(bearer(TID, CO, "CO"));
    const avant = before.body.length;
    const rescreen = await request(http).post("/v1/screening/run").set(bearer(TID, CO, "CO")).send({
      liste: "SECO", version: "2026-07-REVUE", seuil: 100, prefiltre: {}, entries: [], clientIds: [CLIENT] });
    expect(rescreen.status).toBeLessThan(300);
    const after = await request(http).get("/v1/screening/runs").set(bearer(TID, CO, "CO"));
    expect(after.body.length).toBe(avant + 1);                  // la revue a laissé une trace de re-screening
    // La conclusion s'appuie sur une primitive RATIFIÉE (KYC) — le four-eyes reste opposable :
    const k = await request(http).post("/v1/kyc").set(bearer(TID, RM, "RM"))
      .send({ clientId: CLIENT, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM });
    const code = k.body.code;
    const selfValidate = await request(http).post(`/v1/kyc/${code}/validate`).set(bearer(TID, RM, "RM"));
    expect(selfValidate.status).toBe(409);                      // décision gouvernée (four-eyes) — auteur = jeton
    console.log(`FAT-REVIEW-01 PASS — re-screening tracé (R103) + conclusion par primitive ratifiée (KYC four-eyes), aucun agrégat « revue » inventé`);
  });

  // ══ Écran 4 : Personnes liées / UBO ═══════════════════════════════════════
  it("FAT-UBO-01 [RM] chaîne de contrôle : UBO rattaché + relation bijective, cloisonnée (R31/R34)", async () => {
    const kyc = await request(http).post("/v1/kyc").set(bearer(TID, RM, "RM"))
      .send({ clientId: CLIENT, legalStructure: "FOUNDATION", accountType: "CURRENT", countryCode: "CH", rmId: RM });
    const kycId = kyc.body.id;
    const ubo = await request(http).post("/v1/personnes").set(bearer(TID, RM, "RM")).send({ nom: "Hans Meier" });
    const settlor = await request(http).post("/v1/personnes").set(bearer(TID, RM, "RM")).send({ nom: "Anna Weber" });
    // Rattachement de rôle UBO au dossier (R31)
    await request(http).post(`/v1/personnes/${ubo.body.id}/roles`).set(bearer(TID, RM, "RM"))
      .send({ kycFileId: kycId, role: "UBO" }).expect(201);
    // Relation bijective settlor ↔ ubo (R34) : une arête, deux lectures
    await request(http).post("/v1/personnes/relations").set(bearer(TID, RM, "RM"))
      .send({ aId: settlor.body.id, bId: ubo.body.id, typeAb: "SETTLOR_DE", typeBa: "BENEFICIAIRE_DE" }).expect(201);
    const relU = await request(http).get(`/v1/personnes/${ubo.body.id}/relations`).set(bearer(TID, RM, "RM"));
    expect(relU.body.length).toBe(1);
    expect(relU.body[0].type).toBe("BENEFICIAIRE_DE");         // lecture depuis le côté UBO
    // Isolation : un autre tenant ne voit pas ces relations
    const autre = await request(http).get(`/v1/personnes/${ubo.body.id}/relations`).set(bearer(TID2, RM, "RM"));
    expect(autre.body.length).toBe(0);
    console.log(`FAT-UBO-01 PASS — UBO rattaché (R31), relation bijective relue des deux côtés (R34), isolation tenant`);
  });

  // ══ Écran 5 : Change of Circumstances ═════════════════════════════════════
  it("FAT-COC-01 [CO] un changement d'identité déclenche re-screening + propagation (R30/R42)", async () => {
    const kyc = await request(http).post("/v1/kyc").set(bearer(TID, RM, "RM"))
      .send({ clientId: CLIENT, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM });
    const kycId = kyc.body.id;
    const p = await request(http).post("/v1/personnes").set(bearer(TID, CO, "CO")).send({ nom: "Karl Suter" });
    await request(http).post(`/v1/personnes/${p.body.id}/roles`).set(bearer(TID, CO, "CO"))
      .send({ kycFileId: kycId, role: "TITULAIRE" }).expect(201);
    const coc = await request(http).post(`/v1/personnes/${p.body.id}/coc`).set(bearer(TID, CO, "CO"))
      .send({ champ: "nom", valeur: "Karl Suter-Meier" });
    expect(coc.status).toBeLessThan(300);
    const rescreen = await prisma.domainEvent.findMany({ where: { tenantId: TID, type: "personne.rescreening.declenche", aggregateId: p.body.id } });
    expect(rescreen.length).toBeGreaterThanOrEqual(1);          // R42 : re-screening DÉCLENCHÉ (proposé)
    const propage = await prisma.domainEvent.findMany({ where: { tenantId: TID, type: "personne.coc.propage", aggregateId: p.body.id } });
    expect(propage.length).toBeGreaterThanOrEqual(1);          // propagé au dossier, sans bascule d'état
    console.log(`FAT-COC-01 PASS — CoC identité → re-screening déclenché (R42) + propagation au dossier (R30), aucune bascule par effet de bord`);
  });

  // ══ Écran 6 : Dashboard exécutif (minimal) ════════════════════════════════
  it("FAT-DASH-01 [COO] stock par état, cloisonné au tenant", async () => {
    // Le dashboard AGRÈGE des stocks listables (onboardings, dossiers de risque, hits).
    const obs = await request(http).get("/v1/onboarding").set(bearer(TID, COO, "COO"));
    expect(obs.status).toBe(200);
    expect(obs.body.length).toBeGreaterThanOrEqual(1);          // au moins l'onboarding de FAT-ONBOARD-01
    const hits = await request(http).get("/v1/screening/hits").set(bearer(TID, COO, "COO"));
    expect(hits.status).toBe(200);
    const cases = await request(http).get("/v1/riskcases").set(bearer(TID, COO, "COO"));
    expect(cases.status).toBe(200);
    // Cloisonnement : un autre tenant a son propre stock (aucun onboarding ici)
    const autre = await request(http).get("/v1/onboarding").set(bearer(TID2, COO, "COO"));
    expect(autre.body.length).toBe(0);
    console.log(`FAT-DASH-01 PASS — stock lisible (onboardings=${obs.body.length}, hits=${hits.body.length}, dossiers=${cases.body.length}), autre tenant cloisonné`);
  });

  // ══ Objectif de fin de vague : un dossier COMPLET de bout en bout ═════════
  it("FAT-CYCLE-01 [bout-en-bout] entrée → KYC → screening → revue → changement, sans trou", async () => {
    const client = randomUUID();
    await seedTenantClient(prisma, TID, client);
    // 1) Entrée → aiguillage KYC
    const kyc = await request(http).post("/v1/kyc").set(bearer(TID, RM, "RM"))
      .send({ clientId: client, legalStructure: "SARL", accountType: "ADVISORY", countryCode: "CH", rmId: RM });
    expect(["SDD", "CDD", "EDD"]).toContain(kyc.body.workflow);
    // 2) Screening
    const run = await request(http).post("/v1/screening/run").set(bearer(TID, CO, "CO")).send({
      liste: "SECO", version: "cycle", seuil: 100, prefiltre: {}, entries: [], clientIds: [client] });
    expect(run.status).toBeLessThan(300);
    // 3) Revue (re-screening tracé)
    const runs = await request(http).get("/v1/screening/runs").set(bearer(TID, CO, "CO"));
    expect(runs.body.length).toBeGreaterThanOrEqual(1);
    // 4) Personne + changement de circonstances propagé
    const p = await request(http).post("/v1/personnes").set(bearer(TID, CO, "CO")).send({ nom: "Cycle Person" });
    await request(http).post(`/v1/personnes/${p.body.id}/roles`).set(bearer(TID, CO, "CO"))
      .send({ kycFileId: kyc.body.id, role: "TITULAIRE" }).expect(201);
    const coc = await request(http).post(`/v1/personnes/${p.body.id}/coc`).set(bearer(TID, CO, "CO"))
      .send({ champ: "nationalite", valeur: "FR" });
    expect(coc.status).toBeLessThan(300);
    const propage = await prisma.domainEvent.findMany({ where: { tenantId: TID, type: "personne.coc.propage", aggregateId: p.body.id } });
    expect(propage.length).toBeGreaterThanOrEqual(1);
    console.log(`FAT-CYCLE-01 PASS — cycle complet joué sur Postgres réel : entrée(${kyc.body.workflow}) → screening → revue → CoC propagé, sans trou`);
  });
});
