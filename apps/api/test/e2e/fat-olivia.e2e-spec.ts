/**
 * FAT — Module OLIVIA v1, étape 3 : R253 port IA (spec `spec-fonctionnelle-home-olivia.md`).
 * OL-01..04 contre le VRAI backend. Le fournisseur est un PORT DE TEST déterministe
 * (OLIVIA_FAKE_PORT=1 — critère B.11.1 : le mock est un port de test, jamais utilisé en prod).
 * OL-01 prouve le refus gracieux SANS configuration tenant ; l'immuabilité du journal (trigger)
 * est prouvée en prime (socle de OL-21).
 */
process.env.OLIVIA_FAKE_PORT = "1";                                       // port de test (B.11.1)
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT OLIVIA — R253 port IA (OL-01..04, backend réel + port de test)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const OFF = randomUUID();                                               // tenant SANS configuration
  const ON = randomUUID();                                                // tenant configuré
  const U = randomUUID(), ADMIN = randomUUID();

  const setOn = (extra: any = {}) => prisma.tenant.update({ where: { id: ON },
    data: { settings: { oliviaProviderRef: "anthropic", oliviaModel: "claude-sonnet-5", ...extra } } });

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, OFF, randomUUID());
    await seedTenantClient(prisma, ON, randomUUID());
    await setOn();
  });
  afterAll(async () => { await app.close(); });

  it("OL-01 [R253] pas de configuration, refus gracieux : TOUTES les routes Olivia répondent 503 typé", async () => {
    const c = await request(http).post("/v1/olivia/conversations").set(bearer(OFF, U, "CO")).send({ capacite: "C1" });
    expect(c.status).toBe(503);
    expect(JSON.stringify(c.body)).toContain("OLIVIA_PORT_OFF");
    await request(http).get("/v1/olivia/health").set(bearer(OFF, ADMIN, "ADMIN")).expect(503);
    // La plateforme hors Olivia reste verte (une route quelconque répond)
    await request(http).get("/v1/tasks").set(bearer(OFF, U, "CO")).expect(200);
    console.log("OL-01 PASS — 503 OLIVIA_PORT_OFF partout, plateforme intacte");
  });

  it("OL-02 [R253] l'appel est DÉCLARÉ : provider, model, model_version du fournisseur, latence + événement", async () => {
    const conv = (await request(http).post("/v1/olivia/conversations").set(bearer(ON, U, "CO")).send({ capacite: "C1" })).body;
    const r = await request(http).post(`/v1/olivia/conversations/${conv.id}/messages`).set(bearer(ON, U, "CO"))
      .send({ texte: "Quelles règles gouvernent le visa 4-yeux ?" });
    expect(r.status).toBe(201);
    expect(r.body.provider).toBe("anthropic");
    expect(r.body.model).toBe("claude-sonnet-5");
    expect(r.body.modelVersion).toBe("fake-1.0");                         // version RENVOYÉE par le fournisseur (port de test)
    expect(typeof r.body.latenceMs).toBe("number");
    const ev = await prisma.domainEvent.findMany({ where: { tenantId: ON, type: "OLIVIA_MESSAGE_OUT", aggregateId: conv.id } });
    expect(ev.length).toBe(1);
    console.log("OL-02 PASS — appel déclaré (provider/model/version/latence) + OLIVIA_MESSAGE_OUT");
  });

  it("OL-03 [R68] le changement de modèle est versionné : le rejeu montre l'ancien, le nouveau vaut pour la suite", async () => {
    const ancienne = (await request(http).post("/v1/olivia/conversations").set(bearer(ON, U, "CO")).send({ capacite: "C1" })).body;
    await request(http).post(`/v1/olivia/conversations/${ancienne.id}/messages`).set(bearer(ON, U, "CO")).send({ texte: "question v1" }).expect(201);
    await setOn({ oliviaModel: "claude-fable-5" });                        // changement de modèle au jour J
    const nouvelle = (await request(http).post("/v1/olivia/conversations").set(bearer(ON, U, "CO")).send({ capacite: "C1" })).body;
    const r2 = await request(http).post(`/v1/olivia/conversations/${nouvelle.id}/messages`).set(bearer(ON, U, "CO")).send({ texte: "question v2" });
    expect(r2.body.model).toBe("claude-fable-5");                          // nouvelle conversation → nouveau modèle
    const replay = await request(http).get(`/v1/olivia/conversations/${ancienne.id}/replay`).set(bearer(ON, ADMIN, "ADMIN"));
    expect(replay.status).toBe(200);
    expect(replay.body.chaineVerifiee).toBe(true);
    const outAncien = replay.body.messages.find((m: any) => m.direction === "OUT");
    expect(outAncien.model).toBe("claude-sonnet-5");                       // le rejeu restitue le modèle de l'époque
    await setOn();                                                         // restaure pour les tests suivants
    console.log("OL-03 PASS — rejeu = ancien modèle, nouvelle conversation = nouveau");
  });

  it("OL-04 [R253] le timeout est un ÉVÉNEMENT : 502 typé + OUT d'échec journalisé, seq consommé", async () => {
    await setOn({ oliviaTimeoutMs: 150 });
    const conv = (await request(http).post("/v1/olivia/conversations").set(bearer(ON, U, "CO")).send({ capacite: "C1" })).body;
    const r = await request(http).post(`/v1/olivia/conversations/${conv.id}/messages`).set(bearer(ON, U, "CO"))
      .send({ texte: "TIMEOUT_TEST — fournisseur muet" });
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.body)).toContain("OLIVIA_PROVIDER_DOWN");
    const msgs = await prisma.oliviaMessage.findMany({ where: { conversationId: conv.id }, orderBy: { seq: "asc" } });
    expect(msgs.length).toBe(2);                                           // IN + OUT d'échec (seq consommé)
    expect(msgs[1].direction).toBe("OUT");
    expect(msgs[1].texte).toContain("ÉCHEC FOURNISSEUR");
    expect(msgs[1].latenceMs).toBeGreaterThanOrEqual(150);
    await setOn();
    console.log("OL-04 PASS — 502 typé, OUT d'échec journalisé (seq", msgs[1].seq, ")");
  });

  it("Socle OL-21 : le journal est append-only (trigger) et la capacité non ouverte refuse typé", async () => {
    const conv = (await request(http).post("/v1/olivia/conversations").set(bearer(ON, U, "CO")).send({ capacite: "C1" })).body;
    await request(http).post(`/v1/olivia/conversations/${conv.id}/messages`).set(bearer(ON, U, "CO")).send({ texte: "à tenter de modifier" }).expect(201);
    const m = await prisma.oliviaMessage.findFirst({ where: { conversationId: conv.id } });
    await expect(prisma.oliviaMessage.update({ where: { id: m!.id }, data: { texte: "altéré" } })).rejects.toThrow(/append-only/);
    await expect(prisma.oliviaMessage.delete({ where: { id: m!.id } })).rejects.toThrow(/append-only/);
    const ko = await request(http).post("/v1/olivia/conversations").set(bearer(ON, U, "CO")).send({ capacite: "C2", ancrageType: "KYC_FILE", ancrageId: randomUUID() });
    expect(ko.status).toBe(400);
    expect(JSON.stringify(ko.body)).toContain("OLIVIA_CAPACITE_NON_OUVERTE");
    console.log("Socle PASS — UPDATE/DELETE rejetés par le trigger ; C2+ancrage refusés avant ContextBuilder");
  });
});
