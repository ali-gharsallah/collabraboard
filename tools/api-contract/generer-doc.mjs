#!/usr/bin/env node
/**
 * Génère docs/API-SURFACE.md depuis tools/api-contract/api-surface.snapshot.txt — même
 * doctrine que /v1/apidoc et le guide C.1 : la documentation d'API est GÉNÉRÉE depuis les
 * contrats réels, jamais rédigée à la main (une doc manuelle diverge ; la générée fait foi).
 * Régénérer À CHAQUE évolution du snapshot :
 *   node tools/api-contract/generer-doc.mjs > docs/API-SURFACE.md
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ici = dirname(fileURLToPath(import.meta.url));
const lignes = readFileSync(join(ici, "api-surface.snapshot.txt"), "utf8")
  .split("\n").map((l) => l.trim()).filter(Boolean);

const routes = lignes.map((l) => {
  const m = l.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)$/);
  return m ? { methode: m[1], chemin: m[2] } : null;
}).filter(Boolean);

const parModule = new Map();
for (const r of routes) {
  const mod = r.chemin.split("/")[2] ?? "racine";
  if (!parModule.has(mod)) parModule.set(mod, []);
  parModule.get(mod).push(r);
}

const out = [];
out.push("# O-Live — Surface d'API (GÉNÉRÉ — ne pas éditer à la main)");
out.push("");
out.push("> Source : `tools/api-contract/api-surface.snapshot.txt` (contrat RB-07, vérifié en CI).");
out.push("> Régénérer : `node tools/api-contract/generer-doc.mjs > docs/API-SURFACE.md`.");
out.push("> La documentation VIVANTE (extraite du routeur au runtime) est servie par `GET /v1/apidoc` ;");
out.push("> ce document en est la projection committée, au même niveau que le snapshot.");
out.push("");
out.push(`**${routes.length} routes** · **${parModule.size} modules** · préfixe global \`/v1\` · ` +
  "authentification JWT RS256 (le contexte tenant vient du jeton, R328) · RLS FORCE par tenant.");
out.push("");
out.push("| Module | Routes |");
out.push("|---|---|");
for (const [mod, rs] of [...parModule.entries()].sort((a, b) => a[0].localeCompare(b[0])))
  out.push(`| [\`${mod}\`](#${mod.replace(/[^a-z0-9-]/g, "")}) | ${rs.length} |`);
out.push("");
for (const [mod, rs] of [...parModule.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  out.push(`## ${mod}`);
  out.push("");
  out.push("| Méthode | Chemin |");
  out.push("|---|---|");
  for (const r of rs.sort((a, b) => a.chemin.localeCompare(b.chemin) || a.methode.localeCompare(b.methode)))
    out.push(`| ${r.methode} | \`${r.chemin}\` |`);
  out.push("");
}
process.stdout.write(out.join("\n") + "\n");
