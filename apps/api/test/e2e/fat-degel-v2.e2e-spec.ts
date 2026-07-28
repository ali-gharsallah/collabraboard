/**
 * FAT — DÉGEL VAGUE 2 (canon ratifié 2026-07-28, mapping +3) : CUSTODY & TRANSFER AGENT.
 * R301 [canon R298] positions custody = PORT, lues et rapprochées — jamais recopiées ·
 * R302 [canon R299] registre nominatif = JOURNAL (événements, rejeu R48, contre-passation
 * motivée R7, visas par type R13) · R303 [canon R300] rapprochement = TOUS les écarts,
 * typés, avec voie (pattern R269), résolution tracée. CY-01..06.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

describe("FAT DÉGEL V2 — R301/R302 : port custody absent, registre TA pleinement vivant (CY-01..03, CY-06)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const RM = randomUUID(), CO = randomUUID(), ADMIN = randomUUID();
  const titulaire = randomUUID();

  beforeAll(async () => {
    delete process.env.CUSTODY_FAKE_PORT;                 // CY-01 : PAS de port custody
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, titulaire);
  });
  afterAll(async () => { await app.close(); });

  it("CY-01 [R301/R167] pas de port → custody en refus gracieux ; le REGISTRE (journal propre) reste pleinement fonctionnel", async () => {
    const pos = await request(http).get("/v1/custody/positions").set(bearer(T, RM, "RM"));
    expect(pos.status).toBe(200);
    expect(pos.body.portConfigure).toBe(false);
    expect(pos.body.positions).toEqual([]);                                 // zéro donnée simulée
    // Le registre TA, lui, ne dépend d'AUCUN port
    const m = await request(http).post("/v1/ta/mouvements").set(bearer(T, RM, "RM"))
      .send({ type: "SOUSCRIPTION", titre: "ACT-GWB", titulaire, quantite: 100, reference: "SUB-1" });
    expect(m.status).toBe(201);
    const reg = await request(http).get("/v1/ta/registre").set(bearer(T, RM, "RM"));
    expect(reg.body.positions.find((p: any) => p.titre === "ACT-GWB")?.quantite).toBe(100);
    console.log("CY-01 PASS — custody refus gracieux, registre autonome");
  });

  it("CY-02 [R302/R48] un transfert = ÉVÉNEMENT ; l'état du registre à une date PASSÉE se rejoue EXACT", async () => {
    const avantTransfert = new Date().toISOString();                        // « J-30 » du scénario
    await new Promise((r) => setTimeout(r, 15));
    const autreTitulaire = randomUUID();
    await seedTenantClient(prisma, T, autreTitulaire);
    await request(http).post("/v1/ta/mouvements").set(bearer(T, RM, "RM"))
      .send({ type: "TRANSFERT", titre: "ACT-GWB", titulaire, versTitulaire: autreTitulaire,
        quantite: 30, reference: "TRF-1" }).expect(201);
    const auj = await request(http).get("/v1/ta/registre").set(bearer(T, RM, "RM"));
    expect(auj.body.positions.find((p: any) => p.titre === "ACT-GWB" && p.titulaire === titulaire)?.quantite).toBe(70);
    expect(auj.body.positions.find((p: any) => p.titre === "ACT-GWB" && p.titulaire === autreTitulaire)?.quantite).toBe(30);
    const passe = await request(http).get(`/v1/ta/registre?asOf=${encodeURIComponent(avantTransfert)}`).set(bearer(T, RM, "RM"));
    expect(passe.body.positions.find((p: any) => p.titre === "ACT-GWB" && p.titulaire === titulaire)?.quantite).toBe(100);
    console.log("CY-02 PASS — l'état passé se rejoue exact du journal");
  });

  it("CY-03 [R302/R7] la CORRECTION est une contre-passation MOTIVÉE ; l'UPDATE direct du journal lève une exception", async () => {
    await request(http).post("/v1/ta/mouvements/SUB-1/contrepasser").set(bearer(T, RM, "RM"))
      .send({}).expect(400);                                                // sans motif → refus (R7)
    const cp = await request(http).post("/v1/ta/mouvements/SUB-1/contrepasser").set(bearer(T, RM, "RM"))
      .send({ motif: "erreur de saisie — quantité fausse" });
    expect(cp.status).toBe(201);
    const reg = await request(http).get("/v1/ta/registre").set(bearer(T, RM, "RM"));
    expect(reg.body.positions.find((p: any) => p.titre === "ACT-GWB" && p.titulaire === titulaire)?.quantite).toBe(-30); // 70 − 100 : la contre-passation inverse TOUT le mouvement
    const ev = await prisma.domainEvent.findFirst({ where: { tenantId: T, type: "ta.mouvement.enregistre" } });
    await expect(prisma.$executeRawUnsafe(
      `UPDATE domain_events SET payload = '{}' WHERE id = ${ev!.id}`)).rejects.toThrow();
    console.log("CY-03 PASS — contre-passation motivée, journal inviolable");
  });

  it("CY-06 [R302/R13] les VISAS par type de mouvement suivent le paramètre tenant — l'initiateur ne vise pas", async () => {
    await request(http).post("/v1/parametres/valeur/ta_visas_par_type").set(bearer(T, ADMIN, "ADMIN"))
      .send({ valeur: { NANTISSEMENT: "CO" }, motif: "R302 : le nantissement exige un visa CO" }).expect(201);
    const m = await request(http).post("/v1/ta/mouvements").set(bearer(T, RM, "RM"))
      .send({ type: "NANTISSEMENT", titre: "ACT-GWB", titulaire, quantite: 10, reference: "NAN-1" });
    expect(m.status).toBe(201);
    expect(m.body.enAttenteDeVisa).toBe(true);                              // pas encore au registre
    const avant = await request(http).get("/v1/ta/registre").set(bearer(T, RM, "RM"));
    expect(JSON.stringify(avant.body)).not.toContain("NAN-1");
    await request(http).post("/v1/ta/mouvements/NAN-1/visa").set(bearer(T, RM, "RM")).expect(403);   // R13 initiateur
    await request(http).post("/v1/ta/mouvements/NAN-1/visa").set(bearer(T, ADMIN, "ADMIN")).expect(403); // rôle ≠ CO
    await request(http).post("/v1/ta/mouvements/NAN-1/visa").set(bearer(T, CO, "CO")).expect(201);
    const apres = await request(http).get("/v1/ta/registre").set(bearer(T, RM, "RM"));
    expect(JSON.stringify(apres.body.mouvements)).toContain("NAN-1");        // visé → au registre
    console.log("CY-06 PASS — visa par type, initiateur exclu, rôle vérifié");
  });
});

describe("FAT DÉGEL V2 — R303 : le rapprochement LISTE tous les écarts, avec voie (CY-04/05)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const RM = randomUUID(), CO = randomUUID();
  const titulaire = randomUUID();

  beforeAll(async () => {
    process.env.CUSTODY_FAKE_PORT = "1";                  // fixture : X=100, Y=50, Z=10
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, titulaire);
    // Registre : X=100 (concorde), Y=40 (diverge), W=5 (au registre, pas en custody) ; Z absent
    for (const [titre, quantite, reference] of [["TIT-X", 100, "M1"], ["TIT-Y", 40, "M2"], ["TIT-W", 5, "M3"]] as any[])
      await request(http).post("/v1/ta/mouvements").set(bearer(T, RM, "RM"))
        .send({ type: "SOUSCRIPTION", titre, titulaire, quantite, reference }).expect(201);
  });
  afterAll(async () => { delete process.env.CUSTODY_FAKE_PORT; await app.close(); });

  it("CY-04 [R303/R269] 3 écarts de fixture → les 3 LISTÉS, typés, chacun avec sa VOIE — jamais le premier seul", async () => {
    const r = await request(http).get("/v1/custody/rapprochement").set(bearer(T, CO, "CO"));
    expect(r.status).toBe(200);
    expect(r.body.ecarts.length).toBe(3);
    const types = r.body.ecarts.map((e: any) => e.type).sort();
    expect(types).toEqual(["POSITION_SANS_REGISTRE", "QUANTITES_DIVERGENTES", "REGISTRE_SANS_POSITION"]);
    for (const e of r.body.ecarts) expect(e.voie).toBeTruthy();             // la voie de résolution, TOUJOURS
    console.log("CY-04 PASS — 3 écarts listés, typés, avec voie");
  });

  it("CY-05 [R303] la RÉSOLUTION est un événement — le rapprochement suivant n'affiche plus que 2", async () => {
    const r1 = await request(http).get("/v1/custody/rapprochement").set(bearer(T, CO, "CO"));
    const cible = r1.body.ecarts.find((e: any) => e.type === "QUANTITES_DIVERGENTES");
    await request(http).post("/v1/custody/ecarts/resoudre").set(bearer(T, CO, "CO"))
      .send({ cle: cible.cle, voie: "contre-passation au registre",
        motif: "quantité corrigée après attestation dépositaire" }).expect(201);
    const ev = await prisma.domainEvent.findFirst({ where: { tenantId: T, type: "ta.ecart.resolu" } });
    expect(ev).toBeTruthy();
    const r2 = await request(http).get("/v1/custody/rapprochement").set(bearer(T, CO, "CO"));
    expect(r2.body.ecarts.length).toBe(2);
    expect(r2.body.resolus).toBe(1);                                        // le traité reste COMPTÉ, pas caché
    console.log("CY-05 PASS — résolution tracée, écart sorti de la liste, compté");
  });
});
