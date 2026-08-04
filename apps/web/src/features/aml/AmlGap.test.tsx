import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { AmlGap } from "./AmlGap";

// AML Gap Wave 1 front (R340→R377) — mode démo (pas d'OLIVE_API_URL ⇒ useApiOrSeed sert le seed
// généré, aucune requête réseau). Couvre : familles via FilterBar, cas GT enrichis, inbox signaux,
// et la garde du contrat UX (qualification impossible sans motif — R7).

afterEach(cleanup);

const bar = (c: HTMLElement) => c.querySelector('[data-testid="filterbar"]');

describe("AmlGap — R340→R377 (front, mode démo)", () => {
  it("Règles : FilterBar + carte de scénario (SF-01) rendues", async () => {
    const { container } = render(<AmlGap />);
    expect(await screen.findByText("Contrepartie PEP en flux")).toBeInTheDocument();
    expect(bar(container)).toBeTruthy();
  });

  it("Cas GT enrichis : badge n TP · m FP visible", async () => {
    render(<AmlGap />);
    // plusieurs scénarios portent « 2 TP · 1 FP » (SF-01, SF-03…) — au moins un badge rendu
    expect((await screen.findAllByText("2 TP · 1 FP")).length).toBeGreaterThan(0);
  });

  it("Signaux : onglet montre la FilterBar et des boutons de qualification TP/FP", async () => {
    const { container } = render(<AmlGap />);
    fireEvent.click(screen.getByRole("button", { name: /Signaux/ }));
    expect(bar(container)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "TP" }).length).toBeGreaterThan(0);
  });

  it("Contrat UX (R7) : qualifier TP ouvre la modale, motif obligatoire bloque la confirmation", async () => {
    render(<AmlGap />);
    fireEvent.click(screen.getByRole("button", { name: /Signaux/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "TP" })[0]);
    const dialog = await screen.findByRole("dialog");
    // confirmation bloquée tant que le motif est vide
    const confirmer = within(dialog).getByRole("button", { name: /Confirmer TP/ });
    expect(confirmer).toBeDisabled();
    fireEvent.change(within(dialog).getByPlaceholderText(/origine des fonds/), { target: { value: "origine corroborée" } });
    expect(confirmer).not.toBeDisabled();
  });

  it("Gouvernance : les 4 capacités (bloc 56) sont affichées comme différées", async () => {
    render(<AmlGap />);
    fireEvent.click(screen.getByRole("button", { name: /Gouvernance du tuning/ }));
    expect(await screen.findByText("Below-the-line sampling")).toBeInTheDocument();
    expect(screen.getAllByText(/différé/).length).toBeGreaterThan(0);
  });
});
