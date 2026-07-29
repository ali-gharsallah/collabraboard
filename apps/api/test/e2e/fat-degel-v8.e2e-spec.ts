/**
 * FAT — DÉGEL VAGUE 8 (canon ratifié 2026-07-28, mapping +3) : CONSOLE ÉDITEUR.
 * R319 [canon R316] console vendor = INSTANCE séparée (déploiement, base, IAM propres) —
 * EDITOR n'existe QUE là : absent du RBAC tenant (test négatif PERMANENT, VE-01) ; aucune
 * connexion entrante console → données tenant · R320 [canon R317] la licence descend
 * SIGNÉE, l'instance vérifie (clé publique) et alimente R279 ; altérée → refus (VE-02) ;
 * expirée → module inactif, lecture d'audit préservée (LC-03), notifications J-60/J-30 —
 * JAMAIS de coupure de données (VE-03).
 */
import * as request from "supertest";
import { randomUUID, generateKeyPairSync, createSign } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.OLIVE_LICENSE_PUBKEY = publicKey.export({ type: "spki", format: "pem" }) as string;

function licence(tenantId: string, modules: string[], issuedAt: string, expiresAt: string) {
  const body = JSON.stringify({ tenantId, modules, seats: 25, expiresAt, issuedAt });
  const signature = createSign("SHA256").update(body).sign(privateKey, "base64");
  return { tenantId, modules, seats: 25, expiresAt, issuedAt, signature };
}
const dansJours = (j: number) => new Date(Date.now() + j * 86400000).toISOString();

