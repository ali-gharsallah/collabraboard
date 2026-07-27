/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 16 (MOD Tâches, R239→R242).
 * Exécutés contre le VRAI backend. Spec-first depuis le Gherkin TA-01..06 (ratifié « OK pour R239..R246 »).
 * Naissance par événement (R239) ; création manuelle gouvernée (R239) ; visibilité scopée serveur (R240) ;
 * complétion événementielle immuable + habilitée (R241) ; SLA mesuré jamais coercitif (R242/R39).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT Vague 16 — MOD Tâches (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const TID = randomUUID();
  const U1 = randomUUID(), U2 = randomUUID(), BRM = randomUUID(), CO = randomUUID();

  const setS = (s: any) => prisma.tenant.update({ where: { id: TID }, data: { settings: s } });
  const mkUser = (id: string, role: string) => prisma.user.create({ data: { id, tenantId: TID, email: `${id}@t.ch`, role: role as any, name: role, passwordHash: "x" } });

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, TID, randomUUID());
    await mkUser(U1, "RM"); await mkUser(U2, "RM"); await mkUser(BRM, "BRM"); await mkUser(CO, "CO");
    await setS({ taskManualCreation: false, taskVisibiliteRoles: ["CO"], workloadResponsables: [{ responsableRole: "BRM", equipeRole: "RM" }], taskCompleteRoles: [] });
  });
  afterAll(async () => { await app.close(); });

  it("TA-01 [R239] naissance par événement uniquement (TASK_CREATED)", async () => {
    const t = await request(http).post("/v1/tasks/from-event").set(bearer(TID, CO, "CO"))
      .send({ origine: "KYC_SECTION_REJECTED", type: "REVUE_KYC", subjectType: "KYC", subjectId: "kyc-1", assignee: U1 });
    expect(t.status).toBe(201);
    expect(t.body.statut).toBe("OPEN");
    expect(t.body.subjectId).toBe("kyc-1");
    const ev = await prisma.domainEvent.findMany({ where: { tenantId: TID, type: "task.created", aggregateId: t.body.id } });
    expect(ev.length).toBe(1);
    console.log("TA-01 PASS — tâche OPEN née de l'événement KYC_SECTION_REJECTED, TASK_CREATED tracé");
  });

  it("TA-02 [R239] création manuelle désactivée par paramètre", async () => {
    const r = await request(http).post("/v1/tasks").set(bearer(TID, CO, "CO")).send({ type: "AD_HOC", assignee: U1 });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain("TASK_MANUAL_CREATION_DISABLED");
    console.log("TA-02 PASS — création manuelle refusée (taskManualCreation=false)");
  });

  it("TA-03 [R240] visibilité scopée serveur : soi / équipe / tout", async () => {
    for (let i = 0; i < 3; i++) await request(http).post("/v1/tasks/from-event").set(bearer(TID, CO, "CO"))
      .send({ origine: "EVT", type: "T", assignee: U1 });
    await request(http).post("/v1/tasks/from-event").set(bearer(TID, CO, "CO")).send({ origine: "EVT", type: "T", assignee: U2 });
    const vU1 = await request(http).get("/v1/tasks").set(bearer(TID, U1, "RM"));
    expect(vU1.body.every((t: any) => t.assignee === U1)).toBe(true);          // ne voit que les siennes
    const vBRM = await request(http).get("/v1/tasks").set(bearer(TID, BRM, "BRM"));
    const ass = new Set(vBRM.body.map((t: any) => t.assignee));
    expect(ass.has(U1) && ass.has(U2)).toBe(true);                             // responsable → son équipe
    const vCO = await request(http).get("/v1/tasks").set(bearer(TID, CO, "CO"));
    expect(new Set(vCO.body.map((t: any) => t.assignee)).size).toBeGreaterThanOrEqual(2);   // voit tout
    // aucun paramètre ne permet d'élargir son propre périmètre
    const triche = await request(http).get(`/v1/tasks?assignee=${U2}`).set(bearer(TID, U1, "RM"));
    expect(triche.body.every((t: any) => t.assignee === U1)).toBe(true);
    console.log("TA-03 PASS — RM voit les siennes, BRM son équipe, CO tout ; périmètre non élargissable");
  });

  it("TA-04 [R241] complétion événementielle immuable", async () => {
    const t = (await request(http).post("/v1/tasks/from-event").set(bearer(TID, CO, "CO")).send({ origine: "EVT", type: "T", assignee: U1 })).body;
    const done = await request(http).post(`/v1/tasks/${t.id}/complete`).set(bearer(TID, U1, "RM")).send({ comment: "OK" });
    expect(done.status).toBe(201);
    expect(done.body.statut).toBe("COMPLETED");
    const ev = await prisma.domainEvent.findMany({ where: { tenantId: TID, type: "task.completed", aggregateId: t.id } });
    expect((ev[0].payload as any).acteur).toBe(U1);
    const again = await request(http).post(`/v1/tasks/${t.id}/complete`).set(bearer(TID, U1, "RM")).send({});
    expect(again.status).toBe(409);
    expect(JSON.stringify(again.body)).toContain("TASK_ALREADY_COMPLETED");
    console.log("TA-04 PASS — complétion TASK_COMPLETED { acteur }, re-complétion refusée (immuable)");
  });

  it("TA-05 [R241] habilitation de complétion (assignee ou rôle paramétré)", async () => {
    await setS({ ...(await prisma.tenant.findFirst({ where: { id: TID } }))!.settings as any, taskCompleteRoles: ["CO"] });
    const t = (await request(http).post("/v1/tasks/from-event").set(bearer(TID, CO, "CO")).send({ origine: "EVT", type: "T", assignee: U1 })).body;
    const u2 = await request(http).post(`/v1/tasks/${t.id}/complete`).set(bearer(TID, U2, "RM")).send({});   // ni assignee ni rôle habilité
    expect(u2.status).toBe(403);
    expect(JSON.stringify(u2.body)).toContain("TASK_COMPLETE_FORBIDDEN");
    const co = await request(http).post(`/v1/tasks/${t.id}/complete`).set(bearer(TID, CO, "CO")).send({});   // rôle habilité, ≠ assignee
    expect(co.status).toBe(201);
    expect(co.body.completedBy).toBe(CO);
    console.log("TA-05 PASS — U2 refusé (TASK_COMPLETE_FORBIDDEN), CO habilité complète (acteur tracé ≠ assignee)");
  });

  it("TA-06 [R242/R39] SLA mesuré, jamais coercitif", async () => {
    const t = (await request(http).post("/v1/tasks/from-event").set(bearer(TID, CO, "CO")).send({ origine: "EVT", type: "T", assignee: U1, echeance: "2026-01-01" })).body;
    const m = await request(http).post("/v1/tasks/sla/tick").set(bearer(TID, CO, "CO")).send({ now: "2026-01-04T00:00:00Z" });
    expect(m.body.enRetard).toBeGreaterThanOrEqual(1);
    expect(m.body.bloque).toBe(false);
    // la tâche reste OPEN et complétable
    const encore = await request(http).post(`/v1/tasks/${t.id}/complete`).set(bearer(TID, U1, "RM")).send({});
    expect(encore.status).toBe(201);
    console.log(`TA-06 PASS — ${m.body.enRetard} tâche(s) en retard notifiée(s), rien n'est bloqué`);
  });
});
