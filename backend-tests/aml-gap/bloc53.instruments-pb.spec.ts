// Bloc 53 — Instruments PB (R356–R362) — TESTS ROUGES AVANT CODE (généré depuis gen_aml_gap.py)
import { evaluateScenario } from "../../src/aml/engine"; // à implémenter
import { gtFixture, gtCases } from "./fixtures";

describe("Bloc 53 — Instruments PB", () => {
  describe("R356 IP-01 — Lombard — remboursement par tiers", () => {
    it("Given Un lombard de CHF 800k est soldé 4 mois après tirage par un virement d'une société tierce inconnue du dossier. When Croisement remboursement anticipé × identité de l'ordonnateur × personnes liées du KYC. Then Signal LOMBARD_THIRD_PARTY (Niveau 2) — fonds en attente de documentation SOF avant mainlevée du nantissement.", async () => {
      const res = await evaluateScenario("IP-01", gtFixture("IP-01-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R357 IP-02 — Back-to-back loan", () => {
    it("Given Un dépôt de CHF 2M d'une entité des Caïmans garantit un prêt de 1.8M à une société suisse du même UBO. When Détection nantissement × prêt dont déposant et emprunteur partagent le périmètre UBO ou des liens déclarés/détectés. Then Signal BACK_TO_BACK (Niveau 1) — origine du dépôt à corroborer avant tout tirage, escalade EDD.", async () => {
      const res = await evaluateScenario("IP-02", gtFixture("IP-02-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R358 IP-03 — Wrapper assurance — prime hors profil", () => {
    it("Given Prime unique de CHF 1.5M pour un client au patrimoine déclaré de 900k. When Ratio prime / patrimoine déclaré + origine de la prime (compte tiers ?). Then Signal WRAPPER_PREMIUM (Niveau 2) — corroboration SOW avant acceptation du contrat.", async () => {
      const res = await evaluateScenario("IP-03", gtFixture("IP-03-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R359 IP-04 — Wrapper assurance — rachat précoce", () => {
    it("Given Rachat total à 7 mois d'une police à prime unique, pénalité de 4% acceptée sans négociation. When Délai souscription→rachat < seuil + acceptation de pénalité + bénéficiaire du rachat ≠ souscripteur. Then Signal EARLY_SURRENDER (Niveau 2) — investigation sur la finalité réelle du produit.", async () => {
      const res = await evaluateScenario("IP-04", gtFixture("IP-04-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R360 IP-05 — Changement de bénéficiaire post-souscription", () => {
    it("Given Le bénéficiaire passe du conjoint à une société étrangère 3 mois après souscription. When Événement de changement de bénéficiaire × délai × nature du nouveau bénéficiaire. Then Signal BENEFICIARY_SWITCH (Niveau 2) — justification requise, CoC ouvert.", async () => {
      const res = await evaluateScenario("IP-05", gtFixture("IP-05-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R361 IP-06 — Coffres — corrélation cash", () => {
    it("Given 6 accès au coffre en 2 mois, chacun suivi sous 24h d'un dépôt espèces de 15-19k. When Corrélation temporelle accès coffre × mouvements cash / fenêtre. Then Signal VAULT_CASH_PATTERN (Niveau 2) — entretien client et corroboration d'origine.", async () => {
      const res = await evaluateScenario("IP-06", gtFixture("IP-06-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R362 IP-07 — Métaux précieux physiques", () => {
    it("Given Achat de 12 kg d'or physique avec livraison hors banque, client sans profil métaux. When Volume métaux / profil déclaré + mode de livraison (garde vs sortie physique). Then Signal PHYSICAL_METALS (Niveau 2) — sortie physique documentée, destination tracée.", async () => {
      const res = await evaluateScenario("IP-07", gtFixture("IP-07-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("Corpus GT — chaque cas (TP et FP) DOIT déclencher", () => {
    const cases = gtCases.filter(c => c.fam === "Instruments PB");
    it.each(cases.map(c => [c.caseId, c.label] as const))("%s (%s) déclenche", async (caseId) => {
      const c = cases.find(x => x.caseId === caseId)!;
      const res = await evaluateScenario(c.scenarioId, gtFixture(c.caseId));
      expect(res.raised).toBe(true); // un FP est une alerte légitime écartée en investigation, pas une non-alerte
    });
  });
});