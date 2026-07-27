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
import * as path from "path";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
// La MÊME source que la CI et le runtime : une seule vérité, pas trois listes.
import * as listeBlanche from "../../src/modules/swarm/outils-liste-blanche.json";

// Fournisseur mocké déterministe (B.7 crit. 1) : plans/sorties en FIXTURES — outillage de test.
process.env.OLIVIA_FAKE_PORT = "1";
process.env.SWARM_PLAN_FIXTURES = path.resolve(__dirname, "fixtures", "swarm-plans.fixture.json");

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

  // ── Étape 3 : R260 — le run est un JOURNAL, chaque pas est un événement avant d'être un effet ──

  const fakeCalls = () => ((global as any).__swarmFakeCalls ?? 0);
  const eventsDe = (runId: string) =>
    prisma.oliviaRunEvent.findMany({ where: { runId }, orderBy: { seq: "asc" } });
  const chaineContigue = (evts: any[]) => {
    let prev: string | null = null;
    for (const [i, e] of evts.entries()) {
      expect(e.seq).toBe(i + 1);                                          // seq 1..n sans trou
      expect(e.prevHash).toBe(prev);                                      // chaîne sans rupture
      prev = e.recordHash;
    }
  };

  it("R260 : préparation — agents redéclarés (le retrait n'est pas une fin : nouvelle version), missions déclarées + activées", async () => {
    // agent-kyc a été RETIRE en SW-02 : le redéclarer crée la version suivante, ACTIF
    const v = await request(http).post("/v1/olivia/agents").set(bearer(T, ADMIN, "ADMIN")).send({
      code: "agent-kyc", capacite: "completude_dossier", outilsAutorises: ["kyc.dossier"], gabaritRef: "agent-kyc.v3" });
    expect(v.status).toBe(201);
    expect(v.body.statut).toBe("ACTIF");
    await request(http).post("/v1/olivia/agents").set(bearer(T, ADMIN, "ADMIN")).send({
      code: "agent-redacteur", capacite: "syntheses", outilsAutorises: [], gabaritRef: "agent-redacteur.v1" }).expect(201);
    // Déclaration ratifiée des missions de TEST (jamais une mission ad hoc) + activation explicite
    const t = await prisma.tenant.findFirst({ where: { id: T } });
    await prisma.tenant.update({ where: { id: T }, data: { settings: { ...((t!.settings as any) ?? {}),
      missionsActives: ["MISSION_SIMPLE", "MISSION_AGENT_FANTOME", "MISSION_CRASH"],
      missionsDeclarees: {
        MISSION_SIMPLE: { agents: ["agent-kyc", "agent-redacteur"], portes: [], roles: ["CO", "CO_SR"] },
        MISSION_AGENT_FANTOME: { agents: ["agent-fantome"], portes: [], roles: ["CO"] },
        MISSION_CRASH: { agents: ["agent-kyc"], portes: [], roles: ["CO"] } } } } });
    console.log("R260 PRÉPARATION OK");
  });

  it("SW-01 [R259/R260] pas déclaré, pas invoqué : run ECHOUE immédiat RUN_AGENT_INCONNU, événement journalisé, ZÉRO appel fournisseur", async () => {
    const avant = fakeCalls();
    const r = await request(http).post("/v1/olivia/runs").set(bearer(T, CO, "CO")).send({ missionCode: "MISSION_AGENT_FANTOME" });
    expect(r.status).toBe(422);
    expect(JSON.stringify(r.body)).toContain("RUN_AGENT_INCONNU");
    expect(fakeCalls()).toBe(avant);                                      // ZÉRO appel fournisseur
    const run = (await prisma.oliviaRun.findMany({ where: { tenantId: T, missionCode: "MISSION_AGENT_FANTOME" } }))[0];
    expect(run.statut).toBe("ECHOUE");                                    // ECHOUE immédiat, persistant
    const evts = await eventsDe(run.id);
    expect(evts.map((e: any) => e.type)).toEqual(["TRANSITION"]);         // l'échec EST un événement
    expect(JSON.stringify(evts[0].sortie)).toContain("RUN_AGENT_INCONNU");
    chaineContigue(evts);
    console.log("SW-01 PASS — ECHOUE immédiat typé, journalisé, zéro appel fournisseur");
  });

  it("SW-03 [R260] le pas précède l'effet (write-ahead) : tué entre deux étapes → journal net, INTERROMPU à la reprise, chaînage intact", async () => {
    // 1. La machine TERMINE proprement sur une mission saine — le journal est complet et chaîné
    const ok = await request(http).post("/v1/olivia/runs").set(bearer(T, CO, "CO")).send({ missionCode: "MISSION_SIMPLE" });
    expect(ok.status).toBe(201);
    expect(ok.body.statut).toBe("TERMINE");
    const evtsOk = await eventsDe(ok.body.id);
    expect(evtsOk.map((e: any) => e.type)).toEqual(
      ["PLAN", "TRANSITION", "ETAPE_AGENT", "ETAPE_AGENT", "ETAPE_AGENT", "LIVRABLE", "TRANSITION"]);
    chaineContigue(evtsOk);
    expect((ok.body.consomme ?? {}).etapes).toBe(3);
    expect(evtsOk[2].agentCode).toBe("agent-kyc");
    expect(evtsOk[2].agentVersion).toBeGreaterThan(0);                    // la VERSION d'agent est journalisée (R259/SW-02)

    // 2. Kill -9 simulé ENTRE deux étapes (marqueur fixture) : le processus meurt, rien n'est rattrapé
    const crash = await request(http).post("/v1/olivia/runs").set(bearer(T, CO, "CO")).send({ missionCode: "MISSION_CRASH" });
    expect(crash.status).toBe(500);                                       // mort en plein vol
    const run = (await prisma.oliviaRun.findMany({ where: { tenantId: T, missionCode: "MISSION_CRASH" } }))[0];
    expect(run.statut).toBe("EN_COURS");                                  // l'état n'a PAS menti : personne ne l'a « fermé »
    const evts = await eventsDe(run.id);
    expect(evts.map((e: any) => e.type)).toEqual(["PLAN", "TRANSITION", "ETAPE_AGENT", "ETAPE_AGENT"]);
    chaineContigue(evts);                                                 // s'arrête NET après la dernière étape complète

    // 3. À la REPRISE : INTERROMPU (événement d'abord, effet ensuite) — jamais de reprise implicite
    const rep = await request(http).post("/v1/olivia/runs/reprise").set(bearer(T, ADMIN, "ADMIN"));
    expect(rep.status).toBe(201);
    expect(rep.body.interrompus).toContain(run.id);
    expect((await prisma.oliviaRun.findFirst({ where: { id: run.id } }))!.statut).toBe("INTERROMPU");
    const evts2 = await eventsDe(run.id);
    expect(evts2.length).toBe(5);
    expect(evts2[4].type).toBe("TRANSITION");
    chaineContigue(evts2);                                                // le chaînage reste intact après reprise

    // 4. Le journal est APPEND-ONLY au niveau SQL — l'histoire ne se réécrit pas
    await expect(prisma.$executeRawUnsafe(
      `UPDATE olivia_run_events SET sortie = '{}' WHERE run_id = '${run.id}'`)).rejects.toThrow();
    console.log("SW-03 PASS — write-ahead prouvé : journal net après kill, INTERROMPU à la reprise, chaîne intacte, append-only SQL");
  });
});
