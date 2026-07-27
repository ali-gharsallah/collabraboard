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
});
