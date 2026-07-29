#!/usr/bin/env node
// Runner CLI du registrar (R331/IX) — l'I/O réelle appelée par le workflow CI. Scanne
// spec/inbox/, construit l'ensemble des numéros DÉJÀ pris (spec/*.md + apps), indexe chaque
// artefact en « PROPOSÉ », rapporte les collisions (jamais renumériser). Écrit un rapport
// que la PR de ratification porte. La ratification reste le MERGE d'Ali.
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extraireMeta, normaliserNom, detecterCollisions, ligneIndex } from "./registrar.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const inbox = join(racine, "spec", "inbox");
const nowISO = process.env.REGISTRAR_NOW ?? new Date().toISOString();  // injectable (déterminisme CI)

// Ensemble des numéros de règles DÉJÀ pris = scan de spec/*.md (hors inbox) + le catalogue.
function numerosPris() {
  const pris = new Set();
  const specDir = join(racine, "spec");
  for (const f of readdirSync(specDir)) {
    if (!f.endsWith(".md")) continue;
    for (const m of readFileSync(join(specDir, f), "utf8").matchAll(/\bR(\d{1,4})\b/g)) pris.add(Number(m[1]));
  }
  return pris;
}

const fichiers = readdirSync(inbox).filter((f) => f.endsWith(".md") && f !== ".gitkeep");
if (!fichiers.length) { console.log("registrar : inbox vide — rien à indexer"); process.exit(0); }

const pris = numerosPris();
const lignes = []; let collisionsGlobales = 0;
for (const f of fichiers) {
  const contenu = readFileSync(join(inbox, f), "utf8");
  const meta = extraireMeta(contenu);
  const collisions = detecterCollisions(meta.regles, [...pris]);
  const depotISO = statSync(join(inbox, f)).mtime.toISOString();
  const id = normaliserNom(depotISO, meta.titre);
  lignes.push({ id, meta, depotISO, collisions });
  if (collisions.length) collisionsGlobales += collisions.length;
}

// Rapport (porté par la PR — jamais bloquant, jamais renumérisé : c'est l'humain qui tranche).
console.log("## Registrar — rapport d'indexation (IX-01/02)\n");
for (const l of lignes) {
  console.log(`- **${l.id}** — R:${l.meta.regles.join(",") || "—"} · familles:${l.meta.familles.join(",") || "—"} · ${l.meta.statut}`
    + (l.collisions.length ? `\n  ⚠️ COLLISION de numérotation : R${l.collisions.join(", R")} déjà pris — mapping requis (AUCUNE renumérotation auto, IX-02)` : ""));
}
console.log(`\n${lignes.length} artefact(s) indexé(s), ${collisionsGlobales} collision(s) signalée(s).`);

// Écrit un fragment d'index PROPOSÉ (le workflow l'insère dans PROJECT-INDEX + ouvre la PR).
const fragment = "## PROPOSÉ — en attente de ratification (registrar IX)\n\n"
  + "| Artefact | Titre | Règles | Familles | Statut | Déposé |\n|---|---|---|---|---|---|\n"
  + lignes.map((l) => ligneIndex({ id: l.id, titre: l.meta.titre, regles: l.meta.regles,
      familles: l.meta.familles, statut: l.meta.statut, depotISO: l.depotISO })).join("\n") + "\n";
writeFileSync(join(racine, "spec", "inbox", "_INDEX-PROPOSE.md"), fragment);
console.log("\nFragment d'index écrit : spec/inbox/_INDEX-PROPOSE.md");
process.exit(0);   // collision = signalée, jamais un échec dur (l'humain tranche au merge)
