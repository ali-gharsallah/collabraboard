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

// ── R284 : le rôle SO est un rôle d'AUDIT — journaux intégraux, jamais les dossiers (SO-01..06) ──

describe("FAT CANON DERNIERS — R284 : rôle SO, surfaces d'audit (SO-01..06)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const SO = randomUUID(), DIR = randomUUID(), CO = randomUUID(), CO2 = randomUUID(), RM = randomUUID(), ADMIN = randomUUID();
  const clientId = randomUUID();
  const mrosRef = randomUUID();
  let offId = "";

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, clientId);
    // Un dossier EXIT_COMPLIANCE avec motif SENSIBLE (forme OF-07) — LE terrain du cloisonnement R270
    offId = (await request(http).post("/v1/offboarding").set(bearer(T, CO, "CO"))
      .send({ clientId, type: "EXIT_COMPLIANCE", motif: "Soupçon de blanchiment — communication MROS n° 45-2026", mrosRef })).body.id;
  });
  afterAll(async () => { await app.close(); });

  it("SO-01 [R284] SO ne voit PAS l'opérationnel : endpoints métier → 403 structurel ; l'accueil SO = T3 + T9 seulement (HO-06 tel quel)", async () => {
    for (const chemin of ["/v1/kyc", "/v1/clients", "/v1/reviews/deadlines", "/v1/coc", "/v1/aml/signaux"]) {
      const r = await request(http).get(chemin).set(bearer(T, SO, "SO"));
      expect(r.status).toBe(403);
      expect(JSON.stringify(r.body)).toContain("SO_SURFACE_AUDIT");          // refus TYPÉ, structurel
    }
    await request(http).get("/v1/tasks?status=OPEN").set(bearer(T, SO, "SO")).expect(200);   // T3 : ses tâches
    await request(http).get("/v1/events/sante").set(bearer(T, SO, "SO")).expect(200);        // T9 : santé technique
    console.log("SO-01 PASS — opérationnel refusé typé, accueil réduit à T3/T9");
  });

  it("SO-02 [R284/R270] SO voit TOUT en audit, en LECTURE : motif sensible intégral (policy SQL comprise) ; non-GET hors STOP/export → 403", async () => {
    // La surface d'audit sert le motif sensible INTÉGRAL — auditer l'art. 10a exige de voir le cloisonné
    const vue = (await request(http).get(`/v1/offboarding/${offId}`).set(bearer(T, SO, "SO"))).body;
    expect(vue.motifSensible).toContain("blanchiment");
    expect(vue.mrosRef).toBe(mrosRef);
    // La PREUVE SQL : la policy RESTRICTIVE sert la ligne au rôle SO (défaut étendu CO_SR,MLRO,SO)
    const rows: any[] = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE olive_app`);
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${T}', true)`);
      await tx.$executeRawUnsafe(`SELECT set_config('app.role', 'SO', true)`);
      return tx.$queryRawUnsafe(`SELECT motif_sensible FROM offboarding_sensibles WHERE offboarding_id = '${offId}'`);
    });
    expect(rows.length).toBe(1);
    // AUCUNE écriture métier : un non-GET hors exceptions fermées → 403 structurel
    const ecriture = await request(http).post(`/v1/offboarding/${offId}/visa`).set(bearer(T, SO, "SO"));
    expect(ecriture.status).toBe(403);
    expect(JSON.stringify(ecriture.body)).toContain("SO_SURFACE_AUDIT");
    // Les DEUX exceptions fermées passent la garde : STOP d'un run (R267) et export d'audit (tracé)
    const stop = await request(http).post(`/v1/olivia/runs/${randomUUID()}/stop`).set(bearer(T, SO, "SO"));
    expect(stop.status).not.toBe(403);                                       // la garde laisse passer (404 : run inexistant)
    await request(http).post("/v1/audit/export").set(bearer(T, SO, "SO")).send({}).expect(201);
    console.log("SO-02 PASS — audit intégral en lecture (SQL comprise), écriture bornée à STOP/export");
  });

  it("SO-03 [R284/R13] SO n'est JAMAIS un regard : visa, validation, adoption, CoC, porte de run → 403 structurel (un test par type de décision)", async () => {
    const decisions: Array<[string, string]> = [
      ["visa de section (R15)",        `/v1/kyc/K-X/visas/IDENTITY`],
      ["validation finale (R13/R52)",  `/v1/kyc/K-X/validate`],
      ["adoption de proposition (R255)", `/v1/olivia/proposals/${randomUUID()}/adopt`],
      ["traitement de CoC (R277)",     `/v1/coc/${randomUUID()}/traiter`],
      ["décision de porte de run (R263)", `/v1/olivia/runs/${randomUUID()}/gate-decision`],
    ];
    for (const [type, chemin] of decisions) {
      const r = await request(http).post(chemin).set(bearer(T, SO, "SO")).send({});
      expect([type, r.status]).toEqual([type, 403]);                         // structurel — pas un paramétrage
      expect(JSON.stringify(r.body)).toContain("SO_SURFACE_AUDIT");
    }
    console.log("SO-03 PASS — exclu du four-eyes et de toute décision, par construction");
  });

  it("SO-04 [R284] l'AUDITEUR est AUDITÉ : la consultation sensible émet AUDIT_ACCESS append-only ; la Direction le voit", async () => {
    // La consultation SO-02 (motif sensible) a été JOURNALISÉE — qui, quoi, quand
    const acces = await prisma.domainEvent.findMany({ where: { tenantId: T, type: "AUDIT_ACCESS" } });
    expect(acces.length).toBeGreaterThanOrEqual(1);
    const a: any = acces.find((e: any) => (e.payload as any).chemin?.includes(`/offboarding/${offId}`));
    expect(a).toBeTruthy();
    expect((a.payload as any).par).toBe(SO);                                 // QUI (jeton)
    // La Direction consulte le journal des accès ; personne ne lit dans l'ombre — pas même l'auditeur
    const vueDir = (await request(http).get("/v1/audit/acces").set(bearer(T, DIR, "DIR"))).body;
    expect(vueDir.some((x: any) => x.par === SO)).toBe(true);
    await request(http).get("/v1/audit/acces").set(bearer(T, RM, "RM")).expect(403);
    // Le supprimer est IMPOSSIBLE (append-only, trigger SQL)
    await expect(prisma.$executeRawUnsafe(`DELETE FROM domain_events WHERE id = ${a.id}`)).rejects.toThrow();
    console.log("SO-04 PASS — AUDIT_ACCESS append-only, servi à la Direction et à SO");
  });

  it("SO-05 [R284] le cumul SO+ADMIN est REFUSÉ par le backend (défaut) ; assoupli par le registre → accepté ET tracé", async () => {
    const cree = (await request(http).post("/v1/admin/users").set(bearer(T, ADMIN, "ADMIN"))
      .send({ email: "so-candidat@banque.ch", name: "Candidat", role: "ADMIN", password: "S3cret!s3cret" })).body;
    // Affecter SO à un utilisateur déjà ADMIN → refus TYPÉ (paramètre au défaut : interdit)
    const refus = await request(http).post(`/v1/admin/users/${cree.id}/role`).set(bearer(T, ADMIN, "ADMIN")).send({ role: "SO" });
    expect(refus.status).toBe(400);
    expect(JSON.stringify(refus.body)).toContain("cumul_so_admin_interdit");
    // Une petite banque ASSOUPLIT — par LE registre (motivé), jamais un contournement.
    // AMENDEMENT IM-02 (canon triage, ratifié après SO-05) : le dernier ADMIN actif ne se retire
    // pas — un SECOND ADMIN est nommé avant la bascule (la garde IAM_DERNIER_ADMIN reste active).
    await request(http).post("/v1/parametres/valeur/cumul_so_admin_interdit").set(bearer(T, ADMIN, "ADMIN"))
      .send({ valeur: false, motif: "Équipe de 3 — cumul assumé, tracé (R284)" }).expect(201);
    await request(http).post("/v1/admin/users").set(bearer(T, ADMIN, "ADMIN"))
      .send({ email: "second-admin@banque.ch", name: "Second", role: "ADMIN", password: "S3cret!s3cret" }).expect(201);
    await request(http).post(`/v1/admin/users/${cree.id}/role`).set(bearer(T, ADMIN, "ADMIN")).send({ role: "SO" }).expect(201);
    const trace = await prisma.domainEvent.findFirst({ where: { tenantId: T, type: "iam.cumul_so_admin.autorise" } });
    expect(trace).toBeTruthy();                                              // accepté ET tracé
    console.log("SO-05 PASS — cumul refusé typé au défaut, assoupli par registre = tracé");
  });

  it("SO-06 [R284/R270] le cloisonnement reste ÉTANCHE autour de SO : la vue du CO est IDENTIQUE avant/après consultation SO — aucune voie latérale", async () => {
    const avant = (await request(http).get(`/v1/offboarding/${offId}`).set(bearer(T, CO2, "CO"))).body;
    expect(avant.motif).toBe("Décision de l'établissement");                 // générique
    expect(avant).not.toHaveProperty("motifSensible");
    await request(http).get(`/v1/offboarding/${offId}`).set(bearer(T, SO, "SO")).expect(200);  // SO consulte (encore)
    const apres = (await request(http).get(`/v1/offboarding/${offId}`).set(bearer(T, CO2, "CO"))).body;
    expect(JSON.stringify(apres)).toBe(JSON.stringify(avant));               // la réponse RÉSEAU n'a pas bougé
    expect(JSON.stringify(apres)).not.toContain("blanchiment");
    console.log("SO-06 PASS — l'accès SO n'a créé aucune voie latérale, réponse CO inchangée");
  });
});

