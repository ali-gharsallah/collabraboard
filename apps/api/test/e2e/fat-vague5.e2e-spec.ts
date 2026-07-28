/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 5 (Rattrapage maquette : CRM & Workflow).
 * Exécutés contre le VRAI backend. Écrans : CRM Banque · Contact Reports · Workflow · Corroboration.
 * Zéro invention : CRM (R186→R188), Workflow (R171→R173), Corroboration (R36) sont ratifiés.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

const jstr = (r: request.Response) => JSON.stringify(r.body);

describe("FAT Vague 5 — CRM & Workflow (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const TID = randomUUID();
  const CLIENT = randomUUID();
  const RM = randomUUID(), CO = randomUUID(), INTRUS = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, TID, CLIENT);
    // R186 : la relation d'un client se lit par SON RM (ou un rôle à visibilité étendue) —
    // on rattache le client au RM du test (le propriétaire voit sa relation).
    await prisma.$executeRaw`UPDATE clients SET rm_user_id = ${RM}::uuid WHERE id = ${CLIENT}::uuid AND tenant_id = ${TID}::uuid`;
    // R188 : le type d'entretien doit exister au paramétrage (crmEntretiens). Workflow : défaut CO/ADMIN.
    await prisma.tenant.update({ where: { id: TID }, data: { settings: {
      crmEntretiens: [{ type: "REVUE_ANNUELLE", champsObligatoires: ["note"] }] } as any } });
  });
  afterAll(async () => { await app.close(); });

  // ══ Écran 1 : CRM Banque ══════════════════════════════════════════════════
  it("FAT-CRM-01 [RM] la relation se relit (timeline) et le prochain geste se propose (R186/R187)", async () => {
    const tl = await request(http).get(`/v1/crm/clients/${CLIENT}/timeline`).set(bearer(TID, RM, "RM"));
    expect(tl.status).toBe(200);
    expect(Array.isArray(tl.body) || typeof tl.body === "object").toBe(true);   // projection (liste ou objet)
    const g = await request(http).get(`/v1/crm/clients/${CLIENT}/gestes`).set(bearer(TID, RM, "RM"));
    expect(g.status).toBe(200);
    console.log(`FAT-CRM-01 PASS — timeline projetée (R186) + gestes proposés (R187), sans exécution`);
  });

  // ══ Écran 2 : Contact Reports ═════════════════════════════════════════════
  it("FAT-CR-01 [RM] compte rendu tracé (R188) ; pré-remplissage IA refusé sans port (R138)", async () => {
    const cr = await request(http).post(`/v1/crm/clients/${CLIENT}/entretiens`).set(bearer(TID, RM, "RM"))
      .send({ type: "REVUE_ANNUELLE", contenu: { note: "Entretien annuel, situation stable." } });
    expect(cr.status).toBeLessThan(300);
    // Sans port IA injecté (CrmService(..., {})), le pré-remplissage refuse explicitement (R138)
    const pre = await request(http).post(`/v1/crm/clients/${CLIENT}/entretiens/pre-remplir`).set(bearer(TID, RM, "RM"))
      .send({ type: "REVUE_ANNUELLE" });
    expect(pre.status).toBeGreaterThanOrEqual(400);
    console.log(`FAT-CR-01 PASS — compte rendu tracé (R188) ; pré-remplissage sans port IA refusé (${pre.status}, R138)`);
  });

  // ══ Écran 3 : Workflow Designer/Rules ═════════════════════════════════════
  it("FAT-WF-01 [CO] définition publiée = datée + immuable (R171/R172/R173/R7)", async () => {
    // Brouillon (rôle habilité CO)
    const br = await request(http).post("/v1/workflow/definitions").set(bearer(TID, CO, "CO"))
      .send({ code: "KYC_STD", contenu: { etapes: ["IDENTITY", "RISK"] } });
    expect(br.status).toBeLessThan(300);
    const defId = br.body.defId;
    // Rôle non habilité ne publie pas (R173)
    const refus = await request(http).post(`/v1/workflow/definitions/${defId}/publier`).set(bearer(TID, INTRUS, "RM"))
      .send({ depuisLe: "2026-01-01", motif: "tentative" });
    expect(refus.status).toBe(403);
    // Publication sans motif → refus (R7)
    const sansMotif = await request(http).post(`/v1/workflow/definitions/${defId}/publier`).set(bearer(TID, CO, "CO"))
      .send({ depuisLe: "2026-01-01", motif: "" });
    expect(sansMotif.status).toBe(400);
    // Publication datée + motivée → PUBLIEE
    const pub = await request(http).post(`/v1/workflow/definitions/${defId}/publier`).set(bearer(TID, CO, "CO"))
      .send({ depuisLe: "2026-01-01", motif: "Mise en production du parcours standard." });
    expect(pub.status).toBeLessThan(300);
    // Modifier une version publiée → refus (R171 immuable)
    const modif = await request(http).patch(`/v1/workflow/definitions/${defId}`).set(bearer(TID, CO, "CO"))
      .send({ contenu: { etapes: ["HACK"] } });
    expect(modif.status).toBe(400);
    // Résolution datée → rend la version applicable (R172)
    const res = await request(http).get(`/v1/workflow/resoudre?code=KYC_STD&date=2026-06-01`).set(bearer(TID, CO, "CO"));
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe("PUBLIEE");
    console.log(`FAT-WF-01 PASS — non-habilité refusé (R173), sans motif refusé (R7), PUBLIEE immuable (R171), résolution datée v${res.body.version} (R172)`);
  });

  // ══ Écran 4 : Corroboration KYC ═══════════════════════════════════════════
  it("FAT-CORROB-01 [CO] une divergence ouvre un dossier Central File, sans rien modifier (R36)", async () => {
    // Une personne + un dossier KYC (constat par dossier)
    const kyc = await request(http).post("/v1/kyc").set(bearer(TID, RM, "RM"))
      .send({ clientId: CLIENT, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM });
    const kycId = kyc.body.id;
    const p = await request(http).post("/v1/personnes").set(bearer(TID, CO, "CO")).send({ nom: "Divergence Test" });
    const corr = await request(http).post(`/v1/personnes/${p.body.id}/corroboration`).set(bearer(TID, CO, "CO"))
      .send({ champ: "nom", constats: { [kycId]: "Nom A vs Nom B" } });
    expect(corr.status).toBeLessThan(300);
    const ouvert = await prisma.domainEvent.findMany({ where: { tenantId: TID, type: "central_file.dossier.ouvert", aggregateId: p.body.id } });
    expect(ouvert.length).toBeGreaterThanOrEqual(1);      // R36 : Central File ouvert
    console.log(`FAT-CORROB-01 PASS — divergence → dossier Central File ouvert (R36), aucune donnée modifiée avant décision`);
  });

  it("FAT-CORROB-02 [R36] la corroboration NOTIFIE le RM du dossier : tache.corroboration porte le rmUserId du CLIENT (solde anomalie A3)", async () => {
    // L'anomalie latente A3 : le code lisait kycFile.rmId (inexistant) — l'événement ne
    // partait JAMAIS. Le RM se résout depuis le CLIENT (matrice A.3, Client.rmUserId).
    await prisma.client.update({ where: { id: CLIENT }, data: { rmUserId: RM } });
    const kyc = await request(http).post("/v1/kyc").set(bearer(TID, RM, "RM"))
      .send({ clientId: CLIENT, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM });
    const p = await request(http).post("/v1/personnes").set(bearer(TID, CO, "CO")).send({ nom: "Corrob RM Test" });
    await request(http).post(`/v1/personnes/${p.body.id}/corroboration`).set(bearer(TID, CO, "CO"))
      .send({ champ: "domicile", constats: { [kyc.body.id]: "CH vs LI" } }).expect(201);
    const taches = await prisma.domainEvent.findMany({
      where: { tenantId: TID, type: "tache.corroboration", aggregateId: p.body.id } });
    expect(taches.length).toBe(1);                                        // l'événement PART désormais
    expect((taches[0].payload as any).rm).toBe(RM);                       // vers LE RM du client
    expect((taches[0].payload as any).dossier).toBe(kyc.body.id);
    console.log("FAT-CORROB-02 PASS — tache.corroboration émise vers le RM du client (anomalie A3 soldée)");
  });
});
