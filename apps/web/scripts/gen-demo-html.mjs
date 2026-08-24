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

// L'IDENTITÉ de l'onglet et l'ÉCRAN D'OUVERTURE — le premier fichier livré s'ouvrait sur la
// couche v1 et le PO a cru à une régression. La démo ouvre sur l'UI v2, l'onglet porte l'olive.
const FAVICON = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🫒</text></svg>');
html = html
  .replace("</head>", `<link rel="icon" href="${FAVICON}">\n<script>window.OLIVE_ECRAN_INITIAL="ui2";<\/script>\n</head>`)
  .replace(/<script type="module"[^>]*src="\/assets\/[^"]+"><\/script>/, "")
  .replace(/<link rel="stylesheet"[^>]*href="\/assets\/[^"]+">/, "")
  .replace("</head>", `<style>${feuille}</style>\n</head>`)
  .replace("</body>", `<script type="module">${script}<\/script>\n</body>`)
  .replace("<title>Olive</title>", "<title>O-Live — Démo v2</title>");

// aucune référence résiduelle vers /assets : un fichier qui a l'air autonome mais tire encore
// des requêtes est pire qu'un échec de build.
const restes = [...html.matchAll(/\/assets\/[A-Za-z0-9._-]+/g)].map((m) => m[0]);
if (restes.length) { console.error("références non inlinées :", [...new Set(restes)].join(", ")); process.exit(1); }
// et le bundle doit HONORER l'écran d'ouverture : si le routeur perdait OLIVE_ECRAN_INITIAL,
// la démo rouvrirait silencieusement sur la v1 — précisément la régression signalée par le PO.
if (!script.includes("OLIVE_ECRAN_INITIAL")) { console.error("le bundle ne lit plus OLIVE_ECRAN_INITIAL — la démo rouvrirait sur la v1"); process.exit(1); }

const sortie = join(process.cwd(), "..", "..", "demo", "olive-demo-v2.html");
writeFileSync(sortie, html);
console.log(`demo/olive-demo-v2.html — ${(html.length / 1048576).toFixed(2)} Mo, autonome (0 requête)`);
