/**
 * FAT — Cycle de vie du CoC R276→R278 (CC-01..08), canon débloquants Home partie 2
 * (R276 ÉTENDU ratifié : ce bloc CRÉE le store COC_CONFIG). Contre le VRAI backend :
 * valeurs figées à l'ouverture, grandfathering à la reconfiguration, vérification d'action à la
 * clôture, four-eyes HAUTE, caducité... rien de silencieux, tout rejouable.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT COC — R276→R278 : le CoC est un dossier à cycle de vie (CC-01..08)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const RM = randomUUID(), CO = randomUUID(), CO2 = randomUUID(), COSR = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("CC-01 [R276] l'ouverture FIGE et SIGNALE : valeurs copiées + config_version_at + signal CPSI rattaché au dossier", async () => {
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    await request(http).post("/v1/cpsi/clients").set(bearer(T, CO, "CO")).send({ clientId }).expect(201);
    const d = (await request(http).post("/v1/coc").set(bearer(T, RM, "RM"))
      .send({ clientId, typeCode: "UBO_CHANGE", description: "Nouvel UBO identifié : 30 % via holding" })).body;
    expect(d.statut).toBe("OUVERT");
    expect(d.materialite).toBe("HAUTE");                                    // FIGÉ depuis la table livrée
    expect(d.actionRequise).toBe("REVISION_KYC");
    expect(d.roleTraitant).toBe("CO");
    expect(d.configVersionAt).toBeTruthy();                                 // la preuve de la version appliquée
    // Le signal CPSI coc_sensible est ÉMIS avec la référence au dossier
    const sig = await prisma.cpsiEvent.findFirst({ where: { tenantId: T, clientId, type: "cpsi.signal.ingested" } });
    expect(sig).toBeTruthy();
    expect((sig!.payload as any).signal).toBe("coc_sensible");
    expect((sig!.payload as any).meta.cocFileId).toBe(d.id);                // RATTACHÉ (plus un signal orphelin)
    console.log("CC-01 PASS — HAUTE/REVISION_KYC figés, signal CPSI rattaché", d.id.slice(0, 8));
  });

  it("CC-02 [R276/R29] reconfigurer ne REQUALIFIE pas : le type passe HAUTE→MOYENNE, le dossier d'avant reste HAUTE", async () => {
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    const avant = (await request(http).post("/v1/coc").set(bearer(T, RM, "RM"))
      .send({ clientId, typeCode: "PEP_STATUS", description: "Statut PEP acquis (mandat cantonal)" })).body;
    expect(avant.materialite).toBe("HAUTE");
    // Reconfiguration versionnée au jour J (registre append-only)
    await request(http).post("/v1/coc/config").set(bearer(T, COSR, "CO_SR"))
      .send({ typeCode: "PEP_STATUS", libelle: "Statut PEP (révisé)", materialite: "MOYENNE",
        actionRequise: "MAJ_CIBLEE", roleTraitant: "CO" }).expect(201);
    const inchange = await prisma.cocFile.findFirst({ where: { id: avant.id } });
    expect(inchange!.materialite).toBe("HAUTE");                            // le CoC d'hier se juge aux règles d'hier
    expect(inchange!.actionRequise).toBe("REVISION_KYC");
    const apres = (await request(http).post("/v1/coc").set(bearer(T, RM, "RM"))
      .send({ clientId: (await (async () => { const c = randomUUID(); await seedTenantClient(prisma, T, c); return c; })()),
        typeCode: "PEP_STATUS", description: "Nouveau cas après reconfiguration" })).body;
    expect(apres.materialite).toBe("MOYENNE");                              // un CoC ouvert APRÈS J est MOYENNE
    console.log("CC-02 PASS — grandfathering : HAUTE avant J, MOYENNE après J");
  });

  it("CC-07 [R7] NON_RETENU exige un motif : refus typé sans, contrainte SQL en prime ; avec motif la chaîne reste", async () => {
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    const d = (await request(http).post("/v1/coc").set(bearer(T, RM, "RM"))
      .send({ clientId, typeCode: "ADDRESS_CHANGE", description: "Adresse signalée, en fait inchangée" })).body;
    await request(http).post(`/v1/coc/${d.id}/transition`).set(bearer(T, RM, "RM")).send({ vers: "NON_RETENU" }).expect(400);
    // La CONTRAINTE SQL elle-même refuse (pas seulement le service)
    await expect(prisma.cocFile.update({ where: { id: d.id }, data: { statut: "NON_RETENU" } })).rejects.toThrow();
    await request(http).post(`/v1/coc/${d.id}/transition`).set(bearer(T, RM, "RM"))
      .send({ vers: "NON_RETENU", motif: "Vérification faite : le registre était déjà à jour" }).expect(201);
    const evs = await prisma.domainEvent.findMany({ where: { tenantId: T, aggregateId: d.id } });
    expect(evs.some((e: any) => e.type === "COC_OUVERT")).toBe(true);
    expect(evs.some((e: any) => e.type === "COC_NON_RETENU" && (e.payload as any).motif)).toBe(true);
    console.log("CC-07 PASS — 400 sans motif, CHECK SQL, chaîne au journal");
  });

  it("CC-03+CC-06 [R277/R13] HAUTE sans révision ne se clôt pas ; le rôle du type traite ; four-eyes réel", async () => {
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    const d = (await request(http).post("/v1/coc").set(bearer(T, RM, "RM"))
      .send({ clientId, typeCode: "UBO_CHANGE", description: "Cession de parts — nouvel UBO 40 %" })).body;
    // CC-06 : un RM tente de traiter un type CO → refus
    await request(http).post(`/v1/coc/${d.id}/traiter`).set(bearer(T, RM, "RM")).send({}).expect(403);
    // CC-03 : TRAITE sans revision_kyc_id → refus LISTANT le manquant
    const ko = await request(http).post(`/v1/coc/${d.id}/traiter`).set(bearer(T, CO, "CO")).send({});
    expect(ko.status).toBe(400);
    expect(ko.body.message).toContain("révision KYC manquante");
    // Créer le KYC Rn+1 (la révision réelle) puis traiter
    const kyc = (await request(http).post("/v1/kyc").set(bearer(T, RM, "RM"))
      .send({ clientId, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM })).body;
    const r1 = await request(http).post(`/v1/coc/${d.id}/traiter`).set(bearer(T, CO, "CO")).send({ revisionKycId: kyc.id });
    expect(r1.status).toBe(201);
    expect(r1.body.enAttenteDeVisa).toBe(true);                             // four-eyes HAUTE : le premier ENREGISTRE
    // L'initiateur ne peut pas être le second (R13)
    await request(http).post(`/v1/coc/${d.id}/traiter`).set(bearer(T, CO, "CO")).send({}).expect(403);
    await request(http).post(`/v1/coc/${d.id}/traiter`).set(bearer(T, CO2, "CO")).send({}).expect(201);
    const maj = await prisma.cocFile.findFirst({ where: { id: d.id } });
    expect(maj!.statut).toBe("TRAITE");
    expect(maj!.revisionKycId).toBe(kyc.id);                                // vérifiable, pas déclaratif
    console.log("CC-03+06 PASS — refus listé, rôle du type, four-eyes (demandeur ≠ viseur)");
  });

  it("CC-04 [R273] le CoC HAUTE ANTICIPE la review : REVIEW_DEADLINE_ANTICIPEE avec déclencheur coc_haute (RV-04 depuis CC)", async () => {
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    // Une échéance PLANIFIEE existe (KYC approuvé de bout en bout)
    const kyc = (await request(http).post("/v1/kyc").set(bearer(T, RM, "RM"))
      .send({ clientId, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM })).body;
    for (const s of kyc.sections) for (const q of s.questions)
      await request(http).patch(`/v1/kyc/${kyc.code}/questions/${q.code}`).set(bearer(T, RM, "RM")).send({ answer: "ok" });
    for (const v of kyc.visas)
      await request(http).post(`/v1/kyc/${kyc.code}/visas/${v.sectionCode}`).set(bearer(T, randomUUID(), v.requiredRole)).send({});
    await request(http).post(`/v1/kyc/${kyc.code}/validate`).set(bearer(T, COSR, "CO_SR")).send({ engagement: true }).expect(201);   // R14
    const avant = await prisma.reviewDeadline.findFirst({ where: { tenantId: T, clientId, statut: "PLANIFIEE" } });
    // Ouverture d'un CoC HAUTE → l'échéance est ANTICIPÉE (événement RV-04, déclencheur tracé)
    await request(http).post("/v1/coc").set(bearer(T, RM, "RM"))
      .send({ clientId, typeCode: "SANCTION_EXPOSURE", description: "Exposition indirecte détectée" }).expect(201);
    const ancienne = await prisma.reviewDeadline.findFirst({ where: { id: avant!.id } });
    expect(ancienne!.statut).toBe("REMPLACEE");
    const ev = await prisma.domainEvent.findFirst({ where: { tenantId: T, type: "REVIEW_DEADLINE_ANTICIPEE", aggregateId: ancienne!.remplacePar! } });
    expect((ev!.payload as any).declencheur).toBe("coc_haute");
    const nouvelle = await prisma.reviewDeadline.findFirst({ where: { id: ancienne!.remplacePar! } });
    expect(new Date(nouvelle!.dueDate).getTime()).toBeLessThan(new Date(avant!.dueDate).getTime());
    console.log("CC-04 PASS — échéance anticipée par le CoC HAUTE, déclencheur coc_haute");
  });

  it("CC-05 [R277] MOYENNE : mise à jour RÉFÉRENCÉE ou décision motivée — sans rien, refus", async () => {
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    const d = (await request(http).post("/v1/coc").set(bearer(T, RM, "RM"))
      .send({ clientId, typeCode: "ACTIVITY_CHANGE", description: "Extension d'activité au négoce" })).body;
    expect(d.materialite).toBe("MOYENNE");
    const ko = await request(http).post(`/v1/coc/${d.id}/traiter`).set(bearer(T, CO, "CO")).send({});
    expect(ko.status).toBe(400);
    expect(ko.body.message).toContain("majRefs");
    await request(http).post(`/v1/coc/${d.id}/traiter`).set(bearer(T, CO, "CO"))
      .send({ majRefs: [{ question: "ACT-Q1", kyc: "K-X" }] }).expect(201);  // MOYENNE : pas de four-eyes (défaut)
    expect((await prisma.cocFile.findFirst({ where: { id: d.id } }))!.statut).toBe("TRAITE");
    console.log("CC-05 PASS — refus sans référence, TRAITE avec majRefs");
  });

  it("CC-08 [R278] la chaîne SE REJOUE : déclaration → figés → signal → preuves → clôture, délais au reporting", async () => {
    const d = await prisma.cocFile.findFirst({ where: { tenantId: T, statut: "TRAITE", actionRequise: "REVISION_KYC" } });
    const replay = (await request(http).get(`/v1/coc/${d!.id}/replay`).set(bearer(T, CO, "CO"))).body;
    expect(replay.valeursFigees.materialite).toBe("HAUTE");
    expect(replay.valeursFigees.configVersionAt).toBeTruthy();
    expect(replay.preuves.revisionKycId).toBeTruthy();                       // le KYC référencé
    const types = replay.chaine.map((e: any) => e.type);
    expect(types[0]).toBe("COC_OUVERT");                                     // dans l'ordre
    expect(types).toContain("COC_TRAITEMENT_DEMANDE");
    expect(types[types.length - 1]).toBe("COC_TRAITE");
    // Rejeu À DATE : avant le traitement → la chaîne s'arrête à l'ouverture
    const ouverture = replay.chaine[0].at;
    const aDate = (await request(http).get(`/v1/coc/${d!.id}/replay?as_of=${encodeURIComponent(ouverture)}`).set(bearer(T, CO, "CO"))).body;
    expect(aDate.chaine.length).toBe(1);
    // Reporting : délai par matérialité (mesuré, jamais bloquant)
    const rep = (await request(http).get("/v1/coc/reporting").set(bearer(T, CO, "CO"))).body;
    expect(rep.parMaterialite.HAUTE.n).toBeGreaterThanOrEqual(1);
    expect(rep.slaJours.HAUTE).toBe(10);
    console.log("CC-08 PASS — chaîne ordonnée rejouable à date, délais mesurés");
  });

  it("T8 : la liste sert la tuile — compteur + répartition par matérialité, périmètre serveur", async () => {
    const liste = (await request(http).get("/v1/coc").set(bearer(T, CO, "CO"))).body;
    expect(liste.total).toBeGreaterThanOrEqual(1);                           // les OUVERT/EN_TRAITEMENT restants
    expect(liste.parMaterialite).toBeDefined();
    await request(http).get("/v1/coc").set(bearer(T, randomUUID(), "ADMIN")).expect(403);  // matrice A.3
    console.log("T8 PASS — total", liste.total, "répartition", JSON.stringify(liste.parMaterialite));
  });
});
