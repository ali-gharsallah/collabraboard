import React from "react";
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { RapportsConformite } from "./rapports/RapportsConformite";
import { GouvernanceO } from "./olivia/GouvernanceO";
import { PreRevue } from "./ia/PreRevue";
import { CapaciteEquipe } from "./workload/CapaciteEquipe";
import { SurveillanceEs } from "./surveillance/SurveillanceEs";

/**
 * Câblage back→front 2026-08-07 (FE-CB) — chaque nouvel écran AFFICHE ce que l'API sert
 * (MSW joue le serveur), jamais une valeur fabriquée (leçon L6-3). Les invariants
 * visibles sont assertés : définitions servies AVEC les chiffres (P-L8-2), curseur =
 * acte de gouvernance, décision humaine par point (R123), signal sans déplacement
 * (R184), bandeau shadow ES (l'état du monolithe fait foi).
 */

const server = setupServer();
type W = typeof globalThis & { OLIVE_API_URL?: string };
const w = globalThis as W;
const API = "http://api.test";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); cleanup(); w.OLIVE_API_URL = undefined; });
afterAll(() => server.close());
beforeEach(() => { w.OLIVE_API_URL = API; });

describe("FE-CB1 — Rapports conformité : KPI + définitions SERVIES (P-L8-2)", () => {
  it("affiche les tuiles KPI de la période et la définition à côté du chiffre", async () => {
    server.use(http.get(`${API}/v1/rapports/kpi`, () => HttpResponse.json({
      periode: { du: "2026-07-01", au: "2026-10-01" },
      definitions: { age: "détection → qualification, jours", conversion: "mros DECLARER / risk cases" },
      screening: { volumes: { total: 3, BRUT: 1, QUALIFIE: 2 }, parListe: {}, ageMoyenJours: 7,
        ageP90Jours: 10, verdicts: { FAUX_POSITIF: 1 } },
      riskCases: { volumes: { total: 2 } },
      mros: { volumes: { total: 2 }, conversionAlerteDeclaration: 0.5 },
      chargeParAnalyste: { "co-1": 1 },
    })));
    render(<RapportsConformite/>);
    fireEvent.change(screen.getByPlaceholderText("du (ISO)"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByPlaceholderText("au (ISO)"), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByText("Charger la période"));
    await waitFor(() => expect(screen.getByText("10")).toBeTruthy());          // P90 servi
    expect(screen.getByText("0.5")).toBeTruthy();                              // conversion servie
    expect(screen.getByText("mros DECLARER / risk cases")).toBeTruthy();       // la DÉFINITION est affichée
  });
});

describe("FE-CB2 — Gouvernance O : le curseur est un acte (confirmation avant POST)", () => {
  it("rend les capacités servies et leurs niveaux ; changer passe la porte de confirmation", async () => {
    server.use(http.get(`${API}/v1/olivia/gouvernance/curseur`, () => HttpResponse.json({
      niveaux: ["observe", "suggere", "copilote_gouverne"],
      capacites: { PREREVUE_DOSSIER: "observe" } })));
    render(<GouvernanceO/>);
    fireEvent.click(screen.getByText("Charger le curseur"));
    await waitFor(() => expect(screen.getByText("PREREVUE_DOSSIER")).toBeTruthy());
    fireEvent.click(screen.getByText("suggere"));                              // demande le changement
    await waitFor(() => expect(screen.getByText("Changer le curseur d'autonomie")).toBeTruthy());
    expect(screen.getByText("PREREVUE_DOSSIER → suggere")).toBeTruthy();       // la porte nomme l'acte
  });
});

describe("FE-CB3 — Pré-revue IA : l'IA relève, CHAQUE point se décide (R123)", () => {
  it("liste les points servis avec Traiter/Écarter par point ouvert", async () => {
    server.use(http.post(`${API}/v1/ia/prerevue/kyc/K1`, () => HttpResponse.json({
      prerevueId: "PR1", points: [{ type: "INCOHERENCE", message: "Adresse ≠ justificatif" }] })));
    render(<PreRevue/>);
    fireEvent.change(screen.getByPlaceholderText("kycFileId"), { target: { value: "K1" } });
    fireEvent.click(screen.getByText("Lancer la pré-revue"));
    await waitFor(() => expect(screen.getByText("Adresse ≠ justificatif")).toBeTruthy());
    expect(screen.getByText("Traiter")).toBeTruthy();
    expect(screen.getByText("Écarter")).toBeTruthy();                          // motif exigé par la porte
  });
});

describe("FE-CB4 — Capacité équipe : mesures servies, signal sans déplacement (R184)", () => {
  it("affiche la charge par membre et la porte du signal rappelle qu'aucune tâche ne bouge", async () => {
    server.use(http.get(`${API}/v1/workload/equipes/compliance`, () => HttpResponse.json({
      equipeRole: "compliance", membres: [{ userId: "U1", nom: "Iris", role: "compliance", points: 8, capacite: 10 }] })));
    render(<CapaciteEquipe/>);
    fireEvent.click(screen.getByText("Charger la charge"));
    await waitFor(() => expect(screen.getByText("Iris")).toBeTruthy());
    fireEvent.click(screen.getByText("Signaler surcharges"));
    await waitFor(() => expect(screen.getByText(/aucune tâche n'est déplacée automatiquement/)).toBeTruthy());
  });
});

describe("FE-CB5 — Surveillance ES : vues par rejeu, bandeau shadow permanent", () => {
  it("affiche le bandeau dormant/shadow, les compteurs du souscripteur et la file rejouée", async () => {
    server.use(
      http.get(`${API}/v1/surveillance-es/etat`, () => HttpResponse.json({
        actif: false, souscripteur: { lastSeq: "42", nbFaits: 7, nbQuarantaine: 0 } })),
      http.get(`${API}/v1/surveillance-es/alertes`, () => HttpResponse.json([
        { alerteId: "A1", statut: "LEVEE", scenario: "VELOCITE" }])));
    render(<SurveillanceEs/>);
    fireEvent.click(screen.getByText("Alertes (ES-2)"));
    await waitFor(() => expect(screen.getByText("A1")).toBeTruthy());
    expect(screen.getByText(/l'état du monolithe fait foi/)).toBeTruthy();     // doctrine §1/§7 visible
    expect(screen.getByText(/42/)).toBeTruthy();                               // curseur servi
  });
});
