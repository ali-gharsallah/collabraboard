// Bloc WD (R432–R438) — parcours « Workflow Designer » dans un VRAI navigateur, sur le bundle
// CONSTRUIT (même harnais que la recette visuelle FAT, R332). L'API /v1/workflow-designer/*
// est rejouée AU NIVEAU RÉSEAU (page.route) avec le contrat exact du module NestJS — ce
// contrat est lui-même prouvé contre Postgres par apps/api/test/e2e/workflow-designer.e2e-spec.ts.
// Couvre : parcours complet import → édition → visa croisé (WD-01..10), refus visa même
// auteur (WD-08, R435/R13), zones illisibles avec coordonnées + nœud À VÉRIFIER (WD-03/12).
import { test, expect } from "@playwright/test";

const API = "https://olive-api.test";
const ZONE = { x: 120, y: 340, largeur: 180, hauteur: 60, raison: "trait manuscrit ambigu" };

// Mini-backend : mêmes transitions et mêmes refus que WorkflowDesignerService.
function creerBackend() {
  const srv = { statut: null, nodes: [], importePar: null, ratifiePar: null, anomalies: [] };
  const etatServi = () => ({
    wirId: "w1", statut: srv.statut,
    wir: { label: "T", nodes: srv.nodes, edges: [],
      meta: { status: srv.statut, hashFichier: "sha256:abcdef0123456789",
        importePar: srv.importePar, ratifiePar: srv.ratifiePar } },
    anomalies: srv.anomalies, zonesIllisibles: [ZONE], historique: [] });
  const traiter = (methode, url, jeton, corps) => {
    if (url.endsWith("/v1/workflow-designer/import")) {
      Object.assign(srv, { statut: "DRAFT_AI", importePar: jeton, ratifiePar: null, anomalies: [],
        nodes: [
          { id: "n0", label: "Entrée en relation", ownerRole: null, confidence: 0.95, aVerifier: false },
          { id: "n1", label: "Collecte documents", ownerRole: "ARM", confidence: 0.4, aVerifier: true },
          { id: "n2", label: "Décision", ownerRole: "CO_SR", confidence: 0.85, aVerifier: false }] });
      return [201, { wirId: "w1" }];
    }
    if (url.endsWith("/ir") && methode === "PATCH") {
      const { patch } = JSON.parse(corps);
      const n = srv.nodes.find((x) => x.id === patch.noeud);
      if (patch.label !== undefined) n.label = patch.label;
      srv.statut = "DRAFT_HUMAN"; srv.ratifiePar = null;          // toute édition invalide le visa
      return [200, etatServi()];
    }
    if (url.endsWith("/ratify")) {
      if (srv.statut === "DRAFT_AI")
        return [400, { message: "R433 : un brouillon IA doit être pris en main par un humain avant ratification." }];
      if (jeton === srv.importePar)
        return [403, { message: "R435/R13 : l'importeur ne ratifie pas son propre import (4-yeux)." }];
      srv.ratifiePar = jeton;
      return [201, { wirId: "w1", defId: "def1" }];
    }
    if (url.includes("/v1/workflow-designer/w1")) return [200, etatServi()];
    return [404, { message: "route inconnue" }];
  };
  return { traiter };
}

async function ouvrirDesignerWd(page) {
  const backend = creerBackend();
  await page.addInitScript(() => {
    window.OLIVE_API_URL = "https://olive-api.test";
    sessionStorage.setItem("olive_jwt", "jeton-co");
  });
  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const jeton = /Bearer (\S+)/.exec(req.headers().authorization ?? "")?.[1] ?? "";
    const [status, corps] = backend.traiter(req.method(), req.url(), jeton, req.postData() ?? "");
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(corps) });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Workflow", exact: true }).first().click();   // groupe latéral
  await page.getByRole("button", { name: "Workflow Designer", exact: true }).click();
  await page.getByRole("button", { name: "Import IA", exact: true }).click();
}
const importer = (page) => page.getByRole("button", { name: "Importer une image (simulée)" }).click();
const editerN1 = async (page, label) => {
  await page.getByLabel("noeud-n1").fill(label);
  await page.getByLabel("noeud-n1").blur();
  await expect(page.getByText("DRAFT_HUMAN", { exact: true })).toBeVisible();
};
const boutonRatifier = (page) => page.getByRole("button", { name: /Ratifier — visa R15/ });

test("WD-03/12 — import : DRAFT_AI jamais activable, zone illisible AVEC coordonnées, nœud sous seuil À VÉRIFIER", async ({ page }) => {
  await ouvrirDesignerWd(page);
  await importer(page);
  await expect(page.getByText("DRAFT_AI — jamais activable (R433)")).toBeVisible();
  await expect(boutonRatifier(page)).toHaveCount(0);              // R433 : aucune action de publication offerte
  await expect(page.getByText(/x:120, y:340, 180×60/)).toBeVisible();      // coordonnées affichées
  await expect(page.getByText("À VÉRIFIER (R438)")).toBeVisible();         // marqué, rien corrigé
  await page.screenshot({ path: "playwright/artefacts/WD-03-draft-ai.png", fullPage: true });
});

test("WD-08 — refus visa même auteur (R435/R13) : le message serveur est affiché tel quel", async ({ page }) => {
  await ouvrirDesignerWd(page);
  await importer(page);
  await editerN1(page, "Collecte renforcée");
  await boutonRatifier(page).click();                             // même porteur que l'import
  await expect(page.getByText(/R435\/R13 : l'importeur ne ratifie pas son propre import/)).toBeVisible();
  await expect(page.getByText("DRAFT_HUMAN", { exact: true })).toBeVisible();   // le statut n'a pas bougé
  await page.screenshot({ path: "playwright/artefacts/WD-08-refus-meme-auteur.png", fullPage: true });
});

test("WD parcours complet — import → édition humaine → visa croisé → publication renvoyée au circuit existant (R436)", async ({ page }) => {
  await ouvrirDesignerWd(page);
  await importer(page);
  await expect(page.getByText("DRAFT_AI — jamais activable (R433)")).toBeVisible();
  await editerN1(page, "Collecte renforcée");
  await page.evaluate(() => sessionStorage.setItem("olive_jwt", "jeton-co-sr"));   // 4-yeux : AUTRE porteur
  await boutonRatifier(page).click();
  await expect(page.getByText(/ratifié par/)).toBeVisible();
  await expect(page.getByText(/jeton-co-sr/)).toBeVisible();
  await expect(page.getByText(/publication via Gouvernance → Workflows/)).toBeVisible();   // R436
  await page.screenshot({ path: "playwright/artefacts/WD-parcours-complet.png", fullPage: true });
});
