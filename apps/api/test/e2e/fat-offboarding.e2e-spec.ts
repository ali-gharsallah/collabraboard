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
});
