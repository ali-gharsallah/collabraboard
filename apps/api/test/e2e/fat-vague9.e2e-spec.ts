/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 9 (Bac à sable AML : dry-run d'un seuil).
 * Exécutés contre le VRAI backend. Écran : Sandbox AML — « voir avant d'écrire » (R94, B-02).
 * Zéro invention : le moteur PUR ratifié (R189→R206) est rejoué avec seuils actuels vs simulés.
 * Preuve du dry-run : APRÈS la simulation, ZÉRO signal en base (R70 — ni signal, ni tâche, ni case).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT Vague 9 — Bac à sable AML : dry-run d'un seuil (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const TID = randomUUID(); const CO = randomUUID(); const CID = randomUUID();

  // 5 virements SORTIE de 149 000 CHF vers le MÊME UBO, en 38h (< fenêtre 48h). Chacun > 100 000
  // (seuil actuel) donc AUCUN structuring aujourd'hui ; tous < 200 000 (seuil simulé) → structuring.
  // Montant non multiple de 25 000 pour isoler l'effet du seuil (sinon R198 « montants ronds » fausserait).
  const virements = [
    { sens: "SORTIE", montantChf: 149000, at: "2026-06-01T08:00:00Z", uboContrepartie: "ACME-UBO", pays: "CH" },
    { sens: "SORTIE", montantChf: 149000, at: "2026-06-01T18:00:00Z", uboContrepartie: "ACME-UBO", pays: "CH" },
    { sens: "SORTIE", montantChf: 149000, at: "2026-06-02T04:00:00Z", uboContrepartie: "ACME-UBO", pays: "CH" },
    { sens: "SORTIE", montantChf: 149000, at: "2026-06-02T14:00:00Z", uboContrepartie: "ACME-UBO", pays: "CH" },
    { sens: "SORTIE", montantChf: 149000, at: "2026-06-02T22:00:00Z", uboContrepartie: "ACME-UBO", pays: "CH" },
  ];

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, TID, CID);
  });
  afterAll(async () => { await app.close(); });

  it("FAT-SBAML-01 [CO] un seuil simulé montre l'impact NOMINATIF, sans AUCUNE écriture (R94/B-02, R70)", async () => {
    const r = await request(http).post("/v1/aml/sandbox").set(bearer(TID, CO, "CO")).send({
      override: { cle: "amlStructuringSeuilChf", valeur: 200000 },
      contextes: [{ clientId: CID, virements }],
    });
    expect(r.status).toBe(201);
    // Avant (seuil 100 000) : rien ne franchit ; après (seuil 200 000) : structuring apparaît
    expect(r.body.totaux.avant).toBe(0);
    expect(r.body.totaux.nouvelles).toBeGreaterThanOrEqual(1);
    expect(r.body.override).toMatchObject({ cle: "amlStructuringSeuilChf", valeurActuelle: 100000, valeurSimulee: 200000 });
    // Chaque alerte nouvelle est NOMMÉE : client + fait + règle franchie
    const nouvelle = r.body.nouvelles.find((n: any) => n.regle === "R189");
    expect(nouvelle).toBeDefined();
    expect(nouvelle.clientId).toBe(CID);
    expect(nouvelle.type).toBe("STRUCTURING");
    expect(typeof nouvelle.note).toBe("string");
    expect(nouvelle.note.length).toBeGreaterThan(0);
    // Le dry-run l'annonce, et la base le PROUVE : aucune écriture (R70)
    expect(r.body.ecriture).toBe(false);
    const signaux = await prisma.amlSignal.count({ where: { tenantId: TID } });
    expect(signaux).toBe(0);
    console.log(`FAT-SBAML-01 PASS — dry-run seuil 100000→200000 : avant=${r.body.totaux.avant}, nouvelles=${r.body.totaux.nouvelles} (nommées), 0 écriture en base (R70/R94)`);
  });

  it("FAT-SBAML-02 [CO] proposer n'est pas appliquer : la valeur reste inchangée, l'application passe par le registre (R126/R29)", async () => {
    // Après la simulation, la valeur effective n'a pas bougé — la simulation n'écrit rien (R94)
    const avant = await request(http).get("/v1/parametres/valeur/amlStructuringSeuilChf").set(bearer(TID, CO, "CO"));
    expect(Number(avant.text)).toBe(100000);
    // Appliquer VRAIMENT = acte gouverné au registre (motivé, R126) — jamais en dur
    await request(http).post("/v1/parametres/valeur/amlStructuringSeuilChf").set(bearer(TID, CO, "CO"))
      .send({ valeur: 200000, motif: "Application arbitrée du réglage simulé (dry-run B-02)." }).expect(201);
    const apres = await request(http).get("/v1/parametres/valeur/amlStructuringSeuilChf").set(bearer(TID, CO, "CO"));
    expect(Number(apres.text)).toBe(200000);
    console.log(`FAT-SBAML-02 PASS — simulation inchangée (100000), application gouvernée au registre → 200000 (R126/R29)`);
  });
});
