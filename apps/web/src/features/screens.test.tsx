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

describe("FE-05 — écran sans service ratifié : seed lecture seule (Tâches)", () => {
  it("Tâches affiche le bandeau démonstration et n'a pas de bouton Compléter", () => {
    render(<Tasks/>);
    expect(screen.getByText(/Démonstration — service backend non ratifié/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Compléter/i })).toBeNull();   // capacité non ratifiée
  });
});

describe("FE-WFI — Workflow Instances : liste → détail (visas R15) + timeline (FE-20/21)", () => {
  it("liste, ouvre le détail, affiche steps, visa signé et timeline ordonnée", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(
      http.get("*/v1/workflow-instances/:id/events", () => HttpResponse.json([
        { type: "kyc.created", at: "2026-07-01T10:00:00Z", payload: {} },
        { type: "kyc.visa.signed", at: "2026-07-02T09:00:00Z", payload: {} },
      ])),
      http.get("*/v1/workflow-instances/:id", () => HttpResponse.json({
        id: "i1", code: "WF-1", type: "KYC:CDD", status: "IN_PROGRESS", etapeCourante: "Collecte", revision: 1,
        steps: [{ code: "IDENTITY", label: "Identité", ordre: 0 }],
        visas: [{ section: "IDENTITY", roleRequis: "CO", statut: "SIGNED", signePar: "u-co", signeAt: "2026-07-02T09:00:00Z", verdict: "OK" }],
      })),
      http.get("*/v1/workflow-instances", () => HttpResponse.json([
        { id: "i1", code: "WF-1", type: "KYC:CDD", clientId: "c1", status: "IN_PROGRESS", etapeCourante: "Collecte", visas: "1/2", revision: 1, majAt: "2026-07-01T10:00:00Z" },
      ])),
    );
    render(<WorkflowInstances/>);
    fireEvent.click(await screen.findByText("WF-1"));
    expect(await screen.findByText(/Identité/)).toBeInTheDocument();          // step (section)
    expect(screen.getByText(/signé par u-co/)).toBeInTheDocument();           // visa R15 signataire
    expect(screen.getByText("kyc.created")).toBeInTheDocument();              // timeline append-only
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

describe("FE-40 — NBA : suggestion lue (R187), décision désactivée (route non ratifiée)", () => {
  it("charge les gestes et présente les actions désactivées", async () => {
    w.OLIVE_API_URL = "http://api.test";
    server.use(http.get("*/v1/crm/clients/:id/gestes", () => HttpResponse.json([
      { geste: "Demander le renouvellement du passeport", signal: "la pièce expire le 2026-08-15 (20 j)", source: "document", echeance: "2026-08-15" },
    ])));
    render(<NextBestAction/>);
    fireEvent.change(screen.getByPlaceholderText(/Identifiant client/i), { target: { value: "C1" } });
    fireEvent.click(screen.getByRole("button", { name: /Voir les suggestions/i }));
    expect(await screen.findByText(/Demander le renouvellement du passeport/)).toBeInTheDocument();
    const accepter = screen.getByRole("button", { name: "Accepter" });
    expect(accepter).toBeDisabled();                          // décision NBA non ratifiée
  });
});
