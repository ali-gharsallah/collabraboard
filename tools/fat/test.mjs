// Harnais FAT — FB-01..04 (R332). Autonome (Node natif), déterministe. Vérifie que la suite
// FAT est GÉNÉRÉE et ADOSSÉE au réel : aucune traçabilité fictive, DEMO-SCRIPT en parcours.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parcours } from "./parcours.mjs";
import { tracer, ecrireMatrice } from "./tracer.mjs";

let passed = 0; const t = (nom, fn) => { fn(); passed++; console.log("  ✓ " + nom); };
console.log("FAT (R332/FB) :");

t("FB-01 catalogue : chaque parcours déclare scénarios, règles et rôle de jeton", () => {
  assert.ok(parcours.length >= 5, "au moins 5 parcours métier");
  for (const p of parcours) {
    assert.ok(p.id && p.nom && p.jetonRole, `${p.id} : identité complète`);
    assert.ok(Array.isArray(p.scenarios) && p.scenarios.length, `${p.id} : scénarios`);
    assert.ok(Array.isArray(p.regles) && p.regles.length, `${p.id} : règles`);
  }
});

t("FB-02 anti-fiction : chaque scénario déclaré est ADOSSÉ à un test e2e réel, chaque règle au canon", () => {
  const { orphelinsScenarios, orphelinsRegles } = tracer();
  assert.deepEqual(orphelinsScenarios, [], `scénarios non adossés : ${orphelinsScenarios.join(", ")}`);
  assert.deepEqual(orphelinsRegles, [], `règles inexistantes : ${orphelinsRegles.join(", ")}`);
});

t("FB-03 traçabilité GÉNÉRÉE : la matrice parcours→scénario→règle est écrite (pas à la main)", () => {
  const chemin = ecrireMatrice("2026-07-29");
  assert.ok(chemin.endsWith("FAT-TRACABILITE.md"));
  const contenu = readFileSync(chemin, "utf8");
  for (const p of parcours) assert.ok(contenu.includes(p.id), `matrice contient ${p.id}`);
  assert.ok(contenu.includes("générée") && contenu.includes("ne pas éditer à la main"));
});

t("FB-04 DEMO-SCRIPT est un parcours FAT (la démo est recette, sans voie spéciale — R329)", () => {
  const demo = parcours.find((p) => p.id === "PARC-DEMO");
  assert.ok(demo, "PARC-DEMO présent au catalogue");
  assert.ok(demo.e2e === "fat-cloture-demo", "adossé à la suite e2e de démo");
  assert.ok(demo.scenarios.includes("DM-01"), "DM-01 dans le parcours démo");
});

console.log(`\n### ${passed}/${passed} tests fat verts ###`);
