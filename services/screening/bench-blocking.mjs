/**
 * Le pré-filtre tient-il sa promesse ? Deux questions, deux mesures :
 *   1. va-t-il plus vite ?        (sinon il ne sert à rien)
 *   2. rate-t-il de vrais hits ?  (si oui, il est DANGEREUX — un screening qui rate en silence)
 *
 *   node services/screening/bench-blocking.mjs
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { rapprocher, construireIdf } from "./baseline-engine.mjs";
import { construireIndex, candidats } from "./blocking.mjs";
const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const san = JSON.parse(readFileSync(join(DIR, "sanctions-synth.json"), "utf8"));
const pep = JSON.parse(readFileSync(join(DIR, "pep-synth.json"), "utf8"));
const cli = JSON.parse(readFileSync(join(DIR, "clients-synth.json"), "utf8"));
const listes = [...san.entries, ...pep.entries].map((e) => ({
  ...e, date_naissance: e.dates_naissance ? e.dates_naissance[0] : e.date_naissance,
  alias: (e.alias || []).map((a) => (typeof a === "string" ? a : a.nom)),
}));
construireIdf(listes);
const idx = construireIndex(listes);
const verite = new Map(cli.verite_terrain.filter((h) => h.uid).map((h) => [h.client_id, h.uid]));
const SEUIL = 85;
const req = (c) => ({ nom: c.name, dob: c.date_naissance, est_entite: c.type !== "PP" });

// ── Référence : force brute ──
let t0 = Date.now();
const refHits = new Map();
for (const c of cli.clients) { const r = rapprocher(req(c), listes, SEUIL); if (r) refHits.set(c.id, r.uid); }
const msBrut = Date.now() - t0;

// ── Avec pré-filtre ──
t0 = Date.now();
const blocHits = new Map();
let totalCandidats = 0;
for (const c of cli.clients) {
  const cand = candidats(idx, c.name);
  totalCandidats += cand.length;
  const r = rapprocher(req(c), cand, SEUIL);
  if (r) blocHits.set(c.id, r.uid);
}
const msBloc = Date.now() - t0;

const vraisBrut = [...verite].filter(([id, uid]) => refHits.get(id) === uid).length;
const vraisBloc = [...verite].filter(([id, uid]) => blocHits.get(id) === uid).length;
const perdus = [...verite].filter(([id, uid]) => refHits.get(id) === uid && blocHits.get(id) !== uid);

console.log(`Portefeuille ${cli.nb} clients · ${listes.length} entrées · seuil ${SEUIL}\n`);
console.log("                    │ force brute │ pré-filtre │ gain");
console.log("────────────────────┼─────────────┼────────────┼──────");
console.log(`temps total         │ ${String(msBrut + " ms").padStart(11)} │ ${String(msBloc + " ms").padStart(10)} │ ×${(msBrut / msBloc).toFixed(1)}`);
console.log(`entrées comparées   │ ${String(cli.nb * listes.length).padStart(11)} │ ${String(totalCandidats).padStart(10)} │ ×${(cli.nb * listes.length / totalCandidats).toFixed(0)}`);
console.log(`candidats / client  │ ${String(listes.length).padStart(11)} │ ${String(Math.round(totalCandidats / cli.nb)).padStart(10)} │`);
console.log(`hits trouvés        │ ${String(refHits.size).padStart(11)} │ ${String(blocHits.size).padStart(10)} │`);
console.log(`vrais positifs      │ ${String(vraisBrut).padStart(11)} │ ${String(vraisBloc).padStart(10)} │`);
console.log(`\n⚠ Vrais positifs PERDUS par le pré-filtre : ${perdus.length}`);
if (perdus.length) {
  perdus.slice(0, 5).forEach(([id]) => {
    const c = cli.clients.find((x) => x.id === id);
    console.log(`   ✗ ${c.name} — le pré-filtre ne l'a pas proposé au score fin`);
  });
  console.log(`\n   Un pré-filtre qui perd des vrais positifs est pire qu'aucun pré-filtre :`);
  console.log(`   il rate en silence. À corriger avant tout usage.`);
} else {
  console.log(`   Aucun. Le pré-filtre est sûr à ce réglage.`);
}
// ── Extrapolation : honnête sur ce qu'elle vaut ──
const parClientBrut = msBrut / cli.nb, parClientBloc = msBloc / cli.nb;
console.log(`\nCoût par client : force brute ${parClientBrut.toFixed(1)} ms · pré-filtre ${parClientBloc.toFixed(2)} ms`);
console.log(`\nExtrapolation à 50 000 clients × un feed de 2 M d'entrées :`);
console.log(`  force brute : ${(parClientBrut * (2e6 / listes.length) * 50000 / 3.6e6).toFixed(0)} h`);
console.log(`    → le coût croît LINÉAIREMENT avec la taille du feed : l'extrapolation tient.`);
console.log(`  pré-filtre  : NON EXTRAPOLABLE depuis cette mesure.`);
console.log(`    → le coût du score fin est BORNÉ par le plafond de candidats (${400}), il ne croît pas`);
console.log(`      avec le feed. Mais le coût de l'index, lui, croît avec la longueur des postings.`);
console.log(`      Multiplier ${parClientBloc.toFixed(2)} ms par (2 M / ${listes.length}) donnerait un chiffre faux — et flatteur.`);
console.log(`    → mesure honnête possible seulement contre une liste de taille réelle.`);
