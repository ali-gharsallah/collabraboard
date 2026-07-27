/**
 * FAT — OLIVIA v2 : ARCHITECTURE AGENTIQUE (Partie B DÉGELÉE le 2026-07-27, décision Ali).
 * Numérotation RATIFIÉE : R259–R266, famille SW-01..18 (mapping du message de dégel : −1
 * uniforme, AG→SW — consigné dans ECARTS). Ordre de livraison acté : les fondations avant
 * l'orchestration — R264 (outils) d'abord : le contrat d'outil précède tout agent.
 *
 * Doctrine : un outil = LECTURE (GET) + PROPOSITION (olivia_proposals) — rien d'autre, PROUVÉ :
 * la liste blanche est un artefact livré (vérifié en CI, build rouge hors liste) ET appliquée
 * au runtime (TOOL_ENDPOINT_HORS_LISTE 422). Fournisseur mocké déterministe : outillage de
 * test, jamais un chemin de prod.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
// La MÊME source que la CI et le runtime : une seule vérité, pas trois listes.
import * as listeBlanche from "../../src/modules/swarm/outils-liste-blanche.json";

describe("FAT SWARM — Olivia v2 Partie B (R259–R266, SW-01..18)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const ADMIN = randomUUID(), CO = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  // ── Étape 1 : R264 — le contrat d'outil est LECTURE + PROPOSITION, rien d'autre ──

  it("SW-12 [R264] l'outil mutateur est INDÉCLARABLE : hors liste blanche → 422 TOOL_ENDPOINT_HORS_LISTE, registre inchangé", async () => {
    // 1. ADMIN déclare un outil GET de la liste blanche → 201 ; la lecture est ouverte à tous
    const ok = await request(http).post("/v1/olivia/tools").set(bearer(T, ADMIN, "ADMIN")).send({
      code: "kyc.dossier", endpointRef: "GET /v1/kyc/:code", methode: "GET",
      schemaEntree: { code: "string" }, schemaSortie: { dossier: "objet" } });
    expect(ok.status).toBe(201);
    const liste = await request(http).get("/v1/olivia/tools").set(bearer(T, CO, "CO"));
    expect(liste.status).toBe(200);
    expect(liste.body.map((t: any) => t.code)).toContain("kyc.dossier");

    // 2. L'écriture est un acte ADMIN (B.3) — CO refusé, registre inchangé
    await request(http).post("/v1/olivia/tools").set(bearer(T, CO, "CO")).send({
      code: "co.outil", endpointRef: "GET /v1/kyc/:code", methode: "GET",
      schemaEntree: {}, schemaSortie: {} }).expect(403);

    // 3. Endpoint MUTATEUR (hors liste blanche) → 422 TOOL_ENDPOINT_HORS_LISTE, registre INCHANGÉ
    const mutateur = await request(http).post("/v1/olivia/tools").set(bearer(T, ADMIN, "ADMIN")).send({
      code: "kyc.valider", endpointRef: "POST /v1/kyc/:code/validate", methode: "GET",
      schemaEntree: {}, schemaSortie: {} });
    expect(mutateur.status).toBe(422);
    expect(JSON.stringify(mutateur.body)).toContain("TOOL_ENDPOINT_HORS_LISTE");

    // 4. Une méthode hors GET|PROPOSE n'existe pas dans le contrat → 422
    const badMethode = await request(http).post("/v1/olivia/tools").set(bearer(T, ADMIN, "ADMIN")).send({
      code: "kyc.poster", endpointRef: "GET /v1/kyc/:code", methode: "POST",
      schemaEntree: {}, schemaSortie: {} });
    expect(badMethode.status).toBe(422);

    // 5. PROPOSE ne peut cibler QUE la création d'olivia_proposals (R254) — un GET même licite est refusé
    const proposeDetourne = await request(http).post("/v1/olivia/tools").set(bearer(T, ADMIN, "ADMIN")).send({
      code: "propose.detourne", endpointRef: "GET /v1/kyc/:code", methode: "PROPOSE",
      schemaEntree: {}, schemaSortie: {} });
    expect(proposeDetourne.status).toBe(422);
    expect(JSON.stringify(proposeDetourne.body)).toContain("TOOL_ENDPOINT_HORS_LISTE");
    const proposeOk = await request(http).post("/v1/olivia/tools").set(bearer(T, ADMIN, "ADMIN")).send({
      code: "olivia.proposer", endpointRef: "POST /v1/olivia/proposals", methode: "PROPOSE",
      schemaEntree: { type: "string" }, schemaSortie: { proposalId: "uuid" } });
    expect(proposeOk.status).toBe(201);

    // 6. Le registre n'a que les 2 déclarations licites — les refus n'ont RIEN écrit
    const apres = (await request(http).get("/v1/olivia/tools").set(bearer(T, ADMIN, "ADMIN"))).body;
    expect(apres.map((t: any) => t.code).sort()).toEqual(["kyc.dossier", "olivia.proposer"]);
    // 7. Redéclarer un code existant → 409 (unicité tenant+code, B.2)
    await request(http).post("/v1/olivia/tools").set(bearer(T, ADMIN, "ADMIN")).send({
      code: "kyc.dossier", endpointRef: "GET /v1/kyc/:code/a-date", methode: "GET",
      schemaEntree: {}, schemaSortie: {} }).expect(409);
    // 8. Cohérence artefact : tout ce que le test a déclaré vient bien de la liste livrée
    expect(listeBlanche.lecture).toContain("GET /v1/kyc/:code");
    expect(listeBlanche.proposition).toEqual(["POST /v1/olivia/proposals"]);
    console.log("SW-12 PASS — mutateur indéclarable (422 typé), PROPOSE borné aux proposals, écriture ADMIN, registre intègre");
  });
});
