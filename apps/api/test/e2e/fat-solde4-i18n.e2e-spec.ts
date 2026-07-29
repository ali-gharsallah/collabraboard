/**
 * FAT — SOLDE 4 ÉCARTS partie 2 (canon ratifié 2026-07-29, mapping R326/R327) : i18n backend.
 * R327 [canon R324] : l'UI se traduit, la DONNÉE jamais ; le PARAMÉTRAGE se traduit par le
 * TENANT (colonnes multilingues optionnelles, fr obligatoire, repli fr tel quel — LN-04) ;
 * les documents GÉNÉRÉS suivent la langue du DESTINATAIRE (`corrLang` du client, ratifié
 * étape 0 — pas la locale de l'opérateur ; LN-05, OF-09 re-vérifié en IT). Le MOTIF dans le
 * courrier reste VERBATIM (donnée métier — jamais traduite, LN-03 côté serveur).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

describe("FAT SOLDE-4 i18n — R327 : paramétrage tenant multilingue, courrier en langue du destinataire (LN-04/05)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const RM = randomUUID(), CO_SR = randomUUID(), DIR = randomUUID();
  const C_IT = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, C_IT);
    await prisma.client.update({ where: { id: C_IT }, data: { rmUserId: RM, corrLang: "IT" } });
  });
  afterAll(async () => { await app.close(); });

  it("LN-04 [R327] le paramétrage se traduit PAR LE TENANT : type de CoC fr+de → les deux servis ; sans de → fr tel quel", async () => {
    await request(http).post("/v1/coc/config").set(bearer(T, CO_SR, "CO_SR"))
      .send({ typeCode: "DEMENAGEMENT", libelle: "Déménagement", materialite: "BASSE",
        actionRequise: "PRISE_CONNAISSANCE", roleTraitant: "RM",
        libelles: { fr: "Déménagement", de: "Umzug" } }).expect(201);
    await request(http).post("/v1/coc/config").set(bearer(T, CO_SR, "CO_SR"))
      .send({ typeCode: "SANS_DE", libelle: "Type sans traduction", materialite: "BASSE",
        actionRequise: "PRISE_CONNAISSANCE", roleTraitant: "RM" }).expect(201);
    // Une langue hors {fr,de,en,it} → refus typé (liste fermée du canon)
    const ko = await request(http).post("/v1/coc/config").set(bearer(T, CO_SR, "CO_SR"))
      .send({ typeCode: "X", libelle: "X", materialite: "BASSE", actionRequise: "PRISE_CONNAISSANCE",
        roleTraitant: "RM", libelles: { fr: "X", es: "X" } });
    expect(ko.status).toBe(400);
    expect(JSON.stringify(ko.body)).toContain("R327");
    const cfg = (await request(http).get("/v1/coc/config").set(bearer(T, CO_SR, "CO_SR"))).body;
    const avecDe = cfg.types.find((t: any) => t.typeCode === "DEMENAGEMENT");
    expect(avecDe.libelles.de).toBe("Umzug");                               // le tenant a traduit LUI-MÊME
    expect(avecDe.libelles.fr).toBe("Déménagement");                        // fr OBLIGATOIRE
    const sansDe = cfg.types.find((t: any) => t.typeCode === "SANS_DE");
    expect(sansDe.libelles?.de ?? undefined).toBeUndefined();               // pas de de → le front affiche le fr TEL QUEL
    expect(sansDe.libelles?.fr ?? sansDe.libelle).toBe("Type sans traduction");
    console.log("LN-04 PASS — libellés tenant fr+de servis, repli fr, langue inconnue refusée");
  });

  it("LN-05 [R327/OF-09] le courrier suit le DESTINATAIRE : client corrLang=IT, opérateur FR → document en IT, motif VERBATIM", async () => {
    const d = (await request(http).post("/v1/offboarding").set(bearer(T, RM, "RM"))
      .send({ clientId: C_IT, type: "DECISION_BANQUE", motif: "Départ à l'étranger — instructions reçues du client" })).body;
    expect(d.id).toBeTruthy();
    const c = await request(http).get(`/v1/offboarding/${d.id}/courrier`).set(bearer(T, DIR, "DIR"));
    expect(c.status).toBe(200);
    expect(c.body.langue).toBe("IT");                                       // la langue du DESTINATAIRE
    expect(c.body.texte).toContain("Oggetto");                              // gabarit IT
    expect(c.body.texte).not.toContain("Objet :");                          // pas la locale de l'opérateur
    expect(c.body.texte).toContain("Départ à l'étranger");                  // le MOTIF (donnée) reste VERBATIM — jamais traduit
    // OF-09 inchangé : jamais une mention compliance dans le courrier, quelle que soit la langue
    expect(c.body.texte).not.toMatch(/compliance|MROS|soupçon/i);
    console.log("LN-05 PASS — courrier IT (corrLang), motif verbatim, OF-09 tenu");
  });
});
