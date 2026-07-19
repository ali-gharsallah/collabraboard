/**
 * Banc de mesure — juge un moteur de rapprochement contre le golden set.
 *
 * Produit exactement les chiffres dont le Compliance Officer a besoin pour choisir son seuil :
 * combien de vrais positifs ratés, combien de faux positifs à qualifier. C'est la matière du
 * futur bac à sable de screening.
 *
 *   node services/screening/bench.mjs
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { rapprocher, construireIdf } from "./baseline-engine.mjs";
const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const liste = JSON.parse(readFileSync(join(DIR, "sanctions-synth.json"), "utf8"));
const golden = JSON.parse(readFileSync(join(DIR, "golden-set.json"), "utf8"));

construireIdf(liste.entries);
const seuils = [60, 65, 70, 75, 80, 85, 90, 95];
console.log(`Liste : ${liste.nb} entrées · Golden set : ${golden.nb} cas ` +
            `(${golden.doivent_matcher} doivent matcher, ${golden.doivent_pas_matcher} non)\n`);
console.log("seuil │ rappel │ précision │  F1   │ ratés │ faux positifs");
console.log("──────┼────────┼───────────┼───────┼───────┼──────────────");

const parSeuil = {};
for (const seuil of seuils) {
  let vp = 0, fp = 0, fn = 0, vn = 0;
  const ratés = [], faussaires = [];
  for (const c of golden.cas) {
    const r = rapprocher(c.requete, liste.entries, seuil);
    if (c.attendu) {
      if (r && r.uid === c.attendu) vp++;
      else { fn++; ratés.push(c); }
    } else {
      if (r) { fp++; faussaires.push({ ...c, hit: r }); } else vn++;
    }
  }
  const rappel = vp / (vp + fn), prec = vp / (vp + fp) || 0;
  const f1 = (2 * prec * rappel) / (prec + rappel) || 0;
  parSeuil[seuil] = { vp, fp, fn, vn, ratés, faussaires, rappel, prec, f1 };
  console.log(`  ${String(seuil).padStart(2)}  │  ${(rappel * 100).toFixed(0).padStart(3)}%  │   ${(prec * 100).toFixed(0).padStart(3)}%   │ ${(f1 * 100).toFixed(0).padStart(3)}%  │  ${String(fn).padStart(3)}  │      ${String(fp).padStart(3)}`);
}

// ── Le message du bac à sable, en chiffres ──
const a = parSeuil[85], b = parSeuil[75];
console.log(`\nCe que dirait le bac à sable de screening :`);
console.log(`  seuil 85 → 75 : ${b.vp - a.vp > 0 ? "+" : ""}${b.vp - a.vp} vrai(s) positif(s) retrouvé(s), ` +
            `${b.fp - a.fp > 0 ? "+" : ""}${b.fp - a.fp} faux positif(s) à qualifier`);

// ── Où le moteur souffre : par catégorie ──
console.log(`\nÀ 85, ce que la ligne de base rate — par catégorie :`);
const parCat = {};
parSeuil[85].ratés.forEach((c) => { parCat[c.categorie] = (parCat[c.categorie] || 0) + 1; });
const total = golden.cas.filter((c) => c.attendu).reduce((m, c) => { m[c.categorie] = (m[c.categorie] || 0) + 1; return m; }, {});
Object.keys(total).forEach((k) => console.log(`  ${k.padEnd(18)} ${String(parCat[k] || 0).padStart(2)} raté(s) sur ${total[k]}`));
if (parSeuil[85].faussaires.length) {
  console.log(`\nFaux positifs à 85 :`);
  parSeuil[85].faussaires.slice(0, 5).forEach((c) =>
    console.log(`  « ${c.requete.nom} » → ${c.hit.entree.nom_complet} (${c.hit.score}) — ${c.pourquoi}`));
}
