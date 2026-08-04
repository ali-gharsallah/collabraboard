// Bloc 59 — Prolifération (R393–R395) — TESTS ROUGES AVANT CODE (généré depuis gen_aml_gap.py)
import { evaluateScenario } from "../../src/aml/engine"; // à implémenter
import { gtFixture, gtCases } from "./fixtures";

describe("Bloc 59 — Prolifération", () => {
  describe("R393 PF-01 — Sanctions sectorielles & plafonds", () => {
    it("Given Un paiement pétrole affiche un prix au baril supérieur au plafond, assuré par un assureur non autorisé. When Contrôle sectoriel : produit × origine × prix vs plafond × services associés autorisés. Then TRANSACTION BLOQUÉE (Niveau 1) — violation sectorielle, escalade sanctions, décision humaine tracée.", async () => {
      const res = await evaluateScenario("PF-01", gtFixture("PF-01-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(true);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R394 PF-02 — Chaînes d'écrans corridors KP/IR", () => {
    it("Given Trois sociétés de trading créées < 12 mois s'intercalent entre un exportateur européen et un acheteur final opaque. When Score de chaîne : âge des entités × substance × secteur générique × corridor final. Then Signal PROLIF_CHAIN (Niveau 1) — identification du destinataire final exigée, escalade.", async () => {
      const res = await evaluateScenario("PF-02", gtFixture("PF-02-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R395 PF-03 — Biens de luxe vers zones embargo", () => {
    it("Given Des paiements de montres de haute horlogerie partent vers un relais d'Asie centrale, volume ×6 depuis l'embargo. When Volume par corridor relais × catégorie de biens embargo × croissance anormale post-sanctions. Then Signal LUXURY_EMBARGO (Niveau 2) — destinataire final et usage à corroborer.", async () => {
      const res = await evaluateScenario("PF-03", gtFixture("PF-03-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("Corpus GT — chaque cas (TP et FP) DOIT déclencher", () => {
    const cases = gtCases.filter(c => c.fam === "Prolifération");
    it.each(cases.map(c => [c.caseId, c.label] as const))("%s (%s) déclenche", async (caseId) => {
      const c = cases.find(x => x.caseId === caseId)!;
      const res = await evaluateScenario(c.scenarioId, gtFixture(c.caseId));
      expect(res.raised).toBe(true); // un FP est une alerte légitime écartée en investigation, pas une non-alerte
    });
  });
});