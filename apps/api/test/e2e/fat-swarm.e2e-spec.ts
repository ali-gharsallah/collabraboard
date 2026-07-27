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

  // ── Étape 2 : R259 — tout agent est DÉCLARÉ au registre, versionné à date (R68) ──

  it("SW-01/02 [R259] (registre, partie refus) : pas déclaré → RUN_AGENT_INCONNU ; RETIRE → RUN_AGENT_RETIRE ; le rejeu à date restitue la version d'époque", async () => {
    // 1. L'écriture est un acte ADMIN ; un outil inconnu au registre R264 rend l'agent indéclarable
    await request(http).post("/v1/olivia/agents").set(bearer(T, CO, "CO")).send({
      code: "agent-kyc", capacite: "completude_dossier", outilsAutorises: ["kyc.dossier"], gabaritRef: "agent-kyc.v1" }).expect(403);
    const outilInconnu = await request(http).post("/v1/olivia/agents").set(bearer(T, ADMIN, "ADMIN")).send({
      code: "agent-kyc", capacite: "completude_dossier", outilsAutorises: ["outil.fantome"], gabaritRef: "agent-kyc.v1" });
    expect(outilInconnu.status).toBe(422);

    // 2. Déclaration licite → version 1 ACTIF ; redéclarer = NOUVELLE version, jamais une mutation
    const v1 = await request(http).post("/v1/olivia/agents").set(bearer(T, ADMIN, "ADMIN")).send({
      code: "agent-kyc", capacite: "completude_dossier", outilsAutorises: ["kyc.dossier"], gabaritRef: "agent-kyc.v1" });
    expect(v1.status).toBe(201);
    expect(v1.body.version).toBe(1);
    const tApresV1 = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 25));
    const v2 = await request(http).post("/v1/olivia/agents").set(bearer(T, ADMIN, "ADMIN")).send({
      code: "agent-kyc", capacite: "completude_dossier", outilsAutorises: ["kyc.dossier"], gabaritRef: "agent-kyc.v2" });
    expect(v2.body.version).toBe(2);

    // 3. R68 : la lecture à date restitue la version d'ÉPOQUE ; la lecture courante, la dernière
    const epoque = (await request(http).get(`/v1/olivia/agents?asOf=${tApresV1}`).set(bearer(T, CO, "CO"))).body;
    expect(epoque.find((a: any) => a.code === "agent-kyc").gabaritRef).toBe("agent-kyc.v1");
    const courant = (await request(http).get("/v1/olivia/agents").set(bearer(T, CO, "CO"))).body;
    expect(courant.find((a: any) => a.code === "agent-kyc").gabaritRef).toBe("agent-kyc.v2");

    // 4. SW-01 (refus) : l'agent JAMAIS déclaré n'existe pas — refus typé, la résolution que
    //    consommeront les runs (même code service)
    const inconnu = await request(http).get("/v1/olivia/agents/agent-fantome/en-vigueur").set(bearer(T, CO, "CO"));
    expect(inconnu.status).toBe(422);
    expect(JSON.stringify(inconnu.body)).toContain("RUN_AGENT_INCONNU");

    // 5. SW-02 (refus) : retirer = une NOUVELLE version RETIRE (append-only) → résolution refusée,
    //    mais la version d'époque reste rejouable à date
    const avantRetrait = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 25));
    await request(http).post("/v1/olivia/agents/agent-kyc/retirer").set(bearer(T, ADMIN, "ADMIN"))
      .send({ motif: "remplacé par v3 à venir" }).expect(201);
    const retire = await request(http).get("/v1/olivia/agents/agent-kyc/en-vigueur").set(bearer(T, CO, "CO"));
    expect(retire.status).toBe(422);
    expect(JSON.stringify(retire.body)).toContain("RUN_AGENT_RETIRE");
    const rejoue = await request(http).get(`/v1/olivia/agents/agent-kyc/en-vigueur?asOf=${avantRetrait}`).set(bearer(T, CO, "CO"));
    expect(rejoue.status).toBe(200);
    expect(rejoue.body.gabaritRef).toBe("agent-kyc.v2");
    expect(rejoue.body.statut).toBe("ACTIF");

    // 6. Le registre est APPEND-ONLY au niveau SQL : UPDATE → exception (jamais une mutation)
    await expect(prisma.$executeRawUnsafe(
      `UPDATE olivia_agents SET gabarit_ref = 'pirate' WHERE tenant_id = '${T}'`)).rejects.toThrow();
    console.log("SW-01/02 PASS (partie refus) — RUN_AGENT_INCONNU/RETIRE typés, versionnage R68 à date, append-only SQL");
  });
});
