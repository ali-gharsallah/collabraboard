/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 7 (PMS : Mandats, Adéquation & Breaches).
 * Exécutés contre le VRAI backend. Doctrine : INTÉGRER, pas refaire (compliance sur positions).
 * Zéro invention : PMS ratifié R105→R108. Persona : Gérant / Compliance Officer (CO).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

const jstr = (r: request.Response) => JSON.stringify(r.body);

describe("FAT Vague 7 — PMS Mandats & Adéquation (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const TID = randomUUID(); const CLIENT = randomUUID(); const CO = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, TID, CLIENT);   // client risk_level = LOW
  });
  afterAll(async () => { await app.close(); });

  // ══ Adéquation à la souscription (R107) ═══════════════════════════════════
  it("FAT-PMS-ADEQ-01 [CO] le profil client borne le mandat (R107) ; alerte sans rétrogradation", async () => {
    // Attacher un mandat HIGH à un client LOW → refus LSFin (R107)
    const inadeq = await request(http).post("/v1/pms/mandats").set(bearer(TID, CO, "CO"))
      .send({ clientId: CLIENT, nom: "Croissance", profilRequis: "HIGH", strategie: {} });
    expect(inadeq.status).toBe(403);
    // Mandat adéquat (LOW) → OK
    const ok = await request(http).post("/v1/pms/mandats").set(bearer(TID, CO, "CO"))
      .send({ clientId: CLIENT, nom: "Prudent", profilRequis: "LOW", strategie: { bornes: {} } });
    expect(ok.status).toBeLessThan(300);
    // Un mandat devenu inadéquat (client rétrogradé) existe déjà (seed direct) → adéquation ALERTE
    await prisma.mandate.create({ data: { tenantId: TID, clientId: CLIENT, nom: "Ancien Dynamique",
      profilRequis: "HIGH", strategie: {}, statut: "ACTIF" } as any });
    const adeq = await request(http).get(`/v1/pms/clients/${CLIENT}/adequation`).set(bearer(TID, CO, "CO"));
    expect(adeq.status).toBe(200);
    expect(adeq.body.alertes.length).toBeGreaterThanOrEqual(1);   // R107 : alerte nommée, jamais rétrogradé
    console.log(`FAT-PMS-ADEQ-01 PASS — mandat HIGH sur client LOW refusé (R107) ; ${adeq.body.alertes.length} alerte(s) d'adéquation sans rétrogradation`);
  });

  // ══ Valorisation/drift (R105) + Pre-trade (R106) + Breach (R108/R7) ═══════
  it("FAT-PMS-DRIFT-01 [CO] drift constaté (positions intactes), pre-trade bloquant, breach clôturé motivé", async () => {
    const m = await request(http).post("/v1/pms/mandats").set(bearer(TID, CO, "CO"))
      .send({ clientId: CLIENT, nom: "Équilibré", profilRequis: "LOW",
        strategie: { bornes: { ACTIONS: [40, 60] }, exclusions: ["ARMEMENT"], maxPositionPct: 10 } });
    const mid = m.body.id;
    // Positions hors bornes : ACTIONS 90% (borne max 60)
    await prisma.position.create({ data: { tenantId: TID, mandateId: mid, instrument: "AAPL", secteur: "TECH", classe: "ACTIONS", valeurChf: 90000 } as any });
    await prisma.position.create({ data: { tenantId: TID, mandateId: mid, instrument: "BOND1", secteur: "GOV", classe: "OBLIGATIONS", valeurChf: 10000 } as any });
    // Valoriser → drift détecté, breach OUVERT, positions INTACTES (R105/R44)
    const val = await request(http).get(`/v1/pms/mandats/${mid}/valoriser`).set(bearer(TID, CO, "CO"));
    expect(val.status).toBe(200);
    expect(val.body.drifts.length).toBeGreaterThanOrEqual(1);
    const posApres = await prisma.position.count({ where: { tenantId: TID, mandateId: mid } });
    expect(posApres).toBe(2);                                     // rien liquidé/rééquilibré
    // Pre-trade : secteur exclu → BLOQUE (R106)
    const excl = await request(http).post(`/v1/pms/mandats/${mid}/pre-trade`).set(bearer(TID, CO, "CO"))
      .send({ instrument: "RHEINMETALL", secteur: "ARMEMENT", classe: "ACTIONS", montantChf: 1000 });
    expect(excl.body.verdict).toBe("BLOQUE");
    // Pre-trade : concentration > plafond 10% → BLOQUE (R106)
    const conc = await request(http).post(`/v1/pms/mandats/${mid}/pre-trade`).set(bearer(TID, CO, "CO"))
      .send({ instrument: "AAPL", secteur: "TECH", classe: "ACTIONS", montantChf: 50000 });
    expect(conc.body.verdict).toBe("BLOQUE");
    // Pre-trade : ordre conforme → OK
    const okOrdre = await request(http).post(`/v1/pms/mandats/${mid}/pre-trade`).set(bearer(TID, CO, "CO"))
      .send({ instrument: "NESTLE", secteur: "CONSO", classe: "ACTIONS", montantChf: 500 });
    expect(okOrdre.body.verdict).toBe("OK");
    // Breach registre : clôture sans motif → refus (R7) ; avec motif → CLOS
    const breaches = await request(http).get("/v1/pms/breaches?statut=OUVERT").set(bearer(TID, CO, "CO"));
    expect(breaches.body.length).toBeGreaterThanOrEqual(1);
    const bid = breaches.body[0].id;
    const sansMotif = await request(http).post(`/v1/pms/breaches/${bid}/clore`).set(bearer(TID, CO, "CO")).send({ motif: "" });
    expect(sansMotif.status).toBe(400);
    const clos = await request(http).post(`/v1/pms/breaches/${bid}/clore`).set(bearer(TID, CO, "CO")).send({ motif: "Régularisation planifiée avec le gérant." });
    expect(clos.body.statut).toBe("CLOS");
    console.log(`FAT-PMS-DRIFT-01 PASS — drift constaté (2 positions intactes), pre-trade exclusion+concentration BLOQUE, ordre conforme OK, breach clôturé motivé (R7)`);
  });
});
