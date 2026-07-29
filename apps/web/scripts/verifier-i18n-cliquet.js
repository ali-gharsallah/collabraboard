#!/usr/bin/env node
/**
 * CLIQUET zéro-texte-en-dur (R326/LN-01, exécution CLIQUET ratifiée 2026-07-29) —
 * BLOQUANT en CI. La liste CONVERTIS ne peut que CROÎTRE (retirer un fichier = un
 * commit qui se voit et se refuse en revue — le cliquet est la doctrine, ce script
 * est sa dent) : chaque fichier listé est VÉRIFIÉ sans nœud de texte JSX brut — toute
 * chaîne visible passe par t() ou par une donnée servie. Tout NOUVEL écran s'ajoute
 * ici À SA LIVRAISON (critère d'acceptation, comme la ligne de grille).
 * Heuristique : un nœud texte JSX (« >...lettres...< ») hors ponctuation/accolades.
 */
const fs = require("fs");
const path = require("path");

const CONVERTIS = [
  "src/app/router.tsx",            // le shell — labels par t(), sélecteur de langue
  "src/features/bi/BiReporting.tsx",  // tour 3 : premier écran-contenu converti (le patron)
  "src/features/oprisk/OpRisk.tsx",       // tranche 2
  "src/features/mobile/MobileAdmin.tsx",  // tranche 2
];

const racine = path.join(__dirname, "..");
let erreurs = 0;
for (const rel of CONVERTIS) {
  const src = fs.readFileSync(path.join(racine, rel), "utf8");
  src.split("\n").forEach((ligne, i) => {
    const sansCommentaire = ligne.replace(/\/\/.*$/, "").replace(/\{\/\*.*?\*\/\}/g, "");
    // Nœud texte JSX brut : « > lettres ... < » sans expression {…} — le texte visible en dur.
    const m = sansCommentaire.match(/>\s*[^<>{}\n]*[A-Za-zà-öø-ÿÀ-Ö]{3}[^<>{}\n]*</);
    if (m) { erreurs++; console.error(`HORS CLIQUET — ${rel}:${i + 1} : texte JSX en dur : ${m[0].slice(0, 60)}`); }
  });
}
console.log(`cliquet i18n — ${CONVERTIS.length} fichier(s) convertis vérifiés, ${erreurs} texte(s) en dur`);
process.exit(erreurs ? 1 : 0);
