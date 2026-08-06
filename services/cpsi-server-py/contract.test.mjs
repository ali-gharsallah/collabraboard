// Test de CONTRAT Nest↔Python (lot L1, P-L1-2). La porte NestJS invoque le pont CPSI (bridge.py)
// en sous-processus et se fie à la forme de sa réponse (protocole R248). Ce banc fige ce contrat :
// pour des payloads représentatifs, la réponse RÉELLE du pont est validée contre le schéma committé
// docs/contracts/cpsi.schema.json. Une dérive du pont (clé manquante, deux branches, etc.) = rouge.
//
// Placé en gate autonome (convention du repo pour les vérifs qui traversent la frontière Node↔Python :
// cf. services/screening/*.test.mjs et services/*-py/run_tests.py) — aucun Postgres, aucun bootstrap Jest.
//
//   node services/cpsi-server-py/contract.test.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(readFileSync(join(DIR, "..", "..", "docs", "contracts", "cpsi.schema.json"), "utf8"));

// ── Mini-validateur JSON Schema (sous-ensemble draft-07 utilisé par le contrat : type, required,
//    properties, additionalProperties:false, oneOf, not/required, schéma vide = « tout »). Sans dépendance. ──
function valider(schema, data, path = "") {
  const errs = [];
  if (schema === true) return errs;
  if (typeof schema === "object" && Object.keys(schema).length === 0) return errs;   // {} = accepte tout
  const T = {
    object: (v) => v && typeof v === "object" && !Array.isArray(v),
    array: Array.isArray, string: (v) => typeof v === "string",
    integer: (v) => Number.isInteger(v), number: (v) => typeof v === "number",
    boolean: (v) => typeof v === "boolean", null: (v) => v === null,
  };
  if (schema.type && T[schema.type] && !T[schema.type](data)) {
    errs.push(`${path || "/"} : type attendu ${schema.type}`); return errs;
  }
  const isObj = data && typeof data === "object" && !Array.isArray(data);
  for (const k of schema.required || []) if (!(isObj && k in data)) errs.push(`${path}/${k} : requis`);
  if (schema.properties && isObj)
    for (const [k, sub] of Object.entries(schema.properties))
      if (k in data) errs.push(...valider(sub, data[k], `${path}/${k}`));
  if (schema.additionalProperties === false && isObj) {
    const ok = new Set(Object.keys(schema.properties || {}));
    for (const k of Object.keys(data)) if (!ok.has(k)) errs.push(`${path}/${k} : propriété additionnelle interdite`);
  }
  if (schema.not && valider(schema.not, data, path).length === 0) errs.push(`${path || "/"} : viole "not"`);
  if (schema.oneOf) {
    const n = schema.oneOf.filter((s) => valider(s, data, path).length === 0).length;
    if (n !== 1) errs.push(`${path || "/"} : oneOf attend exactement 1 branche satisfaite (obtenu ${n})`);
  }
  return errs;
}

function invoquerPont(env) {
  const out = execFileSync("python3", ["bridge.py"], { cwd: DIR, input: JSON.stringify(env), encoding: "utf8" });
  return JSON.parse(out);
}

// ── 3 payloads représentatifs (signal simple · franchissement de bande · config tenant versionnée)
//    + une enveloppe d'erreur typée, pour couvrir les DEUX branches du oneOf du contrat. ──
const CAS = [
  { label: "signal simple → score (resultat)", attendu: "resultat", env: {
    contract_version: "1", tenant_id: "t1", as_of: null, config: {},
    journal: [
      { type: "cpsi.client.registered", client: "C1", statique: { pays_risque: 0, structure_risque: 1, pep: false, secteur_risque: 0 }, at: "2026-01-01T00:00:00" },
      { type: "cpsi.signal.ingested", client: "C1", signal: "alerte_fondee", severite: 2, at: "2026-02-01T00:00:00" },
    ], commande: "score", payload: { client: "C1", at: "2026-03-01T00:00:00" } } },
  { label: "franchissement de bande → score (resultat)", attendu: "resultat", env: {
    contract_version: "1", tenant_id: "t1", as_of: null, config: {},
    journal: [{ type: "cpsi.client.registered", client: "C2", statique: { pays_risque: 3, structure_risque: 3, pep: true, secteur_risque: 2 }, at: "2026-01-01T00:00:00" }],
    commande: "score", payload: { client: "C2", at: "2026-03-01T00:00:00" } } },
  { label: "config tenant versionnée → rules (resultat)", attendu: "resultat", env: {
    contract_version: "1", tenant_id: "t1", as_of: "2026-06-01T00:00:00", config: {},
    journal: [{ type: "cpsi.param.applied", chemin: "half_life_jours", valeur: 90, par: "admin", date_vigueur: "2026-03-01T00:00:00", at: "2026-03-01T00:00:00" }],
    commande: "rules", payload: { at: "2026-06-01T00:00:00" } } },
  { label: "enveloppe non supportée → erreur_typee", attendu: "erreur_typee", env: {
    contract_version: "99", commande: "score", payload: {} } },
];

let echecs = [];
console.log(`CONTRAT CPSI — pont bridge.py vs docs/contracts/cpsi.schema.json\n`);
for (const c of CAS) {
  let rep;
  try { rep = invoquerPont(c.env); }
  catch (e) { echecs.push(`${c.label} : le pont n'a pas répondu — ${e.message}`); console.log(`  ✗ ${c.label}`); continue; }
  const errs = valider(SCHEMA, rep);
  const branche = "resultat" in rep ? "resultat" : ("erreur_typee" in rep ? "erreur_typee" : "?");
  if (errs.length) { echecs.push(`${c.label} : schéma — ${errs.join(" ; ")}`); console.log(`  ✗ ${c.label} (schéma)`); continue; }
  if (branche !== c.attendu) { echecs.push(`${c.label} : branche ${branche} ≠ attendue ${c.attendu}`); console.log(`  ✗ ${c.label} (branche)`); continue; }
  console.log(`  ✓ ${c.label} — enveloppe conforme (${branche})`);
}

if (echecs.length) {
  console.log(`\n✗ CONTRAT CPSI ROUGE — ${echecs.length} écart(s) :`);
  echecs.forEach((m) => console.log(`   ✗ ${m}`));
  process.exit(1);
}
console.log(`\n✓ le pont respecte le contrat d'enveloppe (R248) sur les 3 payloads représentatifs + l'erreur typée.`);
console.log(`### ${CAS.length}/${CAS.length} contrat CPSI verts (L1 · R248) ###`);
