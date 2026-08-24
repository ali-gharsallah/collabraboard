// Recette visuelle FAT (non bloquante, R332) — le bundle CONSTRUIT boote dans un vrai
// navigateur et les POINTS D'ENTRÉE des parcours phares sont présents et cliquables. Elle ne
// rejoue pas la donnée (c'est la porte API à jetons réels qui le fait) : elle prouve que
// l'application se sert et se parcourt côté utilisateur, et capture une empreinte d'écran.
import { test, expect } from "@playwright/test";

// Points d'entrée (onglets) des parcours phares du catalogue tools/fat/parcours.mjs.
// La nav est GROUPÉE (menu latéral à groupes repliés, src/app/router.tsx) : l'onglet
// n'est visible qu'après ouverture de son groupe parent — le parcours le reflète
// (docs/notes/fat-visuel-nav-groupee.md).
const PARCOURS_PHARES = [
  { id: "PARC-KYC-AML", groupe: "Compliance & Risque", onglet: "Règles AML" },
  { id: "PARC-COC", groupe: "Clients & Relations", onglet: "Chgt circonstances" },
  { id: "PARC-REVIEW", groupe: "Clients & Relations", onglet: "Account Review" },
  { id: "PARC-OFFBOARDING", groupe: "Clients & Relations", onglet: "Offboarding" },
  { id: "PARC-OLIVIA", groupe: "Data & Intelligence", onglet: "Olivia" },
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
    await page.getByRole("button", { name: p.groupe, exact: true }).click();   // groupe replié → ouvert
    const onglet = page.getByRole("button", { name: p.onglet, exact: true });
    await expect(onglet).toBeVisible();
    await onglet.click();   // la navigation d'onglet est côté client (pas d'API requise)
    await page.screenshot({ path: `playwright/artefacts/${p.id}.png`, fullPage: true });
  });
}
