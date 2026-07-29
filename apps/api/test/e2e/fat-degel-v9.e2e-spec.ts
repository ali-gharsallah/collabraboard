/**
 * FAT — DÉGEL VAGUE 9 (canon ratifié 2026-07-28, mapping +3) : OCTOPULSE OPRISK.
 * R321 [canon R318] incident opérationnel = DOSSIER tracé : déclaration (tout collaborateur),
 * taxonomie Bâle (paramètre tenant), sévérité, pertes, DECLARE → EN_ANALYSE → CLOS (motif R7) ;
 * un incident d'intégrité SO-07 peut ouvrir un incident OpRisk RÉFÉRENCÉ · R322 [canon R319]
 * heatmap CALCULÉE (fréquence × sévérité par catégorie), jamais peinte, rejouable à date ·
 * R323 [canon R320] plan d'action tracé (owner, échéance, statut) ; retard = FAIT calculé
 * (R274), notifié puis escaladé, jamais bloquant. AMA = option à ratifier séparément (non livrée).
 * OP-01..05. État dérivé des événements — aucune table nouvelle.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

describe("FAT DÉGEL V9 — R321-R323 : l'incident est un dossier, la heatmap se calcule, le retard notifie (OP-01..05)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const CO = randomUUID(), RM = randomUUID(), SO = randomUUID(), DIR = randomUUID();
  let incidentId = "";

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("OP-01 [R321] incident déclaré → DOSSIER tracé ; classification Bâle OBLIGATOIRE (taxonomie = paramètre tenant)", async () => {
    // Classification hors taxonomie → refus typé (default-deny du registre)
    const hors = await request(http).post("/v1/oprisk/incidents").set(bearer(T, RM, "RM"))
      .send({ titre: "Panne", categorie: "CATEGORIE_INVENTEE", severite: 2 });
    expect(hors.status).toBe(400);
    expect(JSON.stringify(hors.body)).toContain("R321");
    // Sans catégorie → même refus (la classification n'est pas optionnelle)
    await request(http).post("/v1/oprisk/incidents").set(bearer(T, RM, "RM"))
      .send({ titre: "Panne", severite: 2 }).expect(400);
    // Déclaré par un RM (TOUT collaborateur déclare) — le dossier est tracé
    const r = await request(http).post("/v1/oprisk/incidents").set(bearer(T, RM, "RM"))
      .send({ titre: "Virement exécuté deux fois", categorie: "EXECUTION_PROCESSUS", severite: 3,
        pertes: 12500, description: "Double exécution le 2026-07-25, remboursement en cours" });
    expect(r.status).toBe(201);
    incidentId = r.body.id;
    expect(r.body.statut).toBe("DECLARE");
    const ev = await prisma.domainEvent.findFirst({
      where: { tenantId: T, type: "oprisk.incident.declare", aggregateId: incidentId } });
    expect(ev).toBeTruthy();
    expect((ev!.payload as any).par).toBe(RM);                              // qui a déclaré — tracé
    console.log("OP-01 PASS — classification obligatoire (taxonomie tenant), dossier tracé");
  });

  it("OP-02 [R321/R7] DECLARE → EN_ANALYSE → CLOS : la clôture SANS motif refuse ; hors chemin → refus", async () => {
    // Sauter DECLARE → CLOS directement → refus (le chemin est une liste fermée)
    const saut = await request(http).post(`/v1/oprisk/incidents/${incidentId}/transition`)
      .set(bearer(T, CO, "CO")).send({ vers: "CLOS", motif: "clôture directe" });
    expect(saut.status).toBe(400);
    await request(http).post(`/v1/oprisk/incidents/${incidentId}/transition`)
      .set(bearer(T, CO, "CO")).send({ vers: "EN_ANALYSE" }).expect(201);
    // Clôture SANS motif → refus R7
    const sans = await request(http).post(`/v1/oprisk/incidents/${incidentId}/transition`)
      .set(bearer(T, CO, "CO")).send({ vers: "CLOS" });
    expect(sans.status).toBe(400);
    expect(JSON.stringify(sans.body)).toContain("R7");
    await request(http).post(`/v1/oprisk/incidents/${incidentId}/transition`)
      .set(bearer(T, CO, "CO")).send({ vers: "CLOS", motif: "Perte remboursée, contrôle 4 yeux ajouté au processus" }).expect(201);
    const liste = (await request(http).get("/v1/oprisk/incidents").set(bearer(T, CO, "CO"))).body;
    expect(liste.incidents.find((i: any) => i.id === incidentId).statut).toBe("CLOS");
    console.log("OP-02 PASS — chemin fermé, clôture motivée (R7)");
  });

  it("OP-03 [R322] la heatmap est CALCULÉE et REJOUÉE à date — aucune écriture de cellule (test négatif structurel)", async () => {
    // Un second incident dans une autre catégorie — la heatmap agrège fréquence × sévérité
    await request(http).post("/v1/oprisk/incidents").set(bearer(T, CO, "CO"))
      .send({ titre: "Phishing ciblé", categorie: "FRAUDE_EXTERNE", severite: 4 }).expect(201);
    const now = (await request(http).get("/v1/oprisk/heatmap").set(bearer(T, CO, "CO"))).body;
    const exec = now.cellules.find((c: any) => c.categorie === "EXECUTION_PROCESSUS");
    expect(exec.frequence).toBe(1);
    expect(exec.severiteMax).toBe(3);
    expect(now.cellules.find((c: any) => c.categorie === "FRAUDE_EXTERNE").severiteMax).toBe(4);
    // Rejouée à J-90 : AUCUN incident n'existait — les cellules sont vides, exactement
    const j90 = new Date(Date.now() - 90 * 86400000).toISOString();
    const avant = (await request(http).get(`/v1/oprisk/heatmap?at=${j90}`).set(bearer(T, CO, "CO"))).body;
    expect(avant.cellules.every((c: any) => c.frequence === 0)).toBe(true);
    // Rejouer DEUX fois la même date → byte-identique (déterminisme du calcul)
    const rejeu = (await request(http).get(`/v1/oprisk/heatmap?at=${j90}`).set(bearer(T, CO, "CO"))).body;
    expect(JSON.stringify(rejeu.cellules)).toBe(JSON.stringify(avant.cellules));
    // NÉGATIF STRUCTUREL : aucune route n'écrit une cellule, aucun événement heatmap n'existe
    const src = fs.readFileSync(path.join(__dirname, "../../src/modules/oprisk/oprisk.module.ts"), "utf8");
    expect(src).not.toMatch(/@(Post|Patch|Put|Delete)\("heatmap/);
    expect(src).not.toMatch(/heatmap['"]?\s*[,)]?\s*\.\s*(create|update|upsert)/i);
    expect(src).not.toMatch(/oprisk\.heatmap/);                             // pas d'événement de cellule
    expect(await prisma.domainEvent.count({ where: { tenantId: T, type: { contains: "heatmap" } } })).toBe(0);
    console.log("OP-03 PASS — calculée, rejouée exacte à J-90, zéro écriture de cellule");
  });

  it("OP-04 [R321/SO-07] une chaîne ROMPUE détectée par l'audit IT → le SO ouvre un incident OpRisk RÉFÉRENCÉ", async () => {
    // Le SO lit l'intégrité (sa surface) — un journal sert de référence de constat
    const integ = await request(http).get("/v1/audit/integrite").set(bearer(T, SO, "SO"));
    expect(integ.status).toBe(200);
    const journal = integ.body.journaux[0].journal;
    // Le SO OUVRE l'incident — l'exception à sa surface est FERMÉE à cette route (canon R321)
    const r = await request(http).post("/v1/oprisk/incidents").set(bearer(T, SO, "SO"))
      .send({ titre: "Chaîne d'audit rompue", categorie: "EXECUTION_PROCESSUS", severite: 5,
        reference: { source: "audit-integrite", journal, detail: "maillon rompu constaté SO-07" } });
    expect(r.status).toBe(201);
    const ev = await prisma.domainEvent.findFirst({
      where: { tenantId: T, type: "oprisk.incident.declare", aggregateId: r.body.id } });
    expect((ev!.payload as any).reference.source).toBe("audit-integrite");  // RÉFÉRENCÉ au constat
    // La surface SO reste FERMÉE partout ailleurs : un autre POST refuse toujours (R284)
    await request(http).post("/v1/oprisk/actions").set(bearer(T, SO, "SO"))
      .send({ incidentId: r.body.id, titre: "x", owner: CO, echeance: new Date().toISOString() }).expect(403);
    console.log("OP-04 PASS — SO-07 → incident référencé, surface SO fermée ailleurs");
  });

  it("OP-05 [R323/R274] action en retard → notification OWNER puis ESCALADE — des faits calculés, rien n'est bloqué", async () => {
    const inc = (await request(http).post("/v1/oprisk/incidents").set(bearer(T, CO, "CO"))
      .send({ titre: "Sauvegarde non testée", categorie: "INTERRUPTION_SYSTEMES", severite: 3 })).body;
    // Une action en retard LÉGER (hier) et une en retard LOURD (J-10, au-delà de l'escalade à 7 j)
    const leger = (await request(http).post("/v1/oprisk/actions").set(bearer(T, CO, "CO"))
      .send({ incidentId: inc.id, titre: "Tester la restauration", owner: RM,
        echeance: new Date(Date.now() - 86400000).toISOString() })).body;
    const lourd = (await request(http).post("/v1/oprisk/actions").set(bearer(T, CO, "CO"))
      .send({ incidentId: inc.id, titre: "Documenter le runbook", owner: RM,
        echeance: new Date(Date.now() - 10 * 86400000).toISOString() })).body;
    await request(http).post("/v1/oprisk/tick").set(bearer(T, CO, "CO")).expect(201);
    await request(http).post("/v1/oprisk/tick").set(bearer(T, CO, "CO")).expect(201);   // idempotent — une fois par état
    const retards = await prisma.domainEvent.findMany({ where: { tenantId: T, type: "tache.oprisk.action.retard" } });
    expect(retards.map((e) => (e.payload as any).id).sort())
      .toEqual([leger.id, lourd.id].sort());                                // les DEUX owners notifiés, une fois
    expect((retards[0].payload as any).notifie).toContain(RM);
    const escalades = await prisma.domainEvent.findMany({ where: { tenantId: T, type: "oprisk.action.escalade" } });
    expect(escalades.length).toBe(1);                                       // seul le retard LOURD escalade
    expect((escalades[0].payload as any).id).toBe(lourd.id);
    expect((escalades[0].payload as any).notifie).toContain("DIR");
    // RIEN n'est bloqué : l'action en retard se COMPLÈTE normalement (mesuré, jamais bloquant)
    await request(http).post(`/v1/oprisk/actions/${leger.id}/statut`).set(bearer(T, RM, "RM"))
      .send({ vers: "FAIT" }).expect(201);
    const actions = (await request(http).get(`/v1/oprisk/actions?incidentId=${inc.id}`).set(bearer(T, CO, "CO"))).body;
    expect(actions.actions.find((a: any) => a.id === leger.id).statut).toBe("FAIT");
    expect(actions.actions.find((a: any) => a.id === lourd.id).enRetard).toBe(true);    // le retard est un FAIT calculé
    console.log("OP-05 PASS — retard notifié, escalade au-delà du seuil, jamais bloquant");
  });
});
