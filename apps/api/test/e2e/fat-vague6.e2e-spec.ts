/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 6 (Paramétrage & Gouvernance).
 * Exécutés contre le VRAI backend. Écrans : Registre de paramétrage (R-Q) · Config à date & Go-live.
 * Zéro invention : registre R-Q ratifié R125→R128. Persona : Compliance Officer (CO).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

const jstr = (r: request.Response) => JSON.stringify(r.body);

describe("FAT Vague 6 — Paramétrage & Gouvernance (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const TID = randomUUID(); const CO = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, TID, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  // ══ Écran 1 : Registre de paramétrage ═════════════════════════════════════
  it("FAT-PARAM-01 [CO] écrire un paramètre : typé, motivé, jamais rétroactif ; valeur à date (R125→R127)", async () => {
    const reg = await request(http).get("/v1/parametres/registre").set(bearer(TID, CO, "CO"));
    expect(reg.status).toBe(200);
    expect(reg.body.some((e: any) => e.cle === "screeningSeuil")).toBe(true);   // registre généré du canon
    // Écriture bien typée + motivée → matérialisée
    const ok = await request(http).post("/v1/parametres/valeur/screeningSeuil").set(bearer(TID, CO, "CO"))
      .send({ valeur: 90, motif: "Renforcement du seuil de screening." });
    expect(ok.status).toBeLessThan(300);
    const v = await request(http).get("/v1/parametres/valeur/screeningSeuil").set(bearer(TID, CO, "CO"));
    expect(Number(v.text)).toBe(90);
    // Sans motif → refus (R7)
    const sansMotif = await request(http).post("/v1/parametres/valeur/screeningSeuil").set(bearer(TID, CO, "CO"))
      .send({ valeur: 95, motif: "" });
    expect(sansMotif.status).toBe(400);
    // Mauvais type → refus (R125)
    const mauvaisType = await request(http).post("/v1/parametres/valeur/screeningSeuil").set(bearer(TID, CO, "CO"))
      .send({ valeur: "quatre-vingt", motif: "essai" });
    expect(mauvaisType.status).toBe(400);
    // Effet rétroactif → refus (R126)
    const retro = await request(http).post("/v1/parametres/valeur/screeningSeuil").set(bearer(TID, CO, "CO"))
      .send({ valeur: 70, motif: "essai", effetAt: "2020-01-01T00:00:00.000Z" });
    expect(retro.status).toBe(400);
    // Valeur à une date AVANT le changement = la valeur d'alors (défaut 85, R127)
    const avant = await request(http).get(`/v1/parametres/valeur/screeningSeuil?date=2020-01-01`).set(bearer(TID, CO, "CO"));
    expect(Number(avant.text)).toBe(85);
    console.log(`FAT-PARAM-01 PASS — écriture typée/motivée → 90 ; sans motif (R7), mauvais type (R125), rétroactif (R126) refusés ; valeur d'alors=85 (R127)`);
  });

  // ══ Écran 2 : Config à date & Go-live ═════════════════════════════════════
  it("FAT-GOLIVE-01 [CO] config reconstruite à date + go-live gouverné (R127/R128)", async () => {
    const cfg = await request(http).get("/v1/parametres/config").set(bearer(TID, CO, "CO"));
    expect(cfg.status).toBe(200);
    expect(cfg.body.screeningSeuil).toBe(90);                 // config complète reconstruite (R127)
    // Activation sans signature → refus (R128)
    const sansSig = await request(http).post("/v1/parametres/activer").set(bearer(TID, CO, "CO")).send({ signataire: "" });
    expect(sansSig.status).toBe(400);
    // Activation avec clé requise manquante (gedDocTypes) → refus NOMMÉ (R128)
    const troue = await request(http).post("/v1/parametres/activer").set(bearer(TID, CO, "CO")).send({ signataire: "Dr. Banquier" });
    expect(troue.status).toBe(400);
    expect(jstr(troue)).toContain("gedDocTypes");
    // On renseigne TOUTES les clés requises du registre R-Q (le canon inclut, en plus de
    // gedDocTypes/rqRepondant, les référentiels AML-gap requis R340→R403) puis on active → ACTIF.
    // Seed piloté par le registre lui-même (robuste à l'ajout de nouvelles clés requises).
    const valeurParDefautSelonType = (e: any) =>
      e.exemple !== undefined ? e.exemple
      : e.type === "json" ? [] : e.type === "int" ? 0 : e.type === "bool" ? true : "seed";
    const registre = await request(http).get("/v1/parametres/registre").set(bearer(TID, CO, "CO"));
    const requises = (registre.body as any[]).filter((e) => e.requis);
    for (const e of requises) {
      const rs = await request(http).post(`/v1/parametres/valeur/${e.cle}`).set(bearer(TID, CO, "CO"))
        .send({ valeur: e.cle === "rqRepondant" ? "Dr. Banquier" : valeurParDefautSelonType(e),
                motif: "Recette : seed de la clé requise R-Q." });
      expect(rs.status).toBe(201);
    }
    const actif = await request(http).post("/v1/parametres/activer").set(bearer(TID, CO, "CO")).send({ signataire: "Dr. Banquier" });
    expect(actif.status).toBeLessThan(300);
    expect(actif.body.statut).toBe("ACTIF");
    console.log(`FAT-GOLIVE-01 PASS — config reconstruite (screeningSeuil=90) ; sans signature (R128), clé requise manquante nommée (gedDocTypes), puis go-live ACTIF`);
  });
});
