// Bloc 50 — Screening en flux (R340–R346) — TESTS ROUGES AVANT CODE (généré depuis gen_aml_gap.py)
import { evaluateScenario } from "../../src/aml/engine"; // à implémenter
import { gtFixture, gtCases } from "./fixtures";

describe("Bloc 50 — Screening en flux", () => {
  describe("R340 SF-01 — Contrepartie PEP en flux", () => {
    it("Given Un virement entrant de CHF 180k provient d'une contrepartie non cliente matchant une liste PEP (ministre en fonction, pays tiers). When Le screening en flux (nom + pays + date de naissance si dispo) matche la contrepartie avec un score ≥ seuil tenant. Then Signal PEP_COUNTERPARTY (Niveau 2) — alerte CO avec fiche de match, aucune contamination du statut client sans revue hum", async () => {
      const res = await evaluateScenario("SF-01", gtFixture("SF-01-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R341 SF-02 — Adverse media sur contrepartie", () => {
    it("Given Une sortie de CHF 60k vise une société citée la veille dans une enquête pour corruption (source de rang 1). When Le screening adverse media en flux matche la contrepartie avec une catégorie AML-pertinente et une source pondérée ≥ seuil. Then Signal ADVERSE_COUNTERPARTY (Niveau 2) — alerte avec extrait sourcé et daté ; l'humain qualifie.", async () => {
      const res = await evaluateScenario("SF-02", gtFixture("SF-02-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R342 SF-03 — Re-screening périodique (perpetual)", () => {
    it("Given Le batch nocturne re-screene 5'000 clients ; un client existant apparaît nouvellement sur une liste PEP suite à une nomination. When Le différentiel (nouveau hit vs dernier run) est détecté et rattaché au dossier. Then Événement screening.delta → ouverture automatique d'un Change of Circumstances typé SCREENING_DELTA, routé au rôle Compl", async () => {
      const res = await evaluateScenario("SF-03", gtFixture("SF-03-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R343 SF-04 — Banques intermédiaires (BIC)", () => {
    it("Given Un MT103 transite par une banque intermédiaire dont la maison mère est sous sanctions sectorielles. When Chaque BIC de la chaîne est screené contre les listes sanctions + liste interne banques à risque. Then Signal INTERMEDIARY_HIT (Niveau 2) — routage alternatif proposé, décision humaine avant exécution.", async () => {
      const res = await evaluateScenario("SF-04", gtFixture("SF-04-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R344 SF-05 — Adresse / localisation sanctionnée", () => {
    it("Given Un virement sortant indique une adresse bénéficiaire à Sébastopol. When Le parsing d'adresse (ville, région, code postal) matche le référentiel géographique sanctionné. Then TRANSACTION BLOQUÉE (Niveau 1) — motif géographique explicite, dossier MROS préparé, décision humaine requise (R44).", async () => {
      const res = await evaluateScenario("SF-05", gtFixture("SF-05-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(true);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R345 SF-06 — Translittération multi-scripts", () => {
    it("Given Un ordonnateur « Мухаммад Аль-Рашид » (cyrillique) correspond à un profil sanctionné translittéré « Muhammad Al-Rashid ». When La normalisation multi-scripts (ICU + tables de translittération) produit les variantes avant le matching baseline. Then Le hit est détecté malgré l'écart de script — signal standard du canal concerné, variante gagnante tracée.", async () => {
      const res = await evaluateScenario("SF-06", gtFixture("SF-06-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R346 SF-07 — Navires & IMO", () => {
    it("Given Un crédit documentaire référence un navire dont l'IMO figure sur la liste OFAC (shadow fleet). When Extraction du nom/IMO depuis les champs libres et les documents, screening dédié navires. Then TRANSACTION BLOQUÉE (Niveau 1) — gel, escalade sanctions, décision humaine requise.", async () => {
      const res = await evaluateScenario("SF-07", gtFixture("SF-07-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(true);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("Corpus GT — chaque cas (TP et FP) DOIT déclencher", () => {
    const cases = gtCases.filter(c => c.fam === "Screening en flux");
    it.each(cases.map(c => [c.caseId, c.label] as const))("%s (%s) déclenche", async (caseId) => {
      const c = cases.find(x => x.caseId === caseId)!;
      const res = await evaluateScenario(c.scenarioId, gtFixture(c.caseId));
      expect(res.raised).toBe(true); // un FP est une alerte légitime écartée en investigation, pas une non-alerte
    });
  });
});