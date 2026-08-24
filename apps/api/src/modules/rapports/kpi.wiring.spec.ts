// Harnais P-L8-2 — KPI conformité (KP-01..05). Autonome, fakePrisma — tables RÉELLES simulées.
import * as assert from "node:assert/strict";
import { KpiService, p90, bornesTrimestre } from "./kpi.service";

let passed = 0; const t = async (nom: string, fn: () => Promise<void> | void) => { await fn(); passed++; console.log("  ✓ " + nom); };
const T = "44444444-4444-4444-8444-444444444444"; const ctx = { tenantId: T };
const NOW = new Date("2026-08-07T12:00:00Z");

const fake = (tables: Record<string, any[]>) => {
  const t2 = (n: string) => ({ findMany: async ({ where }: any) =>
    tables[n].filter((r) => r.tenantId === where.tenantId) });
  return { screeningHit: t2("hits"), screeningQualification: t2("quals"),
    riskCase: t2("cases"), mrosCommunication: t2("mros") } as any;
};
const H = (id: string, at: string, statut: string, listeVersion = "SECO@v1") =>
  ({ id, tenantId: T, at, statut, listeVersion });
const Q = (hitId: string, at: string, verdict: string, par: string) =>
  ({ id: `q-${hitId}`, tenantId: T, hitId, at, verdict, par });

const svc = new KpiService(fake({
  hits: [H("H1", "2026-07-01T00:00:00Z", "QUALIFIE"), H("H2", "2026-07-01T00:00:00Z", "QUALIFIE"),
    H("H3", "2026-07-28T12:00:00Z", "BRUT"), H("H4", "2026-01-05T00:00:00Z", "BRUT")],   // H4 HORS période
  quals: [Q("H1", "2026-07-02T00:00:00Z", "FAUX_POSITIF", "co-1"),                        // âge 1 j
    Q("H2", "2026-07-11T00:00:00Z", "VRAI_POSITIF", "co-2")],                             // âge 10 j
  cases: [{ id: "RC1", tenantId: T, statut: "NOUVELLE", etatDepuis: "2026-07-05T00:00:00Z" },
    { id: "RC2", tenantId: T, statut: "EN_COURS", etatDepuis: "2026-07-06T00:00:00Z" }],
  mros: [{ id: "M1", tenantId: T, decision: "DECLARER", decideAt: "2026-07-10T00:00:00Z" },
    { id: "M2", tenantId: T, decision: "NE_PAS_DECLARER", decideAt: "2026-07-12T00:00:00Z" }],
}) as any);
const PERIODE = { du: "2026-07-01T00:00:00Z", au: "2026-10-01T00:00:00Z" };

(async () => {
console.log("KPI conformité (P-L8-2, KP) :");

await t("KP-01 volumes par statut/liste/verdict — la période FILTRE (H4 exclu)", async () => {
  const k = await svc.conformite(ctx, PERIODE, NOW);
  assert.deepEqual(k.screening.volumes, { total: 3, QUALIFIE: 2, BRUT: 1 });
  assert.deepEqual(k.screening.verdicts, { FAUX_POSITIF: 1, VRAI_POSITIF: 1 });
  assert.deepEqual(k.riskCases.volumes, { total: 2, NOUVELLE: 1, EN_COURS: 1 });
  assert.deepEqual(k.mros.volumes, { total: 2, DECLARER: 1, NE_PAS_DECLARER: 1 });
});

await t("KP-02 âge : détection→qualification (1 j, 10 j) + BRUT→now (10 j) — moyenne et P90 exacts", async () => {
  const k = await svc.conformite(ctx, PERIODE, NOW);
  assert.equal(k.screening.ageMoyenJours, 7);                     // (1 + 10 + 10) / 3
  assert.equal(k.screening.ageP90Jours, 10);
  assert.equal(p90([1, 2, 3, 4, 5, 6, 7, 8, 9, 100]), 9);        // P90 ordinal, pas la moyenne
});

await t("KP-03 conversion et charge : définitions AFFICHÉES avec les chiffres", async () => {
  const k = await svc.conformite(ctx, PERIODE, NOW);
  assert.equal(k.mros.conversionAlerteDeclaration, 0.5);          // 1 DECLARER / 2 cases
  assert.deepEqual(k.chargeParAnalyste, { "co-1": 1, "co-2": 1 });
  assert.ok(k.definitions.conversion.includes("DECLARER"));
});

await t("KP-04 trimestriel : bornes civiles exactes + CSV plat exportable", async () => {
  assert.deepEqual(bornesTrimestre(2026, 3), { du: "2026-07-01T00:00:00.000Z", au: "2026-10-01T00:00:00.000Z" });
  const r = await svc.trimestriel(ctx, 2026, 3, NOW);
  assert.equal(r.trimestre, "2026-T3");
  assert.ok(r.csv.startsWith("indicateur;valeur"));
  assert.ok(r.csv.includes("screening.volumes.total;3"));
  assert.ok(r.csv.includes("chargeParAnalyste.co-1;1"));
});

await t("KP-05 gardes : période invalide et trimestre hors 1..4 refusés", async () => {
  await assert.rejects(svc.conformite(ctx, { du: "2026-08-01", au: "2026-07-01" }, NOW), /du < au/);
  assert.throws(() => bornesTrimestre(2026, 5 as any), /trimestre/);
});

console.log(`\n### ${passed}/${passed} specs KPI P-L8-2 verts ###`);
})().catch((e) => { console.error(e); process.exit(1); });
