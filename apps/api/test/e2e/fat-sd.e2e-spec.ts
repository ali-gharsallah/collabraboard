/**
 * FAT — Sections & droits (canon vague pilote partie 4 PARTIELLE, arbitrage ratifié :
 * « sdkyc rendu sur le modèle ACTUEL, SD-04 suspendu + écart versionnage consigné ;
 * sdar/sdgar reportés (écart) ; cocparam séquencé après la PR CoC »). SD-01/02/03 sur le
 * vrai backend ; SD-05 est prouvé côté écran (Vitest, aucune écriture) ; SD-06 = garde
 * backend du store COC_CONFIG (créé par R276 étendu).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT SD — sections & droits sur le modèle actuel (SD-01/02/03/06)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const RM = randomUUID(), COSR = randomUUID();
  let kyc: any = null;

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    kyc = (await request(http).post("/v1/kyc").set(bearer(T, RM, "RM"))
      .send({ clientId, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM })).body;
  });
  afterAll(async () => { await app.close(); });

  it("SD-01 : la matrice REFLÈTE la base, et réciproquement — VIEW→HIDDEN coupe l'accès backend, le change tracker enregistre", async () => {
    const m = (await request(http).get(`/v1/kyc/${kyc.code}/access-matrix`).set(bearer(T, COSR, "CO_SR"))).body;
    const section = m.sections.find((s: any) => s.questions.some((q: any) => q.droits.RM !== "HIDDEN"));
    const question = section.questions.find((q: any) => ["VIEW", "EDIT", "REQUIRED"].includes(q.droits.RM));
    const avant = (await request(http).get(`/v1/kyc/${kyc.code}`).set(bearer(T, RM, "RM"))).body;
    const visibleAvant = avant.sections.flatMap((s: any) => s.questions).some((q: any) => q.code === question.code);
    expect(visibleAvant).toBe(true);
    // Passage à HIDDEN par la matrice (CO_SR) — un RM ne peut pas éditer la matrice
    await request(http).patch(`/v1/kyc/${kyc.code}/questions/${question.code}/access`).set(bearer(T, RM, "RM"))
      .send({ role: "RM", right: "HIDDEN" }).expect(403);
    await request(http).patch(`/v1/kyc/${kyc.code}/questions/${question.code}/access`).set(bearer(T, COSR, "CO_SR"))
      .send({ role: "RM", right: "HIDDEN" }).expect(200);
    // L'accès BACKEND le reflète : la question a disparu de la projection du RM
    const apres = (await request(http).get(`/v1/kyc/${kyc.code}`).set(bearer(T, RM, "RM"))).body;
    expect(apres.sections.flatMap((s: any) => s.questions).some((q: any) => q.code === question.code)).toBe(false);
    // Le change tracker a enregistré (événement — le journal fait trace)
    const ev = await prisma.domainEvent.findFirst({ where: { tenantId: T, type: "kyc.access.modifie", aggregateId: kyc.id } });
    expect((ev!.payload as any).question).toBe(question.code);
    expect((ev!.payload as any).nouvelle).toBe("HIDDEN");
    expect((ev!.payload as any).par).toBe(COSR);
    console.log("SD-01 PASS — matrice → base → projection RM, événement tracé");
  });

  it("SD-02 : le garde-fou est BACKEND — une question sans aucun rôle éditeur est refusée, la base inchangée", async () => {
    const m = (await request(http).get(`/v1/kyc/${kyc.code}/access-matrix`).set(bearer(T, COSR, "CO_SR"))).body;
    // Prend une question et rétrograde ses rôles éditeurs UN PAR UN : le DERNIER doit être refusé
    const question = m.sections.flatMap((s: any) => s.questions)
      .find((q: any) => Object.values(q.droits).some((d) => d === "EDIT" || d === "REQUIRED"));
    const editeurs = Object.entries(question.droits).filter(([, d]) => d === "EDIT" || d === "REQUIRED").map(([r]) => r);
    for (const role of editeurs.slice(0, -1))
      await request(http).patch(`/v1/kyc/${kyc.code}/questions/${question.code}/access`).set(bearer(T, COSR, "CO_SR"))
        .send({ role, right: "VIEW" }).expect(200);                          // tant qu'il RESTE un éditeur, ça passe
    const dernier = editeurs[editeurs.length - 1];
    const ko = await request(http).patch(`/v1/kyc/${kyc.code}/questions/${question.code}/access`).set(bearer(T, COSR, "CO_SR"))
      .send({ role: dernier, right: "VIEW" });
    expect(ko.status).toBe(400);
    expect(ko.body.message).toContain("SD-02");                              // refus TYPÉ, affiché tel quel
    const re = (await request(http).get(`/v1/kyc/${kyc.code}/access-matrix`).set(bearer(T, COSR, "CO_SR"))).body;
    const droit = re.sections.flatMap((s: any) => s.questions).find((q: any) => q.code === question.code).droits[dernier];
    expect(["EDIT", "REQUIRED"]).toContain(droit);                           // la base est INCHANGÉE
    console.log("SD-02 PASS — refus typé, base intacte");
  });

  it("SD-03 : « Voir comme » est SERVI, pas masqué — la réponse réseau du rôle simulé ne contient PAS ses questions HIDDEN", async () => {
    // Le RM n'a pas le droit de simuler ; le CO_SR simule la vue RM
    await request(http).get(`/v1/kyc/${kyc.code}/voir-comme/RM`).set(bearer(T, RM, "RM")).expect(403);
    const vueRm = (await request(http).get(`/v1/kyc/${kyc.code}/voir-comme/RM`).set(bearer(T, COSR, "CO_SR"))).body;
    const vueCoSr = (await request(http).get(`/v1/kyc/${kyc.code}`).set(bearer(T, COSR, "CO_SR"))).body;
    const questionsRm = vueRm.sections.flatMap((s: any) => s.questions).map((q: any) => q.code);
    const questionsCoSr = vueCoSr.sections.flatMap((s: any) => s.questions).map((q: any) => q.code);
    expect(questionsRm.length).toBeLessThan(questionsCoSr.length);           // la question passée HIDDEN (SD-01) manque
    // La preuve « servie, pas masquée » : la RÉPONSE RÉSEAU elle-même ne porte pas la question
    expect(JSON.stringify(vueRm)).not.toContain(questionsCoSr.find((c: string) => !questionsRm.includes(c)));
    console.log("SD-03 PASS — vue RM servie côté serveur,", questionsRm.length, "questions vs", questionsCoSr.length);
  });

  it("SD-06 : la matérialité HAUTE force la révision — refus TYPÉ du backend (store COC_CONFIG, R276 étendu)", async () => {
    const ko = await request(http).post("/v1/coc/config").set(bearer(T, COSR, "CO_SR"))
      .send({ typeCode: "TEST_HAUTE", libelle: "Type de test", materialite: "HAUTE",
        actionRequise: "MAJ_CIBLEE", roleTraitant: "CO" });
    expect(ko.status).toBe(400);
    expect(ko.body.message).toContain("SD-06");
    await request(http).post("/v1/coc/config").set(bearer(T, COSR, "CO_SR"))
      .send({ typeCode: "TEST_HAUTE", libelle: "Type de test", materialite: "HAUTE",
        actionRequise: "REVISION_KYC", roleTraitant: "CO" }).expect(201);
    console.log("SD-06 PASS — HAUTE + MAJ_CIBLEE refusé, HAUTE + REVISION_KYC accepté");
  });
});
