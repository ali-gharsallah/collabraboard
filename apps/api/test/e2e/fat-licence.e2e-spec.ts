/**
 * FAT — LA LICENCE EST SERVIE ET APPLIQUÉE (canon débloquants Home partie 3, LS-01..03 —
 * famille LS ratifiée : ex-LC, pris par le corpus licence vendor ; APPLICATION de R177→R179,
 * aucune règle nouvelle, R279 non consommé). Source ratifiée : LicenseService
 * (tenant, licence SIGNÉE vérifiable hors ligne). Les tests génèrent une paire de clés RSA et
 * SIGNENT réellement les licences — aucune signature simulée.
 */
import * as request from "supertest";
import { randomUUID, generateKeyPairSync, createSign } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.OLIVE_LICENSE_PUBKEY = publicKey.export({ type: "spki", format: "pem" }) as string;

function licence(tenantId: string, modules: string[], issuedAt: string, expiresAt = "2030-01-01T00:00:00.000Z") {
  const body = JSON.stringify({ tenantId, modules, seats: 25, expiresAt, issuedAt });
  const signature = createSign("SHA256").update(body).sign(privateKey, "base64");
  return { tenantId, modules, seats: 25, expiresAt, issuedAt, signature };
}

describe("FAT LICENCE — partie 3 débloquants : la licence est servie et appliquée (LS-01..03)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const ADMIN = randomUUID(), CO = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("LS-01 [R177/R178] le front LIT, le backend APPLIQUE : sans CPSI, /modules/actifs ne le liste pas ET la route CPSI refuse 403 MODULE_INACTIF", async () => {
    // Avant toute licence : mode socle (écart consigné) — enforcement désactivé, dit honnêtement
    const socle = (await request(http).get("/v1/modules/actifs").set(bearer(T, CO, "CO"))).body;
    expect(socle.enforcement).toBe(false);
    // Licence SANS cpsi (signée, vérifiée) — un CO ne peut pas la charger (acte ADMIN)
    const lic = licence(T, ["kyc", "aml", "screening"], "2026-07-01T00:00:00.000Z");
    await request(http).post("/v1/modules/licence").set(bearer(T, CO, "CO")).send(lic).expect(403);
    await request(http).post("/v1/modules/licence").set(bearer(T, ADMIN, "ADMIN")).send(lic).expect(201);
    const actifs = (await request(http).get("/v1/modules/actifs").set(bearer(T, CO, "CO"))).body;
    expect(actifs.enforcement).toBe(true);
    expect(actifs.modules.map((m: any) => m.code)).toEqual(["kyc", "aml", "screening"]);   // cpsi ABSENT
    // L'appel DIRECT à une route CPSI (curl) → 403 typé — l'enforcement est SERVEUR
    const cpsi = await request(http).get("/v1/cpsi/rules").set(bearer(T, CO, "CO"));
    expect(cpsi.status).toBe(403);
    expect(JSON.stringify(cpsi.body)).toContain("MODULE_INACTIF");
    const post = await request(http).post("/v1/cpsi/clients").set(bearer(T, CO, "CO")).send({ clientId: randomUUID() });
    expect(post.status).toBe(403);
    // Une route HORS module reste intacte
    await request(http).get("/v1/tasks").set(bearer(T, CO, "CO")).expect(200);
    // Signature invalide → refus net (licence altérée)
    const alteree = { ...licence(T, ["kyc", "cpsi"], "2026-07-02T00:00:00.000Z"), modules: ["kyc", "cpsi", "aml"] };
    await request(http).post("/v1/modules/licence").set(bearer(T, ADMIN, "ADMIN")).send(alteree).expect(403);
    console.log("LS-01 PASS — liste sans cpsi, routes CPSI 403 MODULE_INACTIF, altération refusée");
  });

  it("LS-02 [R68/R177] l'activation est un ÉVÉNEMENT à date : nouvelle licence AVEC cpsi → actif_depuis + journal (auteur, date)", async () => {
    const jour = "2026-07-15T00:00:00.000Z";
    await request(http).post("/v1/modules/licence").set(bearer(T, ADMIN, "ADMIN"))
      .send(licence(T, ["kyc", "aml", "screening", "cpsi"], jour)).expect(201);
    const actifs = (await request(http).get("/v1/modules/actifs").set(bearer(T, CO, "CO"))).body;
    const cpsi = actifs.modules.find((m: any) => m.code === "cpsi");
    expect(cpsi.actifDepuis).toBe(jour);                                     // « depuis quand ? » se répond
    const evs = await prisma.domainEvent.findMany({ where: { tenantId: T, type: "module.licence.chargee" } });
    expect(evs.length).toBe(2);                                              // chaque chargement au journal
    expect((evs[1].payload as any).par).toBe(ADMIN);                         // auteur tracé
    expect((evs[1].payload as any).modules).toContain("cpsi");
    // La route CPSI répond désormais (le module est actif)
    await request(http).get("/v1/cpsi/rules").set(bearer(T, CO, "CO")).expect(200);
    console.log("LS-02 PASS — actif_depuis =", jour, ", 2 événements au journal");
  });

  it("LS-03 [pattern R271] la désactivation n'ampute PAS l'audit : routes refusées, lecture d'audit et données intactes", async () => {
    // Nouvelle licence SANS cpsi (désactivation) — les données/événements ne bougent pas
    const evAvant = await prisma.cpsiEvent.count({ where: { tenantId: T } });
    await request(http).post("/v1/modules/licence").set(bearer(T, ADMIN, "ADMIN"))
      .send(licence(T, ["kyc", "aml"], "2026-07-20T00:00:00.000Z")).expect(201);
    await request(http).get("/v1/cpsi/rules").set(bearer(T, CO, "CO")).expect(403);        // le CO n'entre plus
    const audit = await request(http).get("/v1/cpsi/health").set(bearer(T, ADMIN, "ADMIN"));
    expect(audit.status).toBe(200);                                          // l'AUDIT lit toujours (GET + ADMIN)
    const post = await request(http).post("/v1/cpsi/clients").set(bearer(T, ADMIN, "ADMIN")).send({ clientId: randomUUID() });
    expect(post.status).toBe(403);                                           // même ADMIN n'ÉCRIT pas sur un module inactif
    expect(await prisma.cpsiEvent.count({ where: { tenantId: T } })).toBe(evAvant);        // couper l'accès n'efface rien
    console.log("LS-03 PASS — 403 pour l'usage, lecture d'audit 200, données intactes");
  });
});
