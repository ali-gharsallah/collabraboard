/**
 * FAT — Tests d'Acceptation Fonctionnelle Vague 15 (A3.2 — porte lecture Workflow Instances).
 * Reconnaissance A3 = CAS A (état persisté requêtable). PT-01 par endpoint : la porte RELAIE/PROJETTE,
 * ne décide pas, n'écrit jamais. Filtres (status/type/subjectId), rejeu asOf (R48 délégué au ratifié
 * kyc a-date), acteur d'événement LU dans le payload moteur (jamais synthétisé), zéro endpoint d'écriture.
 */
import * as request from "supertest";
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, bearer, seedTenantClient } from "./util";

describe("FAT Vague 15 — A3.2 porte lecture Workflow Instances (backend réel)", () => {
  let app: INestApplication; let prisma: PrismaService; let http: any;
  const TID = randomUUID(); const CLIENT = randomUUID();
  const RM = randomUUID(); const CO_A = randomUUID(); const CO_B = randomUUID();
  let code: string; let id: string; let type: string;

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    http = app.getHttpServer();
    await seedTenantClient(prisma, TID, CLIENT);
    code = (await request(http).post("/v1/kyc").set(bearer(TID, RM, "RM"))
      .send({ clientId: CLIENT, legalStructure: "PP", accountType: "CURRENT", countryCode: "CH", rmId: RM })).body.code;
    await request(http).patch(`/v1/kyc/${code}/questions/IDE-Q3`).set(bearer(TID, CO_A, "CO")).send({ answer: "PEP: non" });
    await request(http).post(`/v1/kyc/${code}/visas/IDENTITY`).set(bearer(TID, CO_B, "CO")).send({ verdict: "OK" });
    // acquérir « la main » (R84) → événement kyc.lock.acquired { holder } : porte un ACTEUR en payload moteur
    await request(http).post(`/v1/kyc/${code}/lock`).set(bearer(TID, CO_A, "CO"));
  });
  afterAll(async () => { await app.close(); });

  it("PT-01a [list] filtres status/type/subjectId ; subjectRef exposé ; la porte relaie", async () => {
    const all = await request(http).get("/v1/workflow-instances").set(bearer(TID, CO_A, "CO"));
    const inst = all.body.find((i: any) => i.code === code);
    expect(inst).toBeDefined();
    expect(inst.subjectRef).toBe(CLIENT);                          // subjectRef = clientId
    id = inst.id; type = inst.type;
    const bySubject = await request(http).get(`/v1/workflow-instances?subjectId=${CLIENT}`).set(bearer(TID, CO_A, "CO"));
    expect(bySubject.body.every((i: any) => i.subjectRef === CLIENT)).toBe(true);
    const byType = await request(http).get(`/v1/workflow-instances?type=${encodeURIComponent(type)}`).set(bearer(TID, CO_A, "CO"));
    expect(byType.body.some((i: any) => i.code === code)).toBe(true);
    const byStatus = await request(http).get("/v1/workflow-instances?status=IN_PROGRESS").set(bearer(TID, CO_A, "CO"));
    expect(byStatus.body.some((i: any) => i.code === code)).toBe(true);
    console.log(`PT-01a PASS — filtres status/type/subjectId, subjectRef=${CLIENT} exposé`);
  });

  it("PT-01b [detail] steps + visas R15 + currentStep + subjectRef ; asOf rejoue l'état d'alors (R48)", async () => {
    const d = await request(http).get(`/v1/workflow-instances/${id}`).set(bearer(TID, CO_A, "CO"));
    expect(d.body.subjectRef).toBe(CLIENT);
    expect(typeof d.body.currentStep).toBe("string");
    expect(d.body.steps.length).toBeGreaterThan(0);
    const identity = d.body.visas.find((v: any) => v.section === "IDENTITY");
    expect(identity.roleRequis).toBeDefined();                    // format R15 exact (aucun remodelage)
    // Rejeu AVANT la création : l'instance n'existe pas encore à cette date
    const passe = await request(http).get(`/v1/workflow-instances/${id}?asOf=2000-01-01`).set(bearer(TID, CO_A, "CO"));
    expect(passe.body.existeADate).toBe(false);
    expect(passe.body.lectureSeule).toBe(true);
    // Rejeu au futur : visa IDENTITY reconstruit comme signé (signedAt ≤ asOf)
    const futur = await request(http).get(`/v1/workflow-instances/${id}?asOf=2099-01-01`).set(bearer(TID, CO_A, "CO"));
    expect(futur.body.visas.find((v: any) => v.section === "IDENTITY").statut).toBe("SIGNED");
    console.log("PT-01b PASS — détail (steps+visas R15+subjectRef+currentStep) ; asOf reconstruit l'état d'alors");
  });

  it("PT-01c [events] acteur lu dans le payload moteur + horodatage + type ; asOf filtre (R48)", async () => {
    const ev = await request(http).get(`/v1/workflow-instances/${id}/events`).set(bearer(TID, CO_A, "CO"));
    expect(ev.body.length).toBeGreaterThan(0);
    for (const e of ev.body) { expect(e).toHaveProperty("type"); expect(e).toHaveProperty("at"); expect(e).toHaveProperty("acteur"); }
    // au moins un événement porte un acteur (donnée moteur, ex. kyc.validated → validatedBy)
    expect(ev.body.some((e: any) => e.acteur !== null)).toBe(true);
    const avant = await request(http).get(`/v1/workflow-instances/${id}/events?asOf=2000-01-01`).set(bearer(TID, CO_A, "CO"));
    expect(avant.body.length).toBe(0);                            // aucun événement ≤ cette date
    console.log(`PT-01c PASS — timeline (type+at+acteur), asOf filtre les événements`);
  });

  it("PT-01d [invariant] AUCUN endpoint d'écriture sur les instances (A3.2)", async () => {
    const post = await request(http).post(`/v1/workflow-instances/${id}`).set(bearer(TID, CO_A, "CO")).send({ status: "APPROVED" });
    expect(post.status).toBe(404);                                // aucune route d'écriture — l'avancement passe par le moteur
    console.log("PT-01d PASS — aucun endpoint d'écriture sur les instances (404)");
  });
});
