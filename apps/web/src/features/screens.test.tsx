import React from "react";
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { WorkflowInstances } from "./workflow/WorkflowInstances";
import { Tasks } from "./tasks/Tasks";
import { Ports } from "./ports/Ports";
import { NextBestAction } from "./nba/NextBestAction";
import { Formations } from "./formations/Formations";
import { BusinessTrip } from "./businesstrip/BusinessTrip";
import { CpsiProfiling } from "./cpsi/CpsiProfiling";
import { CpsiSegmentation } from "./cpsi/CpsiSegmentation";
import { CpsiRiskCases } from "./cpsi/CpsiRiskCases";
import { CpsiParam } from "./cpsi/CpsiParam";
import { CpsiGuide } from "./cpsi/CpsiGuide";
import { SandboxOnboarding } from "./onboarding/SandboxOnboarding";
import { Home } from "./home/Home";
import { Offboarding } from "./offboarding/Offboarding";
import { Olivia } from "./olivia/Olivia";
import { ClientsList } from "./clients/ClientsList";
import { KycDetail } from "./kyc/KycDetail";
import { TransfertsOrdres } from "./transactions/TransfertsOrdres";

// Tests de composants (A1/D3 : Testing Library + MSW) sur les blocs FE nouveaux.
// FE-05 (écran sans service ratifié → seed lecture seule), FE-10 (Ports refus gracieux),
// FE-40 (NBA : suggestion en lecture, décision désactivée car route non ratifiée).

const server = setupServer();
type W = typeof globalThis & { OLIVE_API_URL?: string };
const w = globalThis as W;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); cleanup(); w.OLIVE_API_URL = undefined; });
afterAll(() => server.close());
beforeEach(() => { w.OLIVE_API_URL = undefined; });

describe("FE-TASK — Tâches : liste scopée serveur + complétion (FE-30..32, MOD R239→R242)", () => {
  it("affiche les tâches servies par l'API et propose Compléter sur une tâche OPEN", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(http.get("*/v1/tasks", () => HttpResponse.json([
      { id: "t1", type: "REVUE_KYC", assignee: "u1", subjectId: "kyc-1", echeance: "2026-08-01", statut: "OPEN", completedBy: null },
    ])));
    render(<Tasks/>);
    expect(await screen.findByText("REVUE_KYC")).toBeInTheDocument();          // dossier depuis l'API
    expect(screen.getByRole("button", { name: /Compléter/i })).toBeInTheDocument();
  });
});

describe("FE-WFI — Workflow Instances : liste → détail (visas R15) + timeline acteur (FE-20/21) + rejeu asOf (FE-23)", () => {
  it("ouvre le détail (steps, visa R15, timeline avec acteur), puis rejoue en lecture seule (asOf)", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(
      http.get("*/v1/workflow-instances/:id/events", () => HttpResponse.json([
        { type: "kyc.created", at: "2026-07-01T10:00:00Z", acteur: null },
        { type: "kyc.lock.acquired", at: "2026-07-02T09:00:00Z", acteur: "u-co" },
      ])),
      http.get("*/v1/workflow-instances/:id", ({ request }) => {
        const asOf = new URL(request.url).searchParams.get("asOf");
        if (asOf) return HttpResponse.json({ id: "i1", code: "WF-1", type: "KYC:CDD", subjectRef: "c1", status: "EN_COURS",
          currentStep: "EN_COURS", existeADate: true, lectureSeule: true, asOf, steps: [{ code: "IDENTITY", label: "Identité", ordre: 0 }], visas: [] });
        return HttpResponse.json({ id: "i1", code: "WF-1", type: "KYC:CDD", subjectRef: "c1", status: "IN_PROGRESS", currentStep: "Collecte", revision: 1,
          steps: [{ code: "IDENTITY", label: "Identité", ordre: 0 }],
          visas: [{ section: "IDENTITY", roleRequis: "CO", statut: "SIGNED", signePar: "u-co", signeAt: "2026-07-02T09:00:00Z", verdict: "OK" }] });
      }),
      http.get("*/v1/workflow-instances", () => HttpResponse.json([
        { id: "i1", code: "WF-1", type: "KYC:CDD", subjectRef: "c1", status: "IN_PROGRESS", currentStep: "Collecte", visas: "1/2", revision: 1 },
      ])),
    );
    render(<WorkflowInstances/>);
    fireEvent.click(await screen.findByText("WF-1"));
    expect(await screen.findByText(/Identité/)).toBeInTheDocument();          // step
    expect(screen.getByText(/signé par u-co/)).toBeInTheDocument();           // visa R15 signataire
    expect(screen.getByText("kyc.lock.acquired")).toBeInTheDocument();        // FE-20 : événement porteur d'acteur
    expect(screen.getAllByText(/par u-co/).length).toBeGreaterThanOrEqual(2); // acteur affiché (visa + timeline)
    // FE-23 : rejeu à date → lecture seule
    fireEvent.change(screen.getByDisplayValue(""), { target: { value: "2026-06-15" } });
    fireEvent.click(screen.getByRole("button", { name: /Rejouer/i }));
    expect(await screen.findByText(/Vue historique — lecture seule/)).toBeInTheDocument();
  });
});

