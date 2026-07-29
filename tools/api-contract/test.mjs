// Harnais surface API — RB-06..07 (Bloc 0). Détecte toute DÉRIVE de contrat : la surface
// courante (scan des contrôleurs) doit être identique au snapshot committé. Un changement de
// route (ajout/retrait/renommage) devient ainsi VOLONTAIRE (régénérer + committer), jamais
// accidentel. Autonome (Node natif), déterministe, sans booter Nest.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scannerRoutes } from "./scan.mjs";

const ici = dirname(fileURLToPath(import.meta.url));
const snapshot = readFileSync(join(ici, "api-surface.snapshot.txt"), "utf8").split("\n").filter(Boolean);
const courant = scannerRoutes();

let passed = 0; const t = (nom, fn) => { fn(); passed++; console.log("  ✓ " + nom); };
console.log("Surface API (R335/RB) :");

t("RB-06 couverture : la surface a un plancher plausible (≥ 300 routes) et les sondes publiques", () => {
  assert.ok(courant.length >= 300, `surface ${courant.length} < 300`);
  for (const sonde of ["GET    /v1/healthz", "GET    /v1/readyz", "GET    /v1/.well-known/jwks.json"])
    assert.ok(courant.includes(sonde), `sonde publique manquante : ${sonde}`);
});

t("RB-07 no-drift : la surface courante == snapshot committé (sinon régénérer + committer)", () => {
  const enTrop = courant.filter((r) => !snapshot.includes(r));
  const manquantes = snapshot.filter((r) => !courant.includes(r));
  assert.deepEqual(enTrop, [], `routes NOUVELLES non snapshotées :\n  ${enTrop.join("\n  ")}\n→ node tools/api-contract/scan.mjs > tools/api-contract/api-surface.snapshot.txt`);
  assert.deepEqual(manquantes, [], `routes DISPARUES du snapshot :\n  ${manquantes.join("\n  ")}\n→ changement de contrat : régénérer + committer si volontaire`);
});

console.log(`\n### ${passed}/${passed} tests surface-api verts ###`);
