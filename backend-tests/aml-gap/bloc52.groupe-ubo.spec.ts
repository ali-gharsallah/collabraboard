// Bloc 52 — Vision groupe UBO (R352–R355) — TESTS ROUGES AVANT CODE (généré depuis gen_aml_gap.py)
import { evaluateScenario } from "../../src/aml/engine"; // à implémenter
import { gtFixture, gtCases } from "./fixtures";

describe("Bloc 52 — Vision groupe UBO", () => {
  describe("R352 GU-01 — Structuring cross-comptes du groupe", () => {
    it("Given Un UBO contrôle 4 entités ; chacune dépose CHF 18k la même semaine (72k agrégés, unitaire sous le seuil de 20k). When Le moteur agrège par ubo_group_id (graphe des personnes liées) sur la fenêtre glissante. Then Signal GROUP_STRUCTURING (Niveau 2) — vue consolidée jointe, chaque entité référencée.", async () => {
      const res = await evaluateScenario("GU-01", gtFixture("GU-01-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R353 GU-02 — Flux circulaires intra-groupe", () => {
    it("Given CHF 300k font le tour de 3 entités du même UBO en 12 jours et reviennent au point de départ. When Détection de cycle sur le graphe restreint au périmètre UBO. Then Signal GROUP_CIRCULAR (Niveau 2) — demande de justification économique consolidée.", async () => {
      const res = await evaluateScenario("GU-02", gtFixture("GU-02-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R354 GU-03 — Cash consolidé du périmètre", () => {
    it("Given 5 entités du même UBO déposent chacune ~CHF 9k d'espèces par mois (45k/mois consolidés). When Ratio cash consolidé / volume consolidé du groupe, seuils par groupe CPSI. Then Signal GROUP_CASH_INTENSITY (Niveau 2) — ventilation par entité jointe.", async () => {
      const res = await evaluateScenario("GU-03", gtFixture("GU-03-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R355 GU-04 — Seuils agrégés cross-produits", () => {
    it("Given Dépôt cash 15k + transfert in-specie 40k + tirage lombard 30k la même semaine, aucun produit ne franchit seul son seuil. When Normalisation en équivalent CHF et agrégation cross-produits par client et par groupe UBO. Then Signal CROSS_PRODUCT_AGGREGATE (Niveau 2) — décomposition par produit jointe.", async () => {
      const res = await evaluateScenario("GU-04", gtFixture("GU-04-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("Corpus GT — chaque cas (TP et FP) DOIT déclencher", () => {
    const cases = gtCases.filter(c => c.fam === "Vision groupe UBO");
    it.each(cases.map(c => [c.caseId, c.label] as const))("%s (%s) déclenche", async (caseId) => {
      const c = cases.find(x => x.caseId === caseId)!;
      const res = await evaluateScenario(c.scenarioId, gtFixture(c.caseId));
      expect(res.raised).toBe(true); // un FP est une alerte légitime écartée en investigation, pas une non-alerte
    });
  });
});