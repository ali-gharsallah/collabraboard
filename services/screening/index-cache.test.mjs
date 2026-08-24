/**
 * PERF — mémoïsation de l'index trigramme (sous R409). Le rescreening répété d'un portefeuille contre
 * la MÊME version de liste ne doit plus reconstruire l'index. Prouve : (a) réutilisation (même objet
 * index rendu pour la même clé + liste inchangée), (b) gain de temps réel, (c) invalidation si la
 * liste change, (d) purge explicite. L'index ne porte que des données de LISTE (jamais tenant).
 *
 *   node services/screening/index-cache.test.mjs
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ingererListe, construireIndex, construireIndexCache, viderIndexCache } from "@olive/screening-engine";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const san = JSON.parse(readFileSync(join(DIR, "sanctions-synth.json"), "utf8"));
const entries = ingererListe(san.entries);

let echecs = [];
const check = (cond, msg) => { if (!cond) echecs.push(msg); };
console.log(`INDEX-CACHE — ${entries.length} entrées de liste\n`);

viderIndexCache();

// 1) Réutilisation : deux appels, même clé + liste inchangée → LE MÊME objet index (pas de rebuild).
const a = construireIndexCache("SECO@2026-07-15", entries);
const b = construireIndexCache("SECO@2026-07-15", entries);
console.log(`1. réutilisation : même objet index rendu = ${a === b}`);
check(a === b, "l'index n'est pas réutilisé pour la même clé (rebuild inutile)");

// 2) Gain de temps : 200 rescreenings « chargent » l'index ; caché ≪ reconstructions à froid.
let t0 = Date.now();
for (let i = 0; i < 200; i++) construireIndexCache("SECO@2026-07-15", entries);
const msCache = Date.now() - t0;
t0 = Date.now();
for (let i = 0; i < 200; i++) construireIndex(entries);
const msFroid = Date.now() - t0;
console.log(`2. perf         200× caché ${msCache} ms · 200× à froid ${msFroid} ms · ×${(msFroid / (msCache || 1)).toFixed(1)}`);
check(msCache < msFroid, `le cache n'accélère pas (${msCache} ms vs ${msFroid} ms)`);

// 3) Invalidation : la liste change (une entrée en moins) sous la MÊME clé → index reconstruit.
const c = construireIndexCache("SECO@2026-07-15", entries.slice(0, entries.length - 1));
console.log(`3. invalidation : liste changée → nouvel index = ${c !== a}`);
check(c !== a, "l'index n'est pas invalidé quand la liste change (empreinte)");

// 4) Purge : après viderIndexCache, un nouvel objet est construit.
viderIndexCache();
const d = construireIndexCache("SECO@2026-07-15", entries);
console.log(`4. purge        après vidage → nouvel objet = ${d !== a}`);
check(d !== a, "la purge ne vide pas le cache");

if (echecs.length) {
  console.log(`\n✗ INDEX-CACHE ROUGE — ${echecs.length} :`);
  echecs.forEach((m) => console.log(`   ✗ ${m}`));
  process.exit(1);
}
console.log(`\n✓ réutilisation · gain de temps · invalidation · purge.`);
console.log(`### 4/4 index-cache verts (R409) ###`);
