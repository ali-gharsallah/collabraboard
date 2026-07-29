/**
 * FAT — VAGUE DE CLÔTURE (canon ratifié 2026-07-29, mapping R329) : LE TENANT DE DÉMO.
 * R329 [canon R326] : la démo est un tenant ORDINAIRE, scriptée via les VRAIES APIs, jamais
 * mêlée. Ces tests VÉRIFIENT LE SCRIPT (source) sans exécuter le seed (qui exige la garde) :
 * DM-01 zéro écriture directe sur les tables des MOTEURS · DM-03 zéro branche `demo` dans le
 * code produit. L'idempotence DM-02 et l'histoire sont prouvées par l'exécution du seed lui-
 * même (2 runs, compteurs identiques — consigné au solde).
 */
import * as fs from "fs";
import * as path from "path";

describe("FAT CLÔTURE — R329 : la démo est un tenant ordinaire (DM-01/03, revue de source)", () => {
  it("DM-01 [R329] le seed n'écrit JAMAIS en direct sur une table de MOTEUR — tout passe par les APIs", async () => {
    const src = fs.readFileSync(path.join(__dirname, "../seed/seed-demo-gwb.seed.ts"), "utf8");
    // Les tables des moteurs (état métier reconstruit/journalisé) : aucune écriture Prisma directe.
    const tablesMoteurs = ["cpsiEvent", "domainEvent", "riskCase", "kycFile", "onboarding",
      "cocFile", "offboardingFile", "screeningRun"];
    for (const t of tablesMoteurs) {
      // `.create(`/`.update(`/`.upsert(` sur une table moteur = interdit (sauf les LECTURES .count/.findFirst).
      const motif = new RegExp(`\\.${t}\\.(create|update|upsert|createMany|delete)\\(`);
      expect({ table: t, ecritureDirecte: motif.test(src) }).toEqual({ table: t, ecritureDirecte: false });
    }
    // La SEULE écriture directe tolérée (amorçage ops consigné) : le tenant + rmUserId (aucune route).
    expect(src).toMatch(/INSERT INTO tenants/);                            // amorçage assumé
    expect(src).toMatch(/prisma\.client\.update.*rmUserId/s);              // assignation RM (pas de route)
    console.log("DM-01 PASS — zéro écriture directe sur les tables des moteurs");
  });

  it("DM-03 [R329] zéro branche `demo` dans le code PRODUIT (grep) — la démo n'a aucune voie spéciale", async () => {
    const racines = ["../../src", "../../../web/src"];
    const hits: string[] = [];
    const marcher = (d: string) => {
      if (!fs.existsSync(d)) return;
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) { marcher(p); continue; }
        if (!/\.(ts|tsx)$/.test(f.name)) continue;
        const src = fs.readFileSync(p, "utf8");
        // `if (demo)` / `=== "demo"` / `isDemo` d'AUTORISATION — le mode démo front (isDemoMode =
        // API absente) est un état d'AFFICHAGE légitime, distinct d'une branche de logique métier.
        for (const l of src.split("\n"))
          if (/\bif\s*\(\s*demo\b|===\s*["']demo["']|tenant.*===.*demo/i.test(l)) hits.push(`${p}: ${l.trim().slice(0, 80)}`);
      }
    };
    racines.forEach((r) => marcher(path.join(__dirname, r)));
    expect(hits).toEqual([]);
    console.log("DM-03 PASS — aucune branche de logique `demo` dans le code produit");
  });
});
