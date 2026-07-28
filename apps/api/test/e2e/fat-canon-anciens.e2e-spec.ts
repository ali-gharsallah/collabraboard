/**
 * FAT — CANON DES ÉCARTS ANCIENS (R280–R283, ratifié le 2026-07-28 — spec/canon-ecarts-anciens.md).
 * Partie 1 : R280 — UNE machine à états canonique pour les risk cases : le produit (R133–R136)
 * fait foi, le moteur R83 est un modèle de RÉFÉRENCE qui s'y mappe via la table RATIFIÉE
 * (5 états 1:1 ; deux deltas de transitions consignés). Familles : UC (unification cases).
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";
import { TRANSITIONS } from "../../src/modules/riskcases/risk-case.service";

describe("FAT CANON ANCIENS — Partie 1 : R280 réconciliation R83↔R133-R136 (UC-01..03)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const T = randomUUID();
  const CO = randomUUID();
  let clientId = "";

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, T, (clientId = randomUUID()));
  });
  afterAll(async () => { await app.close(); });

  it("UC-02 [R280] le mapping est TOTAL : produit = modèle de référence R83 ⊕ les 2 deltas ratifiés — un orphelin fait échouer ce test", async () => {
    // Modèle de RÉFÉRENCE R83 (olive_cpsi/engine.py l.656 — copié comme référence RATIFIÉE,
    // le moteur reste intouchable) : transitions état → cibles.
    const REFERENCE_R83: Record<string, string[]> = {
      NOUVELLE: ["EN_ANALYSE"],
      EN_ANALYSE: ["CLARIFICATION", "CLOTUREE", "ESCALADEE"],
      CLARIFICATION: ["EN_ANALYSE", "CLOTUREE"],
      CLOTUREE: [], ESCALADEE: [],
    };
    // Les DEUX deltas RATIFIÉS (2026-07-28) — toute autre divergence est un écart bloquant :
    const DELTAS = {
      retiréesDuProduit: [["CLARIFICATION", "CLOTUREE"]],   // resserrement : clôture après reprise d'analyse tracée
      ajoutéesAuProduit: [["ESCALADEE", "CLOTUREE"]],       // extension : clôture administrative post-MROS (R136)
    };
    // 1. Totalité des ÉTATS — 1:1, aucun orphelin d'aucun côté
    expect(Object.keys(TRANSITIONS).sort()).toEqual(Object.keys(REFERENCE_R83).sort());
    // 2. Transitions : produit == référence ⊕ deltas, exactement
    const attendu: Record<string, string[]> = JSON.parse(JSON.stringify(REFERENCE_R83));
    for (const [de, vers] of DELTAS.retiréesDuProduit) attendu[de] = attendu[de].filter((v) => v !== vers);
    for (const [de, vers] of DELTAS.ajoutéesAuProduit) attendu[de] = [...attendu[de], vers];
    for (const etat of Object.keys(attendu))
      expect([...TRANSITIONS[etat]].sort()).toEqual([...attendu[etat]].sort());
    console.log("UC-02 PASS — mapping total : 5 états 1:1, produit = référence ⊕ 2 deltas ratifiés, rien d'autre");
  });

  it("UC-01 [R280/R252] la proposition entre par la PORTE D'ENTRÉE : case_proposal consommé → NOUVELLE, tracé, référencé, idempotent", async () => {
    // Une case_proposal ÉMISE (journal CPSI, forme exacte de PC-09)
    const cle = `${clientId}|SC_SCORE+SC_STRUCT`;
    await prisma.cpsiEvent.create({ data: { tenantId: T, type: "cpsi.case_proposal.emitted",
      clientId, at: new Date().toISOString(), payload: { client: clientId, scenarios: ["SC_SCORE", "SC_STRUCT"], cle, par: CO } } });

    const r = await request(http).post("/v1/riskcases/consommer-proposition").set(bearer(T, CO, "CO")).send({ cle });
    expect(r.status).toBe(201);
    expect(r.body.statut).toBe("NOUVELLE");                               // l'état d'ENTRÉE canonique, jamais un intermédiaire
    const c = await prisma.riskCase.findFirst({ where: { id: r.body.caseId } });
    expect(c!.statut).toBe("NOUVELLE");
    const ev = await prisma.domainEvent.findMany({ where: { tenantId: T, type: "riskcase.ouvert", aggregateId: r.body.caseId } });
    expect(ev.length).toBe(1);
    expect((ev[0].payload as any).depuisProposition).toBe(cle);           // la référence au case_proposal est PORTÉE
    // Idempotence re-vérifiée CÔTÉ CONSOMMATEUR (PC-10) : re-consommer ne crée RIEN
    const avant = await prisma.riskCase.count({ where: { tenantId: T } });
    const re = await request(http).post("/v1/riskcases/consommer-proposition").set(bearer(T, CO, "CO")).send({ cle });
    expect(re.status).toBe(201);
    expect(re.body.dejaConsommee).toBe(true);
    expect(re.body.caseId).toBe(r.body.caseId);
    expect(await prisma.riskCase.count({ where: { tenantId: T } })).toBe(avant);
    // Une clé inconnue ne s'invente pas
    await request(http).post("/v1/riskcases/consommer-proposition").set(bearer(T, CO, "CO"))
      .send({ cle: "fantome|SC_X" }).expect(404);
    console.log("UC-01 PASS — NOUVELLE, référencé, idempotent consommateur, clé inconnue refusée");
  });

  it("UC-03 [R280] UN SEUL jeu de transitions : le delta ratifié s'applique — CLARIFICATION→CLOTUREE refusée, ESCALADEE→CLOTUREE servie", async () => {
    const cas = (await prisma.riskCase.findMany({ where: { tenantId: T, statut: "NOUVELLE" } }))[0];
    const aller = (vers: string, motif?: string) =>
      request(http).post(`/v1/riskcases/${cas.id}/transition`).set(bearer(T, CO, "CO")).send({ vers, motif });
    await aller("EN_ANALYSE").expect(201);
    await aller("CLARIFICATION").expect(201);
    // Resserrement RATIFIÉ : la clôture directe depuis CLARIFICATION (référence R83) n'existe PAS au produit
    const refus = await aller("CLOTUREE", "tentative de clôture directe");
    expect(refus.status).toBe(400);
    expect(JSON.stringify(refus.body)).toContain("Transition illégale");
    await aller("EN_ANALYSE").expect(201);                                // la reprise d'analyse est LA voie
    await aller("ESCALADEE", "corrélation confirmée — voie MROS").expect(201);
    // Extension RATIFIÉE : clôture administrative post-escalade (aucune MROS active ici)
    const cloture = await aller("CLOTUREE", "classement administratif post-communication");
    expect(cloture.status).toBe(201);
    expect((await prisma.riskCase.findFirst({ where: { id: cas.id } }))!.statut).toBe("CLOTUREE");
    console.log("UC-03 PASS — un seul jeu de transitions : deltas ratifiés appliqués, rien d'autre ne passe");
  });
});
