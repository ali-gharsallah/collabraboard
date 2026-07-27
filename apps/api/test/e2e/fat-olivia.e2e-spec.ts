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
    const ko = await request(http).post("/v1/olivia/conversations").set(bearer(ON, U, "CO")).send({ capacite: "C3", ancrageType: "RISK_CASE", ancrageId: randomUUID() });
    expect(ko.status).toBe(400);
    expect(JSON.stringify(ko.body)).toContain("OLIVIA_CAPACITE_NON_OUVERTE");           // C3/C4 fermées jusqu'à l'étape 6
    const koAncrage = await request(http).post("/v1/olivia/conversations").set(bearer(ON, U, "CO")).send({ capacite: "C2", ancrageType: "KYC_FILE", ancrageId: randomUUID() });
    expect(koAncrage.status).toBe(403);                                                 // ancrage inexistant = SCOPE_DENIED (ne révèle rien)
    console.log("Socle PASS — trigger append-only ; C3 fermée ; ancrage inexistant refusé sans révéler");
  });
});

describe("FAT OLIVIA — R255 ContextBuilder (OL-05..10)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(), T2 = randomUUID();
  const RM1 = randomUUID(), RM2 = randomUUID(), CO1 = randomUUID();
  let clientRm1 = "", clientRm2 = "", fileRm1: any = null, fileRm2: any = null;

  const setS = (extra: any = {}) => prisma.tenant.update({ where: { id: T },
    data: { settings: { oliviaProviderRef: "anthropic", oliviaModel: "claude-sonnet-5", ...extra } } });
  const creerKyc = async (clientId: string, rmId: string) =>
    (await request(http).post("/v1/kyc").set(bearer(T, rmId, "RM"))
      .send({ clientId, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId })).body;

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, (clientRm1 = randomUUID()));
    await seedTenantClient(prisma, T, (clientRm2 = randomUUID()));
    await seedTenantClient(prisma, T2, randomUUID());
    await prisma.client.update({ where: { id: clientRm1 }, data: { rmUserId: RM1 } });
    await prisma.client.update({ where: { id: clientRm2 }, data: { rmUserId: RM2 } });
    await setS();
    fileRm1 = await creerKyc(clientRm1, RM1);
    fileRm2 = await creerKyc(clientRm2, RM2);
  });
  afterAll(async () => { await app.close(); });

  it("OL-05 : l'ancrage hors scope est refusé À LA CRÉATION — 403, événement, AUCUNE conversation", async () => {
    const r = await request(http).post("/v1/olivia/conversations").set(bearer(T, RM2, "RM"))
      .send({ capacite: "C2", ancrageType: "KYC_FILE", ancrageId: fileRm1.id });        // le dossier du client de RM1
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).toContain("OLIVIA_SCOPE_DENIED");
    const ev = await prisma.domainEvent.count({ where: { tenantId: T, type: "OLIVIA_CONTEXT_DENIED", aggregateId: fileRm1.id } });
    expect(ev).toBe(1);
    const convs = await prisma.oliviaConversation.count({ where: { tenantId: T, userId: RM2 } });
    expect(convs).toBe(0);                                                              // AUCUNE conversation créée
    console.log("OL-05 PASS — 403 + OLIVIA_CONTEXT_DENIED, zéro conversation");
  });

  it("OL-06 : les questions HIDDEN pour le rôle n'entrent JAMAIS dans le contexte — RM exclu, CO inclus", async () => {
    // Default-deny du canon : rôle absent des règles = HIDDEN. On retire la règle RM/ARM d'IDE-Q3.
    const q3 = await prisma.kycQuestion.findFirst({ where: { code: "IDE-Q3", section: { kycFileId: fileRm1.id } } });
    await prisma.kycAccessRule.deleteMany({ where: { questionId: q3!.id, role: { in: ["RM", "ARM"] as any } } });
    const convRm = (await request(http).post("/v1/olivia/conversations").set(bearer(T, RM1, "RM"))
      .send({ capacite: "C2", ancrageType: "KYC_FILE", ancrageId: fileRm1.id })).body;
    const outRm = (await request(http).post(`/v1/olivia/conversations/${convRm.id}/messages`).set(bearer(T, RM1, "RM"))
      .send({ texte: "Synthèse du dossier" })).body;
    expect(outRm.contexteObjets.some((o: any) => o.id === q3!.id)).toBe(false);         // HIDDEN ⇒ hors contexte
    const convCo = (await request(http).post("/v1/olivia/conversations").set(bearer(T, CO1, "CO"))
      .send({ capacite: "C2", ancrageType: "KYC_FILE", ancrageId: fileRm1.id })).body;
    const outCo = (await request(http).post(`/v1/olivia/conversations/${convCo.id}/messages`).set(bearer(T, CO1, "CO"))
      .send({ texte: "Synthèse du dossier" })).body;
    expect(outCo.contexteObjets.some((o: any) => o.id === q3!.id)).toBe(true);          // visible pour CO
    console.log("OL-06 PASS — IDE-Q3 hors contexte RM, dans le contexte CO (même service, pas une copie)");
  });

  it("OL-07 : l'objet périphérique refusé = contexte partiel TRACÉ (mécanique §3, via refs C1)", async () => {
    const conv = (await request(http).post("/v1/olivia/conversations").set(bearer(T, RM1, "RM"))
      .send({ capacite: "C1" })).body;
    const r = await request(http).post(`/v1/olivia/conversations/${conv.id}/messages`).set(bearer(T, RM1, "RM"))
      .send({ texte: "Compare avec ce dossier", refs: [{ type: "KYC_FILE", code: fileRm2.code }] });   // hors périmètre RM1
    expect(r.status).toBe(201);                                                          // la réponse EST produite
    expect(r.body.contextePartiel).toContain("1 objet(s) exclu(s)");                     // le NOMBRE, pas la nature
    const ev = await prisma.domainEvent.count({ where: { tenantId: T, type: "OLIVIA_CONTEXT_DENIED", aggregateId: fileRm2.code } });
    expect(ev).toBe(1);
    console.log("OL-07 PASS — réponse en contexte partiel, refus périphérique journalisé");
  });

  it("OL-08 : la borne ferme AVANT l'appel fournisseur — 422, zéro appel", async () => {
    await setS({ oliviaScopeMaxObjets: 3 });                                             // paramètre tenant B.9
    const conv = (await request(http).post("/v1/olivia/conversations").set(bearer(T, RM1, "RM"))
      .send({ capacite: "C2", ancrageType: "KYC_FILE", ancrageId: fileRm1.id })).body;
    const avant = (globalThis as any).__oliviaFakeCalls ?? 0;
    const r = await request(http).post(`/v1/olivia/conversations/${conv.id}/messages`).set(bearer(T, RM1, "RM"))
      .send({ texte: "Synthèse" });
    expect(r.status).toBe(422);
    expect(JSON.stringify(r.body)).toContain("OLIVIA_CONTEXT_OVERFLOW");
    expect((globalThis as any).__oliviaFakeCalls ?? 0).toBe(avant);                      // AUCUN appel fournisseur émis
    await setS();
    console.log("OL-08 PASS — overflow 422, compteur fournisseur inchangé");
  });

  it("OL-09 : l'empreinte de contexte est REPRODUCTIBLE — même état, même HMAC ; état changé, HMAC changé", async () => {
    const conv = (await request(http).post("/v1/olivia/conversations").set(bearer(T, RM1, "RM"))
      .send({ capacite: "C2", ancrageType: "KYC_FILE", ancrageId: fileRm1.id })).body;
    const o1 = (await request(http).post(`/v1/olivia/conversations/${conv.id}/messages`).set(bearer(T, RM1, "RM")).send({ texte: "Synthèse" })).body;
    const o2 = (await request(http).post(`/v1/olivia/conversations/${conv.id}/messages`).set(bearer(T, RM1, "RM")).send({ texte: "Encore" })).body;
    expect(o1.contexteEmpreinte).toBe(o2.contexteEmpreinte);                             // même dossier ⇒ même empreinte
    await request(http).patch(`/v1/kyc/${fileRm1.code}/questions/IDE-Q1`).set(bearer(T, RM1, "RM")).send({ answer: "Passeport vérifié" }).expect(200);
    const o3 = (await request(http).post(`/v1/olivia/conversations/${conv.id}/messages`).set(bearer(T, RM1, "RM")).send({ texte: "Après réponse" })).body;
    expect(o3.contexteEmpreinte).not.toBe(o1.contexteEmpreinte);                         // le dossier a changé ⇒ l'empreinte change
    console.log("OL-09 PASS — empreinte stable puis modifiée avec l'état (les deux rejouables)");
  });

  it("OL-10 : cross-tenant impossible — 404, rien ne fuit", async () => {
    const conv = (await request(http).post("/v1/olivia/conversations").set(bearer(T, RM1, "RM")).send({ capacite: "C1" })).body;
    await prisma.tenant.update({ where: { id: T2 }, data: { settings: { oliviaProviderRef: "anthropic", oliviaModel: "m" } } });
    await request(http).get(`/v1/olivia/conversations/${conv.id}`).set(bearer(T2, randomUUID(), "CO")).expect(404);
    console.log("OL-10 PASS — l'id d'une conversation de T ne donne RIEN à T2");
  });
});

