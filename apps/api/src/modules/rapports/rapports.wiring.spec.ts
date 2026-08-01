// R50 — exports réglementaires (RP-01..04). Autonome (node:assert), sans DB. Port fidèle des
// rapport_* de domain.py : dérogations (journal), PEP (personnes statut_pep), hits (screening),
// retards de recertification (review_deadlines PLANIFIEE en retard). Scope tenant vérifié.
import * as assert from "node:assert/strict";
import { RapportsService } from "./rapports.module";

function fake(db: any = {}) {
  return {
    domainEvent: { findMany: async ({ where }: any) => (db.events ?? []).filter((e: any) =>
      e.tenantId === where.tenantId && (!where.type?.contains || String(e.type).includes(where.type.contains))) },
    person: { findMany: async ({ where }: any) => (db.persons ?? []).filter((p: any) =>
      p.tenantId === where.tenantId && p.statutPep === true) },
    screeningHit: { findMany: async ({ where }: any) => (db.hits ?? []).filter((h: any) => h.tenantId === where.tenantId) },
    reviewDeadline: { findMany: async ({ where }: any) => (db.deadlines ?? []).filter((d: any) =>
      d.tenantId === where.tenantId && d.statut === "PLANIFIEE" && new Date(d.dueDate) < where.dueDate.lt) },
  } as any;
}
const svc = (db: any) => new RapportsService(fake(db));
const T = "t1";
const ctx = { tenantId: T, userId: "u", role: "CO_SR" };

(async () => {
  let passed = 0;
  const t = async (nom: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓ " + nom); };
  console.log("Rapports R50 (RP-01..04) :");

  await t("RP-01 dérogations : le journal filtre les événements de dérogation, scope tenant", async () => {
    const s = svc({ events: [
      { tenantId: T, id: 2, type: "xb.derogation.visee", aggregateId: "C1", payload: { par: "sel" }, at: "2026-07-01" },
      { tenantId: T, id: 1, type: "kyc.validated", aggregateId: "K1", payload: {}, at: "2026-07-01" },
      { tenantId: "autre", id: 3, type: "xb.derogation.visee", aggregateId: "C9", payload: {}, at: "2026-07-01" }] });
    const r = await s.derogations(ctx);
    assert.equal(r.length, 1);
    assert.equal(r[0].decideur, "sel");
    assert.equal(r[0].type, "xb.derogation.visee");
  });

  await t("RP-02 PEP : ne liste QUE les personnes au statut PEP", async () => {
    const s = svc({ persons: [
      { tenantId: T, id: "P1", nom: "Alpha", statutPep: true, finMandatPep: null },
      { tenantId: T, id: "P2", nom: "Beta", statutPep: false, finMandatPep: null }] });
    const r = await s.pep(ctx);
    assert.equal(r.length, 1);
    assert.equal(r[0].personne, "P1");
    assert.equal(r[0].statut, "PEP");
  });

  await t("RP-03 hits : liste des hits de screening et leur traitement", async () => {
    const s = svc({ hits: [
      { tenantId: T, id: "H1", clientId: "C1", statut: "QUALIFIE", score: 90, listeVersion: "v1" },
      { tenantId: "autre", id: "H9", clientId: "C9", statut: "BRUT", score: 10, listeVersion: "v1" }] });
    const r = await s.hits(ctx);
    assert.equal(r.length, 1);
    assert.equal(r[0].hit, "H1");
    assert.equal(r[0].etat, "QUALIFIE");
  });

  await t("RP-04 retards recertification : seules les échéances PLANIFIEE dépassées ressortent", async () => {
    const now = new Date("2026-08-01");
    const s = svc({ deadlines: [
      { tenantId: T, id: "D1", clientId: "C1", dueDate: "2026-06-01", ddlLevel: "CDD", statut: "PLANIFIEE" },  // en retard
      { tenantId: T, id: "D2", clientId: "C2", dueDate: "2026-12-01", ddlLevel: "CDD", statut: "PLANIFIEE" },  // future
      { tenantId: T, id: "D3", clientId: "C3", dueDate: "2026-06-01", ddlLevel: "CDD", statut: "REALISEE" }] });  // close
    const r = await s.retardsRecertification(ctx, 0, now);
    assert.equal(r.length, 1);
    assert.equal(r[0].deadline, "D1");
  });

  console.log(`\n### ${passed}/${passed} tests rapports R50 verts ###`);
})().catch((e) => { console.error(e); process.exit(1); });
