/**
 * FAT — DÉGEL VAGUE 4 (canon ratifié 2026-07-28, mapping +3) : REGWATCH.
 * R309 [canon R306] sources = PORTS déclarés, item = événement dédupliqué par empreinte ·
 * R310 [canon R307] qualification HUMAINE motivée, Olivia PROPOSE (citations Rn) ·
 * R311 [canon R308] l'impact se RATTACHE au catalogue (tâche d'analyse), regwatch ne
 * modifie JAMAIS une règle. VR-01..05.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

describe("FAT DÉGEL V4 — R309-R311 : la veille, portée, qualifiée, rattachée (VR-01..05)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const CO = randomUUID(), ADMIN = randomUUID(), OLIVIA = randomUUID();

  beforeAll(async () => {
    process.env.REGWATCH_FAKE_FEED = "1";                 // le flux FINMA de TEST (déterministe)
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, randomUUID());
    // Deux sources déclarées au registre : FINMA (credentials présents en test) et SECO (sans)
    await request(http).post("/v1/parametres/valeur/regwatch_sources").set(bearer(T, ADMIN, "ADMIN"))
      .send({ valeur: [{ code: "FINMA", libelle: "Communications FINMA", credentials: true },
                       { code: "SECO", libelle: "Sanctions SECO", credentials: false }],
        motif: "R309 : sources de veille du tenant" }).expect(201);
  });
  afterAll(async () => { delete process.env.REGWATCH_FAKE_FEED; await app.close(); });

  it("VR-01 [R309/R167] source sans credentials → port ÉTEINT affiché, zéro item, rien cassé", async () => {
    const r = await request(http).post("/v1/regwatch/collecter").set(bearer(T, CO, "CO"));
    expect(r.status).toBe(201);
    const seco = r.body.sources.find((s: any) => s.code === "SECO");
    expect(seco.etat).toBe("ETEINT");                                       // affiché, pas cassé
    expect(seco.items).toBe(0);
    const finma = r.body.sources.find((s: any) => s.code === "FINMA");
    expect(finma.etat).toBe("ACTIF");
    expect(finma.items).toBeGreaterThanOrEqual(2);                          // la fixture livre
    console.log("VR-01 PASS — port éteint visible, zéro item, la collecte vit");
  });

  it("VR-02 [R309] le même item livré deux fois → UNE entrée (déduplication par empreinte)", async () => {
    const avant = (await request(http).get("/v1/regwatch/items").set(bearer(T, CO, "CO"))).body.length;
    const re = await request(http).post("/v1/regwatch/collecter").set(bearer(T, CO, "CO"));
    expect(re.status).toBe(201);
    expect(re.body.sources.find((s: any) => s.code === "FINMA").items).toBe(0);   // rien de NOUVEAU
    const apres = (await request(http).get("/v1/regwatch/items").set(bearer(T, CO, "CO"))).body.length;
    expect(apres).toBe(avant);
    console.log("VR-02 PASS — empreinte : une seule entrée");
  });

  it("VR-03 [R310/R7] NON_PERTINENT sans motif → refus ; motivé → qualifié, tracé", async () => {
    const items = (await request(http).get("/v1/regwatch/items").set(bearer(T, CO, "CO"))).body;
    const cible = items[0];
    await request(http).post(`/v1/regwatch/items/${cible.empreinte}/qualifier`).set(bearer(T, CO, "CO"))
      .send({ statut: "NON_PERTINENT" }).expect(400);                       // R7
    await request(http).post(`/v1/regwatch/items/${cible.empreinte}/qualifier`).set(bearer(T, CO, "CO"))
      .send({ statut: "NON_PERTINENT", motif: "hors périmètre private banking" }).expect(201);
    const apres = (await request(http).get("/v1/regwatch/items").set(bearer(T, CO, "CO"))).body;
    expect(apres.find((i: any) => i.empreinte === cible.empreinte).statut).toBe("NON_PERTINENT");
    console.log("VR-03 PASS — la qualification se motive");
  });

  it("VR-04 [R310/R255/R257] Olivia PROPOSE une qualification citant des Rn EXISTANTS ; l'adoption humaine trace la filiation", async () => {
    const items = (await request(http).get("/v1/regwatch/items").set(bearer(T, CO, "CO"))).body;
    const cible = items.find((i: any) => i.statut === "NON_TRAITE");
    // Une citation vers un Rn INEXISTANT → refusée (jamais une référence inventée)
    await request(http).post(`/v1/regwatch/items/${cible.empreinte}/proposer`).set(bearer(T, OLIVIA, "CO"))
      .send({ statut: "PERTINENT", regles: ["R9999"], justification: "x" }).expect(422);
    const prop = await request(http).post(`/v1/regwatch/items/${cible.empreinte}/proposer`).set(bearer(T, OLIVIA, "CO"))
      .send({ statut: "PERTINENT", regles: ["R293"], justification: "touche le country manual cross-border" });
    expect(prop.status).toBe(201);
    // L'item n'est PAS qualifié par la proposition — l'humain décide
    let relu = (await request(http).get("/v1/regwatch/items").set(bearer(T, CO, "CO"))).body
      .find((i: any) => i.empreinte === cible.empreinte);
    expect(relu.statut).toBe("NON_TRAITE");
    expect(relu.proposition.regles).toEqual(["R293"]);                      // la proposition, VISIBLE
    await request(http).post(`/v1/regwatch/items/${cible.empreinte}/qualifier`).set(bearer(T, CO, "CO"))
      .send({ statut: "PERTINENT", impact: "réviser la position AE", regles: ["R293"], surProposition: prop.body.id }).expect(201);
    relu = (await request(http).get("/v1/regwatch/items").set(bearer(T, CO, "CO"))).body
      .find((i: any) => i.empreinte === cible.empreinte);
    expect(relu.statut).toBe("PERTINENT");
    expect(relu.surProposition).toBe(prop.body.id);                         // la filiation IA→humain, tracée
    console.log("VR-04 PASS — l'IA cite, l'humain décide, la filiation est tracée");
  });

  it("VR-05 [R311] un PERTINENT référençant une règle → TÂCHE d'analyse ouverte, visible ; regwatch ne modifie JAMAIS une règle (négatif)", async () => {
    const tache = await prisma.domainEvent.findFirst({
      where: { tenantId: T, type: "tache.regwatch.analyse" }, orderBy: { id: "desc" } });
    expect(tache).toBeTruthy();
    expect((tache!.payload as any).regles).toContain("R293");               // la boucle spec se FERME
    // Test négatif d'architecture : le module regwatch n'écrit NI au registre NI au catalogue
    const src = fs.readFileSync(path.join(__dirname, "../../src/modules/regwatch/regwatch.module.ts"), "utf8");
    expect(src).not.toMatch(/\.ecrire\(|parametres\.|catalogue.*write|workflowDef/i);
    expect(src).not.toMatch(/@Patch|@Put|@Delete/);                         // lecture + événements, rien d'autre
    console.log("VR-05 PASS — tâche ouverte, zéro modification de règle par regwatch");
  });
});
