/**
 * ES-3 (docs/SURVEILLANCE-ES.md §1) — recette projections + back-testing par rejeu, ES3-01..06.
 *   • ES3-01 projection « file d'alertes » : reconstructible FROM SCRATCH — deux reconstructions
 *     indépendantes strictement identiques (test de rebuild, gate CI) ;
 *   • ES3-02 backtest REPRODUCTIBLE : même entrée = même rapport (le run existant renvoie SON
 *     rapport depuis le stream) ;
 *   • ES3-03 ISOLATION réel/simulé : les AlertesSimulees vivent dans `backtest` seulement — le
 *     stream `alerte` et la file d'alertes n'en voient JAMAIS une ;
 *   • ES3-04 exécution BORNÉE : période > max = refus franc ;
 *   • ES3-05 RECOUVREMENT : concordantes / seulement-simulées / seulement-réelles exacts ;
 *   • ES3-06 GATE PERF : 90 jours de fixtures (2 000 faits) < 60 s en local.
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { EsEventStore } from "../../src/modules/surveillance-es/es-event-store.service";
import { EsAlertes } from "../../src/modules/surveillance-es/alertes.service";
import { EsProjections } from "../../src/modules/surveillance-es/es-projections.service";
import { EsBacktest, STREAM_BACKTEST, EvaluateurScenario } from "../../src/modules/surveillance-es/es-backtest.service";
import { STREAM_FAITS } from "../../src/modules/surveillance-es/es-subscriber.service";
import { TasksService } from "../../src/modules/tasks/tasks.module";
import { AuditService } from "../../src/common/audit.service";

const URL_OWNER = process.env.DATABASE_URL ?? "postgresql://olive:olive@localhost:5433/olive_test";
const J0 = Date.parse("2026-05-01T00:00:00Z");
const iso = (j: number) => new Date(J0 + j * 86_400_000).toISOString();

describe("ES-3 — projections + back-testing par rejeu", () => {
  let owner: PrismaClient; let store: EsEventStore; let alertes: EsAlertes;
  let projections: EsProjections; let backtest: EsBacktest;
  const T = randomUUID(); const ctx = { tenantId: T };
  // Évaluateur INJECTÉ (miroir de scénario, déterministe) : montant >= seuil → alerte.
  const SEUIL = 10_000;
  const evaluateur: EvaluateurScenario = (f) => {
    const m = Number((f.payload as any)?.donnees?.montant ?? 0);
    return { declenche: m >= SEUIL, severite: m >= 50_000 ? "CRITIQUE" : "HAUTE" };
  };
  const CMD = { scenarioId: "SC-SEUIL", scenarioVersion: "v1", config: { seuil: SEUIL },
    du: iso(0), au: iso(90) };

  const semerFait = (c: { tenantId: string }, stream: string, sourceEventId: string, montant: number, jour: number) =>
    store.append(c, STREAM_FAITS, stream,
      [{ type: "fait.tx.flux.importee", sourceEventId,
         payload: { source: { eventId: sourceEventId }, donnees: { refExterne: sourceEventId, montant } },
         at: iso(jour) }],
      0).catch(async () => {                                     // stream déjà ouvert : append en suite
        const seq = await store.derniereSeq(c, STREAM_FAITS, stream);
        return store.append(c, STREAM_FAITS, stream,
          [{ type: "fait.tx.flux.importee", sourceEventId,
             payload: { source: { eventId: sourceEventId }, donnees: { refExterne: sourceEventId, montant } },
             at: iso(jour) }], seq);
      });

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: URL_OWNER } } });
    store = new EsEventStore(owner as any);
    const tasks = new TasksService(owner as any, new AuditService(owner as any), undefined as any);
    alertes = new EsAlertes(store, tasks);
    projections = new EsProjections(store);
    backtest = new EsBacktest(owner as any, store);
  });
  afterAll(async () => { await owner.$disconnect(); });

  it("ES3-01 projection file d'alertes : rebuild from scratch — deux reconstructions identiques", async () => {
    await alertes.lever(ctx, { scenarioId: "SC-A", scenarioVersion: "v1", configRef: "cfg@1",
      severite: "CRITIQUE", faits: [{ sourceEventId: "evt-reel-1" }], parametres: {} });
    const { alerteId: a2 } = await alertes.lever(ctx, { scenarioId: "SC-B", scenarioVersion: "v1",
      configRef: "cfg@1", severite: "MOYENNE", faits: [{ sourceEventId: "evt-reel-2" }], parametres: {} });
    await alertes.assigner(ctx, a2, "compliance-1");
    const now = new Date();
    const file = await projections.fileAlertes(ctx, now);
    expect(file).toHaveLength(2);
    expect(file[0].severite).toBe("CRITIQUE");                   // tri : sévérité d'abord
    expect(file[1]).toMatchObject({ statut: "ASSIGNEE", assigneA: "compliance-1" });
    // Rebuild : instance NEUVE sur connexion NEUVE — identité stricte.
    const neuf = new EsProjections(new EsEventStore(
      new PrismaClient({ datasources: { db: { url: URL_OWNER } } }) as any));
    expect(await neuf.fileAlertes(ctx, now)).toEqual(file);
  });

  it("ES3-04 exécution bornée : période au-delà de la borne = refus franc", async () => {
    await expect(backtest.executerBacktest(ctx, { ...CMD, du: iso(0), au: iso(400) }, evaluateur))
      .rejects.toThrow(/BORNÉE/);
    await expect(backtest.executerBacktest(ctx, { ...CMD, du: iso(10), au: iso(0) }, evaluateur))
      .rejects.toThrow(/période invalide/);
  });

  it("ES3-06 gate perf : backtest de 90 jours (2 000 faits) < 60 s, rapport exact", async () => {
    // 2 000 faits répartis sur 90 jours, dans un seul stream (append par lots de 200).
    const stream = `${T}:tx.flux.importee`;
    let seq = 0; const N = 2000;
    for (let lot = 0; lot < N / 200; lot++) {
      const evs = Array.from({ length: 200 }, (_, k) => {
        const i = lot * 200 + k;
        return { type: "fait.tx.flux.importee", sourceEventId: `bt-${i}`,
          payload: { source: { eventId: `bt-${i}` }, donnees: { refExterne: `bt-${i}`,
            montant: i % 100 === 0 ? 60_000 : i % 10 === 0 ? 15_000 : 500 } },
          at: iso(i % 90) };
      });
      await store.append(ctx, STREAM_FAITS, stream, evs, seq); seq += 200;
    }
    const debut = Date.now();
    const { deja, rapport } = await backtest.executerBacktest(ctx, CMD, evaluateur);
    const duree = Date.now() - debut;
    expect(deja).toBe(false);
    expect(rapport.faitsEvalues).toBe(N);
    expect(rapport.volumeSimule).toBe(200);                      // 20 × 60k (i%100) + 180 × 15k (i%10 sans i%100)
    expect(duree).toBeLessThan(60_000);
    console.log(`[ES3-06] backtest 90 j / ${N} faits : ${duree} ms — rapport ${JSON.stringify(rapport)}`);
  }, 90_000);

  it("ES3-02 reproductible : même entrée = même rapport (run existant relu du stream)", async () => {
    const r1 = await backtest.executerBacktest(ctx, CMD, evaluateur);
    expect(r1.deja).toBe(true);                                  // déjà exécuté en ES3-06
    const r2 = await backtest.executerBacktest(ctx, CMD, evaluateur);
    expect(r2.rapport).toEqual(r1.rapport);
    // Une config DIFFÉRENTE = un run DIFFÉRENT (le runId est le hash de l'entrée).
    const autre = await backtest.executerBacktest(ctx, { ...CMD, config: { seuil: 20_000 } },
      (f) => ({ declenche: Number((f.payload as any)?.donnees?.montant ?? 0) >= 20_000 }));
    expect(autre.deja).toBe(false);
    expect(autre.rapport.runId).not.toBe(r1.rapport.runId);
    expect(autre.rapport.volumeSimule).toBe(20);                 // seuls les 60k passent le seuil 20k
  });

  it("ES3-03 isolation réel/simulé : les simulées vivent dans `backtest`, la file n'en voit aucune", async () => {
    const sim: any[] = await owner.$queryRaw`
      SELECT count(*)::int AS n FROM "es"."events"
      WHERE "tenant_id" = ${T}::uuid AND "stream_type" = ${STREAM_BACKTEST} AND "type" = 'AlerteSimulee'`;
    expect(sim[0].n).toBeGreaterThan(0);
    const reelles: any[] = await owner.$queryRaw`
      SELECT count(*)::int AS n FROM "es"."events"
      WHERE "tenant_id" = ${T}::uuid AND "stream_type" = 'alerte'`;
    expect(reelles[0].n).toBe(3);                                // les 2 levées + 1 assignation d'ES3-01, RIEN d'autre
    expect((await projections.fileAlertes(ctx)).length).toBe(2); // la file ignore structurellement le backtest
  });

  it("ES3-05 recouvrement : concordantes / seulement-simulées / seulement-réelles exacts", async () => {
    const T2 = randomUUID(); const ctx2 = { tenantId: T2 };
    await semerFait(ctx2, `${T2}:tx`, "evt-X", 15_000, 5);             // déclenche ET couvert par une réelle
    await semerFait(ctx2, `${T2}:tx`, "evt-Y", 15_000, 6);             // déclenche, SANS réelle
    await semerFait(ctx2, `${T2}:tx`, "evt-Z", 100, 7);                // ne déclenche pas
    const al = new EsAlertes(store, new TasksService(owner as any, new AuditService(owner as any), undefined as any));
    await al.lever(ctx2, { scenarioId: "SC-SEUIL", scenarioVersion: "v1", configRef: "cfg@1",
      severite: "HAUTE", faits: [{ sourceEventId: "evt-X" }], parametres: {} });
    await al.lever(ctx2, { scenarioId: "SC-SEUIL", scenarioVersion: "v1", configRef: "cfg@1",
      severite: "HAUTE", faits: [{ sourceEventId: "evt-W" }], parametres: {} });   // réelle SANS simulée
    // La fenêtre inclut AUSSI les levées réelles (posées à now) : du J0 à demain (≈ 100 j ≤ borne).
    const { rapport } = await backtest.executerBacktest(ctx2,
      { scenarioId: "SC-SEUIL", scenarioVersion: "v1", config: { seuil: SEUIL },
        du: iso(0), au: new Date(Date.now() + 86_400_000).toISOString() },
      evaluateur);
    expect(rapport).toMatchObject({ faitsEvalues: 3, volumeSimule: 2, volumeReel: 2,
      concordantes: 1, seulementSimulees: 1, seulementReelles: 1 });
  });
});
