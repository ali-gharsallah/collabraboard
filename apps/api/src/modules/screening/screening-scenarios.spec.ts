/**
 * Corpus exécutable SC-01 → SC-04 (règles R100 → R103, ratifiées le 15.07.2026).
 * Miroir strict du Gherkin du catalogue : chaque « Étant donné / Quand / Alors » est une assertion.
 * Écrits AVANT le code — ils doivent d'abord échouer.
 */
import { ScreeningQualificationService, EntreeListe } from "./rules/screening-qualification";
declare const process: any;

let passed = 0, failed = 0; const fails: string[] = [];
function it(n: string, fn: () => void): void {
  try { fn(); passed++; } catch (e: any) { failed++; fails.push(`✗ ${n} — ${e.message}`); }
}
const ok = (c: boolean, m = "assertion") => { if (!c) throw new Error(m); };
const refuse = (f: () => unknown) => { try { f(); } catch { return; } throw new Error("un refus était attendu"); };

const ENTREE: EntreeListe = { uid: "SAN-1", nom_complet: "Viktor Volkov", alias: ["V. Volkov"], date_naissance: "1965-03-12", type: "individu" };
const CLIENT = { id: "CLI-1", name: "Viktor Volkov", date_naissance: "1965-03-12", type: "PP" };
const NEUTRE = { id: "CLI-2", name: "Jean Dupont", date_naissance: "1980-01-01", type: "PP" };
const CFG = { seuil: 85, prefiltre: { minPartages: 2, maxTrigrammes: 12, plafond: 400 }, liste: "SECO", version: "2026-07-14" };

// ── SC-01 (R100) — Le hit est une matière, pas un verdict ──
it("SC-01 — un hit n'est pas une alerte", () => {
  const s = new ScreeningQualificationService();
  const { run, hits } = s.screener([CLIENT, NEUTRE], [ENTREE], CFG);
  ok(hits.length === 1, "un hit brut est produit");
  const h = hits[0];
  ok(h.statut === "BRUT", "le hit est brut");
  ok(h.score >= CFG.seuil, "il porte son score");
  ok(h.entreeUid === "SAN-1", "il porte l'entrée rapprochée");
  ok(h.listeVersion === "2026-07-14", "il porte LA VERSION DE LISTE");
  ok(!!h.at, "il est horodaté");
  ok(s.alertes.length === 0, "aucune alerte n'est créée");
  ok(s.cases.length === 0, "aucun case n'est ouvert");
  ok(run.nbHits === 1 && run.perimetre === 2, "le run décrit le périmètre");
});

// ── SC-02 (R101) — Écarter un hit est une décision ──
it("SC-02 — qualification motivée, escalade proposée", () => {
  const s = new ScreeningQualificationService();
  const { hits } = s.screener([CLIENT], [ENTREE], CFG);
  refuse(() => s.qualifier(hits[0].id, "FAUX_POSITIF", "", "i.vernet"));
  refuse(() => s.qualifier(hits[0].id, "FAUX_POSITIF", "   ", "i.vernet"));
  refuse(() => s.qualifier(hits[0].id, "FAUX_POSITIF", "homonyme", ""));

  const q = s.qualifier(hits[0].id, "FAUX_POSITIF", "Homonyme — date de naissance incompatible", "i.vernet");
  ok(q.par === "i.vernet" && !!q.at, "auteur et horodatage enregistrés");
  ok(q.motif.length > 0, "motif enregistré");
  ok(s.hits[0].statut === "QUALIFIE", "le hit est qualifié");

  const s2 = new ScreeningQualificationService();
  const h2 = s2.screener([CLIENT], [ENTREE], CFG).hits[0];
  s2.qualifier(h2.id, "VRAI_POSITIF", "Correspondance confirmée — pièce d'identité", "i.vernet");
  ok(s2.propositions.length === 1, "une escalade est PROPOSÉE");
  ok(s2.cases.length === 0, "…et non exécutée (R39/R44)");
});

// ── SC-03 (R102) — Une décision vaut pour ce qu'on savait ce jour-là ──
it("SC-03 — la whitelist ne survit pas au changement de l'entrée", () => {
  const s = new ScreeningQualificationService();
  const h = s.screener([CLIENT], [ENTREE], CFG).hits[0];
  s.qualifier(h.id, "FAUX_POSITIF", "Homonyme — date incompatible", "i.vernet");
  ok(s.estEcarte("CLI-1", ENTREE, "2026-07-14"), "le hit reste écarté contre la même version");

  const modifiee: EntreeListe = { ...ENTREE, alias: ["V. Volkov", "Viktor Wolkow"] };   // nouvel alias
  ok(!s.estEcarte("CLI-1", modifiee, "2026-07-21"), "l'entrée a changé → le hit réapparaît");
  ok(s.qualifications.length === 1, "le motif précédent reste consultable (R48)");
});

// ── SC-04 (R103) — L'absence de hit doit se prouver ──
it("SC-04 — la trace de passage existe même sans hit", () => {
  const s = new ScreeningQualificationService();
  const { run, hits } = s.screener([NEUTRE], [ENTREE], CFG);
  ok(hits.length === 0, "aucun hit");
  ok(s.runs.length === 1, "une trace de passage est enregistrée");
  ok(run.perimetre === 1 && run.liste === "SECO" && run.listeVersion === "2026-07-14", "périmètre, liste, version");
  ok(!!run.at && run.seuil === 85, "horodatage et seuil");
  ok(run.prefiltre.minPartages === 2 && run.prefiltre.plafond === 400, "LE RÉGLAGE DU PRÉ-FILTRE est tracé");
  ok(run.nbHits === 0, "l'absence de hit est un fait enregistré, pas un silence");
});

console.log(`\nScénarios SC-01..SC-04 (R100→R103) — ${passed}/${passed + failed} tests verts`);
if (failed) { fails.forEach((f) => console.log(f)); process.exit(1); }
