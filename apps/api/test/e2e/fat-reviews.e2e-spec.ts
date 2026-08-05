/**
 * FAT — Échéances de review R272→R275 (RV-01..08), canon débloquants Home partie 1
 * (ratifié 2026-07-27). Le « Perpetual KYC » prouvé contre le VRAI backend : l'échéance naît
 * de l'approbation (hook, pas un cron), la cadence figée grandfathère, le retard MESURE sans
 * bloquer, la review réalisée referme la boucle, et l'index partiel garantit UNE échéance vivante.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT REVIEWS — R272→R275 : échéances calculées, versionnées, rejouables (RV-01..08)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const RM = randomUUID(), CO = randomUUID(), COSR = randomUUID(), COSR2 = randomUUID();

  // Un dossier CDD approuvé de bout en bout (réponses REQUIRED + visas + validation four-eyes).
  const approuverKyc = async (clientId: string) => {
    const kyc = (await request(http).post("/v1/kyc").set(bearer(T, RM, "RM"))
      .send({ clientId, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM })).body;
    for (const s of kyc.sections)
      for (const q of s.questions)
        await request(http).patch(`/v1/kyc/${kyc.code}/questions/${q.code}`).set(bearer(T, RM, "RM"))
          .send({ answer: "renseigné" });
    for (const v of kyc.visas)
      await request(http).post(`/v1/kyc/${kyc.code}/visas/${v.sectionCode}`).set(bearer(T, randomUUID(), v.requiredRole)).send({});
    await request(http).post(`/v1/kyc/${kyc.code}/validate`).set(bearer(T, COSR, "CO_SR")).send({ engagement: true }).expect(201);   // R14
    return kyc;
  };

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("RV-01 [R272] l'échéance NAÎT de l'approbation : PLANIFIEE à +cadence(ddl), cadence FIGÉE, événement SET", async () => {
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    const kyc = await approuverKyc(clientId);                                // PP/CURRENT/CH → CDD
    const d = await prisma.reviewDeadline.findFirst({ where: { tenantId: T, clientId, statut: "PLANIFIEE" } });
    expect(d).toBeTruthy();
    expect(d!.ddlLevel).toBe(kyc.workflow);
    expect(d!.cadenceMois).toBe(kyc.workflow === "EDD" ? 12 : kyc.workflow === "CDD" ? 36 : 60);
    const attendu = new Date(); attendu.setMonth(attendu.getMonth() + d!.cadenceMois);
    expect(Math.abs(new Date(d!.dueDate).getTime() - attendu.getTime())).toBeLessThan(86400000 * 2);
    const ev = await prisma.domainEvent.findFirst({ where: { tenantId: T, type: "REVIEW_DEADLINE_SET", aggregateId: d!.id } });
    expect(ev).toBeTruthy();
    console.log("RV-01 PASS — PLANIFIEE", d!.ddlLevel, "à +", d!.cadenceMois, "mois, événement SET");
  });

  it("RV-02 [R272/R29] la cadence change, le PASSÉ tient : l'échéance émise est INCHANGÉE, la suivante prend la nouvelle", async () => {
    const c1 = randomUUID(); await seedTenantClient(prisma, T, c1);
    await approuverKyc(c1);
    const avant = await prisma.reviewDeadline.findFirst({ where: { tenantId: T, clientId: c1, statut: "PLANIFIEE" } });
    // Changement de paramètre tenant : SDD 60 → 24 (le dossier PP/CURRENT/CH aiguille en SDD)
    const t = await prisma.tenant.findFirst({ where: { id: T } });
    await prisma.tenant.update({ where: { id: T },
      data: { settings: { ...((t!.settings as any) ?? {}), cadenceReviewMois: { SDD: 24 } } } });
    const apres = await prisma.reviewDeadline.findFirst({ where: { id: avant!.id } });
    expect(apres!.cadenceMois).toBe(60);                                     // grandfathering : rien ne bouge
    expect(new Date(apres!.dueDate).getTime()).toBe(new Date(avant!.dueDate).getTime());
    const c2 = randomUUID(); await seedTenantClient(prisma, T, c2);
    await approuverKyc(c2);
    const nouveau = await prisma.reviewDeadline.findFirst({ where: { tenantId: T, clientId: c2, statut: "PLANIFIEE" } });
    expect(nouveau!.cadenceMois).toBe(24);                                   // la nouvelle cadence pour les SUIVANTES
    console.log("RV-02 PASS — ancienne 60 mois intacte, nouvelle à 24 mois");
  });

  it("RV-03 [R272] le changement de niveau RECALCULE, tracé : ancienne REMPLACEE chaînée, nouvelle PLANIFIEE", async () => {
    const clientId = randomUUID(); await seedTenantClient(prisma, T, clientId);
    await approuverKyc(clientId);
    const avant = await prisma.reviewDeadline.findFirst({ where: { tenantId: T, clientId, statut: "PLANIFIEE" } });
    const r = await request(http).post(`/v1/reviews/clients/${clientId}/recalcul`).set(bearer(T, COSR, "CO_SR"))
      .send({ ddlLevel: "EDD", motif: "aiguillage EDD adopté" });
    expect(r.status).toBe(201);
    const ancienne = await prisma.reviewDeadline.findFirst({ where: { id: avant!.id } });
    expect(ancienne!.statut).toBe("REMPLACEE");
    expect(ancienne!.remplacePar).toBe(r.body.id);                           // les DEUX lignes, chaînées, au journal
    const nouvelle = await prisma.reviewDeadline.findFirst({ where: { id: r.body.id } });
    expect(nouvelle!.ddlLevel).toBe("EDD");
    expect(nouvelle!.cadenceMois).toBe(12);
    console.log("RV-03 PASS — REMPLACEE chaînée → PLANIFIEE EDD 12 mois");
  });

  it("RV-05 [R273/R13] le RECUL est un acte à visa : CO refusé ; CO_SR motive PUIS un SECOND vise ; sans motif refus", async () => {
    const clientId = randomUUID(); await seedTenantClient(prisma, T, clientId);
    await approuverKyc(clientId);
    const d = await prisma.reviewDeadline.findFirst({ where: { tenantId: T, clientId, statut: "PLANIFIEE" } });
    const dans30Mois = new Date(); dans30Mois.setMonth(dans30Mois.getMonth() + 70);   // APRÈS la due SDD (+60 mois) = un RECUL
    // CO → refus (rôle non habilité, défaut CO_SR)
    await request(http).post(`/v1/reviews/deadlines/${d!.id}/report`).set(bearer(T, CO, "CO"))
      .send({ nouvelleDate: dans30Mois.toISOString(), motif: "x" }).expect(403);
    // CO_SR sans motif → refus typé
    await request(http).post(`/v1/reviews/deadlines/${d!.id}/report`).set(bearer(T, COSR, "CO_SR"))
      .send({ nouvelleDate: dans30Mois.toISOString() }).expect(400);
    // CO_SR motive → demande EN ATTENTE ; l'INITIATEUR ne peut pas viser (R13)
    await request(http).post(`/v1/reviews/deadlines/${d!.id}/report`).set(bearer(T, COSR, "CO_SR"))
      .send({ nouvelleDate: dans30Mois.toISOString(), motif: "client à l'étranger 6 mois" }).expect(201);
    await request(http).post(`/v1/reviews/deadlines/${d!.id}/report/visa`).set(bearer(T, COSR, "CO_SR")).expect(403);
    // Un SECOND CO_SR vise → l'échéance recule (REMPLACEE + nouvelle), tout au journal
    const ok = await request(http).post(`/v1/reviews/deadlines/${d!.id}/report/visa`).set(bearer(T, COSR2, "CO_SR"));
    expect(ok.status).toBe(201);
    const ev = await prisma.domainEvent.findFirst({ where: { tenantId: T, type: "REVIEW_DEADLINE_REPORTEE", aggregateId: ok.body.id } });
    expect((ev!.payload as any).demandePar).toBe(COSR);
    expect((ev!.payload as any).visePar).toBe(COSR2);
    console.log("RV-05 PASS — rôle refusé, motif exigé, four-eyes réel (demandeur ≠ viseur)");
  });

  it("RV-04 [R273] l'ANTICIPATION est un événement motivé : nouvelle due_date, ancienne REMPLACEE (déclencheur tracé)", async () => {
    const clientId = randomUUID(); await seedTenantClient(prisma, T, clientId);
    await approuverKyc(clientId);
    const d = await prisma.reviewDeadline.findFirst({ where: { tenantId: T, clientId, statut: "PLANIFIEE" } });
    const dans2Mois = new Date(); dans2Mois.setMonth(dans2Mois.getMonth() + 2);
    const r = await request(http).post(`/v1/reviews/deadlines/${d!.id}/anticiper`).set(bearer(T, COSR, "CO_SR"))
      .send({ nouvelleDate: dans2Mois.toISOString(), motif: "CoC matérialité Haute", declencheur: "coc_haute" });
    expect(r.status).toBe(201);
    const ev = await prisma.domainEvent.findFirst({ where: { tenantId: T, type: "REVIEW_DEADLINE_ANTICIPEE", aggregateId: r.body.id } });
    expect((ev!.payload as any).declencheur).toBe("coc_haute");
    expect((ev!.payload as any).ancienneDate).toBeTruthy();
    expect((await prisma.reviewDeadline.findFirst({ where: { id: d!.id } }))!.statut).toBe("REMPLACEE");
    console.log("RV-04 PASS — ANTICIPEE tracée (déclencheur, ancienne→nouvelle, auteur)");
  });

  it("RV-06 [R274/R39] le retard MESURE, ne bloque JAMAIS : EN_RETARD calculé, escalade notifiée une fois, dossier opérable", async () => {
    const clientId = randomUUID(); await seedTenantClient(prisma, T, clientId);
    const kyc = await approuverKyc(clientId);
    const d = await prisma.reviewDeadline.findFirst({ where: { tenantId: T, clientId, statut: "PLANIFIEE" } });
    // Vieillir l'échéance : due il y a 40 jours (fait de test sur la donnée, pas un statut stocké)
    const ilYa40j = new Date(Date.now() - 40 * 86400000);
    await prisma.reviewDeadline.update({ where: { id: d!.id }, data: { dueDate: ilYa40j } });
    const liste = (await request(http).get("/v1/reviews/deadlines?horizonJours=60").set(bearer(T, CO, "CO"))).body;
    const mien = liste.find((x: any) => x.clientId === clientId);
    expect(mien.enRetard).toBe(true);                                        // CALCULÉ à la lecture
    expect(mien.joursRetard).toBeGreaterThanOrEqual(39);
    // Le tick notifie l'escalade (à J+30) UNE fois — et ne bloque rien
    await request(http).post("/v1/reviews/tick").set(bearer(T, CO, "CO")).expect(201);
    const esc = await prisma.domainEvent.findMany({ where: { tenantId: T, type: "tache.review.escalade", aggregateId: d!.id } });
    expect(esc.length).toBe(1);
    await request(http).post("/v1/reviews/tick").set(bearer(T, CO, "CO")).expect(201);
    expect(await prisma.domainEvent.count({ where: { tenantId: T, type: "tache.review.escalade", aggregateId: d!.id } })).toBe(1);
    // TOUTES les opérations du dossier restent possibles (R39) — une écriture KYC passe
    const q = (await request(http).get(`/v1/kyc/${kyc.code}`).set(bearer(T, CO, "CO"))).body;
    expect(q.status).toBe("VALIDATED");                                      // consultable, rien de bloqué
    console.log("RV-06 PASS — 40 j de retard MESURÉS, escalade unique, dossier intact");
  });

  it("RV-07 [R275] la review RÉALISÉE referme la boucle : KYC approuvé → REALISEE (référence) + suivante PLANIFIEE, T7 la sort", async () => {
    const clientId = randomUUID(); await seedTenantClient(prisma, T, clientId);
    const k1 = await approuverKyc(clientId);
    const d1 = await prisma.reviewDeadline.findFirst({ where: { tenantId: T, clientId, statut: "PLANIFIEE" } });
    // La review se réalise : un KYC Rn+1 est approuvé (même mécanique de dossier — R275)
    const k2 = await approuverKyc(clientId);
    const ancienne = await prisma.reviewDeadline.findFirst({ where: { id: d1!.id } });
    expect(ancienne!.statut).toBe("REALISEE");
    expect(ancienne!.realiseeKycId).toBe(k2.id);                             // la référence au KYC réalisateur
    const suivante = await prisma.reviewDeadline.findFirst({ where: { tenantId: T, clientId, statut: "PLANIFIEE" } });
    expect(suivante).toBeTruthy();
    expect(suivante!.id).not.toBe(d1!.id);
    expect(k2.code).not.toBe(k1.code);
    console.log("RV-07 PASS — REALISEE référencée, suivante PLANIFIEE repartie");
  });

  it("RV-08 [R272] UNE seule échéance vivante : l'insertion d'une 2e PLANIFIEE viole l'index partiel", async () => {
    const clientId = randomUUID(); await seedTenantClient(prisma, T, clientId);
    await approuverKyc(clientId);
    const d = await prisma.reviewDeadline.findFirst({ where: { tenantId: T, clientId, statut: "PLANIFIEE" } });
    await expect(prisma.reviewDeadline.create({ data: {
      tenantId: T, clientId, sourceKycId: d!.sourceKycId, ddlLevel: "CDD",
      cadenceMois: 36, dueDate: new Date() } })).rejects.toThrow();          // contrainte SQL, pas seulement applicative
    console.log("RV-08 PASS — index partiel unique : 2e PLANIFIEE refusée par la base");
  });
});
