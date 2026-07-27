/**
 * FAT — Porte HTTP mince CPSI (spec `spec/cpsi-scenarios/CPSI-PORTE.feature`).
 * Squelette vertical exécuté contre le VRAI backend + le VRAI moteur Python (shell-out) :
 * chemin SCORE (CP-01), rejeu à date (CP-02), ingestion default-deny (CP-11), isolation tenant (CP-18).
 * La porte ne calcule rien elle-même : tout score/driver provient du moteur ratifié (CP-19).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT CPSI — porte mince (backend + moteur Python réels)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const A = randomUUID(), B = randomUUID();
  const U = randomUUID();
  const cid = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, A, randomUUID());
    await seedTenantClient(prisma, B, randomUUID());
    // Enregistre un client CPSI + un signal, à des dates distinctes (pour le rejeu).
    await request(http).post("/v1/cpsi/clients").set(bearer(A, U, "CO"))
      .send({ clientId: cid, statique: { pep: true, pays_risque: 1 }, at: "2026-01-01T00:00:00.000Z" }).expect(201);
    await request(http).post(`/v1/cpsi/clients/${cid}/signals`).set(bearer(A, U, "CO"))
      .send({ type: "hit_screening", severite: 1, at: "2026-02-01T00:00:00.000Z" }).expect(201);
  });
  afterAll(async () => { await app.close(); });

  it("CP-01 [R63/R67] score perpétuel + drivers dont la somme reconstitue le score", async () => {
    const g = await request(http).get(`/v1/cpsi/clients/${cid}/score`).set(bearer(A, U, "CO"));
    expect(g.status).toBe(200);
    expect(g.body.score).toBeGreaterThan(0);
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(g.body.bande);
    const somme = g.body.drivers.reduce((s: number, d: any) => s + d.contribution, 0);
    expect(Math.abs(somme - g.body.score)).toBeLessThan(0.05);            // R67 : explicabilité
    expect(g.body.drivers.some((d: any) => d.source.startsWith("statique:pep"))).toBe(true);
    console.log("CP-01 PASS — score", g.body.score, "bande", g.body.bande, "drivers", g.body.drivers.length);
  });

  it("CP-02 [R48/R64] rejeu à date : le signal futur n'existe pas, score statique seul", async () => {
    const avant = await request(http).get(`/v1/cpsi/clients/${cid}/score?asOf=2026-01-15T00:00:00.000Z`).set(bearer(A, U, "CO"));
    const apres = await request(http).get(`/v1/cpsi/clients/${cid}/score?asOf=2026-03-01T00:00:00.000Z`).set(bearer(A, U, "CO"));
    expect(avant.body.drivers.some((d: any) => d.source.includes("hit_screening"))).toBe(false);  // signal ≤ asOf uniquement
    expect(apres.body.drivers.some((d: any) => d.source.includes("hit_screening"))).toBe(true);
    expect(apres.body.score).toBeGreaterThan(avant.body.score);           // le signal ajoute du risque
    console.log("CP-02 PASS — avant", avant.body.score, "après", apres.body.score);
  });

  it("CP-11 [R63] ingestion default-deny : type inconnu refusé, rien persisté", async () => {
    const nAvant = await prisma.cpsiEvent.count({ where: { tenantId: A, clientId: cid } });
    const ko = await request(http).post(`/v1/cpsi/clients/${cid}/signals`).set(bearer(A, U, "CO"))
      .send({ type: "TYPE_INEXISTANT", severite: 1, at: "2026-02-15T00:00:00.000Z" });
    expect(ko.status).toBe(400);
    expect(JSON.stringify(ko.body)).toContain("default-deny");
    const nApres = await prisma.cpsiEvent.count({ where: { tenantId: A, clientId: cid } });
    expect(nApres).toBe(nAvant);                                          // aucune écriture (validation par rejeu)
    console.log("CP-11 PASS — type inconnu refusé (400), journal inchangé");
  });

  it("CP-18 isolation tenant : le tenant B ne voit pas le client CPSI de A", async () => {
    const g = await request(http).get(`/v1/cpsi/clients/${cid}/score`).set(bearer(B, randomUUID(), "CO"));
    expect(g.status).toBe(404);                                           // client inconnu dans le périmètre de B
    console.log("CP-18 PASS — client de A invisible pour B");
  });

  it("CP-03 [R65] segmentation déterministe : le client porte un segment stable", async () => {
    const g = await request(http).get(`/v1/cpsi/segmentation`).set(bearer(A, U, "CO"));
    expect(g.status).toBe(200);
    const mien = g.body.segments.find((s: any) => s.client === cid);
    expect(mien).toBeDefined();
    expect(mien.segment).toMatch(/^[BMH]-(CALME|ACTIF|INTENSE)$/);        // grille statique × comportement
    const g2 = await request(http).get(`/v1/cpsi/segmentation`).set(bearer(A, U, "CO"));
    expect(g2.body.segments.find((s: any) => s.client === cid).segment).toBe(mien.segment);  // stable (déterminisme)
    console.log("CP-03 PASS — segment", mien.segment);
  });

  it("CP-07 [R79] catalogue de conformité en lecture seule (bien formé, vide sans scénario)", async () => {
    const g = await request(http).get(`/v1/cpsi/compliance-catalogue`).set(bearer(A, U, "CO"));
    expect(g.status).toBe(200);
    expect(Array.isArray(g.body.catalogue)).toBe(true);                   // ATTR_DEFS/paramètres exposés, aucune écriture
    console.log("CP-07 PASS — catalogue lecture seule, entrées:", g.body.catalogue.length);
  });

  it("CP-08 [R68] règles de calcul en clair (half-life + explicabilité R67)", async () => {
    const g = await request(http).get(`/v1/cpsi/rules`).set(bearer(A, U, "CO"));
    expect(g.status).toBe(200);
    const txt = (g.body.regles as string[]).join("\n");
    expect(txt).toContain("Half-life");
    expect(txt).toMatch(/drivers.*reconstitue le score/);                 // R67 énoncé en clair
    console.log("CP-08 PASS — règles en clair,", g.body.regles.length, "lignes");
  });

  it("CP-04/05 [R71/R72] groupe de population : appartenance, primaire, registre en clair", async () => {
    await request(http).post(`/v1/cpsi/groups`).set(bearer(A, U, "CO"))
      .send({ gid: "PEP", label: "Clients PEP", predicat: { logique: "OU", conditions: [{ champ: "pep", op: "eq", val: true }] } }).expect(201);
    const mine = await request(http).get(`/v1/cpsi/clients/${cid}/groups`).set(bearer(A, U, "CO"));
    expect(mine.body.primary).toBe("PEP");                                // client PEP → groupe primaire PEP
    expect(mine.body.groups.some((g: any) => g.id === "PEP")).toBe(true);
    const reg = await request(http).get(`/v1/cpsi/groups`).set(bearer(A, U, "CO"));
    const pep = reg.body.groupes.find((g: any) => g.id === "PEP");
    expect(pep.effectif).toBeGreaterThanOrEqual(1);                       // R74 : effectif en clair
    console.log("CP-04/05 PASS — primaire PEP, effectif", pep.effectif);
  });

  it("CP-06 [R73] scénario ciblé : seuls les membres du groupe visé sont évalués", async () => {
    await request(http).post(`/v1/cpsi/scenarios`).set(bearer(A, U, "CO"))
      .send({ sid: "SC_SCORE", label: "Score élevé PEP", champ: "score", groupesSeuils: { PEP: 10 }, sens: "gte" }).expect(201);
    const ev = await request(http).get(`/v1/cpsi/scenarios/SC_SCORE/evaluate`).set(bearer(A, U, "CO"));
    expect(ev.body.hits.some((h: any) => h.client === cid && h.groupe === "PEP")).toBe(true);
    expect(ev.body.evalues).toBeGreaterThanOrEqual(1);
    console.log("CP-06 PASS — évalués", ev.body.evalues, "hits", ev.body.hits.length);
  });

  it("CP-06 [R73] default-deny : scénario visant un groupe inconnu est refusé", async () => {
    const ko = await request(http).post(`/v1/cpsi/scenarios`).set(bearer(A, U, "CO"))
      .send({ sid: "SC_KO", label: "x", champ: "score", groupesSeuils: { INCONNU: 10 } });
    expect(ko.status).toBe(400);
    expect(JSON.stringify(ko.body)).toContain("INCONNU");
    console.log("CP-06 default-deny PASS — groupe cible inconnu refusé");
  });

  it("CP-12 [R80/R81] signaux scorés & alertes : dédup par (client,scénario), statut vs seuil X", async () => {
    const g = await request(http).get(`/v1/cpsi/alerts`).set(bearer(A, U, "CO"));
    expect(g.status).toBe(200);
    const mien = g.body.signaux.find((s: any) => s.client === cid && s.scenario === "SC_SCORE");
    expect(mien).toBeDefined();
    expect(["ALERTE", "NEAR_MISS", "ANALYSE"]).toContain(mien.statut);    // vocabulaire R80
    expect(typeof mien.score).toBe("number");
    console.log("CP-12 PASS — signal", mien.statut, "score", mien.score);
  });
});
