// Scanner de SURFACE API (Bloc 0 robustesse, R335/RB — adaptation déterministe d'« OpenAPI
// snapshot » SANS Swagger). Extrait des contrôleurs NestJS l'inventaire des routes
// (METHOD /v1/<préfixe>/<chemin>), trié et dédupliqué, SANS booter Nest ni ajouter de
// dépendance. Sert de détecteur de dérive de CONTRAT : tout changement de route devient
// visible et volontaire (test.mjs diffe contre le snapshot committé).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const srcDir = join(ici, "..", "..", "apps", "api", "src");
const PREFIXE_GLOBAL = "v1";   // main.ts : app.setGlobalPrefix("v1")

// @Controller(...) OU @Get/@Post/@Put/@Patch/@Delete(...), dans l'ordre du source (la position
// détermine à quel contrôleur appartient chaque route — un fichier peut en porter plusieurs).
const DECO = /@(Controller|Get|Post|Put|Patch|Delete)\(\s*["'`]?([^"'`)]*)["'`]?\s*\)/g;

function fichiersTs(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...fichiersTs(p));
    else if (e.endsWith(".ts") && !e.endsWith(".spec.ts")) out.push(p);
  }
  return out;
}

const nettoie = (s) => s.replace(/^\/+|\/+$/g, "").trim();   // retire les slashes de bord

export function scannerRoutes() {
  const routes = new Set();
  for (const f of fichiersTs(srcDir)) {
    const contenu = readFileSync(f, "utf8");
    if (!contenu.includes("@Controller(")) continue;
    let prefixe = null;
    for (const m of contenu.matchAll(DECO)) {
      const [, deco, arg] = m;
      if (deco === "Controller") { prefixe = nettoie(arg); continue; }
      if (prefixe === null) continue;   // méthode hors d'un @Controller (ne devrait pas arriver)
      const segs = [PREFIXE_GLOBAL, prefixe, nettoie(arg)].filter((s) => s.length > 0);
      routes.add(`${deco.toUpperCase().padEnd(6)} /${segs.join("/")}`);
    }
  }
  return [...routes].sort();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const r of scannerRoutes()) console.log(r);
}
