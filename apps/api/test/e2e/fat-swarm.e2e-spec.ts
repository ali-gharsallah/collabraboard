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
import { boot, bearer, seedTenantClient, photoTablesMetier } from "./util";
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
    // Hygiène R286 (« un consommateur naît au présent ») : les suites précédentes stoppent LEUR
    // worker, leur backlog resterait sous le watermark — le tick de CETTE app le consommerait en
    // plein SW-14 (photo byte-identique). On pose les watermarks au présent avant de commencer.
    await prisma.$executeRaw`UPDATE event_consumers SET last_seq = (SELECT COALESCE(MAX(id), 0) FROM domain_events),
      blocage_seq = NULL, tentatives = 0, prochaine_tentative_at = NULL`;
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

  // ── Étape 4 : R262 — le budget est une PORTE dure, jamais dépassé « pour finir » ──

  it("SW-06 [R262] le budget étapes FERME : 25 étapes demandées, max 20 → EPUISE à 20, livrable partiel avec mention, étape 21 inexistante", async () => {
    const t = await prisma.tenant.findFirst({ where: { id: T } });
    const s = (t!.settings as any) ?? {};
    await prisma.tenant.update({ where: { id: T }, data: { settings: { ...s,
      missionsActives: [...(s.missionsActives ?? []), "MISSION_25_ETAPES"],
      missionsDeclarees: { ...(s.missionsDeclarees ?? {}),
        MISSION_25_ETAPES: { agents: ["agent-kyc"], portes: [], roles: ["CO"] } } } } });
    const r = await request(http).post("/v1/olivia/runs").set(bearer(T, CO, "CO")).send({ missionCode: "MISSION_25_ETAPES" });
    expect(r.status).toBe(201);
    expect(r.body.statut).toBe("EPUISE");
    expect(r.body.consomme.etapes).toBe(20);                              // 20, PAS 21 — jamais « pour finir »
    const evts = await eventsDe(r.body.id);
    expect(evts.filter((e: any) => e.type === "ETAPE_AGENT").length).toBe(20);  // l'étape 21 N'EXISTE PAS
    const tick = evts.find((e: any) => e.type === "BUDGET_TICK");
    expect(JSON.stringify(tick!.sortie)).toContain("etapes");             // le compteur épuisé est NOMMÉ
    const livrable = evts.find((e: any) => e.type === "LIVRABLE");
    expect(JSON.stringify(livrable!.sortie)).toContain("exploration interrompue : budget étapes");
    expect(evts[evts.length - 1].type).toBe("TRANSITION");                // → EPUISE, événement d'abord
    chaineContigue(evts);
    console.log("SW-06 PASS — EPUISE à 20, livrable partiel mentionné, étape 21 inexistante");
  });

  it("SW-07 [R262] le budget durée FERME : max_duree_s surchargé à 0 → EPUISE après la 1re étape, mention explicite", async () => {
    const r = await request(http).post("/v1/olivia/runs").set(bearer(T, CO, "CO"))
      .send({ missionCode: "MISSION_SIMPLE", budgetSurcharge: { maxDureeS: 0 } });
    expect(r.status).toBe(201);
    expect(r.body.statut).toBe("EPUISE");
    const evts = await eventsDe(r.body.id);
    expect(evts.filter((e: any) => e.type === "ETAPE_AGENT").length).toBe(1);   // la porte ferme AVANT l'étape 2
    expect(JSON.stringify(evts.find((e: any) => e.type === "LIVRABLE")!.sortie)).toContain("budget durée");
    chaineContigue(evts);
    console.log("SW-07 PASS — budget durée ferme, livrable partiel mentionné");
  });

  it("SW-08 [R262] la surcharge ne va qu'À LA BAISSE : au-dessus du paramètre tenant → 422 ; en dessous → appliquée", async () => {
    // Au-dessus (tenant: max_etapes défaut 20) → 422, AUCUN run créé
    const avant = await prisma.oliviaRun.count({ where: { tenantId: T } });
    const trop = await request(http).post("/v1/olivia/runs").set(bearer(T, CO, "CO"))
      .send({ missionCode: "MISSION_SIMPLE", budgetSurcharge: { maxEtapes: 50 } });
    expect(trop.status).toBe(422);
    expect(JSON.stringify(trop.body)).toContain("baisse");
    expect(await prisma.oliviaRun.count({ where: { tenantId: T } })).toBe(avant);
    // En dessous → appliquée : MISSION_SIMPLE (3 étapes) plafonnée à 2 → EPUISE à 2
    const r = await request(http).post("/v1/olivia/runs").set(bearer(T, CO, "CO"))
      .send({ missionCode: "MISSION_SIMPLE", budgetSurcharge: { maxEtapes: 2 } });
    expect(r.status).toBe(201);
    expect(r.body.statut).toBe("EPUISE");
    expect(r.body.budget.maxEtapes).toBe(2);                              // la surcharge est FIGÉE au run
    expect(r.body.consomme.etapes).toBe(2);
    console.log("SW-08 PASS — surcharge haussière 422, baissière appliquée et figée");
  });

  // ── Étape 5 : R261 — le swarm hérite du scope du COMMANDITAIRE, jamais plus (ContextBuilder v1) ──

  const declarerMission = async (code: string, def: any) => {
    const t = await prisma.tenant.findFirst({ where: { id: T } });
    const s = (t!.settings as any) ?? {};
    await prisma.tenant.update({ where: { id: T }, data: { settings: { ...s,
      missionsActives: [...new Set([...(s.missionsActives ?? []), code])],
      missionsDeclarees: { ...(s.missionsDeclarees ?? {}), [code]: def } } } });
  };

  it("SW-04 [R261] deux agents, UN SEUL scope : celui du commanditaire RM — empreinte identique, rien de HIDDEN dans contexte_objets, autre RM refusé sans run", async () => {
    const RM = randomUUID(), clientRm = randomUUID();
    await seedTenantClient(prisma, T, clientRm);
    await prisma.client.update({ where: { id: clientRm }, data: { rmUserId: RM } });
    const kyc = (await request(http).post("/v1/kyc").set(bearer(T, RM, "RM"))
      .send({ clientId: clientRm, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM })).body;
    // Default-deny du canon : IDE-Q3 devient HIDDEN pour RM/ARM (même mécanique qu'OL-06)
    const q3 = await prisma.kycQuestion.findFirst({ where: { code: "IDE-Q3", section: { kycFileId: kyc.id } } });
    await prisma.kycAccessRule.deleteMany({ where: { questionId: q3!.id, role: { in: ["RM", "ARM"] as any } } });
    await declarerMission("MISSION_SCOPE", { agents: ["agent-kyc", "agent-redacteur"], ancrage: "KYC_FILE", portes: [], roles: ["RM"] });

    const r = await request(http).post("/v1/olivia/runs").set(bearer(T, RM, "RM"))
      .send({ missionCode: "MISSION_SCOPE", ancrageType: "KYC_FILE", ancrageId: kyc.id });
    expect(r.status).toBe(201);
    expect(r.body.statut).toBe("TERMINE");
    expect(r.body.roleCode).toBe("RM");                                   // scope hérité, FIGÉ au run
    const etapes = (await eventsDe(r.body.id)).filter((e: any) => e.type === "ETAPE_AGENT");
    expect(etapes.map((e: any) => e.agentCode)).toEqual(["agent-kyc", "agent-redacteur"]);
    for (const e of etapes) {
      expect(e.entreeEmpreinte).toHaveLength(64);                         // CHAQUE étape passe le ContextBuilder v1
      const objets = e.contexteObjets as any[];
      expect(objets.length).toBeGreaterThan(0);
      expect(objets.some((o: any) => o.id === q3!.id)).toBe(false);       // HIDDEN RM hors contexte — sur TOUT le run
    }
    expect(etapes[0].entreeEmpreinte).toBe(etapes[1].entreeEmpreinte);    // deux agents, EXACTEMENT le même scope

    // Le dossier d'un AUTRE RM : refus À LA CRÉATION (OL-05), sans révéler, AUCUN run créé
    const avant = await prisma.oliviaRun.count({ where: { tenantId: T } });
    const autre = await request(http).post("/v1/olivia/runs").set(bearer(T, randomUUID(), "RM"))
      .send({ missionCode: "MISSION_SCOPE", ancrageType: "KYC_FILE", ancrageId: kyc.id });
    expect(autre.status).toBe(403);
    expect(JSON.stringify(autre.body)).toContain("SCOPE_DENIED");
    expect(await prisma.oliviaRun.count({ where: { tenantId: T } })).toBe(avant);
    console.log("SW-04 PASS — un seul scope pour tout le swarm, HIDDEN exclu du run entier, autre RM refusé net");
  });

  it("SW-05 [R261] le refus périphérique n'est PAS silencieux : événement SCOPE_DENIED au journal du run, livrable « contexte partiel »", async () => {
    const clientC = randomUUID();
    await seedTenantClient(prisma, T, clientC);
    // Client NON enregistré à la porte CPSI → le périphérique CPSI_SCORE est refusé (même règle qu'OL-07/C3)
    const rc = await prisma.riskCase.create({ data: { tenantId: T, clientId: clientC, statut: "EN_ANALYSE",
      etatDepuis: new Date(), signalIds: [], ouvertPar: CO } });
    await declarerMission("MISSION_CORREL_TEST", { agents: ["agent-redacteur"], ancrage: "RISK_CASE", portes: [], roles: ["CO"] });

    const r = await request(http).post("/v1/olivia/runs").set(bearer(T, CO, "CO"))
      .send({ missionCode: "MISSION_CORREL_TEST", ancrageType: "RISK_CASE", ancrageId: rc.id });
    expect(r.status).toBe(201);
    expect(r.body.statut).toBe("TERMINE");                                // le run CONTINUE (périphérique, pas central)
    const evts = await eventsDe(r.body.id);
    expect(evts.some((e: any) => e.type === "SCOPE_DENIED")).toBe(true);  // le refus EST un événement du journal
    const livrable = evts.find((e: any) => e.type === "LIVRABLE");
    expect(JSON.stringify(livrable!.sortie)).toContain("contexte partiel");
    chaineContigue(evts);
    console.log("SW-05 PASS — SCOPE_DENIED journalisé, livrable en contexte partiel, chaîne intacte");
  });

  // ── Étape 6 : R263 — les portes humaines sont OBLIGATOIRES : le swarm s'arrête, l'humain passe ──

  const lancerPorte = async () => {
    const r = await request(http).post("/v1/olivia/runs").set(bearer(T, CO, "CO")).send({ missionCode: "MISSION_PORTE" });
    expect(r.status).toBe(201);
    expect(r.body.statut).toBe("PAUSE_PORTE");
    return r.body;
  };

  it("SW-09 [R263] la porte ARRÊTE tout : PAUSE_PORTE, notification au commanditaire, AUCUNE étape suivante avant décision", async () => {
    await declarerMission("MISSION_PORTE", { agents: ["agent-kyc", "agent-redacteur"],
      portes: [{ avant: "revue_intermediaire" }], roles: ["CO"] });
    const run = await lancerPorte();
    const evts = await eventsDe(run.id);
    expect(evts.map((e: any) => e.type)).toEqual(["PLAN", "TRANSITION", "ETAPE_AGENT", "PORTE_OUVERTE", "TRANSITION"]);
    expect(evts.filter((e: any) => e.type === "ETAPE_AGENT").length).toBe(1);   // l'étape d'après N'EXISTE PAS
    const notif = await prisma.domainEvent.findMany({ where: { tenantId: T, type: "olivia.run.porte", aggregateId: run.id } });
    expect(notif.length).toBe(1);                                          // le commanditaire est NOTIFIÉ
    expect(JSON.stringify(notif[0].payload)).toContain(CO);
    chaineContigue(evts);
    // Une porte NON DÉCLARÉE dans la mission ne s'exécute pas — jamais une porte ad hoc (R263)
    await declarerMission("MISSION_PORTE_ADHOC", { agents: ["agent-kyc", "agent-redacteur"], portes: [], roles: ["CO"] });
    const adhoc = await request(http).post("/v1/olivia/runs").set(bearer(T, CO, "CO")).send({ missionCode: "MISSION_PORTE_ADHOC" });
    expect(adhoc.status).toBe(422);
    expect(JSON.stringify(adhoc.body)).toContain("porte");
    console.log("SW-09 PASS — PAUSE_PORTE, notification, étape suivante inexistante, porte ad hoc refusée");
  });

  it("SW-10 [R263] la décision de porte est TRACÉE et typée : CONTINUER reprend, REORIENTER {consigne} entre au contexte, ARRETER {motif} → INTERROMPU", async () => {
    // CONTINUER — et seul le COMMANDITAIRE décide
    const r1 = await lancerPorte();
    await request(http).post(`/v1/olivia/runs/${r1.id}/gate-decision`).set(bearer(T, ADMIN, "ADMIN"))
      .send({ decision: "CONTINUER" }).expect(403);                        // pas le commanditaire
    const c1 = await request(http).post(`/v1/olivia/runs/${r1.id}/gate-decision`).set(bearer(T, CO, "CO"))
      .send({ decision: "CONTINUER" });
    expect(c1.status).toBe(201);
    expect(c1.body.statut).toBe("TERMINE");
    const e1 = await eventsDe(r1.id);
    expect(e1.map((e: any) => e.type)).toEqual(["PLAN", "TRANSITION", "ETAPE_AGENT", "PORTE_OUVERTE", "TRANSITION",
      "PORTE_DECISION", "TRANSITION", "ETAPE_AGENT", "LIVRABLE", "TRANSITION"]);
    chaineContigue(e1);
    // Rejouer une décision quand rien n'attend → 409 (RUN_PORTE_EN_ATTENTE ne vaut que PAUSE_PORTE)
    await request(http).post(`/v1/olivia/runs/${r1.id}/gate-decision`).set(bearer(T, CO, "CO"))
      .send({ decision: "CONTINUER" }).expect(409);

    // REORIENTER — la consigne est OBLIGATOIRE, devient un événement, entre au contexte des étapes suivantes
    const r2 = await lancerPorte();
    await request(http).post(`/v1/olivia/runs/${r2.id}/gate-decision`).set(bearer(T, CO, "CO"))
      .send({ decision: "REORIENTER" }).expect(422);                       // consigne requise
    const c2 = await request(http).post(`/v1/olivia/runs/${r2.id}/gate-decision`).set(bearer(T, CO, "CO"))
      .send({ decision: "REORIENTER", consigne: "concentre-toi sur l'origine des fonds" });
    expect(c2.status).toBe(201);
    expect(c2.body.statut).toBe("TERMINE");
    const e2 = await eventsDe(r2.id);
    const dec2 = e2.find((e: any) => e.type === "PORTE_DECISION");
    expect(JSON.stringify(dec2!.sortie)).toContain("origine des fonds");   // la consigne EST un événement
    const apres = e2.filter((e: any) => e.type === "ETAPE_AGENT")[1];
    expect((apres.contexteObjets as any[]).some((o: any) => o.type === "CONSIGNE")).toBe(true);  // et entre au CONTEXTE

    // ARRETER — motif OBLIGATOIRE (R7), INTERROMPU, jamais de reprise
    const r3 = await lancerPorte();
    await request(http).post(`/v1/olivia/runs/${r3.id}/gate-decision`).set(bearer(T, CO, "CO"))
      .send({ decision: "ARRETER" }).expect(422);                          // motif requis
    const c3 = await request(http).post(`/v1/olivia/runs/${r3.id}/gate-decision`).set(bearer(T, CO, "CO"))
      .send({ decision: "ARRETER", motif: "analyse manuelle préférée" });
    expect(c3.status).toBe(201);
    expect(c3.body.statut).toBe("INTERROMPU");
    const e3 = await eventsDe(r3.id);
    expect(JSON.stringify(e3.find((e: any) => e.type === "PORTE_DECISION")!.sortie)).toContain("analyse manuelle");
    await request(http).post(`/v1/olivia/runs/${r3.id}/gate-decision`).set(bearer(T, CO, "CO"))
      .send({ decision: "CONTINUER" }).expect(409);                        // INTERROMPU ne se reprend JAMAIS
    // Décision hors contrat → 422
    const r4 = await lancerPorte();
    await request(http).post(`/v1/olivia/runs/${r4.id}/gate-decision`).set(bearer(T, CO, "CO"))
      .send({ decision: "PEUT_ETRE" }).expect(422);
    console.log("SW-10 PASS — CONTINUER/REORIENTER/ARRETER tracés, consigne au contexte, motifs obligatoires");
  });

  it("SW-11 [R263] la porte EXPIRE en arrêt, jamais en reprise : timeout → INTERROMPU (motif timeout porte), notification", async () => {
    const run = await lancerPorte();
    const t = await prisma.tenant.findFirst({ where: { id: T } });
    const s = (t!.settings as any);
    await prisma.tenant.update({ where: { id: T }, data: { settings: { ...s, porteTimeoutH: 0 } } });
    const rep = await request(http).post("/v1/olivia/runs/reprise").set(bearer(T, ADMIN, "ADMIN"));
    expect(rep.status).toBe(201);
    expect(rep.body.portesExpirees).toContain(run.id);
    const apres = await prisma.oliviaRun.findFirst({ where: { id: run.id } });
    expect(apres!.statut).toBe("INTERROMPU");
    const evts = await eventsDe(run.id);
    expect(JSON.stringify(evts[evts.length - 1].sortie)).toContain("timeout porte");
    const notifs = await prisma.domainEvent.count({ where: { tenantId: T, type: "olivia.run.porte.expiree", aggregateId: run.id } });
    expect(notifs).toBe(1);
    await request(http).post(`/v1/olivia/runs/${run.id}/gate-decision`).set(bearer(T, CO, "CO"))
      .send({ decision: "CONTINUER" }).expect(409);                        // JAMAIS de reprise après expiration
    await prisma.tenant.update({ where: { id: T }, data: { settings: { ...s, porteTimeoutH: 72 } } });
    console.log("SW-11 PASS — timeout porte → INTERROMPU notifié, reprise refusée");
  });

  // ── Étape 7 : Mission 1 PREREVUE_DOSSIER (B.4) — héritière de la pré-revue IA, propositions R254 v1 ──

  let runPrerevue: any = null;
  let kycPrerevue: any = null;

  it("SW-13/SW-14 [B.4/R264] mission réelle : l'agent n'emprunte pas l'outil du voisin (échec tracé, le run continue) ; le run n'écrit QUE chez lui", async () => {
    // agent-screening (mission B.4) + activation de la mission livrée + fournisseur v1 configuré (R254)
    await request(http).post("/v1/olivia/agents").set(bearer(T, ADMIN, "ADMIN")).send({
      code: "agent-screening", capacite: "analyse_hits", outilsAutorises: ["kyc.dossier"], gabaritRef: "agent-screening.v1" }).expect(201);
    const t = await prisma.tenant.findFirst({ where: { id: T } });
    const s = (t!.settings as any) ?? {};
    await prisma.tenant.update({ where: { id: T }, data: { settings: { ...s,
      oliviaProviderRef: "anthropic", oliviaModel: "claude-sonnet-5",
      missionsActives: [...new Set([...(s.missionsActives ?? []), "PREREVUE_DOSSIER"])] } } });
    const clientP = randomUUID();
    await seedTenantClient(prisma, T, clientP);
    kycPrerevue = (await request(http).post("/v1/kyc").set(bearer(T, CO, "CO"))
      .send({ clientId: clientP, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: CO })).body;
    expect(kycPrerevue.id).toBeTruthy();

    // SW-14 AUTOMATISÉ (B.7 crit. 3) : dump ciblé de TOUTES les tables métier (catalogue
    // pg_tables moins olivia_*/domain_events/audit_log) — byte-identique après le run.
    const avant = await photoTablesMetier(prisma);

    const r = await request(http).post("/v1/olivia/runs").set(bearer(T, CO, "CO"))
      .send({ missionCode: "PREREVUE_DOSSIER", ancrageType: "KYC_FILE", ancrageId: kycPrerevue.id });
    expect(r.status).toBe(201);
    expect(r.body.statut).toBe("PAUSE_PORTE");                            // la porte AVANT toute proposition d'aiguillage
    runPrerevue = r.body;
    const evts = await eventsDe(r.body.id);
    // SW-13 : agent-kyc a le droit d'utiliser kyc.dossier (ETAPE_OUTIL servie) ; agent-redacteur NON —
    // échec TRACÉ (RUN_TOOL_NON_AUTORISE), et le run A CONTINUÉ jusqu'à la porte.
    const outils = evts.filter((e: any) => e.type === "ETAPE_OUTIL");
    expect(outils.length).toBe(2);
    expect(outils[0].agentCode).toBe("agent-kyc");
    expect(JSON.stringify(outils[0].sortie)).not.toContain("RUN_TOOL_NON_AUTORISE");
    expect(outils[1].agentCode).toBe("agent-redacteur");
    expect(JSON.stringify(outils[1].sortie)).toContain("RUN_TOOL_NON_AUTORISE");
    expect(evts.filter((e: any) => e.type === "ETAPE_AGENT").length).toBe(2);   // les étapes d'après ont tourné
    expect(evts[evts.length - 2].type).toBe("PORTE_OUVERTE");
    chaineContigue(evts);
    // SW-14 : AUCUNE écriture métier — photo byte-identique (le run n'écrit que olivia_* / domain_events / audit)
    expect(await photoTablesMetier(prisma)).toBe(avant);
    console.log("SW-13/14 PASS — outil du voisin refusé et tracé, run continué, état métier byte-identique");
  });

  it("SW-15 [R254] le livrable crée 2 propositions PENDING — décidables par la matrice, motifs et caducité comme en v1", async () => {
    // La porte se décide : CONTINUER → le livrable devient un MESSAGE v1 (0c : sans conversation),
    // les 2 propositions passent par creerProposition v1 — réutilisation, pas concurrence.
    const fin = await request(http).post(`/v1/olivia/runs/${runPrerevue.id}/gate-decision`).set(bearer(T, CO, "CO"))
      .send({ decision: "CONTINUER" });
    expect(fin.status).toBe(201);
    expect(fin.body.statut).toBe("TERMINE");
    expect(fin.body.livrableMessageId).toBeTruthy();                      // le rapport EST un olivia_message
    const msg = await prisma.oliviaMessage.findFirst({ where: { id: fin.body.livrableMessageId } });
    expect(msg!.conversationId).toBeNull();                               // 0c ratifié : run ≠ conversation
    expect(msg!.estSource).toBe(true);                                    // cité vers l'ancrage DU contexte (R256)
    const props = await prisma.oliviaProposal.findMany({ where: { tenantId: T, messageId: msg!.id }, orderBy: { type: "asc" } });
    expect(props.length).toBe(2);
    expect(props.map((p: any) => p.statut)).toEqual(["PENDING", "PENDING"]);
    expect(props.map((p: any) => p.type).sort()).toEqual(["AIGUILLAGE_EDD", "ALLEGEMENT_EDD"]);
    expect(props[0].cibleId).toBe(kycPrerevue.id);
    expect(props[0].cibleEtat).toBeTruthy();                              // état FIGÉ à la création (caducité B.7)

    // Décidables comme en v1 : RM hors matrice → 403 et la proposition RESTE PENDING (OL-18)
    const aig = props.find((p: any) => p.type === "AIGUILLAGE_EDD")!;
    await request(http).post(`/v1/olivia/proposals/${aig.id}/adopt`).set(bearer(T, randomUUID(), "RM")).expect(403);
    // Rejet sans motif → 422 (R7), avec motif → REJETEE
    const alleg = props.find((p: any) => p.type === "ALLEGEMENT_EDD")!;
    await request(http).post(`/v1/olivia/proposals/${alleg.id}/reject`).set(bearer(T, ADMIN, "CO_SR")).send({}).expect(422);
    await request(http).post(`/v1/olivia/proposals/${alleg.id}/reject`).set(bearer(T, ADMIN, "CO_SR"))
      .send({ motif: "clarification non pertinente à ce stade" }).expect(201);
    // Adoption par le rôle de la matrice → ADOPTEE, la voie normale est empruntée (tâche du circuit)
    const ok = await request(http).post(`/v1/olivia/proposals/${aig.id}/adopt`).set(bearer(T, ADMIN, "CO_SR"));
    expect(ok.status).toBe(201);
    const tache = await prisma.domainEvent.count({ where: { tenantId: T, type: "tache.aiguillage.edd", aggregateId: kycPrerevue.id } });
    expect(tache).toBe(1);
    console.log("SW-15 PASS — 2 propositions PENDING via R254 v1, matrice/motifs/adoption voie normale");
  });

  // ── Étape 8 : R265 — le run se REJOUE à date : livrable, pas promesse (la démo FINMA) ──

  it("SW-16 [R265] le replay est INTÉGRAL et vérifié : plan, étapes, empreintes, portes, budget dans l'ordre des seq ; chaînage vérifié ; à date ; version d'agent d'époque", async () => {
    // Le RM (hors audit) ne rejoue pas
    await request(http).get(`/v1/olivia/runs/${runPrerevue.id}/replay`).set(bearer(T, randomUUID(), "RM")).expect(403);
    // Depuis SW-15, agent-kyc a évolué : une NOUVELLE version existe — le replay doit restituer l'ÉPOQUE
    await request(http).post("/v1/olivia/agents").set(bearer(T, ADMIN, "ADMIN")).send({
      code: "agent-kyc", capacite: "completude_dossier", outilsAutorises: ["kyc.dossier"], gabaritRef: "agent-kyc.v9-posterieur" }).expect(201);

    const r = await request(http).get(`/v1/olivia/runs/${runPrerevue.id}/replay`).set(bearer(T, ADMIN, "CO_SR"));
    expect(r.status).toBe(200);
    expect(r.body.chaineVerifiee).toBe(true);                             // chaînage vérifié de BOUT EN BOUT
    const evts = r.body.evenements;
    expect(evts.map((e: any) => e.seq)).toEqual(evts.map((_: any, i: number) => i + 1));  // l'ordre EXACT des seq
    const types = evts.map((e: any) => e.type);
    for (const t of ["PLAN", "ETAPE_OUTIL", "ETAPE_AGENT", "PORTE_OUVERTE", "PORTE_DECISION", "LIVRABLE", "TRANSITION"])
      expect(types).toContain(t);                                         // plan, étapes, portes, livrable — TOUT
    const etape = evts.find((e: any) => e.type === "ETAPE_AGENT");
    expect(etape.entreeEmpreinte).toHaveLength(64);                       // les empreintes de contexte sont restituées
    expect(r.body.budget.maxEtapes).toBeGreaterThan(0);                   // budget déclaré + consommé
    expect(r.body.consomme.etapes).toBeGreaterThan(0);
    // La définition d'agent de l'ÉPOQUE (SW-02) — pas la version postérieure
    const cle = `${etape.agentCode}:${etape.agentVersion}`;
    expect(r.body.agentsEpoque[cle].gabaritRef).not.toBe("agent-kyc.v9-posterieur");
    // Les décisions rejouées : propositions avec leur sort (ADOPTEE + REJETEE de SW-15)
    expect(r.body.propositions.map((p: any) => p.statut).sort()).toEqual(["ADOPTEE", "REJETEE"]);

    // Rejeu À DATE : arrêté à la pause de porte → AUCUNE décision ni livrable dans la restitution
    const pause = evts.find((e: any) => e.type === "TRANSITION" && JSON.stringify(e.sortie).includes("PAUSE_PORTE"));
    const aDate = await request(http).get(`/v1/olivia/runs/${runPrerevue.id}/replay?as_of=${encodeURIComponent(pause.at)}`)
      .set(bearer(T, ADMIN, "ADMIN"));
    expect(aDate.status).toBe(200);
    expect(aDate.body.chaineVerifiee).toBe(true);                         // le préfixe de chaîne est intègre
    const typesADate = aDate.body.evenements.map((e: any) => e.type);
    expect(typesADate).not.toContain("PORTE_DECISION");
    expect(typesADate).not.toContain("LIVRABLE");
    // Et l'histoire ne se réécrit pas : UPDATE/DELETE → exception (append-only SQL)
    await expect(prisma.$executeRawUnsafe(
      `DELETE FROM olivia_run_events WHERE run_id = '${runPrerevue.id}'`)).rejects.toThrow();
    console.log("SW-16 PASS — replay intégral ordonné, chaîne vérifiée, à date, époque d'agent restituée");
  });

  // ── Étape 9 : R266 — la supervision est un ÉCRAN de première classe : mesure, pas coercition ──

  it("SW-17 [R266] STOP est PROPRE : rien de nouveau ne démarre, INTERROMPU, livrable partiel si du contenu existe", async () => {
    // Un run EN_COURS orphelin (kill simulé) porte déjà 2 étapes de contenu
    const crash = await request(http).post("/v1/olivia/runs").set(bearer(T, CO, "CO")).send({ missionCode: "MISSION_CRASH" });
    expect(crash.status).toBe(500);
    const run = (await prisma.oliviaRun.findMany({ where: { tenantId: T, missionCode: "MISSION_CRASH" },
      orderBy: { createdAt: "desc" } }))[0];
    expect(run.statut).toBe("EN_COURS");
    // Un tiers (ni commanditaire ni ops) ne stoppe pas
    await request(http).post(`/v1/olivia/runs/${run.id}/stop`).set(bearer(T, randomUUID(), "RM")).expect(403);
    const stop = await request(http).post(`/v1/olivia/runs/${run.id}/stop`).set(bearer(T, CO, "CO"));
    expect(stop.status).toBe(201);
    expect(stop.body.statut).toBe("INTERROMPU");
    const evts = await eventsDe(run.id);
    const livrable = evts.find((e: any) => e.type === "LIVRABLE");
    expect(JSON.stringify(livrable!.sortie)).toContain("partiel");        // du contenu existait → livrable PARTIEL
    expect(evts[evts.length - 1].type).toBe("TRANSITION");                // l'arrêt est un événement
    chaineContigue(evts);
    // Rien de nouveau ne démarre : re-stop → 409, gate-decision → 409
    await request(http).post(`/v1/olivia/runs/${run.id}/stop`).set(bearer(T, CO, "CO")).expect(409);
    await request(http).post(`/v1/olivia/runs/${run.id}/gate-decision`).set(bearer(T, CO, "CO"))
      .send({ decision: "CONTINUER" }).expect(409);
    // Et l'ÉCRAN est servi : liste (portes en attente, budget), détail+timeline, agrégat tenant
    const liste = await request(http).get("/v1/olivia/runs").set(bearer(T, CO, "CO"));
    expect(liste.status).toBe(200);
    expect(liste.body.find((x: any) => x.id === run.id).statut).toBe("INTERROMPU");
    const detail = await request(http).get(`/v1/olivia/runs/${run.id}`).set(bearer(T, CO, "CO"));
    expect(detail.status).toBe(200);
    expect(detail.body.timeline.length).toBe(evts.length);                // la timeline EST le journal
    // Un RM étranger ne voit NI la liste des autres NI ce détail
    expect((await request(http).get("/v1/olivia/runs").set(bearer(T, randomUUID(), "RM"))).body.length).toBe(0);
    await request(http).get(`/v1/olivia/runs/${run.id}`).set(bearer(T, randomUUID(), "RM")).expect(403);
    const agregat = await request(http).get("/v1/olivia/runs/agregat").set(bearer(T, ADMIN, "CO_SR"));
    expect(agregat.status).toBe(200);
    expect(agregat.body.total).toBeGreaterThan(0);
    expect(agregat.body.tauxAdoptionPropositions).toBeDefined();          // mesure, pas coercition (R39)
    console.log("SW-17 PASS — stop propre tracé, livrable partiel, écran liste/détail/agrégat servi");
  });

  it("SW-18 [R266] v2 est ÉTEINTE par défaut : tenant sans missions_actives → refus typé, l'interrupteur menu est servi (pattern R177/HO-02)", async () => {
    const T3 = randomUUID();
    await seedTenantClient(prisma, T3, randomUUID());
    const off = await request(http).post("/v1/olivia/runs").set(bearer(T3, randomUUID(), "CO"))
      .send({ missionCode: "PREREVUE_DOSSIER" });
    expect(off.status).toBe(403);                                         // refus TYPÉ, pas un 500
    expect(JSON.stringify(off.body)).toContain("RUN_MISSION_INACTIVE");
    // L'interrupteur que consomme le front (comme /v1/modules/actifs pour HO-02) : actives vide ⇒ pas d'écran au menu
    const interrupteur = await request(http).get("/v1/olivia/missions").set(bearer(T3, randomUUID(), "CO"));
    expect(interrupteur.status).toBe(200);
    expect(interrupteur.body.actives).toEqual([]);
    const chezT = (await request(http).get("/v1/olivia/missions").set(bearer(T, CO, "CO"))).body;
    expect(chezT.actives).toContain("PREREVUE_DOSSIER");
    console.log("SW-18 PASS — v2 éteinte par défaut, refus typé, interrupteur menu servi");
  });

  // ── Étape 10 : Mission 2 ANALYSE_CORRELATION (B.4) — re-passe SW-04 et SW-14 sur cette mission ──

  it("Mission 2 [B.4] ANALYSE_CORRELATION : porte avant escalade, proposition de qualification R252/R254 ; SW-04 et SW-14 re-passés", async () => {
    await request(http).post("/v1/olivia/agents").set(bearer(T, ADMIN, "ADMIN")).send({
      code: "agent-aml", capacite: "analyse_alertes", outilsAutorises: [], gabaritRef: "agent-aml.v1" }).expect(201);
    const t = await prisma.tenant.findFirst({ where: { id: T } });
    const s = (t!.settings as any) ?? {};
    await prisma.tenant.update({ where: { id: T }, data: { settings: { ...s,
      missionsActives: [...new Set([...(s.missionsActives ?? []), "ANALYSE_CORRELATION"])] } } });
    // Ancrage : un risk case dont le client est ENREGISTRÉ à la porte CPSI (score périphérique servi)
    const clientA = randomUUID();
    await seedTenantClient(prisma, T, clientA);
    await request(http).post("/v1/cpsi/clients").set(bearer(T, CO, "CO"))
      .send({ clientId: clientA, statique: { pep: false }, attributs: {} }).expect(201);
    const rc = await prisma.riskCase.create({ data: { tenantId: T, clientId: clientA, statut: "EN_ANALYSE",
      etatDepuis: new Date(), signalIds: [], ouvertPar: CO } });

    // SW-14 (re-passe, AUTOMATISÉ) : dump de TOUTES les tables métier — byte-identique après
    const avant = await photoTablesMetier(prisma);

    const r = await request(http).post("/v1/olivia/runs").set(bearer(T, CO, "CO"))
      .send({ missionCode: "ANALYSE_CORRELATION", ancrageType: "RISK_CASE", ancrageId: rc.id });
    expect(r.status).toBe(201);
    expect(r.body.statut).toBe("PAUSE_PORTE");                            // la porte AVANT la proposition d'escalade
    // SW-04 (re-passe) : agent-aml ET agent-redacteur — même scope, même empreinte, contexte C3
    const etapes = (await eventsDe(r.body.id)).filter((e: any) => e.type === "ETAPE_AGENT");
    expect(etapes.map((e: any) => e.agentCode)).toEqual(["agent-aml", "agent-redacteur"]);
    // Même SCOPE = même liste d'objets (type+id) pour les deux agents. (L'empreinte C3 embarque
    // le hachage du score CPSI, qui porte une mesure de rejeu volatile — l'égalité BYTE des
    // empreintes est prouvée par SW-04 sur C2 ; ici on prouve l'égalité du PÉRIMÈTRE.)
    const perimetre = (e: any) => (e.contexteObjets as any[]).map((o) => `${o.type}:${o.id}`).sort();
    expect(perimetre(etapes[0])).toEqual(perimetre(etapes[1]));
    for (const e of etapes) {
      const objets = e.contexteObjets as any[];
      expect(objets.some((o: any) => o.type === "RISK_CASE" && o.id === rc.id)).toBe(true);
      expect(objets.some((o: any) => o.type === "CPSI_SCORE")).toBe(true); // périphérique SERVI (client enregistré)
    }
    expect((await eventsDe(r.body.id)).some((e: any) => e.type === "SCOPE_DENIED")).toBe(false);

    const fin = await request(http).post(`/v1/olivia/runs/${r.body.id}/gate-decision`).set(bearer(T, CO, "CO"))
      .send({ decision: "CONTINUER" });
    expect(fin.status).toBe(201);
    expect(fin.body.statut).toBe("TERMINE");
    const props = await prisma.oliviaProposal.findMany({ where: { tenantId: T, messageId: fin.body.livrableMessageId } });
    expect(props.length).toBe(1);
    expect(props[0].type).toBe("QUALIF_ALERTE_FONDEE");
    expect(props[0].cibleType).toBe("ALERTE");
    expect(props[0].cibleId).toBe(`${clientA}|SC_STRUCT`);                // clé R252, __CLIENT__ résolu
    expect(props[0].statut).toBe("PENDING");
    expect(props[0].cibleEtat).toBe("NON_QUALIFIEE");                     // état FIGÉ (caducité B.7)
    // SW-14 (re-passe) : l'état métier est BYTE-IDENTIQUE — TOUTES tables métier confondues
    expect(await photoTablesMetier(prisma)).toBe(avant);
    console.log("Mission 2 PASS — porte escalade, proposition ALERTE clé R252, SW-04/SW-14 re-passés verts");
  });

  // ── Étape 11 : B.5 — la saturation NOTIFIE, ne bloque jamais (R39/R266) ──

  it("B.5 [R266] runs_actifs_max_par_tenant : au plafond, le dépassement est NOTIFIÉ (événement), jamais bloqué", async () => {
    const t = await prisma.tenant.findFirst({ where: { id: T } });
    const s = (t!.settings as any);
    await prisma.tenant.update({ where: { id: T }, data: { settings: { ...s, runsActifsMaxParTenant: 0 } } });
    const avant = await prisma.domainEvent.count({ where: { tenantId: T, type: "olivia.runs.saturation" } });
    const r = await request(http).post("/v1/olivia/runs").set(bearer(T, CO, "CO")).send({ missionCode: "MISSION_SIMPLE" });
    expect(r.status).toBe(201);                                           // mesure, PAS coercition
    expect(r.body.statut).toBe("TERMINE");
    expect(await prisma.domainEvent.count({ where: { tenantId: T, type: "olivia.runs.saturation" } })).toBe(avant + 1);
    await prisma.tenant.update({ where: { id: T }, data: { settings: { ...s, runsActifsMaxParTenant: 5 } } });
    console.log("B.5 PASS — saturation notifiée (événement), run servi");
  });
});
