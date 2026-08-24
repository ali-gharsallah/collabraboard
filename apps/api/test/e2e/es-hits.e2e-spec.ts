/**
 * ES-6 (extension série ES — docs/notes/ES-6.md) — timeline des hits screening PAR REJEU.
 *   • ES6-01 : détection + qualification consommées de l'outbox → état du hit = rejeu des faits ;
 *   • ES6-02 : rebuild from scratch — instance neuve, état identique ;
 *   • ES6-03 : file des hits reconstructible, hit non qualifié reste DETECTE ;
 *   • ES6-04 : la table screening_hits du monolithe n'est PAS touchée par ES (lecture seule).
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { EsEventStore } from "../../src/modules/surveillance-es/es-event-store.service";
import { EsSubscriber, CONSOMMATEUR_ES } from "../../src/modules/surveillance-es/es-subscriber.service";
import { EsHits, rejouerHit } from "../../src/modules/surveillance-es/es-hits.service";

const URL_OWNER = process.env.DATABASE_URL ?? "postgresql://olive:olive@localhost:5433/olive_test";

describe("ES-6 — timeline des hits screening par rejeu (extension : là où le rejeu est le produit)", () => {
  let owner: PrismaClient; let store: EsEventStore; let sub: EsSubscriber; let hits: EsHits;
  const T = randomUUID(); const ctx = { tenantId: T };
  const H1 = randomUUID(), H2 = randomUUID();

  const inserer = (type: string, aggregateId: string, payload: unknown) => owner.$executeRaw`
    INSERT INTO domain_events (tenant_id, type, aggregate_id, payload, at)
    VALUES (${T}::uuid, ${type}, ${aggregateId}, ${JSON.stringify(payload)}::jsonb, now())`;

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: URL_OWNER } } });
    store = new EsEventStore(owner as any);
    sub = new EsSubscriber(owner as any, store);
    hits = new EsHits(store);
    await owner.$executeRaw`DELETE FROM "es"."subscription_cursor" WHERE "consumer" = ${CONSOMMATEUR_ES}`;
    await sub.assurerCurseur();                                    // naissance au présent
    await inserer("screening.hit.detecte", H1, { hitId: H1, clientId: "C1", entreeUid: "SDN-1",
      score: 92, listeVersion: "SECO@2026-08-01" });
    await inserer("screening.hit.detecte", H2, { hitId: H2, clientId: "C2", entreeUid: "SDN-2",
      score: 88, listeVersion: "SECO@2026-08-01" });
    await inserer("screening.hit.qualifie", H1, { hitId: H1, verdict: "FAUX_POSITIF",
      motif: "homonymie établie", par: "co-1" });
    await sub.drainer();
  });
  afterAll(async () => { await owner.$disconnect(); });

  it("ES6-01 état du hit = rejeu des faits : DETECTE → QUALIFIE, timeline complète", async () => {
    const h = await hits.etatHit(ctx, H1);
    expect(h).toMatchObject({ hitId: H1, statut: "QUALIFIE", clientId: "C1", entreeUid: "SDN-1",
      score: 92, listeVersion: "SECO@2026-08-01", verdict: "FAUX_POSITIF", motif: "homonymie établie", par: "co-1" });
    expect(h!.timeline.map((t) => t.type)).toEqual(["fait.screening.hit.detecte", "fait.screening.hit.qualifie"]);
  });

  it("ES6-02 rebuild from scratch : instance neuve, état identique", async () => {
    const courant = await hits.etatHit(ctx, H1);
    const neuf = new EsHits(new EsEventStore(new PrismaClient({ datasources: { db: { url: URL_OWNER } } }) as any));
    expect(await neuf.etatHit(ctx, H1)).toEqual(courant);
  });

  it("ES6-03 file des hits reconstructible : le non-qualifié reste DETECTE", async () => {
    const file = await hits.fileHits(ctx);
    expect(file).toHaveLength(2);
    const h2 = file.find((h) => h.hitId === H2)!;
    expect(h2.statut).toBe("DETECTE");
    expect(h2.verdict).toBeUndefined();
    expect(rejouerHit("x", [])).toBeNull();                        // rejeu pur : rien avant la détection
  });

  it("ES6-04 sens unique : ES ne touche pas screening_hits (aucune ligne créée côté monolithe)", async () => {
    const n: any[] = await owner.$queryRaw`
      SELECT count(*)::int AS n FROM screening_hits WHERE tenant_id = ${T}::uuid`;
    expect(n[0].n).toBe(0);                                        // la table du monolithe reste à lui
  });
});
