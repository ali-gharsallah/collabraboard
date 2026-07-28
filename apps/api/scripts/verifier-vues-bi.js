#!/usr/bin/env node
/**
 * R314 (dégel V6) — LA LISTE BLANCHE DES VUES BI EST VÉRIFIÉE EN CI (pattern R264) : le
 * build échoue si une vue déclare une SOURCE hors des projections autorisées, une
 * dimension/mesure non déclarable, ou une sensibilité inconnue. Même fichier source que le
 * runtime (vues-bi.json) : une seule vérité. Sortie non-zéro = build rouge — ajouter une
 * vue ne passe JAMAIS sans ce vérificateur.
 */
const fs = require("fs");
const path = require("path");

// Les projections AUTORISÉES — jamais les tables sensibles (users, audit_log, secrets…).
const SOURCES_PROJECTION = ["clients", "kyc_files", "transactions", "risk_cases", "onboardings"];
const COLONNES = {
  clients: ["country", "riskLevel", "structure"],
  kyc_files: ["status", "workflow"],
  transactions: ["devise", "sens", "type", "contrepartiePays"],
  risk_cases: ["statut"],
  onboardings: ["etape"],
};
const MESURES = ["n", "volume"];
const SENSIBILITES = ["NORMALE", "HAUTE"];

function valider(vues) {
  const erreurs = [];
  for (const [code, v] of Object.entries(vues ?? {})) {
    if (!SOURCES_PROJECTION.includes(v.source))
      erreurs.push(`${code} : source « ${v.source} » HORS projections autorisées (${SOURCES_PROJECTION.join(", ")})`);
    for (const d of v.dimensions ?? [])
      if (!(COLONNES[v.source] ?? []).includes(d))
        erreurs.push(`${code} : dimension « ${d} » non déclarable sur ${v.source}`);
    for (const m of v.mesures ?? [])
      if (!MESURES.includes(m)) erreurs.push(`${code} : mesure « ${m} » inconnue`);
    if (!SENSIBILITES.includes(v.sensibilite)) erreurs.push(`${code} : sensibilité « ${v.sensibilite} » inconnue`);
  }
  return erreurs;
}
module.exports = { valider, SOURCES_PROJECTION };

if (require.main === module) {
  const vues = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "src", "modules", "bi", "vues-bi.json"), "utf8"));
  const erreurs = valider(vues);
  if (erreurs.length) { console.error("R314 — vues BI hors liste :\n" + erreurs.map((e) => `  ✗ ${e}`).join("\n")); process.exit(1); }
  console.log(`R314 — ${Object.keys(vues).length} vues BI validées (sources : projections seules)`);
}
