/**
 * Smoke test de non-régression — tous les écrans atteignables par la navigation.
 *
 * Motivation : deux écrans ont planté en production de démo à cause d'une constante déclarée
 * DANS un composant et consommée ailleurs (`SECTIONS_STATIC`, `ONB_COUNTRIES`). L'app rendait
 * un écran blanc, sans bruit. Trois secondes de smoke test suffisent à l'attraper.
 *
 *   node tests/demo/smoke-screens.spec.mjs
 *   DEMO_URL=file:///chemin/olive-demo.html node tests/demo/smoke-screens.spec.mjs
 */
import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
import { login, body } from "./helpers.mjs";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
let erreursCourantes = [];
page.on("pageerror", (e) => erreursCourantes.push((e.message || "").slice(0, 100)));

await login(page);

const estGroupe = (t) => /▾$/.test(t.trim());
const boutons = () => page.evaluate(() => [...document.querySelectorAll("button")].map((b) => b.textContent.trim()));
const cliquer = (label) => page.evaluate((l) => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === l);
  if (!b) return false; b.click(); return true;
}, label);

// ── Inventaire : pour chaque groupe, les items qu'il révèle (approche par différence) ──
const groupes = (await boutons()).filter(estGroupe);
const plan = [];
for (const g of groupes) {
  const avant = new Set(await boutons());
  await cliquer(g); await page.waitForTimeout(350);
  const apres = await boutons();
  const items = apres.filter((x) => !avant.has(x) && !estGroupe(x) && x.length > 2 && x.length < 40);
  items.forEach((it) => plan.push({ groupe: g, item: it }));
  await cliquer(g); await page.waitForTimeout(150);       // refermer pour isoler le groupe suivant
}
const racine = (await boutons()).filter((x) => !estGroupe(x) && /^[⌂◑☺◎↻⇆🚪✦]/.test(x));
racine.forEach((it) => plan.push({ groupe: null, item: it }));

console.log(`Écrans à visiter : ${plan.length} (${groupes.length} groupes)\n`);

// ── Visite ──
// Un écran qui plante démonte tout l'arbre React (pas d'error boundary) : sans isolation, un seul
// vrai coupable produirait 70 « item introuvable » en cascade. On se relève donc après chaque casse.
let ok = 0; const casses = [];
for (const { groupe, item } of plan) {
  erreursCourantes = [];
  if (groupe) { await cliquer(groupe); await page.waitForTimeout(250); }
  const trouve = await cliquer(item);
  await page.waitForTimeout(650);
  const texte = await body(page);
  const vide = texte.replace(/\s/g, "").length < 400;              // écran blanc = crash silencieux

  let defaut = null;
  if (erreursCourantes.length) defaut = erreursCourantes[0];
  else if (!trouve) defaut = "item introuvable";
  else if (vide) defaut = `écran vide (${texte.length} car.)`;

  if (defaut) {
    casses.push(`${item} — ${defaut}`);
    await login(page);                                   // relève : l'écran suivant repart d'une app saine
    erreursCourantes = [];
  } else {
    ok++;
    if (groupe) { await cliquer(groupe); await page.waitForTimeout(120); }
  }
}

console.log(`Écrans sains : ${ok}/${plan.length}`);
if (casses.length) { console.log("\nÉcrans en défaut :"); casses.forEach((c) => console.log("  ✗ " + c)); }
else console.log("Aucune régression détectée.");
await browser.close();
process.exit(casses.length ? 1 : 0);
