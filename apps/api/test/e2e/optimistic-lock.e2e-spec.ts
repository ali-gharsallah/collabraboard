/**
 * VERROU OPTIMISTE — Bloc A (R336/LK), LK-02/LK-04 : concurrence RÉELLE + atomicité, sur la
 * table d'état `kyc_files` (le cas de la spec : deux compliance officers, même dossier). Unit
 * LK-01/LK-03 : voir src/common/optimistic-lock.spec.ts (harnais).
 */
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot, seedTenantClient } from "./util";
import { majVersionnee, ConcurrencyConflictError } from "../../src/common/optimistic-lock";

describe("VERROU OPTIMISTE — concurrence réelle (Bloc A)", () => {
  let app: INestApplication; let prisma: PrismaService;
  const A = randomUUID();
  const mkKyc = async () => {
    const clientId = randomUUID(); await seedTenantClient(prisma, A, clientId);
    return prisma.kycFile.create({ data: { tenantId: A, clientId, code: `K-${randomUUID().slice(0, 8)}`,
      year: 2026, countryCode: "CH", sequence: 1, workflow: "CDD", riskScore: 10, riskLevel: "LOW",
      status: "IN_PROGRESS", createdBy: randomUUID() } });   // version = 0 (défaut)
  };

  beforeAll(async () => { ({ app, prisma } = await boot()); });
  afterAll(async () => { await app.close(); });

  it("LK-02 deux écritures concurrentes sur le MÊME dossier (version 0) → une réussit, une 409", async () => {
    const k = await mkKyc();
    const [r1, r2] = await Promise.allSettled([
      majVersionnee(prisma.kycFile as any, k.id, 0, { status: "UNDER_REVIEW" }, { enforce: true }),
      majVersionnee(prisma.kycFile as any, k.id, 0, { status: "REJECTED" }, { enforce: true }),
    ]);
    const reussites = [r1, r2].filter((r) => r.status === "fulfilled").length;
    const conflits = [r1, r2].filter((r) => r.status === "rejected"
      && (r as PromiseRejectedResult).reason instanceof ConcurrencyConflictError).length;
    expect(reussites).toBe(1);                                     // exactement une gagne
    expect(conflits).toBe(1);                                      // l'autre = conflit typé (→ 409)
    const relu = await prisma.kycFile.findUnique({ where: { id: k.id } });
    expect(relu!.version).toBe(1);                                 // une SEULE mutation appliquée (pas d'écrasement)
  });

  it("LK-VISA-02 double validation visa SIMULTANÉE (lot 1) → une signature tient, l'autre 409", async () => {
    // Deux porteurs du même rôle signant LA MÊME section (visa version 0) : four-eyes concurrent.
    const k = await mkKyc();
    const visa = await prisma.kycVisa.create({ data: { kycFileId: k.id, sectionCode: "IDENT",
      requiredRole: "CO", status: "PENDING" } });                   // version = 0 (défaut)
    const [r1, r2] = await Promise.allSettled([
      majVersionnee(prisma.kycVisa as any, visa.id, 0, { status: "SIGNED", signedBy: "premier", verdict: "OK" }, { enforce: true }),
      majVersionnee(prisma.kycVisa as any, visa.id, 0, { status: "SIGNED", signedBy: "second", verdict: "NOK" }, { enforce: true }),
    ]);
    const reussites = [r1, r2].filter((r) => r.status === "fulfilled").length;
    const conflits = [r1, r2].filter((r) => r.status === "rejected"
      && (r as PromiseRejectedResult).reason instanceof ConcurrencyConflictError).length;
    expect(reussites).toBe(1);                                       // une seule signature l'emporte
    expect(conflits).toBe(1);                                        // l'autre = conflit typé (→ 409)
    const relu = await prisma.kycVisa.findUnique({ where: { id: visa.id } });
    expect(relu!.version).toBe(1);                                   // JAMAIS d'écrasement du signataire
  });

  it("LK-04 atomicité : une commande qui échoue APRÈS la 1re écriture ne persiste RIEN (rollback)", async () => {
    const k = await mkKyc();
    await expect(prisma.$transaction(async (tx) => {
      await majVersionnee(tx.kycFile as any, k.id, 0, { status: "UNDER_REVIEW" }, { enforce: true });
      throw new Error("échec métier après la 1re écriture");       // ex. 3e événement d'une commande
    })).rejects.toThrow("échec métier");
    const relu = await prisma.kycFile.findUnique({ where: { id: k.id } });
    expect(relu!.version).toBe(0);                                 // rollback : version inchangée
    expect(relu!.status).toBe("IN_PROGRESS");                      // rien de persisté
  });
});