describe("FAT DÉGEL V8 — R319/R320 : EDITOR n'existe pas ici, la licence signée fait foi, l'expiration ne coupe rien (VE-01..03)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const ADMIN = randomUUID(), CO = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("VE-01 [R319] EDITOR est ABSENT du RBAC tenant — enum fermé en base, refus TYPÉ à la création, source vierge (test négatif permanent)", async () => {
    // 1. Le type Postgres lui-même ne connaît pas EDITOR — contrainte de SCHÉMA, pas une validation
    const valeurs = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(
      `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'Role'`);
    expect(valeurs.length).toBeGreaterThan(0);
    expect(valeurs.map((v) => v.enumlabel)).not.toContain("EDITOR");
    // 2. Créer un utilisateur EDITOR → refus TYPÉ (jamais un 500 d'enum)
    const r = await request(http).post("/v1/admin/users").set(bearer(T, ADMIN, "ADMIN"))
      .send({ email: "vendor@editeur.ch", name: "Vendor", role: "EDITOR", password: "Xx-très-long-secret-1" });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain("R319");
    // 3. Changer un rôle vers EDITOR → même refus
    const u = (await request(http).post("/v1/admin/users").set(bearer(T, ADMIN, "ADMIN"))
      .send({ email: "rm@banque.ch", name: "RM", role: "RM", password: "Xx-très-long-secret-1" })).body;
    const r2 = await request(http).post(`/v1/admin/users/${u.id}/role`).set(bearer(T, ADMIN, "ADMIN"))
      .send({ role: "EDITOR" });
    expect(r2.status).toBe(400);
    // 4. Revue automatisée PERMANENTE : aucun source du RBAC tenant ne mentionne EDITOR
    for (const f of ["src/modules/auth/users.service.ts", "src/modules/auth/roles.guard.ts", "prisma/schema.prisma"]) {
      const src = fs.readFileSync(path.join(__dirname, "../../", f), "utf8");
      const sansCommentaires = src.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
      expect(sansCommentaires).not.toMatch(/\bEDITOR\b/);                   // il n'existe que sur l'instance vendor
    }
    console.log("VE-01 PASS — enum sans EDITOR, refus typé R319, sources vierges");
  });

  it("VE-02 [R320] la licence SIGNÉE descend et fait foi (LC-02 rejoué) ; ALTÉRÉE → refus net", async () => {
    const ok = licence(T, ["kyc", "aml", "cpsi"], dansJours(0), dansJours(365));
    await request(http).post("/v1/modules/licence").set(bearer(T, ADMIN, "ADMIN")).send(ok).expect(201);
    const actifs = (await request(http).get("/v1/modules/actifs").set(bearer(T, CO, "CO"))).body;
    expect(actifs.enforcement).toBe(true);
    expect(actifs.modules.map((m: any) => m.code)).toEqual(["kyc", "aml", "cpsi"]);   // à jour
    // Altération APRÈS signature (un module ajouté à la main) → la clé publique la démasque
    const alteree = { ...licence(T, ["kyc"], dansJours(0), dansJours(365)), modules: ["kyc", "cpsi", "bi"] };
    await request(http).post("/v1/modules/licence").set(bearer(T, ADMIN, "ADMIN")).send(alteree).expect(403);
    // L'état en vigueur n'a pas bougé — l'altération n'a RIEN écrit
    const apres = (await request(http).get("/v1/modules/actifs").set(bearer(T, CO, "CO"))).body;
    expect(apres.modules.map((m: any) => m.code)).toEqual(["kyc", "aml", "cpsi"]);
    console.log("VE-02 PASS — signée = modules à jour ; altérée = refus, état intact");
  });

  it("VE-03 [R320/LC-03] J-60/J-30 NOTIFIÉS une fois ; expirée → modules INACTIFS mais audit consultable — jamais de coupure de données", async () => {
    // Licence expirant dans 45 jours → le tick notifie J-60 (une fois), pas J-30
    await request(http).post("/v1/modules/licence").set(bearer(T, ADMIN, "ADMIN"))
      .send(licence(T, ["kyc", "aml", "cpsi"], dansJours(0), dansJours(45))).expect(201);
    await request(http).post("/v1/modules/licence/tick").set(bearer(T, ADMIN, "ADMIN")).expect(201);
    await request(http).post("/v1/modules/licence/tick").set(bearer(T, ADMIN, "ADMIN")).expect(201);
    const j60 = await prisma.domainEvent.findMany({ where: { tenantId: T, type: "licence.expiration.j60" } });
    expect(j60.length).toBe(1);                                             // UNE fois par état (pattern R274)
    expect((j60[0].payload as any).notifie).toContain("ADMIN");
    expect(await prisma.domainEvent.count({ where: { tenantId: T, type: "licence.expiration.j30" } })).toBe(0);
    // Licence expirant dans 20 jours → J-30 notifié aussi
    await request(http).post("/v1/modules/licence").set(bearer(T, ADMIN, "ADMIN"))
      .send(licence(T, ["kyc", "aml", "cpsi"], dansJours(0), dansJours(20))).expect(201);
    await request(http).post("/v1/modules/licence/tick").set(bearer(T, ADMIN, "ADMIN")).expect(201);
    expect(await prisma.domainEvent.count({ where: { tenantId: T, type: "licence.expiration.j30" } })).toBe(1);
    // Licence qui EXPIRE réellement (2 s) — chargée valide, puis le temps passe
    const evAvant = await prisma.domainEvent.count({ where: { tenantId: T } });
    await request(http).post("/v1/modules/licence").set(bearer(T, ADMIN, "ADMIN"))
      .send(licence(T, ["kyc", "aml", "cpsi"], dansJours(0), new Date(Date.now() + 2000).toISOString())).expect(201);
    await new Promise((r) => setTimeout(r, 2600));
    const etat = (await request(http).get("/v1/modules/actifs").set(bearer(T, CO, "CO"))).body;
    expect(etat.expiree).toBe(true);                                        // dit HONNÊTEMENT — pas un throw
    expect(etat.modules).toEqual([]);                                       // modules INACTIFS
    const usage = await request(http).get("/v1/cpsi/rules").set(bearer(T, CO, "CO"));
    expect(usage.status).toBe(403);                                         // l'usage refuse…
    expect(JSON.stringify(usage.body)).toContain("MODULE_INACTIF");
    const audit = await request(http).get("/v1/cpsi/health").set(bearer(T, ADMIN, "ADMIN"));
    expect(audit.status).toBe(200);                                         // …la LECTURE d'audit reste (LC-03)
    expect(await prisma.domainEvent.count({ where: { tenantId: T } })).toBeGreaterThanOrEqual(evAvant);  // rien d'effacé
    // Le tick constate l'expiration — événement notifié, une fois
    await request(http).post("/v1/modules/licence/tick").set(bearer(T, ADMIN, "ADMIN")).expect(201);
    await request(http).post("/v1/modules/licence/tick").set(bearer(T, ADMIN, "ADMIN")).expect(201);
    expect(await prisma.domainEvent.count({ where: { tenantId: T, type: "licence.expiree" } })).toBe(1);
    console.log("VE-03 PASS — J-60/J-30 une fois, expirée = inactif + audit lisible, zéro donnée coupée");
  });
});
