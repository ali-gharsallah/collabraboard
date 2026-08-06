/**
 * GATE INGESTION (sous R409) — l'adaptateur `ingererListe` normalise des formats de liste RÉELS vers
 * la forme EntreeMoteur, et produit EXACTEMENT le mapping que chaque banc faisait à la main. Deux
 * garanties : (a) multi-format — SECO/synthétique, OFAC et UN convergent vers la même entrée ;
 * (b) parité — sur les 625 entrées du golden, l'adaptateur reproduit le mapping inline figé (donc
 * les planchers du gate qualité restent valides). Aucun score n'en dépend : c'est l'entrée du moteur.
 *
 *   node services/screening/ingest.test.mjs
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ingererListe, ingererEntree, normaliserType } from "@olive/screening-engine";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const san = JSON.parse(readFileSync(join(DIR, "sanctions-synth.json"), "utf8"));

let echecs = [];
const check = (cond, msg) => { if (!cond) echecs.push(msg); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("GATE INGESTION — adaptateur multi-format ingererListe (sous R409)\n");

// ── 1) Multi-format : la MÊME personne dans 3 formats de liste → la même EntreeMoteur (hors uid) ──
const attendu = { nom_complet: "Muhammad Haddad", alias: ["Mohammed Haddad", "Mohamed Haddad"],
  date_naissance: "1980-05-22", type: "individu", nationalites: ["SY", "RU"] };
const sansUid = (e) => { const { uid, ...r } = e; return r; };

const synthetique = ingererEntree({ uid: "S1", type: "individu", nom_complet: "Muhammad Haddad",
  alias: [{ nom: "Mohammed Haddad", type: "AKA" }, { nom: "Mohamed Haddad" }],
  dates_naissance: ["1980-05-22"], nationalites: ["SY", "RU"] });
const ofac = ingererEntree({ id: "O1", entityType: "Individual", name: "Muhammad Haddad",
  akas: [{ aliasName: "Mohammed Haddad" }, { aliasName: "Mohamed Haddad" }],
  dob: "1980-05-22", nationality: ["SY", "RU"] });
const un = ingererEntree({ reference: "U1", schema: "Person", fullName: "Muhammad Haddad",
  aliases: ["Mohammed Haddad", "Mohamed Haddad"], dateOfBirth: "1980-05-22", nationalities: ["SY", "RU"] });

console.log("1. formats  synthétique/OFAC/UN → EntreeMoteur");
check(eq(sansUid(synthetique), attendu), "synthétique ne normalise pas comme attendu : " + JSON.stringify(sansUid(synthetique)));
check(eq(sansUid(ofac), attendu), "OFAC ne converge pas : " + JSON.stringify(sansUid(ofac)));
check(eq(sansUid(un), attendu), "UN ne converge pas : " + JSON.stringify(sansUid(un)));
check(synthetique.uid === "S1" && ofac.uid === "O1" && un.uid === "U1", "l'uid doit venir du champ propre au format");

// ── 2) Normalisation du TYPE : vocabulaires ramenés à individu | entite ──
console.log("2. type      Individual/person → individu ; Entity/Organization/vessel → entite");
check(normaliserType("Individual") === "individu" && normaliserType("person") === "individu", "type individu");
check(normaliserType("Entity") === "entite" && normaliserType("Organization") === "entite" && normaliserType("vessel") === "entite", "type entite");

// ── 3) DOB : tableau (dates_naissance) OU scalaire (dob) → même date_naissance ──
console.log("3. dob       tableau et scalaire → date_naissance identique");
check(ingererEntree({ dates_naissance: ["1970-01-01"] }).date_naissance === "1970-01-01", "dob tableau");
check(ingererEntree({ dob: "1970-01-01" }).date_naissance === "1970-01-01", "dob scalaire");
check(ingererEntree({ nom_complet: "X" }).date_naissance === null, "dob absent → null");

// ── 4) Nationalités : chaîne unique OU tableau → toujours un tableau ──
console.log("4. nat       chaîne unique et tableau → toujours un tableau");
check(eq(ingererEntree({ nationality: "CH" }).nationalites, ["CH"]), "nat chaîne → tableau");
check(eq(ingererEntree({ nationalites: ["CH", "FR"] }).nationalites, ["CH", "FR"]), "nat tableau conservé");

// ── 5) Parité : sur les 625 entrées du golden, ingererListe == le mapping inline figé ──
const inline = san.entries.map((e) => ({
  uid: e.uid, nom_complet: e.nom_complet, type: e.type,
  date_naissance: e.dates_naissance ? e.dates_naissance[0] : e.date_naissance ?? null,
  alias: (e.alias || []).map((a) => (typeof a === "string" ? a : a.nom)),
  nationalites: e.nationalites,
}));
const ingere = ingererListe(san.entries);
let divergences = 0;
for (let i = 0; i < inline.length; i++) {
  const a = inline[i], b = ingere[i];
  if (!(a.uid === b.uid && a.nom_complet === b.nom_complet && a.type === b.type
    && a.date_naissance === b.date_naissance && eq(a.alias, b.alias) && eq(a.nationalites, b.nationalites))) divergences++;
}
console.log(`5. parité    ${inline.length - divergences}/${inline.length} entrées identiques au mapping inline figé`);
check(divergences === 0, `parité rompue sur ${divergences} entrée(s) — l'adaptateur ne reproduit pas le mapping figé`);

if (echecs.length) {
  console.log(`\n✗ GATE INGESTION ROUGE — ${echecs.length} :`);
  echecs.forEach((m) => console.log(`   ✗ ${m}`));
  process.exit(1);
}
console.log(`\n✓ multi-format (synthétique/OFAC/UN) · type/dob/nat normalisés · parité 625/625.`);
console.log(`### 5/5 ingestion verts (R409) ###`);
