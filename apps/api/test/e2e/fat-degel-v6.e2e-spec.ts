/**
 * FAT — DÉGEL VAGUE 6 (canon ratifié 2026-07-28, mapping +3) : BI LIBRE.
 * R314 [canon R311] la BI interroge des PROJECTIONS déclarées (liste blanche en CI,
 * pattern R264) — zéro SQL libre · R315 [canon R312] le scope s'applique aux projections
 * (RBAC/RLS) ; l'extraction massive est un acte d'audit (AUDIT_ACCESS notifié SO),
 * mesurée, jamais bloquée. BL-01..04.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

describe("FAT DÉGEL V6 — R314/R315 : projections déclarées, scopées, l'export massif s'audite (BL-01..04)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const RM = randomUUID(), AUTRE_RM = randomUUID(), CO = randomUUID(), ADMIN = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    // 3 clients : 2 au RM, 1 à un autre RM — le scope se prouve
    for (const [cid, rm, pays] of [[randomUUID(), RM, "CH"], [randomUUID(), RM, "DE"], [randomUUID(), AUTRE_RM, "CH"]] as any[]) {
      await seedTenantClient(prisma, T, cid);
      await prisma.client.update({ where: { id: cid }, data: { rmUserId: rm, country: pays } });
    }
  });
  afterAll(async () => { await app.close(); });

  it("BL-01 [R314] une requête HORS liste blanche → refus typé ; une vue déclarée hors CI → le vérificateur rend le build ROUGE", async () => {
    const r = await request(http).post("/v1/bi/requete").set(bearer(T, CO, "CO"))
      .send({ vue: "table_secrete", dimensions: ["x"] });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain("R314");
    // Une dimension hors colonnes déclarées → même refus (la vue déclare TOUT)
    const r2 = await request(http).post("/v1/bi/requete").set(bearer(T, CO, "CO"))
      .send({ vue: "clients_par_pays", dimensions: ["passwordHash"] });
    expect(r2.status).toBe(400);
    // Le VÉRIFICATEUR CI : une vue dont la source n'est pas une projection autorisée → erreurs
    const { valider } = require("../../scripts/verifier-vues-bi.js");
    const erreurs = valider({ vue_pirate: { source: "users", dimensions: ["email"], mesures: ["n"], sensibilite: "HAUTE" } });
    expect(erreurs.length).toBeGreaterThanOrEqual(1);                       // build rouge hors liste
    expect(valider(JSON.parse(fs.readFileSync(path.join(__dirname, "../../src/modules/bi/vues-bi.json"), "utf8"))).length).toBe(0);
    console.log("BL-01 PASS — hors liste refusé, vérificateur CI rouge sur source interdite");
  });

  it("BL-02 [R315] la MÊME requête par RM vs CO → résultats SCOPÉS différents — au backend, jamais au front", async () => {
    const req = { vue: "clients_par_pays", dimensions: ["country"], mesures: ["n"] };
    const co = await request(http).post("/v1/bi/requete").set(bearer(T, CO, "CO")).send(req);
    expect(co.status).toBe(201);
    const totalCO = co.body.lignes.reduce((s: number, l: any) => s + l.n, 0);
    expect(totalCO).toBe(3);                                                // CO voit le tenant
    const rm = await request(http).post("/v1/bi/requete").set(bearer(T, RM, "RM")).send(req);
    const totalRM = rm.body.lignes.reduce((s: number, l: any) => s + l.n, 0);
    expect(totalRM).toBe(2);                                                // le RM n'agrège que SES clients
    console.log("BL-02 PASS — même requête, scopes différents (backend)");
  });

  it("BL-03 [R315/R39] export au-delà du seuil → AUDIT_ACCESS + notification SO — l'export est SERVI, jamais bloqué", async () => {
    await request(http).post("/v1/parametres/valeur/bi_seuil_export").set(bearer(T, ADMIN, "ADMIN"))
      .send({ valeur: 2, motif: "R315 : seuil d'extraction massive (test)" }).expect(201);
    const r = await request(http).post("/v1/bi/requete").set(bearer(T, CO, "CO"))
      .send({ vue: "clients_par_pays", dimensions: ["country", "riskLevel"], mesures: ["n"], export: true });
    expect(r.status).toBe(201);                                             // SERVI (R39)
    const ev = await prisma.domainEvent.findFirst({
      where: { tenantId: T, type: "AUDIT_ACCESS", aggregateId: { contains: "bi:" } }, orderBy: { id: "desc" } });
    expect(ev).toBeTruthy();
    expect((ev!.payload as any).lignes).toBeGreaterThanOrEqual(0);
    expect((ev!.payload as any).notifie).toContain("SO");                   // qui, quelle requête, combien
    console.log("BL-03 PASS — extraction massive auditée et notifiée, export servi");
  });

  it("BL-04 [R314] AUCUNE écriture possible depuis le module BI — inventaire du code (revue automatisée)", async () => {
    const src = fs.readFileSync(path.join(__dirname, "../../src/modules/bi/bi.module.ts"), "utf8");
    expect(src).not.toMatch(/\.create\(|\.update\(|\.delete\(|\.upsert\(|executeRaw.*INSERT|executeRaw.*UPDATE/i);
    expect(src).not.toMatch(/@Patch|@Put|@Delete/);
    expect(src).not.toMatch(/\$queryRawUnsafe|\$executeRaw/);               // zéro SQL libre — structurel
    console.log("BL-04 PASS — lecture pure, zéro SQL, zéro écriture");
  });
});
