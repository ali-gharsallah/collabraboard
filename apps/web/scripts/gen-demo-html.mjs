#!/usr/bin/env node
/**
 * V2-M57 — assemble demo/olive-demo-v2.html : UN fichier, ZÉRO requête.
 * Prend le build mono-chunk (vite.demo.config.mjs) et INLINE tout ce que la page référence :
 * le JS (un seul module grâce à inlineDynamicImports), le CSS, et les polices woff2 que le CSS
 * cite (converties en data:). Rien n'est réécrit à la main : si le build change, ce script
 * réassemble — la démo ne peut pas diverger silencieusement de l'application.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist-demo");
const assets = join(dist, "assets");
let html = readFileSync(join(dist, "index.html"), "utf8");
const fichiers = readdirSync(assets);

const js = fichiers.filter((f) => f.endsWith(".js"));
const css = fichiers.filter((f) => f.endsWith(".css"));
if (js.length !== 1) { console.error(`attendu UN js (inlineDynamicImports), trouvé ${js.length} : ${js.join(", ")}`); process.exit(1); }

// CSS d'abord : inliner les polices citées, puis le CSS lui-même.
let feuille = css.map((f) => readFileSync(join(assets, f), "utf8")).join("\n");
for (const f of fichiers.filter((x) => x.endsWith(".woff2"))) {
  const b64 = readFileSync(join(assets, f)).toString("base64");
  feuille = feuille.replaceAll(`/assets/${f}`, `data:font/woff2;base64,${b64}`);
}
const script = readFileSync(join(assets, js[0]), "utf8");

html = html
  .replace(/<script type="module"[^>]*src="\/assets\/[^"]+"><\/script>/, "")
  .replace(/<link rel="stylesheet"[^>]*href="\/assets\/[^"]+">/, "")
  .replace("</head>", `<style>${feuille}</style>\n</head>`)
  .replace("</body>", `<script type="module">${script}<\/script>\n</body>`)
  .replace("<title>Olive</title>", "<title>O-Live — Démo v2</title>");

// aucune référence résiduelle vers /assets : un fichier qui a l'air autonome mais tire encore
// des requêtes est pire qu'un échec de build.
const restes = [...html.matchAll(/\/assets\/[A-Za-z0-9._-]+/g)].map((m) => m[0]);
if (restes.length) { console.error("références non inlinées :", [...new Set(restes)].join(", ")); process.exit(1); }

const sortie = join(process.cwd(), "..", "..", "demo", "olive-demo-v2.html");
writeFileSync(sortie, html);
console.log(`demo/olive-demo-v2.html — ${(html.length / 1048576).toFixed(2)} Mo, autonome (0 requête)`);
