/**
 * GATE MATCHER — filet de sécurité CI du rapprochement de noms (Phase 0, R405–R407).
 *
 * Transforme le golden set (jusqu'ici jugé par bench.mjs en PRINT-ONLY) en test de NON-RÉGRESSION
 * ASSERTÉ. Ne modifie NI baseline-engine.mjs NI blocking.mjs : il les importe et les mesure.
 *
 *   node services/screening/gate.test.mjs        # exit 1 si un plancher casse
 *
 * PLANCHERS = valeurs RÉELLES mesurées le 2026-08-05 (graine 20260715, seuil 85), figées comme
 * ratchet (on n'améliore pas ici, on empêche la régression). Les mesures sont reproductibles :
 * même graine → mêmes chiffres. Une amélioration future PASSE (planchers = bornes inférieures).
 *
 * FORME DES ENTRÉES : `dates_naissance[0] → date_naissance` (mapping APPELANT, identique à
 * bench-blocking.mjs:18 — pas une modification moteur). C'est la forme qui active le discriminant
 * DOB et sur laquelle les cibles du cahier (précision ≥ 0.95, homonyme = 0 FP) sont tenues.
 * Sans ce mapping, bench.mjs laisse le discriminant DOB MORT (dates_naissance ≠ date_naissance) →
 * précision 0.77 et 18 faux positifs homonymes : une anomalie du JUGE, pas du moteur.
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { rapprocher, construireIdf } from "@olive/screening-engine";
import { construireIndex, candidats, ingererListe } from "@olive/screening-engine";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const lire = (f) => JSON.parse(readFileSync(join(DIR, f), "utf8"));
const san = lire("sanctions-synth.json");
const golden = lire("golden-set.json");
const cli = lire("clients-synth.json");

const SEUIL = 85;
// Mapping appelant (comme bench-blocking.mjs) : DOB simple + alias en chaînes. Aucune modif moteur.
const entries = ingererListe(san.entries);   // R409 — adaptateur multi-format centralisé (fin du mapping inline)

// ── Planchers figés (mesure réelle 2026-08-05 ; graine 20260715 ; seuil 85 ; forme MAPPED) ──
const PLANCHER = {
  rappelGlobal: 0.90,          // mesuré 0.9560  (cahier : ≥ 0.90)
  precisionGlobale: 0.95,      // mesuré 0.9775  (cahier : ≥ 0.95)
  recallCat: {                 // bornes inférieures par catégorie (mesuré entre parenthèses)
    exact: 1.0, alias_connu: 1.0, diacritiques: 1.0,           // cahier : = 1.0  (mesuré 1.0)
    translitteration_hors_liste: 1.0, entite_forme: 1.0,       // ratchet   (mesuré 1.0)
    ordre_nom: 0.90,                                           // cahier : ≥ 0.90 (mesuré 1.0)
    typo: 0.65,                                                // cahier : ≥ 0.65 (mesuré 0.6667, faiblesse connue README:134)
  },
  fpMax: { homonyme: 0, proche_non_liste: 2, client_ordinaire: 0 },  // FP tolérés = taux actuel (mesuré 0/2/0)
  perfCeilMs: 250,             // 200 clients × 625 sanctions AVEC blocking (mesuré ~61 ms → ~4× de marge CI)
  perfSpeedupMin: 3,           // le blocking doit être ≥ 3× plus rapide que la force brute (mesuré ×19)
};

let echecs = [];
const check = (cond, msg) => { if (!cond) echecs.push(msg); };
const pct = (x) => (x * 100).toFixed(2) + "%";

console.log(`GATE matcher — golden ${golden.nb} cas · liste ${entries.length} entrées · seuil ${SEUIL} · graine ${golden.graine}\n`);

// ══ R405 — Gate qualité (golden set asserté) ══
construireIdf(entries);
let vp = 0, fp = 0, fn = 0;
const recCat = {}, totCat = {}, fpCat = {};
for (const c of golden.cas) {
  const r = rapprocher(c.requete, entries, SEUIL);
  if (c.attendu) {
    totCat[c.categorie] = (totCat[c.categorie] || 0) + 1;
    if (r && r.uid === c.attendu) { vp++; recCat[c.categorie] = (recCat[c.categorie] || 0) + 1; }
    else fn++;
  } else if (r) { fp++; fpCat[c.categorie] = (fpCat[c.categorie] || 0) + 1; }
}
const rappel = vp / (vp + fn), precision = vp / (vp + fp) || 0;
console.log(`R405  rappel ${pct(rappel)} (plancher ${pct(PLANCHER.rappelGlobal)}) · précision ${pct(precision)} (plancher ${pct(PLANCHER.precisionGlobale)}) · VP=${vp} FP=${fp} FN=${fn}`);
check(rappel >= PLANCHER.rappelGlobal, `R405 rappel global ${pct(rappel)} < plancher ${pct(PLANCHER.rappelGlobal)}`);
check(precision >= PLANCHER.precisionGlobale, `R405 précision globale ${pct(precision)} < plancher ${pct(PLANCHER.precisionGlobale)}`);
for (const [cat, min] of Object.entries(PLANCHER.recallCat)) {
  const r = (recCat[cat] || 0) / (totCat[cat] || 1);
  console.log(`      recall ${cat.padEnd(28)} ${recCat[cat] || 0}/${totCat[cat] || 0} = ${pct(r)}  (plancher ${pct(min)})`);
  check(r >= min, `R405 recall[${cat}] ${pct(r)} < plancher ${pct(min)}`);
}
for (const [cat, max] of Object.entries(PLANCHER.fpMax)) {
  const n = fpCat[cat] || 0;
  console.log(`      FP     ${cat.padEnd(28)} ${n}  (max ${max})`);
  check(n <= max, `R405 faux positifs[${cat}] ${n} > max toléré ${max}`);
}

// ══ R407 — Non-perte de rappel du blocking (golden) ══
const idx = construireIndex(entries);
const vpSans = new Set(), vpAvec = new Set();
for (const c of golden.cas) {
  if (!c.attendu) continue;
  const r1 = rapprocher(c.requete, entries, SEUIL);
  if (r1 && r1.uid === c.attendu) vpSans.add(c.id);
  const cand = candidats(idx, c.requete.nom);
  const r2 = rapprocher(c.requete, cand, SEUIL);
  if (r2 && r2.uid === c.attendu) vpAvec.add(c.id);
}
const perdus = [...vpSans].filter((id) => !vpAvec.has(id));
console.log(`\nR262  VP sans blocking=${vpSans.size} · VP avec blocking=${vpAvec.size} · perdus=${perdus.length} (max 0)`);
check(perdus.length === 0, `R407 blocking perd ${perdus.length} vrai(s) positif(s) : ${perdus.join(", ")}`);

// ══ R406 — Jauge perf (200 clients × 625 sanctions, blocking actif) ══
const req = (c) => ({ nom: c.name, dob: c.date_naissance, est_entite: c.type !== "PP" });
const clients200 = cli.clients.slice(0, 200);
let t0 = Date.now();
for (const c of clients200) { const cand = candidats(idx, c.name); rapprocher(req(c), cand, SEUIL); }
const msBloc = Date.now() - t0;
t0 = Date.now();
for (const c of clients200) rapprocher(req(c), entries, SEUIL);
const msBrut = Date.now() - t0;
const speedup = msBrut / (msBloc || 1);
console.log(`\nR261  ${clients200.length} clients × ${entries.length} : blocking ${msBloc} ms (plafond ${PLANCHER.perfCeilMs}) · brute ${msBrut} ms · ×${speedup.toFixed(1)} (min ×${PLANCHER.perfSpeedupMin})`);
check(msBloc < PLANCHER.perfCeilMs, `R406 latence blocking ${msBloc} ms ≥ plafond ${PLANCHER.perfCeilMs} ms`);
check(speedup >= PLANCHER.perfSpeedupMin, `R406 blocking ×${speedup.toFixed(1)} < ×${PLANCHER.perfSpeedupMin} — pré-filtre inactif ou régressé`);

// ══ R410 — GOLDEN ÉTENDU NON-LATIN (P-L6-2) : translittération cyrillique + arabe en amont. ══
// Les requêtes sont en ÉCRITURE D'ORIGINE, les entrées de liste en latin (réalité des feeds).
// RECALIBRAGE ASSUMÉ : cette section score avec { phonetique: true } — l'abjad arabe ne note pas
// les voyelles brèves, et c'est la couche phonétique R416 (clés sans voyelles) qui rapproche
// « mhmd » de « muhammad ». Les planchers du golden 127 (sections ci-dessus) restent AUX DÉFAUTS.
const etendu = JSON.parse(readFileSync(join(DIR, "golden-etendu.json"), "utf8"));
const PLANCHER_ETENDU = { rappel: 0.90, precision: 0.95 };
let xtp = 0, xfn = 0, xfp = 0;
for (const c of etendu.cas) {
  const r = rapprocher(c.requete, etendu.entries, SEUIL, { phonetique: true });
  if (c.attendu) { if (r && r.uid === c.attendu) xtp++; else { xfn++; if (r) xfp++; } }
  else if (r) xfp++;
}
const xr = xtp / (xtp + xfn), xp = xtp / ((xtp + xfp) || 1);
const parOrigine = (o) => etendu.cas.filter((c) => c.origine === o).length;
console.log(`
R410  golden étendu non-latin : ar=${parOrigine("ar")} cy=${parOrigine("cy")} · rappel ${pct(xr)} (plancher ${pct(PLANCHER_ETENDU.rappel)}) · précision ${pct(xp)} (plancher ${pct(PLANCHER_ETENDU.precision)}) · VP=${xtp} FN=${xfn} FP=${xfp}`);
check(xr >= PLANCHER_ETENDU.rappel, `R410 rappel étendu ${pct(xr)} < plancher ${pct(PLANCHER_ETENDU.rappel)}`);
check(xp >= PLANCHER_ETENDU.precision, `R410 précision étendue ${pct(xp)} < plancher ${pct(PLANCHER_ETENDU.precision)}`);

// ── Verdict ──
if (echecs.length) {
  console.log(`\n✗ GATE MATCHER ROUGE — ${echecs.length} plancher(s) cassé(s) :`);
  echecs.forEach((m) => console.log(`   ✗ ${m}`));
  process.exit(1);
}
console.log(`\n✓ R405 (qualité) · R406 (perf) · R407 (non-perte blocking) · R410 (non-latin) tous au-dessus des planchers.`);
console.log(`### 4/4 gate matcher verts (R405-R407 · R410) ###`);
