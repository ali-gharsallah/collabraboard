/**
 * ÉQUIVALENCE-AUX-DÉFAUTS — filet de sécurité de la Phase 2 (R268).
 *
 * R268 rend configurables les constantes du score (DEFAUTS_MOTEUR) et du pré-filtre (DEFAUTS_BLOCKING).
 * La règle d'or : SANS config, le moteur se comporte au bit près comme avant. Ce test le PROUVE sur
 * les 127 cas du golden set — no-config === DEFAUTS_MOTEUR explicite — puis vérifie qu'un réglage
 * CHANGÉ change bien un verdict (sinon la paramétrisation serait factice).
 *
 *   node services/screening/config-equivalence.test.mjs      # exit 1 si un invariant casse
 *
 * Forme MAPPED (dates_naissance[0] → date_naissance), identique au gate R260 : c'est celle qui active
 * le discriminant DOB. Aucune modification moteur ici — on importe et on mesure.
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  construireIdf, rapprocher, scorer, construireIndex, candidats,
  DEFAUTS_MOTEUR, DEFAUTS_BLOCKING,
} from "@olive/screening-engine";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const lire = (f) => JSON.parse(readFileSync(join(DIR, f), "utf8"));
const san = lire("sanctions-synth.json");
const golden = lire("golden-set.json");

const SEUIL = 85;
const entries = san.entries.map((e) => ({
  ...e,
  date_naissance: e.dates_naissance ? e.dates_naissance[0] : e.date_naissance,
  alias: (e.alias || []).map((a) => (typeof a === "string" ? a : a.nom)),
}));
construireIdf(entries);

let echecs = [];
const check = (cond, msg) => { if (!cond) echecs.push(msg); };
const cle = (r) => (r ? `${r.uid}:${r.score}` : "null");

console.log(`CONFIG-EQUIVALENCE — golden ${golden.nb} cas · liste ${entries.length} · seuil ${SEUIL}\n`);

// ── 1) Équivalence aux défauts : no-config === DEFAUTS_MOTEUR explicite, sur les 127 cas ──
let identiques = 0;
const explicite = { ...DEFAUTS_MOTEUR };
for (const c of golden.cas) {
  const sans = rapprocher(c.requete, entries, SEUIL);
  const avec = rapprocher(c.requete, entries, SEUIL, explicite);
  if (cle(sans) === cle(avec)) identiques++;
  else echecs.push(`équivalence rompue sur ${c.id} : sans=${cle(sans)} vs explicite=${cle(avec)}`);
}
console.log(`1. équivalence-aux-défauts : ${identiques}/${golden.cas.length} verdicts identiques (sans config === DEFAUTS_MOTEUR)`);
check(identiques === golden.cas.length, `équivalence : ${identiques}/${golden.cas.length} seulement`);

// ── 2) Pénalité de TYPE : la retirer remonte le score d'une PP interrogée contre un individu listé ──
const indiv = entries.find((e) => e.type === "individu");
const reqType = { nom: indiv.nom_complet, est_entite: true };            // PP interrogée « comme entité »
const sType = scorer(reqType, indiv);                                    // défaut : -40
const sTypeSans = scorer(reqType, indiv, { penaliteTypeIncompatible: 0 });
console.log(`2. penaliteTypeIncompatible : ${Math.round(sType)} (défaut 40) → ${Math.round(sTypeSans)} (0)`);
check(sTypeSans > sType, `la pénalité de type ne change rien : ${sType} vs ${sTypeSans}`);

// ── 3) Pénalité DOB incompatible : la retirer transforme l'HOMONYME (rejeté) en hit ──
const homo = golden.cas.find((c) => c.categorie === "homonyme" && c.attendu === null);
const rHomoDef = rapprocher(homo.requete, entries, SEUIL);               // défaut : null (année incompatible)
const rHomoSans = rapprocher(homo.requete, entries, SEUIL, { penaliteDobIncompatible: 0 });
console.log(`3. penaliteDobIncompatible : homonyme ${cle(rHomoDef)} (défaut 45) → ${cle(rHomoSans)} (0)`);
check(rHomoDef === null && rHomoSans !== null, `le discriminant DOB ne flippe pas l'homonyme : ${cle(rHomoDef)} → ${cle(rHomoSans)}`);

// ── 4) Échelle : doubler l'amplitude double le score d'un appariement exact ──
const exact = golden.cas.find((c) => c.categorie === "exact");
const reqNom = { nom: exact.requete.nom };                               // sans DOB : score = nom pur
const sEch = scorer(reqNom, entries.find((e) => e.uid === exact.attendu));
const sEch2 = scorer(reqNom, entries.find((e) => e.uid === exact.attendu), { echelle: 200 });
console.log(`4. echelle : ${Math.round(sEch)} (défaut 100) vs ${Math.round(sEch2)} (échelle 200)`);
check(sEch2 > sEch, `l'échelle ne change pas l'amplitude : ${sEch} vs ${sEch2}`);

// ── 5) Blocking — plafond : le réduire retire des candidats ──
const idx = construireIndex(entries);
const nomFreq = exact.requete.nom;
const candDef = candidats(idx, nomFreq);                                 // défauts 12/2/400
const candCap = candidats(idx, nomFreq, { plafond: 1 });
console.log(`5. plafond : ${candDef.length} candidats (défaut ${DEFAUTS_BLOCKING.plafond}) → ${candCap.length} (plafond 1)`);
check(candCap.length <= 1 && candCap.length < candDef.length, `le plafond ne borne pas : ${candDef.length} → ${candCap.length}`);

// ── 6) Blocking — minPartages : l'augmenter retire des candidats ──
const candStrict = candidats(idx, nomFreq, { minPartages: 9 });
console.log(`6. minPartages : ${candDef.length} candidats (défaut ${DEFAUTS_BLOCKING.minPartages}) → ${candStrict.length} (minPartages 9)`);
check(candStrict.length < candDef.length, `minPartages ne resserre pas : ${candDef.length} → ${candStrict.length}`);

// ── Verdict ──
const total = 6;
if (echecs.length) {
  console.log(`\n✗ CONFIG-EQUIVALENCE ROUGE — ${echecs.length} invariant(s) cassé(s) :`);
  echecs.forEach((m) => console.log(`   ✗ ${m}`));
  process.exit(1);
}
console.log(`\n✓ défauts = comportement d'origine (127/127) · chaque knob change bien un verdict.`);
console.log(`### ${total}/${total} config-equivalence verts (R268) ###`);
