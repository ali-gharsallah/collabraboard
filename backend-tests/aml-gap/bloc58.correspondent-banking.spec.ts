// Bloc 58 — Correspondent Banking (R386–R392) — TESTS ROUGES AVANT CODE (généré depuis gen_aml_gap.py)
import { evaluateScenario } from "../../src/aml/engine"; // à implémenter
import { gtFixture, gtCases } from "./fixtures";

describe("Bloc 58 — Correspondent Banking", () => {
  describe("R386 CB-03 — Wire stripping / transparence", () => {
    it("Given Une série de MT103 d'un correspondant arrive avec le champ 50 réduit à des initiales. When Contrôle de complétude et de cohérence des champs de transparence par message et par correspondant (taux agrégé). Then Signal WIRE_STRIPPING (Niveau 1) — messages retenus, demande de complément au correspondant, taux suivi par répondant.", async () => {
      const res = await evaluateScenario("CB-03", gtFixture("CB-03-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R387 CB-04 — U-turn payments", () => {
    it("Given CHF 500k partent vers une banque du Golfe et reviennent 9 jours après via un correspondant européen, même bénéficiaire final. When Appariement sortie/entrée (montant, parties finales, fenêtre) à travers des chaînes de correspondance distinctes. Then Signal U_TURN (Niveau 2) — finalité du détour à justifier, analyse sanctions.", async () => {
      const res = await evaluateScenario("CB-04", gtFixture("CB-04-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R388 CB-05 — Payable-through accounts", () => {
    it("Given Des ordres au format client final (références retail) transitent par le compte nostro d'un répondant. When Détection de patterns d'usage direct (volumétrie retail, références client final) sur comptes de correspondance. Then Signal PAYABLE_THROUGH (Niveau 1) — clarification contractuelle avec le répondant, restriction possible après décision.", async () => {
      const res = await evaluateScenario("CB-05", gtFixture("CB-05-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R389 CB-06 — Volumétrie répondant vs profil (KYCC)", () => {
    it("Given Un répondant déclaré « domestique retail » envoie 40% de ses flux vers des corridors HRJ. When Comparaison flux réels (corridors, volumes, devises) vs profil CBDDQ déclaré, par période. Then Signal RESPONDENT_PROFILE_DRIFT (Niveau 2) — mise à jour du questionnaire exigée, revue de la relation.", async () => {
      const res = await evaluateScenario("CB-06", gtFixture("CB-06-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R390 CB-07 — Shell bank", () => {
    it("Given Un BIC de la chaîne appartient à un établissement sans adresse physique vérifiable ni superviseur identifiable. When Croisement BIC × registres de supervision × indicateurs de présence physique (référentiel tenant). Then TRANSACTION BLOQUÉE (Niveau 1) — interdiction légale, aucune dérogation, dossier sanctions/MROS selon le cas.", async () => {
      const res = await evaluateScenario("CB-07", gtFixture("CB-07-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(true);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R391 CB-08 — RMA sans flux ni justification", () => {
    it("Given Un RMA bilatéral est actif depuis 3 ans avec zéro message échangé. When Revue périodique des RMA : flux sur la période × justification métier enregistrée. Then Signal RMA_DORMANT (Niveau 1, ops) — proposition de résiliation, décision tracée.", async () => {
      const res = await evaluateScenario("CB-08", gtFixture("CB-08-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R392 CB-09 — Screening des répondantes (CBDDQ)", () => {
    it("Given L'actionnaire majoritaire d'un répondant est placé sous sanctions. When Re-screening périodique du répondant + UBO bancaires + dirigeants ; delta → revue. Then Signal RESPONDENT_HIT (Niveau 2) — comité correspondance, suspension possible après décision humaine.", async () => {
      const res = await evaluateScenario("CB-09", gtFixture("CB-09-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("Corpus GT — chaque cas (TP et FP) DOIT déclencher", () => {
    const cases = gtCases.filter(c => c.fam === "Correspondent Banking");
    it.each(cases.map(c => [c.caseId, c.label] as const))("%s (%s) déclenche", async (caseId) => {
      const c = cases.find(x => x.caseId === caseId)!;
      const res = await evaluateScenario(c.scenarioId, gtFixture(c.caseId));
      expect(res.raised).toBe(true); // un FP est une alerte légitime écartée en investigation, pas une non-alerte
    });
  });
});