/**
 * FAT — Bloc OFFBOARDING R267→R271 (OF-01..12), canon `spec/canon-vague-ecrans-pilote.md`
 * partie 5 (ratifié 2026-07-27), contre le VRAI backend (Postgres réel, RLS).
 * R267 : la clôture est un workflow tracé — jamais une suppression ; CLOTUREE = lecture
 * seule intégrale pour la rétention (LBA art. 7) ; l'annulation est tracée, pas effacée.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT OFFBOARDING — R267 workflow + rétention (OF-01, OF-10, OF-12)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const RM = randomUUID(), CO = randomUUID(), CO2 = randomUUID();

  const creerKyc = async (clientId: string) =>
    (await request(http).post("/v1/kyc").set(bearer(T, RM, "RM"))
      .send({ clientId, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM })).body;
  const clore = async (clientId: string) => {
    const o = (await request(http).post("/v1/offboarding").set(bearer(T, CO, "CO"))
      .send({ clientId, type: "DECISION_BANQUE", motif: "Relation non rentable" })).body;
    await request(http).post(`/v1/offboarding/${o.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "EN_CLOTURE" }).expect(201);
    await request(http).post(`/v1/offboarding/${o.id}/visa`).set(bearer(T, CO2, "CO")).expect(201);  // R268 — visa CO (pas l'initiateur, R13)
    await request(http).post(`/v1/offboarding/${o.id}/attestation-avoirs`).set(bearer(T, CO2, "CO"))
      .send({ motif: "Comptes soldés, relevés archivés" }).expect(201);                              // R269 — port core absent
    await request(http).post(`/v1/offboarding/${o.id}/transition`).set(bearer(T, CO2, "CO")).send({ vers: "CLOTUREE" }).expect(201);
    return o.id;
  };

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("OF-01 [R267] clôturer ne supprime RIEN : comptages identiques, seul le statut change", async () => {
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    const kyc = await creerKyc(clientId);
    expect(kyc.code).toBeTruthy();
    const compte = async () => ({
      clients: await prisma.client.count({ where: { tenantId: T } }),
      kycs: await prisma.kycFile.count({ where: { tenantId: T } }),
      questions: await prisma.kycQuestion.count({ where: { section: { kycFile: { tenantId: T } } } }),
      visas: await prisma.kycVisa.count({ where: { kycFile: { tenantId: T } } }),
    });
    const avant = await compte();
    const offId = await clore(clientId);
    const apres = await compte();
    expect(apres).toEqual(avant);                                          // aucune ligne métier supprimée
    const off = await prisma.offboardingFile.findFirst({ where: { id: offId } });
    expect(off!.statut).toBe("CLOTUREE");                                  // le statut seul a changé
    expect(off!.clotureEffectiveAt).toBeTruthy();
    expect(off!.retentionJusqua).toBeTruthy();                             // rétention posée (défaut 10 ans)
    const annees = (new Date(off!.retentionJusqua!).getFullYear()) - new Date().getFullYear();
    expect(annees).toBe(10);                                               // LBA art. 7
    console.log("OF-01 PASS — comptages identiques, statut CLOTUREE, rétention", String(off!.retentionJusqua).slice(0, 10));
  });

  it("OF-10 [R267] clôturé = lecture seule intégrale : écritures refusées typées, consultation et rejeu OK", async () => {
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    const kyc = await creerKyc(clientId);
    await clore(clientId);
    // Écriture sur le KYC → refus typé
    const w1 = await request(http).patch(`/v1/kyc/${kyc.code}/questions/IDE-Q1`).set(bearer(T, RM, "RM")).send({ answer: "tentative" });
    expect(w1.status).toBe(409);
    expect(JSON.stringify(w1.body)).toContain("OFFBOARDING_LECTURE_SEULE");
    // Nouveau KYC direct → refus (le retour passe par un nouvel onboarding, R271)
    const w2 = await request(http).post("/v1/kyc").set(bearer(T, RM, "RM"))
      .send({ clientId, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM });
    expect(w2.status).toBe(409);
    // Visa → refus
    const w3 = await request(http).post(`/v1/kyc/${kyc.code}/visas/IDENTITY`).set(bearer(T, CO, "CO")).send({});
    expect(w3.status).toBe(409);
    // La consultation et le rejeu à date FONCTIONNENT (jamais d'amputation de l'audit)
    await request(http).get(`/v1/kyc/${kyc.code}`).set(bearer(T, CO, "CO")).expect(200);
    const aDate = await request(http).get(`/v1/kyc/${kyc.code}/a-date?date=${new Date().toISOString()}`).set(bearer(T, CO, "CO"));
    expect(aDate.status).toBe(200);
    expect(aDate.body.existeADate).toBe(true);
    // La bannière est servie (fait calculé, jamais stocké sur le client)
    const st = (await request(http).get(`/v1/offboarding/statut/${clientId}`).set(bearer(T, RM, "RM"))).body;
    expect(st.cloture).toBe(true);
    expect(st.retentionJusqua).toBeTruthy();
    console.log("OF-10 PASS — écritures 409 OFFBOARDING_LECTURE_SEULE, lecture + rejeu + bannière OK");
  });

  it("OF-12 [R267] l'annulation est TRACÉE, pas effacée : motif obligatoire, demande + annulation au trail", async () => {
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    const o = (await request(http).post("/v1/offboarding").set(bearer(T, CO, "CO"))
      .send({ clientId, type: "DEMANDE_CLIENT", motif: "Le client part chez un concurrent" })).body;
    // Sans motif → refus typé (R7)
    await request(http).post(`/v1/offboarding/${o.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "CLOTURE_ANNULEE" }).expect(400);
    // Avec motif → CLOTURE_ANNULEE, le dossier redevient ACTIVE
    await request(http).post(`/v1/offboarding/${o.id}/transition`).set(bearer(T, CO, "CO"))
      .send({ vers: "CLOTURE_ANNULEE", motif: "Le client renonce à son départ" }).expect(201);
    const st = (await request(http).get(`/v1/offboarding/statut/${clientId}`).set(bearer(T, CO, "CO"))).body;
    expect(st.cloture).toBe(false);
    // La demande ET son annulation restent au trail — rien n'est effacé
    const evs = await prisma.domainEvent.findMany({ where: { tenantId: T, aggregateId: o.id } });
    expect(evs.some((e: any) => e.type === "offboarding.demande")).toBe(true);
    const annul = evs.find((e: any) => e.type === "offboarding.transition" && (e.payload as any).vers === "CLOTURE_ANNULEE");
    expect(annul).toBeTruthy();
    expect((annul!.payload as any).motif).toContain("renonce");
    const off = await prisma.offboardingFile.findFirst({ where: { id: o.id } });
    expect(off!.statut).toBe("CLOTURE_ANNULEE");
    expect(off!.motifAnnulation).toContain("renonce");
    // Terminal : aucune transition depuis CLOTURE_ANNULEE ; une NOUVELLE demande est possible
    await request(http).post(`/v1/offboarding/${o.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "EN_CLOTURE" }).expect(400);
    const o2 = await request(http).post("/v1/offboarding").set(bearer(T, CO, "CO"))
      .send({ clientId, type: "DEMANDE_CLIENT", motif: "Départ confirmé cette fois" });
    expect(o2.status).toBe(201);
    console.log("OF-12 PASS — annulation motivée tracée, dossier ACTIVE, nouvelle demande possible");
  });

  it("OF-02 [R268] le type impose visas ET documents : refus typé listant les manquants", async () => {
    // EXIT_COMPLIANCE : visas CO_SR + DIR (Head PB → DIR, mapping ratifié) requis
    const c1 = randomUUID();
    await seedTenantClient(prisma, T, c1);
    const CO_SR = randomUUID(), DIR = randomUUID();
    const o1 = (await request(http).post("/v1/offboarding").set(bearer(T, CO, "CO"))
      .send({ clientId: c1, type: "EXIT_COMPLIANCE", motif: "Soupçon LBA fondé, communication en cours" })).body;
    await request(http).post(`/v1/offboarding/${o1.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "EN_CLOTURE" }).expect(201);
    const r1 = await request(http).post(`/v1/offboarding/${o1.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "CLOTUREE" });
    expect(r1.status).toBe(400);
    expect(r1.body.message).toContain("visa CO_SR");
    expect(r1.body.message).toContain("visa DIR");                          // TOUS les manquants, pas le premier
    await request(http).post(`/v1/offboarding/${o1.id}/visa`).set(bearer(T, CO_SR, "CO_SR")).expect(201);
    const r1b = await request(http).post(`/v1/offboarding/${o1.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "CLOTUREE" });
    expect(r1b.status).toBe(400);
    expect(r1b.body.message).toContain("visa DIR");
    expect(r1b.body.message).not.toContain("visa CO_SR");                   // signé — sorti de la liste
    await request(http).post(`/v1/offboarding/${o1.id}/visa`).set(bearer(T, DIR, "DIR")).expect(201);
    await request(http).post(`/v1/offboarding/${o1.id}/attestation-avoirs`).set(bearer(T, CO, "CO")).send({ motif: "Comptes soldés" }).expect(201);
    await request(http).post(`/v1/offboarding/${o1.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "CLOTUREE" }).expect(201);
    // DEMANDE_CLIENT : l'instruction de transfert signée est un document REQUIS
    const c2 = randomUUID();
    await seedTenantClient(prisma, T, c2);
    const o2 = (await request(http).post("/v1/offboarding").set(bearer(T, CO, "CO"))
      .send({ clientId: c2, type: "DEMANDE_CLIENT", motif: "Départ volontaire" })).body;
    await request(http).post(`/v1/offboarding/${o2.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "EN_CLOTURE" }).expect(201);
    await request(http).post(`/v1/offboarding/${o2.id}/visa`).set(bearer(T, CO2, "CO")).expect(201);
    const r2 = await request(http).post(`/v1/offboarding/${o2.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "CLOTUREE" });
    expect(r2.status).toBe(400);
    expect(r2.body.message).toContain("document INSTRUCTION_TRANSFERT_SIGNEE");
    await request(http).post(`/v1/offboarding/${o2.id}/documents`).set(bearer(T, CO, "CO"))
      .send({ type: "INSTRUCTION_TRANSFERT_SIGNEE", ref: "GED-123" }).expect(201);
    await request(http).post(`/v1/offboarding/${o2.id}/attestation-avoirs`).set(bearer(T, CO, "CO")).send({ motif: "Transfert exécuté" }).expect(201);
    await request(http).post(`/v1/offboarding/${o2.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "CLOTUREE" }).expect(201);
    console.log("OF-02 PASS — refus typés listant visas et documents manquants, clôtures après complétion");
  });

  it("OF-03 [R268/R13] four-eyes : l'initiateur ne peut pas apposer le visa FINAL", async () => {
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    const o = (await request(http).post("/v1/offboarding").set(bearer(T, CO, "CO"))
      .send({ clientId, type: "DECISION_BANQUE", motif: "Dé-risking sectoriel" })).body;
    expect((o.visas as any[]).length).toBe(1);                              // un seul visa CO → il est FINAL
    const r = await request(http).post(`/v1/offboarding/${o.id}/visa`).set(bearer(T, CO, "CO"));
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).toContain("R13");
    await request(http).post(`/v1/offboarding/${o.id}/visa`).set(bearer(T, CO2, "CO")).expect(201); // un second signe
    console.log("OF-03 PASS — visa final refusé à l'initiateur (403 R13), accordé à un second");
  });

  it("OF-05 [R269] le gel sanctions bloque — MÊME pour ADMIN", async () => {
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    const rc = await prisma.riskCase.create({ data: { tenantId: T, clientId, statut: "CLOTUREE",
      etatDepuis: new Date(), signalIds: ["SIG-GEL"], ouvertPar: CO, motifTerminal: "instruit", terminePar: CO2 } });
    await prisma.mrosCommunication.create({ data: { tenantId: T, riskCaseId: rc.id, clientId,
      decision: "COMMUNIQUER", motif: "soupçon fondé", decidePar: CO, decideAt: new Date(),
      pieces: [], dossierSha256: "0".repeat(64), gelActif: true, notification: "notifiée" } });
    const o = (await request(http).post("/v1/offboarding").set(bearer(T, CO, "CO"))
      .send({ clientId, type: "DECISION_BANQUE", motif: "Sortie de relation" })).body;
    await request(http).post(`/v1/offboarding/${o.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "EN_CLOTURE" }).expect(201);
    await request(http).post(`/v1/offboarding/${o.id}/visa`).set(bearer(T, CO2, "CO")).expect(201);
    await request(http).post(`/v1/offboarding/${o.id}/attestation-avoirs`).set(bearer(T, CO2, "CO")).send({ motif: "soldé" }).expect(201);
    for (const role of ["CO", "ADMIN"]) {                                    // aucun contournement, même ADMIN
      const r = await request(http).post(`/v1/offboarding/${o.id}/transition`)
        .set(bearer(T, randomUUID(), role)).send({ vers: "CLOTUREE" });
      expect(r.status).toBe(400);
      expect(r.body.message).toContain("gel sanctions/SECO actif");
    }
    console.log("OF-05 PASS — gel SECO : clôture refusée pour CO ET pour ADMIN");
  });

  it("OF-04+OF-06a [R269] port core ABSENT : les obstacles sont TOUS listés ; l'attestation est visée, tracée — jamais un silence", async () => {
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    const rc = await prisma.riskCase.create({ data: { tenantId: T, clientId, statut: "EN_ANALYSE",
      etatDepuis: new Date(), signalIds: ["SIG-OF04"], ouvertPar: CO } });
    const o = (await request(http).post("/v1/offboarding").set(bearer(T, CO, "CO"))
      .send({ clientId, type: "DECISION_BANQUE", motif: "Dé-risking" })).body;
    await request(http).post(`/v1/offboarding/${o.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "EN_CLOTURE" }).expect(201);
    await request(http).post(`/v1/offboarding/${o.id}/visa`).set(bearer(T, CO2, "CO")).expect(201);
    // Refus listant LES DEUX obstacles (risk case + avoirs) — pas le premier trouvé
    const r1 = await request(http).post(`/v1/offboarding/${o.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "CLOTUREE" });
    expect(r1.status).toBe(400);
    expect(r1.body.message).toContain(`risk case ouvert ${rc.id}`);
    expect(r1.body.message).toContain("attestation manuelle visée requise");
    // La checklist du détail est la même vérité
    const d = (await request(http).get(`/v1/offboarding/${o.id}`).set(bearer(T, CO, "CO"))).body;
    expect(d.obstacles.length).toBe(2);
    // Lever le risk case → il ne reste qu'UN obstacle
    await request(http).post(`/v1/riskcases/${rc.id}/transition`).set(bearer(T, CO2, "CO"))
      .send({ vers: "CLOTUREE", motif: "instruit sans suite" }).expect(201);
    const r2 = await request(http).post(`/v1/offboarding/${o.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "CLOTUREE" });
    expect(r2.status).toBe(400);
    expect(r2.body.message).not.toContain("risk case");
    expect(r2.body.message).toContain("attestation");
    // Attestation sans motif → refus (R7) ; avec motif → événement tracé, puis clôture
    await request(http).post(`/v1/offboarding/${o.id}/attestation-avoirs`).set(bearer(T, CO2, "CO")).send({}).expect(400);
    await request(http).post(`/v1/offboarding/${o.id}/attestation-avoirs`).set(bearer(T, CO2, "CO"))
      .send({ motif: "Relevés vérifiés à la main, soldes nuls" }).expect(201);
    const ev = await prisma.domainEvent.findFirst({ where: { tenantId: T, aggregateId: o.id, type: "offboarding.attestation_avoirs" } });
    expect(ev).toBeTruthy();
    expect((ev!.payload as any).par).toBe(CO2);
    await request(http).post(`/v1/offboarding/${o.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "CLOTUREE" }).expect(201);
    console.log("OF-04+OF-06a PASS — 2 obstacles listés, puis 1 ; attestation motivée tracée, clôture");
  });
});

describe("FAT OFFBOARDING — R269/OF-06b avec PORT CORE (port de test, jamais en prod)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const CO = randomUUID(), CO2 = randomUUID();

  beforeAll(async () => {
    process.env.OFFB_FAKE_CORE = "1";                                       // port présent pour CE boot
    process.env.OFFB_FAKE_CORE_SOLDES = "[]";
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { delete process.env.OFFB_FAKE_CORE; delete process.env.OFFB_FAKE_CORE_SOLDES; await app.close(); });

  it("OF-06b [R269] port core PRÉSENT : le solde réel décide ; l'attestation manuelle est refusée", async () => {
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    process.env.OFFB_FAKE_CORE_SOLDES = JSON.stringify([{ clientId, compte: "CH93-0000", solde: 12500 }]);
    const o = (await request(http).post("/v1/offboarding").set(bearer(T, CO, "CO"))
      .send({ clientId, type: "DECISION_BANQUE", motif: "Sortie" })).body;
    await request(http).post(`/v1/offboarding/${o.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "EN_CLOTURE" }).expect(201);
    await request(http).post(`/v1/offboarding/${o.id}/visa`).set(bearer(T, CO2, "CO")).expect(201);
    // Solde ≠ 0 → obstacle nominatif ; l'attestation manuelle NE remplace PAS le port
    const r1 = await request(http).post(`/v1/offboarding/${o.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "CLOTUREE" });
    expect(r1.status).toBe(400);
    expect(r1.body.message).toContain("avoirs non transférés");
    expect(r1.body.message).toContain("12500");
    const att = await request(http).post(`/v1/offboarding/${o.id}/attestation-avoirs`).set(bearer(T, CO2, "CO")).send({ motif: "tentative" });
    expect(att.status).toBe(400);
    expect(att.body.message).toContain("port core banking connecté");
    // Avoirs transférés (solde 0 côté core) → la clôture passe SANS attestation
    process.env.OFFB_FAKE_CORE_SOLDES = JSON.stringify([{ clientId, compte: "CH93-0000", solde: 0 }]);
    await request(http).post(`/v1/offboarding/${o.id}/transition`).set(bearer(T, CO, "CO")).send({ vers: "CLOTUREE" }).expect(201);
    console.log("OF-06b PASS — solde réel bloque puis libère ; attestation refusée port présent");
  });
});
