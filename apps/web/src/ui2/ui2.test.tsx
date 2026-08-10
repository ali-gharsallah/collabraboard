import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatusChip } from "./StatusChip";
import { StatTile } from "./StatTile";
import { WorkQueueHeader, WorkQueueRow, WQ_GRID, WorkQueueItem } from "./WorkQueueRow";
import { EventTimeline } from "./EventTimeline";
import { scorer, chercher } from "./CommandPalette";
import { FieldCard } from "./FieldCard";
import { SectionChecklist } from "./SectionChecklist";
import { DossierKyc } from "./DossierKyc";
import { DecisionPanel } from "./DecisionPanel";
import { DiffTable, DiffRow, DIFF_GRID, DiffLigne } from "./DiffRow";
import { ImpactPreview } from "./ImpactPreview";
import { RevueSortie } from "./RevueSortie";

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

  it("U2-06 Palette ⌘K : recherche floue insensible aux accents, préfixes en tête, 5 par groupe", () => {
    expect(scorer("reglages", "Réglages écran")).toBe(2);          // préfixe, accents aplatis
    expect(scorer("ecran", "Réglages écran")).toBe(1);             // sous-chaîne
    expect(scorer("xyz", "Réglages écran")).toBe(-1);
    const tr = (s: string) => s;
    const r = chercher("su", { ecrans: [{ id: "surveillance", libelle: "Surveillance" }],
      clients: [{ id: "c1", name: "Suzuki Ltd" }, { id: "c2", name: "Nordwind" },
        ...Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, name: `Sushi ${i}` }))],
      kycs: [{ code: "KYC-2026-SU-1", status: "OPEN" }] }, tr);
    expect(r.filter((x) => x.groupe === "Clients").length).toBe(5);      // plafond 5 par groupe
    expect(r[0].groupe).toBe("Écrans");                                  // groupé par type
    expect(r.some((x) => x.libelle === "Suzuki Ltd")).toBe(true);
    expect(r.some((x) => x.libelle === "Nordwind")).toBe(false);         // pas de faux positif
  });

  it("U2-07 FieldCard : la provenance est OBLIGATOIRE quand renseigné ; manquant = bordure ambre permanente", () => {
    const { container, rerender } = render(
      <FieldCard label="Source des apports" etat="RENSEIGNE" valeur="Cession 2019"
        provenance="acte notarié · empreinte vérifiée · M. Bregy" />);
    expect(screen.getByText(/acte notarié · empreinte vérifiée/)).toBeTruthy();
    rerender(<FieldCard label="Montant" etat="MANQUANT" saisie={<input aria-label="m" />} />);
    const carte = container.querySelector("section") as HTMLElement;
    expect(carte.style.border).toContain("--warn-card-border");   // ambre EN PERMANENCE, pas après soumission
  });

  it("U2-08 SectionChecklist : la section courante est une carte blanche, le compteur de manquants s'affiche", () => {
    render(<SectionChecklist courante="fonds" onOuvrir={() => undefined} sections={[
      { code: "ident", label: "Identification", etat: "visee" },
      { code: "fonds", label: "Origine des fonds", etat: "encours", manquants: 2 }]} />);
    const actif = screen.getByText("Origine des fonds").closest("button") as HTMLElement;
    expect(actif.getAttribute("aria-current")).toBe("true");
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();               // jauge : 1 visée sur 2
  });

  it("U2-09 DossierKyc : s'ouvre sur la PREMIÈRE section incomplète ; « Transmettre » actif énonce les manques", () => {
    render(<DossierKyc active="kyc" onNavigate={() => undefined} />);
    const courant = document.querySelector('button[aria-current="true"]') as HTMLElement;
    expect(courant.textContent).toContain("Origine des fonds");   // première incomplète, jamais le 1er onglet
    const bouton = screen.getByText("Transmettre pour visa") as HTMLElement;
    expect((bouton.closest("button") as HTMLButtonElement).disabled).toBe(false);  // jamais grisé
    fireEvent.click(bouton);
    expect(screen.getByText(/Transmission impossible — il manque/)).toBeTruthy();
    expect(screen.getAllByText(/2 champs obligatoires en origine des fonds/).length).toBeGreaterThanOrEqual(1);
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

  it("U2-10 DecisionPanel : pas de motif, pas de décision — le bouton reste ACTIF et explique", () => {
    const onDecider = vi.fn();
    render(<DecisionPanel titre="Qualifier l'alerte" boutonLabel="Enregistrer la qualification"
      mention="Un second regard MLRO est requis." effets={["L'alerte passe en investigation."]}
      options={[{ id: "FAUX_POSITIF", titre: "Faux positif", sous: "Activité expliquée" },
        { id: "INVESTIGATION", titre: "Ouvrir une investigation", sous: "Analyse approfondie" }]}
      onDecider={onDecider} />);
    const bouton = screen.getByText("Enregistrer la qualification").closest("button") as HTMLButtonElement;
    expect(bouton.disabled).toBe(false);                          // JAMAIS grisé sans explication
    fireEvent.click(bouton);                                      // clic sans option ni motif
    expect(onDecider).not.toHaveBeenCalled();                     // rien n'est soumis…
    expect(screen.getByRole("alert").textContent).toContain("Pas de motif, pas de décision");
    // choisir une option + motiver → la décision part avec {option, motif}
    fireEvent.click(screen.getByText("Ouvrir une investigation"));
    fireEvent.change(screen.getByLabelText("Motif"), { target: { value: "Flux × 6 sans justificatif." } });
    fireEvent.click(bouton);
    expect(onDecider).toHaveBeenCalledWith({ option: "INVESTIGATION", motif: "Flux × 6 sans justificatif." });
  });

  it("U2-11 DiffTable : grille partagée en-tête/lignes ; la ligne DIVERGE se voit à la LIGNE (fond alerte)", () => {
    const lignes: DiffLigne[] = [
      { attribut: "Nom complet", gauche: "Viktor Volkov", droite: "Viktor Volkov",
        concordance: { label: "92 %", mode: "pct" } },
      { attribut: "Date de naissance", gauche: "14.03.1962", droite: "1962 (année seule)",
        concordance: { label: "DIVERGE", mode: "diverge" } }];
    const { container } = render(<DiffTable lignes={lignes} enteteGauche="Notre client" enteteDroite="Entrée de liste" />);
    const rows = Array.from(container.querySelectorAll('[role="row"]')) as HTMLElement[];
    expect(rows.length).toBe(3);
    for (const r of rows) expect(r.style.gridTemplateColumns).toBe(DIFF_GRID);   // en-tête = lignes
    const diverge = rows.find((r) => r.textContent?.includes("DIVERGE")) as HTMLElement;
    expect(diverge.style.background).toContain("--alert-card");
    const exact = rows.find((r) => r.textContent?.includes("92 %")) as HTMLElement;
    expect(exact.style.background).not.toContain("--alert-card");
  });

  it("U2-12 DiffRow + ImpactPreview : le constaté est en warn 500 ; SANS EFFET reste listé en opacity 0.7", () => {
    const { container } = render(<div>
      <DiffRow labelGauche="Au dossier — 2025" gauche="Négoce, Suisse et UE"
        labelDroite="Constaté — 2026" droite="Import depuis les Émirats" />
      <ImpactPreview titre="Propagation — 3 dossiers concernés" dossiers={[
        { nom: "Vallon Nordic Holding AS", effet: { label: "REVUE ANTICIPÉE", mode: "warn" },
          detail: "Sections rouvertes : fiscalité · 2 tâches créées" },
        { nom: "Fondation Vallon", effet: { label: "SANS EFFET", mode: "neutral" }, sansEffet: true,
          detail: "Aucune section rouverte" }]} />
    </div>);
    const constate = screen.getByText("Import depuis les Émirats") as HTMLElement;
    expect(constate.style.color).toContain("--warn-text");        // « Constaté » se distingue à l'œil
    expect(constate.style.fontWeight).toBe("500");
    const sansEffet = container.querySelector('[data-sans-effet="true"]') as HTMLElement;
    expect(sansEffet.style.opacity).toBe("0.7");                  // présent mais atténué — l'absence d'effet EST une information
    expect(sansEffet.textContent).toContain("Fondation Vallon");
  });

  it("U2-13 RevueSortie : delta R467 rendu (reporter en bloc) ; l'événement CoC émis ne s'annule pas", () => {
    render(<RevueSortie active="revue" onNavigate={() => undefined} />);
    // écran 06 : l'effort évité vient du delta (28 reprises seed) et le report en bloc le consigne
    fireEvent.click(screen.getByText(/Reporter les 28 sections inchangées/));
    expect(screen.getByRole("status").textContent).toContain("preuve d'origine");
    // bascule vers l'écran 07 depuis la carte DÉJÀ TRAITÉE
    fireEvent.click(screen.getByText("Voir le changement de circonstances →"));
    expect(screen.getByText("Propagation — 3 dossiers concernés")).toBeTruthy();
    // émettre : le bandeau ✓ n'offre AUCUN « Annuler » — un événement se corrige, ne se supprime pas
    fireEvent.click(screen.getByText("Émettre l'événement"));
    const bandeau = screen.getAllByRole("status").find((e) => e.textContent?.includes("Événement émis")) as HTMLElement;
    expect(bandeau.textContent).toContain("il se corrige par un nouvel événement");
    expect(screen.queryByText("Annuler")).toBeNull();
  });
});
