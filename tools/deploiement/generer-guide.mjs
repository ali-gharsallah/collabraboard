// Générateur du guide de déploiement (C.1) — émet docs/DEPLOIEMENT.md À PARTIR de pipeline.mjs.
// La doc est donc TOUJOURS le reflet du pipeline réel ; un écart est refusé en CI (no-drift).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "./pipeline.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function rendre() {
  const L = [];
  L.push("# O-Live — GUIDE DE DÉPLOIEMENT (généré de tools/deploiement/pipeline.mjs — ne pas éditer à la main)");
  L.push("");
  L.push("Pipeline C.1 en 6 phases (0-5). Doctrine : **tag signé → staging automatique → répétition");
  L.push("de restauration → FAT sur staging → prod déclenchée par un HUMAIN → contract différé (N+1)**.");
  L.push("Aucun ordre destructif automatique ; la prod n'est jamais déclenchée sans main humaine.");
  L.push("");
  for (const p of pipeline) {
    L.push(`## Phase ${p.n} — ${p.nom}  _(${p.mode})_`);
    L.push("");
    L.push(p.but);
    L.push("");
    L.push("Étapes :");
    for (const e of p.etapes) L.push(`- \`${e}\``);
    L.push("");
    L.push(`**Garde :** ${p.garde}`);
    L.push("");
  }
  L.push("---");
  L.push("");
  const humaines = pipeline.filter((p) => p.mode === "humain").map((p) => p.n);
  L.push(`Phases à déclenchement HUMAIN : ${humaines.join(", ")} (dont la phase 4 — la prod). `
    + `Phases automatiques : ${pipeline.filter((p) => p.mode === "automatique").map((p) => p.n).join(", ")}.`);
  L.push("");
  return L.join("\n");
}

export const cheminGuide = join(racine, "docs", "DEPLOIEMENT.md");

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(cheminGuide, rendre());
  console.log(`Guide généré : ${cheminGuide}`);
}
