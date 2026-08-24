// Bloc 54 — Crypto / VASP (R363–R368) — TESTS ROUGES AVANT CODE (généré depuis gen_aml_gap.py)
import { evaluateScenario } from "../../src/aml/engine"; // à implémenter
import { gtFixture, gtCases } from "./fixtures";

describe("Bloc 54 — Crypto / VASP", () => {
  describe("R363 CR-01 — Travel rule DLT", () => {
    it("Given Un transfert sortant de 0.8 BTC vise un VASP qui ne transmet pas les informations travel rule. When Contrôle de complétude des données travel rule avant exécution du transfert. Then TRANSFERT BLOQUÉ (Niveau 1) — jusqu'à réception des informations ou décision humaine documentée.", async () => {
      const res = await evaluateScenario("CR-01", gtFixture("CR-01-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(true);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R364 CR-02 — Exposition mixer / tumbler", () => {
    it("Given Un dépôt de 2.1 BTC provient à 64% d'un mixer connu (analyse de provenance). When Score d'exposition mixer du fournisseur d'analytique on-chain ≥ seuil (paramètre tenant, intégration Chainalysis/Elliptic). Then Signal MIXER_EXPOSURE (Niveau 1) — fonds gelés en attente d'explication, EDD.", async () => {
      const res = await evaluateScenario("CR-02", gtFixture("CR-02-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R365 CR-03 — Adresse sanctionnée on-chain", () => {
    it("Given Une adresse de destination correspond à une adresse SDN (entité de ransomware listée). When Screening des adresses contre les listes crypto SDN/SECO à l'initiation. Then TRANSFERT BLOQUÉ (Niveau 1) — gel, dossier sanctions, MROS préparé.", async () => {
      const res = await evaluateScenario("CR-03", gtFixture("CR-03-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(true);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R366 CR-04 — Cluster darknet / ransomware", () => {
    it("Given Provenance à 30% d'un cluster étiqueté darknet market par l'analytique on-chain. When Score de provenance par catégorie de cluster ≥ seuil. Then Signal ILLICIT_CLUSTER (Niveau 1) — fonds en quarantaine, investigation.", async () => {
      const res = await evaluateScenario("CR-04", gtFixture("CR-04-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R367 CR-05 — Wallet auto-hébergé sans preuve", () => {
    it("Given Le client demande une sortie de 50k CHF en ETH vers un wallet non custodial jamais vérifié. When Contrôle d'existence d'une preuve de contrôle valide pour l'adresse (registre des adresses vérifiées). Then SORTIE BLOQUÉE (Niveau 1) — jusqu'à preuve de contrôle (signature) enregistrée.", async () => {
      const res = await evaluateScenario("CR-05", gtFixture("CR-05-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(true);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R368 CR-06 — On/off-ramp incohérent au profil", () => {
    it("Given Un client « investisseur long terme » convertit fiat→crypto→fiat 14 fois en un mois. When Compteur de cycles on/off-ramp / 30j vs profil déclaré (au-delà du simple seuil CHF de l'ancienne règle AML-11). Then Signal RAMP_VELOCITY (Niveau 2) — revue du profil transactionnel crypto.", async () => {
      const res = await evaluateScenario("CR-06", gtFixture("CR-06-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("Corpus GT — chaque cas (TP et FP) DOIT déclencher", () => {
    const cases = gtCases.filter(c => c.fam === "Crypto / VASP");
    it.each(cases.map(c => [c.caseId, c.label] as const))("%s (%s) déclenche", async (caseId) => {
      const c = cases.find(x => x.caseId === caseId)!;
      const res = await evaluateScenario(c.scenarioId, gtFixture(c.caseId));
      expect(res.raised).toBe(true); // un FP est une alerte légitime écartée en investigation, pas une non-alerte
    });
  });
});