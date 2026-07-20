/**
 * Helpers de navigation pour la démo O-Live.
 * Encode les pièges appris à la dure — chacun a coûté un test rouge trompeur :
 *  - un groupe de navigation se REFERME si on le reclique → openGroup() est idempotent ;
 *  - « Compliance & Risque » existe DANS LA SIDEBAR et DANS LE KYC → on cible par texte exact ;
 *  - `text-transform: uppercase` change innerText → toute recherche de texte est insensible à la casse ;
 *  - React ne valide pas l'état si saisie et clic sont dans la même tâche → fill() puis attente, puis clic.
 */
export const DEMO_URL = process.env.DEMO_URL || "file:///mnt/user-data/outputs/olive-demo.html";

export async function login(page, initiales = "KW") {
  await page.goto(DEMO_URL);
  await page.waitForTimeout(2400);
  await page.locator(`text="${initiales}"`).first().click().catch(() => {});
  await page.locator('text="Se connecter →"').first().click();
  await page.waitForTimeout(1300);
}

/**
 * Le chevron « ▾ » fait partie du LIBELLÉ STATIQUE du groupe : il n'indique pas l'état.
 * On détecte donc l'ouverture par la PRÉSENCE DE L'ITEM, et on ne clique le groupe que si nécessaire —
 * ce qui évite de le refermer par un second clic.
 */
async function clickIfFound(page, labelRe, maxLen) {
  return page.evaluate(({ r, m }) => {
    const b = [...document.querySelectorAll("button")]
      .find((x) => new RegExp(r, "i").test(x.textContent) && x.textContent.trim().length < m);
    if (!b) return false;
    b.click(); return true;
  }, { r: labelRe.source, m: maxLen });
}

/** Ouvre un groupe puis clique l'item. Idempotent : ne referme jamais un groupe déjà ouvert. */
export async function goto(page, groupRe, itemRe, maxLen = 46) {
  if (await clickIfFound(page, itemRe, maxLen)) { await page.waitForTimeout(550); return true; }
  await clickIfFound(page, groupRe, 30);
  await page.waitForTimeout(450);
  const ok = await clickIfFound(page, itemRe, maxLen);
  await page.waitForTimeout(550);
  if (!ok) throw new Error(`navigation impossible : item ${itemRe} introuvable (groupe ${groupRe})`);
  return true;
}

/** Clique un item de nav déjà visible. */
export async function goItem(page, labelRe, maxLen = 46) {
  const ok = await clickIfFound(page, labelRe, maxLen);
  await page.waitForTimeout(550);
  if (!ok) throw new Error(`item de nav introuvable : ${labelRe}`);
}

/** Ouvre l'onglet Référentiels de l'écran Administration. */
export async function openReferentiel(page) {
  await goto(page, /Param[ée]trage/, /^⚙Administration$/);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("button,div")].find((b) => /^▣?\s*Référentiels$/.test(b.textContent.trim()));
    el && el.click();
  });
  await page.waitForTimeout(700);
}

/** Ouvre un bac à sable par son libellé. */
export async function openSandbox(page, labelRe) {
  await goto(page, /Bacs à sable/, labelRe);
}

/** Texte de la page (insensible à la casse via les regex de l'appelant). */
export const body = (page) => page.evaluate(() => document.body.innerText);

/** Saisit dans un input puis laisse React valider l'état avant l'action suivante. */
export async function fillThenSettle(page, selector, value) {
  await page.locator(selector).first().fill(String(value));
  await page.waitForTimeout(400);
}

/** Clique un bouton par texte, en vrai clic souris (contourne les handlers React capricieux). */
export async function clickButton(page, labelRe) {
  await page.locator("button", { hasText: labelRe }).first().click({ force: true });
  await page.waitForTimeout(500);
}

/** Harnais minimal — même esprit que les tests de règles backend. */
export function harness(titre) {
  let passed = 0, failed = 0; const fails = [];
  return {
    async it(nom, fn) {
      try { await fn(); passed++; } catch (e) { failed++; fails.push(`✗ ${nom} — ${e.message}`); }
    },
    ok(cond, msg = "assertion") { if (!cond) throw new Error(msg); },
    bilan() {
      console.log(`\n${titre} — ${passed}/${passed + failed} tests verts`);
      fails.forEach((f) => console.log(f));
      return failed === 0;
    },
  };
}
