// Bloc 51 — Indices OBA-FINMA (R347–R351) — TESTS ROUGES AVANT CODE (généré depuis gen_aml_gap.py)
import { evaluateScenario } from "../../src/aml/engine"; // à implémenter
import { gtFixture, gtCases } from "./fixtures";

describe("Bloc 51 — Indices OBA-FINMA", () => {
  describe("R347 QO-01 — Refus de fournir des informations", () => {
    it("Given Le RM demande un justificatif d'origine pour un apport de CHF 500k ; le client refuse explicitement à deux reprises. When Le RM déclare le refus via le workflow dédié (motif, pièces demandées, dates) — événement kyc.refus_information. Then Signal INFO_REFUSAL (Niveau 2) — tâche CO, blocage possible de l'apport après décision humaine, trace au registre art. 7", async () => {
      const res = await evaluateScenario("QO-01", gtFixture("QO-01-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R348 QO-02 — Compte de passage multi-titulaires", () => {
    it("Given Un compte reçoit des fonds de 9 ordonnateurs distincts sans lien documenté en 30 jours, ressortis vers 6 bénéficiaires. When Comptage des tiers distincts entrée + sortie / fenêtre glissante, croisé avec les personnes liées du KYC. Then Signal TRANSIT_ACCOUNT (Niveau 2) — cartographie des tiers jointe, revue du but de la relation.", async () => {
      const res = await evaluateScenario("QO-02", gtFixture("QO-02-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R349 QO-03 — Opération sans justification économique", () => {
    it("Given Le RM constate un achat-revente de titres à perte immédiate entre comptes du même client, sans logique d'investissement. When Le RM soulève le red flag via le formulaire structuré (opération, constat, échange client) — événement rm.redflag. Then Signal NO_ECON_RATIONALE (Niveau 2) — investigation CO, réponse du client consignée.", async () => {
      const res = await evaluateScenario("QO-03", gtFixture("QO-03-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R350 QO-04 — Adresse partagée multi-clients", () => {
    it("Given 8 clients sans lien familial ni sociétal déclaré partagent la même adresse de domiciliation c/o une fiduciaire. When Normalisation d'adresse + comptage des clients distincts par adresse, seuil tenant. Then Signal SHARED_ADDRESS (Niveau 1) — revue du caractère de société de domicile (CDB 20, form. K).", async () => {
      const res = await evaluateScenario("QO-04", gtFixture("QO-04-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R351 QO-05 — Rotation des procurations / instructions", () => {
    it("Given 3 changements de fondé de pouvoir en 6 mois, dont un révoqué 2 semaines après nomination. When Comptage des événements de gouvernance du compte / fenêtre, croisé avec l'activité transactionnelle. Then Signal GOVERNANCE_CHURN (Niveau 2) — revue de la maîtrise réelle du compte (ADE effectif).", async () => {
      const res = await evaluateScenario("QO-05", gtFixture("QO-05-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("Corpus GT — chaque cas (TP et FP) DOIT déclencher", () => {
    const cases = gtCases.filter(c => c.fam === "Indices OBA-FINMA");
    it.each(cases.map(c => [c.caseId, c.label] as const))("%s (%s) déclenche", async (caseId) => {
      const c = cases.find(x => x.caseId === caseId)!;
      const res = await evaluateScenario(c.scenarioId, gtFixture(c.caseId));
      expect(res.raised).toBe(true); // un FP est une alerte légitime écartée en investigation, pas une non-alerte
    });
  });
});