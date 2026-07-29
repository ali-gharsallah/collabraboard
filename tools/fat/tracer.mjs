// Tracer FAT — génère la matrice de traçabilité parcours→scénario→règle SANS main humaine, et
// la VÉRIFIE contre la réalité : un scénario déclaré doit apparaître dans un vrai test e2e, une
// règle déclarée doit exister au canon (spec/). Tout « orphelin » (déclaré mais non adossé)
// est une FICTION → le harnais échoue. La matrice ne peut donc pas prétendre une couverture
// que rien n'exécute. Node natif, déterministe.
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parcours } from "./parcours.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dirE2e = join(racine, "apps", "api", "test", "e2e");
const dirSpec = join(racine, "spec");

// Ensemble des identifiants de scénarios RÉELLEMENT présents dans les tests e2e.
function scenariosPresents() {
  const set = new Set();
  for (const f of readdirSync(dirE2e)) {
    if (!f.endsWith(".e2e-spec.ts")) continue;
    for (const m of readFileSync(join(dirE2e, f), "utf8").matchAll(/\b[A-Z]{2,4}-\d{2}\b/g)) set.add(m[0]);
  }
  return set;
}
// Ensemble des règles réellement présentes au canon — marche RÉCURSIVE de spec/ (les scénarios
// vivent dans des sous-dossiers, en .md ET .feature).
function reglesPresentes() {
  const set = new Set();
  const marcher = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { marcher(p); continue; }
      if (!/\.(md|feature)$/.test(e)) continue;
      for (const m of readFileSync(p, "utf8").matchAll(/\bR\d{1,4}\b/g)) set.add(m[0]);
    }
  };
  marcher(dirSpec);
  return set;
}

export function tracer() {
  const scePres = scenariosPresents();
  const regPres = reglesPresentes();
  const orphelinsScenarios = [];
  const orphelinsRegles = [];
  for (const p of parcours) {
    for (const s of p.scenarios) if (!scePres.has(s)) orphelinsScenarios.push(`${p.id}:${s}`);
    for (const r of p.regles) if (!regPres.has(r)) orphelinsRegles.push(`${p.id}:${r}`);
  }
  return { parcours, orphelinsScenarios, orphelinsRegles, scePres, regPres };
}

// Génère docs/FAT-TRACABILITE.md (la matrice porte le ✓ scénario-adossé et la règle).
export function ecrireMatrice(dateISO) {
  const { parcours: ps, orphelinsScenarios, orphelinsRegles, scePres } = tracer();
  const lignes = [
    "# O-Live — MATRICE DE TRAÇABILITÉ FAT (générée, R332/FB-03 — ne pas éditer à la main)",
    "",
    `Générée le ${dateISO}. Substrat : parcours API à jetons réels (porte CI bloquante) ; job`,
    "Playwright « recette visuelle » non bloquant sur les parcours phares. Chaque scénario ci-",
    "dessous est ADOSSÉ à un test e2e réel (✓) — sinon le harnais FB-02 échoue (anti-fiction).",
    "",
    "| Parcours | Jeton | Scénarios (adossés e2e) | Règles | Suite e2e |",
    "|----------|-------|--------------------------|--------|-----------|",
  ];
  for (const p of ps) {
    const sce = p.scenarios.map((s) => `${s}${scePres.has(s) ? " ✓" : " ✗"}`).join(", ");
    lignes.push(`| ${p.id} — ${p.nom} | ${p.jetonRole} | ${sce} | ${p.regles.join(", ")} | ${p.e2e} |`);
  }
  lignes.push("");
  lignes.push(`**Parcours : ${ps.length} · scénarios orphelins : ${orphelinsScenarios.length} · règles orphelines : ${orphelinsRegles.length}.**`);
  if (orphelinsScenarios.length) lignes.push(`⚠️ Orphelins scénarios : ${orphelinsScenarios.join(", ")}`);
  if (orphelinsRegles.length) lignes.push(`⚠️ Orphelins règles : ${orphelinsRegles.join(", ")}`);
  lignes.push("");
  const chemin = join(racine, "docs", "FAT-TRACABILITE.md");
  writeFileSync(chemin, lignes.join("\n"));
  return chemin;
}

// CLI : génère la matrice et imprime un résumé (le workflow la porte).
if (import.meta.url === `file://${process.argv[1]}`) {
  const dateISO = process.env.FAT_NOW ?? "date-non-injectée";
  const chemin = ecrireMatrice(dateISO);
  const { orphelinsScenarios, orphelinsRegles } = tracer();
  console.log(`Matrice écrite : ${chemin}`);
  console.log(`Orphelins scénarios : ${orphelinsScenarios.length} · règles : ${orphelinsRegles.length}`);
  if (orphelinsScenarios.length || orphelinsRegles.length) {
    console.error("FAT : traçabilité FICTIVE — un scénario/règle déclaré n'est adossé à rien.");
    process.exit(1);
  }
}
