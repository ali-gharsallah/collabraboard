/**
 * SEED DÉMO GWB — dette produit §11 du canon du dégel (2026-07-28) : « seed tenant démo
 * GWB bout-en-bout ». Le seed passe par les VRAIES routes HTTP (jamais un INSERT de
 * dossier à la main) : ce qui est semé a suivi les mêmes gardes que la production.
 * GARDES : (1) OLIVE_SEED_DEMO=1 obligatoire — sans elle le seed REFUSE (jamais une donnée
 * de démo par accident, R167) ; (2) tenant à identifiant FIXE — s'il existe déjà, le seed
 * REFUSE (pas de double semis) ; (3) le tenant et le jeton ADMIN d'amorçage sont les deux
 * seuls actes hors routes (la création de tenant et le premier ADMIN sont des actes d'ops
 * — consigné, ECARTS §11). Usage : OLIVE_SEED_DEMO=1 npm run seed:demo (cf. RUNBOOK §1).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer } from "../e2e/util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

const TENANT_GWB = "9b1de001-0000-4000-8000-00000000006b";  // identifiant FIXE du tenant démo

describe("SEED DÉMO GWB (§11) — bout-en-bout par les vraies routes, gardé", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;

  beforeAll(async () => {
    if (process.env.OLIVE_SEED_DEMO !== "1")
      throw new Error("SEED REFUSÉ : OLIVE_SEED_DEMO=1 requis — le seed démo ne s'exécute jamais par accident (R167)");
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
  });
  afterAll(async () => { await app?.close(); });

  it("sème le tenant GWB : rôles, registre, clients, KYC, CPSI, CoC, incident — et le prouve", async () => {
    if (await prisma.tenant.findFirst({ where: { id: TENANT_GWB } }))
      throw new Error("SEED REFUSÉ : le tenant démo GWB existe déjà — pas de double semis (purger d'abord, RUNBOOK §1)");
    await prisma.$executeRaw`INSERT INTO tenants (id, name, created_at) VALUES (${TENANT_GWB}::uuid, 'GWB Demo', NOW())`;
    const boss = bearer(TENANT_GWB, randomUUID(), "ADMIN");                 // amorçage ops (consigné)

    // ── Les six rôles de la démo — par la VRAIE route admin (garde dernier-ADMIN comprise) ──
    const roles: [string, string][] = [["ADMIN", "alice"], ["RM", "marc"], ["CO", "carla"],
      ["CO_SR", "selim"], ["DIR", "diane"], ["SO", "sofia"]];
    const ids: Record<string, string> = {};
    for (const [role, prenom] of roles) {
      const u = await request(http).post("/v1/admin/users").set(boss)
        .send({ email: `${prenom}@gwb-demo.ch`, name: prenom[0].toUpperCase() + prenom.slice(1),
          role, password: "Demo-GWB-2026!" });
      expect(u.status).toBe(201);
      ids[role] = u.body.id;
    }
    // ── Registre : le domaine de login du tenant (R296) ──
    await request(http).post("/v1/parametres/valeur/loginDomaines").set(boss)
      .send({ valeur: ["gwb-demo.ch"], motif: "Seed démo §11 : domaine de résolution login" }).expect(201);

    // ── Trois clients par la vraie route (zod ClientCreate), rattachés au RM ──
    const clients: string[] = [];
    for (const [name, structure, country] of [["Famille Keller", "PP", "CH"],
      ["Nordwind Handel SA", "SA", "DE"], ["Meridian Trust", "TRUST", "SG"]] as const) {
      const c = await request(http).post("/v1/clients").set(bearer(TENANT_GWB, ids.RM, "RM"))
        .send({ name, structure, country });
      expect(c.status).toBe(201);
      clients.push(c.body.id);
      await prisma.client.update({ where: { id: c.body.id }, data: { rmUserId: ids.RM } });
    }
    // ── Un dossier KYC réel (gabarit servi par le moteur de règles) ──
    const kyc = await request(http).post("/v1/kyc").set(bearer(TENANT_GWB, ids.RM, "RM"))
      .send({ clientId: clients[0], legalStructure: "PP", accountType: "CURRENT",
        countryCode: "CH", rmId: ids.RM });
    expect(kyc.status).toBe(201);

    // ── CPSI : client enregistré + un signal — le score se lit avec sa jauge R250 ──
    await request(http).post("/v1/cpsi/clients").set(bearer(TENANT_GWB, ids.CO, "CO"))
      .send({ clientId: clients[0], statique: { pep: false, pays_risque: 0 } }).expect(201);
    await request(http).post(`/v1/cpsi/clients/${clients[0]}/signals`).set(bearer(TENANT_GWB, ids.CO, "CO"))
      .send({ type: "hit_screening", severite: 1 }).expect(201);
    const score = await request(http).get(`/v1/cpsi/clients/${clients[0]}/score`).set(bearer(TENANT_GWB, ids.CO, "CO"));
    expect(score.status).toBe(200);

    // ── CoC : un type au registre + un dossier ouvert (CC-01) ──
    await request(http).post("/v1/coc/config").set(bearer(TENANT_GWB, ids.CO_SR, "CO_SR"))
      .send({ typeCode: "ADDRESS_CHANGE", libelle: "Changement d'adresse", materialite: "BASSE",
        actionRequise: "PRISE_CONNAISSANCE", roleTraitant: "RM" }).expect(201);
    await request(http).post("/v1/coc").set(bearer(TENANT_GWB, ids.RM, "RM"))
      .send({ clientId: clients[0], typeCode: "ADDRESS_CHANGE",
        description: "Déménagement Zurich → Genève (démo)" }).expect(201);

    // ── OpRisk : un incident au dossier (taxonomie Bâle par défaut) ──
    await request(http).post("/v1/oprisk/incidents").set(bearer(TENANT_GWB, ids.CO, "CO"))
      .send({ titre: "Incident de démonstration", categorie: "EXECUTION_PROCESSUS", severite: 2 }).expect(201);

    // ── La PREUVE du semis — comptée, affichée ──
    const preuve = {
      utilisateurs: await prisma.user.count({ where: { tenantId: TENANT_GWB } }),
      clients: await prisma.client.count({ where: { tenantId: TENANT_GWB } }),
      kycFiles: await prisma.kycFile.count({ where: { tenantId: TENANT_GWB } }),
      cpsiEvents: await prisma.cpsiEvent.count({ where: { tenantId: TENANT_GWB } }),
      cocFiles: await prisma.cocFile.count({ where: { tenantId: TENANT_GWB } }),
      evenements: await prisma.domainEvent.count({ where: { tenantId: TENANT_GWB } }),
    };
    expect(preuve.utilisateurs).toBe(6);
    expect(preuve.clients).toBe(3);
    expect(preuve.kycFiles).toBeGreaterThanOrEqual(1);
    expect(preuve.cocFiles).toBe(1);
    console.log("SEED GWB OK —", JSON.stringify(preuve), `tenant=${TENANT_GWB}`);
  }, 120000);
});
