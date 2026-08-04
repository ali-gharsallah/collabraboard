import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { FilterBar, type FilterSpec } from "./FilterBar";
import { dedupeKeys, keysAreUnique } from "../lib/dedupeKeys";
import { AmlEncyclopediaScreen } from "../parity/AmlEncyclopediaScreen";
import { AML_SCENARIOS } from "../parity/aml-workspace-support";

// Scénarios Gherkin FB-01..FB-07 de spec/SPEC-FILTERBAR.md (R404), assertions DOM par comptage.
// Le composant est thin : l'état reste dans un hôte de test contrôlé.

afterEach(cleanup);

/** Hôte de test minimal : liste de fruits filtrable par couleur, câblée sur FilterBar. */
function Harness({ boolean = false }: { boolean?: boolean }) {
  const DATA = [
    { id: "a", name: "Pomme", color: "green" },
    { id: "b", name: "Banane", color: "yellow" },
    { id: "c", name: "Kiwi", color: "green" },
    { id: "d", name: "Citron", color: "yellow" },
  ];
  const [color, setColor] = React.useState("ALL");
  const [onlyGreen, setOnlyGreen] = React.useState("ALL");
  const view = DATA.filter((d) => {
    if (!boolean && color !== "ALL" && d.color !== color) return false;
    if (boolean && onlyGreen === "ON" && d.color !== "green") return false;
    return true;
  });
  const filters: FilterSpec[] = boolean
    ? [{ id: "green", label: "Verts seulement", value: onlyGreen, onChange: setOnlyGreen, options: [["ALL", "Indifférent"], ["ON", "Oui"]] }]
    : [{ id: "color", label: "Couleur", value: color, onChange: setColor, options: [["ALL", "Toutes"], ["green", "Vert"], ["yellow", "Jaune"]] }];
  return (
    <div>
      <FilterBar
        filters={filters}
        shown={view.length}
        total={DATA.length}
        onReset={() => { setColor("ALL"); setOnlyGreen("ALL"); }}
      />
      <ul>
        {view.map((d) => (
          <li key={d.id} data-testid="row">{d.name}</li>
        ))}
      </ul>
    </div>
  );
}

describe("FilterBar (R404) — FB-01..FB-07", () => {
  it("FB-01 — panneau fermé par défaut, « ▸ Filtres » sans badge, liste complète", () => {
    render(<Harness />);
    const btn = screen.getByRole("button", { name: /Filtres/ });
    expect(btn.textContent).toContain("▸ Filtres");
    expect(btn.textContent).not.toContain("·"); // aucun filtre actif → pas de badge
    // panneau fermé : la combobox n'est pas montée
    expect(screen.queryByLabelText("Couleur")).toBeNull();
    expect(screen.getAllByTestId("row")).toHaveLength(4);
  });

  it("FB-02/FB-05 — filtrage par combobox : DOM == compteur, tous du bon groupe", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Filtres/ })); // ouvrir le panneau
    fireEvent.change(screen.getByLabelText("Couleur"), { target: { value: "green" } });
    const rows = screen.getAllByTestId("row");
    expect(rows).toHaveLength(2); // Pomme + Kiwi
    expect(screen.getByText(/résultat\(s\)/).textContent).toBe("2 / 4 résultat(s)");
    // badge actif
    expect(screen.getByRole("button", { name: /Filtres/ }).textContent).toContain("· 1");
  });

  it("FB-03 — chip actif supprimable, panneau fermé, remet le filtre à allValue", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Filtres/ }));
    fireEvent.change(screen.getByLabelText("Couleur"), { target: { value: "yellow" } });
    fireEvent.click(screen.getByRole("button", { name: /Filtres/ })); // refermer
    const chip = screen.getByTitle("Retirer ce filtre");
    expect(chip.textContent).toContain("Couleur : Jaune");
    fireEvent.click(chip);
    expect(screen.getAllByTestId("row")).toHaveLength(4); // liste complète réapparaît
    expect(screen.queryByTitle("Retirer ce filtre")).toBeNull();
  });

  it("FB-04 — Réinitialiser remet le filtre à ALL et fait disparaître le badge", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Filtres/ }));
    fireEvent.change(screen.getByLabelText("Couleur"), { target: { value: "green" } });
    fireEvent.click(screen.getByRole("button", { name: /Réinitialiser/ }));
    expect(screen.getAllByTestId("row")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Filtres/ }).textContent).not.toContain("·");
    expect(screen.queryByRole("button", { name: /Réinitialiser/ })).toBeNull();
  });

  it("FB-07 — filtre booléen = combobox binaire, chip « Oui » apparaît", () => {
    render(<Harness boolean />);
    fireEvent.click(screen.getByRole("button", { name: /Filtres/ }));
    fireEvent.change(screen.getByLabelText("Verts seulement"), { target: { value: "ON" } });
    expect(screen.getAllByTestId("row")).toHaveLength(2); // Pomme + Kiwi
    expect(screen.getByTitle("Retirer ce filtre").textContent).toContain("Verts seulement : Oui");
  });
});

