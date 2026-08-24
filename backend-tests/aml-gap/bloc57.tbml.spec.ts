// Bloc 57 — TBML (R378–R385) — TESTS ROUGES AVANT CODE (généré depuis gen_aml_gap.py)
import { evaluateScenario } from "../../src/aml/engine"; // à implémenter
import { gtFixture, gtCases } from "./fixtures";

describe("Bloc 57 — TBML", () => {
  describe("R378 TB-01 — Surfacturation (over-invoicing)", () => {
    it("Given 8 paiements de factures d'import présentent un écart constant de +22% vs le prix de référence des biens (code HS). When Écart récurrent ≥ seuil entre montant payé et valeur de référence, sur ≥ N factures / 90j. Then Signal OVER_INVOICING (Niveau 2) — analyse trade finance, justificatifs contractuels et incoterms demandés.", async () => {
      const res = await evaluateScenario("TB-01", gtFixture("TB-01-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R379 TB-02 — Facturation multiple", () => {
    it("Given Deux paiements de CHF 140k référencent le même connaissement (B/L) à 3 semaines d'écart. When Déduplication des références documentaires (B/L, facture, conteneur) sur les paiements trade / 180j. Then Signal MULTIPLE_INVOICING (Niveau 2) — documents originaux exigés, vérification auprès du transporteur.", async () => {
      const res = await evaluateScenario("TB-02", gtFixture("TB-02-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R380 TB-03 — Prix hors benchmark (unit price)", () => {
    it("Given Des « composants électroniques » sont facturés CHF 2 pièce alors que le référentiel HS donne 40-60. When Prix unitaire vs distribution de référence du code HS ; écart au-delà des percentiles paramétrés. Then Signal UNIT_PRICE_ANOMALY (Niveau 2) — nature réelle des biens à corroborer.", async () => {
      const res = await evaluateScenario("TB-03", gtFixture("TB-03-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R381 TB-04 — Biens à double usage", () => {
    it("Given Un paiement finance des machines-outils de précision classées double usage vers un intermédiaire au pays tiers. When Classification des biens (HS + libellés) croisée avec les listes de contrôle des exportations et la destination finale. Then Signal DUAL_USE (Niveau 1) — licence d'exportation SECO à exiger avant exécution, escalade sanctions.", async () => {
      const res = await evaluateScenario("TB-04", gtFixture("TB-04-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R382 TB-05 — LC back-to-back / crédits doc HRJ", () => {
    it("Given Une LC est adossée à une seconde LC émise pour un intermédiaire offshore qui ne touche jamais la marchandise. When Détection de LC adossées × intermédiaires sans rôle logistique × juridictions de la chaîne. Then Signal BACK_TO_BACK_LC (Niveau 2) — substance de l'intermédiaire à démontrer.", async () => {
      const res = await evaluateScenario("TB-05", gtFixture("TB-05-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R383 TB-06 — Phantom shipping", () => {
    it("Given Un paiement de CHF 380k référence un conteneur dont le tracking ne montre aucun mouvement. When Vérification d'existence du voyage (API tracking conteneurs/navires) pour les paiements trade ≥ seuil. Then Signal PHANTOM_SHIPMENT (Niveau 1) — fonds gelés en attente de preuve d'expédition, EDD.", async () => {
      const res = await evaluateScenario("TB-06", gtFixture("TB-06-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(1);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R384 TB-07 — Routes & transbordements atypiques", () => {
    it("Given Une cargaison Rotterdam→Genève transite par 3 ports hors route avec 2 transbordements. When Score d'anomalie de route (détour, transbordements, arrêts en zones sensibles) sur les documents de transport. Then Signal ROUTE_ANOMALY (Niveau 2) — justification logistique demandée.", async () => {
      const res = await evaluateScenario("TB-07", gtFixture("TB-07-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("R385 TB-08 — Carrousel documentaire", () => {
    it("Given A vend à B, B revend à C, C revend à A des lots similaires à valeur croissante sur 4 mois. When Détection de cycles sur le graphe des contreparties trade × similarité des biens × inflation des montants. Then Signal TRADE_CAROUSEL (Niveau 2) — logique économique de la chaîne à démontrer.", async () => {
      const res = await evaluateScenario("TB-08", gtFixture("TB-08-C1"));
      expect(res.raised).toBe(true);
      expect(res.niveau).toBe(2);
      expect(res.blocking).toBe(false);
      expect(res.explanation.length).toBeGreaterThan(0); // R44 : explicable
    });
  });
  describe("Corpus GT — chaque cas (TP et FP) DOIT déclencher", () => {
    const cases = gtCases.filter(c => c.fam === "TBML");
    it.each(cases.map(c => [c.caseId, c.label] as const))("%s (%s) déclenche", async (caseId) => {
      const c = cases.find(x => x.caseId === caseId)!;
      const res = await evaluateScenario(c.scenarioId, gtFixture(c.caseId));
      expect(res.raised).toBe(true); // un FP est une alerte légitime écartée en investigation, pas une non-alerte
    });
  });
});