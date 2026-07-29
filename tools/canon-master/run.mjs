#!/usr/bin/env node
// Runner CLI du générateur CANON-MASTER — la SEULE I/O. Scanne le repo (spec/, questionnaire R-Q,
// suites de test, référence de session, seed de mapping), assemble docs/CANON-MASTER.md et l'écrit.
//   node tools/canon-master/run.mjs           → (ré)génère docs/CANON-MASTER.md
//   node tools/canon-master/run.mjs --check    → régénère en mémoire et compare (CI) : drift = exit 1
// Doctrine : le REPO FAIT FOI ; le doc se régénère, il ne se corrige jamais à la main.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { indexerArtefacts, lierFamillesSuites, extraireRQ, lireSeed, lireExceptions, detecterAnomalies,
  comparerSession, extraireSection, assembler, normaliserPourCheck } from "./generate.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const rel = (p) => relative(racine, p).split("\\").join("/");
const SORTIE = join(racine, "docs", "CANON-MASTER.md");

// ── Collecte récursive de fichiers par extension sous une racine (déterministe, triée). ──
function collecter(dir, exts, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const nom of readdirSync(dir).sort()) {
    if (nom === "node_modules" || nom === "dist" || nom.startsWith(".")) continue;
    const p = join(dir, nom);
    const st = statSync(p);
    if (st.isDirectory()) collecter(p, exts, acc);
    else if (exts.some((e) => nom.endsWith(e))) acc.push(p);
  }
  return acc;
}

const lire = (p) => ({ chemin: rel(p), contenu: readFileSync(p, "utf8") });

// ── Sources : spec/ (canons + catalogues + gherkin), hors inbox et hors référence de session/seed.
const specFiles = collecter(join(racine, "spec"), [".md", ".feature"])
  .filter((p) => !p.includes("/inbox/")
    && !p.endsWith("REFERENTIEL-SESSION-2026-07-29.md") && !p.endsWith("mapping-session-repo.md")
    && !p.endsWith("canon-master-exceptions.md"))
  .map(lire);

// ── Suites de test (liaison famille→suite) : e2e + harnais règles + tools + services + web + python.
const testFiles = [
  ...collecter(join(racine, "apps", "api", "test"), [".ts"]),
  ...collecter(join(racine, "apps", "api", "src"), [".spec.ts"]),
  ...collecter(join(racine, "apps", "web", "src"), [".test.ts", ".test.tsx", ".spec.ts"]),
  ...collecter(join(racine, "tools"), [".mjs"]).filter((p) => /test|spec/.test(p)),
  ...collecter(join(racine, "services"), [".py"]).filter((p) => /test/.test(p)),
].map(lire);

const refSession = readFileSync(join(racine, "spec", "REFERENTIEL-SESSION-2026-07-29.md"), "utf8");
const seedMd = readFileSync(join(racine, "spec", "mapping-session-repo.md"), "utf8");
const exPath = join(racine, "spec", "canon-master-exceptions.md");
const exceptions = lireExceptions(existsSync(exPath) ? readFileSync(exPath, "utf8") : "");
const rqPath = join(racine, "spec", "questionnaire-R-Q.md");
const rqMd = existsSync(rqPath) ? readFileSync(rqPath, "utf8") : "";

// ── Assemblage ──
const artefacts = indexerArtefacts(specFiles);
// Familles ACTIVES = hors docs historiques/référence (changelogs de version, ADR, inventaires) :
// leurs jetons XX-NN incidents (DB-, MO-) ne sont pas des familles de scénarios à couvrir.
const estHisto = (chemin) => exceptions.historique.some((m) => chemin.includes(m));
const toutesFamilles = [...new Set(artefacts.filter((a) => !estHisto(a.chemin)).flatMap((a) => a.familles))].sort();
const liens = lierFamillesSuites(toutesFamilles, testFiles);
const rq = extraireRQ(rqMd);
const seed = lireSeed(seedMd);
const anomalies = detecterAnomalies(artefacts, liens, exceptions);
const reglesRepo = [...new Set(artefacts.flatMap((a) => a.regles))];
const comparaison = comparerSession(refSession, seed, reglesRepo);
const invariantsVerbatim = (extraireSection(refSession, "3") || "").split("\n").slice(1).join("\n").trim()
  || "(section invariants introuvable dans la référence de session)";
const gelsVerbatim = [extraireSection(refSession, "2"), extraireSection(refSession, "7")]
  .filter(Boolean).map((s) => s.split("\n").slice(1).join("\n").trim()).join("\n\n") || "(gels : voir référence de session §2/§7)";
const ecransResume = (extraireSection(refSession, "5") || "72/72 écrans (voir docs/CONFORMITE-VISUELLE.md).")
  .split("\n").slice(1).join("\n").trim() + "\n\nDétail par écran : `docs/CONFORMITE-VISUELLE.md` (grille 5 colonnes).";

const dateISO = (process.env.CANON_NOW ?? new Date().toISOString()).slice(0, 10);   // injectable (déterminisme)
let commit = "inconnu";
try { commit = execSync("git rev-parse --short HEAD", { cwd: racine }).toString().trim(); } catch { /* hors git */ }

const md = assembler({ dateISO, commit, artefacts, liens, rq, seed, anomalies, comparaison,
  invariantsVerbatim, gelsVerbatim, ecransResume });

// ── Mode CI --check : compare le généré (normalisé) à l'existant. Drift OU édition-main → exit 1. ──
if (process.argv.includes("--check")) {
  if (!existsSync(SORTIE)) { console.error("CANON-MASTER : docs/CANON-MASTER.md absent — lancez la génération."); process.exit(1); }
  const actuel = readFileSync(SORTIE, "utf8");
  if (normaliserPourCheck(actuel) !== normaliserPourCheck(md)) {
    console.error("CANON-MASTER : docs/CANON-MASTER.md n'est PAS à jour (ou édité à la main).");
    console.error("→ régénérez : node tools/canon-master/run.mjs — le généré fait foi.");
    process.exit(1);
  }
  console.log("CANON-MASTER : à jour ✓");
  process.exit(0);
}

writeFileSync(SORTIE, md);
console.log(`CANON-MASTER généré : ${rel(SORTIE)}`);
console.log(`  artefacts=${artefacts.length} · règles=${reglesRepo.length} · familles=${toutesFamilles.length}`
  + ` · R-Q=${rq.length} · doublons=${anomalies.doublons.length}`
  + ` · familles-sans-suite=${anomalies.famillesSansSuite.length} · divergences=${comparaison.divergences.length}`);
