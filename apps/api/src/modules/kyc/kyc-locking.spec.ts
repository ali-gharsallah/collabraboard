// Verrou optimiste — LOT 1 adopté (R336/LK). Autonome (node:assert), déterministe, sans DB.
// Prouve que les deux agrégats adoptés (KycFile, KycVisa) sont gardés par la version via
// majVersionnee(enforce:true) — le mode STRICT du lot 1 — et, surtout, la DOUBLE VALIDATION
// VISA SIMULTANÉE : deux porteurs du même rôle signant la même section → l'un réussit, l'autre
// reçoit un conflit (jamais d'écrasement silencieux d'un visa four-eyes). Le concurrent RÉEL en
// base (deux transactions) est prouvé en e2e (optimistic-lock.e2e-spec.ts, LK-VISA-02).
import * as assert from "node:assert/strict";
import { majVersionnee, ConcurrencyConflictError } from "../../common/optimistic-lock";

// Délégué Prisma factice partagé par KycFile / KycVisa : `updateMany` gardé (where.version)
// échoue (count 0) si la version ne colle pas, sinon incrémente. Reproduit exactement le
// compare-and-set SQL `UPDATE … WHERE id AND version = :v` (version++).
function fakeDelegate(versionCourante: number, id = "agg-1") {
  const etat = { v: versionCourante };
  return {
    etat,
    async updateMany({ where, data }: any) {
      if (where.id !== id) return { count: 0 };
      if (where.version !== undefined && where.version !== etat.v) return { count: 0 };
      etat.v++; void data; return { count: 1 };
    },
  };
}

(async () => {
  let passed = 0;
  const t = async (nom: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓ " + nom); };
  console.log("KYC verrou optimiste — lot 1 (R336/LK) :");

  await t("LK-KYCFILE : validation finale, version à jour → passe (version++)", async () => {
    const kyc = fakeDelegate(0, "kyc-1");
    await majVersionnee(kyc as any, "kyc-1", 0, { status: "VALIDATED" }, { enforce: true });
    assert.equal(kyc.etat.v, 1);
  });

  await t("LK-KYCFILE : validation avec version périmée → 409 (jamais d'écrasement du dossier)", async () => {
    const kyc = fakeDelegate(3, "kyc-1");
    await assert.rejects(
      () => majVersionnee(kyc as any, "kyc-1", 1, { status: "VALIDATED" }, { enforce: true }),
      (e: any) => e instanceof ConcurrencyConflictError && e.aggregateId === "kyc-1" && e.expectedVersion === 1);
    assert.equal(kyc.etat.v, 3);                                   // dossier inchangé
  });

  await t("LK-KYCVISA : signature d'un visa, version à jour → passe (version++)", async () => {
    const visa = fakeDelegate(0, "visa-1");
    await majVersionnee(visa as any, "visa-1", 0, { status: "SIGNED", signedBy: "co.senior" }, { enforce: true });
    assert.equal(visa.etat.v, 1);
  });

  await t("LK-VISA double validation SIMULTANÉE : deux signataires même version → un OK, un 409", async () => {
    // Les deux acteurs ont LU le même visa PENDING (version 0) : signature four-eyes concurrente.
    const visa = fakeDelegate(0, "visa-42");
    // Le premier signataire l'emporte (version 0 → 1).
    await majVersionnee(visa as any, "visa-42", 0,
      { status: "SIGNED", signedBy: "premier", verdict: "OK" }, { enforce: true });
    assert.equal(visa.etat.v, 1);
    // Le second, parti de la MÊME version 0 périmée, est REFUSÉ — jamais d'écrasement du signataire.
    await assert.rejects(
      () => majVersionnee(visa as any, "visa-42", 0,
        { status: "SIGNED", signedBy: "second", verdict: "NOK" }, { enforce: true }),
      (e: any) => e instanceof ConcurrencyConflictError && e.aggregateId === "visa-42");
    assert.equal(visa.etat.v, 1);                                  // la signature du premier tient
  });

  await t("LK expand : If-Match absent → repli sur la version courante, la signature passe", async () => {
    // Rollout expand : un client legacy sans If-Match adopte la version courante (visa.version) —
    // le service passe expectedVersion = version lue ; en l'absence de concurrent, ça réussit.
    const visa = fakeDelegate(7, "visa-9");
    await majVersionnee(visa as any, "visa-9", 7 /* = visa.version courant */,
      { status: "SIGNED" }, { enforce: true });
    assert.equal(visa.etat.v, 8);
  });

  console.log(`\n### ${passed}/${passed} tests kyc-locking (lot 1) verts ###`);
})().catch((e) => { console.error(e); process.exit(1); });
