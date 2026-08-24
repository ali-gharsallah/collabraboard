// Bloc 61 — Analytique 2G (R399–R403) — TESTS ROUGES AVANT CODE (généré depuis gen_aml_gap.py)
import { evaluateScenario } from "../../src/aml/engine"; // à implémenter
import { gtFixture, gtCases } from "./fixtures";

describe("Bloc 61 — Analytique 2G", () => {
  describe("R399 AN-01 — Déviation au groupe de pairs", () => {
    it("Given Un client du groupe « Affluent CH » présente un volume cash à 4.2 écarts-types de la médiane de son groupe. When Z-score robuste (médiane/MAD) par attribut et par groupe, recalculé au fil de l'eau. Then Signal PEER_DEVIATION (Niveau 2) — explicable par construction : attribut, valeur, distribution du groupe joints (R44 : ", async () => {
      const res = await evaluateScenario("AN-01", gtFixture("AN-01-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R400 AN-02 — Rupture de comportement (baseline propre)", () => {
    it("Given Un compte stable depuis 4 ans triple sa volumétrie et change de corridors en 3 semaines. When Détection de rupture (changepoint) sur volume, fréquence, corridors, contreparties vs baseline 12 mois. Then Signal BEHAVIOR_SHIFT (Niveau 2) — comparatif avant/après joint au signal.", async () => {
      const res = await evaluateScenario("AN-02", gtFixture("AN-02-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R401 AN-03 — First-time patterns", () => {
    it("Given Un client 100% domestique depuis 6 ans émet son premier virement vers une juridiction à risque, montant élevé. When Détection de première occurrence par dimension sensible × matérialité du montant. Then Signal FIRST_TIME (Niveau 1) — friction douce : revue rapide, pas de blocage (R39 : mesurer, pas coercer).", async () => {
      const res = await evaluateScenario("AN-03", gtFixture("AN-03-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R402 AN-04 — Dormance partielle par segment", () => {
    it("Given Un compte actif en titres n'a fait aucun cash depuis 3 ans ; 3 dépôts espèces surviennent en 2 semaines. When Dormance mesurée par segment (cash, international, produit) ; réactivation = première activité du segment après N mois. Then Signal SEGMENT_REACTIVATION (Niveau 2) — contexte de réactivation demandé.", async () => {
      const res = await evaluateScenario("AN-04", gtFixture("AN-04-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R403 AN-05 — Revenus entrants incohérents (mismatch)", () => {
    it("Given Un « salaire » mensuel de CHF 45k est crédité alors que le KYC déclare 12k et un autre employeur. When Croisement libellé/ordonnateur des entrées récurrentes × rémunération et employeur déclarés. Then Signal INCOME_MISMATCH (Niveau 2) — mise à jour KYC ou justification exigée (CoC).", async () => {
      const res = await evaluateScenario("AN-05", gtFixture("AN-05-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("Corpus GT — chaque cas (TP et FP) DOIT déclencher", () => {
    const cases = gtCases.filter(c => c.fam === "Analytique 2G");
    it.each(cases.map(c => [c.caseId, c.label] as const))("%s (%s) déclenche", async (caseId) => {
      const c = cases.find(x => x.caseId === caseId)!;
      const res = await evaluateScenario(c.scenarioId, gtFixture(c.caseId));
      expect(res.raised).toBe(true); // un FP est une alerte légitime écartée en investigation, pas une non-alerte
    });
  });
});