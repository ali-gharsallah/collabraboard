import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatusChip } from "./StatusChip";
import { StatTile } from "./StatTile";
import { WorkQueueHeader, WorkQueueRow, WQ_GRID, WorkQueueItem } from "./WorkQueueRow";
import { EventTimeline } from "./EventTimeline";

// UI v2 étape 2 — les composants transverses tiennent leurs invariants du handoff.
describe("UI v2 — composants transverses (handoff, plan validé PO 10.08.2026)", () => {
  it("U2-01 StatusChip : le libellé porte l'information (lisible sans la couleur)", () => {
    render(<StatusChip mode="alert">CRITIQUE</StatusChip>);
    expect(screen.getByText("CRITIQUE")).toBeTruthy();
  });

  it("U2-02 StatTile : TOUTE tuile est cliquable et mène à sa liste (onOpen obligatoire)", () => {
    const onOpen = vi.fn();
    render(<StatTile label="Alertes ouvertes" valeur={3} note="dont 1 critique" accent="alert" onOpen={onOpen} />);
    fireEvent.click(screen.getByText("Alertes ouvertes"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("U2-03 WorkQueueRow : l'en-tête partage EXACTEMENT la grille des lignes (piège du handoff)", () => {
    const item: WorkQueueItem = { id: "x", client: "Alpha SA", action: "Qualifier un hit sanctions",
      etape: "Screening", echeance: "AUJOURD'HUI", risque: { label: "CRITIQUE", mode: "alert" }, priorite: "alert" };
    const { container } = render(<div><WorkQueueHeader /><WorkQueueRow item={item} onOpen={() => undefined} /></div>);
    const [header, row] = Array.from(container.querySelectorAll('[role="row"]')) as HTMLElement[];
    expect(header.style.gridTemplateColumns).toBe(WQ_GRID);
    expect(row.style.gridTemplateColumns).toBe(WQ_GRID);
    // l'action attendue est en TOUTES LETTRES — jamais un code de statut
    expect(screen.getByText("Qualifier un hit sanctions")).toBeTruthy();
  });

  it("U2-04 WorkQueueRow : la ligne critique prend le fond pâle d'alerte", () => {
    const item: WorkQueueItem = { id: "y", client: "Beta SA", action: "Approuver l'ordre",
      etape: "Settlement", echeance: "12.08.2026", risque: { label: "FAIBLE", mode: "ok" }, priorite: "alert" };
    const { container } = render(<WorkQueueRow item={item} onOpen={() => undefined} />);
    const row = container.querySelector('[role="row"]') as HTMLElement;
    expect(row.style.background).toContain("--alert-card");
  });

  it("U2-05 EventTimeline : le marqueur « vous êtes ici » passe le titre en graisse 700", () => {
    render(<EventTimeline events={[
      { id: "a", titre: "Visa apposé", meta: "10.08 · IV", mode: "ok" },
      { id: "b", titre: "Renvoi ciblé", meta: "09.08 · MD", ici: true },
    ]} />);
    const ici = screen.getByText("Renvoi ciblé") as HTMLElement;
    expect(ici.style.fontWeight).toBe("700");
    expect((screen.getByText("Visa apposé") as HTMLElement).style.fontWeight).toBe("500");
  });
});