// ── R288 (ratifié 2026-07-28) : le barème de scoring est une RÈGLE — gouverné, versionné, rejouable ──

describe("FAT CANON DERNIERS — R288 : barèmes de scoring gouvernés (BS-07..09)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const RM = randomUUID(), ADMIN = randomUUID();

  const creerKyc = async (clientId: string) =>
    (await request(http).post("/v1/kyc").set(bearer(T, RM, "RM"))
      .send({ clientId, legalStructure: "HOLDING", accountType: "ADVISORY", countryCode: "CH", rmId: RM })).body; // défaut : 20+5=25 → CDD
  // Barème v2 : HOLDING monte à 35 pts (35+5=40) et le seuil EDD descend à 40 → le même profil devient EDD
  const V2 = { depuisLe: "", structurePts: { PP: 0, SA: 10, SARL: 10, HOLDING: 35, DOMICILE: 30, TRUST: 35, FOUNDATION: 25, FUND: 15 },
    accountPts: { CURRENT: 0, ADVISORY: 5, DISCRETIONARY: 5, LOMBARD: 15 },
    paysRisque: ["IR", "KP", "SY"], paysRisquePts: 40, seuilEdd: 40, seuilCdd: 25 };

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
  });
  afterAll(async () => { await app.close(); });

  it("BS-07 [R288/R29] le barème se change par le REGISTRE, jamais par le code : l'ancien dossier garde son score, le nouveau est scoré sous v2 (tracé)", async () => {
    const c1 = randomUUID(), c2 = randomUUID();
    await seedTenantClient(prisma, T, c1); await seedTenantClient(prisma, T, c2);
    const avant = await creerKyc(c1);                                        // scoré sous le barème DÉFAUT (25 → CDD)
    expect(avant.workflow).toBe("CDD");
    expect(avant.riskScore).toBe(25);
    // v2 par LE registre — motivé, daté (R125/R7) ; le code ne bouge pas
    V2.depuisLe = new Date().toISOString();
    await request(http).post("/v1/parametres/valeur/kycScoringBareme").set(bearer(T, ADMIN, "ADMIN"))
      .send({ valeur: [V2], motif: "R288 : holdings re-pondérées (décision comité risques)" }).expect(201);
    const apres = await creerKyc(c2);                                        // scoré sous v2 : 35+5=40 ≥ seuilEdd 40 → EDD
    expect(apres.riskScore).toBe(40);
    expect(apres.workflow).toBe("EDD");
    expect(JSON.stringify(apres.riskTrace)).toContain(V2.depuisLe);          // la trace MENTIONNE le barème appliqué
    // R29 : le dossier d'avant n'a PAS bougé — il garde à vie le score de SON barème
    const relu = await prisma.kycFile.findFirst({ where: { tenantId: T, clientId: c1 } });
    expect(relu!.workflow).toBe("CDD");
    expect(relu!.riskScore).toBe(25);
    console.log("BS-07 PASS — barème par le registre, nouveau scoré v2 (tracé), ancien grandfathéré");
  });

  it("BS-08 [R288/BS-01] sbbrm RE-SCORE sous barème hypothétique : reclassements NOMINATIFS ancien→nouveau score — zéro écriture, le barème réel n'a pas bougé", async () => {
    // Levier hypothétique DIFFÉRENT du réel : TRUST à 50 pts, seuil EDD à 45
    const r = await request(http).post("/v1/sandbox/brm-seuils").set(bearer(T, ADMIN, "ADMIN"))
      .send({ seuilEdd: 41, seuilCdd: 25, structurePts: { HOLDING: 36 } });
    expect(r.status).toBe(201);
    expect(r.body.ecriture).toBe(false);                                     // BS-01 : un bac ne mute RIEN
    // Le dossier c1 (score stocké 25, HOLDING/ADVISORY) est RE-SCORÉ : 36+5=41 ≥ 41 → EDD — nominatif, avec les DEUX scores
    const rec = (r.body.reclassements as any[]).find((x) => x.avant === "CDD" && x.apres === "EDD" && x.scoreAvant === 25);
    expect(rec).toBeTruthy();
    expect(rec.scoreApres).toBe(41);                                         // re-score par le MOTEUR pur, pas le score stocké
    // Le barème RÉEL n'a pas bougé : un nouveau dossier est toujours scoré sous v2 (40/EDD), pas sous l'hypothèse
    const c3 = randomUUID(); await seedTenantClient(prisma, T, c3);
    expect((await creerKyc(c3)).riskScore).toBe(40);
    console.log("BS-08 PASS — re-scoring hypothétique nominatif (deux scores), zéro écriture");
  });

  it("BS-09 [R288/R127] le barème d'époque se REJOUE : la valeur effective entre v1 et v2 restitue le défaut", async () => {
    const t0 = new Date(Date.now() - 3600_000).toISOString();                // avant l'écriture v2
    const avant = (await request(http).get(`/v1/parametres/valeur/kycScoringBareme?date=${encodeURIComponent(t0)}`)
      .set(bearer(T, ADMIN, "ADMIN"))).body;
    expect(avant).toEqual([]);                                               // l'époque : défaut moteur (aucune version écrite)
    const maintenant = (await request(http).get("/v1/parametres/valeur/kycScoringBareme").set(bearer(T, ADMIN, "ADMIN"))).body;
    expect(Array.isArray(maintenant)).toBe(true);
    expect(maintenant[0].structurePts.HOLDING).toBe(35);                     // aujourd'hui : v2
    console.log("BS-09 PASS — R127 : le barème d'époque restitué par le registre");
  });
});

