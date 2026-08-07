/**
 * ES-7 (extension série ES — docs/notes/ES-7.md) — décisions PEP PAR REJEU.
 *   • ES7-01 : cycle complet consommé de l'outbox → PROPOSE → PEPISE → LEVE, timeline rejouée ;
 *   • ES7-02 : rejet attribué par la LIAISON cle→personId (rejetee ne porte pas de personId) ;
 *   • ES7-03 : file PEP reconstructible + rebuild from scratch identique + rejeu pur sur vide ;
 *   • ES7-04 : sens unique — ES ne touche pas persons (statut_pep reste l'autorité, ADR-PEP-001).
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { EsEventStore } from "../../src/modules/surveillance-es/es-event-store.service";
import { EsSubscriber, CONSOMMATEUR_ES } from "../../src/modules/surveillance-es/es-subscriber.service";
import { EsPep, rejouerPep } from "../../src/modules/surveillance-es/es-pep.service";

const URL_OWNER = process.env.DATABASE_URL ?? "postgresql://olive:olive@localhost:5433/olive_test";

describe("ES-7 — décisions PEP par rejeu (extension : là où le rejeu est le produit)", () => {
  let owner: PrismaClient; let store: EsEventStore; let sub: EsSubscriber; let pep: EsPep;
  const T = randomUUID(); const ctx = { tenantId: T };
  const P1 = randomUUID(), P2 = randomUUID(), P3 = randomUUID();
  const H1 = randomUUID(), H2 = randomUUID();
  const CLE1 = `pep:${P1}:SDN-9:PEP@2026-08-01`;
  const CLE2 = `pep:${P2}:SDN-7:PEP@2026-08-01`;
  const CLE3 = `pep:${P3}:SDN-5:PEP@2026-08-01`;

  // `at` EXPLICITES et croissants : la chronologie rejouée est celle des faits, pas de l'insertion.
  const inserer = (type: string, aggregateId: string, payload: unknown, at: string) => owner.$executeRaw`
    INSERT INTO domain_events (tenant_id, type, aggregate_id, payload, at)
    VALUES (${T}::uuid, ${type}, ${aggregateId}, ${JSON.stringify(payload)}::jsonb, ${at}::timestamptz)`;

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: URL_OWNER } } });
    store = new EsEventStore(owner as any);
    sub = new EsSubscriber(owner as any, store);
    pep = new EsPep(store);
    await owner.$executeRaw`DELETE FROM "es"."subscription_cursor" WHERE "consumer" = ${CONSOMMATEUR_ES}`;
    await sub.assurerCurseur();                                    // naissance au présent
    // P1 : le hit propose → l'humain PEPise (trace liante) → l'humain lève (R33).
    await inserer("pep.proposition.creee", CLE1, { cle: CLE1, hitId: H1, personId: P1,
      liste: "PEP", listeVersion: "PEP@2026-08-01", score: 91, decomposition: {} }, "2026-08-01T09:00:00Z");
    await inserer("personne.pep.declare", P1, { source: "screening", sourceHitId: H1 }, "2026-08-02T10:00:00Z");
    await inserer("personne.pep.leve", P1, { decideur: "co-senior", sourceHitId: H1 }, "2026-08-05T11:00:00Z");
    // P2 : proposition REJETÉE — le fait de rejet ne porte que la cle (liaison obligatoire).
    await inserer("pep.proposition.creee", CLE2, { cle: CLE2, hitId: H2, personId: P2,
      liste: "PEP", listeVersion: "PEP@2026-08-01", score: 87, decomposition: {} }, "2026-08-01T09:05:00Z");
    await inserer("pep.proposition.rejetee", CLE2, { cle: CLE2, motif: "homonymie établie",
      par: "co-1" }, "2026-08-03T14:00:00Z");
    // P3 : proposition EN ATTENTE de décision humaine (R44 : rien ne bascule tout seul).
    await inserer("pep.proposition.creee", CLE3, { cle: CLE3, hitId: randomUUID(), personId: P3,
      liste: "PEP", listeVersion: "PEP@2026-08-01", score: 82, decomposition: {} }, "2026-08-01T09:10:00Z");
    await sub.drainer();
  });
  afterAll(async () => { await owner.$disconnect(); });

  it("ES7-01 cycle complet par rejeu : PROPOSE → PEPISE → LEVE, timeline et traces exactes", async () => {
    const e = await pep.etatPep(ctx, P1);
    expect(e).toMatchObject({ personId: P1, statut: "LEVE", source: "screening",
      sourceHitId: H1, decideurLevee: "co-senior" });
    expect(e!.propositions).toEqual([{ cle: CLE1, hitId: H1, liste: "PEP",
      listeVersion: "PEP@2026-08-01", score: 91 }]);
    expect(e!.timeline.map((t) => t.type)).toEqual(["fait.pep.proposition.creee",
      "fait.personne.pep.declare", "fait.personne.pep.leve"]);
  });

  it("ES7-02 rejet attribué par la liaison cle→personId (le fait rejetee ne porte pas de personId)", async () => {
    const e = await pep.etatPep(ctx, P2);
    expect(e).toMatchObject({ personId: P2, statut: "REJETE",
      motifRejet: "homonymie établie", rejetePar: "co-1" });
    expect(e!.timeline.map((t) => t.type)).toEqual(["fait.pep.proposition.creee",
      "fait.pep.proposition.rejetee"]);
  });

  it("ES7-03 file PEP reconstructible + rebuild from scratch identique", async () => {
    const file = await pep.filePep(ctx);
    expect(file).toHaveLength(3);
    const p3 = file.find((e) => e.personId === P3)!;
    expect(p3.statut).toBe("PROPOSE");                             // R44 : en attente d'un humain
    expect(p3.motifRejet).toBeUndefined();
    expect(p3.source).toBeUndefined();
    expect(rejouerPep("x", [])).toBeNull();                        // rejeu pur : rien avant un fait
    const neuf = new EsPep(new EsEventStore(new PrismaClient({ datasources: { db: { url: URL_OWNER } } }) as any));
    expect(await neuf.filePep(ctx)).toEqual(file);
  });

  it("ES7-04 sens unique : ES ne touche pas persons — statut_pep reste l'autorité (ADR-PEP-001)", async () => {
    const n: any[] = await owner.$queryRaw`
      SELECT count(*)::int AS n FROM persons WHERE tenant_id = ${T}::uuid`;
    expect(n[0].n).toBe(0);                                        // la table du monolithe reste à lui
  });
});
