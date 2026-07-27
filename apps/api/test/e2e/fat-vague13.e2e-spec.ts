/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 13 (MOD-43 Formations & Certifications, R231→R238).
 * Exécutés contre le VRAI backend. Spec-first depuis le Gherkin FO-01..08 (ratifié « OK pour R222..R238 »).
 * Référentiel 100% tenant (R231) ; complétion événementielle + attestation (R232) ; append-only (R234) ;
 * validation par visa uniforme R15 / exclusion R13 (R235) ; rappels informatifs (R233/R39) ; rejeu certifiant (R238).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT Vague 13 — MOD-43 Formations & Certifications (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const A = randomUUID(), B = randomUUID();                 // deux tenants
  const RM1 = randomUUID(), RM2 = randomUUID(), BRM = randomUUID(), CO = randomUUID();

  const setSettings = (tid: string, s: any) => prisma.tenant.update({ where: { id: tid }, data: { settings: s } });
  const mkUser = (tid: string, id: string, role: string) => prisma.user.create({ data: {
    id, tenantId: tid, email: `${id}@t.ch`, role: role as any, name: role, passwordHash: "x" } });

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, A, randomUUID());
    await seedTenantClient(prisma, B, randomUUID());
    await mkUser(A, RM1, "RM"); await mkUser(A, RM2, "RM"); await mkUser(A, BRM, "BRM"); await mkUser(A, CO, "CO");
    await setSettings(A, {
      trainingCatalog: [{ code: "AML_ANNUELLE", libelle: "AML annuelle", validiteMois: 12, rolesCibles: ["RM", "CO"], periodicite: "ANNUELLE" }],
      trainingReminderDays: [30, 7],
      workloadResponsables: [{ responsableRole: "BRM", equipeRole: "RM" }],
      trainingVisibiliteRoles: ["CO"],
    });
  });
  afterAll(async () => { await app.close(); });

  it("FO-01 [R231] le référentiel de formation est 100% tenant (aucun type en dur)", async () => {
    const a = await request(http).get("/v1/formations/catalog").set(bearer(A, CO, "CO"));
    expect(a.status).toBe(200);
    expect(a.body.some((f: any) => f.code === "AML_ANNUELLE")).toBe(true);
    const b = await request(http).get("/v1/formations/catalog").set(bearer(B, CO, "CO"));
    expect(b.body.some((f: any) => f.code === "AML_ANNUELLE")).toBe(false);   // tenant B ne l'a pas défini
    console.log("FO-01 PASS — catalogue tenant : A voit AML_ANNUELLE, B ne le voit pas");
  });

  it("FO-02 [R232] complétion événementielle avec attestation (mode AUTO → COMPLETED)", async () => {
    const asg = (await request(http).post("/v1/formations/assignments").set(bearer(A, CO, "CO"))
      .send({ userId: RM1, formationCode: "AML_ANNUELLE", echeance: "2026-12-31" })).body;
    const done = await request(http).post(`/v1/formations/assignments/${asg.id}/complete`).set(bearer(A, RM1, "RM"))
      .send({ attestationDocId: "doc-123" });
    expect(done.status).toBe(201);
    expect(done.body.statut).toBe("COMPLETED");
    const evts = await prisma.domainEvent.findMany({ where: { tenantId: A, type: "training.completed", aggregateId: asg.id } });
    expect(evts.length).toBe(1);
    expect((evts[0].payload as any).docId).toBe("doc-123");
    console.log("FO-02 PASS — complétion AUTO → COMPLETED, événement training.completed { docId }");
  });

  it("FO-03 [R233/R39] rappels J-x informatifs, aucun blocage", async () => {
    await request(http).post("/v1/formations/certifications").set(bearer(A, CO, "CO"))
      .send({ userId: RM1, code: "AML_ANNUELLE", obtenueLe: "2025-10-01", expireLe: "2026-10-01" }).expect(201);
    const t30 = await request(http).post("/v1/formations/rappels/tick").set(bearer(A, CO, "CO")).send({ now: "2026-09-01T00:00:00Z" });
    const t7 = await request(http).post("/v1/formations/rappels/tick").set(bearer(A, CO, "CO")).send({ now: "2026-09-24T00:00:00Z" });
    expect(t30.body.rappels).toBeGreaterThanOrEqual(1);
    expect(t7.body.rappels).toBeGreaterThanOrEqual(1);
    const rem = await prisma.domainEvent.findMany({ where: { tenantId: A, type: "training.reminder" } });
    expect(rem.length).toBeGreaterThanOrEqual(2);
    console.log(`FO-03 PASS — rappels J-30 et J-7 émis (${rem.length} notifications), rien n'est bloqué`);
  });

  it("FO-04 [R234] attestations append-only : deux présentes, UPDATE refusé", async () => {
    const asg = (await request(http).post("/v1/formations/assignments").set(bearer(A, CO, "CO"))
      .send({ userId: RM2, formationCode: "AML_ANNUELLE", echeance: "2025-12-31" })).body;
    await request(http).post(`/v1/formations/assignments/${asg.id}/complete`).set(bearer(A, RM2, "RM")).send({ attestationDocId: "att-2025" }).expect(201);
    await request(http).post(`/v1/formations/assignments/${asg.id}/complete`).set(bearer(A, RM2, "RM")).send({ attestationDocId: "att-2026" }).expect(201);
    const atts = await prisma.trainingAttestation.findMany({ where: { tenantId: A, userId: RM2 } });
    expect(atts.length).toBeGreaterThanOrEqual(2);
    await expect(prisma.trainingAttestation.update({ where: { id: atts[0].id }, data: { docId: "hack" } })).rejects.toThrow();
    console.log(`FO-04 PASS — ${atts.length} attestations conservées, UPDATE refusé (append-only R234)`);
  });

  it("FO-05 [R235/R15] validation par visa (mode VALIDATED)", async () => {
    await setSettings(A, { ...(await prisma.tenant.findFirst({ where: { id: A } }))!.settings as any,
      trainingCompletionValidation: { mode: "VALIDATED", role: "CF" } });
    const asg = (await request(http).post("/v1/formations/assignments").set(bearer(A, CO, "CO"))
      .send({ userId: RM1, formationCode: "AML_ANNUELLE", echeance: "2026-12-31" })).body;
    const dep = await request(http).post(`/v1/formations/assignments/${asg.id}/complete`).set(bearer(A, RM1, "RM")).send({ attestationDocId: "doc-v" });
    expect(dep.body.statut).toBe("IN_PROGRESS");                    // en attente de visa
    expect(dep.body.visaStatut).toBe("PENDING");
    const sign = await request(http).post(`/v1/formations/assignments/${asg.id}/visa`).set(bearer(A, CO, "CF"));
    expect(sign.status).toBe(201);
    expect(sign.body.statut).toBe("COMPLETED");
    console.log("FO-05 PASS — mode VALIDATED : dépôt → IN_PROGRESS/PENDING, visa CF → COMPLETED");
  });

  it("FO-06 [R235/R13] auto-validation interdite", async () => {
    const asg = (await request(http).post("/v1/formations/assignments").set(bearer(A, CO, "CO"))
      .send({ userId: RM2, formationCode: "AML_ANNUELLE", echeance: "2026-12-31" })).body;
    await request(http).post(`/v1/formations/assignments/${asg.id}/complete`).set(bearer(A, RM2, "RM")).send({ attestationDocId: "doc-self" }).expect(201);
    // RM2 tente de valider SA propre complétion, avec le rôle validateur (CF) → R13
    const self = await request(http).post(`/v1/formations/assignments/${asg.id}/visa`).set(bearer(A, RM2, "CF"));
    expect(self.status).toBe(403);
    expect(JSON.stringify(self.body)).toContain("TRAINING_SELF_VALIDATION_FORBIDDEN");
    console.log("FO-06 PASS — l'auteur ne valide pas sa propre formation (R13)");
  });

  it("FO-07 [R236] visibilité par profil : soi / équipe / tout", async () => {
    const vueRM1 = await request(http).get("/v1/formations/assignments").set(bearer(A, RM1, "RM"));
    const uids = (b: any) => new Set(b.map((x: any) => x.userId));
    expect([...uids(vueRM1.body)].every((u) => u === RM1)).toBe(true);          // RM1 ne voit que le sien
    const vueBRM = await request(http).get("/v1/formations/assignments").set(bearer(A, BRM, "BRM"));
    expect(uids(vueBRM.body).has(RM1)).toBe(true);                              // le responsable voit son équipe
    expect(uids(vueBRM.body).has(RM2)).toBe(true);
    const vueCO = await request(http).get("/v1/formations/assignments").set(bearer(A, CO, "CO"));
    expect(uids(vueCO.body).has(RM1) && uids(vueCO.body).has(RM2)).toBe(true);   // CO voit tout
    console.log("FO-07 PASS — RM voit le sien, BRM voit son équipe (RM1,RM2), CO voit tout");
  });

  it("FO-08 [R238] rejeu certifiant depuis l'historique append-only", async () => {
    const U = randomUUID();
    await request(http).post("/v1/formations/certifications").set(bearer(A, CO, "CO"))
      .send({ userId: U, code: "CROSS_BORDER_AE", obtenueLe: "2024-05-01", expireLe: "2025-05-01" }).expect(201);
    await request(http).post("/v1/formations/certifications").set(bearer(A, CO, "CO"))
      .send({ userId: U, code: "CROSS_BORDER_AE", obtenueLe: "2025-06-15", expireLe: "2026-06-15" }).expect(201);
    const r = await request(http).get(`/v1/formations/certifications?userId=${U}&asOf=2025-05-20`).set(bearer(A, CO, "CO"));
    expect(r.body.certifie).toBe(false);                                        // expirée le 05-01, renouvelée le 06-15
    expect(r.body.historique.length).toBe(2);                                   // l'historique justificatif
    console.log("FO-08 PASS — au 2025-05-20 : NON certifié, historique (2 lignes) conservé");
  });
});
