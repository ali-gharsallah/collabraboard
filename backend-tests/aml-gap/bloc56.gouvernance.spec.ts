// Bloc 56 — Gouvernance du dispositif (R374–R377) — TESTS ROUGES AVANT CODE (généré depuis gen_aml_gap.py)
import { evaluateScenario } from "../../src/aml/engine"; // à implémenter
import { gtFixture, gtCases } from "./fixtures";

describe("Bloc 56 — Gouvernance du dispositif", () => {
  describe("R374 GV-01 — Below-the-line sampling", () => {
    it("Given Le trimestre écoulé compte 1'240 transactions entre 80% et 100% du seuil du scénario structuring. When La campagne BTL tire un échantillon stratifié (paramètre tenant) et le route en revue Compliance. Then Événement tuning.btl.campagne — résultats consolidés : si des TP sont trouvés sous le seuil, proposition de baisse via l", async () => {
      const res = await evaluateScenario("GV-01", gtFixture("GV-01-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(0);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R375 GV-02 — Backtesting par version", () => {
    it("Given Le seuil du scénario velocity est passé de 4× à 5× il y a 90 jours (v1.2). When Le backtest rejoue la fenêtre sur les deux versions et compare TP, FP, alertes manquées. Then Rapport de backtest versionné attaché à la version du scénario — rollback proposé si dégradation du rappel (décision hum", async () => {
      const res = await evaluateScenario("GV-02", gtFixture("GV-02-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(0);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R376 GV-03 — Data quality pré-conditions", () => {
    it("Given 8% des MT103 du jour arrivent sans champ ordonnateur exploitable. When Le contrôle DQ mesure la complétude des champs critiques par flux ; sous le seuil, les scénarios dépendants sont marqués « dégradés ». Then Signal DQ_DEGRADED (Niveau 1, ops) — visible au dashboard Compliance, jamais silencieux (esprit dead-letters R39).", async () => {
      const res = await evaluateScenario("GV-03", gtFixture("GV-03-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R377 GV-04 — Revue annuelle de calibrage", () => {
    it("Given L'exercice se clôt ; chaque scénario a un historique TP/FP et des versions. When La revue consolide couverture (matrice typologies GAFI × scénarios), performance et écarts. Then Rapport de calibrage annuel généré, visé four-eyes, archivé GED — section dédiée du rapport Direction.", async () => {
      const res = await evaluateScenario("GV-04", gtFixture("GV-04-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(0);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("Corpus GT — chaque cas (TP et FP) DOIT déclencher", () => {
    const cases = gtCases.filter(c => c.fam === "Gouvernance du dispositif");
    it.each(cases.map(c => [c.caseId, c.label] as const))("%s (%s) déclenche", async (caseId) => {
      const c = cases.find(x => x.caseId === caseId)!;
      const res = await evaluateScenario(c.scenarioId, gtFixture(c.caseId));
      expect(res.raised).toBe(true); // un FP est une alerte légitime écartée en investigation, pas une non-alerte
    });
  });
});