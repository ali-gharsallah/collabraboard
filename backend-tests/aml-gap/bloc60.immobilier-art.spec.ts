// Bloc 60 — Immobilier & Art (R396–R398) — TESTS ROUGES AVANT CODE (généré depuis gen_aml_gap.py)
import { evaluateScenario } from "../../src/aml/engine"; // à implémenter
import { gtFixture, gtCases } from "./fixtures";

describe("Bloc 60 — Immobilier & Art", () => {
  describe("R396 IA-01 — Immobilier via structure + prix hors marché", () => {
    it("Given Un bien estimé CHF 2.1M est acquis 3.4M via une société des BVI financée depuis le compte. When Écart au prix de référence (m², registre) × acquisition via structure × origine du financement. Then Signal REAL_ESTATE_ANOMALY (Niveau 2) — expertise indépendante et SOW exigées.", async () => {
      const res = await evaluateScenario("IA-01", gtFixture("IA-01-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R397 IA-02 — Art & ports francs", () => {
    it("Given Une œuvre achetée CHF 900k est déposée en port franc puis revendue 15 mois après à une partie liée, +40%. When Cycle achat→port franc→revente × délai × lien entre parties × écart de prix. Then Signal ART_FREEPORT (Niveau 2) — provenance de l'œuvre et indépendance de l'acheteur à établir.", async () => {
      const res = await evaluateScenario("IA-02", gtFixture("IA-02-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R398 IA-03 — Véhicules de valeur (luxe, NFT)", () => {
    it("Given Trois véhicules de collection achetés et réexpédiés à l'étranger en 4 mois, revendus à des parties inconnues. When Fréquence d'achat/revente de biens de valeur × export × contreparties. Then Signal VALUE_VEHICLE (Niveau 2) — finalité patrimoniale vs circulation de valeur à clarifier.", async () => {
      const res = await evaluateScenario("IA-03", gtFixture("IA-03-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("Corpus GT — chaque cas (TP et FP) DOIT déclencher", () => {
    const cases = gtCases.filter(c => c.fam === "Immobilier & Art");
    it.each(cases.map(c => [c.caseId, c.label] as const))("%s (%s) déclenche", async (caseId) => {
      const c = cases.find(x => x.caseId === caseId)!;
      const res = await evaluateScenario(c.scenarioId, gtFixture(c.caseId));
      expect(res.raised).toBe(true); // un FP est une alerte légitime écartée en investigation, pas une non-alerte
    });
  });
});