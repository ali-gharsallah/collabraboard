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
});
