// Config Playwright — RECETTE VISUELLE FAT (non bloquante, R332). Sert le bundle CONSTRUIT
// (vite preview) et le pilote dans le Chromium PRÉ-PROVISIONNÉ de l'environnement (jamais de
// téléchargement de navigateur). Ce job double les parcours phares « vue utilisateur » ; la
// porte CI bloquante reste la suite FAT API à jetons réels (tools/fat).
import { defineConfig } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 4173;
const racineWeb = join(dirname(fileURLToPath(import.meta.url)), "..");   // apps/web (racine vite)
export default defineConfig({
  testDir: ".",
  testMatch: /fat-visuel\.spec\.mjs/,
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    screenshot: "on",
    // Chromium : si PLAYWRIGHT_CHROMIUM pointe un binaire (environnement pré-provisionné), on
    // l'utilise ; sinon on laisse Playwright piloter le sien (`playwright install chromium` en CI).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
  },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    cwd: racineWeb,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
