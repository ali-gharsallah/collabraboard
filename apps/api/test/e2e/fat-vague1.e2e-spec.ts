/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 1 (recette métier banque privée).
 * Exécutés contre le VRAI backend (NestFactory + Postgres réel), du point de vue des
 * personas : Relationship Manager (RM), Compliance Officer (CO), Central File (CF),
 * MLRO, Auditeur. Chaque `it` = un FAT ; la sortie (✓/✗) est la PREUVE de recette.
 *
 * Périmètre : Clients · KYC (four-eyes) · Règles AML · Alertes · Rejeu à date.
 * Miroir documentaire : docs/tests/FAT/ et docs/tests/RAPPORT-RECETTE.md.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

const jstr = (r: request.Response) => JSON.stringify(r.body);

describe("FAT Vague 1 — recette métier (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const TID = randomUUID(), TID2 = randomUUID();
  const CLIENT = randomUUID(), CLIENT2 = randomUUID();
  const RM = randomUUID(), CO_A = randomUUID(), CO_B = randomUUID(), CO_SR = randomUUID(), MLRO = randomUUID(), AUDIT = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, TID, CLIENT);
    await seedTenantClient(prisma, TID2, CLIENT2);
  });
  afterAll(async () => { await app.close(); });

  // ══ CLIENTS ══════════════════════════════════════════════════════════════
  it("FAT-CLIENT-01 [RM] créer un client puis le retrouver dans MA liste (isolation tenant)", async () => {
    const create = await request(http).post("/v1/clients").set(bearer(TID, RM, "RM"))
      .send({ name: "Fondation Helvetia", structure: "FOUNDATION", country: "CH", corrLang: "FR" });
    expect(create.status).toBeLessThan(300);
    const list = await request(http).get("/v1/clients").set(bearer(TID, RM, "RM"));
    expect(list.status).toBe(200);
    expect(list.body.data.some((c: any) => c.name === "Fondation Helvetia")).toBe(true);
    // isolation : un AUTRE tenant ne voit PAS ce client
    const autre = await request(http).get("/v1/clients").set(bearer(TID2, RM, "RM"));
    expect(autre.body.data.some((c: any) => c.name === "Fondation Helvetia")).toBe(false);
    console.log("FAT-CLIENT-01 PASS — client créé, visible du bon tenant, invisible des autres");
  });

  // ══ KYC (four-eyes) ═══════════════════════════════════════════════════════
  it("FAT-KYC-01 [CO] la validation d'un dossier est protégée par le four-eyes ; elle seule autorise le golden record", async () => {
    const res = await request(http).post("/v1/kyc").set(bearer(TID, RM, "RM"))
      .send({ clientId: CLIENT, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM });
    expect(res.status).toBeLessThan(300);
    const code = res.body.code;
    // un CO répond à une question d'IDENTITY (devient préparateur), puis un AUTRE CO vise
    await request(http).patch(`/v1/kyc/${code}/questions/IDE-Q3`).set(bearer(TID, CO_A, "CO")).send({ answer: "PEP: non" }).expect(200);
    const visa = await request(http).post(`/v1/kyc/${code}/visas/IDENTITY`).set(bearer(TID, CO_B, "CO")).send({ verdict: "OK" });
    expect(visa.status).toBeLessThan(300);
    // le CRÉATEUR (RM) NE PEUT PAS valider — four-eyes
    const creator = await request(http).post(`/v1/kyc/${code}/validate`).set(bearer(TID, RM, "RM"));
    expect(creator.status).toBe(409);
    expect(jstr(creator)).toContain("Four-eyes");
    // un tiers habilité (CO_SR) valide → VALIDATED, et l'événement kyc.validated est émis (déclencheur golden record)
    const done = await request(http).post(`/v1/kyc/${code}/validate`).set(bearer(TID, CO_SR, "CO_SR"));
    expect(done.status).toBeLessThan(300);
    expect(done.body.status).toBe("VALIDATED");
    const evt = await prisma.domainEvent.findMany({ where: { tenantId: TID, type: "kyc.validated" } });
    expect(evt.length).toBeGreaterThanOrEqual(1);
    console.log(`FAT-KYC-01 PASS — créateur bloqué (four-eyes), tiers valide → VALIDATED, événement kyc.validated émis (${evt.length})`);
  });

  it("FAT-KYC-02 [CO] un contributeur d'une section ne peut pas viser cette même section (R13)", async () => {
    const res = await request(http).post("/v1/kyc").set(bearer(TID, RM, "RM"))
      .send({ clientId: CLIENT, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM });
    const code = res.body.code;
    await request(http).patch(`/v1/kyc/${code}/questions/IDE-Q3`).set(bearer(TID, CO_A, "CO")).send({ answer: "x" }).expect(200);
    const self = await request(http).post(`/v1/kyc/${code}/visas/IDENTITY`).set(bearer(TID, CO_A, "CO")).send({ verdict: "OK" });
    expect(self.status).toBe(409);
    expect(jstr(self)).toContain("R13");
    console.log("FAT-KYC-02 PASS — le contributeur est exclu de son propre visa (R13)");
  });

  // ══ RÈGLES AML ════════════════════════════════════════════════════════════
  it("FAT-AML-01 [CO] contrepartie sanctionnée → opération BLOQUÉE automatiquement, décision humaine requise (R192)", async () => {
    const r = await request(http).post("/v1/aml/evaluer").set(bearer(TID, MLRO, "MLRO"))
      .send({ clientId: CLIENT, beneficiaireSanctionne: true });
    expect(r.status).toBeLessThan(300);
    expect(r.body.bloque).toBe(true);
    expect(r.body.signaux[0].regle).toBe("R192");
    expect(r.body.signaux[0].emisPar).toBe(MLRO);   // auteur = jeton
    console.log(`FAT-AML-01 PASS — sanctions R192 : bloque=${r.body.bloque}, signal signé par ${r.body.signaux[0].emisPar}`);
  });

  it("FAT-AML-02 [CO] fractionnement sous le seuil → signal STRUCTURING (alerte niveau 2, non bloquant) (R189)", async () => {
    const virements = [0, 1, 2, 3, 4].map((i) => ({ sens: "SORTIE", montantChf: 19999, at: `2026-06-01T0${i}:00:00Z`, uboContrepartie: "ubo-x" }));
    const r = await request(http).post("/v1/aml/evaluer").set(bearer(TID, MLRO, "MLRO")).send({ clientId: CLIENT, virements });
    expect(r.status).toBeLessThan(300);
    expect(r.body.bloque).toBe(false);
    expect(r.body.signaux.some((s: any) => s.type === "STRUCTURING" && s.niveau === 2)).toBe(true);
    console.log(`FAT-AML-02 PASS — structuring R189 : signal niveau 2, bloque=${r.body.bloque}`);
  });

  // ══ ALERTES ═══════════════════════════════════════════════════════════════
  it("FAT-ALERTE-01 [MLRO] les alertes d'un client sont consultables et tenant-scopées", async () => {
    const liste = await request(http).get(`/v1/aml/clients/${CLIENT}/signaux`).set(bearer(TID, MLRO, "MLRO"));
    expect(liste.status).toBe(200);
    expect(liste.body.length).toBeGreaterThanOrEqual(1);
    const autreClient = await request(http).get(`/v1/aml/clients/${randomUUID()}/signaux`).set(bearer(TID, MLRO, "MLRO"));
    expect(autreClient.body.length).toBe(0);
    console.log(`FAT-ALERTE-01 PASS — ${liste.body.length} alertes pour le client, 0 pour un autre`);
  });

  it("FAT-ALERTE-02 [CO] spéculation maysir → blocage automatique (R209) ; entité caritative sanctionnée → revue humaine, PAS d'auto-blocage (R216)", async () => {
    const maysir = await request(http).post("/v1/islamic/evaluer").set(bearer(TID, MLRO, "MLRO"))
      .send({ clientId: CLIENT, transactions: [{ sens: "SORTIE", montantChf: 500000, plateformeSpeculative: true }] });
    expect(maysir.body.bloque).toBe(true);
    expect(maysir.body.signaux[0].regle).toBe("R209");
    const charity = await request(http).post("/v1/islamic/evaluer").set(bearer(TID, MLRO, "MLRO"))
      .send({ clientId: CLIENT, beneficiaireEntiteIslamiqueCaritative: true, beneficiaireSanctionne: true });
    expect(charity.body.bloque).toBe(false);
    expect(charity.body.revueManuelle).toBe(true);
    console.log(`FAT-ALERTE-02 PASS — maysir bloque=${maysir.body.bloque} (R209) ; caritative bloque=${charity.body.bloque} revue=${charity.body.revueManuelle} (R216)`);
  });

  // ══ REJEU À DATE ══════════════════════════════════════════════════════════
  it("FAT-REJEU-01 [Auditeur] la valeur d'un paramètre à une date PASSÉE est celle d'alors, pas la valeur courante (R127)", async () => {
    // une valeur scalaire est renvoyée en corps brut (r.text) — helper de lecture
    const val = (r: request.Response) => Number(r.text);
    // valeur par défaut du paramètre slaKycJours = 30
    const defautAvant = await request(http).get("/v1/parametres/valeur/slaKycJours").set(bearer(TID, CO_A, "CO"));
    expect(defautAvant.status).toBe(200);
    expect(val(defautAvant)).toBe(30);
    // le CO change la règle aujourd'hui : 30 → 45 (motivé)
    const chg = await request(http).post("/v1/parametres/valeur/slaKycJours").set(bearer(TID, CO_A, "CO"))
      .send({ valeur: 45, motif: "Recette : allongement du SLA KYC" });
    expect(chg.status).toBeLessThan(300);
    // aujourd'hui : la nouvelle valeur
    const auj = await request(http).get("/v1/parametres/valeur/slaKycJours").set(bearer(TID, CO_A, "CO"));
    expect(val(auj)).toBe(45);
    // HIER (date passée) : l'auditeur voit la valeur d'ALORS (30), pas 45
    const hier = new Date(Date.now() - 86400000).toISOString();
    const rejeu = await request(http).get(`/v1/parametres/valeur/slaKycJours?date=${hier}`).set(bearer(TID, AUDIT, "AUDIT"));
    expect(rejeu.status).toBe(200);
    expect(val(rejeu)).toBe(30);
    console.log(`FAT-REJEU-01 PASS — aujourd'hui=${val(auj)}, à la date ${hier.slice(0, 10)} (hier)=${val(rejeu)} (valeur d'alors, R127)`);
  });
});
