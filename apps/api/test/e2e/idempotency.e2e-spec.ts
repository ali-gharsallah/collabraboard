/**
 * IDEMPOTENCE — Bloc B (R337/IDM), IDM-04/05 : rejeu RÉEL + atomicité, sur DB réelle. Un retry
 * réseau ne crée jamais un second effet ; un échec ne consomme pas la clé (retry légitime).
 * Unit IDM-01..03 + filtre 422 : src/common/idempotency.spec.ts (harnais).
 */
import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot } from "./util";
import { executerIdempotent } from "../../src/common/idempotency";

describe("IDEMPOTENCE — rejeu réel (Bloc B)", () => {
  let app: INestApplication; let prisma: PrismaService;
  const A = randomUUID();
  beforeAll(async () => { ({ app, prisma } = await boot()); });
  afterAll(async () => { await app.close(); });

  it("IDM-04 commande rejouée (même clé) → un SEUL effet, réponse snapshotée au rejeu", async () => {
    const C = randomUUID(); const agg = randomUUID();
    const commande = () => executerIdempotent(prisma, { commandId: C, tenantId: A, aggregateId: agg, payload: { v: 1 } },
      async (tx) => { await tx.domainEvent.create({ data: { tenantId: A, type: "idem.probe",
        aggregateId: agg, payload: { v: 1 }, at: new Date().toISOString() } }); return { done: true, agg }; },
      { enforce: true });
    const r1 = await commande();
    expect(r1.replayed).toBe(false);
    const r2 = await commande();                                   // retry réseau : MÊME clé
    expect(r2.replayed).toBe(true);
    expect(r2.response).toEqual(r1.response);                      // réponse identique (snapshot)
    const n = await prisma.domainEvent.count({ where: { tenantId: A, aggregateId: agg, type: "idem.probe" } });
    expect(n).toBe(1);                                             // UN SEUL événement malgré 2 appels
  });

  it("IDM-05 atomicité : si la commande échoue, la clé n'est PAS consommée (retry possible)", async () => {
    const C = randomUUID(); const agg = randomUUID();
    await expect(executerIdempotent(prisma, { commandId: C, tenantId: A, aggregateId: agg, payload: { v: 1 } },
      async (tx) => { await tx.domainEvent.create({ data: { tenantId: A, type: "idem.fail",
        aggregateId: agg, payload: {}, at: new Date().toISOString() } }); throw new Error("échec métier"); },
      { enforce: true })).rejects.toThrow("échec métier");
    const consumed = await prisma.processedCommand.findUnique({ where: { commandId: C } });
    expect(consumed).toBeNull();                                   // clé LIBRE → le client peut réessayer
    const n = await prisma.domainEvent.count({ where: { tenantId: A, aggregateId: agg, type: "idem.fail" } });
    expect(n).toBe(0);                                             // l'événement aussi a rollback (atomique)
  });
});
