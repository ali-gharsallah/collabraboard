/**
 * FAT — DÉGEL VAGUE 5 (canon ratifié 2026-07-28, mapping +3) : LEGAL.
 * R312 [canon R309] le registre LEGAL vit sur la GED — le document EST la preuve (sans
 * pièce, pas d'objet) ; rattachements client / juridiction du country manual R293 /
 * fournisseur — la boucle cross-border se FERME · R313 [canon R310] échéances CALCULÉES
 * (pattern R272/R274) : préavis = tâche + notification, retard = fait calculé, escalade —
 * jamais bloquant ; modification de dates = événement. LE-01..04.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

describe("FAT DÉGEL V5 — R312/R313 : le registre sur la GED, les échéances calculées (LE-01..04)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const CO = randomUUID(), ADMIN = randomUUID(), RM = randomUUID();
  const clientId = randomUUID();
  let docMemoId = "";

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, clientId);
    // La PIÈCE : un document GED réel (le mémo juridique), v1
    const d = await prisma.document.create({ data: {
      tenantId: T, clientId: null, nom: "memo-legal-2024-003.pdf", typeCode: "MEMO_LEGAL", statut: "ACTIF" } as any });
    docMemoId = d.id;
    await prisma.documentVersion.create({ data: { tenantId: T, documentId: d.id, numero: 1,
      sha256: "a".repeat(64), deposePar: CO, deposeAt: new Date() } });
  });
  afterAll(async () => { await app.close(); });

  it("LE-01 [R312] un contrat SANS document GED rattaché → création REFUSÉE — le registre sans preuve n'existe pas", async () => {
    const sans = await request(http).post("/v1/legal/objets").set(bearer(T, CO, "CO"))
      .send({ type: "CONTRAT", reference: "CTR-EDGE-2026", parties: ["GWB", "Edge Vendor SA"],
        dateEffet: "2026-01-01", dateFin: "2027-01-01", preavisJours: 60 });
    expect(sans.status).toBe(400);
    expect(JSON.stringify(sans.body)).toContain("R312");
    const faux = await request(http).post("/v1/legal/objets").set(bearer(T, CO, "CO"))
      .send({ type: "CONTRAT", reference: "CTR-EDGE-2026", documentId: randomUUID() });
    expect(faux.status).toBe(400);                                          // un documentId INEXISTANT ne prouve rien
    const ok = await request(http).post("/v1/legal/objets").set(bearer(T, CO, "CO"))
      .send({ type: "MEMO", reference: "mémo Legal 2024-003", documentId: docMemoId,
        rattachements: { juridiction: "SA" },
        dateEffet: "2024-01-01", dateFin: "2026-09-15", preavisJours: 60, fournisseur: "Cabinet Lex & Cie" });
    expect(ok.status).toBe(201);
    console.log("LE-01 PASS — pas de preuve GED, pas d'objet");
  });

  it("LE-02 [R313/R274] préavis à J-60 → tâche + notification ; échéance dépassée → EN_RETARD calculé, escalade — rien bloqué", async () => {
    // Un contrat dont le préavis est DÉJÀ ouvert (fin dans 30 jours, préavis 60) et un DÉPASSÉ
    const dans30j = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const doc2 = await prisma.document.create({ data: { tenantId: T, nom: "ctr-cleaning.pdf", typeCode: "CONTRAT", statut: "ACTIF" } as any });
    await request(http).post("/v1/legal/objets").set(bearer(T, CO, "CO"))
      .send({ type: "CONTRAT", reference: "CTR-PREAVIS", documentId: doc2.id,
        dateEffet: "2025-01-01", dateFin: dans30j, preavisJours: 60, tacite: true }).expect(201);
    const doc3 = await prisma.document.create({ data: { tenantId: T, nom: "ctr-echu.pdf", typeCode: "CONTRAT", statut: "ACTIF" } as any });
    await request(http).post("/v1/legal/objets").set(bearer(T, CO, "CO"))
      .send({ type: "CONTRAT", reference: "CTR-ECHU", documentId: doc3.id,
        dateEffet: "2024-01-01", dateFin: hier, preavisJours: 30 }).expect(201);
    const tick = await request(http).post("/v1/legal/tick").set(bearer(T, ADMIN, "ADMIN"));
    expect(tick.status).toBe(201);                                          // mesuré, jamais bloquant
    const ech = await request(http).get("/v1/legal/echeances").set(bearer(T, CO, "CO"));
    const preavis = ech.body.find((e: any) => e.reference === "CTR-PREAVIS");
    expect(preavis.statut).toBe("PREAVIS_OUVERT");                          // fait CALCULÉ des dates
    const echu = ech.body.find((e: any) => e.reference === "CTR-ECHU");
    expect(echu.statut).toBe("EN_RETARD");
    const taches = await prisma.domainEvent.findMany({ where: { tenantId: T, type: "tache.legal.preavis" } });
    expect(taches.map((e) => (e.payload as any).reference)).toContain("CTR-PREAVIS");   // la tâche + notification
    const escs = await prisma.domainEvent.findMany({ where: { tenantId: T, type: "legal.echeance.escalade" } });
    expect(escs.map((e) => (e.payload as any).reference)).toContain("CTR-ECHU");        // l'escalade notifiée
    console.log("LE-02 PASS — préavis ouvert, retard calculé, escalade, rien bloqué");
  });

  it("LE-03 [R312/R293] le mémo CITÉ par le country manual s'ouvre depuis cross-border — rattachement BIDIRECTIONNEL", async () => {
    // Le manual R293 cite « mémo Legal 2024-003 » comme source de la position SA
    await request(http).post("/v1/parametres/valeur/tripCrossBorderReferentiel").set(bearer(T, ADMIN, "ADMIN"))
      .send({ valeur: [{ jurisdiction: "SA", activite: "prospection", verdict: "INTERDITE",
        depuisLe: "2024-01-01", source: "mémo Legal 2024-003" }],
        motif: "R293 : position SA adossée au mémo" }).expect(201);
    // Sens 1 : depuis la SOURCE du manual → l'objet legal + sa pièce GED
    const par = await request(http).get(`/v1/legal/par-reference?ref=${encodeURIComponent("mémo Legal 2024-003")}`)
      .set(bearer(T, RM, "RM"));
    expect(par.status).toBe(200);
    expect(par.body.documentId).toBe(docMemoId);                            // la pièce s'OUVRE
    // Sens 2 : depuis la juridiction → les mémos rattachés
    const parJur = await request(http).get("/v1/legal/objets?juridiction=SA").set(bearer(T, RM, "RM"));
    expect(parJur.body.some((o: any) => o.reference === "mémo Legal 2024-003")).toBe(true);
    console.log("LE-03 PASS — la boucle manual ↔ mémo est fermée, dans les deux sens");
  });

  it("LE-04 [R312/R48] mémo v2 déposé → l'évaluation XB ANTÉRIEURE référence la v1 (rejeu), la nouvelle la v2", async () => {
    const avantV2 = new Date().toISOString();                               // l'instant de l'évaluation antérieure
    await new Promise((r) => setTimeout(r, 15));
    await prisma.documentVersion.create({ data: { tenantId: T, documentId: docMemoId, numero: 2,
      sha256: "b".repeat(64), deposePar: CO, deposeAt: new Date() } });     // v2 (succession R109, jamais remplacement)
    const vAvant = await request(http).get(`/v1/legal/par-reference?ref=${encodeURIComponent("mémo Legal 2024-003")}&at=${encodeURIComponent(avantV2)}`)
      .set(bearer(T, CO, "CO"));
    expect(vAvant.body.versionEnVigueur.numero).toBe(1);                    // l'évaluation d'AVANT lit la v1
    const vApres = await request(http).get(`/v1/legal/par-reference?ref=${encodeURIComponent("mémo Legal 2024-003")}`)
      .set(bearer(T, CO, "CO"));
    expect(vApres.body.versionEnVigueur.numero).toBe(2);                    // la nouvelle lit la v2
    console.log("LE-04 PASS — la version du mémo se résout À DATE (rejeu R48)");
  });
});
