/**
 * ES-2 (docs/SURVEILLANCE-ES.md §3, invariants 2-4) — recette de l'agrégat Alerte, ES2-01..06.
 *   • ES2-01 cycle de vie complet PAR REJEU : lever (evidence figée d'abord) → assigner →
 *     disposer — l'état est à chaque pas la fonction du stream, aucune table d'état ;
 *   • ES2-02 rebuild-from-scratch (gate CI) : reconstruction TOTALE depuis le store par une
 *     instance neuve → état strictement identique ;
 *   • ES2-03 evidence IMMUABLE : le snapshot ne bouge pas quand des faits ultérieurs arrivent ;
 *   • ES2-04 transitions refusées throw-first : double disposition, assignation après
 *     disposition, motif absent (R7), décision inconnue ;
 *   • ES2-05 proposition émise et TRACÉE : VRAI_POSITIF → tâche compliance par l'API existante
 *     (compte de service surveillance-es@1) + PropositionEmise au stream — R44 : rien d'exécuté ;
 *   • ES2-06 frontière (gate) : zéro import d'écriture vers les modules métier du monolithe —
 *     le SEUL canal sortant est TasksService (proposition R239).
 */
import { randomUUID } from "crypto";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { EsEventStore } from "../../src/modules/surveillance-es/es-event-store.service";
import { EsAlertes, ACTEUR_ES, STREAM_ALERTE, STREAM_EVIDENCE } from "../../src/modules/surveillance-es/alertes.service";
import { rejouer } from "../../src/modules/surveillance-es/alerte.aggregate";
import { TasksService } from "../../src/modules/tasks/tasks.module";
import { AuditService } from "../../src/common/audit.service";

const URL_OWNER = process.env.DATABASE_URL ?? "postgresql://olive:olive@localhost:5433/olive_test";

