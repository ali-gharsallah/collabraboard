// Harnais FeatureFlags — RB-01..05 (Bloc 0 robustesse, R335/RB). Autonome (node:assert),
// déterministe : on injecte un env, jamais process.env réel. Défaut = comportement LEGACY
// (tous les flags OFF) — l'activation est un acte explicite, bloc par bloc.
import * as assert from "node:assert/strict";
import { FLAGS_ROBUSTESSE, flagActif, snapshotFlags } from "./feature-flags";

let passed = 0; const t = (nom: string, fn: () => void) => { fn(); passed++; console.log("  ✓ " + nom); };
console.log("FeatureFlags (R335/RB) :");

t("RB-01 défaut LEGACY : env vide → chaque flag est OFF (aucune bascule implicite)", () => {
  for (const f of FLAGS_ROBUSTESSE) assert.equal(flagActif(f, {}), false, `${f} doit être OFF par défaut`);
});

t("RB-02 activation explicite : on/1/true (insensible à la casse) → ON ; off/absent → OFF", () => {
  for (const v of ["on", "ON", "1", "true", "TRUE"]) assert.equal(flagActif("FF_IDEMPOTENCY", { FF_IDEMPOTENCY: v }), true, `valeur ${v}`);
  for (const v of ["off", "0", "false", "", "oui", "nope"]) assert.equal(flagActif("FF_IDEMPOTENCY", { FF_IDEMPOTENCY: v }), false, `valeur ${v}`);
});

t("RB-03 registre COMPLET : exactement les 4 flags des blocs A/B/C/D", () => {
  assert.deepEqual([...FLAGS_ROBUSTESSE].sort(),
    ["FF_IDEMPOTENCY", "FF_OPTIMISTIC_LOCKING", "FF_READ_FROM_PROJECTIONS", "FF_RLS_ENFORCED"].sort());
});

t("RB-04 snapshot : image lisible des 4 flags pour un env donné (observabilité)", () => {
  const snap = snapshotFlags({ FF_OPTIMISTIC_LOCKING: "on", FF_RLS_ENFORCED: "1" });
  assert.equal(snap.FF_OPTIMISTIC_LOCKING, true);
  assert.equal(snap.FF_RLS_ENFORCED, true);
  assert.equal(snap.FF_IDEMPOTENCY, false);
  assert.equal(snap.FF_READ_FROM_PROJECTIONS, false);
  assert.equal(Object.keys(snap).length, 4);
});

t("RB-05 isolation : lire process.env par défaut ne jette pas (intégration Nest)", () => {
  assert.equal(typeof flagActif("FF_RLS_ENFORCED"), "boolean");   // sans 2e arg → process.env
});

console.log(`\n### ${passed}/${passed} tests feature-flags verts ###`);
