// REGISTRE CENTRAL DES IDENTIFIANTS R (P-L5-1, dette C5). Le namespace R1→R4xx est PLAT et partagé
// entre trois surfaces (apps/api TS, services/cpsi-server-py Python, packages/*) — la collision de
// numérotation est déjà arrivée (screening R260-272 → renuméroté R405-417). Ce script tient le
// registre docs/rules-registry.json et le VÉRIFIE en CI :
//   · tout identifiant R présent dans le CODE et absent du registre (actif)  → ROUGE ;
//   · un identifiant BRÛLÉ (retiré, jamais réattribué) qui réapparaît au code → ROUGE ;
//   · deux entrées du registre pour le même numéro avec des propriétaires différents → ROUGE.
// Un identifiant au registre mais plus au code est SIGNALÉ (candidat au statut « brûlé »), pas rouge.
//
//   node apps/api/scripts/verifier-registre-regles.mjs             # vérification (CI)
//   node apps/api/scripts/verifier-registre-regles.mjs --generer   # (ré)génère le registre depuis le code
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const REGISTRE = join(RACINE, "docs", "rules-registry.json");

// Surfaces de CODE scannées (playbook P-L5-1) — prod uniquement, les tests/specs citent librement.
const SURFACES = [
  { base: "apps/api/src", exclut: /\.spec\.ts$|\.e2e-spec\.ts$/ },
  { base: "services/cpsi-server-py", exclut: /^tests\/|\/tests\/|canary\.py$|run_tests\.py$|__pycache__/ },
  { base: "packages", exclut: /\.test\.|\/dist\/|\.d\.ts$/ },
];
const EXTS = /\.(ts|tsx|js|mjs|py)$/;
const ID = /\bR(\d{1,3})\b/g;

const marcher = (dir) => { let out = [];
  for (const n of readdirSync(dir)) { const p = join(dir, n);
    if (statSync(p).isDirectory()) out = out.concat(marcher(p)); else if (EXTS.test(n)) out.push(p); }
  return out; };

// module propriétaire (heuristique stable) : modules/<x> pour l'api ; sinon le service/paquet.
function bucketDe(rel) {
  const m = rel.match(/^apps\/api\/src\/modules\/([^/]+)\//); if (m) return m[1];
  if (rel.startsWith("apps/api/src/common/")) return "common";
  if (rel.startsWith("apps/api/src/")) return "api";
  const s = rel.match(/^services\/([^/]+)\//); if (s) return s[1];
  const p = rel.match(/^packages\/([^/]+)\//); if (p) return p[1];
  return "autre";
}

function scanner() {
  const occ = new Map();                                   // "R63" → Map(bucket → {n, premierFichier})
  for (const surf of SURFACES) {
    for (const abs of marcher(join(RACINE, surf.base))) {
      const rel = relative(RACINE, abs).split(sep).join("/");
      if (surf.exclut.test(rel.slice(surf.base.length + 1)) || surf.exclut.test(rel)) continue;
      const texte = readFileSync(abs, "utf8"); let m;
      while ((m = ID.exec(texte))) {
        const id = `R${Number(m[1])}`;                     // normalise R01 → R1
        if (!occ.has(id)) occ.set(id, new Map());
        const b = bucketDe(rel); const cur = occ.get(id).get(b) ?? { n: 0, ancre: rel };
        cur.n++; occ.get(id).set(b, cur);
      }
    }
  }
  return occ;
}

const numero = (id) => Number(id.slice(1));
const occ = scanner();

if (process.argv.includes("--generer")) {
  const regles = [...occ.entries()].sort((a, b) => numero(a[0]) - numero(b[0])).map(([id, buckets]) => {
    const tri = [...buckets.entries()].sort((a, b) => b[1].n - a[1].n);
    return { numero: id, module: tri[0][0], ancre: tri[0][1].ancre, statut: "actif",
      ...(tri.length > 1 ? { citePar: tri.slice(1).map(([b]) => b) } : {}) };
  });
  const doc = { commentaire: "Registre central des identifiants R (C5). Propriétaire = module qui cite le plus (le code fait foi). Un numéro retiré passe en `brules` — JAMAIS réattribué.",
    genere: "par verifier-registre-regles.mjs --generer (rejouable)", regles, brules: [] };
  writeFileSync(REGISTRE, JSON.stringify(doc, null, 2) + "\n");
  console.log(`registre (ré)généré : ${regles.length} identifiants actifs → docs/rules-registry.json`);
  process.exit(0);
}

// ── Vérification (CI) ──
const doc = JSON.parse(readFileSync(REGISTRE, "utf8"));
const actifs = new Map();                                  // numero → module
const doublons = [];
for (const r of doc.regles) {
  if (actifs.has(r.numero) && actifs.get(r.numero) !== r.module)
    doublons.push(`${r.numero} déclaré par « ${actifs.get(r.numero)} » ET « ${r.module} »`);
  actifs.set(r.numero, r.module);
}
const brules = new Set((doc.brules ?? []).map((b) => typeof b === "string" ? b : b.numero));

const dansCode = [...occ.keys()];
const absents = dansCode.filter((id) => !actifs.has(id) && !brules.has(id)).sort((a, b) => numero(a) - numero(b));
const reattribues = dansCode.filter((id) => brules.has(id)).sort((a, b) => numero(a) - numero(b));
const orphelins = [...actifs.keys()].filter((id) => !occ.has(id));

console.log(`REGISTRE DES RÈGLES — ${dansCode.length} identifiants au code · ${actifs.size} actifs au registre · ${brules.size} brûlés`);
if (orphelins.length) console.log(`  signalés (au registre, plus au code — candidats « brûlé ») : ${orphelins.join(" ")}`);

const erreurs = [];
if (absents.length) erreurs.push(`identifiant(s) au code ABSENTS du registre : ${absents.join(" ")}`);
if (reattribues.length) erreurs.push(`identifiant(s) BRÛLÉS réapparus au code (réattribution interdite) : ${reattribues.join(" ")}`);
if (doublons.length) erreurs.push(...doublons.map((d) => `collision de propriétaire : ${d}`));

if (erreurs.length) {
  console.log(`\n✗ REGISTRE ROUGE — ${erreurs.length} problème(s) :`);
  erreurs.forEach((e) => console.log(`   ✗ ${e}`));
  process.exit(1);
}
console.log(`\n✓ chaque identifiant du code est au registre, aucun brûlé réattribué, aucun doublon de propriétaire.`);
console.log(`### registre des règles vert (L5 · C5) ###`);
