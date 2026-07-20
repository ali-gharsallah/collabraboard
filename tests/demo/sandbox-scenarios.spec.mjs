/**
 * Corpus exécutable des scénarios B-01 → B-07 (amendements R93 → R99, proposés le 15.07.2026).
 * Chaque test rejoue le Gherkin du catalogue contre la démo réelle.
 *
 *   node tests/demo/sandbox-scenarios.spec.mjs
 *   DEMO_URL=file:///chemin/olive-demo.html node tests/demo/sandbox-scenarios.spec.mjs
 */
import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
import { login, goto, goItem, openReferentiel, openSandbox, body, clickButton, harness } from "./helpers.mjs";

const H = harness("Scénarios B-01..B-07 (R93→R99)");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1620, height: 1150 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push((e.message || "").slice(0, 90)));

// ── B-01 (R93) — Le zéro doit être un choix ────────────────────────────────
await H.it("B-01 — aucune valeur de référentiel n'est neutre par oubli", async () => {
  await login(page);
  await openReferentiel(page);
  const t = await body(page);
  // Le référentiel a été assaini : plus aucune activité non scorée.
  const bandeau = /(\d+) activités? sans score/.exec(t);
  H.ok(!bandeau, "aucune activité ne doit rester sans score (bandeau absent)");
  // La garantie doit rester active : les scores sont explicites et éditables.
  H.ok(/Activités & métiers/i.test(t), "la rubrique Activités & métiers est présente");
  const nbSelects = await page.evaluate(() => {
    const h = [...document.querySelectorAll("div")].find((d) => /^Activités & métiers/.test(d.textContent.trim()));
    return h ? h.parentElement.querySelectorAll("select").length : 0;
  });
  H.ok(nbSelects > 15, `chaque activité porte un score explicite (${nbSelects} sélecteurs)`);
});

// ── B-06 (R98) — Le contrôleur qui vend ────────────────────────────────────
await H.it("B-06 — conflit porteur / contrôleur signalé", async () => {
  const t = await body(page);
  H.ok(/rôle de contrôle/i.test(t), "le conflit porteur/contrôleur est signalé");
  H.ok(/four-eyes|R13|R52/i.test(t), "le message rappelle la règle four-eyes");
});

// ── B-02 (R94) — Voir avant d'écrire ───────────────────────────────────────
await H.it("B-02 — dry-run avec impact nominatif", async () => {
  await openSandbox(page, /AML — seuils/);
  let t = await body(page);
  H.ok(/DRY-RUN/i.test(t) && /aucune écriture/i.test(t), "le dry-run est annoncé");
  const inp = page.locator('input[type="number"]').first();
  const v0 = parseFloat(await inp.inputValue());
  await inp.fill(String(v0 * 0.4));
  await page.waitForTimeout(600);
  t = await body(page);
  const nouvelles = +(/(\d+)\s*NOUVELLES/i.exec(t)?.[1] ?? 0);
  H.ok(nouvelles > 0, `l'abaissement du seuil produit des alertes (${nouvelles})`);
  H.ok(/nouvelles alertes \(/i.test(t), "la liste des nouvelles alertes est affichée");
  const nommees = await page.evaluate(() => {
    const h = [...document.querySelectorAll("div")].find((d) => /^▲ Nouvelles alertes/.test(d.textContent.trim()));
    return h ? h.parentElement.innerText.split("\n").filter((x) => /vs/.test(x)).length : 0;
  });
  H.ok(nommees > 0, `les alertes nouvelles sont nommées (${nommees} lignes client · valeur vs seuil)`);
});

// ── B-03 (R95) — La falaise se voit avant la chute ──────────────────────────
await H.it("B-03 — stress test : courbe et diagnostic", async () => {
  const t = await body(page);
  H.ok(/stress test/i.test(t), "le stress test est présent");
  H.ok(/réponse progressive|point de rupture/i.test(t), "le diagnostic de robustesse est rendu");
  H.ok(/(CRITIQUE|ÉLEVÉE|MAÎTRISÉE|AU REPOS)/.test(t), "une tension est affichée");
});

// ── B-04 (R96) — Proposer n'est pas appliquer ──────────────────────────────
await H.it("B-04 — proposition, puis arbitrage motivé", async () => {
  await clickButton(page, /Proposer au comité/);
  let t = await body(page);
  H.ok(/Recommandation soumise/i.test(t), "la recommandation part au comité sans écriture");

  await goto(page, /Bacs à sable/, /Comité de paramétrage/);
  t = await body(page);
  H.ok(/En attente \((\d+)\)/.test(t), "la recommandation est en attente d'arbitrage");
  H.ok(/nouvelles alertes|clients touchés/i.test(t), "elle porte son impact mesuré");

  // Refus sans motif → bloqué (R7)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /✕ Refuser/.test(x.textContent));
    b && b.click();
  });
  await page.waitForTimeout(400);
  t = await body(page);
  H.ok(/R7 : un refus exige un motif/i.test(t), "un refus sans motif est bloqué (R7)");
});

// ── B-05 (R97) — Dix réglages raisonnables font une crise ──────────────────
await H.it("B-05 — cumul des propositions retenues", async () => {
  await page.evaluate(() => {
    document.querySelectorAll('input[type="checkbox"]').forEach((c) => c.click());
  });
  await page.waitForTimeout(600);
  const t = await body(page);
  H.ok(/recommandations? retenues?/i.test(t), "le cumul annonce les recommandations retenues");
  H.ok(/(CRITIQUE|ÉLEVÉE|MAÎTRISÉE)/.test(t), "une tension combinée est calculée");
  const boutonsAccepter = await page.evaluate(() =>
    [...document.querySelectorAll("button")].filter((x) => /Accepter et appliquer/.test(x.textContent)).length);
  H.ok(boutonsAccepter > 0, "aucune acceptation n'est empêchée (R39 : mesurer sans coercer)");
});

// ── B-07 (R99) — Un relais qui n'en est pas un ─────────────────────────────
await H.it("B-07 — relais fictif détecté", async () => {
  await openSandbox(page, /Workflow — visas/);
  let t = await body(page);
  H.ok(/relais fictifs/i.test(t), "le compteur de relais fictifs existe");
  await page.evaluate(() => {
    const r = [...document.querySelectorAll("tbody tr")].find((x) => {
      const s = x.querySelectorAll("select");
      return s.length === 2 && !s[0].disabled;
    });
    const sels = r.querySelectorAll("select");
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    set.call(sels[1], sels[0].value);
    sels[1].dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(600);
  t = await body(page);
  H.ok(/relais fictif/i.test(t), "un suppléant identique au validateur est signalé");
  H.ok(/R4/.test(t), "la règle R4 est citée dans le message");
});

console.log("\nErreurs JS de la page :", erreurs.length ? erreurs.join(" | ") : "aucune");
const ok = H.bilan();
await browser.close();
process.exit(ok && erreurs.length === 0 ? 0 : 1);
