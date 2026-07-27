/**
 * FAT — Les 5 bacs à sable (canon vague pilote partie 3, famille BS ratifiée — ex-SB, collision
 * SecretBox). Arbitrage : endpoints dry-run patron SandboxAml, APPLICATION de R70. BS-01 (zéro
 * mutation) est exécuté sur CHACUN des 5 : inventaire de comptage avant/après byte-identique.
 * BS-02 (indisponible côté front) et BS-06 (pont pré-rempli, pas appliqué) : Vitest.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT BS — les 5 bacs à sable : dry-run backend, zéro mutation (BS-01/03/04/05)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const RM = randomUUID(), CO = randomUUID();
  let clientId = "", kyc: any = null;

  const compte = async () => ({
    clients: await prisma.client.count({ where: { tenantId: T } }),
    kycs: await prisma.kycFile.count({ where: { tenantId: T } }),
    questions: await prisma.kycQuestion.count({ where: { section: { kycFile: { tenantId: T } } } }),
    regles: await prisma.kycAccessRule.count({ where: { question: { section: { kycFile: { tenantId: T } } } } }),
    visas: await prisma.kycVisa.count({ where: { kycFile: { tenantId: T } } }),
    docs: await prisma.document.count({ where: { tenantId: T } }),
    events: await prisma.domainEvent.count({ where: { tenantId: T } }),
  });

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    kyc = (await request(http).post("/v1/kyc").set(bearer(T, RM, "RM"))
      .send({ clientId, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM })).body;
  });
  afterAll(async () => { await app.close(); });

  it("BS-01 [R70] AUCUN des 5 bacs ne mute : session complète de simulation → comptages byte-identiques", async () => {
    const avant = await compte();
    await request(http).post("/v1/sandbox/kyc-droits").set(bearer(T, CO, "CO"))
      .send({ role: "CO", sectionCode: kyc.sections[0].code }).expect(201);
    await request(http).post("/v1/sandbox/brm-seuils").set(bearer(T, CO, "CO"))
      .send({ seuilEdd: 40, seuilCdd: 20 }).expect(201);
    await request(http).post("/v1/sandbox/onb-aiguillage").set(bearer(T, CO, "CO"))
      .send({ table: { PP: "SDD" } }).expect(201);
    await request(http).post("/v1/sandbox/cf-exigences").set(bearer(T, CO, "CO"))
      .send({ exigences: { PP: ["PASSEPORT"] } }).expect(201);
    await request(http).post("/v1/sandbox/wf-delais").set(bearer(T, CO, "CO"))
      .send({ delaisJours: { IDENTITY: 0 } }).expect(201);
    expect(await compte()).toEqual(avant);                                   // BYTE-IDENTIQUE — exécuté sur les 5
    console.log("BS-01 PASS — 5 simulations, zéro écriture (événements compris)");
  });

  it("BS-03 [sbkyc] la projection NOMME les dossiers devenant incomplets et la charge ajoutée", async () => {
    const r = (await request(http).post("/v1/sandbox/kyc-droits").set(bearer(T, CO, "CO"))
      .send({ role: "CO", sectionCode: kyc.sections.find((s: any) => s.code === "AML")?.code ?? kyc.sections[0].code })).body;
    expect(r.ecriture).toBe(false);
    expect(r.dossiersImpactes.some((d: any) => d.code === kyc.code)).toBe(true);  // questions non répondues → incomplet, NOMMÉ
    expect(r.chargeParRole.CO).toBeGreaterThan(0);                                 // charge CO ajoutée
    console.log("BS-03 PASS —", r.dossiersImpactes.length, "dossier(s) nommé(s), charge CO", r.chargeParRole.CO);
  });

  it("BS-04 [sbbrm] abaisser le seuil EDD NOMME les clients qui basculeraient, avec leur score", async () => {
    const r = (await request(http).post("/v1/sandbox/brm-seuils").set(bearer(T, CO, "CO"))
      .send({ seuilEdd: 0, seuilCdd: -1 })).body;                            // seuil plancher : tout bascule EDD
    expect(r.ecriture).toBe(false);
    const mien = r.reclassements.find((x: any) => x.code === kyc.code);
    expect(mien).toBeTruthy();                                               // NOMINATIF, pas un simple compteur
    expect(mien.apres).toBe("EDD");
    expect(typeof mien.score).toBe("number");                                // avec son score
    expect(r.deltaChargeEdd).toBeGreaterThan(0);
    console.log("BS-04 PASS — reclassement nominatif", mien.code, mien.avant, "→", mien.apres, "score", mien.score);
  });

  it("BS-05 [sbonb] l'inconnu va en QUARANTAINE — jamais un aiguillage deviné (pattern R169)", async () => {
    const autreStructure = randomUUID();
    await prisma.client.create({ data: { tenantId: T, id: autreStructure, name: "Trust X", structure: "TRUST", country: "CH" } });
    const r = (await request(http).post("/v1/sandbox/onb-aiguillage").set(bearer(T, CO, "CO"))
      .send({ table: { PP: "SDD" } })).body;                                 // TRUST absent de la table
    expect(r.repartition.SDD).toBeGreaterThanOrEqual(1);
    expect(r.nonRoutables.some((n: any) => n.structure === "TRUST")).toBe(true);   // classé NON ROUTABLE, pas deviné
    const ko = await request(http).post("/v1/sandbox/onb-aiguillage").set(bearer(T, CO, "CO"))
      .send({ table: { PP: "WORKFLOW_INVENTE" } });
    expect(ko.status).toBe(400);                                             // default-deny sur le levier lui-même
    console.log("BS-05 PASS — TRUST en quarantaine, workflow inconnu refusé");
  });

  it("sbcf + sbwf : documents manquants PAR DOSSIER, goulots par section (projections réelles)", async () => {
    const cf = (await request(http).post("/v1/sandbox/cf-exigences").set(bearer(T, CO, "CO"))
      .send({ exigences: { PP: ["PASSEPORT_CERTIFIE"] } })).body;
    expect(cf.nonConformes.some((n: any) => n.clientId === clientId
      && n.manquants.includes("PASSEPORT_CERTIFIE"))).toBe(true);            // manquant PAR DOSSIER
    const wf = (await request(http).post("/v1/sandbox/wf-delais").set(bearer(T, CO, "CO"))
      .send({ delaisJours: { IDENTITY: 0 }, now: new Date(Date.now() + 5 * 86400000).toISOString() })).body;
    expect(wf.goulots.some((g: any) => g.code === kyc.code && g.section === "IDENTITY")).toBe(true);
    expect(Object.values(wf.chargeParRole).some((n: any) => n > 0)).toBe(true);
    console.log("sbcf/sbwf PASS — manquants nominatifs, goulots projetés");
  });
});
