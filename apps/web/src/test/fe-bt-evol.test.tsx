// FE-BT — écran « Business Trip » étendu Bloc 63 (repo R446–R452 + R465).
// Le composant est monté contre un MINI-BACKEND en mémoire qui rejoue le contrat du module
// /v1/trips (mêmes payloads, mêmes refus) : pop-up R445 servi par le 409 (AUCUNE écriture
// sans confirmation), certificat → validateur RÉSOLU (MGR sans écart, XB si écart), visa
// avec motivation propagée telle quelle, rejeu à date = verdict d'époque.
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BusinessTrip } from "../features/businesstrip/BusinessTrip";

let paramChanged: Record<string, unknown>[] = [];
let visasPostes: Record<string, unknown>[] = [];
let guards: Record<string, string> = {};

const rep = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

const TRIP = { id: "t1", status: "APPROVED", dateStart: "2026-07-01", dateEnd: "2026-07-04",
  destinations: ["DE"], clients: [], revision: 1 };

const fauxFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const u = String(url);
  if (u.endsWith("/v1/trips") && !init?.method) return rep(200, [TRIP]);
  if (u.endsWith("/v1/trips/params/registre")) return rep(200, { guards });
  if (u.endsWith("/v1/trips/params/modifier")) {
    const b = JSON.parse(String(init!.body));
    if (!b.confirmation)
      return rep(409, { code: "R445_CONFIRMATION_REQUISE",
        popup: { cle: b.cle, ancien: guards[b.cle.split(".")[1]], nouveau: b.valeur,
          portee: "demandes futures — grandfathering R29 sur les demandes en cours",
          rappelReglementaire: "Rappel : affaiblir une garde sanctions/cross-border n'éteint aucune obligation réglementaire (R452)." } });
    guards[b.cle.split(".")[1]] = b.valeur;
    paramChanged.push(b);
    return rep(201, { applique: true });
  }
  if (/\/v1\/trips\/t1\/certificat\/visa$/.test(u)) return rep(201, { tripId: "t1", statut: "Clôturé" });
  if (/\/v1\/trips\/t1\/certificat$/.test(u)) {
    const b = JSON.parse(String(init!.body));
    const validateurResolu = (b.ecarts ?? []).length ? "XB" : "MGR";      // R450 : routage par écart
    return rep(201, { tripId: "t1", validateurResolu, statut: "Soumis", prospectsNes: [] });
  }
  if (/\/v1\/trips\/t1\/visa$/.test(u)) {
    visasPostes.push(JSON.parse(String(init!.body)));
    return rep(201, { tripId: "t1", role: "MGR", status: "APPROVED", visasRestants: 0 });
  }
  if (/\/v1\/trips\/t1\/rejouer-check\?asOf=2026-06-10/.test(u))
    return rep(200, { asOf: "2026-06-10", referentielVersion: "2026-06-01",
      parActivite: [{ jurisdiction: "PT", activite: "ADVICE", verdict: "RESTREINT", position: "COND" }] });
  if (/\/v1\/trips\/t1$/.test(u)) return rep(200, { ...TRIP, advisories: [], signals: [],
    visas: [{ role: "MGR", status: "PENDING", signedBy: null, signedAt: null }] });
  return rep(404, { message: "route inconnue" });
};