describe("FAT OLIVIA — R256 citations (OL-11/13/14 ; OL-12 à l'étape 6 avec la route proposition)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const RM1 = randomUUID();
  let file: any = null, conv: any = null, questionId = "";

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    await prisma.client.update({ where: { id: clientId }, data: { rmUserId: RM1 } });
    await prisma.tenant.update({ where: { id: T }, data: { settings: { oliviaProviderRef: "anthropic", oliviaModel: "claude-sonnet-5" } } });
    file = (await request(http).post("/v1/kyc").set(bearer(T, RM1, "RM"))
      .send({ clientId, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM1 })).body;
    const q = await prisma.kycQuestion.findFirst({ where: { code: "IDE-Q1", section: { kycFileId: file.id } } });
    questionId = q!.id;
    conv = (await request(http).post("/v1/olivia/conversations").set(bearer(T, RM1, "RM"))
      .send({ capacite: "C2", ancrageType: "KYC_FILE", ancrageId: file.id })).body;
  });
  afterAll(async () => { await app.close(); });

  it("OL-13 : une citation vers un objet DU contexte est valide — est_source=true, ref existante en base", async () => {
    const r = (await request(http).post(`/v1/olivia/conversations/${conv.id}/messages`).set(bearer(T, RM1, "RM"))
      .send({ texte: `Synthèse CITE_TEST:KYC_QUESTION:${questionId}` })).body;
    expect(r.estSource).toBe(true);                                        // ≥1 citation valide
    const c = r.citations.find((x: any) => x.ref === questionId);
    expect(c.valide).toBe(true);
    expect(await prisma.kycQuestion.findFirst({ where: { id: questionId } })).not.toBeNull();  // la ref existe
    console.log("OL-13 PASS — citation du contexte valide, est_source=true");
  });

  it("OL-11 : citer un objet HORS contexte invalide la citation — plus aucune valide ⇒ est_source=false", async () => {
    const horsContexte = randomUUID();                                     // jamais montré au modèle
    const r = (await request(http).post(`/v1/olivia/conversations/${conv.id}/messages`).set(bearer(T, RM1, "RM"))
      .send({ texte: `Synthèse CITE_TEST:KYC_QUESTION:${horsContexte}` })).body;
    expect(r.citations[0].valide).toBe(false);                             // le modèle ne cite pas ce qu'on ne lui a pas montré
    expect(r.estSource).toBe(false);
    const stocke = await prisma.oliviaMessage.findFirst({ where: { conversationId: conv.id, seq: r.seq } });
    expect(stocke!.estSource).toBe(false);                                 // le verdict est JOURNALISÉ, pas seulement rendu
    console.log("OL-11 PASS — citation hors contexte invalidée, sortie non sourcée");
  });

  it("OL-14 : une REGLE inexistante au catalogue est invalidée ; une règle réelle est valide", async () => {
    const r = (await request(http).post(`/v1/olivia/conversations/${conv.id}/messages`).set(bearer(T, RM1, "RM"))
      .send({ texte: "Synthèse CITE_TEST:REGLE:R999 CITE_TEST:REGLE:R15" })).body;
    const r999 = r.citations.find((c: any) => c.ref === "R999");
    const r15 = r.citations.find((c: any) => c.ref === "R15");
    expect(r999.valide).toBe(false);                                       // R999 n'existe pas au catalogue
    expect(r15.valide).toBe(true);                                         // R15 (visa uniforme) existe
    expect(r.estSource).toBe(true);                                        // une valide suffit
    console.log("OL-14 PASS — R999 invalidée, R15 valide");
  });
});
