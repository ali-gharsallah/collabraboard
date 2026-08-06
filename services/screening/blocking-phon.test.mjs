/**
 * R416 — CANAL PHONÉTIQUE du pré-filtre (blocking). Le blocking trigramme est ORTHOGRAPHIQUE : une
 * translittération qui ne partage pas assez de trigrammes n'entre pas dans les candidats, et le score
 * fin phonétique ne s'exécute jamais. Ce banc prouve : (a) OFF par défaut = candidats trigramme IDENTIQUES
 * (bit pour bit) sur la vraie liste ; (b) ON = une graphie phonétiquement proche mais orthographiquement
 * distante (Nite→Knight) entre dans les candidats là où le trigramme la ratait ; (c) une entrée sans
 * rapport n'entre pas ; (d) la méthode "double" hérite du gain.
 *
 *   node services/screening/blocking-phon.test.mjs
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ingererListe, construireIndex, construireIndexCache, viderIndexCache, candidats } from "@olive/screening-engine";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const san = JSON.parse(readFileSync(join(DIR, "sanctions-synth.json"), "utf8"));
const reels = ingererListe(san.entries);

let echecs = [];
const check = (cond, msg) => { if (!cond) echecs.push(msg); };
const uids = (arr) => arr.map((e) => e.uid).sort();
console.log(`BLOCKING PHONÉTIQUE — ${reels.length} entrées de liste\n`);

// ── 1) OFF par défaut : sur la VRAIE liste, candidats trigramme identiques avec/sans index phonétique bâti.
const idxDef = construireIndex(reels);
const idxPhon = construireIndex(reels, { phonetique: true, phonetiqueMethode: "double" });
let identiques = 0;
for (const e of reels.slice(0, 40)) {
  const a = uids(candidats(idxDef, e.nom_complet));                 // défaut
  const b = uids(candidats(idxPhon, e.nom_complet));               // index phonétique bâti MAIS flag OFF
  if (JSON.stringify(a) === JSON.stringify(b)) identiques++;
}
console.log(`1. OFF par défaut : ${identiques}/40 requêtes → candidats trigramme identiques`);
check(identiques === 40, `le canal phonétique OFF ne doit RIEN changer (${identiques}/40)`);

// ── 2/3) petit corpus contrôlé : Nite→Knight rentre par voie phonétique, Buraq sans rapport reste dehors.
const corpus = [
  { uid: "K1", nom_complet: "Knight" },
  { uid: "W1", nom_complet: "Wright" },
  { uid: "B1", nom_complet: "Buraq Holding" },
];
for (const methode of ["metaphone", "double"]) {
  const iDef = construireIndex(corpus);
  const iPh = construireIndex(corpus, { phonetique: true, phonetiqueMethode: methode });
  const off = uids(candidats(iDef, "Nite"));                                    // trigramme : rate
  const on = uids(candidats(iPh, "Nite", { phonetique: true, phonetiqueMethode: methode }));
  console.log(`2. [${methode}] Nite → défaut=[${off}] phon=[${on}]`);
  check(off.length === 0 && on.includes("K1"), `[${methode}] Nite devrait entrer par voie phonétique`);
  check(!on.includes("B1"), `[${methode}] une entrée sans rapport (Buraq) ne doit pas entrer`);
}

// ── 4) exact match : identique avec/sans phonétique (aucun faux gain).
const iPh2 = construireIndex(corpus, { phonetique: true, phonetiqueMethode: "double" });
const exact = uids(candidats(iPh2, "Buraq Holding", { phonetique: true, phonetiqueMethode: "double" }));
console.log(`4. exact Buraq Holding (phon ON) → [${exact}]`);
check(exact.length === 1 && exact[0] === "B1", "un match exact reste un seul candidat");

// ── 5) PERF à l'échelle : l'index phonétique reste un SURCOÛT BORNÉ de la construction trigramme, et
//        (comme le trigramme, R409) il est MÉMOÏSÉ — le rescreening répété ne le reconstruit pas.
const scale = (n) => { const out = []; let i = 0; while (out.length < n) { const e = reels[i % reels.length]; out.push({ ...e, uid: `${e.uid}-${out.length}` }); i++; } return out; };
const N = 20000;
const gros = scale(N);
let t = Date.now(); construireIndex(gros); const mTri = Date.now() - t;
t = Date.now(); construireIndex(gros, { phonetique: true, phonetiqueMethode: "double" }); const mPhon = Date.now() - t;
const PLAFOND_MS = 4000;                                          // ~0,5 s mesuré → ~8× de marge CI
console.log(`5. échelle ${N} : trigramme ${mTri} ms · +phonétique(double) ${mPhon} ms (×${(mPhon / (mTri || 1)).toFixed(1)}) · plafond ${PLAFOND_MS} ms`);
check(mPhon < PLAFOND_MS, `construction phonétique ${mPhon} ms ≥ plafond ${PLAFOND_MS} ms (à ${N})`);

viderIndexCache();
t = Date.now(); const froid = construireIndexCache("SCALE#double", gros, { phonetique: true, phonetiqueMethode: "double" }); const msFroid = Date.now() - t;
t = Date.now(); const chaud = construireIndexCache("SCALE#double", gros, { phonetique: true, phonetiqueMethode: "double" }); const msChaud = Date.now() - t;
console.log(`6. mémoïsation : froid ${msFroid} ms → chaud ${msChaud} ms · même objet=${froid === chaud} · index phonétique présent=${!!froid.phon}`);
check(froid === chaud && !!froid.phon, "l'index phonétique doit être mémoïsé (même objet réutilisé, pas reconstruit)");
check(msChaud <= msFroid, `le chemin chaud ne doit pas reconstruire (${msChaud} ms > froid ${msFroid} ms)`);

const total = 6;
if (echecs.length) {
  console.log(`\n✗ BLOCKING-PHON ROUGE — ${echecs.length} invariant(s) cassé(s) :`);
  echecs.forEach((m) => console.log(`   ✗ ${m}`));
  process.exit(1);
}
console.log(`\n✓ pré-filtre orthographique inchangé par défaut · recall phonétique sur demande · surcoût borné et mémoïsé.`);
console.log(`### ${total}/${total} blocking-phonétique verts (R416) ###`);
