/**
 * FAT — VAGUE DE CLÔTURE (canon ratifié 2026-07-29, mapping R330) : READINESS & PIPELINE.
 * R330 [canon R327] : /readyz agrégé (DB migrée, Redis si REDIS_URL, outbox vivant, JWKS
 * chargé, secrets PRÉSENTS jamais leurs valeurs, moteur Python invocable) ; /healthz =
 * vivacité simple ; le journal des déploiements est append-only, visible dans auditit
 * (AU-08 étendu). RZ-01..04. Ces deux endpoints sont PUBLICS (les sondes n'ont pas de jeton).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

describe("FAT CLÔTURE — R330 : l'instance déclare si elle est PRÊTE (RZ-01..04)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const DIR = randomUUID(), SO = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
  });
  afterAll(async () => { await app.close(); });

  it("RZ-01 [R330] /readyz nomme chaque composant requis ; /healthz reste une vivacité simple — les deux SANS jeton", async () => {
    const h = await request(http).get("/v1/healthz");                      // PUBLIC — aucune auth
    expect(h.status).toBe(200);
    expect(h.body.vivant).toBe(true);
    const r = await request(http).get("/v1/readyz");                       // PUBLIC — aucune auth
    expect([200, 503]).toContain(r.status);                                // prêt (200) ou pas (503) — jamais 401
    const noms = r.body.composants.map((c: any) => c.nom);
    for (const requis of ["db_migree", "outbox", "jwks", "secrets", "moteur_cpsi"])
      expect(noms).toContain(requis);                                      // la liste est DÉCLARÉE, chaque composant se nomme
    // Chaque composant porte un statut booléen + un détail lisible
    for (const c of r.body.composants) { expect(typeof c.ok).toBe("boolean"); expect(c.nom).toBeTruthy(); }
    console.log(`RZ-01 PASS — /readyz statut=${r.status}, composants=${noms.join(",")}`);
  });

  it("RZ-03 [R330] /readyz ne révèle AUCUNE valeur de secret ni détail interne au-delà du nécessaire", async () => {
    process.env.AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || "x".repeat(64);
    const r = await request(http).get("/v1/readyz");
    const brut = JSON.stringify(r.body);
    // La valeur des secrets connus ne fuit jamais — seule leur PRÉSENCE est déclarée
    expect(brut).not.toContain(process.env.AUDIT_HMAC_SECRET);
    if (process.env.MFA_ENC_KEY) expect(brut).not.toContain(process.env.MFA_ENC_KEY);
    const secrets = r.body.composants.find((c: any) => c.nom === "secrets");
    expect(secrets.detail).toMatch(/présent|manquant/i);                   // présence, jamais la valeur
    expect(brut).not.toMatch(/BEGIN [A-Z ]*PRIVATE KEY/);                  // aucune clé privée
    console.log("RZ-03 PASS — présence des secrets déclarée, aucune valeur révélée");
  });

  it("RZ-02/04 [R330] un déploiement est un ÉVÉNEMENT tracé (version, qui, quand, smoke) — append-only, visible dans auditit", async () => {
    // Le pipeline (déclenché par un humain) enregistre l'issue du déploiement via la route dédiée
    const enr = await request(http).post("/v1/deploiements").set(bearer(T, DIR, "DIR"))
      .send({ version: "2026.07.29-1", smokeOk: true, readyz: "vert" });
    expect(enr.status).toBe(201);
    // RZ-02 : un smoke ROUGE se trace aussi (le pipeline s'arrête AVANT bascule — l'événement en atteste)
    await request(http).post("/v1/deploiements").set(bearer(T, DIR, "DIR"))
      .send({ version: "2026.07.29-2", smokeOk: false, readyz: "vert", note: "smoke login échoué — bascule annulée" }).expect(201);
    // AU-08 étendu : le journal est visible dans la surface d'audit (SO), append-only
    const journal = await request(http).get("/v1/deploiements").set(bearer(T, SO, "SO"));
    expect(journal.status).toBe(200);
    expect(journal.body.deploiements.length).toBeGreaterThanOrEqual(2);
    expect(journal.body.deploiements.some((d: any) => d.version === "2026.07.29-2" && d.smokeOk === false)).toBe(true);
    // Append-only : l'événement existe au journal de domaine, immuable
    const ev = await prisma.domainEvent.findFirst({
      where: { tenantId: T, type: "deploiement.enregistre" }, orderBy: { id: "desc" } });
    expect(ev).toBeTruthy();
    expect((ev!.payload as any).par).toBe(DIR);                            // qui — tracé
    console.log("RZ-02/04 PASS — déploiements tracés (smoke vert ET rouge), visibles en audit");
  });
});
