// P-L6-3 — TEST DE SINCÉRITÉ : « le front dit la vérité » (R408/R411).
// (1) Aucune valeur de confiance FABRIQUÉE côté front : le motif historique (hachage → « 78 + h % 22 »)
//     ne doit exister nulle part dans apps/web/src — le motif est CONSTRUIT dynamiquement ci-dessous
//     pour que ce fichier de test ne se piège pas lui-même.
// (2) La maquette parité délègue au VRAI moteur (@olive/screening-engine) — plus aucune distance
//     d'édition locale (Levenshtein) ni générateur de hachage pour les scores.
// (3) Preuve fonctionnelle : la valeur affichée par le front == la valeur du moteur, au point près.
// (4) L'écran RÉEL (features/screening) n'importe pas le moteur : il AFFICHE les scores et la
//     décomposition portés par l'API (hit.score, hit.detail, listeVersion, config du run).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { scorer, scorerDetail } from "@olive/screening-engine";
import { screenSim, screenMatch, SANCTIONS_DB } from "../parity/screening-support";

const SRC = join(__dirname, "..");
function tousLesFichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return tousLesFichiers(p);
    return /\.(ts|tsx|js|jsx)$/.test(f) ? [p] : [];
  });
}

// Motif interdit, assemblé pour ne pas apparaître littéralement ici : 78 [+] h — avec ou sans espaces.
const MOTIF_HACHAGE = new RegExp("78\\s*\\" + "+\\s*\\(?h");

describe("sincérité screening (P-L6-3)", () => {
  it("aucun fichier de apps/web/src ne fabrique une confiance par hachage (motif 78 plus h)", () => {
    const coupables = tousLesFichiers(SRC)
      .filter((p) => !p.endsWith("sincerite-screening.test.ts"))
      .filter((p) => MOTIF_HACHAGE.test(readFileSync(p, "utf8")));
    expect(coupables).toEqual([]);
  });

  it("la maquette parité délègue au moteur : import réel, plus de Levenshtein local", () => {
    const src = readFileSync(join(SRC, "parity", "screening-support.ts"), "utf8");
    expect(src).toContain('from "@olive/screening-engine"');
    expect(src).not.toMatch(/screenLev|levenshtein/i);
  });

  it("preuve fonctionnelle : screenSim == Math.round(scorer(...)) du moteur", () => {
    const cn = "DERIPASKA, Oleg Vladimirovich";
    const attendu = Math.round(scorer({ nom: "Oleg Deripaska" },
      { uid: "q", nom_complet: cn }, { phonetique: true }));
    expect(screenSim("Oleg Deripaska", cn)).toBe(attendu);
    expect(attendu).toBeGreaterThan(80);       // et c'est bien un vrai appariement, pas un hasard
  });

  it("preuve fonctionnelle : screenMatch expose la décomposition du moteur (scorerDetail)", () => {
    const hits = screenMatch("Viktor Bout");
    expect(hits.length).toBeGreaterThan(0);
    const top = hits[0];
    expect(top.entry.id).toBe("SDN-31129");
    const entree = SANCTIONS_DB.find((e) => e.id === top.entry.id)!;
    const det = scorerDetail({ nom: "Viktor Bout" },
      { uid: entree.id, nom_complet: entree.name, alias: entree.aliases || [],
        date_naissance: entree.dob || null, type: entree.type === "ENTITY" ? "entite" : "individu" },
      { phonetique: true });
    expect(top.score).toBe(Math.round(det.score));
    expect(top.detail.via).toBe(det.via);
  });

  it("l'écran réel affiche les valeurs de l'API (hit.detail/listeVersion), sans recalcul front", () => {
    const src = readFileSync(join(SRC, "features", "screening", "Screening.tsx"), "utf8");
    expect(src).not.toContain("@olive/screening-engine");   // il AFFICHE, il ne recalcule pas
    expect(src).toContain("h.detail");                      // décomposition R411 portée par le hit
    expect(src).toContain("listeVersion");                  // version de liste du hit
    expect(src).toContain("/v1/screening/listes");          // bandeau âge des listes (R409)
  });
});