// ── Volet IAM du canon triage (ratifié : paramnav + iamguide ; ssoparam différé) ──

describe("FAT CANON DERNIERS — IAM rendu : garde dernier ADMIN (IM-02) + guide lecture seule (IM-05)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const ADMIN = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("IM-02 [backend] retirer le DERNIER ADMIN est refusé typé — rôle comme désactivation ; un second ADMIN lève la garde", async () => {
    const a = (await request(http).post("/v1/admin/users").set(bearer(T, ADMIN, "ADMIN"))
      .send({ email: "a1@banque.ch", name: "Admin 1", role: "ADMIN", password: "S3cret!s3cret" })).body;
    // Seul ADMIN actif du tenant : le rétrograder OU le désactiver verrouillerait la banque → refus TYPÉ
    const r1 = await request(http).post(`/v1/admin/users/${a.id}/role`).set(bearer(T, ADMIN, "ADMIN")).send({ role: "CO" });
    expect(r1.status).toBe(400);
    expect(JSON.stringify(r1.body)).toContain("IAM_DERNIER_ADMIN");
    const r2 = await request(http).post(`/v1/admin/users/${a.id}/active`).set(bearer(T, ADMIN, "ADMIN")).send({ active: false });
    expect(r2.status).toBe(400);
    expect(JSON.stringify(r2.body)).toContain("IAM_DERNIER_ADMIN");
    // Un SECOND ADMIN actif lève la garde — la rétrogradation du premier passe
    await request(http).post("/v1/admin/users").set(bearer(T, ADMIN, "ADMIN"))
      .send({ email: "a2@banque.ch", name: "Admin 2", role: "ADMIN", password: "S3cret!s3cret" }).expect(201);
    await request(http).post(`/v1/admin/users/${a.id}/role`).set(bearer(T, ADMIN, "ADMIN")).send({ role: "CO" }).expect(201);
    console.log("IM-02 PASS — dernier ADMIN protégé (rôle + désactivation), garde levée par un second");
  });

  it("IM-05 [backend] le guide IAM est SERVI, lecture seule, daté — matrice effective + règles ratifiées ; ADMIN-only", async () => {
    const g = (await request(http).get("/v1/admin/iam/guide").set(bearer(T, ADMIN, "ADMIN"))).body;
    expect(g.genereAt).toBeTruthy();                                        // DATÉ — l'export reflète la matrice en vigueur
    expect(JSON.stringify(g.regles)).toContain("R89");                      // les règles IAM ratifiées, rendues
    expect(JSON.stringify(g.regles)).toContain("R13");
    expect(g.matrice.SO).toContain("audit");                                // la matrice rôles×surfaces effective (R284 comprise)
    expect(g.matrice.ADMIN).toBeTruthy();
    expect(typeof g.utilisateurs.parRole).toBe("object");                   // l'état RÉEL du tenant (comptes, MFA)
    await request(http).get("/v1/admin/iam/guide").set(bearer(T, randomUUID(), "RM")).expect(403);  // ADMIN-only
    console.log("IM-05 PASS — guide daté, matrice servie, ADMIN-only");
  });
});

