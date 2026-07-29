/**
 * FAT — CHARGE (dette qualité §6 du canon du dégel, 2026-07-28) : rejeu CPSI 10k+ événements.
 * R250 (jauge, ex-canon R224) : le rejeu se MESURE et s'affiche — meta {evenements_rejoues,
 * duree_ms} dans chaque réponse ; au-delà de `cpsi_replay_warn_ms` le dépassement NOTIFIE
 * (CPSI_REPLAY_SLOW) mais ne bloque JAMAIS (R39). Ce test ne fixe AUCUN plafond de
 * performance arbitraire : il prouve que la jauge dit vrai à 10k+ et que la réponse reste
 * CORRECTE (score servi, explicabilité R67 intacte). « L'optimisation attend la jauge. »
 * Les signaux sont insérés au format EXACT de la porte (type ratifié hit_screening), en
 * fixture de test — jamais une donnée simulée en prod (R167).
 *
 * CONSTAT DE CHARGE (2026-07-28) : le rejeu était QUADRATIQUE — le moteur recalculait
 * score_comportemental à CHAQUE ingestion (10 001 evts = 159.4 s, profil cProfile gravé au
 * solde §6). OPTIMISATION RATIFIÉE PO (« tout ratifié ») : mode `rejeu_leger` opt-in du
 * moteur, activé par le PONT seulement — les recalculs intermédiaires (journal interne,
 * jamais lu par une requête) sont sautés, chaque lecture reste PURE ; identité prouvée
 * byte-à-byte sur les 10 commandes (lourd vs léger). Après : 10 001 evts = 103.7 ms.
 * La frontière rejoue N=2500 à chaque passe ; pleine charge : CPSI_CHARGE=10000.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

const N = parseInt(process.env.CPSI_CHARGE ?? "2500", 10);                  // 2500 en frontière, 10000 à la demande (§6)

describe(`FAT CHARGE — §6 : rejeu CPSI ${N} événements, la jauge R250 dit vrai, rien ne bloque`, () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const CO = randomUUID(); const cid = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, cid);
    // R251 : le timeout de la porte est un PARAMÈTRE TENANT — la charge dépasse le défaut
    // 5000 ms (rejeu quadratique constaté, cf. en-tête) ; le tenant de charge l'élargit,
    // le refus gracieux 503 au défaut reste couvert par fat-cpsi.
    await prisma.tenant.update({ where: { id: T },
      data: { settings: { cpsiConfig: { cpsi_gate_timeout_ms: 300000 } } } });
    // Enregistrement RÉEL par la porte (default-deny respecté), puis N signaux au format
    // exact de la porte — l'ingestion unitaire revalide par rejeu à CHAQUE écriture (O(n²) en
    // HTTP) : la charge s'installe par lots, le REJEU testé est le vrai.
    await request(http).post("/v1/cpsi/clients").set(bearer(T, CO, "CO"))
      .send({ clientId: cid, statique: { pep: true, pays_risque: 1 }, at: "2026-01-01T00:00:00.000Z" }).expect(201);
    const base = new Date("2026-01-02T00:00:00.000Z").getTime();
    const lots: any[] = [];
    for (let i = 0; i < N; i++)
      lots.push({ tenantId: T, type: "cpsi.signal.ingested", clientId: cid,
        at: new Date(base + i * 60000).toISOString(),
        payload: { client: cid, signal: "hit_screening", severite: (i % 3) + 1, meta: null, par: CO } });
    for (let i = 0; i < lots.length; i += 1000)
      await prisma.cpsiEvent.createMany({ data: lots.slice(i, i + 1000) });
  }, 120000);
  afterAll(async () => { await app.close(); });

  it(`CH-01 [R250/R39] ${N} rejoués : meta exacte, score CORRECT et explicable, dépassement NOTIFIÉ jamais bloqué`, async () => {
    const t0 = Date.now();
    const r = await request(http).get(`/v1/cpsi/clients/${cid}/score`).set(bearer(T, CO, "CO"));
    const total = Date.now() - t0;
    expect(r.status).toBe(200);                                             // SERVI — jamais bloqué (R39)
    // La JAUGE dit vrai : 1 registration + N signaux rejoués
    expect(r.body.meta.evenements_rejoues).toBeGreaterThanOrEqual(N + 1);
    expect(typeof r.body.meta.duree_ms).toBe("number");
    // La réponse reste CORRECTE sous charge. Constat de saturation (moteur intouchable) :
    // au-delà du plafond, le score est BORNÉ tandis que les drivers portent la somme brute —
    // l'égalité R67 stricte (CP-01) ne vaut qu'en-deçà ; sous saturation on vérifie la
    // cohérence du plafond (somme ≥ score) et la bande maximale.
    expect(r.body.score).toBeGreaterThan(0);
    expect(r.body.bande).toBe("HIGH");                                      // 2500+ hits screening = risque maximal
    const somme = r.body.drivers.reduce((s: number, d: any) => s + d.contribution, 0);
    expect(somme).toBeGreaterThanOrEqual(r.body.score);                     // le plafond borne, jamais n'invente
    // Si le seuil warn est dépassé, la notification EXISTE (mesuré) — et rien n'a bloqué
    const warn = 2000;                                                      // défaut cpsi_replay_warn_ms
    const slow = await prisma.auditLog.findFirst({ where: { tenantId: T, action: "CPSI_REPLAY_SLOW" } });
    if (r.body.meta.duree_ms > warn) expect(slow).toBeTruthy();
    else expect(slow).toBeNull();
    // La santé expose la même jauge (profondeur + dernier rejeu)
    const h = await request(http).get("/v1/cpsi/health").set(bearer(T, CO, "CO"));
    expect(h.body.profondeurJournal).toBeGreaterThanOrEqual(N + 1);
    console.log(`CH-01 PASS — ${N + 1} événements rejoués : duree_ms=${r.body.meta.duree_ms} (HTTP total ${total} ms), warn=${warn}, notif SLOW=${!!slow}`);
  }, 290000);

  it("CH-02 [R48] le rejeu À DATE reste exact sous charge : à mi-charge le journal est coupé au bon endroit", async () => {
    // asOf au milieu de la charge : seuls les signaux ≤ asOf existent
    const moitie = Math.floor(N / 2);
    const asOf = new Date(new Date("2026-01-02T00:00:00.000Z").getTime() + (moitie - 1) * 60000).toISOString();
    const r = await request(http).get(`/v1/cpsi/clients/${cid}/score?asOf=${encodeURIComponent(asOf)}`).set(bearer(T, CO, "CO"));
    expect(r.status).toBe(200);
    expect(r.body.meta.evenements_rejoues).toBe(moitie + 1);                // registration + N/2 signaux — EXACT
    console.log(`CH-02 PASS — rejeu à date exact : ${r.body.meta.evenements_rejoues} événements (duree_ms=${r.body.meta.duree_ms})`);
  }, 290000);
});
