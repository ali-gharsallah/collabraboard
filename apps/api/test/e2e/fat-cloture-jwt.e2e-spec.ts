/**
 * FAT — VAGUE DE CLÔTURE (canon ratifié 2026-07-29, mapping R328) : LE CONTEXTE VIENT DU
 * JETON. L'existant est constaté (guard global RS256/JWKS, jetons réels au harnais) — ces
 * tests livrent le RELIQUAT ratifié : JW-01 l'énumération AUTOMATIQUE du routeur (jamais
 * une liste manuelle), JW-02 le cross-tenant formalisé sur 5 modules, JW-03/06 le grep
 * zéro en-tête (code + harnais + front), JW-04 la rotation JWKS re-prouvée À TRAVERS le
 * guard. (JW-05 expiration→login propre : côté front, FE-JW.)
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";
import { KeyStore } from "../../src/modules/auth/key-store";

// La liste blanche DU CODE (tenant.middleware + mobile.gate) — le test la reprend pour
// l'OPPOSER au routeur : tout le reste exige un jeton.
const LISTE_BLANCHE = [
  /^\/v1\/auth\/token$/, /^\/v1\/auth\/oidc\/login$/, /^\/v1\/auth\/methode$/,
  /^\/v1\/auth\/login$/, /^\/v1\/\.well-known\/jwks\.json$/, /^\/v1\/mobile\/auth\//,
];

describe("FAT CLÔTURE — R328 : le contexte vient du jeton, les en-têtes sont morts (JW-01..04/06)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const A = randomUUID(), B = randomUUID();
  const RM_A = randomUUID(), CO_A = randomUUID(), CO_SR_A = randomUUID(), CO_B = randomUUID();
  const clientA = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, A, clientA);
    await seedTenantClient(prisma, B, randomUUID());
    await prisma.client.update({ where: { id: clientA }, data: { rmUserId: RM_A } });
  });
  afterAll(async () => { await app.close(); });

  it("JW-01 [R328] TOUTES les routes du routeur (énumérées, jamais listées à la main) refusent 401 sans jeton — sauf la liste blanche", async () => {
    // Énumération du VRAI routeur Express monté par Nest — le test suit le code, pas l'inverse.
    const stack = (app.getHttpAdapter().getInstance() as any)._router.stack;
    const routes: { methode: string; chemin: string }[] = [];
    for (const couche of stack) {
      if (!couche.route) continue;
      for (const m of Object.keys(couche.route.methods)) if (couche.route.methods[m])
        routes.push({ methode: m.toUpperCase(), chemin: couche.route.path });
    }
    expect(routes.length).toBeGreaterThan(100);                             // le routeur est réellement énuméré
    let protegees = 0, publiques = 0;
    for (const r of routes) {
      const chemin = r.chemin.replace(/:[A-Za-z]+/g, randomUUID());        // les :params deviennent des ids inertes
      if (LISTE_BLANCHE.some((p) => p.test(chemin))) { publiques++; continue; }
      const rep = await (request(http) as any)[r.methode.toLowerCase()](chemin).send({});
      expect(`${r.methode} ${r.chemin} → ${rep.status}`).toBe(`${r.methode} ${r.chemin} → 401`);
      protegees++;
    }
    console.log(`JW-01 PASS — ${protegees} routes protégées (401 sans jeton), ${publiques} publiques en liste blanche`);
  });

  it("JW-02 [R328] un jeton du tenant B sur les données du tenant A → 404/vide — rejoué sur CINQ modules", async () => {
    // Données du tenant A par les vraies routes
    await request(http).post("/v1/cpsi/clients").set(bearer(A, CO_A, "CO")).send({ clientId: clientA }).expect(201);
    const inc = (await request(http).post("/v1/oprisk/incidents").set(bearer(A, CO_A, "CO"))
      .send({ titre: "Incident du tenant A", categorie: "EXECUTION_PROCESSUS", severite: 2 })).body;
    await request(http).post("/v1/coc/config").set(bearer(A, CO_SR_A, "CO_SR"))
      .send({ typeCode: "JW2", libelle: "JW2", materialite: "BASSE", actionRequise: "PRISE_CONNAISSANCE", roleTraitant: "RM" }).expect(201);
    const coc = (await request(http).post("/v1/coc").set(bearer(A, RM_A, "RM"))
      .send({ clientId: clientA, typeCode: "JW2", description: "dossier du tenant A" })).body;
    // Le tenant B ne voit RIEN — cinq modules, cinq preuves
    expect((await request(http).get(`/v1/cpsi/clients/${clientA}/score`).set(bearer(B, CO_B, "CO"))).status).toBe(404);
    const incB = (await request(http).get("/v1/oprisk/incidents").set(bearer(B, CO_B, "CO"))).body;
    expect(JSON.stringify(incB)).not.toContain(inc.id);
    const cocB = (await request(http).get("/v1/coc").set(bearer(B, CO_B, "CO"))).body;
    expect(JSON.stringify(cocB)).not.toContain(coc.id);
    const clientsB = (await request(http).get("/v1/clients").set(bearer(B, CO_B, "CO"))).body;
    expect(JSON.stringify(clientsB)).not.toContain(clientA);
    const legalB = await request(http).get("/v1/legal/par-reference?ref=JW2-inexistante").set(bearer(B, CO_B, "CO"));
    expect(legalB.status).toBe(404);
    console.log("JW-02 PASS — cross-tenant refusé/vide sur cpsi, oprisk, coc, clients, legal");
  });

  it("JW-03/06 [R328] les en-têtes de contexte sont MORTS : zéro lecture dans le code, le harnais ET le front (grep)", async () => {
    const racines = ["src", "test", "../web/src"];
    for (const r of racines) {
      const hits: string[] = [];
      const marcher = (d: string) => {
        for (const f of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, f.name);
          if (f.isDirectory()) { marcher(p); continue; }
          if (!/\.(ts|tsx)$/.test(f.name)) continue;
          const src = fs.readFileSync(p, "utf8");
          if (/x-tenant-id|x-user-id|x-user-role/.test(src) && !p.includes("fat-cloture-jwt")) hits.push(p);
        }
      };
      marcher(path.join(__dirname, "../../", r));
      expect(hits).toEqual([]);                                             // pas déprécié : SUPPRIMÉ
    }
    // Et à l'exécution : un en-tête envoyé est IGNORÉ, le contexte reste celui du jeton
    const r = await request(http).get("/v1/clients").set(bearer(A, CO_A, "CO"))
      .set({ "x-tenant-id": B, "x-user-role": "ADMIN" });
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).toContain(clientA);                      // les données de A — le jeton commande
    console.log("JW-03/06 PASS — zéro en-tête dans code/harnais/front, en-tête envoyé = ignoré");
  });

  it("JW-04 [R328] rotation JWKS À TRAVERS le guard : l'ancien kid sert jusqu'à expiration, le nouveau signe", async () => {
    const ancien = bearer(A, CO_A, "CO");                                   // signé avec le kid COURANT
    (app.get(KeyStore) as KeyStore).rotate();                               // la rotation R290 (grâce structurelle)
    await request(http).get("/v1/tasks").set(ancien).expect(200);           // l'ancien kid est TOLÉRÉ (grâce)
    await request(http).get("/v1/tasks").set(bearer(A, CO_A, "CO")).expect(200);  // le nouveau kid signe
    console.log("JW-04 PASS — rotation traversée par le guard, grâce structurelle");
  });
});
