// Harnais guide de déploiement — DP-01..05 (guide C.1). Autonome, déterministe. Verrouille la
// doctrine du pipeline ET le no-drift entre pipeline.mjs et docs/DEPLOIEMENT.md.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pipeline } from "./pipeline.mjs";
import { rendre, cheminGuide } from "./generer-guide.mjs";

let passed = 0; const t = (nom, fn) => { fn(); passed++; console.log("  ✓ " + nom); };
console.log("Guide de déploiement (C.1) :");

t("DP-01 phases 0-5 : le pipeline couvre les six phases dans l'ordre", () => {
  assert.deepEqual(pipeline.map((p) => p.n), [0, 1, 2, 3, 4, 5]);
  for (const p of pipeline) assert.ok(p.nom && p.but && p.etapes.length && p.garde, `phase ${p.n} complète`);
});

t("DP-02 prod jamais automatique : la phase 4 (prod) est à déclenchement HUMAIN", () => {
  const prod = pipeline.find((p) => p.n === 4);
  assert.equal(prod.mode, "humain");
  assert.ok(/humain/i.test(prod.garde), "la garde exige une main humaine");
});

t("DP-03 répétition de restauration présente, avec critère bloquant (phase 2)", () => {
  const restore = pipeline.find((p) => p.n === 2);
  assert.ok(/restaur/i.test(restore.nom));
  assert.ok(restore.etapes.some((e) => e.includes("restore-test.sh")), "script de restauration réel référencé");
  assert.ok(/bloqu|RTO/i.test(restore.garde), "prod bloquée si restauration échoue/hors RTO");
});

t("DP-04 contract différé en N+1 (phase 5) — jamais destructif en N", () => {
  const contract = pipeline.find((p) => p.n === 5);
  assert.ok(/contract/i.test(contract.nom) && /N\+1/.test(contract.nom));
  assert.ok(/aucun code ne lise l'ancien/i.test(contract.but), "condition : plus aucun lecteur de l'ancien");
});

t("DP-05 no-drift : docs/DEPLOIEMENT.md est EXACTEMENT le rendu du pipeline (sinon régénérer)", () => {
  const surDisque = readFileSync(cheminGuide, "utf8");
  assert.equal(surDisque, rendre(), "le guide a dérivé du pipeline — lancer generer-guide.mjs et committer");
});

console.log(`\n### ${passed}/${passed} tests deploiement verts ###`);
