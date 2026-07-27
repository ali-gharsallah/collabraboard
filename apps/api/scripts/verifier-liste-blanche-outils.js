#!/usr/bin/env node
/**
 * R264 / B.7 critère 2 — LA LISTE BLANCHE D'OUTILS EST VÉRIFIÉE EN CI : le build échoue si
 * (1) la liste livrée est mal formée (une entrée « lecture » qui n'est pas un GET, une entrée
 *     « proposition » autre que la création d'olivia_proposals — R254) ;
 * (2) un artefact d'outils livré (src/modules/swarm/*.default.json portant des endpointRef)
 *     pointe HORS liste blanche.
 * Même fichier source que le runtime (swarm.module.ts) et que les tests (fat-swarm) : une
 * seule vérité. Sortie non-zéro = build rouge.
 */
const fs = require("fs");
const path = require("path");

const dir = path.resolve(__dirname, "..", "src", "modules", "swarm");
const lb = JSON.parse(fs.readFileSync(path.join(dir, "outils-liste-blanche.json"), "utf8"));
const erreurs = [];

if (!Array.isArray(lb.lecture) || lb.lecture.length === 0) erreurs.push("liste « lecture » absente ou vide");
for (const e of lb.lecture ?? [])
  if (!/^GET \/v1\//.test(e)) erreurs.push(`entrée lecture non-GET : « ${e} » (R264 : lecture = GET uniquement)`);
if (JSON.stringify(lb.proposition) !== JSON.stringify(["POST /v1/olivia/proposals"]))
  erreurs.push(`« proposition » doit être EXACTEMENT ["POST /v1/olivia/proposals"] (R254) — trouvé : ${JSON.stringify(lb.proposition)}`);

const licites = new Set([...(lb.lecture ?? []), ...(lb.proposition ?? [])]);
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".default.json") && n !== "outils-liste-blanche.json")) {
  const artefact = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const refs = JSON.stringify(artefact).match(/"endpointRef":"([^"]+)"/g) ?? [];
  for (const m of refs) {
    const ref = m.slice('"endpointRef":"'.length, -1);
    if (!licites.has(ref)) erreurs.push(`${f} : endpointRef HORS LISTE BLANCHE : « ${ref} » (TOOL_ENDPOINT_HORS_LISTE)`);
  }
}

if (erreurs.length) {
  console.error("R264 — liste blanche d'outils : ÉCHEC\n - " + erreurs.join("\n - "));
  process.exit(1);
}
console.log(`R264 — liste blanche d'outils : OK (${lb.lecture.length} lectures, ${lb.proposition.length} proposition)`);
