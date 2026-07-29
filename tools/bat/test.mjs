// Harnais BAT — FB-05..07 (R333). Autonome, déterministe. Verrouille : cahier généré filtré
// par licence, écran (modèle) campagne/verdicts/écarts/visa, porte de promotion tenant.
import assert from "node:assert/strict";
import { catalogueBat } from "./catalogue.mjs";
import { genererCahier, rendreCahier, promotable, classerEcarts } from "./bat.mjs";

let passed = 0; const t = (nom, fn) => { fn(); passed++; console.log("  ✓ " + nom); };
console.log("BAT (R333/FB) :");

t("FB-05 cahier GÉNÉRÉ filtré par licence : un tenant ne teste QUE ses modules licenciés", () => {
  const cahier = genererCahier(["KYC", "AML"]);
  const modules = [...new Set(cahier.cases.map((c) => c.module))].sort();
  assert.deepEqual(modules, ["AML", "KYC"], "aucune case hors licence");
  assert.ok(cahier.cases.length >= 3, "au moins les cases KYC/AML");
  // Licence vide → cahier vide (pas de recette sur un module non vendu).
  assert.deepEqual(genererCahier([]).cases, []);
  // Le rendu est GÉNÉRÉ (mention explicite anti-rédaction manuelle).
  const md = rendreCahier("GWB", ["KYC"]);
  assert.ok(md.includes("généré, ne pas éditer à la main") && md.includes("BAT-KYC-01"));
});

t("FB-06 écran BAT : campagne = verdicts + écarts classés (BLOQUANT/MINEUR) + visa", () => {
  const campagne = { cases: [
    { id: "BAT-KYC-01", verdict: "PASS" },
    { id: "BAT-KYC-02", verdict: "ECHEC", ecart: { gravite: "MINEUR", note: "libellé" } },
    { id: "BAT-AML-01", verdict: "ECHEC", ecart: { gravite: "BLOQUANT", note: "qualification impossible" } },
  ] };
  const { bloquants, mineurs } = classerEcarts(campagne);
  assert.equal(bloquants.length, 1);
  assert.equal(mineurs.length, 1);
  assert.equal(bloquants[0].id, "BAT-AML-01");
});

t("FB-07 promotion : promotable seulement si complet, sans écart bloquant, VISÉ (R15)", () => {
  const lic = ["KYC", "AML"];
  const complet = genererCahier(lic).cases.map((c) => ({ id: c.id, verdict: "PASS" }));
  // Cas nominal : tout PASS + visa d'un rôle habilité → promotable.
  assert.deepEqual(promotable({ cases: complet, visa: { par: "A. Gharsallah", role: "CO_SR", at: "2026-07-29" } }, lic),
    { promotable: true, raisons: [] });
  // Sans visa → refusé.
  assert.equal(promotable({ cases: complet }, lic).promotable, false);
  // Visa d'un rôle non habilité → refusé.
  assert.equal(promotable({ cases: complet, visa: { par: "x", role: "RM" } }, lic).promotable, false);
  // Écart bloquant → refusé même visé.
  const avecBloquant = complet.map((c, i) => i === 0 ? { ...c, verdict: "ECHEC", ecart: { gravite: "BLOQUANT" } } : c);
  assert.equal(promotable({ cases: avecBloquant, visa: { par: "x", role: "DIR" } }, lic).promotable, false);
  // Case sans verdict → refusé.
  assert.equal(promotable({ cases: complet.slice(1), visa: { par: "x", role: "ADMIN" } }, lic).promotable, false);
});

t("catalogue : chaque case porte module, intitulé et critère (rien d'implicite)", () => {
  for (const c of catalogueBat) assert.ok(c.id && c.module && c.intitule && c.critere, `${c.id} complet`);
});

console.log(`\n### ${passed}/${passed} tests bat verts ###`);
