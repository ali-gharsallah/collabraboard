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

// 2026-08-05 : budget maintenu à 220 (« pull ar out », décision PO). Les PACKS DE LANGUE à
// chargement PARESSEUX (import dynamique, ex. l'arabe `i18n-ar-*.js`) sont téléchargés À LA DEMANDE
// par les seuls utilisateurs qui choisissent la langue — ils ne pèsent PAS sur le chargement INITIAL
// que ce budget garde. On les MESURE et on les AFFICHE (transparence, pas un trou), mais on les
// EXCLUT du total de base. Ajouter un pack de langue n'inflate donc plus le bundle core.
const BUDGET_TOTAL_KB = 220;   // somme gzip du bundle de BASE (hors packs de langue paresseux)
const BUDGET_CHUNK_KB = 80;    // aucun chunk gzip au-delà (l'index inclus — le shell reste mince)
const EST_PACK_LANGUE = (f) => /^i18n-ar[-.]/.test(f);  // packs de langue à chargement paresseux

const dir = path.join(__dirname, "..", "dist", "assets");
if (!fs.existsSync(dir)) { console.error("dist/assets absent — lancer `vite build` d'abord"); process.exit(1); }

let total = 0, packsLangue = 0; const horsBudget = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
  const kb = zlib.gzipSync(fs.readFileSync(path.join(dir, f))).length / 1024;
  if (EST_PACK_LANGUE(f)) { packsLangue += kb; continue; }   // pack de langue paresseux : hors budget core
  total += kb;
  if (kb > BUDGET_CHUNK_KB) horsBudget.push(`${f} : ${kb.toFixed(1)} kB gz > ${BUDGET_CHUNK_KB} kB`);
}
console.log(`budget bundle — core ${total.toFixed(1)} kB gz (budget ${BUDGET_TOTAL_KB}) + packs langue ${packsLangue.toFixed(1)} kB gz (paresseux, à la demande), pire chunk sous ${BUDGET_CHUNK_KB} kB : ${horsBudget.length === 0 ? "oui" : "NON"}`);
if (total > BUDGET_TOTAL_KB) horsBudget.push(`CORE : ${total.toFixed(1)} kB gz > ${BUDGET_TOTAL_KB} kB`);
if (horsBudget.length) { horsBudget.forEach((l) => console.error("HORS BUDGET —", l)); process.exit(1); }
