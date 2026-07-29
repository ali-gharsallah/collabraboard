/**
 * VERSIONING ÉVÉNEMENTS — Bloc E (R339/EV), EV-01/EV-04 : sur DB réelle. Tout événement produit
 * porte event_version ≥ 1 ; un événement legacy (fixture v1) injecté reste LISIBLE par le chemin
 * de désérialisation centralisé (upcast à la lecture, jamais de réécriture). Unit EV-02/03 :
 * src/modules/events/upcasters.spec.ts.
 */
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/common/prisma.service";
import { boot } from "./util";
import { deserialiser } from "../../src/modules/events/upcasters";

describe("VERSIONING ÉVÉNEMENTS (Bloc E)", () => {
  let app: INestApplication; let prisma: PrismaService;
  const A = randomUUID();
  beforeAll(async () => { ({ app, prisma } = await boot()); });
  afterAll(async () => { await app.close(); });

  it("EV-01 tout événement produit porte event_version ≥ 1 (défaut 1)", async () => {
    const ev = await prisma.domainEvent.create({ data: { tenantId: A, type: "ev.probe",
      aggregateId: randomUUID(), payload: { x: 1 }, at: new Date().toISOString() } });
    expect(ev.eventVersion).toBe(1);
    const n = await prisma.domainEvent.count({ where: { tenantId: A, eventVersion: { gte: 1 } } });
    expect(n).toBeGreaterThan(0);
  });

  it("EV-04 événement LEGACY (fixture v1) injecté au journal → toujours lisible (désérialisation centralisée)", async () => {
    const fixture = JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "legacy_events", "kyc.created.v1.json"), "utf8"));
    const ev = await prisma.domainEvent.create({ data: { tenantId: A, type: fixture.type,
      aggregateId: fixture.payload.kycId, payload: fixture.payload, eventVersion: fixture.eventVersion,
      at: new Date().toISOString() } });
    const relu = await prisma.domainEvent.findUnique({ where: { id: ev.id } });
    const out = deserialiser({ type: relu!.type, payload: relu!.payload as any, eventVersion: relu!.eventVersion });
    expect(out.type).toBe("kyc.created");
    expect(out.version).toBeGreaterThanOrEqual(1);
    expect((out.payload as any).kycId).toBe("K-2026-CH-0001-R1");    // le payload legacy reste exploitable
  });
});
