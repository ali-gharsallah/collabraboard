// Harnais verrou optimiste — LK-01/LK-03 (Bloc A, R336/LK). Autonome (node:assert), déterministe,
// sans DB : délégué Prisma factice + host factice. Le concurrent réel (LK-02) et l'atomicité
// (LK-04) sont prouvés en e2e (optimistic-lock.e2e-spec.ts).
import * as assert from "node:assert/strict";
import { majVersionnee, ConcurrencyConflictError, ConcurrencyConflictFilter } from "./optimistic-lock";

// Délégué factice : `updateMany` gardé (where.version) échoue (count 0) si la version ne colle
// pas ; non-gardé (sans where.version) applique toujours. Compte les appels non-gardés (legacy).
function fakeModel(versionCourante: number) {
  const etat = { v: versionCourante, appelsNonGardes: 0 };
  return {
    etat,
    async updateMany({ where }: any) {
      if (where.version !== undefined) { if (where.version !== etat.v) return { count: 0 }; etat.v++; return { count: 1 }; }
      etat.appelsNonGardes++; etat.v++; return { count: 1 };   // legacy : applique sans garde
    },
  };
}

(async () => {
  let passed = 0; const t = async (nom: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓ " + nom); };
  console.log("OptimisticLock (R336/LK) :");

  await t("LK-01a version à jour → l'update passe sans conflit", async () => {
    const m = fakeModel(5);
    await majVersionnee(m as any, "k1", 5, { status: "X" }, { enforce: true });
    assert.equal(m.etat.v, 6);                                     // version incrémentée
  });

  await t("LK-01b version périmée + enforce ON → ConcurrencyConflictError (jamais d'écrasement)", async () => {
    const m = fakeModel(5);
    await assert.rejects(() => majVersionnee(m as any, "k1", 3, { status: "X" }, { enforce: true }),
      (e: any) => e instanceof ConcurrencyConflictError && e.aggregateId === "k1" && e.expectedVersion === 3);
    assert.equal(m.etat.appelsNonGardes, 0);                       // rien d'appliqué en douce
  });

  await t("LK-01c version périmée + SHADOW (off) → signale le conflit PUIS applique (legacy)", async () => {
    const m = fakeModel(5); let signale = false;
    await majVersionnee(m as any, "k1", 3, { status: "X" }, { enforce: false, onShadowConflict: () => { signale = true; } });
    assert.equal(signale, true);                                   // observation : un conflit AURAIT eu lieu
    assert.equal(m.etat.appelsNonGardes, 1);                       // mais on applique (comportement legacy)
  });

  await t("LK-03 filtre : ConcurrencyConflictError → HTTP 409 typé", async () => {
    const cap: any = {};
    const host: any = { switchToHttp: () => ({ getResponse: () => ({
      status(c: number) { cap.code = c; return this; }, json(b: any) { cap.body = b; return this; } }) }) };
    new ConcurrencyConflictFilter().catch(new ConcurrencyConflictError("kyc-42", 7), host);
    assert.equal(cap.code, 409);
    assert.equal(cap.body.error, "concurrent_modification");
    assert.equal(cap.body.aggregate_id, "kyc-42");
    assert.equal(cap.body.expected_version, 7);
  });

  console.log(`\n### ${passed}/${passed} tests optimistic-lock verts ###`);
})().catch((e) => { console.error(e); process.exit(1); });