// ── R290 : extension MOD-30 — ssoparam débloqué (IM-01/03/04) · R291 : compléments Command Center (DC-06/07) ──

describe("FAT CANON DERNIERS — R290 extension SSO (IM-01/03/04) + R291 compléments Command (DC-06/07)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const ADMIN = randomUUID(), ADMIN2 = randomUUID(), DIR = randomUUID(), RM = randomUUID();
  const clientId = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, clientId);
  });
  afterAll(async () => { await app.close(); });

  it("IM-01 [R290] le SECRET ne descend JAMAIS : l'état SSO dit « configuré », la réponse réseau ne contient aucune valeur de secret", async () => {
    process.env.OIDC_CLIENT_SECRET = "VALEUR_SECRETE_QUI_NE_DOIT_JAMAIS_DESCENDRE";
    const etat = await request(http).get("/v1/admin/sso/etat").set(bearer(T, ADMIN, "ADMIN"));
    expect(etat.status).toBe(200);
    expect(etat.body.oidc.secretConfigure).toBe(true);                      // « configuré » — le FAIT, pas la valeur
    expect(JSON.stringify(etat.body)).not.toContain("VALEUR_SECRETE");      // inspection réseau : rien ne fuit
    expect(etat.body.jwks.kidCourant).toBeTruthy();
    expect(etat.body.mode).toBe("jwt");                                     // défaut
    await request(http).get("/v1/admin/sso/etat").set(bearer(T, RM, "RM")).expect(403);  // ADMIN-only
    delete process.env.OIDC_CLIENT_SECRET;
    console.log("IM-01 PASS — secretConfigure booléen, zéro fuite, ADMIN-only");
  });

  it("IM-03 [R290] le test de connexion est un DRY-RUN tracé : rien ne change, l'événement dit qui a testé quoi, quand", async () => {
    const avant = (await request(http).get("/v1/admin/sso/etat").set(bearer(T, ADMIN, "ADMIN"))).body;
    const r = await request(http).post("/v1/admin/sso/test").set(bearer(T, ADMIN, "ADMIN")).send({});
    expect(r.status).toBe(201);
    expect(typeof r.body.resultat).toBe("string");
    const apres = (await request(http).get("/v1/admin/sso/etat").set(bearer(T, ADMIN, "ADMIN"))).body;
    expect(JSON.stringify(apres.oidc)).toBe(JSON.stringify(avant.oidc));    // la config n'a PAS bougé
    const ev = await prisma.domainEvent.findFirst({ where: { tenantId: T, type: "sso.test" }, orderBy: { id: "desc" } });
    expect((ev!.payload as any).par).toBe(ADMIN);                           // QUI (jeton), le résultat, QUAND
    console.log("IM-03 PASS — dry-run tracé, config intacte");
  });

  it("IM-04 [R290/R13/R68] la BASCULE de mode est à DEUX REGARDS et à DATE : l'initiateur ne vise pas, l'effet est différé, les sessions du jour continuent", async () => {
    // Rotation JWKS d'abord : motivée, tracée — et les jetons déjà émis restent vérifiables (grâce)
    await request(http).post("/v1/admin/sso/jwks/rotation").set(bearer(T, ADMIN, "ADMIN")).send({}).expect(400); // R7 : motif requis
    const rot = await request(http).post("/v1/admin/sso/jwks/rotation").set(bearer(T, ADMIN, "ADMIN"))
      .send({ motif: "rotation trimestrielle planifiée" });
    expect(rot.status).toBe(201);
    expect(rot.body.kidApres).not.toBe(rot.body.kidAvant);
    // Bascule jwt→sso à J+1 : demandée par ADMIN…
    const effetAt = new Date(Date.now() + 86400000).toISOString();
    await request(http).post("/v1/admin/sso/mode").set(bearer(T, ADMIN, "ADMIN"))
      .send({ vers: "sso", effetAt, motif: "fédération IdP groupe" }).expect(201);
    // …l'INITIATEUR ne vise pas (R13)…
    const refus = await request(http).post("/v1/admin/sso/mode/visa").set(bearer(T, ADMIN, "ADMIN"));
    expect(refus.status).toBe(403);
    expect(JSON.stringify(refus.body)).toContain("R13");
    // …un SECOND ADMIN vise → la bascule est enregistrée À SA DATE (R68/R126, registre R-Q)
    await request(http).post("/v1/admin/sso/mode/visa").set(bearer(T, ADMIN2, "ADMIN")).expect(201);
    const rAuj = await request(http).get("/v1/parametres/valeur/sso_mode").set(bearer(T, ADMIN, "ADMIN"));
    expect(rAuj.text.replace(/"/g, "")).toBe("jwt");                        // Nest sert la string en texte                                                // AUJOURD'HUI : rien ne change (sessions grandfathérées)
    const rDemain = await request(http).get(`/v1/parametres/valeur/sso_mode?date=${encodeURIComponent(new Date(Date.now() + 2 * 86400000).toISOString())}`)
      .set(bearer(T, ADMIN, "ADMIN"));
    expect(rDemain.text.replace(/"/g, "")).toBe("sso");                                             // À J+2 : la règle s'applique (R127 la restitue)
    // Et LE jeton de ce test (émis avant rotation + bascule) fonctionne toujours — structurel
    await request(http).get("/v1/admin/sso/etat").set(bearer(T, ADMIN, "ADMIN")).expect(200);
    console.log("IM-04 PASS — four-eyes, effet à date par le registre, grâce JWKS structurelle");
  });

  it("DC-06 [R291] la charge compliance est un AGRÉGAT SERVI : visas PENDING par rôle, tenant entier — Direction/CO_SR seulement", async () => {
    // Un dossier CDD → des visas PENDING réels (IDENTITY/CO, AML/CO_SR)
    await request(http).post("/v1/kyc").set(bearer(T, RM, "RM"))
      .send({ clientId, legalStructure: "HOLDING", accountType: "ADVISORY", countryCode: "CH", rmId: RM }).expect(201);
    const charge = await request(http).get("/v1/kyc/visas/charge").set(bearer(T, DIR, "DIR"));
    expect(charge.status).toBe(200);
    expect(charge.body.parRole.CO).toBeGreaterThanOrEqual(1);               // agrégé PAR LE BACKEND — aucun chiffre front
    expect(charge.body.parRole.CO_SR).toBeGreaterThanOrEqual(1);
    expect(charge.body.plusAncien).toBeTruthy();
    await request(http).get("/v1/kyc/visas/charge").set(bearer(T, RM, "RM")).expect(403);  // pas un écran contributeur
    console.log("DC-06 PASS — agrégat servi par rôle, DIR/CO_SR only");
  });

  it("DC-07 [R291] la Direction LIT la santé du transport (matrice T9 étendue) — mais le REJEU lui reste refusé : piloter n'est pas opérer", async () => {
    const sante = await request(http).get("/v1/events/sante").set(bearer(T, DIR, "DIR"));
    expect(sante.status).toBe(200);                                         // T9 étendu : ADMIN, SO, DIR (lecture)
    expect(typeof sante.body.enSouffrance).toBe("number");
    const rejeu = await request(http).post("/v1/events/dead-letters/999999/rejouer").set(bearer(T, DIR, "DIR"));
    expect(rejeu.status).toBe(403);                                         // écrire n'est PAS piloter
    console.log("DC-07 PASS — DIR lit la santé, le rejeu reste ADMIN/SO");
  });
});

// ── Extension R284 : écran auditit — vérification d'intégrité + journal des paramétrages (SO-07/08) ──

describe("FAT CANON DERNIERS — auditit : intégrité des journaux + paramétrages transversaux (SO-07/08)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const RM = randomUUID(), ADMIN = randomUUID(), DIR = randomUUID(), SO = randomUUID();
  const clientId = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, clientId);
  });
  afterAll(async () => { await app.close(); });

  it("SO-07 [R284] la vérification de chaîne est un ACTE TRACÉ : chaîne saine → OK ; maillon corrompu (fixture) → ROMPU et LOCALISÉ ; AUDIT_ACCESS émis", async () => {
    // Une chaîne RÉELLE : un dossier, deux réponses successives sur la même question (HMAC chaîné)
    const kyc = (await request(http).post("/v1/kyc").set(bearer(T, RM, "RM"))
      .send({ clientId, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM })).body;
    await request(http).patch(`/v1/kyc/${kyc.code}/questions/IDE-Q1`).set(bearer(T, RM, "RM")).send({ answer: "v1" }).expect(200);
    await request(http).patch(`/v1/kyc/${kyc.code}/questions/IDE-Q1`).set(bearer(T, RM, "RM")).send({ answer: "v2" }).expect(200);
    const sain = (await request(http).get("/v1/audit/integrite").set(bearer(T, SO, "SO"))).body;
    const kqh = sain.journaux.find((j: any) => j.journal === "kyc_question_history");
    expect(kqh.statut).toBe("OK");
    expect(kqh.controles).toBeGreaterThanOrEqual(2);
    // FIXTURE CORROMPUE : un maillon APPEND (l'append-only interdit l'UPDATE — on injecte un faux maillon)
    const q = await prisma.kycQuestion.findFirst({ where: { code: "IDE-Q1", section: { kycFile: { id: kyc.id } } } });
    await prisma.kycQuestionHistory.create({ data: { questionId: q!.id, previousValue: "v2", newValue: "v3-frauduleux",
      changedBy: RM, changedAt: new Date(), hash: "HASH_CORROMPU_QUI_NE_CHAINE_PAS" } });
    const casse = (await request(http).get("/v1/audit/integrite").set(bearer(T, SO, "SO"))).body;
    const kqh2 = casse.journaux.find((j: any) => j.journal === "kyc_question_history");
    expect(kqh2.statut).toBe("ROMPU");
    expect(kqh2.rompu.detail).toContain(q!.id);                             // LOCALISÉ : la question du premier maillon rompu
    // L'auditeur est audité : la vérification est ELLE-MÊME un AUDIT_ACCESS (qui, quoi, quand)
    const ev = await prisma.domainEvent.findFirst({ where: { tenantId: T, type: "AUDIT_ACCESS" }, orderBy: { id: "desc" } });
    expect((ev!.payload as any).chemin).toContain("integrite");
    // Accès : SO et DIRECTION lisent ; RM refusé
    await request(http).get("/v1/audit/integrite").set(bearer(T, DIR, "DIR")).expect(200);
    await request(http).get("/v1/audit/integrite").set(bearer(T, RM, "RM")).expect(403);
    console.log("SO-07 PASS — chaîne saine OK, maillon corrompu localisé, vérification tracée");
  });

  it("SO-08 [R284/R68] le journal des paramétrages est TRANSVERSAL : registre R-Q et matrice R282 dans UNE liste — même source, aucun agrégat parallèle", async () => {
    // Deux actes de config de MODULES DIFFÉRENTS
    await request(http).post("/v1/parametres/valeur/screeningSeuil").set(bearer(T, ADMIN, "ADMIN"))
      .send({ valeur: 90, motif: "SO-08 : resserrement du seuil" }).expect(201);
    const kyc = await prisma.kycFile.findFirst({ where: { tenantId: T, clientId } });
    await request(http).patch(`/v1/kyc/${kyc!.code}/questions/IDE-Q2/access`).set(bearer(T, ADMIN, "ADMIN"))
      .send({ role: "RM", right: "VIEW" }).expect(200);
    const j = (await request(http).get("/v1/audit/parametrages").set(bearer(T, SO, "SO"))).body;
    const types = j.map((x: any) => x.type);
    expect(types).toContain("param.change");                                // registre R-Q (R125)
    expect(types).toContain("kyc.access.modifie");                          // matrice R282 — MÊME liste
    expect(j.find((x: any) => x.type === "param.change").payload.motif).toContain("SO-08");
    console.log("SO-08 PASS — paramétrages transversaux servis d'une seule source (domain_events)");
  });
});

