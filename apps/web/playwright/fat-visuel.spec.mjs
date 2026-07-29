// Recette visuelle FAT (non bloquante, R332) — le bundle CONSTRUIT boote dans un vrai
// navigateur et les POINTS D'ENTRÉE des parcours phares sont présents et cliquables. Elle ne
// rejoue pas la donnée (c'est la porte API à jetons réels qui le fait) : elle prouve que
// l'application se sert et se parcourt côté utilisateur, et capture une empreinte d'écran.
import { test, expect } from "@playwright/test";

// Points d'entrée (onglets) des parcours phares du catalogue tools/fat/parcours.mjs.
const PARCOURS_PHARES = [
  { id: "PARC-KYC-AML", onglet: "Règles AML" },
  { id: "PARC-COC", onglet: "Chgt circonstances" },
  { id: "PARC-REVIEW", onglet: "Account Review" },
  { id: "PARC-OFFBOARDING", onglet: "Offboarding" },
  { id: "PARC-OLIVIA", onglet: "Olivia" },
];

test("le bundle construit boote dans le navigateur (shell rendu, sans API)", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Olive/);
  // Le shell (nav complète) se rend côté client sans API ; l'onglet d'accueil est présent.
  await expect(page.getByRole("button", { name: "Accueil", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Command Center", exact: true })).toBeVisible();
  await page.screenshot({ path: "playwright/artefacts/shell.png", fullPage: true });
});

for (const p of PARCOURS_PHARES) {
  test(`recette visuelle ${p.id} : le point d'entrée « ${p.onglet} » est présent et cliquable`, async ({ page }) => {
    await page.goto("/");
    const onglet = page.getByRole("button", { name: p.onglet, exact: true });
    await expect(onglet).toBeVisible();
    await onglet.click();   // la navigation d'onglet est côté client (pas d'API requise)
    await page.screenshot({ path: `playwright/artefacts/${p.id}.png`, fullPage: true });
  });
}
