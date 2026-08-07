/**
 * ES-0 (docs/SURVEILLANCE-ES.md §2-§3) — recette SQL du socle surveillance-es, ES0-01..06.
 * Les preuves du socle sont PAR NATURE côté base (trigger, contrainte d'unicité, RLS) : elles
 * tournent donc ici, contre le Postgres réel de la suite e2e (CI étape 4) — pas en fakePrisma.
 *   • ES0-01 append/read : aller-retour ordonné par seq, payload intact ;
 *   • ES0-02 verrou optimiste : expectedSeq dépassé = CONFLIT franc (unicité stream/seq) ;
 *   • ES0-03/04 append-only PAR LA BASE : UPDATE puis DELETE échouent sur le TRIGGER
 *     (invariant 1 — pas une convention de code, une erreur Postgres) ;
 *   • ES0-05 RLS : en olive_app SANS GUC → zéro ligne ; AVEC app.tenant_id → son tenant seul ;
 *   • ES0-06 moindre privilège : olive_app ne peut pas muter même en voulant (trigger/droits).
 * NB grants : sur base fraîche, migrate deploy tourne avant prisma:post (le rôle olive_app
 * n'existe pas encore au passage de la migration ES) — la recette ré-applique les grants
 * idempotents ici, comme la migration le fait conditionnellement.
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { EsEventStore } from "../../src/modules/surveillance-es/es-event-store.service";

const URL_OWNER = process.env.DATABASE_URL ?? "postgresql://olive:olive@localhost:5433/olive_test";
const URL_APP = URL_OWNER.replace(/\/\/[^:]+:[^@]+@/, "//olive_app:olive_app@");   // rôle non-owner

describe("ES-0 — socle surveillance-es : store, triggers, RLS (SQL réel)", () => {
  let owner: PrismaClient; let appClient: PrismaClient; let store: EsEventStore;
  const A = randomUUID(), B = randomUUID();
  const STREAM = "alerte"; const S1 = `s1-${randomUUID()}`;

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: URL_OWNER } } });
    // Grants idempotents (cf. en-tête) — l'owner les pose, la migration les pose aussi si le rôle existait.
    await owner.$executeRawUnsafe(`GRANT USAGE ON SCHEMA "es" TO olive_app`);
    await owner.$executeRawUnsafe(`GRANT SELECT, INSERT ON "es"."events" TO olive_app`);
    appClient = new PrismaClient({ datasources: { db: { url: URL_APP } } });
    store = new EsEventStore(owner as any);
  });
  afterAll(async () => { await owner.$disconnect(); await appClient.$disconnect(); });

  it("ES0-01 append/read : aller-retour ordonné par seq, payload intact", async () => {
    await store.append({ tenantId: A }, STREAM, S1, [
      { type: "AlerteLevee", payload: { severite: "HAUTE", scenarioId: "SC-1" } },
      { type: "AlerteAssignee", payload: { a: "compliance-1" } },
    ], 0);
    const suite = await store.append({ tenantId: A }, STREAM, S1,
      [{ type: "AlerteDisposee", payload: { decision: "FAUX_POSITIF", motif: "test" } }], 2);
    expect(suite).toMatchObject({ premierSeq: 3, dernierSeq: 3 });
    const lus = await store.read({ tenantId: A }, STREAM, S1);
    expect(lus.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(lus.map((e) => e.type)).toEqual(["AlerteLevee", "AlerteAssignee", "AlerteDisposee"]);
    expect(lus[0].payload).toEqual({ severite: "HAUTE", scenarioId: "SC-1" });   // jsonb intact
    expect(await store.derniereSeq({ tenantId: A }, STREAM, S1)).toBe(3);
  });

  it("ES0-02 verrou optimiste : expectedSeq dépassé = conflit franc, rien n'est écrasé", async () => {
    await expect(store.append({ tenantId: A }, STREAM, S1,
      [{ type: "AlerteLevee", payload: {} }], 0)).rejects.toThrow(/conflit de séquence/);
    expect((await store.read({ tenantId: A }, STREAM, S1)).length).toBe(3);      // stream intact
  });

  it("ES0-03 append-only PAR LA BASE : un UPDATE échoue sur le trigger", async () => {
    await expect(owner.$executeRawUnsafe(
      `UPDATE "es"."events" SET "type" = 'Falsifie' WHERE "stream_id" = '${S1}'`,
    )).rejects.toThrow(/append-only/);
  });

  it("ES0-04 append-only PAR LA BASE : un DELETE échoue sur le trigger", async () => {
    await expect(owner.$executeRawUnsafe(
      `DELETE FROM "es"."events" WHERE "stream_id" = '${S1}'`,
    )).rejects.toThrow(/append-only/);
  });

  it("ES0-05 RLS : en olive_app SANS GUC zéro ligne ; AVEC le GUC, son tenant seulement", async () => {
    await store.append({ tenantId: B }, STREAM, `s-b-${randomUUID()}`,
      [{ type: "AlerteLevee", payload: { t: "B" } }], 0);
    const sans = await appClient.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "es"."events"`);
    expect(sans[0].n).toBe(0);                                                   // aucune fuite sans GUC
    const avec = await appClient.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${A}', true)`);
      return tx.$queryRawUnsafe<{ n: number; autres: number }[]>(
        `SELECT count(*)::int AS n, count(*) FILTER (WHERE "tenant_id" <> '${A}'::uuid)::int AS autres
         FROM "es"."events"`);
    });
    expect(avec[0].n).toBeGreaterThanOrEqual(3);                                 // ses événements
    expect(avec[0].autres).toBe(0);                                              // jamais ceux de B
  });

  it("ES0-06 moindre privilège : olive_app ne peut pas muter, même sous son propre tenant", async () => {
    await expect(appClient.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${A}', true)`);
      await tx.$executeRawUnsafe(`UPDATE "es"."events" SET "type" = 'x' WHERE "tenant_id" = '${A}'::uuid`);
    })).rejects.toThrow(/append-only|denied|permission/i);
  });
});
