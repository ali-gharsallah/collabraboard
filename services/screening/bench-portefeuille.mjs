/**
 * Banc « portefeuille » — rejoue les 2 000 clients contre l'ensemble des listes.
 * Mesure la qualité (contre la vérité terrain plantée) ET le temps : à cette échelle,
 * l'approche naïve montre déjà ses limites — c'est le but.
 *
 *   node services/screening/bench-portefeuille.mjs
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { rapprocher, construireIdf } from "@olive/screening-engine";
const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const san = JSON.parse(readFileSync(join(DIR, "sanctions-synth.json"), "utf8"));
const pep = JSON.parse(readFileSync(join(DIR, "pep-synth.json"), "utf8"));
const cli = JSON.parse(readFileSync(join(DIR, "clients-synth.json"), "utf8"));

// Le feed d'un provider est un tout : sanctions + PEP + RCA + SIP + SCO se screenent ensemble.
const listes = [...san.entries, ...pep.entries].map((e) => ({
  ...e, date_naissance: e.dates_naissance ? e.dates_naissance[0] : e.date_naissance,
  alias: (e.alias || []).map((a) => (typeof a === "string" ? a : a.nom)),
}));
construireIdf(listes);
const verite = new Map(cli.verite_terrain.filter((h) => h.uid).map((h) => [h.client_id, h.uid]));

console.log(`Portefeuille : ${cli.nb} clients · Listes : ${listes.length} entrées ` +
  `(${san.nb} sanctions/SCO + ${pep.nb} PEP/RCA/SIP)`);
console.log(`Vérité terrain : ${verite.size} vrais hits plantés · ` +
  `${cli.verite_terrain.length - verite.size} quasi-homonymes à écarter\n`);
console.log("seuil │  hits │ vrais │ ratés │ faux positifs │ taux de FP");
console.log("──────┼───────┼───────┼───────┼───────────────┼───────────");
for (const seuil of [75, 80, 85, 90, 95]) {
  let hits = 0, vp = 0, fp = 0;
  for (const c of cli.clients) {
    const r = rapprocher({ nom: c.name, dob: c.date_naissance, est_entite: c.type !== "PP" }, listes, seuil);
    if (!r) continue;
    hits++;
    if (verite.get(c.id) === r.uid) vp++; else fp++;
  }
  const fn = verite.size - vp;
  console.log(`  ${seuil}  │ ${String(hits).padStart(5)} │ ${String(vp).padStart(5)} │ ${String(fn).padStart(5)} │ ` +
    `${String(fp).padStart(13)} │ ${(fp / (hits || 1) * 100).toFixed(0).padStart(8)}%`);
}
const t0 = Date.now();
for (const c of cli.clients.slice(0, 200)) rapprocher({ nom: c.name, dob: c.date_naissance, est_entite: c.type !== "PP" }, listes, 85);
const ms = Date.now() - t0;
console.log(`\nPerformance (approche naïve, sans indexation) :`);
console.log(`  ${(ms / 200).toFixed(1)} ms par client × ${listes.length} entrées`);
console.log(`  → un portefeuille de ${cli.nb} clients : ${(ms / 200 * cli.nb / 1000).toFixed(0)} s`);
console.log(`  → 50 000 clients contre un vrai feed (≈2 M d'entrées) : ` +
  `${((ms / 200) * (2e6 / listes.length) * 50000 / 1000 / 3600).toFixed(0)} h — impraticable.`);
console.log(`  C'est la démonstration qu'il faut un pré-filtre (blocking) avant le score fin.`);
