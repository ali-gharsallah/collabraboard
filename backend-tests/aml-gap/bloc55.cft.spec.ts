// Bloc 55 — CFT (R369–R373) — TESTS ROUGES AVANT CODE (généré depuis gen_aml_gap.py)
import { evaluateScenario } from "../../src/aml/engine"; // à implémenter
import { gtFixture, gtCases } from "./fixtures";

describe("Bloc 55 — CFT", () => {
  describe("R369 FT-01 — Micro-transactions vers corridors sensibles", () => {
    it("Given 23 transferts de CHF 150-400 en 60 jours vers 3 pays limitrophes d'une zone de conflit. When Fréquence × faible montant unitaire × corridor sensible (liste tenant distincte des HRJ blanchiment). Then Signal CFT_MICRO_PATTERN (Niveau 2) — analyse dédiée CFT, jamais agrégé avec les seuils ML classiques.", async () => {
      const res = await evaluateScenario("FT-01", gtFixture("FT-01-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R370 FT-02 — Collectes / ONG à risque", () => {
    it("Given Des dons partent vers une association récemment créée, sans agrément, active dans une zone à risque. When Croisement bénéficiaire ONG × registre des NPO à risque × ancienneté/agrément. Then Signal NPO_RISK (Niveau 2) — vérification de l'organisation et de la chaîne de distribution des fonds.", async () => {
      const res = await evaluateScenario("FT-02", gtFixture("FT-02-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R371 FT-03 — Cartes prépayées multi-sources", () => {
    it("Given Une carte est rechargée par 5 personnes différentes puis vidée en retraits ATM dans un pays frontalier d'une zone de conflit. When Nombre de sources de rechargement distinctes + géographie des retraits. Then Signal PREPAID_FUNDING (Niveau 2) — gel du rechargement tiers après décision humaine.", async () => {
      const res = await evaluateScenario("FT-03", gtFixture("FT-03-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R372 FT-04 — Cohérence voyages ↔ flux", () => {
    it("Given Un client retire du cash inhabituel juste avant un voyage déclaré vers un pays frontalier d'une zone de conflit. When Corrélation temporelle voyage déclaré/détecté × retraits cash atypiques × destination sensible. Then Signal TRAVEL_FLOW_MISMATCH (Niveau 2) — entretien de clarification, trace CFT dédiée.", async () => {
      const res = await evaluateScenario("FT-04", gtFixture("FT-04-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R373 FT-05 — Listes terroristes dédiées", () => {
    it("Given Une contrepartie matche une liste d'une ordonnance fédérale anti-terrorisme (hors listes SECO économiques). When Canal de screening dédié listes CFT, avec circuit d'escalade propre. Then TRANSACTION BLOQUÉE (Niveau 1) — gel immédiat, MROS, escalade direction, décision humaine tracée.", async () => {
      const res = await evaluateScenario("FT-05", gtFixture("FT-05-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(true);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("Corpus GT — chaque cas (TP et FP) DOIT déclencher", () => {
    const cases = gtCases.filter(c => c.fam === "CFT");
    it.each(cases.map(c => [c.caseId, c.label] as const))("%s (%s) déclenche", async (caseId) => {
      const c = cases.find(x => x.caseId === caseId)!;
      const res = await evaluateScenario(c.scenarioId, gtFixture(c.caseId));
      expect(res.raised).toBe(true); // un FP est une alerte légitime écartée en investigation, pas une non-alerte
    });
  });
});