// ── Applications du triage final : apidoc GÉNÉRÉ (aucune règle nouvelle) ──

describe("FAT CANON DERNIERS — apidoc : la doc est GÉNÉRÉE du routeur vivant", () => {
  let app: INestApplication; let http: any;
  const T = randomUUID();
  beforeAll(async () => { ({ app } = await boot()); http = app.getHttpServer(); });
  afterAll(async () => { await app.close(); });

  it("l'inventaire vient du ROUTEUR (rien de rédigé à la main) : les routes réelles y figurent, le contrat de porte expose sa version ; SO y lit", async () => {
    const d = (await request(http).get("/v1/apidoc").set(bearer(T, randomUUID(), "CO"))).body;
    expect(d.total).toBeGreaterThan(100);                                   // le routeur vivant, pas une liste manuelle
    expect(JSON.stringify(d.parModule.kyc)).toContain("/v1/kyc/:code/validate");
    expect(JSON.stringify(d.parModule.audit)).toContain("/v1/audit/integrite");
    expect(d.porteCpsi.contractVersion).toBe("1.1");                        // R248/R281
    await request(http).get("/v1/apidoc").set(bearer(T, randomUUID(), "SO")).expect(200);  // surface SO (métadonnées)
    console.log(`apidoc PASS — ${d.total} routes générées, contrat de porte 1.1`);
  });
});