describe("ES-2 — agrégat Alerte event-sourcé + evidence figée (rejeu = vérité)", () => {
  let owner: PrismaClient; let store: EsEventStore; let alertes: EsAlertes; let tasks: TasksService;
  const T = randomUUID(); const ctx = { tenantId: T };
  const FAITS = [{ type: "fait.tx.flux.importee", seq: 1, donnees: { refExterne: "TX-9", compte: "CH00" } }];
  const PARAMS = { seuilMontant: 10_000, fenetreJours: 30 };
  let alerteId: string; let evidenceRef: any;

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: URL_OWNER } } });
    store = new EsEventStore(owner as any);
    tasks = new TasksService(owner as any, new AuditService(owner as any), undefined as any);
    alertes = new EsAlertes(store, tasks);
  });
  afterAll(async () => { await owner.$disconnect(); });

  it("ES2-01 cycle de vie PAR REJEU : lever → assigner → disposer, l'état est le stream", async () => {
    ({ alerteId, evidenceRef } = await alertes.lever(ctx, { scenarioId: "SC-STRUCTURATION",
      scenarioVersion: "v3", configRef: "cfg@2026-08-01", severite: "HAUTE",
      faits: FAITS, parametres: PARAMS }));
    expect(evidenceRef).toMatchObject({ streamType: STREAM_EVIDENCE, streamId: alerteId, seq: 1 });
    let etat = await alertes.etat(ctx, alerteId);
    expect(etat).toMatchObject({ statut: "LEVEE", scenarioId: "SC-STRUCTURATION",
      scenarioVersion: "v3", severite: "HAUTE", evidenceRef, version: 1 });
    etat = await alertes.assigner(ctx, alerteId, "compliance-1");
    expect(etat).toMatchObject({ statut: "ASSIGNEE", assigneA: "compliance-1", version: 2 });
    etat = await alertes.disposer(ctx, alerteId, { decision: "FAUX_POSITIF", motif: "homonymie établie", par: "compliance-1" });
    expect(etat).toMatchObject({ statut: "DISPOSEE", decision: "FAUX_POSITIF",
      motif: "homonymie établie", disposeePar: "compliance-1", version: 3 });
  });

  it("ES2-02 rebuild-from-scratch (gate) : instance NEUVE, reconstruction totale, état identique", async () => {
    const etatCourant = await alertes.etat(ctx, alerteId);
    const storeNeuf = new EsEventStore(new PrismaClient({ datasources: { db: { url: URL_OWNER } } }) as any);
    const rebuild = rejouer(alerteId, await storeNeuf.read(ctx, STREAM_ALERTE, alerteId));
    expect(rebuild).toEqual(etatCourant);                          // identité STRICTE après rebuild
    expect(rebuild!.statut).toBe("DISPOSEE");
  });

  it("ES2-03 evidence IMMUABLE : le snapshot ne bouge pas quand les faits ultérieurs arrivent", async () => {
    const avant = await alertes.evidence(ctx, evidenceRef);
    expect((avant!.payload as any).faits).toEqual(FAITS);
    // Des faits ultérieurs arrivent (le monde continue) — dans le MÊME stream d'evidence aussi.
    await store.append(ctx, STREAM_EVIDENCE, alerteId,
      [{ type: "NoteUlterieure", payload: { note: "fait postérieur, ne doit PAS altérer le snapshot" } }], 1);
    const apres = await alertes.evidence(ctx, evidenceRef);
    expect(apres).toEqual(avant);                                  // la ref pointe le même seq, intact
    expect((apres!.payload as any).parametres).toEqual(PARAMS);    // paramètres du scénario À DATE
  });

  it("ES2-04 transitions refusées throw-first (l'ordre des gardes est contractuel)", async () => {
    await expect(alertes.disposer(ctx, alerteId, { decision: "FAUX_POSITIF", motif: "encore", par: "x" }))
      .rejects.toThrow(/déjà disposée/);
    await expect(alertes.assigner(ctx, alerteId, "autre"))
      .rejects.toThrow(/déjà disposée/);
    const { alerteId: a2 } = await alertes.lever(ctx, { scenarioId: "SC-2", scenarioVersion: "v1",
      configRef: "cfg@2026-08-01", severite: "MOYENNE", faits: FAITS, parametres: PARAMS });
    await expect(alertes.disposer(ctx, a2, { decision: "VRAI_POSITIF", motif: "  ", par: "x" }))
      .rejects.toThrow(/R7 : motif requis/);
    await expect(alertes.disposer(ctx, a2, { decision: "PEUT_ETRE", motif: "m", par: "x" }))
      .rejects.toThrow(/decision inconnue/);
  });

  it("ES2-05 proposition émise et TRACÉE : VRAI_POSITIF → tâche compliance (compte de service) + PropositionEmise", async () => {
    const { alerteId: a3 } = await alertes.lever(ctx, { scenarioId: "SC-3", scenarioVersion: "v2",
      configRef: "cfg@2026-08-01", severite: "CRITIQUE", faits: FAITS, parametres: PARAMS });
    const etat = await alertes.disposer(ctx, a3, { decision: "VRAI_POSITIF", motif: "structuration avérée", par: "compliance-2" });
    expect(etat!.propositions).toHaveLength(1);
    const prop = etat!.propositions[0];
    expect(prop).toMatchObject({ via: "tasks.creerDepuisEvenement", acteur: ACTEUR_ES, decision: "VRAI_POSITIF" });
    const tache: any[] = await owner.$queryRaw`
      SELECT * FROM tasks WHERE tenant_id = ${T}::uuid AND id = ${prop.taskId}::uuid`;
    expect(tache).toHaveLength(1);                                 // la tâche EXISTE côté monolithe…
    expect(tache[0]).toMatchObject({ type: "REVUE_ALERTE_SURVEILLANCE", statut: "OUVERTE",
      origine: `surveillance-es:alerte:${a3}` });                  // …OUVERTE : rien n'est exécuté (R44)
    const evs: any[] = await owner.$queryRaw`
      SELECT type, payload FROM domain_events WHERE tenant_id = ${T}::uuid AND type = 'task.created'`;
    expect(evs.some((e) => e.payload?.origine === `surveillance-es:alerte:${a3}`)).toBe(true);
  });

  it("ES2-06 frontière (gate) : zéro import d'écriture vers les modules métier du monolithe", () => {
    const dir = join(__dirname, "..", "..", "src", "modules", "surveillance-es");
    const sources = readdirSync(dir, { recursive: true } as any)
      .map(String).filter((f) => f.endsWith(".ts"))
      .map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
    // Modules à ÉTAT MÉTIER du monolithe : aucun import — ES ne les touche jamais directement.
    expect(sources).not.toMatch(
      /from "\.\.\/(screening|aml|riskcases|mros|personnes|kyc|transactions|clients|onboarding)\//);
    // Le SEUL canal sortant : l'API de proposition (tasks, R239) — et rien d'autre.
    expect(sources).toMatch(/from "\.\.\/tasks\/tasks\.module"/);
  });
});
