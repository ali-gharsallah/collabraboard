/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 2 (Surveillance & Dossiers).
 * Exécutés contre le VRAI backend. Personas : Compliance Officer (CO), MLRO.
 * Écrans : Instruction des dossiers de risque · Consultation des pièces (GED).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

const jstr = (r: request.Response) => JSON.stringify(r.body);

describe("FAT Vague 2 — Surveillance & Dossiers (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const TID = randomUUID(), TID2 = randomUUID();
  const CLIENT = randomUUID();
  const CO = randomUUID(), MLRO = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, TID, CLIENT);
    await seedTenantClient(prisma, TID2, randomUUID());
    // GED : référentiel de types (accès réservé CO/RM) + une pièce classée du client
    await prisma.tenant.update({ where: { id: TID }, data: { settings: {
      gedDocTypes: [{ code: "PASSEPORT", validiteMois: 120, requisPour: [], rolesAutorises: ["CO", "RM"] }] } as any } });
    await prisma.document.create({ data: {
      tenantId: TID, clientId: CLIENT, nom: "passeport.pdf", typeCode: "PASSEPORT", statut: "ACTIF" } as any });
  });
  afterAll(async () => { await app.close(); });

  async function ouvrirDossierDepuisAlerte() {
    const alerte = await request(http).post("/v1/aml/evaluer").set(bearer(TID, MLRO, "MLRO"))
      .send({ clientId: CLIENT, beneficiaireSanctionne: true });
    const o = await request(http).post("/v1/riskcases").set(bearer(TID, CO, "CO"))
      .send({ clientId: CLIENT, signalIds: [alerte.body.signaux[0].id] });
    return o.body.caseId as string;
  }

  // ══ Dossiers de risque (instruction) ══════════════════════════════════════
  it("FAT-DOSSIER-01 [CO] instruire : note append-only (R134) + transition motivée (R133/R7)", async () => {
    const id = await ouvrirDossierDepuisAlerte();
    // deux notes d'instruction — append-only
    const n1 = await request(http).post(`/v1/riskcases/${id}/notes`).set(bearer(TID, CO, "CO"))
      .send({ texte: "Première analyse : contrepartie à vérifier." });
    expect(n1.status).toBeLessThan(300);
    await request(http).post(`/v1/riskcases/${id}/notes`).set(bearer(TID, CO, "CO"))
      .send({ texte: "Documents demandés au RM." });
    const notes = await request(http).get(`/v1/riskcases/${id}/notes`).set(bearer(TID, CO, "CO"));
    expect(notes.body.length).toBe(2);   // les deux, dans l'ordre
    // transition NOUVELLE → EN_ANALYSE
    const t1 = await request(http).post(`/v1/riskcases/${id}/transition`).set(bearer(TID, CO, "CO")).send({ vers: "EN_ANALYSE" });
    expect(t1.status).toBeLessThan(300);
    // CLÔTURE sans motif → refus (R7)
    const t2 = await request(http).post(`/v1/riskcases/${id}/transition`).set(bearer(TID, CO, "CO")).send({ vers: "CLOTUREE" });
    expect(t2.status).toBe(400);
    // CLÔTURE avec motif → OK
    const t3 = await request(http).post(`/v1/riskcases/${id}/transition`).set(bearer(TID, CO, "CO"))
      .send({ vers: "CLOTUREE", motif: "Faux positif confirmé après analyse." });
    expect(t3.status).toBeLessThan(300);
    expect(t3.body.statut).toBe("CLOTUREE");
    console.log(`FAT-DOSSIER-01 PASS — 2 notes append-only, EN_ANALYSE ok, clôture sans motif refusée (R7), clôture motivée → CLOTUREE`);
  });

  it("FAT-DOSSIER-02 [CO] une transition non prévue est refusée (NOUVELLE → CLOTUREE)", async () => {
    const id = await ouvrirDossierDepuisAlerte();
    const bad = await request(http).post(`/v1/riskcases/${id}/transition`).set(bearer(TID, CO, "CO"))
      .send({ vers: "CLOTUREE", motif: "tentative directe" });
    expect(bad.status).toBe(400);
    expect(jstr(bad)).toContain("illégale");
    console.log(`FAT-DOSSIER-02 PASS — NOUVELLE→CLOTUREE refusée (transition illégale, R133)`);
  });

  // ══ Pièces GED (consultation) ═════════════════════════════════════════════
  it("FAT-GED-01 [CO] pièces filtrées au rôle (R110) + fiche ; rôle non autorisé → rien", async () => {
    const co = await request(http).get(`/v1/ged/documents?clientId=${CLIENT}`).set(bearer(TID, CO, "CO"));
    expect(co.status).toBe(200);
    expect(co.body.length).toBeGreaterThanOrEqual(1);
    const nonAutorise = await request(http).get(`/v1/ged/documents?clientId=${CLIENT}`).set(bearer(TID, MLRO, "MLRO"));
    expect(nonAutorise.body.length).toBe(0);
    const docId = co.body[0].id;
    const fiche = await request(http).get(`/v1/ged/documents/${docId}`).set(bearer(TID, CO, "CO"));
    expect(fiche.status).toBe(200);
    console.log(`FAT-GED-01 PASS — CO voit ${co.body.length} pièce(s) (R110), MLRO non autorisé voit ${nonAutorise.body.length}, fiche accessible`);
  });

  it("FAT-GED-02 [CO] isolation tenant : un autre établissement ne voit aucune pièce", async () => {
    const autre = await request(http).get(`/v1/ged/documents?clientId=${CLIENT}`).set(bearer(TID2, CO, "CO"));
    expect(autre.body.length).toBe(0);
    console.log(`FAT-GED-02 PASS — autre tenant voit 0 pièce (isolation RLS)`);
  });
});
