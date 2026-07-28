/**
 * FAT — CANON DES DEUX DERNIERS ÉCARTS (R284–R287, ratifié le 2026-07-28 —
 * spec/canon-so-et-transport-async.md). Partie transport (livrée en premier) :
 * R285 l'outbox précède tout message (AS-01, AS-02) · R286 at-least-once, idempotent,
 * échec visible (AS-03..05) · R287 SSE projection éphémère (AS-06..08).
 * Famille AS (vérifiée libre). Le rôle SO (R284, famille SO après mapping ratifié
 * AU→SO) suit dans ce même fichier, livré en second.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker, messageDeTransport } from "../../src/modules/events/outbox.worker";

describe("FAT CANON DERNIERS — R285 : rien ne part qui ne soit d'abord ÉCRIT (AS-01, AS-02)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any; let worker: OutboxWorker;
  const T = randomUUID();
  const RM = randomUUID();
  const clientId = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    worker = app.get(OutboxWorker);
    worker.onModuleDestroy();                        // le TEST contrôle le relais — plus aucun tick spontané
    // Hygiène de fixture : la base e2e réutilisée porte un backlog d'événements d'anciens runs ;
    // on le solde pour que le drain (LIMIT 20, ordre id) atteigne LES événements de CE test.
    await prisma.$executeRawUnsafe(`UPDATE domain_events SET published_at = NOW() WHERE published_at IS NULL`);
    await seedTenantClient(prisma, T, clientId);
  });
  afterAll(async () => { await app.close(); });

  it("AS-01 [R285] l'outbox précède tout message : l'événement naît DANS la transaction métier, rien n'est émis avant le relais — le crash ne perd rien", async () => {
    // Transaction métier réelle : créer un dossier KYC → kyc.created DANS la même transaction
    const kyc = (await request(http).post("/v1/kyc").set(bearer(T, RM, "RM"))
      .send({ clientId, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM })).body;
    const ev = await prisma.domainEvent.findFirst({ where: { tenantId: T, type: "kyc.created", aggregateId: kyc.id } });
    expect(ev).toBeTruthy();                                                // (1) l'événement EST écrit
    expect(ev!.publishedAt).toBeNull();                                     // (2) rien n'est encore parti — fenêtre de crash sans perte
    // « Redémarrage » : le relais rattrape depuis l'outbox — rien de perdu
    await worker.tick();
    const apres = await prisma.domainEvent.findFirst({ where: { id: ev!.id } });
    expect(apres!.publishedAt).not.toBeNull();                              // (3) publié PAR le relais, jamais avant
    // Revue de code AUTOMATISÉE : aucune primitive d'émission hors du module events (le relais est UNIQUE)
    const racine = path.resolve(__dirname, "..", "..", "src", "modules");
    const fautifs: string[] = [];
    const balayer = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== "events") balayer(p); continue; }
        if (!p.endsWith(".ts") || p.includes(".spec.")) continue;
        const src = fs.readFileSync(p, "utf8");
        for (const prim of ["text/event-stream", "EventSource", "WebSocket", "amqplib", "kafkajs"])
          if (src.includes(prim)) fautifs.push(`${p} : ${prim}`);
      }
    };
    balayer(racine);
    expect(fautifs).toEqual([]);                                            // émission directe hors relais = INTERDIT
    console.log("AS-01 PASS — événement écrit avant tout message, relais unique, rattrapage au redémarrage");
  });

  it("AS-02 [R285] le transport porte des RÉFÉRENCES, jamais le payload métier — et la relecture applique les droits", async () => {
    // Le message de transport se construit d'UNE fonction — inspectée ici avec un payload sensible
    const m: any = messageDeTransport({ id: BigInt(42), tenant_id: T, type: "kyc.validated",
      aggregate_id: "AGG-1", payload: { nomClient: "NOM_CLIENT_CONFIDENTIEL", riskLevel: "HIGH" } } as any);
    expect(JSON.stringify(m)).not.toContain("NOM_CLIENT_CONFIDENTIEL");     // AUCUN payload métier
    expect(m.event_id).toBe("evt_42");
    expect(m.seq).toBe(42);
    expect(m.type).toBe("kyc.validated");
    expect(m.aggregate_id).toBe("AGG-1");                                   // la RÉFÉRENCE — le consommateur relit la source
    expect(Object.keys(m).sort()).toEqual(["aggregate_id", "event_id", "occurred_at", "seq", "tenant_id", "type"]);
    // Le relais UTILISE cette fonction (revue de code : plus jamais `data: ev.payload` dans un corps sortant)
    const src = fs.readFileSync(path.resolve(__dirname, "..", "..", "src", "modules", "events", "outbox.worker.ts"), "utf8");
    expect(src).toContain("messageDeTransport(ev)");
    expect(src).not.toContain("data: ev.payload");
    // La relecture de la référence APPLIQUE les droits : un autre tenant ne relit rien
    const kyc = await prisma.kycFile.findFirst({ where: { tenantId: T, clientId } });
    await request(http).get(`/v1/kyc/${kyc!.code}`).set(bearer(randomUUID(), randomUUID(), "CO_SR")).expect(404);
    console.log("AS-02 PASS — références seules au transport, relecture sous RBAC/RLS");
  });
});

// ── R286 : livraison at-least-once, consommateur idempotent, échec VISIBLE (AS-03..05) ──

describe("FAT CANON DERNIERS — R286 : watermarks, dead-letters, échec visible (AS-03..05)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any; let worker: OutboxWorker;
  const T = randomUUID();
  const ADMIN = randomUUID(), CO = randomUUID();
  const clientA = randomUUID(), clientB = randomUUID();

  // Une proposition RÉELLE : journal CPSI (source de vérité) + événement outbox MIROIR (référence : la clé)
  const proposer = async (client: string, cle: string) => {
    await prisma.cpsiEvent.create({ data: { tenantId: T, type: "cpsi.case_proposal.emitted",
      clientId: client, at: new Date().toISOString(), payload: { client, scenarios: ["SC_A"], cle, par: CO } } });
    return prisma.domainEvent.create({ data: { tenantId: T, type: "cpsi.case_proposal.emitted",
      aggregateId: client, payload: { cle, par: CO }, at: new Date().toISOString() } });
  };
  const poserWatermark = async (consumer: string, seq: bigint) =>
    prisma.eventConsumer.upsert({ where: { consumer_stream: { consumer, stream: "global" } },
      update: { lastSeq: seq, blocageSeq: null, tentatives: 0, prochaineTentativeAt: null },
      create: { consumer, stream: "global", lastSeq: seq } });
  const maxSeq = async (): Promise<bigint> =>
    BigInt(((await prisma.$queryRawUnsafe<any[]>(`SELECT COALESCE(MAX(id),0)::bigint m FROM domain_events`))[0].m));

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    worker = app.get(OutboxWorker);
    worker.onModuleDestroy();                                                // le TEST contrôle les ticks
    await seedTenantClient(prisma, T, clientA); await seedTenantClient(prisma, T, clientB);
    // Hygiène : consommateurs AU PRÉSENT (le rattrapage historique est un rejeu EXPLICITE, jamais implicite)
    const m = await maxSeq();
    await poserWatermark("worker-riskcases", m); await poserWatermark("golden-record", m);
    // AS-04 : paramètres tenant par LE registre — retry borné court, backoff nul (test)
    for (const [cle, valeur] of [["retry_max", 2], ["backoff_base_s", 0]] as const)
      await request(http).post(`/v1/parametres/valeur/${cle}`).set(bearer(T, ADMIN, "ADMIN"))
        .send({ valeur, motif: "R286 : bornes de retry du transport (test AS-04)" }).expect(201);
  });
  afterAll(async () => { await app.close(); });

  it("AS-03 [R286] la redélivrance est INOFFENSIVE : le même événement livré deux fois au worker case_proposal → UN seul riskcase", async () => {
    const cle = `${clientA}|SC_A`;
    const ev = await proposer(clientA, cle);
    await worker.tick();                                                     // 1re livraison
    const w1 = await prisma.eventConsumer.findUnique({ where: { consumer_stream: { consumer: "worker-riskcases", stream: "global" } } });
    expect(w1!.lastSeq >= ev.id).toBe(true);                                 // watermark avancé
    expect(await prisma.riskCase.count({ where: { tenantId: T, clientId: clientA } })).toBe(1);
    await poserWatermark("worker-riskcases", ev.id - BigInt(1));             // REDÉLIVRANCE simulée (normale, pas une anomalie)
    await worker.tick();                                                     // 2e livraison du MÊME événement
    expect(await prisma.riskCase.count({ where: { tenantId: T, clientId: clientA } })).toBe(1);  // IDEMPOTENT (UC-01/PC-10)
    console.log("AS-03 PASS — at-least-once assumé, un seul riskcase à travers le transport");
  });

  it("AS-04 [R286] l'échec finit en DEAD-LETTER visible, le flux ne se bloque JAMAIS, le rejeu manuel est tracé", async () => {
    const clePoison = `${clientB}|SC_FANTOME`;
    // ÉVÉNEMENT POISON : référence sans source (le journal CPSI ne connaît pas cette clé) → le consommateur échoue
    const poison = await prisma.domainEvent.create({ data: { tenantId: T, type: "cpsi.case_proposal.emitted",
      aggregateId: clientB, payload: { cle: clePoison, par: CO }, at: new Date().toISOString() } });
    const cleValide = `${clientB}|SC_B`;
    await proposer(clientB, cleValide);                                      // un événement VALIDE derrière le poison
    await worker.tick();                                                     // tentative 1 (échec, tête bloquée)
    await worker.tick();                                                     // tentative 2 = retry_max → dead-letter + le flux REPART
    await worker.tick();                                                     // draine la suite
    const dl = await prisma.eventDeadLetter.findFirst({ where: { tenantId: T, consumer: "worker-riskcases", eventId: poison.id } });
    expect(dl).toBeTruthy();                                                 // TRACÉE — jamais un log silencieux
    expect(dl!.tentatives).toBe(2);
    expect(dl!.rejoueAt).toBeNull();
    // Le flux n'est PAS bloqué : l'événement valide DERRIÈRE le poison est consommé
    expect(await prisma.riskCase.count({ where: { tenantId: T, clientId: clientB } })).toBe(1);
    // VISIBLE en T9 : compteur + le plus ancien
    const sante = (await request(http).get("/v1/events/sante").set(bearer(T, ADMIN, "ADMIN"))).body;
    expect(sante.enSouffrance).toBe(1);
    expect(sante.plusAncien).toBeTruthy();
    // L'alerte est un ÉVÉNEMENT (R39 : notifie, ne bloque jamais)
    expect(await prisma.domainEvent.count({ where: { tenantId: T, type: "transport.deadletter" } })).toBeGreaterThanOrEqual(1);
    // RÉPARATION puis REJEU MANUEL tracé : la source manquante arrive, le rejeu est sûr (idempotence)
    await prisma.cpsiEvent.create({ data: { tenantId: T, type: "cpsi.case_proposal.emitted",
      clientId: clientB, at: new Date().toISOString(), payload: { client: clientB, scenarios: ["SC_F"], cle: clePoison, par: CO } } });
    const rejeu = await request(http).post(`/v1/events/dead-letters/${dl!.id}/rejouer`).set(bearer(T, ADMIN, "ADMIN"));
    expect(rejeu.status).toBe(201);
    const apres = await prisma.eventDeadLetter.findFirst({ where: { id: dl!.id } });
    expect(apres!.rejouePar).toBe(ADMIN);                                    // qui (jeton, jamais le body)
    expect(apres!.rejoueAt).toBeTruthy();                                    // quand
    expect(await prisma.riskCase.count({ where: { tenantId: T, clientId: clientB } })).toBe(2);  // traité au rejeu
    expect((await request(http).get("/v1/events/sante").set(bearer(T, ADMIN, "ADMIN"))).body.enSouffrance).toBe(0);
    console.log("AS-04 PASS — dead-letter visible (T9), flux jamais bloqué, rejeu manuel tracé qui/quand");
  });

  it("AS-05 [R286] l'ordre tient PAR AGRÉGAT — l'ordre inter-agrégats mélangé ne suppose rien", async () => {
    const cA = randomUUID(), cB = randomUUID();
    await seedTenantClient(prisma, T, cA); await seedTenantClient(prisma, T, cB);
    // Ordre MÉLANGÉ inter-agrégats : A1, B1, A2 — seq croissants
    const a1 = await proposer(cA, `${cA}|SC_1`);
    await proposer(cB, `${cB}|SC_1`);
    const a2 = await proposer(cA, `${cA}|SC_2`);
    await worker.tick();
    // Tout est consommé — aucun consommateur n'a supposé d'ordre croisé
    expect(await prisma.riskCase.count({ where: { tenantId: T, clientId: cA } })).toBe(2);
    expect(await prisma.riskCase.count({ where: { tenantId: T, clientId: cB } })).toBe(1);
    expect(await prisma.eventDeadLetter.count({ where: { tenantId: T, eventId: { in: [a1.id, a2.id] } } })).toBe(0);
    // L'ordre PAR AGRÉGAT est celui des seq : les deux ouvertures de cA se suivent dans l'ordre des sources
    const ouverts = (await prisma.domainEvent.findMany({ where: { tenantId: T, type: "riskcase.ouvert" }, orderBy: { id: "asc" } }))
      .map((e: any) => e.payload.depuisProposition).filter((k: string) => k.startsWith(cA));
    expect(ouverts).toEqual([`${cA}|SC_1`, `${cA}|SC_2`]);                   // jamais SC_2 avant SC_1
    const w = await prisma.eventConsumer.findUnique({ where: { consumer_stream: { consumer: "worker-riskcases", stream: "global" } } });
    expect(w!.lastSeq >= a2.id).toBe(true);
    console.log("AS-05 PASS — ordre par agrégat tenu, ordre inter-agrégats jamais supposé");
  });
});

// ── R287 : SSE, projection éphémère — le flux DESCEND, la commande MONTE en HTTP (AS-06..08) ──

describe("FAT CANON DERNIERS — R287 : hub SSE (AS-06..08)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const RM = randomUUID(), AUTRE_RM = randomUUID(), CO = randomUUID();
  const clientRM = randomUUID(), clientAutre = randomUUID();

  const maxSeq = async (): Promise<bigint> =>
    BigInt(((await prisma.$queryRawUnsafe<any[]>(`SELECT COALESCE(MAX(id),0)::bigint m FROM domain_events`))[0].m));
  const emettre = (clientId: string, type = "kyc.created") =>
    prisma.domainEvent.create({ data: { tenantId: T, type, aggregateId: randomUUID(),
      payload: { clientId, code: "K" }, at: new Date().toISOString() } });
  // Le flux en mode rattrapage borné (attente=0) : backlog depuis Last-Event-ID, puis fin — parseable en test
  const flux = async (user: string, role: string, depuis: bigint) => {
    const r = await request(http).get("/v1/events/stream?attente=0")
      .set(bearer(T, user, role)).set("Last-Event-ID", String(depuis));
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toContain("text/event-stream");
    const refs = [...r.text.matchAll(/^data: (.+)$/gm)].map((m) => JSON.parse(m[1]));
    const ids = [...r.text.matchAll(/^id: (\d+)$/gm)].map((m) => Number(m[1]));
    return { refs, ids, brut: r.text };
  };

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, clientRM); await seedTenantClient(prisma, T, clientAutre);
    await prisma.client.update({ where: { id: clientRM }, data: { rmUserId: RM } });        // le client DU RM
    await prisma.client.update({ where: { id: clientAutre }, data: { rmUserId: AUTRE_RM } }); // hors scope RM
  });
  afterAll(async () => { await app.close(); });

  it("AS-06 [R287] la reconnexion ne perd NI ne double : coupure pendant 3 événements → Last-Event-ID les resert UNE fois, depuis le JOURNAL", async () => {
    const avant = await maxSeq();                                            // « dernier point connu » du client SSE
    await emettre(clientRM); await emettre(clientRM); await emettre(clientRM); // 3 événements PENDANT la coupure
    const r1 = await flux(CO, "CO", avant);                                  // reconnexion : Last-Event-ID = watermark
    expect(r1.refs.length).toBe(3);                                          // les 3 arrivent — rien de perdu
    expect(new Set(r1.ids).size).toBe(r1.ids.length);                        // aucun doublon dans le flux
    expect(r1.ids).toEqual([...r1.ids].sort((a, b) => a - b));               // ordre du journal (seq)
    // Le message est une RÉFÉRENCE (forme R285) — jamais l'état de vérité
    expect(Object.keys(r1.refs[0]).sort()).toEqual(["aggregate_id", "event_id", "occurred_at", "seq", "tenant_id", "type"]);
    expect(r1.brut).not.toContain("Suzuki");                                 // aucun payload métier
    // Re-reconnexion au NOUVEAU watermark : rien ne se resert — pas de doublon à l'écran
    const r2 = await flux(CO, "CO", BigInt(r1.ids[r1.ids.length - 1]));
    expect(r2.refs.length).toBe(0);
    console.log("AS-06 PASS — rattrapage par le journal, une seule fois, références seules");
  });

  it("AS-07 [R287] RIEN ne monte par le flux : le canal est descente SEULE — toute action reste un POST HTTP audité", async () => {
    await request(http).post("/v1/events/stream").set(bearer(T, CO, "CO")).send({ commande: "interdite" }).expect(404);
    await request(http).put("/v1/events/stream").set(bearer(T, CO, "CO")).send({}).expect(404);
    // La revue de code AS-01 garantit déjà : aucun WebSocket dans src/modules — le canal bidirectionnel n'existe pas
    console.log("AS-07 PASS — descente seule, aucune commande entrante");
  });

  it("AS-08 [R287] le flux respecte le SCOPE : l'événement d'un client hors périmètre RM ne part JAMAIS (même la référence) ; le CO le reçoit", async () => {
    const avant = await maxSeq();
    const evRM = await emettre(clientRM);
    const evAutre = await emettre(clientAutre);
    const vuRM = await flux(RM, "RM", avant);
    expect(vuRM.ids).toContain(Number(evRM.id));                             // SON client : reçu
    expect(vuRM.ids).not.toContain(Number(evAutre.id));                      // hors scope : la référence N'EXISTE PAS (OL-34)
    const vuCO = await flux(CO, "CO", avant);
    expect(vuCO.ids).toEqual(expect.arrayContaining([Number(evRM.id), Number(evAutre.id)])); // voit-tout : les deux
    // ADMIN : aucune donnée client, même en référence (matrice A.3)
    await request(http).get("/v1/events/stream?attente=0").set(bearer(T, randomUUID(), "ADMIN")).expect(403);
    console.log("AS-08 PASS — scope appliqué à l'abonnement, default-deny sur la référence");
  });
});
