// Test de COMPLÉTUDE de la vague R222–R238 (P-L2-3, gate L2). Greppe chaque identifiant R222..R238
// RÉELLEMENT présent dans les modules propriétaires (businesstrip, formations) et vérifie que chacun
// apparaît dans au moins un titre `it(...)` des specs de câblage de la vague. Un identifiant ajouté au
// code sans test correspondant = ROUGE. R227 est absent du code (0 occurrence) — donc jamais exigé.
//
//   node apps/api/scripts/verifier-couverture-r222-238.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = join(dirname(fileURLToPath(import.meta.url)), "..");
const lire = (rel) => readFileSync(join(API, rel), "utf8");

const MODULES = [
  "src/modules/businesstrip/businesstrip.module.ts",
  "src/modules/formations/formations.module.ts",
];
const SPECS = [
  "src/modules/businesstrip/businesstrip.wiring.spec.ts",
  "src/modules/formations/formations.wiring.spec.ts",
];

const ID = /R2(?:2[2-9]|3[0-8])\b/g;                     // R222..R238
const idsDe = (txt) => new Set(txt.match(ID) ?? []);
// Identifiants cités dans un titre `it('...')` (la preuve d'un cas de test nommé).
function idsDansTitres(txt) {
  const out = new Set();
  const re = /\bit\(\s*'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(txt))) for (const id of (m[1].match(ID) ?? [])) out.add(id);
  return out;
}

const requis = new Set();
for (const f of MODULES) for (const id of idsDe(lire(f))) requis.add(id);
const couverts = new Set();
for (const f of SPECS) for (const id of idsDansTitres(lire(f))) couverts.add(id);

const manquants = [...requis].filter((id) => !couverts.has(id)).sort();
const ok = [...requis].sort();
console.log(`COMPLÉTUDE vague R222–R238 — ${requis.size} identifiants dans le code, ${couverts.size} testés\n`);
console.log(`  requis (modules) : ${ok.join(" ")}`);
console.log(`  R227 : absent du code (0 occurrence) — non exigé`);

if (manquants.length) {
  console.log(`\n✗ COMPLÉTUDE ROUGE — identifiant(s) sans cas de test nommé : ${manquants.join(" ")}`);
  process.exit(1);
}
console.log(`\n✓ chaque identifiant R222–R238 du code a au moins un it() nommé dans les specs de la vague.`);
console.log(`### ${requis.size}/${requis.size} complétude vague R222–R238 verte (L2) ###`);
