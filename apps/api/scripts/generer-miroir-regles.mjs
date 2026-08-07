#!/usr/bin/env node
// P-L7-4 — MIROIR DES RÈGLES : pour chaque règle de docs/audit/RULES_INVENTORY.md marquée
// « Reformulable en Requirement ? OUI », émet l'entrée YAML (basis REPRIS de l'inventaire,
// énoncé verbatim). RÈGLE ABSOLUE : R1–R51 INCHANGÉES — ce script LIT l'inventaire, il ne
// touche ni le code des gardes ni la spec. Le kind est une HEURISTIQUE documentée (visa →
// approval ; document/pièce/matrice → document ; screening/hit → check ; sinon data) : le
// miroir est un CATALOGUE (regles:), pas un CompletionProfile — les profils évaluables le
// citent par basis. `--verifier` : régénère et compare (no-drift, CI).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SOURCE = join(racine, "docs", "audit", "RULES_INVENTORY.md");
const CIBLE = join(racine, "apps", "api", "src", "modules", "inference", "miroir-regles.gen.yaml");

function generer() {
  const md = readFileSync(SOURCE, "utf8");
  const lignes = md.split("\n").filter((l) => /^\| R\d+ \|/.test(l));
  const regles = [];
  for (const l of lignes) {
    const c = l.split("|").map((x) => x.trim());
    // | Rn | type | déclencheur | câblé | reformulable | base |
    const [_, id, type, declencheur, , reformulable, base] = c;
    if (!/^\*\*OUI\*\*/.test(reformulable)) continue;
    const enonce = (reformulable.match(/«\s*(.+?)\s*»/) ?? [])[1] ?? reformulable.replace(/^\*\*OUI\*\*\s*—?\s*/, "");
    const texte = `${type} ${declencheur}`.toLowerCase();
    const kind = /visa/.test(texte) ? "approval"
      : /(document|pièce|matrice)/.test(texte) ? "document"
      : /(screening|hit)/.test(texte) ? "check" : "data";
    const severity = /🔒/.test(type) ? "bloquant" : "non_bloquant";
    regles.push({ id: `REQ-${id}`, regle: id, kind, severity,
      basis: base.replace(/\*\*/g, ""), enonce });
  }
  const y = ["# GÉNÉRÉ par apps/api/scripts/generer-miroir-regles.mjs — NE PAS ÉDITER À LA MAIN.",
    "# Source de vérité : docs/audit/RULES_INVENTORY.md (R1–R51 inchangées — le miroir LIT, ne modifie pas).",
    "regles:"];
  for (const r of regles) {
    y.push(`  - id: ${r.id}`);
    y.push(`    regle: ${r.regle}`);
    y.push(`    kind: ${r.kind}`);
    y.push(`    severity: ${r.severity}`);
    y.push(`    basis: ${JSON.stringify(r.basis)}`);
    y.push(`    enonce: ${JSON.stringify(r.enonce)}`);
  }
  return { yaml: y.join("\n") + "\n", n: regles.length };
}

const { yaml, n } = generer();
if (process.argv.includes("--verifier")) {
  const courant = readFileSync(CIBLE, "utf8");
  if (courant !== yaml) {
    console.error("MIROIR DES RÈGLES : dérive détectée — régénérer (node apps/api/scripts/generer-miroir-regles.mjs) et committer.");
    process.exit(1);
  }
  console.log(`### miroir des règles vert (P-L7-4) — ${n} règles reformulables, no-drift ###`);
} else {
  writeFileSync(CIBLE, yaml);
  console.log(`Miroir généré : ${CIBLE} (${n} règles reformulables)`);
}