describe("FE-10 — Ports : refus gracieux, aucun secret", () => {
  it("un port NOT_CONFIGURED affiche le refus gracieux, sans requête externe", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(http.get("*/v1/ports", () => HttpResponse.json([
      { portId: "core-banking", label: "Core banking (Avaloq / Temenos / Olympic-ERI)", status: "NOT_CONFIGURED", regle: "R167", lastCheckAt: "" },
      { portId: "ia", label: "Prestataire IA", status: "NOT_CONFIGURED", regle: "R163", lastCheckAt: "" },
    ])));
    render(<Ports/>);
    expect(await screen.findByText(/Core banking/)).toBeInTheDocument();
    expect(screen.getAllByText(/Port non configuré/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("NOT_CONFIGURED").length).toBeGreaterThan(0);
  });
});

describe("FE-FORM — Formations : catalogue + dossiers depuis l'API (MOD-43)", () => {
  it("affiche le catalogue tenant et les assignations servies par l'API", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(
      http.get("*/v1/formations/catalog", () => HttpResponse.json([{ code: "AML_ANNUELLE", libelle: "AML annuelle", validiteMois: 12 }])),
      http.get("*/v1/formations/assignments", () => HttpResponse.json([
        { id: "a1", userId: "u1", formationCode: "AML_ANNUELLE", echeance: "2026-12-31", statut: "ASSIGNED", visaStatut: null },
      ])),
    );
    render(<Formations/>);
    expect(await screen.findByText(/AML annuelle/)).toBeInTheDocument();       // catalogue tenant (R231)
    expect(await screen.findByText("ASSIGNED")).toBeInTheDocument();           // dossier depuis l'API
    expect(screen.getByRole("button", { name: /Déposer l'attestation/i })).toBeInTheDocument();
  });
});

describe("FE-TRIP — Business Trip : liste → détail (avis INTERDITE affiché, l'approbateur décide)", () => {
  it("affiche l'avis cross-border rouge sans bloquer le panneau visas", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(
      http.get("*/v1/trips/:id", () => HttpResponse.json({
        id: "t1", status: "PENDING_APPROVAL", dateStart: "2026-08-01", dateEnd: "2026-08-05", destinations: ["SA"], clients: [], revision: 1,
        advisories: [{ jurisdiction: "SA", activite: "sollicitation", verdict: "INTERDITE", referentielVersion: "2026-01-01" }],
        signals: [], visas: [{ role: "DIR", status: "PENDING", signedBy: null, signedAt: null }],
      })),
      http.get("*/v1/trips", () => HttpResponse.json([
        { id: "t1", status: "PENDING_APPROVAL", dateStart: "2026-08-01", dateEnd: "2026-08-05", destinations: ["SA"], clients: [], revision: 1 },
      ])),
    );
    render(<BusinessTrip/>);
    fireEvent.click(await screen.findByText(/PENDING_APPROVAL/));
    expect(await screen.findByText("INTERDITE")).toBeInTheDocument();          // avis affiché
    expect(screen.getByText("DIR")).toBeInTheDocument();                       // panneau visas actif (la décision reste humaine)
  });
});

describe("FE-40 — NBA : suggestion décidable (R244/R245), décision humaine active (FE-40..43)", () => {
  it("charge les suggestions PROPOSED et propose Accepter/Ajuster/Rejeter", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(http.get("*/v1/nba", () => HttpResponse.json([
      { id: "s1", contexte: "client", subjectId: "c1", proposition: "Déclencher revue EDD", facteurs: ["pep", "hri"], statut: "PROPOSED", decision: null },
    ])));
    render(<NextBestAction/>);
    expect(await screen.findByText(/Déclencher revue EDD/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accepter" })).toBeEnabled();   // décision désormais ratifiée (R244)
    expect(screen.getByRole("button", { name: "Rejeter" })).toBeEnabled();
  });
});

describe("FE-CPSI — porte CPSI : profil (drivers R67), segmentation (R65), alertes/risk cases (R80/R83)", () => {
  it("CPSI Profil : charge le score d'un client et affiche ses drivers explicables", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(http.get("*/v1/cpsi/clients/:cid/score", () => HttpResponse.json({
      clientId: "c-1", score: 40, bande: "MEDIUM", drivers: [{ source: "statique:pep", contribution: 15 }, { source: "hit_screening@J-10", contribution: 25 }] })));
    render(<CpsiProfiling/>);
    fireEvent.change(screen.getByPlaceholderText(/Identifiant client/i), { target: { value: "c-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Charger le score/i }));
    expect(await screen.findByText("40")).toBeInTheDocument();                 // score du moteur
    expect(screen.getByText("MEDIUM")).toBeInTheDocument();                    // bande R66
    expect(screen.getByText("statique:pep")).toBeInTheDocument();              // driver explicable R67
  });

  it("CPSI Segmentation : affiche les segments déterministes servis par la porte", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(http.get("*/v1/cpsi/segmentation", () => HttpResponse.json({
      asOf: null, segments: [{ client: "c-1", segment: "H-INTENSE" }, { client: "c-2", segment: "B-CALME" }] })));
    render(<CpsiSegmentation/>);
    expect(await screen.findByText("H-INTENSE")).toBeInTheDocument();
    expect(screen.getByText("B-CALME")).toBeInTheDocument();
  });

  it("CPSI Risk cases : alertes scorées + émission de case_proposal (R252 — riskcases instruit)", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(
      http.get("*/v1/cpsi/alerts", () => HttpResponse.json({
        signaux: [{ client: "c-1", scenario: "SC_STRUCT", groupe: "PEP", score: 72, statut: "ALERTE" }],
        alertes: [{ client: "c-1", scenario: "SC_STRUCT", groupe: "PEP", score: 72, statut: "ALERTE" }], nearMiss: [],
        correlations: { "c-1": ["SC_STRUCT", "SC_WIRES"] } })),
      http.get("*/v1/cpsi/case-proposals", () => HttpResponse.json([
        { client: "c-1", scenarios: ["SC_STRUCT", "SC_WIRES"], cle: "c-1|SC_STRUCT+SC_WIRES", emisePar: "u1", at: "2026-07-27" }])),
    );
    render(<CpsiRiskCases/>);
    expect(await screen.findByText("SC_STRUCT")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();                        // score du signal
    expect(screen.getByRole("button", { name: /Émettre les propositions/i })).toBeEnabled();  // émission R252
    expect(await screen.findByText(/SC_STRUCT \+ SC_WIRES/)).toBeInTheDocument();             // proposition listée
    expect(screen.queryByRole("button", { name: /Ouvrir un case/i })).toBeNull();             // PC-11 : plus de surface directe
  });

  it("CPSI Barèmes : « Proposer » VERROUILLÉ tant que les valeurs saisies ne sont pas simulées (R70)", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(
      http.get("*/v1/cpsi/rules", () => HttpResponse.json({ asOf: null, regles: ["Half-life : 180 jours (R64)."] })),
      http.get("*/v1/cpsi/params/proposals", () => HttpResponse.json([
        { id: "PROP-1", auteur: "olivia", chemin: "half_life_jours", valeur: 90, justification: "test", statut: "EN_ATTENTE",
          impact: { delta_moyen: -4, clients_evalues: 10, nouveaux_high: 0, charge_revues_induite: 1, franchissements: [] } }])),
      http.get("*/v1/cpsi/health", () => HttpResponse.json({ contractVersion: "1", profondeurJournal: 5, dernierRejeuMs: 3, rejeuHorsSeuil: false, configEnVigueur: "base" })),
      http.post("*/v1/cpsi/sandbox/simulate", () => HttpResponse.json({ delta_moyen: -2.1, clients_evalues: 10, nouveaux_high: 0, charge_revues_induite: 0, franchissements: [] })),
    );
    render(<CpsiParam/>);
    expect(await screen.findByText(/journal : 5 évts/)).toBeInTheDocument();                  // fetches stabilisés (santé mockée)
    expect(await screen.findByText(/Half-life : 180 jours/)).toBeInTheDocument();             // R68 : règles en clair
    fireEvent.change(screen.getByPlaceholderText(/chemin/i), { target: { value: "half_life_jours" } });
    fireEvent.change(screen.getByPlaceholderText(/valeur/i), { target: { value: "90" } });
    expect(screen.getByRole("button", { name: "Proposer" })).toBeDisabled();                  // R70 : verrouillé avant simulation
    fireEvent.click(screen.getByRole("button", { name: /Simuler l'impact/i }));
    expect(await screen.findByText(/Rapport d'impact/)).toBeInTheDocument();                  // dry-run affiché
    expect(screen.getByRole("button", { name: "Proposer" })).toBeEnabled();                   // déverrouillé pour CES valeurs
    fireEvent.change(screen.getByPlaceholderText(/valeur/i), { target: { value: "120" } });
    expect(screen.getByRole("button", { name: "Proposer" })).toBeDisabled();                  // re-verrouillé si valeurs modifiées
    expect(screen.getByRole("button", { name: "Adopter" })).toBeEnabled();                    // R69 : décision humaine sur EN_ATTENTE
    expect(screen.getByRole("button", { name: "Rejeter" })).toBeEnabled();
  });

  it("CPSI Guide : ancré sur le réel — règles R68 + catalogue R79 servis par la porte", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(
      http.get("*/v1/cpsi/rules", () => HttpResponse.json({ asOf: null, regles: ["Half-life : 90 jours (config tenant)."] })),
      http.get("*/v1/cpsi/compliance-catalogue", () => HttpResponse.json({ asOf: null, catalogue: [
        { id: "SC_X", label: "Structuration PEP", domaine: "Tx", champ_label: "Score de structuration",
          champ_formule: "Indice de fractionnement.", operateur: "≥", seuils: { PEP: 60 }, groupes: ["PEP"] }] })),
    );
    render(<CpsiGuide/>);
    expect(await screen.findByText(/Half-life : 90 jours/)).toBeInTheDocument();  // règles LIVE, pas statiques
    expect(await screen.findByText("Structuration PEP")).toBeInTheDocument();     // catalogue R79
    expect(screen.getByText(/PEP ≥ 60/)).toBeInTheDocument();                     // seuil par groupe en clair
    expect(screen.getByText("Signal scoré")).toBeInTheDocument();                 // vocabulaire ratifié
  });
});

describe("FE-SBONB — Bac à sable Onboarding : dry-run d'un seuil SLA (R94, impact nominatif)", () => {
  it("simule un seuil et montre les entrées en dépassement NOMMÉES, avec écriture=false", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(http.post("*/v1/onboarding/sandbox", () => HttpResponse.json({
      override: { etape: "COLLECTE", valeurActuelle: 30, valeurSimulee: 15 }, ecriture: false,
      totaux: { avant: 0, apres: 1, nouveaux: 1, disparus: 0 },
      nouveaux: [{ onboardingId: "o1", prospect: "Prospect Vingt Jours", etape: "COLLECTE", jours: 20, seuil: 15 }],
      disparus: [] })));
    render(<SandboxOnboarding/>);
    fireEvent.click(screen.getByRole("button", { name: /Simuler \(dry-run\)/i }));
    expect(await screen.findByText("Prospect Vingt Jours")).toBeInTheDocument();  // impact NOMINATIF
    expect(screen.getByText(/20 j/)).toBeInTheDocument();
    expect(screen.getByText(/écriture : false/)).toBeInTheDocument();             // R70/R94 : dry-run prouvé à l'écran
  });
});

describe("FE-HOME — l'accueil est une projection par rôle (HO-01/04/06/08 côté composant)", () => {
  type WS = typeof globalThis & { OLIVE_API_URL?: string; OLIVE_SESSION?: { role?: string } };
  const ws = globalThis as WS;
  afterEach(() => { ws.OLIVE_SESSION = undefined; });

  it("HO-01/08 : CO voit ses tuiles, les compteurs viennent de l'API telle quelle, AUCUNE requête non-GET", async () => {
    ws.OLIVE_API_URL = "http://api.test"; ws.OLIVE_SESSION = { role: "CO" };
    // MSW en onUnhandledRequest:error : tout POST/PUT (ou appel imprévu) ferait ÉCHOUER le test (HO-08).
    server.use(
      http.get("*/v1/modules/actifs", () => HttpResponse.json({ enforcement: false, modules: null })),
      http.get("*/v1/kyc/visas/pending", () => HttpResponse.json([{ kycCode: "K-1", section: "IDENTITY", requiredRole: "CO" }])),
      http.get("*/v1/reviews/deadlines", () => HttpResponse.json([{ clientId: "c1", ddlLevel: "EDD", dueDate: "2026-06-01", enRetard: true, joursRetard: 56 }])),
      http.get("*/v1/kyc", () => HttpResponse.json([{ code: "K-1", status: "UNDER_REVIEW" }, { code: "K-2", status: "UNDER_REVIEW" }, { code: "K-3", status: "IN_PROGRESS" }])),
      http.get("*/v1/tasks", () => HttpResponse.json([])),
      http.get("*/v1/cpsi/alerts", () => HttpResponse.json({ alertes: [{ client: "c1" }] })),
      http.get("*/v1/riskcases", () => HttpResponse.json([{ id: "rc1", statut: "NOUVELLE" }])),
      http.get("*/v1/olivia/proposals", () => HttpResponse.json([])),
    );
    render(<Home/>);
    expect(await screen.findByText("K-1 · IDENTITY")).toBeInTheDocument();     // T2 en premier, nominatif
    expect((await screen.findAllByText((_, el) => el?.tagName === "DIV" && el.textContent === "UNDER_REVIEW : 2")).length).toBeGreaterThanOrEqual(1);   // T1 : compteur = réponse API telle quelle
    expect(screen.getAllByText((_, el) => el?.tagName === "DIV" && el.textContent === "IN_PROGRESS : 1").length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText("Aucun élément")).length).toBeGreaterThanOrEqual(1);  // vide réel ≠ indisponible
  });

  it("HO-04 : une source en panne affiche « indisponible » (pas 0), les autres tuiles vivent", async () => {
    ws.OLIVE_API_URL = "http://api.test"; ws.OLIVE_SESSION = { role: "CO" };
    server.use(
      http.get("*/v1/modules/actifs", () => HttpResponse.json({ enforcement: false, modules: null })),
      http.get("*/v1/kyc/visas/pending", () => HttpResponse.json([])),
      http.get("*/v1/reviews/deadlines", () => HttpResponse.json([])),
      http.get("*/v1/kyc", () => HttpResponse.json([{ code: "K-1", status: "DRAFT" }])),
      http.get("*/v1/tasks", () => HttpResponse.json([])),
      http.get("*/v1/cpsi/alerts", () => HttpResponse.json({ alertes: [] })),
      http.get("*/v1/riskcases", () => new HttpResponse(null, { status: 500 })),   // T5 en panne
      http.get("*/v1/olivia/proposals", () => HttpResponse.json([])),
    );
    render(<Home/>);
    expect(await screen.findByText("indisponible")).toBeInTheDocument();       // T5 : un état, pas une donnée
    expect(screen.getByRole("button", { name: /réessayer/i })).toBeInTheDocument();
    expect((await screen.findAllByText((_, el) => el?.tagName === "DIV" && el.textContent === "DRAFT : 1")).length).toBeGreaterThanOrEqual(1);     // T1 vit normalement
  });

  it("HO-06 : ADMIN ne voit que Tâches + Santé CPSI — aucune tuile client, aucun appel client", async () => {
    ws.OLIVE_API_URL = "http://api.test"; ws.OLIVE_SESSION = { role: "ADMIN" };
    // SEULS ces handlers existent : un appel KYC/AML/clients déclencherait onUnhandledRequest:error.
    server.use(
      http.get("*/v1/modules/actifs", () => HttpResponse.json({ enforcement: false, modules: null })),
      http.get("*/v1/tasks", () => HttpResponse.json([])),
      http.get("*/v1/cpsi/health", () => HttpResponse.json({ profondeurJournal: 7, dernierRejeuMs: 4 })),
    );
    render(<Home/>);
    expect(await screen.findByText(/journal :/)).toBeInTheDocument();          // T9 présent
    expect(screen.getByText("Tâches ouvertes")).toBeInTheDocument();           // T3 présent
    expect(screen.queryByText("Mes dossiers KYC")).toBeNull();                 // tuiles client ABSENTES du DOM
    expect(screen.queryByText("Visas en attente de moi")).toBeNull();
    expect(screen.queryByText("Risk cases")).toBeNull();
  });
});

describe("FE-OFFB — Offboarding : workflow rendu, obstacles servis, cloisonnement R270, bannières R267 (canon partie 5)", () => {
  it("liste + détail : obstacles R269 EN DIRECT, panneau sensible ABSENT du DOM quand le backend ne le sert pas", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(
      http.get("*/v1/offboarding/OFF-1", () => HttpResponse.json({
        id: "OFF-1", clientId: "c1", type: "EXIT_COMPLIANCE", motif: "Décision de l'établissement",
        statut: "EN_CLOTURE", obstacles: ["risk case ouvert RC-9 (EN_ANALYSE)", "avoirs : attestation manuelle visée requise (port core banking absent)"],
        initiateur: "u1", documents: [], visas: [{ role: "CO_SR", statut: "SIGNED" }, { role: "DIR", statut: "PENDING" }],
        attestationAvoirs: null, createdAt: "2026-07-27" })),                   // PAS de motifSensible : rôle non habilité
      http.get("*/v1/offboarding", () => HttpResponse.json([
        { id: "OFF-1", clientId: "c1", type: "EXIT_COMPLIANCE", statut: "EN_CLOTURE", createdAt: "2026-07-27" }])),
    );
    render(<Offboarding/>);
    expect(await screen.findByText("EXIT_COMPLIANCE")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Détail" }));
    expect(await screen.findByText(/risk case ouvert RC-9/)).toBeInTheDocument();       // checklist servie, tous les obstacles
    expect(screen.getByText(/attestation manuelle visée requise/)).toBeInTheDocument();
    expect(screen.getByText(/Motif : Décision de l'établissement/)).toBeInTheDocument(); // motif générique
    expect(screen.queryByTestId("panneau-sensible")).toBeNull();                        // R270 : ABSENT du DOM (servi conditionnellement)
    expect(screen.getByText(/✓ CO_SR/)).toBeInTheDocument();                            // visas du type (R268)
  });

  it("rôle habilité : le panneau sensible existe UNIQUEMENT parce que le backend a servi la clé", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(
      http.get("*/v1/offboarding/OFF-2", () => HttpResponse.json({
        id: "OFF-2", clientId: "c2", type: "EXIT_COMPLIANCE", motif: "Décision de l'établissement",
        statut: "CLOTUREE", obstacles: [], initiateur: "u1", documents: [], visas: [],
        clotureEffectiveAt: "2026-07-27T10:00:00Z", retentionJusqua: "2036-07-27",
        motifSensible: "Soupçon art. 305bis CP", mrosRef: "mros-44", createdAt: "2026-07-27" })),
      http.get("*/v1/offboarding", () => HttpResponse.json([
        { id: "OFF-2", clientId: "c2", type: "EXIT_COMPLIANCE", statut: "CLOTUREE", createdAt: "2026-07-27",
          clotureEffectiveAt: "2026-07-27T10:00:00Z", retentionJusqua: "2036-07-27" }])),
    );
    render(<Offboarding/>);
    expect(await screen.findByText("EXIT_COMPLIANCE")).toBeInTheDocument();   // données réelles chargées (pas le seed)
    fireEvent.click(screen.getByRole("button", { name: "Détail" }));
    expect(await screen.findByTestId("panneau-sensible")).toBeInTheDocument();
    expect(screen.getByText(/305bis/)).toBeInTheDocument();
    expect(screen.getByText(/rétention jusqu'au 2036-07-27/)).toBeInTheDocument();      // post-clôture : bannière lecture seule
  });

  it("bannières R267 (critère 5.6-4) : client, KYC et comptes affichent « lecture seule » quand le backend dit CLOTUREE", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(
      http.get("*/v1/offboarding/statut/*", () => HttpResponse.json(
        { cloture: true, le: "2026-07-27T10:00:00Z", retentionJusqua: "2036-07-27", type: "DECISION_BANQUE" })),
      http.get("*/v1/clients", () => HttpResponse.json({ data: [
        { id: "c1", name: "Suzuki Ltd", structure: "PP", country: "CH", riskLevel: "LOW" }] })),
      http.get("*/v1/kyc/K-1", () => HttpResponse.json({ code: "K-1", clientId: "c1", workflow: "SDD",
        riskScore: 5, status: "VALIDATED", sections: [], visas: [] })),
    );
    render(<ClientsList/>);                                                            // écran CLIENT
    fireEvent.click(await screen.findByText("Suzuki Ltd"));
    expect(await screen.findByTestId("banniere-cloture")).toBeInTheDocument();
    cleanup();
    render(<KycDetail code="K-1"/>);                                                   // écran KYC
    expect(await screen.findByTestId("banniere-cloture")).toBeInTheDocument();
    cleanup();
    render(<TransfertsOrdres/>);                                                       // écran COMPTES/ordres
    fireEvent.change(screen.getByPlaceholderText("clientId"), { target: { value: "c1" } });
    expect(await screen.findByTestId("banniere-cloture")).toBeInTheDocument();
    expect(screen.getAllByText(/lecture seule/).length).toBeGreaterThanOrEqual(1);
  });
});

describe("FE-OLIVIA — écran Olivia : badge sourcé, proposer verrouillé sans source, audit rejoué (étape 8, B.8)", () => {
  it("réponse SOURCÉE : badge « Sourcé », citations affichées, carte proposition disponible (C3)", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(
      http.get("*/v1/olivia/proposals*", () => HttpResponse.json([])),
      http.post("*/v1/olivia/conversations/CONV-1/messages", () => HttpResponse.json({
        conversationId: "CONV-1", messageId: "MSG-1", seq: 2, texte: "Le schéma est bénin.", estSource: true,
        citations: [{ type: "RISK_CASE", ref: "rc-1", assertion: "cas ouvert", valide: true }],
        contexteEmpreinte: "abc123", contextePartiel: null, model: "m" })),
      http.post("*/v1/olivia/conversations", () => HttpResponse.json({ id: "CONV-1" })),
    );
    render(<Olivia/>);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "C3" } });
    fireEvent.change(screen.getByPlaceholderText(/ancrage RISK_CASE/), { target: { value: "rc-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Ouvrir la conversation ancrée/ }));
    expect(await screen.findByText(/Conversation CONV-1/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("votre question"), { target: { value: "Qualifie" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText("Sourcé")).toBeInTheDocument();                  // badge R256 (vérité serveur)
    expect(screen.getByText(/✓ RISK_CASE:rc-1/)).toBeInTheDocument();               // citation vérifiée
    expect(screen.getByRole("button", { name: "Proposer" })).toBeInTheDocument();   // proposable (C3 sourcée)
  });

  it("réponse NON sourcée : badge d'alerte, bouton « Proposer » ABSENT du DOM (B.6)", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(
      http.get("*/v1/olivia/proposals*", () => HttpResponse.json([])),
      http.post("*/v1/olivia/conversations/CONV-2/messages", () => HttpResponse.json({
        conversationId: "CONV-2", messageId: "MSG-2", seq: 2, texte: "Affirmation sans source.", estSource: false,
        citations: [], contexteEmpreinte: "e", contextePartiel: "Réponse fondée sur un contexte partiel : 1 objet(s) exclu(s)", model: "m" })),
      http.post("*/v1/olivia/conversations", () => HttpResponse.json({ id: "CONV-2" })),
    );
    render(<Olivia/>);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "C3" } });
    fireEvent.change(screen.getByPlaceholderText(/ancrage RISK_CASE/), { target: { value: "rc-2" } });
    fireEvent.click(screen.getByRole("button", { name: /Ouvrir la conversation ancrée/ }));
    await screen.findByText(/Conversation CONV-2/);
    fireEvent.change(screen.getByPlaceholderText("votre question"), { target: { value: "Dis-moi" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText(/Non sourcé — à vérifier/)).toBeInTheDocument();
    expect(screen.getByText(/contexte partiel/)).toBeInTheDocument();               // OL-07 rendu
    expect(screen.queryByRole("button", { name: "Proposer" })).toBeNull();          // B.6 : ABSENT, pas grisé
  });

  it("mode audit : le rejeu affiche chaînage vérifié + décisions (R257)", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(
      http.get("*/v1/olivia/proposals*", () => HttpResponse.json([])),
      http.post("*/v1/olivia/conversations", () => HttpResponse.json({ id: "CONV-3" })),
      http.get("*/v1/olivia/conversations/CONV-3/replay*", () => HttpResponse.json({
        conversationId: "CONV-3", chaineVerifiee: true,
        messages: [{ seq: 1, direction: "IN", texte: "q" }, { seq: 2, direction: "OUT", texte: "r", contexteEmpreinte: "deadbeef01" }],
        propositions: [{ id: "P1", type: "QUALIF_ALERTE_FP", statut: "REJETEE", motifRejet: "analyse incomplète" }] })),
    );
    render(<Olivia/>);
    fireEvent.click(screen.getByRole("button", { name: /Ouvrir la conversation ancrée/ }));
    await screen.findByText(/Conversation CONV-3/);
    fireEvent.click(screen.getByRole("button", { name: "Rejouer" }));
    expect(await screen.findByText(/vérifié de bout en bout/)).toBeInTheDocument();
    expect(screen.getByText(/REJETEE/)).toBeInTheDocument();
    expect(screen.getByText(/analyse incomplète/)).toBeInTheDocument();
  });
});

describe("FE-HOME/HO-02 — la licence est SERVIE : module inactif = tuile ABSENTE, aucun appel vers sa porte (partie 3 débloquants)", () => {
  type WS = typeof globalThis & { OLIVE_API_URL?: string; OLIVE_SESSION?: { role?: string } };
  const ws = globalThis as WS;
  afterEach(() => { ws.OLIVE_SESSION = undefined; });

  it("tenant SANS cpsi : T4/T6/T9 absentes du DOM — un appel CPSI ferait échouer MSW (onUnhandledRequest:error)", async () => {
    ws.OLIVE_API_URL = "http://api.test"; ws.OLIVE_SESSION = { role: "CO_SR" };
    server.use(
      http.get("*/v1/modules/actifs", () => HttpResponse.json({ enforcement: true,
        modules: [{ code: "kyc" }, { code: "aml" }] })),                       // PAS de cpsi
      // AUCUN handler /v1/cpsi/* : tout appel CPSI = échec du test
      http.get("*/v1/kyc/visas/pending", () => HttpResponse.json([])),
      http.get("*/v1/kyc", () => HttpResponse.json([])),
      http.get("*/v1/tasks", () => HttpResponse.json([])),
      http.get("*/v1/riskcases", () => HttpResponse.json([])),
      http.get("*/v1/olivia/proposals", () => HttpResponse.json([])),
    );
    render(<Home/>);
    expect(await screen.findByText("Tâches ouvertes")).toBeInTheDocument();
    expect(screen.queryByText("Alertes AML scorées")).toBeNull();              // T4 ABSENTE (pas masquée)
    expect(screen.queryByText("Propositions CPSI en attente")).toBeNull();     // T6 ABSENTE
    expect(screen.queryByText("Santé de la porte CPSI")).toBeNull();           // T9 ABSENTE
  });

  it("tenant AVEC cpsi : les tuiles CPSI existent et appellent leur source", async () => {
    ws.OLIVE_API_URL = "http://api.test"; ws.OLIVE_SESSION = { role: "CO_SR" };
    server.use(
      http.get("*/v1/modules/actifs", () => HttpResponse.json({ enforcement: true,
        modules: [{ code: "kyc" }, { code: "aml" }, { code: "cpsi" }] })),
      http.get("*/v1/kyc/visas/pending", () => HttpResponse.json([])),
      http.get("*/v1/kyc", () => HttpResponse.json([])),
      http.get("*/v1/tasks", () => HttpResponse.json([])),
      http.get("*/v1/cpsi/alerts", () => HttpResponse.json({ alertes: [{ client: "c1" }] })),
      http.get("*/v1/cpsi/params/proposals", () => HttpResponse.json([])),
      http.get("*/v1/riskcases", () => HttpResponse.json([])),
      http.get("*/v1/olivia/proposals", () => HttpResponse.json([])),
    );
    render(<Home/>);
    expect(await screen.findByText("Alertes AML scorées")).toBeInTheDocument();
    expect(screen.getByText("Propositions CPSI en attente")).toBeInTheDocument();
  });
});
