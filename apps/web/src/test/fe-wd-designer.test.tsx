// FE-WD — écran « Workflow Designer », onglet Import IA (bloc WD, R432–R438).
// Le composant est monté contre un MINI-BACKEND en mémoire qui rejoue le contrat du module
// workflow-designer (mêmes statuts, mêmes refus R433/R435, mêmes payloads) : l'écran doit
// AFFICHER le servi sans rien décider — DRAFT_AI jamais publiable, zones illisibles avec
// coordonnées, nœuds sous seuil À VÉRIFIER (R438), anomalies R434 listées jamais corrigées.
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("../features/builder/Builder", () => ({ Builder: () => React.createElement("div", { "data-testid": "canvas-builder" }) }));
import { DesignerWd } from "../features/workflow/DesignerWd";

type Noeud = { id: string; label: string; ownerRole: string | null; confidence: number; aVerifier: boolean };
type Srv = { statut: string; nodes: Noeud[]; importePar: string; ratifiePar: string | null; anomalies: any[] };
let srv: Srv | null = null;
let anomaliesProchainImport: any[] = [];

const ZONE = { x: 120, y: 340, largeur: 180, hauteur: 60, raison: "trait manuscrit ambigu" };
const rep = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;
const etatServi = () => ({
  wirId: "w1", statut: srv!.statut,
  wir: { label: "T", nodes: srv!.nodes, edges: [],
    meta: { status: srv!.statut, hashFichier: "sha256:abcdef0123456789", importePar: srv!.importePar,
      ratifiePar: srv!.ratifiePar } },
  anomalies: srv!.anomalies, zonesIllisibles: [ZONE], historique: [] });

// Mini-backend : mêmes transitions que WorkflowDesignerService (import → édite → ratifie).
const fauxFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const u = String(url); const jeton = /Bearer (\S+)/.exec(String((init?.headers as any)?.Authorization ?? ""))?.[1] ?? "";
  if (u.endsWith("/v1/workflow-designer/import")) {
    srv = { statut: "DRAFT_AI", importePar: jeton, ratifiePar: null, anomalies: anomaliesProchainImport,
      nodes: [
        { id: "n0", label: "Entrée en relation", ownerRole: null, confidence: 0.95, aVerifier: false },
        { id: "n1", label: "Collecte documents", ownerRole: "ARM", confidence: 0.4, aVerifier: true },
        { id: "n2", label: "Décision", ownerRole: "CO_SR", confidence: 0.85, aVerifier: false }] };
    return rep(201, { wirId: "w1" });
  }
  if (u.endsWith("/ir") && init?.method === "PATCH") {
    const { patch } = JSON.parse(String(init.body));
    const n = srv!.nodes.find((x) => x.id === patch.noeud)!;
    if (patch.label !== undefined) n.label = patch.label;
    srv!.statut = "DRAFT_HUMAN"; srv!.ratifiePar = null;          // toute édition invalide le visa
    return rep(200, etatServi());
  }
  if (u.endsWith("/ratify")) {
    if (srv!.statut === "DRAFT_AI")
      return rep(400, { message: "R433 : un brouillon IA doit être pris en main par un humain avant ratification." });
    if (jeton === srv!.importePar)
      return rep(403, { message: "R435/R13 : l'importeur ne ratifie pas son propre import (4-yeux)." });
    if (srv!.anomalies.some((a) => a.bloquant))
      return rep(400, { message: "R434 : 1 anomalie(s) bloquante(s) — ROLE_NON_MAPPE" });
    srv!.ratifiePar = jeton;
    return rep(201, { wirId: "w1", defId: "def1" });
  }
  if (/\/v1\/workflow-designer\/w1/.test(u)) return rep(200, etatServi());
  return rep(404, { message: "route inconnue" });
};

