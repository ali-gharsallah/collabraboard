#!/usr/bin/env node
/**
 * BUDGET BUNDLE (dette qualité §4 du canon du dégel, 2026-07-28) — bloquant en CI.
 * Le poids se MESURE (gzip réel, pas une estimation) et le dépassement rend le build ROUGE :
 * un budget silencieusement dépassé n'existe pas (même doctrine que les listes blanches R264).
 * État au jour du budget : total 158.9 kB gz, plus gros chunk 50.2 kB gz (73 onglets lazy).
 * Relever un budget = un commit motivé qui édite CES constantes — jamais un contournement.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// 2026-08-05 : relevé 220 → 224 (commit MOTIVÉ, pas un contournement — cf. doctrine ci-dessus).
// Motif : l'arabe, 5e langue d'UI ratifiée (« Both », E-FB-4), fait entrer son CHROME (familles +
// libellés UI AML gap) dans le bundle ; le contenu des RÈGLES reste servi par l'API (SPEC-I18N §3,
// jamais bundlé). +4 kB de marge couvre la passe AR du chrome (et sa relecture pro à venir). À
// faire viser par le PO. Le reste du dispositif anti-dérive (mesure gzip réelle, blocage CI) intact.
const BUDGET_TOTAL_KB = 224;   // somme gzip de tous les chunks JS
const BUDGET_CHUNK_KB = 80;    // aucun chunk gzip au-delà (l'index inclus — le shell reste mince)

const dir = path.join(__dirname, "..", "dist", "assets");
if (!fs.existsSync(dir)) { console.error("dist/assets absent — lancer `vite build` d'abord"); process.exit(1); }

let total = 0; const horsBudget = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
  const kb = zlib.gzipSync(fs.readFileSync(path.join(dir, f))).length / 1024;
  total += kb;
  if (kb > BUDGET_CHUNK_KB) horsBudget.push(`${f} : ${kb.toFixed(1)} kB gz > ${BUDGET_CHUNK_KB} kB`);
}
console.log(`budget bundle — total ${total.toFixed(1)} kB gz (budget ${BUDGET_TOTAL_KB}), pire chunk sous ${BUDGET_CHUNK_KB} kB : ${horsBudget.length === 0 ? "oui" : "NON"}`);
if (total > BUDGET_TOTAL_KB) horsBudget.push(`TOTAL : ${total.toFixed(1)} kB gz > ${BUDGET_TOTAL_KB} kB`);
if (horsBudget.length) { horsBudget.forEach((l) => console.error("HORS BUDGET —", l)); process.exit(1); }
