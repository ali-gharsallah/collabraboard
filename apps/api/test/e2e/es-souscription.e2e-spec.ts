/**
 * ES-1 (docs/SURVEILLANCE-ES.md §2) — recette du souscripteur outbox, ES1-01..05.
 *   • ES1-01 naissance AU PRÉSENT (R286) : le curseur s'initialise à MAX(id) — l'historique
 *     antérieur n'est jamais rejoué implicitement ;
 *   • ES1-02 consommation nominale : types consommés → FAITS D'ENTRÉE (payload original +
 *     source_event_id), types hors périmètre ignorés, curseur avancé ;
 *   • ES1-03 quarantaine : payload non conforme → stream `quarantine` avec le détail des
 *     erreurs + compteur — le flux CONTINUE (l'événement valide suivant passe) ;
 *   • ES1-04 idempotence : re-livraison (curseur reculé) = no-op, aucun doublon ;
 *   • ES1-05 rattrapage : arrêt/relance (nouvelle instance) au milieu d'un drain par petits
 *     lots — aucun fait perdu, aucun dupliqué.
 * Le gate ES-1 est ES1-05 : « couper/relancer le souscripteur ne perd ni ne duplique ».
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { EsEventStore } from "../../src/modules/surveillance-es/es-event-store.service";
import { EsSubscriber, CONSOMMATEUR_ES, STREAM_FAITS, STREAM_QUARANTAINE, cleFlux }
  from "../../src/modules/surveillance-es/es-subscriber.service";

const URL_OWNER = process.env.DATABASE_URL ?? "postgresql://olive:olive@localhost:5433/olive_test";

describe("ES-1 — souscription outbox → faits d'entrée (anti-corruption, idempotence, rattrapage)", () => {
  let owner: PrismaClient; let store: EsEventStore; let sub: EsSubscriber;
  const T = randomUUID();
  let seqBase = 0n;                                               // curseur de naissance (ES1-01)

  const inserer = async (type: string, payload: unknown, aggregateId = randomUUID()) => {
    const r = await owner.$queryRaw<{ id: bigint }[]>`
      INSERT INTO domain_events (tenant_id, type, aggregate_id, payload, at)
      VALUES (${T}::uuid, ${type}, ${aggregateId}, ${JSON.stringify(payload)}::jsonb, now())
      RETURNING id`;
    return r[0].id;
  };
  const reculerCurseur = (seq: bigint | number) => owner.$executeRaw`
    UPDATE "es"."subscription_cursor" SET "last_seq" = ${seq} WHERE "consumer" = ${CONSOMMATEUR_ES}`;
  const nbFaitsTenant = async () => {
    const r = await owner.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "es"."events"
      WHERE "tenant_id" = ${T}::uuid AND "stream_type" = ${STREAM_FAITS}`;
    return r[0].n;
  };

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: URL_OWNER } } });
    store = new EsEventStore(owner as any);
    sub = new EsSubscriber(owner as any, store);
    // Recette hermétique : le curseur repart du présent pour CE run.
    await owner.$executeRaw`DELETE FROM "es"."subscription_cursor" WHERE "consumer" = ${CONSOMMATEUR_ES}`;
  });
  afterAll(async () => { await owner.$disconnect(); });

  it("ES1-01 naissance AU PRÉSENT : le curseur s'initialise à MAX(id), zéro rejeu implicite", async () => {
    const idAvant = await inserer("kyc.validated", { code: "K-AVANT", validatedBy: "u1" });
    const { lastSeq } = await sub.assurerCurseur();               // création : MAX(id) inclut idAvant
    seqBase = lastSeq;
    expect(lastSeq >= idAvant).toBe(true);
    const bilan = await sub.drainer();
    expect(bilan.faits).toBe(0);                                  // l'historique n'est PAS consommé
    expect(await nbFaitsTenant()).toBe(0);
  });

  it("ES1-02 nominal : consommés → faits (payload original + source), hors périmètre → ignoré", async () => {
    const idTx = await inserer("tx.flux.importee", { refExterne: "TX-1", source: "CB", compte: "CH93-0000", clientId: null });
    await inserer("audit.bruit.quelconque", { peu: "importe" });  // hors périmètre ES
    const idKyc = await inserer("kyc.validated", { code: "K-1", validatedBy: "u2" });
    const bilan = await sub.drainer();
    expect(bilan).toMatchObject({ faits: 2, quarantaine: 0 });
    expect(bilan.ignores).toBeGreaterThanOrEqual(1);
    const faitsTx = await store.read({ tenantId: T }, STREAM_FAITS, cleFlux(T, "tx.flux.importee"));
    expect(faitsTx).toHaveLength(1);
    expect(faitsTx[0].type).toBe("fait.tx.flux.importee");
    expect(faitsTx[0].sourceEventId).toBe(String(idTx));
    expect((faitsTx[0].payload as any).donnees).toEqual({ refExterne: "TX-1", source: "CB", compte: "CH93-0000", clientId: null });
    const faitsKyc = await store.read({ tenantId: T }, STREAM_FAITS, cleFlux(T, "kyc.validated"));
    expect(faitsKyc[0].sourceEventId).toBe(String(idKyc));
    expect((await sub.etat()).nbFaits).toBe(2);
  });

  it("ES1-03 quarantaine : payload non conforme → stream quarantine + compteur, le flux CONTINUE", async () => {
    await inserer("kyc.validated", { codeManquant: true });       // non conforme (code/validatedBy absents)
    await inserer("kyc.validated", { code: "K-2", validatedBy: "u3" });   // conforme, DERRIÈRE le mauvais
    const bilan = await sub.drainer();
    expect(bilan).toMatchObject({ faits: 1, quarantaine: 1 });    // jamais de crash ni de skip silencieux
    const q = await store.read({ tenantId: T }, STREAM_QUARANTAINE, cleFlux(T, "kyc.validated"));
    expect(q).toHaveLength(1);
    expect((q[0].payload as any).erreurs.map((e: any) => e.chemin)).toEqual(
      expect.arrayContaining(["code", "validatedBy"]));
    expect((await sub.etat()).nbQuarantaine).toBe(1);
    expect(await nbFaitsTenant()).toBe(3);                        // K-2 est bien passé
  });

  it("ES1-04 idempotence : re-livraison du même source_event_id = no-op prouvé", async () => {
    const avant = await nbFaitsTenant();
    const etat = await sub.etat();
    await reculerCurseur(seqBase);                                // re-livre TOUS NOS événements (reculer
                                                                  // à 0 rejouerait l'historique d'autres
                                                                  // tenants — le rejeu implicite que R286 interdit)
    const bilan = await sub.drainer();
    expect(bilan.faits).toBe(0);                                  // aucun fait recréé
    expect(bilan.quarantaine).toBe(0);                            // la quarantaine non plus
    expect(await nbFaitsTenant()).toBe(avant);
    expect(Number((await sub.etat()).lastSeq)).toBeGreaterThanOrEqual(Number(etat.lastSeq));
  });

  it("ES1-05 rattrapage (gate) : couper/relancer au milieu d'un drain — rien de perdu, rien de dupliqué", async () => {
    const refs = Array.from({ length: 5 }, (_, i) => `TX-R${i}`);
    for (const ref of refs)
      await inserer("tx.flux.importee", { refExterne: ref, source: "CB", compte: "CH00", clientId: null });
    await sub.drainer(2);                                         // petit lot… puis « coupure »
    const sub2 = new EsSubscriber(owner as any, store);           // relance : NOUVELLE instance, curseur relu
    await sub2.drainer(2);
    await sub2.drainer();                                         // rattrapage complet
    const faits = await store.read({ tenantId: T }, STREAM_FAITS, cleFlux(T, "tx.flux.importee"));
    const vus = faits.map((f) => (f.payload as any).donnees.refExterne).filter((r: string) => r.startsWith("TX-R"));
    expect(vus.sort()).toEqual(refs.sort());                      // aucun perdu…
    expect(new Set(vus).size).toBe(vus.length);                   // …aucun dupliqué
    expect(new Set(faits.map((f) => f.seq)).size).toBe(faits.length);   // séquences uniques du stream
  });
});