describe("R-FB.4 — invariant clés uniques (dedupeKeys)", () => {
  it("source saine : aucune collision, aucun warn, clés = clés brutes", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = dedupeKeys([{ c: "A" }, { c: "B" }, { c: "C" }], (x) => x.c, "test");
    expect(r.collisions).toEqual([]);
    expect(r.items.map((i) => i.key)).toEqual(["A", "B", "C"]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("source avec doublons : suffixe #n déterministe + console.warn pointant la source", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = dedupeKeys([{ c: "AML-10" }, { c: "AML-11" }, { c: "AML-10" }], (x) => x.c, "AML");
    expect(r.items.map((i) => i.key)).toEqual(["AML-10", "AML-11", "AML-10#1"]);
    expect(r.collisions).toEqual(["AML-10"]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("AML-10");
    warn.mockRestore();
  });

  it("keysAreUnique reflète l'unicité", () => {
    expect(keysAreUnique([{ c: "A" }, { c: "B" }], (x) => x.c)).toBe(true);
    expect(keysAreUnique([{ c: "A" }, { c: "A" }], (x) => x.c)).toBe(false);
  });
});

describe("E-FB-1 (corpus) — codes de scénario AML uniques à la source", () => {
  it("AML_SCENARIOS n'a plus de code dupliqué (série CBK/WC renommée AML-CB/WC)", () => {
    expect(keysAreUnique(AML_SCENARIOS, (s: any) => s.code)).toBe(true);
    const codes = AML_SCENARIOS.map((s: any) => s.code);
    // les anciens doublons sont désormais distincts
    expect(codes).toContain("AML-CB-01");
    expect(codes).toContain("AML-WC-01");
  });
});

describe("FB-06 (intégration) — AmlEncyclopediaScreen : DOM == compteur, aucun warn", () => {
  function cardCount(container: HTMLElement) {
    // les cartes de scénario portent un borderLeft de 4px (les chips = 1px, les signaux = 3px)
    return Array.from(container.querySelectorAll("div")).filter(
      (el) => (el as HTMLElement).style.borderLeftWidth === "4px",
    ).length;
  }
  function counterShown(): number {
    const txt = screen.getByText(/résultat\(s\)/).textContent || "";
    return parseInt(txt.split("/")[0].trim(), 10);
  }

  it("aucun console.warn de doublon au rendu nominal (source saine)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<AmlEncyclopediaScreen />);
    // R-FB.4 : pas de warn de clés dupliquées émis par dedupeKeys
    const dupWarns = warn.mock.calls.filter((c) => String(c[0]).includes("[R-FB.4]"));
    expect(dupWarns).toHaveLength(0);
    // FB-05 : le nombre de cartes rendues == le compteur (aucune carte orpheline)
    expect(cardCount(container)).toBe(counterShown());
    warn.mockRestore();
  });

  it("FB-02/FB-05 — filtrer un thème : DOM == compteur, strictement < total", () => {
    const { container } = render(<AmlEncyclopediaScreen />);
    const total = cardCount(container);
    fireEvent.click(screen.getByRole("button", { name: /Filtres/ }));
    const select = screen.getByLabelText("Thème bancaire") as HTMLSelectElement;
    // choisir le premier thème réel (≠ "Tous")
    const theme = Array.from(select.options).map((o) => o.value).find((v) => v !== "Tous")!;
    fireEvent.change(select, { target: { value: theme } });
    const shown = counterShown();
    expect(cardCount(container)).toBe(shown); // aucune carte hors thème ne subsiste
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(total);
  });
});
