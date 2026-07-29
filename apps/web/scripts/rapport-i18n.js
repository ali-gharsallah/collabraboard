#!/usr/bin/env node
/**
 * RAPPORT i18n (R326/LN-02, ratifié 2026-07-29) — « clé manquante = écart LISTÉ en CI ».
 * Croise les clés UTILISÉES par le shell (labels du routeur) avec le dictionnaire
 * (lib/i18n.ts) et LISTE, par langue, les clés sans traduction. Le rapport INFORME
 * (l'exécution replie proprement, LN-02) — il ne casse pas le build : c'est la liste
 * de travail du chantier « écart par clé ». FR = référence : la clé EST le FR,
 * structurellement complète (le canon « une clé sans FR n'existe pas » est satisfait
 * par construction).
 */
const fs = require("fs");
const path = require("path");
const racine = path.join(__dirname, "..");
const i18n = fs.readFileSync(path.join(racine, "src/lib/i18n.ts"), "utf8");
const routeur = fs.readFileSync(path.join(racine, "src/app/router.tsx"), "utf8");

const dicts = {};
for (const langue of ["EN", "DE", "IT"]) {
  // TOUS les blocs de la langue (maquette verbatim + extension éditeur) — fusionnés comme au runtime.
  const cles = new Set();
  for (const bloc of i18n.matchAll(new RegExp(`${langue}: \\{([\\s\\S]*?)\\},?\\n`, "g")))
    for (const m of bloc[1].matchAll(/"((?:[^"\\]|\\.)+)":/g)) cles.add(m[1]);
  dicts[langue] = cles;
}
const utilisees = [...routeur.matchAll(/tab\("[^"]+", "((?:[^"\\]|\\.)+)"\)/g)].map((m) => m[1]);
let total = 0;
for (const langue of ["EN", "DE", "IT"]) {
  const manquantes = utilisees.filter((c) => !dicts[langue].has(c));
  total += manquantes.length;
  console.log(`i18n ${langue} : ${utilisees.length - manquantes.length}/${utilisees.length} clés traduites` +
    (manquantes.length ? ` — MANQUANTES (repli FR propre, LN-02) : ${manquantes.join(" · ")}` : ""));
}
console.log(`rapport i18n — ${total} écart(s) par clé au total (chantier continu, jamais un trou à l'écran)`);