beforeEach(() => {
  paramChanged = []; visasPostes = [];
  guards = { certifValide: "BLOQUANT", quotaDepasse: "AVERTISSEMENT" };
  sessionStorage.clear(); sessionStorage.setItem("olive_jwt", "user-admin");
  (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL = "http://api.test";
  vi.stubGlobal("fetch", vi.fn(fauxFetch));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ouvrirDetail = async () => {
  render(React.createElement(BusinessTrip));
  fireEvent.click(await screen.findByText("DE"));
  await screen.findByText(/Certificat de trip \(R450\)/);
};

describe("FE-BT — Bloc 63 à l'écran (R445/R447/R448/R450)", () => {
  it("FE-BT-01 [R445] la modification de guard SANS confirmation ouvre le pop-up servi par le 409 — Annuler = aucune écriture", async () => {
    render(React.createElement(BusinessTrip));
    fireEvent.click(screen.getByRole("button", { name: /Registre §BusinessTrip/ }));
    const sel = await screen.findByLabelText("guard-certifValide");
    fireEvent.change(sel, { target: { value: "AVERTISSEMENT" } });
    const dialog = await screen.findByRole("dialog", { name: "engagement-r445" });
    expect(dialog.textContent).toContain("BLOQUANT");                      // ancien
    expect(dialog.textContent).toContain("AVERTISSEMENT");                 // nouveau
    expect(dialog.textContent).toContain("grandfathering R29");            // portée
    expect(dialog.textContent).toContain("obligation réglementaire");      // rappel
    fireEvent.click(screen.getByRole("button", { name: "Annuler — aucune écriture" }));
    expect(paramChanged).toHaveLength(0);                                  // rien n'est écrit
  });

  it("FE-BT-02 [R445] Confirmer envoie l'engagement — PARAM_CHANGED côté serveur, sévérité rafraîchie", async () => {
    render(React.createElement(BusinessTrip));
    fireEvent.click(screen.getByRole("button", { name: /Registre §BusinessTrip/ }));
    fireEvent.change(await screen.findByLabelText("guard-certifValide"), { target: { value: "AVERTISSEMENT" } });
    await screen.findByRole("dialog", { name: "engagement-r445" });
    const confirmer = screen.getByRole("button", { name: "Je confirme — engagement tracé" });
    expect((confirmer as HTMLButtonElement).disabled).toBe(true);          // engagement OBLIGATOIRE
    fireEvent.change(screen.getByLabelText("engagement-texte"), { target: { value: "J'engage ma responsabilité." } });
    fireEvent.click(confirmer);
    await screen.findByText(/Paramètre appliqué : guards.certifValide/);
    expect(paramChanged).toHaveLength(1);
    const conf = (paramChanged[0] as { confirmation: { engagementTexte: string } }).confirmation;
    expect(conf.engagementTexte).toMatch(/responsabilité/);
  });

  it("FE-BT-03 [R450] certificat AVEC écart → validateur résolu XB ; sans écart → MGR", async () => {
    await ouvrirDetail();
    fireEvent.change(screen.getByLabelText("certificat-narratif"), { target: { value: "Déroulement conforme." } });
    fireEvent.change(screen.getByLabelText("certificat-ecart"), { target: { value: "Signature d'un mandat sur place" } });
    fireEvent.click(screen.getByRole("button", { name: "Soumettre le certificat" }));
    await screen.findByText(/validateur résolu : XB/);
    fireEvent.change(screen.getByLabelText("certificat-ecart"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Soumettre le certificat" }));
    await screen.findByText(/validateur résolu : MGR/);
  });

  it("FE-BT-04 [R447] la motivation de dérogation part AVEC le visa, telle que saisie", async () => {
    await ouvrirDetail();
    fireEvent.change(screen.getByPlaceholderText(/Motivation de dérogation/), {
      target: { value: "Client stratégique — revue annuelle sur place" } });
    fireEvent.click(screen.getByRole("button", { name: "Viser MGR" }));
    await screen.findByText(/Visa MGR → APPROVED/);
    expect(visasPostes[0]).toMatchObject({ role: "MGR", motivation: "Client stratégique — revue annuelle sur place" });
  });

  it("FE-BT-05 [R448/R48] le rejeu à date restitue le verdict d'ÉPOQUE (v7 COND), jamais recalculé", async () => {
    await ouvrirDetail();
    fireEvent.change(screen.getByLabelText("rejeu-date"), { target: { value: "2026-06-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Rejouer le check" }));
    await screen.findByText(/version/);
    expect(screen.getByText("2026-06-01")).toBeTruthy();                   // matrice v7 d'époque
    expect(screen.getByText("COND")).toBeTruthy();                         // position d'époque, pas NON
  });
});
