/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 17 (MOD Décision NBA, R243→R246).
 * Exécutés contre le VRAI backend. Spec-first depuis le Gherkin NB-01..06 (ratifié « OK pour R239..R246 »).
 * Suggestion immuable une fois proposée (R243) ; décision unique événementielle (R244) ; R44 strict :
 * humain seulement, ZÉRO exécution directe (R245 — la tâche naît du service Tâches, NB-05 ↔ TA-01) ; rejeu (R246).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT Vague 17 — MOD Décision NBA (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const TID = randomUUID(); const U1 = randomUUID(); const U2 = randomUUID(); const SVC = randomUUID();
  const setS = (s: any) => prisma.tenant.update({ where: { id: TID }, data: { settings: s } });
  const proposer = async (subjectId = "client-1") => (await request(http).post("/v1/nba/propose").set(bearer(TID, U1, "CO"))
    .send({ contexte: "client", subjectId, proposition: "Déclencher revue EDD", facteurs: ["pep", "hri", "structuring", "velocity"] })).body;

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, TID, randomUUID());
    await setS({ nbaTtlDays: 30, nbaRejectRationaleRequired: false, taskVisibiliteRoles: ["CO"] });
  });
  afterAll(async () => { await app.close(); });

  it("NB-01 [R243] suggestion immuable une fois proposée (aucune route de modification)", async () => {
    const s = await proposer();
    expect(s.statut).toBe("PROPOSED");
    expect(s.facteurs.length).toBe(4);
    const patch = await request(http).patch(`/v1/nba/${s.id}`).set(bearer(TID, U1, "CO")).send({ proposition: "hack" });
    expect(patch.status).toBe(404);                                          // aucune route d'écriture de modification
    console.log("NB-01 PASS — suggestion PROPOSED immuable (aucune route de modification)");
  });

  it("NB-02 [R244] décision unique", async () => {
    const s = await proposer();
    const d = await request(http).post(`/v1/nba/${s.id}/decision`).set(bearer(TID, U1, "CO")).send({ decision: "ACCEPT" });
    expect(d.status).toBe(201);
    const ev = await prisma.domainEvent.findMany({ where: { tenantId: TID, type: "nba.decided", aggregateId: s.id } });
    expect((ev[0].payload as any).acteur).toBe(U1);
    const again = await request(http).post(`/v1/nba/${s.id}/decision`).set(bearer(TID, U2, "CO")).send({ decision: "REJECT" });
    expect(again.status).toBe(409);
    expect(JSON.stringify(again.body)).toContain("NBA_ALREADY_DECIDED");
    console.log("NB-02 PASS — NBA_DECIDED { acteur } append-only, seconde décision refusée (NBA_ALREADY_DECIDED)");
  });

  it("NB-03 [R244] motif de rejet paramétré", async () => {
    await setS({ ...(await prisma.tenant.findFirst({ where: { id: TID } }))!.settings as any, nbaRejectRationaleRequired: true });
    const s = await proposer();
    const sans = await request(http).post(`/v1/nba/${s.id}/decision`).set(bearer(TID, U1, "CO")).send({ decision: "REJECT" });
    expect(sans.status).toBe(400);
    expect(JSON.stringify(sans.body)).toContain("NBA_REJECT_RATIONALE_REQUIRED");
    const avec = await request(http).post(`/v1/nba/${s.id}/decision`).set(bearer(TID, U1, "CO")).send({ decision: "REJECT", rationale: "hors périmètre client" });
    expect(avec.status).toBe(201);
    console.log("NB-03 PASS — rejet sans motif refusé, rejet motivé accepté");
  });

  it("NB-04 [R244] ajustement non vide", async () => {
    const s = await proposer();
    const vide = await request(http).post(`/v1/nba/${s.id}/decision`).set(bearer(TID, U1, "CO")).send({ decision: "ADJUST" });
    expect(vide.status).toBe(400);
    expect(JSON.stringify(vide.body)).toContain("NBA_ADJUSTMENT_REQUIRED");
    const ok = await request(http).post(`/v1/nba/${s.id}/decision`).set(bearer(TID, U1, "CO")).send({ decision: "ADJUST", adjustment: { delaiJours: 15 } });
    expect(ok.status).toBe(201);
    const g = await request(http).get(`/v1/nba/${s.id}`).set(bearer(TID, U1, "CO"));
    expect(g.body.proposition).toBe("Déclencher revue EDD");                  // proposition d'origine intacte
    console.log("NB-04 PASS — ADJUST sans adjustment refusé ; avec adjustment accepté, proposition intacte");
  });

  it("NB-05 [R245/R44] humain seulement, ZÉRO exécution directe (la tâche naît du service Tâches)", async () => {
    const s = await proposer("client-edd");
    // un compte de service ne peut pas décider
    const svc = await request(http).post(`/v1/nba/${s.id}/decision`).set(bearer(TID, SVC, "SERVICE")).send({ decision: "ACCEPT" });
    expect(svc.status).toBe(403);
    expect(JSON.stringify(svc.body)).toContain("NBA_DECISION_HUMAN_ONLY");
    // un humain accepte → seul effet NBA : NBA_DECIDED ; la tâche naît du service Tâches (TA-01)
    await request(http).post(`/v1/nba/${s.id}/decision`).set(bearer(TID, U1, "CO")).send({ decision: "ACCEPT" }).expect(201);
    const tache = await prisma.task.findMany({ where: { tenantId: TID, subjectId: "client-edd", origine: "NBA_DECIDED" } });
    expect(tache.length).toBe(1);                                            // la tâche est née de l'événement décidé
    const taskCreated = await prisma.domainEvent.findMany({ where: { tenantId: TID, type: "task.created", aggregateId: tache[0].id } });
    expect(taskCreated.length).toBe(1);
    console.log("NB-05 PASS — compte de service refusé (NBA_DECISION_HUMAN_ONLY) ; ACCEPT → NBA_DECIDED, tâche née du service Tâches");
  });

  it("NB-06 [R246] rejeu des suggestions et décisions", async () => {
    // suggestion proposée puis rejetée ; on éprouve le rejeu avant/après la décision
    const s = await proposer("client-rejeu");
    await request(http).post(`/v1/nba/${s.id}/decision`).set(bearer(TID, U1, "CO")).send({ decision: "REJECT", rationale: "n/a" }).expect(201);
    // AVANT toute existence
    const avant = await request(http).get(`/v1/nba/${s.id}?asOf=2000-01-01`).set(bearer(TID, U1, "CO"));
    expect(avant.body.existeADate).toBe(false);
    // APRÈS décision : DECIDED { REJECT } avec acteur
    const apres = await request(http).get(`/v1/nba/${s.id}?asOf=2099-01-01`).set(bearer(TID, U1, "CO"));
    expect(apres.body.statut).toBe("DECIDED");
    expect(apres.body.decision).toBe("REJECT");
    expect(apres.body.decidedBy).toBe(U1);
    console.log("NB-06 PASS — rejeu : inexistante avant création, DECIDED { REJECT, acteur } après décision");
  });
});