beforeEach(() => {
  srv = null; anomaliesProchainImport = [];
  sessionStorage.clear(); sessionStorage.setItem("olive_jwt", "user-co");
  (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL = "http://api.test";
  vi.stubGlobal("fetch", vi.fn(fauxFetch));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ouvrirImportEtImporter = async () => {
  render(React.createElement(DesignerWd));
  fireEvent.click(screen.getByRole("button", { name: "Import IA" }));
  fireEvent.click(screen.getByRole("button", { name: "Importer une image (simulée)" }));
  await screen.findByText(/DRAFT_AI/);
};
const editerN1 = async (label: string) => {
  const champ = screen.getByLabelText("noeud-n1") as HTMLInputElement;
  fireEvent.change(champ, { target: { value: label } });
  fireEvent.blur(champ);
  await screen.findByText("DRAFT_HUMAN");
};
const boutonRatifier = () => screen.queryByRole("button", { name: /Ratifier — visa R15/ });

describe("FE-WD — Workflow Designer, onglet Import IA (R432–R438)", () => {
  it("FE-WD-01 import : DRAFT_AI distinct et NON publiable, zone illisible AVEC coordonnées, nœud sous seuil À VÉRIFIER", async () => {
    await ouvrirImportEtImporter();
    expect(screen.getByText("DRAFT_AI — jamais activable (R433)")).toBeInTheDocument();
    expect(boutonRatifier()).toBeNull();                          // R433 : pas d'action de publication offerte
    expect(screen.getByText(/x:120, y:340, 180×60/)).toBeInTheDocument();   // WD-03 : coordonnées affichées
    expect(screen.getByText("À VÉRIFIER (R438)")).toBeInTheDocument();      // WD-12 : marqué, rien corrigé
    expect(screen.getByText(/sha256:/)).toBeInTheDocument();                // hash R436 visible
  });

  it("FE-WD-02 édition humaine : PATCH ir → DRAFT_HUMAN, la ratification devient proposable", async () => {
    await ouvrirImportEtImporter();
    await editerN1("Collecte renforcée");
    expect((screen.getByLabelText("noeud-n1") as HTMLInputElement).defaultValue).toBe("Collecte renforcée");
    expect(boutonRatifier()).not.toBeNull();
  });

  it("FE-WD-03 refus même auteur (R435/R13) : le message SERVEUR est affiché tel quel, le statut ne bouge pas", async () => {
    await ouvrirImportEtImporter();
    await editerN1("Collecte renforcée");
    fireEvent.click(boutonRatifier()!);
    await screen.findByText(/R435\/R13 : l'importeur ne ratifie pas son propre import/);
    expect(screen.getByText("DRAFT_HUMAN")).toBeInTheDocument();
  });

  it("FE-WD-04 visa croisé : un AUTRE porteur ratifie — « ratifié par » affiché, publication renvoyée au circuit existant", async () => {
    await ouvrirImportEtImporter();
    await editerN1("Collecte renforcée");
    sessionStorage.setItem("olive_jwt", "user-co-sr");            // changement de porteur (4-yeux)
    fireEvent.click(boutonRatifier()!);
    await screen.findByText(/ratifié par/);
    expect(screen.getByText(/user-co-sr/)).toBeInTheDocument();
    expect(screen.getByText(/publication via Gouvernance → Workflows/)).toBeInTheDocument();   // R436
    expect(boutonRatifier()).toBeNull();                          // visa posé — plus rien à ratifier
  });

  it("FE-WD-05 anomalies R434 : LISTÉES à l'écran (code + détail), jamais corrigées ni masquées", async () => {
    anomaliesProchainImport = [{ code: "ROLE_NON_MAPPE", noeud: "n1", role: "SORCIER",
      bloquant: true, detail: "rôle « SORCIER » absent du référentiel tenant" }];
    await ouvrirImportEtImporter();
    expect(screen.getByText(/Anomalies R434/)).toBeInTheDocument();
    expect(screen.getByText(/ROLE_NON_MAPPE/)).toBeInTheDocument();
    expect(screen.getByText(/SORCIER/)).toBeInTheDocument();
  });
});
