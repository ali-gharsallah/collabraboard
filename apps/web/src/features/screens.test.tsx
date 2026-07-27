import React from "react";
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { WorkflowInstances } from "./workflow/WorkflowInstances";
import { Tasks } from "./tasks/Tasks";
import { Ports } from "./ports/Ports";
import { NextBestAction } from "./nba/NextBestAction";

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

describe("FE-05 — écran sans service ratifié : seed lecture seule", () => {
  it("Workflow Instances affiche le bandeau démonstration et n'appelle aucun endpoint", () => {
    render(<WorkflowInstances/>);                             // aucun OLIVE_API_URL, aucun fetch
    expect(screen.getByText(/Démonstration — service backend non ratifié/i)).toBeInTheDocument();
    expect(screen.getByText(/WF-DEMO-001/)).toBeInTheDocument();
  });

  it("Tâches affiche le bandeau démonstration et n'a pas de bouton Compléter", () => {
    render(<Tasks/>);
    expect(screen.getByText(/Démonstration — service backend non ratifié/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Compléter/i })).toBeNull();   // capacité non ratifiée
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
