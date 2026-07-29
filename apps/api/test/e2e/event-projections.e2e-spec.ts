/**
 * PROJECTIONS RECONSTRUCTIBLES — Bloc C (R338/PJ), sur DB réelle.
 *
 * O-Live est CRUD-primaire + journal append-only ; SEULES les projections DÉRIVÉES d'événements
 * (golden record R104) doivent être reconstructibles depuis le journal. On prouve :
 *  - PJ-01 : rebuild (rejeu de TOUT le journal) ≡ incrémental (drain événement par événement) —
 *            la projection est une fonction déterministe du journal + tables source ;
 *  - PJ-02 : le rebuild est IDEMPOTENT (rejouer 2× ne change rien, GR-03 : pas de diff → pas d'écriture) ;
 *  - PJ-03 : ÉCART CONSIGNÉ — les tables CRUD (source de vérité) NE sont PAS reconstructibles du
 *            journal : l'événement porte une RÉFÉRENCE (R285), pas le payload complet ; rejouer un
 *            événement dont l'agrégat source manque n'applique rien et ne recrée PAS la source.
 */
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { GoldenRecordProjector } from "../../src/modules/events/golden-record.projector";
import { boot } from "./util";

describe("PROJECTIONS RECONSTRUCTIBLES (Bloc C)", () => {
  let app: INestApplication; let prisma: PrismaService; let projector: GoldenRecordProjector;
  const T = randomUUID();
  const clientId = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await boot());
    projector = app.get(GoldenRecordProjector);
    await prisma.$executeRaw`INSERT INTO tenants (id, name, created_at) VALUES (${T}::uuid, 'GWB', NOW()) ON CONFLICT (id) DO NOTHING`;
    await prisma.client.create({ data: { id: clientId, tenantId: T, name: "Dupont Holding SA",
      structure: "HOLDING", country: "CH", riskLevel: "MEDIUM" } });
  });
  afterAll(async () => { await app.close(); });

  // KYC validé (source de vérité) + son événement kyc.validated (référence, R285).
  async function kycValide(riskLevel: string, sequence: number) {
    const kyc = await prisma.kycFile.create({ data: { tenantId: T, clientId, code: `KYC-2026-CH-${sequence}`,
      year: 2026, countryCode: "CH", sequence, workflow: "CDD", riskScore: 10 * sequence, riskLevel,
      status: "VALIDATED", createdBy: randomUUID(), validatedBy: randomUUID() } });
    await prisma.domainEvent.create({ data: { tenantId: T, type: "kyc.validated",
      aggregateId: kyc.id, payload: { code: kyc.code }, at: new Date().toISOString() } });
    return kyc;
  }

  // Rejeu de TOUT le journal (ordre id croissant) à travers la projection = reconstruction.
  async function rebuild(): Promise<Array<{ applied: boolean }>> {
    const evts = await prisma.domainEvent.findMany({ where: { tenantId: T, type: "kyc.validated" }, orderBy: { id: "asc" } });
    const out: Array<{ applied: boolean }> = [];
    for (const e of evts)
      out.push(await projector.handle({ tenant_id: e.tenantId, type: e.type, aggregate_id: e.aggregateId, payload: e.payload }, prisma));
    return out;
  }

  const riskProjete = async () => (await prisma.client.findUniqueOrThrow({ where: { id: clientId } })).riskLevel;

  it("PJ-01 rebuild du journal ≡ drain incrémental (projection = fonction déterministe des événements)", async () => {
    const k1 = await kycValide("LOW", 1);
    const k2 = await kycValide("HIGH", 2);

    // ── INCRÉMENTAL : la projection consomme les événements un par un, dans l'ordre. ──
    await projector.handle({ tenant_id: T, type: "kyc.validated", aggregate_id: k1.id, payload: {} }, prisma);
    expect(await riskProjete()).toBe("LOW");
    await projector.handle({ tenant_id: T, type: "kyc.validated", aggregate_id: k2.id, payload: {} }, prisma);
    const incremental = await riskProjete();
    expect(incremental).toBe("HIGH");

    // ── REBUILD : on perturbe l'état projeté, puis on rejoue TOUT le journal depuis zéro. ──
    await prisma.client.update({ where: { id: clientId }, data: { riskLevel: "MEDIUM" } });
    await rebuild();
    const reconstruit = await riskProjete();

    expect(reconstruit).toBe(incremental);   // convergence : rebuild ≡ incrémental
    expect(reconstruit).toBe("HIGH");
  });

  it("PJ-02 le rebuild est idempotent EN ÉTAT : N reconstructions convergent vers le même état projeté", async () => {
    await rebuild(); const s1 = await riskProjete();   // le rejeu complet est DÉTERMINISTE :
    await rebuild(); const s2 = await riskProjete();   // seul l'état FINAL importe (les événements
    await rebuild(); const s3 = await riskProjete();   // intermédiaires écrivent, mais convergent).
    expect([s1, s2, s3]).toEqual(["HIGH", "HIGH", "HIGH"]);

    // GR-03 au niveau d'UN événement : rejouer le DERNIER sur l'état déjà convergé n'écrit rien.
    const last = await prisma.domainEvent.findFirstOrThrow({ where: { tenantId: T, type: "kyc.validated" }, orderBy: { id: "desc" } });
    const res = await projector.handle({ tenant_id: T, type: "kyc.validated", aggregate_id: last.aggregateId, payload: {} }, prisma);
    expect(res.applied).toBe(false);
    expect(res.reason).toBe("aucun-diff");
  });

  it("PJ-03 ÉCART : le CRUD (source de vérité) n'est PAS reconstructible du journal — l'événement porte une référence, pas le payload", async () => {
    const orphelin = randomUUID();
    await prisma.domainEvent.create({ data: { tenantId: T, type: "kyc.validated",
      aggregateId: orphelin, payload: { code: "KYC-ABSENT" }, at: new Date().toISOString() } });
    const avant = await prisma.kycFile.count({ where: { tenantId: T } });

    const res = await projector.handle({ tenant_id: T, type: "kyc.validated", aggregate_id: orphelin, payload: {} }, prisma);

    expect(res.applied).toBe(false);
    expect(res.reason).toBe("kyc-introuvable");        // l'agrégat source manque : rien à projeter
    expect(await prisma.kycFile.count({ where: { tenantId: T } })).toBe(avant);   // rejeu ne RECRÉE pas le kyc_file
  });
});
