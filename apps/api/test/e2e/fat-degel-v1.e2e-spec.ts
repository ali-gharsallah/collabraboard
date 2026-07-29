/**
 * FAT — DÉGEL VAGUE 1 (canon dégel complet ratifié 2026-07-28, mapping +3) :
 * R297 [canon R294] flux transactionnel = UN journal canonique (TF-01..03) ·
 * R298 [canon R295] txrisk = SURFACE du moteur CPSI (TF-04..06) ·
 * R299 [canon R296] FX = lecture d'exposition (TF-07/08) ·
 * R300 [canon R297] SWIFT = laboratoire d'analyse (TF-09..12).
 * Port de TEST déterministe gaté par env (doctrine OLIVIA_FAKE_PORT) — fixtures en TEST
 * uniquement, jamais en prod (R167).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

describe("FAT DÉGEL V1 — R297 : le journal SANS port (TF-01)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const RM = randomUUID();

  beforeAll(async () => {
    delete process.env.TXFLUX_FAKE_PORT;                  // AUCUN port : le refus est la règle
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("TF-01 [R297] port absent → refus gracieux TYPÉ, zéro donnée — jamais une fixture en prod", async () => {
    const imp = await request(http).post("/v1/txflux/importer").set(bearer(T, RM, "RM")).send({});
    expect(imp.status).toBe(400);
    expect(JSON.stringify(imp.body)).toContain("R297");                     // refus typé, pas un silence
    const etat = await request(http).get("/v1/txflux/etat").set(bearer(T, RM, "RM"));
    expect(etat.status).toBe(200);
    expect(etat.body.portConfigure).toBe(false);                            // l'écran REND cet état
    const flux = await request(http).get("/v1/txflux").set(bearer(T, RM, "RM"));
    expect(flux.status).toBe(200);
    expect(flux.body).toEqual([]);                                          // zéro donnée simulée
    console.log("TF-01 PASS — refus gracieux typé sans port, zéro donnée");
  });
});

describe("FAT DÉGEL V1 — R297 : journal canonique, idempotent, IMMUABLE (TF-02/03)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const RM = randomUUID();

  beforeAll(async () => {
    process.env.TXFLUX_FAKE_PORT = "1";                   // port de TEST déterministe (R167 : test only)
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { delete process.env.TXFLUX_FAKE_PORT; await app.close(); });

  it("TF-02 [R297/R286] même ref_externe livrée deux fois → UNE transaction (idempotence par (source, ref_externe))", async () => {
    const un = await request(http).post("/v1/txflux/importer").set(bearer(T, RM, "RM")).send({});
    expect(un.status).toBe(201);
    expect(un.body.importees).toBeGreaterThanOrEqual(3);                    // la fixture déterministe
    const deux = await request(http).post("/v1/txflux/importer").set(bearer(T, RM, "RM")).send({});
    expect(deux.status).toBe(201);
    expect(deux.body.importees).toBe(0);                                    // rien de nouveau — dédupliqué
    expect(deux.body.dejaConnues).toBeGreaterThanOrEqual(3);
    const n = await prisma.transaction.count({ where: { tenantId: T } });
    expect(n).toBe(un.body.importees);                                      // pas un doublon en base
    console.log("TF-02 PASS — idempotence par (source, ref_externe)");
  });

  it("TF-03 [R297/R48] le journal est IMMUABLE : UPDATE et DELETE lèvent une exception (trigger append-only)", async () => {
    const tx = await prisma.transaction.findFirst({ where: { tenantId: T } });
    expect(tx).toBeTruthy();
    await expect(prisma.$executeRawUnsafe(
      `UPDATE transactions SET montant = 0 WHERE id = '${tx!.id}'`)).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe(
      `DELETE FROM transactions WHERE id = '${tx!.id}'`)).rejects.toThrow(/append-only/);
    console.log("TF-03 PASS — UPDATE/DELETE interdits par trigger");
  });
});

// ── R298 [canon R295] : txrisk = SURFACE du moteur CPSI — jamais un second moteur (TF-04..06) ──

describe("FAT DÉGEL V1 — R298 : la détection vit AU MOTEUR, txrisk alimente et projette (TF-04..06)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const RM = randomUUID(), CO = randomUUID();
  const clientC = randomUUID();

  const maxSeq = async (): Promise<bigint> =>
    BigInt(((await prisma.$queryRawUnsafe<any[]>(`SELECT COALESCE(MAX(id),0)::bigint m FROM domain_events`))[0].m));

  beforeAll(async () => {
    process.env.TXFLUX_FAKE_PORT = "1";
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, clientC);
    // Le compte de la fixture est rattaché au client (mapping R169, daté)
    const t = await prisma.tenant.findFirst({ where: { id: T } });
    await prisma.tenant.update({ where: { id: T }, data: { settings: { ...((t!.settings as any) ?? {}),
      coreMapping: [{ compteCore: "CH93-0001", clientId: clientC, depuisLe: "2026-01-01T00:00:00.000Z" }] } } });
  });
  afterAll(async () => { delete process.env.TXFLUX_FAKE_PORT; await app.close(); });

  it("TF-04 [R298] un scénario CPSI sur un attribut TRANSACTIONNEL détecte sur le flux réel — via LE moteur ; zéro logique de détection dans txrisk", async () => {
    await request(http).post("/v1/txflux/importer").set(bearer(T, RM, "RM")).expect(201);
    // txrisk ALIMENTE : attributs transactionnels calculés du journal, poussés AU moteur (rien décidé ici)
    const al = await request(http).post("/v1/txrisk/alimenter").set(bearer(T, CO, "CO"));
    expect(al.status).toBe(201);
    expect(al.body.clients).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(al.body)).not.toMatch(/alerte|verdict|hit/i);      // aucun verdict côté txrisk
    // Le scénario vit AU CATALOGUE CPSI (voie normale R69/R70) — groupe + scénario sur rapidite_in_out
    await request(http).post("/v1/cpsi/groups").set(bearer(T, CO, "CO"))
      .send({ gid: "CH_TOUS", label: "Domiciliés CH", at: "2026-01-02T00:00:00.000Z",
        predicat: { logique: "OU", conditions: [{ champ: "countryCode", op: "eq", val: "CH" }] } }).expect(201);
    await request(http).post("/v1/cpsi/scenarios").set(bearer(T, CO, "CO"))
      .send({ sid: "SC_VELOCITE_TX", label: "Vélocité in/out sur flux réel", champ: "rapidite_in_out",
        groupesSeuils: { CH_TOUS: 50 }, sens: "gte" }).expect(201);
    const ev = await request(http).get("/v1/cpsi/scenarios/SC_VELOCITE_TX/evaluate").set(bearer(T, CO, "CO"));
    expect(ev.status).toBe(200);
    expect(ev.body.hits.some((h: any) => h.client === clientC)).toBe(true);  // détecté PAR LE MOTEUR
    // Revue d'architecture : le module txrisk ne compare RIEN — aucun seuil, aucune alerte
    const src = fs.readFileSync(path.join(__dirname, "../../src/modules/txflux/txrisk.module.ts"), "utf8");
    expect(src).not.toMatch(/seuil|alerte|>=|detect/i);
    console.log("TF-04 PASS — détection au moteur CPSI, txrisk n'est qu'une surface");
  });

  it("TF-05 [R298/R287] l'écran txrisk en LIVE : les événements du flux descendent par SSE (AS-06 rejoué sur tx.flux.importee)", async () => {
    const avant = await maxSeq();
    // Un événement de flux arrive « pendant la coupure » (même patron qu'AS-06)
    await prisma.domainEvent.create({ data: { tenantId: T, type: "tx.flux.importee",
      aggregateId: randomUUID(), payload: { refExterne: "FIX-LIVE", source: "FAKE-CORE test" },
      at: new Date().toISOString() } });
    const r = await request(http).get("/v1/events/stream?attente=0")
      .set(bearer(T, CO, "CO")).set("Last-Event-ID", String(avant));
    expect(r.status).toBe(200);
    const refs = [...r.text.matchAll(/^data: (.+)$/gm)].map((m) => JSON.parse(m[1]));
    expect(refs.some((x: any) => x.type === "tx.flux.importee")).toBe(true); // le flux DESCEND
    expect(r.text).not.toContain("FIX-LIVE");                                // référence seule, jamais le payload (R285)
    console.log("TF-05 PASS — live SSE par références, AS-06 rejoué sur le flux");
  });

  it("TF-06 [R298/R48] les tendances = VOLUMÉTRIE PAR REJEU À DATE — la tendance d'hier se reconstruit du journal", async () => {
    const hier = await request(http).get("/v1/txrisk/tendances?asOf=2026-07-21T23:59:59.000Z").set(bearer(T, CO, "CO"));
    expect(hier.status).toBe(200);
    const nHier = Object.values(hier.body.parMois as Record<string, any>).reduce((s: number, m: any) => s + m.n, 0);
    const auj = await request(http).get("/v1/txrisk/tendances").set(bearer(T, CO, "CO"));
    const nAuj = Object.values(auj.body.parMois as Record<string, any>).reduce((s: number, m: any) => s + m.n, 0);
    expect(nHier).toBe(2);                                                   // au 21/07 : FIX-001 + FIX-002 seulement
    expect(nAuj).toBe(3);                                                    // aujourd'hui : FIX-003 aussi
    console.log("TF-06 PASS — tendances rejouées à date depuis le journal");
  });
});

// ── R299 [canon R296] : FX = LECTURE d'exposition — seuils qui notifient, zéro exécution (TF-07/08) ──

describe("FAT DÉGEL V1 — R299 : exposition par devise, jamais un taux inventé (TF-07/08)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const RM = randomUUID(), ADMIN = randomUUID(), DIR = randomUUID();

  beforeAll(async () => {
    process.env.TXFLUX_FAKE_PORT = "1";                  // le flux existe ; le port FX, LUI, est absent
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, randomUUID());
    await request(http).post("/v1/txflux/importer").set(bearer(T, RM, "RM")).expect(201);
  });
  afterAll(async () => { delete process.env.TXFLUX_FAKE_PORT; await app.close(); });

  it("TF-07 [R299/R167] pas de port FX → montants en DEVISE D'ORIGINE + mention — jamais un taux par défaut", async () => {
    const r = await request(http).get("/v1/fx/exposition").set(bearer(T, DIR, "DIR"));
    expect(r.status).toBe(200);
    expect(r.body.parDevise.CHF).toBeTruthy();
    expect(r.body.parDevise.USD).toBeTruthy();           // la fixture USD reste en USD
    expect(r.body.parDevise.USD.enChf).toBeNull();       // AUCUNE conversion inventée
    expect(r.body.conversion).toMatch(/aucun port FX/i); // la mention, rendue à l'écran
    expect(JSON.stringify(r.body)).not.toMatch(/"taux":\s*[0-9]/); // zéro taux par défaut
    console.log("TF-07 PASS — devise d'origine + mention, pas de taux inventé");
  });

  it("TF-08 [R299/R39] seuil d'exposition franchi → NOTIFICATION (événement), rien bloqué — le seuil est un paramètre tenant", async () => {
    await request(http).post("/v1/parametres/valeur/fx_seuils_exposition").set(bearer(T, ADMIN, "ADMIN"))
      .send({ valeur: { USD: 5000 }, motif: "R299 : seuil d'attention exposition USD" }).expect(201);
    const r = await request(http).get("/v1/fx/exposition").set(bearer(T, DIR, "DIR"));
    expect(r.status).toBe(200);                          // servi — JAMAIS bloqué (R39)
    expect(r.body.parDevise.USD.seuilFranchi).toBe(true);
    const ev = await prisma.domainEvent.findFirst({
      where: { tenantId: T, type: "fx.seuil.franchi" }, orderBy: { id: "desc" } });
    expect(ev).toBeTruthy();
    expect((ev!.payload as any).devise).toBe("USD");
    console.log("TF-08 PASS — franchissement notifié, exposition servie");
  });
});

// ── R300 [canon R297] : SWIFT = LABORATOIRE d'analyse — parsing entrant, émission INTERDITE (TF-09..12) ──

describe("FAT DÉGEL V1 — R300 : parsing MT/MX, quarantaine motivée, zéro émission (TF-09..12)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const RM = randomUUID(), CO = randomUUID();
  const clientC = randomUUID();

  const MT103 = `{1:F01BANKCHZZXXXX0000000000}{2:I103BANKGB2LXXXXN}{4:
:20:FIX-002
:23B:CRED
:32A:260721CHF11800,
:50K:/DE89370400440532013000
TIERS PAYEUR GMBH
:59:/CH9300010001
Suzuki Ltd
:71A:OUR
-}`;

  beforeAll(async () => {
    process.env.TXFLUX_FAKE_PORT = "1";
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, clientC);
    const t = await prisma.tenant.findFirst({ where: { id: T } });
    await prisma.tenant.update({ where: { id: T }, data: { settings: { ...((t!.settings as any) ?? {}),
      coreMapping: [{ compteCore: "CH93-0001", clientId: clientC, depuisLe: "2026-01-01T00:00:00.000Z" }] } } });
    await request(http).post("/v1/txflux/importer").set(bearer(T, RM, "RM")).expect(201);
  });
  afterAll(async () => { delete process.env.TXFLUX_FAKE_PORT; await app.close(); });

  it("TF-09 [R300] un MT103 de fixture → extraction STRUCTURÉE complète, RATTACHÉE à sa transaction par référence", async () => {
    const r = await request(http).post("/v1/swift/analyser").set(bearer(T, CO, "CO")).send({ texte: MT103 });
    expect(r.status).toBe(201);
    expect(r.body.quarantaine).toBeFalsy();
    const x = r.body.extraction;
    expect(x.type).toBe("MT103");
    expect(x.reference).toBe("FIX-002");
    expect(x.devise).toBe("CHF");
    expect(x.montant).toBe(11800);
    expect(x.donneurOrdre).toContain("TIERS PAYEUR GMBH");                   // champ sensible SURLIGNÉ
    expect(x.beneficiaire).toContain("Suzuki Ltd");
    expect(r.body.transactionId).toBeTruthy();                               // rattaché à FIX-002 du journal R297
    const liste = await request(http).get("/v1/swift/messages").set(bearer(T, CO, "CO"));
    expect(liste.body.some((m: any) => m.reference === "FIX-002")).toBe(true);
    console.log("TF-09 PASS — extraction structurée, rattachement par référence");
  });

  it("TF-10 [R300/R169] message INCONNU → quarantaine VISIBLE avec motif — jamais deviné", async () => {
    const r = await request(http).post("/v1/swift/analyser").set(bearer(T, CO, "CO"))
      .send({ texte: "{2:I999XXX}\n:20:REF-MYSTERE\ngarbage" });
    expect(r.status).toBe(201);
    expect(r.body.quarantaine).toBe(true);
    expect(r.body.motif).toBeTruthy();
    const q = await request(http).get("/v1/swift/quarantaine").set(bearer(T, CO, "CO"));
    expect(q.status).toBe(200);
    expect(q.body.length).toBeGreaterThanOrEqual(1);
    expect(q.body[0].motif).toMatch(/bibliothèque|parsable/i);               // le POURQUOI, listé
    console.log("TF-10 PASS — quarantaine motivée, visible");
  });

  it("TF-11 [R300] AUCUN endpoint d'émission SWIFT n'existe — structurellement (inventaire des routes vivantes)", async () => {
    await request(http).post("/v1/swift/emettre").set(bearer(T, CO, "CO")).send({}).expect(404);
    await request(http).post("/v1/swift/envoyer").set(bearer(T, CO, "CO")).send({}).expect(404);
    const doc = await request(http).get("/v1/apidoc").set(bearer(T, CO, "CO"));
    const routesSwift: { methode: string; chemin: string }[] = doc.body.parModule?.swift ?? [];
    for (const route of routesSwift)
      expect(`${route.methode} ${route.chemin}`).not.toMatch(/emettre|envoyer|send|emit/i); // le routeur VIVANT fait foi
    expect(routesSwift.length).toBeGreaterThanOrEqual(1);                    // le labo, lui, existe
    console.log(`TF-11 PASS — ${routesSwift.length} routes swift, zéro émission`);
  });

  it("TF-12 [R300/R298/R79] les champs de contrepartie ALIMENTENT le registre R79 : wires_third_party déclaré (formule en français), nourri par l'extraction", async () => {
    // L'agrégation pousse l'attribut au moteur (le donneur d'ordre ≠ titulaire vu au TF-09)
    const al = await request(http).post("/v1/txrisk/alimenter").set(bearer(T, CO, "CO"));
    expect(al.status).toBe(201);
    const evCpsi = await prisma.cpsiEvent.findFirst({
      where: { tenantId: T, clientId: clientC, type: "cpsi.client.registered" } });
    expect(((evCpsi!.payload as any).attributs).wires_third_party).toBeGreaterThanOrEqual(1);
    // La DÉCLARATION vit au registre R79 — formule en FRANÇAIS servie par le catalogue
    await request(http).post("/v1/cpsi/groups").set(bearer(T, CO, "CO"))
      .send({ gid: "CH_TOUS", label: "Domiciliés CH", at: "2026-01-02T00:00:00.000Z",
        predicat: { logique: "OU", conditions: [{ champ: "countryCode", op: "eq", val: "CH" }] } }).expect(201);
    await request(http).post("/v1/cpsi/scenarios").set(bearer(T, CO, "CO"))
      .send({ sid: "SC_TIERS_PAYEUR", label: "Virements de tiers", champ: "wires_third_party",
        groupesSeuils: { CH_TOUS: 1 }, sens: "gte" }).expect(201);
    const cat = await request(http).get("/v1/cpsi/compliance-catalogue").set(bearer(T, CO, "CO"));
    const entree = cat.body.catalogue.find((c: any) => c.champ === "wires_third_party");
    expect(entree).toBeTruthy();
    expect(entree.champ_formule).toMatch(/tiers/i);                          // la formule française du registre R79
    console.log("TF-12 PASS — attribut déclaré au registre R79, nourri par l'extraction");
  });
});
