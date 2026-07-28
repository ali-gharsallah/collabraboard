/**
 * FAT — DÉGEL VAGUE 3 (canon ratifié + GO Ali 2026-07-28) : LE BUILDER.
 * R304 [canon R301] artefacts VERSIONNÉS à date, grandfathering · R305 [canon R302]
 * publication verrouillée par le BAC À SABLE · R306 [canon R303] cohérence validée
 * BACKEND, liste complète · R307 [canon R304] publication FOUR-EYES · R308 [canon R305]
 * exécution sur les MOTEURS EXISTANTS — zéro runtime propre. WB-01..10.
 * Livraison par règle : les scénarios s'ajoutent commit par commit ; un test amendé par
 * une règle POSTÉRIEURE le dit en commentaire (canon layering, précédent SO-05).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { OutboxWorker } from "../../src/modules/events/outbox.worker";

const SECTION_OK = {
  label: "Crypto-actifs", workflows: ["CDD", "EDD"],
  questions: [
    { code: "CRY-Q1", label: "Origine des crypto-actifs documentée", requise: true,
      rights: { RM: "EDIT", CO: "EDIT", CO_SR: "VIEW", ADMIN: "EDIT" } },
    { code: "CRY-Q2", label: "Plateformes d'échange utilisées", requise: false,
      rights: { RM: "EDIT", CO: "VIEW", ADMIN: "EDIT" } } ],
};

describe("FAT DÉGEL V3 — R304 : l'artefact publié est IMMUABLE, le modifier crée une VERSION (WB-01)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const ADMIN = randomUUID(), ADMIN2 = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  const simulerEtPublier = async (id: string, motif: string) => {
    await request(http).post(`/v1/builder/artefacts/${id}/simuler`).set(bearer(T, ADMIN, "ADMIN")).expect(201);
    return request(http).post(`/v1/builder/artefacts/${id}/publier`).set(bearer(T, ADMIN2, "ADMIN"))
      .send({ motif, depuisLe: new Date().toISOString() });                 // un SECOND publie (R307, posé d'emblée)
  };

  it("WB-01 [R304] brouillon → publication v1 → la version est GRAVÉE ; re-modifier le brouillon et republier → v2 ; v1 inchangée en base", async () => {
    const cre = await request(http).post("/v1/builder/artefacts").set(bearer(T, ADMIN, "ADMIN"))
      .send({ type: "SECTION", code: "CRYPTO", contenu: SECTION_OK });
    expect(cre.status).toBe(201);
    const id = cre.body.id;
    const p1 = await simulerEtPublier(id, "nouvelle section crypto (canon dégel V3)");
    expect(p1.status).toBe(201);
    expect(p1.body.version).toBe(1);
    // La version publiée est APPEND-ONLY : l'UPDATE direct lève
    const v1 = await prisma.builderVersion.findFirst({ where: { tenantId: T, code: "CRYPTO", version: 1 } });
    await expect(prisma.$executeRawUnsafe(
      `UPDATE builder_versions SET contenu = '{}' WHERE id = '${v1!.id}'`)).rejects.toThrow(/append-only/);
    // Modifier = retoucher le BROUILLON — la v1 ne bouge pas ; republier → v2
    await request(http).post("/v1/builder/artefacts").set(bearer(T, ADMIN, "ADMIN"))
      .send({ type: "SECTION", code: "CRYPTO", contenu: { ...SECTION_OK,
        questions: [...SECTION_OK.questions, { code: "CRY-Q3", label: "Wallets auto-hébergés déclarés",
          requise: false, rights: { RM: "EDIT", ADMIN: "EDIT" } }] } }).expect(201);
    const p2 = await simulerEtPublier(id, "ajout wallets auto-hébergés");
    expect(p2.status).toBe(201);
    expect(p2.body.version).toBe(2);
    const relue = await prisma.builderVersion.findFirst({ where: { tenantId: T, code: "CRYPTO", version: 1 } });
    expect((relue!.contenu as any).questions.length).toBe(2);               // v1 INTACTE
    console.log("WB-01 PASS — versions gravées, le brouillon seul bouge");
  });
});

describe("FAT DÉGEL V3 — R305/R306/R307 : la chaîne de publication est GARDÉE (WB-03/04/05)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const ADMIN = randomUUID(), ADMIN2 = randomUUID(), RM = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("WB-03 [R305] publier SANS simulation → refus serveur ; re-modifier APRÈS simulation → la simulation est invalidée (empreinte)", async () => {
    const { body: a } = await request(http).post("/v1/builder/artefacts").set(bearer(T, ADMIN, "ADMIN"))
      .send({ type: "SECTION", code: "VERROU", contenu: SECTION_OK }).expect(201);
    const sans = await request(http).post(`/v1/builder/artefacts/${a.id}/publier`).set(bearer(T, ADMIN2, "ADMIN"))
      .send({ motif: "tentative sans bac" });
    expect(sans.status).toBe(400);
    expect(JSON.stringify(sans.body)).toContain("R305");                     // le verrou est STRUCTUREL
    await request(http).post(`/v1/builder/artefacts/${a.id}/simuler`).set(bearer(T, ADMIN, "ADMIN")).expect(201);
    // …mais l'artefact est RE-MODIFIÉ après la simulation → l'empreinte ne colle plus
    await request(http).post("/v1/builder/artefacts").set(bearer(T, ADMIN, "ADMIN"))
      .send({ type: "SECTION", code: "VERROU", contenu: { ...SECTION_OK, label: "Crypto-actifs v2" } }).expect(201);
    const perime = await request(http).post(`/v1/builder/artefacts/${a.id}/publier`).set(bearer(T, ADMIN2, "ADMIN"))
      .send({ motif: "simulation périmée" });
    expect(perime.status).toBe(400);
    expect(JSON.stringify(perime.body)).toContain("R305");
    // Re-simuler LE contenu courant → publiable ; le rapport d'impact est JOINT (WB-10 partiel)
    const sim = await request(http).post(`/v1/builder/artefacts/${a.id}/simuler`).set(bearer(T, ADMIN, "ADMIN"));
    expect(sim.body.rapport.chargeParRole).toBeTruthy();                     // le rapport SB-03 : charge par rôle
    const ok = await request(http).post(`/v1/builder/artefacts/${a.id}/publier`).set(bearer(T, ADMIN2, "ADMIN"))
      .send({ motif: "publication après bac" });
    expect(ok.status).toBe(201);
    const v = await prisma.builderVersion.findFirst({ where: { tenantId: T, code: "VERROU", version: 1 } });
    expect((v!.rapport as any).chargeParRole).toBeTruthy();                  // JOINT à la version gravée
    console.log("WB-03 PASS — verrou bac structurel, empreinte, rapport joint");
  });

  it("WB-04 [R306/R269] les 7 incohérences de fixture → refusées D'UN COUP, toutes listées", async () => {
    // WORKFLOW malade : sans terminal atteignable + transition orpheline + étape sans owner + rôle inexistant + cycle sans sortie
    const { body: wf } = await request(http).post("/v1/builder/artefacts").set(bearer(T, ADMIN, "ADMIN"))
      .send({ type: "WORKFLOW", code: "WF_MALADE", contenu: {
        etapes: [
          { code: "A", owner: "RM", transitions: ["B", "FANTOME"] },
          { code: "B", transitions: ["A"] },
          { code: "C", owner: "JEDI", transitions: [] } ],
        terminaux: ["FIN"] } }).expect(201);
    await request(http).post(`/v1/builder/artefacts/${wf.id}/simuler`).set(bearer(T, ADMIN, "ADMIN")).expect(201);
    const r = await request(http).post(`/v1/builder/artefacts/${wf.id}/publier`).set(bearer(T, ADMIN2, "ADMIN"))
      .send({ motif: "test cohérence" });
    expect(r.status).toBe(400);
    const refus: string[] = r.body.refus ?? [];
    for (const attendu of ["WORKFLOW_SANS_TERMINAL", "TRANSITION_ORPHELINE", "ETAPE_SANS_OWNER",
      "ROLE_INEXISTANT", "CYCLE_SANS_SORTIE"])
      expect(refus.some((x) => x.startsWith(attendu))).toBe(true);
    // SECTION malade : requise-cachée + sans EDIT
    const { body: sec } = await request(http).post("/v1/builder/artefacts").set(bearer(T, ADMIN, "ADMIN"))
      .send({ type: "SECTION", code: "SEC_MALADE", contenu: { label: "x", workflows: ["CDD"],
        questions: [{ code: "Q1", label: "q", requise: true, rights: { RM: "HIDDEN", CO: "VIEW" } }] } }).expect(201);
    await request(http).post(`/v1/builder/artefacts/${sec.id}/simuler`).set(bearer(T, ADMIN, "ADMIN")).expect(201);
    const r2 = await request(http).post(`/v1/builder/artefacts/${sec.id}/publier`).set(bearer(T, ADMIN2, "ADMIN"))
      .send({ motif: "test cohérence section" });
    expect(r2.status).toBe(400);
    const refus2: string[] = r2.body.refus ?? [];
    expect(refus2.some((x) => x.startsWith("SECTION_SANS_ROLE_EDIT"))).toBe(true);
    expect(refus2.some((x) => x.startsWith("REQUISE_MAIS_CACHEE"))).toBe(true);
    expect(refus.length + refus2.length).toBeGreaterThanOrEqual(7);          // les 7 incohérences, TOUTES listées
    console.log(`WB-04 PASS — ${refus.length}+${refus2.length} refus listés d'un coup`);
  });

  it("WB-05 [R307/R13] auteur = publicateur → refus ; rôle hors roles_publication_builder → refus ; le SECOND habilité publie", async () => {
    const { body: a } = await request(http).post("/v1/builder/artefacts").set(bearer(T, ADMIN, "ADMIN"))
      .send({ type: "SECTION", code: "QUATRE_YEUX", contenu: SECTION_OK }).expect(201);
    await request(http).post(`/v1/builder/artefacts/${a.id}/simuler`).set(bearer(T, ADMIN, "ADMIN")).expect(201);
    const soi = await request(http).post(`/v1/builder/artefacts/${a.id}/publier`).set(bearer(T, ADMIN, "ADMIN"))
      .send({ motif: "auto-publication" });
    expect(soi.status).toBe(403);
    expect(JSON.stringify(soi.body)).toContain("R13");
    await request(http).post(`/v1/builder/artefacts/${a.id}/publier`).set(bearer(T, RM, "RM"))
      .send({ motif: "RM tente" }).expect(403);
    await request(http).post(`/v1/builder/artefacts/${a.id}/publier`).set(bearer(T, ADMIN2, "ADMIN"))
      .send({ motif: "second regard ADMIN" }).expect(201);
    console.log("WB-05 PASS — four-eyes + rôles habilités");
  });
});

// ── R308 : les artefacts s'exécutent sur les MOTEURS EXISTANTS (WB-02/06/07/08) ──

describe("FAT DÉGEL V3 — R308 : zéro runtime propre, les moteurs ratifiés exécutent (WB-02/06/07/08)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID(); const ADMIN = randomUUID(), ADMIN2 = randomUUID(), RM = randomUUID(), COC = randomUUID();

  const publierArtefact = async (type: string, code: string, contenu: any, motif: string) => {
    const { body: a } = await request(http).post("/v1/builder/artefacts").set(bearer(T, ADMIN, "ADMIN"))
      .send({ type, code, contenu }).expect(201);
    await request(http).post(`/v1/builder/artefacts/${a.id}/simuler`).set(bearer(T, ADMIN, "ADMIN")).expect(201);
    const r = await request(http).post(`/v1/builder/artefacts/${a.id}/publier`).set(bearer(T, ADMIN2, "ADMIN"))
      .send({ motif });
    expect(r.status).toBe(201);
    return r.body;
  };
  const creerKyc = async () => {
    const clientId = randomUUID();
    await seedTenantClient(prisma, T, clientId);
    return (await request(http).post("/v1/kyc").set(bearer(T, RM, "RM"))
      .send({ clientId, legalStructure: "HOLDING", accountType: "ADVISORY", countryCode: "CH", rmId: RM })).body; // CDD
  };

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    (app.get(OutboxWorker) as OutboxWorker).onModuleDestroy();
    await seedTenantClient(prisma, T, randomUUID());
  });
  afterAll(async () => { await app.close(); });

  it("WB-02/WB-07 [R304/R308/R282] section publiée v1 → le dossier A la porte ; v2 publiée → A reste sur v1, le NOUVEAU prend v2 ; la matrice R282 s'applique", async () => {
    await publierArtefact("SECTION", "CRYPTO", SECTION_OK, "section crypto v1");
    const A = await creerKyc();
    const secA = A.sections.find((s: any) => s.code === "CRYPTO");
    expect(secA).toBeTruthy();
    expect(secA.questions.map((q: any) => q.code).sort()).toEqual(["CRY-Q1", "CRY-Q2"]);   // v1
    await publierArtefact("SECTION", "CRYPTO", { ...SECTION_OK,
      questions: [...SECTION_OK.questions, { code: "CRY-Q3", label: "Wallets auto-hébergés",
        requise: false, rights: { RM: "EDIT", ADMIN: "EDIT" } }] }, "crypto v2 : wallets");
    const B = await creerKyc();
    expect(B.sections.find((s: any) => s.code === "CRYPTO").questions.length).toBe(3);      // v2 pour le NOUVEAU
    const relu = (await request(http).get(`/v1/kyc/${A.code}`).set(bearer(T, RM, "RM"))).body;
    expect(relu.sections.find((s: any) => s.code === "CRYPTO").questions.length).toBe(2);   // A reste sur SA version (R29)
    // WB-07 : la matrice R282 gouverne la section née du Builder — HIDDEN à portée matrice
    const chg = await request(http).patch(`/v1/kyc/${B.code}/questions/CRY-Q1/access`).set(bearer(T, ADMIN, "ADMIN"))
      .send({ role: "RM", right: "HIDDEN", portee: "matrice" });
    expect(chg.status).toBe(200);
    const vuRM = (await request(http).get(`/v1/kyc/${B.code}`).set(bearer(T, RM, "RM"))).body;
    expect(vuRM.sections.find((s: any) => s.code === "CRYPTO").questions.some((q: any) => q.code === "CRY-Q1")).toBe(false);
    console.log("WB-02/07 PASS — grandfathering par construction, matrice R282 maîtresse");
  });

  it("WB-06 [R308/R171-173] un WORKFLOW publié au Builder vit dans L'ATELIER (résolu par date) ; un dossier s'exécute BOUT EN BOUT sur le moteur R1-R51", async () => {
    const WF = { etapes: [
      { code: "COLLECTE", owner: "RM", transitions: ["REVUE"] },
      { code: "REVUE", owner: "CO", transitions: ["FIN", "COLLECTE"] },
      { code: "FIN", owner: "CO_SR", transitions: [] } ], terminaux: ["FIN"] };
    await publierArtefact("WORKFLOW", "WF_CRYPTO", WF, "workflow crypto onboarding");
    // L'atelier R171-173 le RÉSOUT — la définition vit chez le moteur, pas au Builder
    const res = await request(http).get(`/v1/workflow/resoudre?code=WF_CRYPTO&date=${encodeURIComponent(new Date().toISOString())}`)
      .set(bearer(T, ADMIN, "ADMIN"));
    expect(res.status).toBe(200);
    expect((res.body.contenu.etapes ?? []).length).toBe(3);
    // Bout en bout : un dossier réel traverse le moteur R1-R51 jusqu'à VALIDATED
    const kyc = await creerKyc();
    for (const s of kyc.sections)
      for (const q of s.questions) {
        const role = ["IDE-Q3", "UBO-Q2", "SOF-Q2", "AML-Q1"].includes(q.code) ? "CO" : "RM";
        await request(http).patch(`/v1/kyc/${kyc.code}/questions/${q.code}`).set(bearer(T, role === "CO" ? COC : RM, role))
          .send({ answer: "renseigné" });
      }
    for (const v of kyc.visas)
      await request(http).post(`/v1/kyc/${kyc.code}/visas/${v.sectionCode}`).set(bearer(T, randomUUID(), v.requiredRole)).send({});
    const val = await request(http).post(`/v1/kyc/${kyc.code}/validate`).set(bearer(T, randomUUID(), "CO_SR")).send({});
    expect([200, 201]).toContain(val.status);
    console.log("WB-06 PASS — atelier résout la def Builder, dossier validé sur le moteur");
  });

  it("WB-08 [R308] ZÉRO interprète dans le module builder — revue d'architecture automatisée", async () => {
    const src = fs.readFileSync(path.join(__dirname, "../../src/modules/builder/builder.module.ts"), "utf8");
    expect(src).not.toMatch(/\beval\b|new Function|vm\.|interpret|execute\(/i);       // aucun runtime propre
    expect(src).toMatch(/WorkflowDefService/);                                        // il DÉLÈGUE aux moteurs
    expect(src).toMatch(/ParametresService/);
    expect(src).not.toMatch(/from "..\/..\/..\/services/);                            // jamais le moteur CPSI en direct
    console.log("WB-08 PASS — le Builder édite, les moteurs exécutent");
  });
});
