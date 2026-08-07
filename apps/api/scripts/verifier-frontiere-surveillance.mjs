// TEST D'ARCHITECTURE — frontière du contexte Surveillance (P-L3-2, ADR-TM-001 Option C).
// La frontière est une discipline d'imports, vérifiée sur chemins RÉSOLUS (pas de motifs fragiles) :
//   ENTRANT : aucun fichier de PROD hors contexte n'importe un interne de modules/{screening,aml,
//             riskcases,mros}. Exceptions : (a) modules/surveillance/ports (LE point de croisement),
//             (b) un fichier *.module.ts qui importe un *.module.ts du contexte (composition DI Nest —
//             c'est ainsi qu'un port est FOURNI, cf. events.module → risk-case.module).
//   SORTANT : aucun fichier du contexte n'importe un interne d'un AUTRE module métier. Exceptions :
//             common/, adapters/, surveillance/ports, et la liste EXC ci-dessous (assumée, motivée).
// Les specs (*.spec.ts, *.e2e-spec.ts) sont hors périmètre : un test peut câbler du concret.
//
//   node apps/api/scripts/verifier-frontiere-surveillance.mjs      # exit 1 si violation
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
const CONTEXTE = ["screening", "aml", "riskcases", "mros"];

// Exceptions SORTANTES assumées (fichier → import), chacune motivée — toute nouvelle entrée ici
// doit être justifiée dans docs/notes/surveillance-frontiere.md.
const EXC = [
  { fichier: "modules/screening/screening.service.ts", imp: "modules/txflux/swift.module",
    motif: "parserSwift : fonction PURE de parsing (R300), sans DI ni état — le flux reste propriétaire du format" },
  { fichier: "modules/aml/aml.service.ts", imp: "modules/parametres/parametres.service",
    motif: "REGISTRE_RQ : constante référentiel R125 (données, pas un service) — aucun état ni DI traversé" },
];

const marcher = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? marcher(p) : (p.endsWith(".ts") ? [p] : []);
});
const rel = (p) => relative(SRC, p).split(sep).join("/");
const moduleDe = (r) => { const m = r.match(/^modules\/([^/]+)\//); return m ? m[1] : null; };

const fichiers = marcher(SRC).filter((p) => !/\.spec\.ts$|\.e2e-spec\.ts$/.test(p));
const violations = [];

for (const abs of fichiers) {
  const r = rel(abs);
  const modSrc = moduleDe(r);
  const dansCtx = CONTEXTE.includes(modSrc);
  const texte = readFileSync(abs, "utf8");
  const re = /from\s+["'](\.[^"']+)["']/g;                  // imports RELATIFS seulement (les paquets sont libres)
  let m;
  while ((m = re.exec(texte))) {
    const cible = rel(resolve(dirname(abs), m[1]));
    const modDst = moduleDe(cible);
    if (!modDst) continue;                                  // common/, adapters/, hors modules → libre
    if (modDst === "surveillance") continue;                // les ports : LE croisement autorisé
    if (modSrc === modDst) continue;                        // interne au même module → libre
    const versCtx = CONTEXTE.includes(modDst);
    // Composition Nest (symétrique) : un *.module.ts qui importe un *.module.ts — c'est ainsi qu'un
    // port est FOURNI (events.module → risk-case.module) ou qu'un pont est câblé (aml.module → cpsi).
    const composition = /\.module$/.test(cible) && /\.module\.ts$|^app\.module\.ts$/.test(r.split("/").pop());
    if (composition) continue;
    if (!dansCtx && versCtx) {                              // ENTRANT
      violations.push(`ENTRANT  ${r} → ${cible}  (importer le port modules/surveillance/ports, pas l'interne)`);
    } else if (dansCtx && !versCtx) {                       // SORTANT
      if (EXC.some((e) => e.fichier === r && cible.startsWith(e.imp))) continue;
      violations.push(`SORTANT  ${r} → ${cible}  (le contexte ne dépend pas des internes externes)`);
    }
  }
}

console.log(`FRONTIÈRE SURVEILLANCE — ${fichiers.length} fichiers de prod analysés · contexte {${CONTEXTE.join(", ")}}`);
for (const e of EXC) console.log(`  exception assumée : ${e.fichier} → ${e.imp} (${e.motif})`);
if (violations.length) {
  console.log(`\n✗ FRONTIÈRE ROUGE — ${violations.length} import(s) direct(s) inter-contexte :`);
  violations.forEach((v) => console.log(`   ✗ ${v}`));
  process.exit(1);
}
console.log(`\n✓ aucune traversée directe : l'extérieur passe par les ports, le contexte n'aspire pas d'internes externes.`);
console.log(`### frontière Surveillance verte (L3 · ADR-TM-001) ###`);
