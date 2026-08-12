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
import { SandboxSlider } from "./SandboxSlider";
import { ECRANS_MIGRES } from "./cartographie";
import { CAPACITES, capacitesVisibles, destinationsVisibles, licenceActive } from "./capacites";
import { EntreeRelation } from "./EntreeRelation";
import { EntityList, MesClients } from "./Listes";
import { Surveillance } from "./Surveillance";
import { Pilotage } from "./Pilotage";
import { AuditRejeu } from "./AuditRejeu";
import { ParamSandbox } from "./ParamSandbox";
import { CrossBorder } from "./CrossBorder";
import { MODULES_METIERS_DEMO } from "./modules-metiers";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Lu via fs (pas d'import ?raw : la config vitest stubbe les .css ; en jsdom
// import.meta.url n'est pas file:) — la garde U2-38 porte sur le TEXTE du fichier.
const tokensCss = readFileSync(join(process.cwd(), "src/ui2/tokens.css"), "utf8");

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

  it("U2-14 SandboxSlider + Pilotage : repère de production sous le rail ; la conclusion est ÉCRITE", () => {
    const { container, unmount } = render(
      <SandboxSlider label="Seuil" affichage="× 2,5" min={15} max={50} value={25}
        onChange={() => undefined} ia production={{ valeur: 20, label: "production : × 2,0" }} />);
    expect(container.querySelector("[data-repere-production]")).toBeTruthy();   // on voit d'où l'on part
    expect(screen.getByText("production : × 2,0")).toBeTruthy();
    unmount();
    const onNavigate = vi.fn();
    render(<Pilotage active="rapports" onNavigate={onNavigate} />);
    // le Bar Meter ne laisse pas le lecteur conclure : la phrase nomme LE goulot
    expect(screen.getByText(/seul goulot interne/).textContent).toContain("visa Compliance");
    fireEvent.click(screen.getByText("Alertes AML ouvertes"));                  // toute tuile mène à sa liste
    expect(onNavigate).toHaveBeenCalledWith("surveillance");
  });

  it("U2-15 AuditRejeu : le curseur reconstitue l'état À DATE — les événements postérieurs n'y figurent pas", () => {
    render(<AuditRejeu active="rapports" onNavigate={() => undefined} />);
    expect(screen.getByText("État du dossier au 12.03.2025")).toBeTruthy();
    expect(screen.getByText("Validé")).toBeTruthy();                            // pas encore EDD ni blocage
    expect(screen.getByText(/postérieurs à cette date/).textContent).toContain("Blocage sanctions");
    expect(screen.getByText(/Vous êtes ici/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Date de rejeu"), { target: { value: "5" } });
    expect(screen.getByText("État du dossier au 10.08.2026")).toBeTruthy();
    expect(screen.getByText("Bloqué — sanctions")).toBeTruthy();                // l'état a suivi la date
    expect(screen.queryByText(/postérieurs à cette date/)).toBeNull();
    expect(screen.getByText(/v4\.5 — en vigueur du 01\.04\.2026/)).toBeTruthy(); // paramétrage à date (R29)
    expect(screen.getByText(/Cette consultation est enregistrée/)).toBeTruthy(); // l'auditeur est tracé
  });

  it("U2-16 ParamSandbox : bouger le seuil recalcule l'effet ; le coût reste NOMINATIF ; rien ne s'applique", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    expect(screen.getByText("812")).toBeTruthy();                               // ×2,5 → chiffres maquette
    expect(screen.getByText("419")).toBeTruthy();
    expect(screen.getByText("Cèdre Maritime SARL")).toBeTruthy();               // le coût est listé nominativement
    expect(screen.getAllByText("MROS COMMUNIQUÉ").length).toBe(2);
    fireEvent.change(screen.getByLabelText("Seuil d'écart déclenchant"), { target: { value: "20" } });
    expect(screen.getByText(/Aucune alerte fondée perdue/)).toBeTruthy();       // ×2,0 = production → coût nul
    expect(screen.queryByText("Cèdre Maritime SARL")).toBeNull();
    // R44 : la proposition d'Olivia est affichée comme NON appliquée ; soumettre ≠ appliquer
    expect(screen.getByText(/ne le sera pas sans validation humaine/)).toBeTruthy();
    fireEvent.click(screen.getByText("Soumettre au comité"));
    expect(screen.getByRole("status").textContent).toContain("v11 reste en production");
  });

  it("U2-17 Cartographie ⌘K : chaque écran v1 est trouvable sous son ANCIEN nom et mène à sa destination v2", () => {
    const tr = (s: string) => s;
    const vide = { clients: [], kycs: [] };
    // les 4 fusions arbitrées par le PO (10.08.2026) se résolvent dans la palette
    const cc = chercher("command center", { ecrans: ECRANS_MIGRES, ...vide }, tr);
    expect(cc[0].cible).toBe("journee");                          // dashboards → Ma journée
    expect(cc[0].detail).toContain("Ma journée");
    expect(chercher("bacs à sable", { ecrans: ECRANS_MIGRES, ...vide }, tr)[0].cible).toBe("param");
    expect(chercher("capacité équipe", { ecrans: ECRANS_MIGRES, ...vide }, tr)[0].cible).toBe("rapports");
    expect(chercher("compliance center", { ecrans: ECRANS_MIGRES, ...vide }, tr)[0].cible).toBe("surveillance");
    // V2-M14 : la cartographie est DÉRIVÉE du registre — elle couvre les 86 capacités v1,
    // plus seulement les ~50 écrites à la main (l'écart E-V2-3 devient impossible).
    expect(ECRANS_MIGRES.length).toBe(CAPACITES.length);
    const SPINE = ["journee", "dossiers", "clients", "entree", "kyc",
      "surveillance", "revue", "rapports", "param"];
    const VERTICAUX = ["crossborder", "custody", "oprisk", "legal", "cpsi",
      "pms", "fx", "mobile", "islamic"];
    for (const c of new Set(ECRANS_MIGRES.map((e) => e.id)))
      expect([...SPINE, ...VERTICAUX]).toContain(c);                 // aucune destination orpheline
  });

  it("U2-18 EntreeRelation : la barrière KYC est annoncée DÈS l'écran ; l'aiguillage EDD a sa raison ; la personne se réutilise", () => {
    render(<EntreeRelation active="entree" onNavigate={() => undefined} />);
    expect(screen.getByText("bloquée tant que KYC ≠ validé")).toBeTruthy();     // au stepper, pas à la fin
    expect(screen.getByText(/Cette règle n'est pas paramétrable/)).toBeTruthy();
    expect(screen.getByText("DILIGENCE RENFORCÉE — EDD")).toBeTruthy();
    expect(screen.getByText("Structure à deux niveaux de détention")).toBeTruthy(); // le critère est CITÉ
    expect(screen.getByText(/Voir la règle appliquée et sa version/)).toBeTruthy(); // R29
    expect(screen.getByText(/pas de nouvelle saisie, et tout changement futur se propagera/)).toBeTruthy();
    expect(screen.getByText(/jamais découvert à la fin/)).toBeTruthy();
  });

  it("U2-19 EntityList : l'en-tête partage la grille des lignes ; chaque ligne s'ouvre", () => {
    const onOpen = vi.fn();
    const { container } = render(<EntityList grid="1.5fr 110px" entetes={["Client", "Risque"]}
      onOpen={onOpen} lignes={[{ id: "c1", cells: ["Suzuki Ltd", "ÉLEVÉ"] }]} />);
    const rows = Array.from(container.querySelectorAll('[role="row"]')) as HTMLElement[];
    expect(rows.length).toBe(2);
    for (const r of rows) expect(r.style.gridTemplateColumns).toBe("1.5fr 110px");
    fireEvent.click(screen.getByText("Suzuki Ltd"));
    expect(onOpen).toHaveBeenCalledWith("c1");
  });

  it("U2-20 V2-M1 DossierKyc : onglets Pièces (GED) / Corroboration / Cross-border, sources signalées", () => {
    render(<DossierKyc active="kyc" onNavigate={() => undefined} />);
    // onglet Pièces : métadonnées + empreintes, jamais le contenu (R145)
    fireEvent.click(screen.getByText(/Pièces \(GED\)/));
    expect(screen.getByText("Acte de trust")).toBeTruthy();
    expect(screen.getByText(/v2 · ancrée le 14\.11\.2023/)).toBeTruthy();
    expect(screen.getByText(/relecture vérifiée du coffre, par empreinte \(R145\)/)).toBeTruthy();
    // onglet Corroboration : matrice versionnée, exigence manquante VISIBLE
    fireEvent.click(screen.getByText("Corroboration"));
    expect(screen.getByText("Corroboration du patrimoine (EDD)")).toBeTruthy();
    expect(screen.getByText("MANQUANTE")).toBeTruthy();
    expect(screen.getByText(/le dossier garde la version de sa création \(R29\)/)).toBeTruthy();
    // onglet Cross-border : matrice R453, restriction dite en toutes lettres
    fireEvent.click(screen.getByText("Cross-border"));
    expect(screen.getByText("Émirats arabes unis")).toBeTruthy();
    expect(screen.getByText("RESTREINT")).toBeTruthy();
    // retour Dossier : l'invariant U2-09 tient toujours (1re section incomplète)
    fireEvent.click(screen.getByText("Dossier"));
    const courant = document.querySelector('button[aria-current="true"]') as HTMLElement;
    expect(courant.textContent).toContain("Origine des fonds");
  });

  it("U2-21 V2-M2 Surveillance : file screening, règles AML en consultation, transactions", () => {
    const onNavigate = vi.fn();
    render(<Surveillance active="surveillance" onNavigate={onNavigate} />);
    // file screening : une ligne s'ouvre sur la QUALIFICATION (écran hit, motif obligatoire)
    fireEvent.click(screen.getByText(/File screening/));
    expect(screen.getByText("Andrei Volkov")).toBeTruthy();
    expect(screen.getByText("92 %")).toBeTruthy();
    expect(screen.getByText("À QUALIFIER")).toBeTruthy();
    expect(screen.getByText(/golden set 127 cas asserté en CI/)).toBeTruthy();   // le VRAI moteur, cité
    fireEvent.click(screen.getByText("Andrei Volkov"));
    expect(screen.getByText("Qualifier le hit")).toBeTruthy();                   // → écran 05
    // règles AML : CONSULTATION seule — la modification renvoie au bac à sable (écran 10)
    fireEvent.click(screen.getByText("← Alerte AML liée"));
    fireEvent.click(screen.getByText("Règles AML"));
    expect(screen.getByText("AML-R17")).toBeTruthy();
    expect(screen.getByText("v11 · 12.09.2024")).toBeTruthy();
    expect(screen.getByText(/La modification passe par le bac à sable/)).toBeTruthy();
    fireEvent.click(screen.getByText("Ouvrir le bac à sable →"));
    expect(onNavigate).toHaveBeenCalledWith("param");
    // transactions : EN REVUE visible, ligne → alerte liée
    fireEvent.click(screen.getByText("Transactions"));
    expect(screen.getAllByText("Levant Shipping Co.").length).toBe(2);
    expect(screen.getAllByText("EN REVUE").length).toBeGreaterThanOrEqual(2);
  });

  it("U2-22 V2-M3 : cas de risque réconciliés (R280) ; fiche client avec profil CPSI rejouable (R48/R44)", async () => {
    const { unmount } = render(<Surveillance active="surveillance" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText(/Cas de risque/));
    expect(screen.getByText("RC-2026-0102")).toBeTruthy();
    expect(screen.getByText("Alerte AML-2026-0447")).toBeTruthy();      // l'origine est LIÉE, pas dupliquée
    expect(screen.getByText(/jamais un double pilotage/).textContent).toContain("R280");
    expect(screen.getByText("CLOS — MROS")).toBeTruthy();               // clôture cohérente avec le MROS
    unmount();
    const onNavigate = vi.fn();
    render(<MesClients active="clients" onNavigate={onNavigate} />);
    fireEvent.click(await screen.findByText("Suzuki Ltd"));             // ligne → fiche en panneau
    expect(screen.getByText("Profil CPSI")).toBeTruthy();
    expect(screen.getByText("62")).toBeTruthy();
    expect(screen.getByText(/rejouable à date \(R48\)/).textContent).toContain("R44");
    fireEvent.click(screen.getByText("Ouvrir le dossier KYC"));
    expect(onNavigate).toHaveBeenCalledWith("kyc");
  });

  it("U2-23 V2-M4 : pipeline prospects fusionné + déplacements BT ; sorties (offboarding) dans Revue", () => {
    const { unmount } = render(<EntreeRelation active="entree" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText(/Pipeline prospects/));
    expect(screen.getByText("Baltic Ventures OÜ")).toBeTruthy();
    expect(screen.getByText("À ONBOARDER")).toBeTruthy();
    expect(screen.getByText(/la pré-prospection fusionnent ici/)).toBeTruthy();   // fusion arbitrée citée
    fireEvent.click(screen.getByText(/Déplacements \(BT\)/));
    expect(screen.getByText("BT-2026-0044")).toBeTruthy();
    expect(screen.getByText("EN APPROBATION")).toBeTruthy();
    expect(screen.getByText(/quotas de jours par pays \(R449\)/).textContent).toContain("R465");
    // retour dossier : la barrière KYC de l'écran 04 est toujours là
    fireEvent.click(screen.getByText("Dossier (écran 04)"));
    expect(screen.getByText("bloquée tant que KYC ≠ validé")).toBeTruthy();
    unmount();
    render(<RevueSortie active="revue" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText(/Sorties · 3/));
    expect(screen.getByText("OFF-2026-0012")).toBeTruthy();
    expect(screen.getByText("Décision comité — post-MROS")).toBeTruthy();
    expect(screen.getByText(/le courrier de clôture est GÉNÉRÉ \(R270\)/)).toBeTruthy();
  });

  it("U2-24 V2-M5 Rapports : registre LBA en lecture pure, MROS/goAML opposable, veille R44, habilitations à date", () => {
    render(<Pilotage active="rapports" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("Registre LBA"));
    expect(screen.getByText(/Cèdre Maritime SARL — soupçon fondé/)).toBeTruthy();
    expect(screen.getByText(/LECTURE PURE/).textContent).toContain("R49");       // le registre ne change rien
    fireEvent.click(screen.getByText("MROS · goAML"));
    expect(screen.getByText("MROS-2026-0031")).toBeTruthy();
    expect(screen.getByText("BROUILLON goAML")).toBeTruthy();
    expect(screen.getByText(/OPPOSABLE \(R130\)/).textContent).toContain("FIGÉ");
    fireEvent.click(screen.getByText("Veille"));
    expect(screen.getByText(/Circulaire 2026\/2/)).toBeTruthy();
    expect(screen.getByText(/reste un acte humain, daté et signé \(R44\)/)).toBeTruthy();
    fireEvent.click(screen.getByText("Habilitations"));
    expect(screen.getByText("EN RETARD")).toBeTruthy();                          // l'échue SE VOIT
    expect(screen.getByText(/s'évaluent À DATE \(R238\)/)).toBeTruthy();
    fireEvent.click(screen.getAllByText("Compliance")[0]);                       // retour : écran 08 intact
    expect(screen.getByText(/seul goulot interne/)).toBeTruthy();
  });

  it("U2-47 V2-M19/M22 globe des flux : données du designer verbatim, aucun appel sortant, table jamais bloquée", async () => {
    const { FLOWS } = await import("./globe/flux-data");
    expect(FLOWS.length).toBe(16);                                   // les 16 corridors de la maquette
    expect(FLOWS.reduce((s, f) => s + f.v, 0)).toBe(2982);           // volume total, inchangé
    expect(FLOWS.filter((f) => f.s === "alert").length).toBe(3);     // Beyrouth, Panama, Nairobi
    // le module ne fait AUCUN appel sortant : ni CDN d3/topojson, ni atlas distant (on-premise)
    for (const f of ["flux-data.ts", "GlobeFond.tsx", "FluxPanneau.tsx"]) {
      const src = readFileSync(join(process.cwd(), "src/ui2/globe/", f), "utf8");
      expect(src).not.toMatch(/https?:\/\//);
    }
    // et il ne qualifie rien : le globe est une vue, pas un moteur (R44)
    expect(readFileSync(join(process.cwd(), "src/ui2/globe/FluxPanneau.tsx"), "utf8"))
      .toContain("ne lève aucune alerte et ne décide d'aucun blocage");
  });

  it("U2-46 V2-M18 Rapports : les quatre capacités en consultation retrouvent leurs ACTES", () => {
    render(<Pilotage active="rapports" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("MROS · goAML"));
    // l'acte le plus lourd du produit : décider d'une communication — jamais pris par O-Live
    const decider = screen.getByText("Décider d'une communication");
    expect((decider.closest("button") as HTMLButtonElement).disabled).toBe(false);  // jamais grisé
    fireEvent.click(decider);
    expect(screen.getByText(/acte HUMAIN motivé ; O-Live ne la prend jamais/)).toBeTruthy();
    expect(screen.getByText("POST /v1/mros/decider")).toBeTruthy();                 // la route est nommée
    // le dépôt goAML reste manuel : O-Live ne transmet pas au régulateur
    fireEvent.click(screen.getByText("Générer le brouillon goAML"));
    expect(screen.getByText(/le dépôt sur le portail goAML reste manuel et tracé ici/)).toBeTruthy();
    // habilitations : le visa de complétion est à quatre yeux
    fireEvent.click(screen.getByText("Habilitations"));
    fireEvent.click(screen.getByText("Viser une complétion"));
    expect(screen.getByText(/celui qui a suivi la formation ne vise pas sa propre complétion/)).toBeTruthy();
    // veille : proposer, jamais appliquer
    fireEvent.click(screen.getByText("Veille"));
    fireEvent.click(screen.getByText("Proposer une application"));
    expect(screen.getByText(/la veille PROPOSE ; l'application passe par le bac à sable/)).toBeTruthy();
    // registre : l'export est une lecture, il ne purge rien
    fireEvent.click(screen.getByText("Registre LBA"));
    fireEvent.click(screen.getByText("Exporter le registre"));
    expect(screen.getByText(/LECTURE horodatée du journal ; il ne modifie ni ne purge/)).toBeTruthy();
  });

  it("U2-43 V2-M16 Rapports : reporting réglementaire — calendrier gouverné, retard SIGNALÉ jamais masqué", () => {
    render(<Pilotage active="rapports" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("Réglementaire"));
    expect(screen.getByText(/Communication au MROS/)).toBeTruthy();
    expect(screen.getByText(/Déclaration FATCA/)).toBeTruthy();
    expect(screen.getByText("EN RETARD")).toBeTruthy();                          // la revue de calibrage échue SE VOIT
    // V2-M43 : les statuts affichés sont ceux que le MOTEUR calcule (R491) — « EN PRÉPARATION »
    // était une invention de maquette. Et « sans délai » (LBA art. 9) reste sans délai : ni
    // échéance fabriquée, ni pastille de retard sur une obligation que la loi n'a pas datée.
    expect(screen.getByText("DUE")).toBeTruthy();
    expect(screen.getAllByText("DÉPOSÉE").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("SANS DÉLAI")).toBeTruthy();
    expect(screen.getByText("sans délai")).toBeTruthy();                          // la colonne Échéance
    // O-Live n'énonce aucune obligation : la base légale est DÉCLARÉE par la banque.
    expect(screen.getAllByText(/base déclarée/).length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText(/ne qualifie aucune base légale/)).toBeTruthy();
    expect(screen.getByText(/Un retard est SIGNALÉ \(R39\)/)).toBeTruthy();
  });

  it("U2-44 V2-M16 Rapports : BI sur mesure — vues DÉCLARÉES, jamais les tables (R314-R315)", () => {
    render(<Pilotage active="rapports" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("Sur mesure (BI)"));
    expect(screen.getByText("dossiers_kyc")).toBeTruthy();
    expect(screen.getByText("alertes_aml")).toBeTruthy();
    expect(screen.getByText(/VUES DÉCLARÉES \(R314-R315\), jamais sur les tables/)).toBeTruthy();
    // la portée est PORTÉE PAR LA REQUÊTE, pas appliquée après coup
    expect(screen.getByText(/s'applique à la requête, pas après coup/)).toBeTruthy();
  });

  it("U2-45 V2-M16 Rapports : deux tableaux de bord par profil — Compliance et Direction", () => {
    render(<Pilotage active="rapports" onNavigate={() => undefined} />);
    // le dashboard Compliance (écran 08) reste le défaut
    expect(screen.getByText(/seul goulot interne/)).toBeTruthy();
    fireEvent.click(screen.getByText("Direction"));
    expect(screen.getByText(/Entrées en relation du mois/)).toBeTruthy();
    expect(screen.getByText(/Charge par équipe/)).toBeTruthy();
    expect(screen.getByText(/Tenue des délais/)).toBeTruthy();
    // la charge se lit par ÉQUIPE — aucun indicateur de performance individuelle
    expect(screen.getByText(/aucun indicateur individuel n'est calculé/)).toBeTruthy();
    expect(screen.getByText(/SIGNALÉ, jamais bloquant \(R39\)/)).toBeTruthy();
  });

  it("U2-25 V2-M6 Paramétrage par sections : clés gouvernées R29, Simulation partout (arbitrage n°1)", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    // les 6 sections + le bac à sable en pilules (« IA » existe aussi comme badge Olivia → getAll)
    for (const s of ["Questionnaires", "Règles", "Workflow", "Accès", "IA", "Général"])
      expect(screen.getAllByText(s).length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByText("Règles"));
    expect(screen.getByText("decision.renvoi.seuilBoucles")).toBeTruthy();       // clé gouvernée du Bloc 65
    expect(screen.getByText(/un dossier garde la version en vigueur à sa création \(R29\)/)).toBeTruthy();
    expect(screen.getByText(/Les 8 bacs à sable ont disparu comme écrans \(arbitrage n°1\)/)).toBeTruthy();
    fireEvent.click(screen.getByText("IA", { selector: "button" }));
    expect(screen.getByText("O2 — propose, l'humain décide")).toBeTruthy();      // curseur O1/O2/O3 (R44 visible)
    // « Simuler dans le bac à sable → » ramène au modèle écran 10
    fireEvent.click(screen.getByText("Simuler dans le bac à sable →"));
    expect(screen.getByText("Effet simulé sur l'historique")).toBeTruthy();
    expect(screen.getByText("812")).toBeTruthy();
  });

  it("U2-26 ETL : la fraîcheur s'affiche (R488) et l'incident de réconciliation SE VOIT (R485)", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("Intégrations (ETL)"));
    expect(screen.getByText("LOT-2026-0810-EOD")).toBeTruthy();
    expect(screen.getAllByText("RÉCONCILIÉ").length).toBe(2);
    expect(screen.getByText("INCIDENT")).toBeTruthy();                           // la divergence est visible, R485
    const doctrine = screen.getByText(/La fraîcheur s'affiche, ne se devine pas \(R488\)/).textContent;
    expect(doctrine).toContain("l'import ne décide rien (R489)");                // R44 appliqué à l'ETL
    expect(doctrine).toContain("tout-ou-rien");                                  // arbitrage Q4 affiché
  });

  it("U2-27 V2-M8 matrice documentaire : la GRILLE SDD/CDD/EDD s'ouvre depuis la clé doc-matrix", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("Questionnaires"));
    fireEvent.click(screen.getByText("doc-matrix"));                             // la ligne ouvre le détail
    for (const col of ["SDD", "CDD", "EDD"]) expect(screen.getByText(col)).toBeTruthy();
    expect(screen.getByText("Formulaire A / K — ayant droit économique")).toBeTruthy();
    expect(screen.getByText("Mémo PEP + approbation direction")).toBeTruthy();   // EDD seulement
    expect(screen.getByText(/un durcissement ne réécrit jamais un dossier existant/)).toBeTruthy(); // R29
    expect(screen.getByText(/reste rejouable pour l'audit/)).toBeTruthy();       // historique commun R48
    fireEvent.click(screen.getByText("← Questionnaires"));                       // retour à la section
    expect(screen.getByText("review.profiles")).toBeTruthy();
  });

  it("U2-28 V2-M8 circuit de visa WF-KYC-03 : étapes fermées, quatre yeux R13, R44 visible", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("Workflow"));
    fireEvent.click(screen.getByText("workflow.WF-KYC-03"));
    expect(screen.getByText("Contrôle compliance — quatre yeux")).toBeTruthy();
    expect(screen.getByText(/jamais le même acteur que l'étape 1/)).toBeTruthy();          // R13
    expect(screen.getByText(/la PEPisation est décidée par un humain/)).toBeTruthy();      // R44
    expect(screen.getByText(/l'ordre des gardes est contractuel/)).toBeTruthy();           // précédence
  });

  it("U2-29 V2-M8 matrice de droits IAM (R282) : sections × rôles, V = visa", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("Accès"));
    fireEvent.click(screen.getByText("iam.matrice"));
    expect(screen.getByText("Communications MROS")).toBeTruthy();               // le MLRO seul écrit
    expect(screen.getByText(/L = lecture · É = écriture · V = visa/)).toBeTruthy();
    expect(screen.getByText(/un écran non autorisé n'apparaît pas/)).toBeTruthy();
    // « Simuler une modification → » ramène au bac à sable (arbitrage n°1 — pas d'édition directe)
    fireEvent.click(screen.getByText("Simuler une modification →"));
    expect(screen.getByText("Effet simulé sur l'historique")).toBeTruthy();
  });

  it("U2-30 V2-M9 éditeur matrice doc : renommage + cellule → diff avant/après ; motif R7 obligatoire", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("Questionnaires"));
    fireEvent.click(screen.getByText("doc-matrix"));
    fireEvent.click(screen.getByText("Modifier (brouillon)"));
    // renommer un libellé d'exigence
    fireEvent.change(screen.getByLabelText("libellé ID-01"), { target: { value: "Pièce d'identité biométrique" } });
    // durcir une cellule de composition
    fireEvent.change(screen.getByLabelText("OF-02 CDD"), { target: { value: "OBLIGATOIRE" } });
    const ecarts = screen.getByText(/Écarts du brouillon \(2\)/);
    expect(ecarts).toBeTruthy();
    expect(screen.getByText("Pièce d'identité biométrique", { selector: "span" })).toBeTruthy(); // après
    expect(screen.getByText("Pièce d'identité certifiée")).toBeTruthy();                          // avant, visible
    // soumission sans motif → refus R7 ; avec motif → SECOND habilité R13
    fireEvent.click(screen.getByText("Soumettre le brouillon"));
    expect(screen.getByText(/le motif de publication est obligatoire \(R7\)/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("motif de publication (R7)"), { target: { value: "durcissement SoF" } });
    fireEvent.click(screen.getByText("Soumettre le brouillon"));
    expect(screen.getByText(/SECOND habilité \(R13, l'auteur ne publie pas lui-même\)/)).toBeTruthy();
    expect(screen.getByText(/La version en vigueur reste inchangée jusqu'à publication/)).toBeTruthy(); // R29
  });

  it("U2-31 V2-M9 composition du tableau : ajout et retrait d'exigence visibles dans le diff", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("Questionnaires"));
    fireEvent.click(screen.getByText("doc-matrix"));
    fireEvent.click(screen.getByText("Modifier (brouillon)"));
    fireEvent.click(screen.getByText("+ Ajouter une exigence"));
    fireEvent.click(screen.getByLabelText("retirer FI-01"));
    expect(screen.getByText("AJOUTÉ")).toBeTruthy();
    expect(screen.getByText("RETIRÉ")).toBeTruthy();
    expect(screen.getByText("États financiers (personnes morales)")).toBeTruthy(); // le retiré reste nommé
  });

  it("U2-32 V2-M9 questionnaire : renommer un champ + désactiver une section (composition)", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("Questionnaires"));
    fireEvent.click(screen.getByText("kyc.questionnaire"));
    fireEvent.click(screen.getByText("Modifier (brouillon)"));
    fireEvent.change(screen.getByLabelText("champ ID.2"), { target: { value: "Prénoms usuels" } });
    fireEvent.click(screen.getByLabelText("section Relation attendue (flux)"));
    const ecarts = screen.getByText(/Écarts du brouillon \(2\)/);
    expect(ecarts).toBeTruthy();
    expect(screen.getByText(/Identification · ID.2/)).toBeTruthy();
    // marquer une facultative comme requise → 3e écart
    fireEvent.click(screen.getByLabelText("OF.2 requise"));
    expect(screen.getByText(/Écarts du brouillon \(3\)/)).toBeTruthy();
  });

  it("U2-33 V2-M10 section Banque : R-Q initial (REQUIS MANQUANT visible) + licence R320", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("Banque"));
    fireEvent.click(screen.getByText("banque.initialisation"));
    expect(screen.getAllByText("REQUIS MANQUANT").length).toBe(2);     // gedDocTypes + coreSystemeRef
    expect(screen.getByText("gedDocTypes")).toBeTruthy();
    expect(screen.getByText(/un module dont la clé manque refuse gracieusement/)).toBeTruthy();
    fireEvent.click(screen.getByText("← Banque"));
    fireEvent.click(screen.getByText("banque.licence"));
    expect(screen.getByText("Ed25519 VALIDE — vérifiable hors ligne")).toBeTruthy();
    expect(screen.getByText(/une licence expirée reste authentique/)).toBeTruthy();  // R320
    expect(screen.getByText("etl")).toBeTruthy();                      // module licencié visible
  });

  it("U2-34 V2-M10 structures juridiques : barème R288 consultable ET éditable (points TRUST)", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("Banque"));
    fireEvent.click(screen.getByText("legal.structures"));
    expect(screen.getByText("Société de domicile")).toBeTruthy();      // consultation : les 8 formes
    expect(screen.getByText("35 pts")).toBeTruthy();                   // TRUST au sommet du barème
    fireEvent.click(screen.getByText("Modifier (brouillon)"));
    fireEvent.change(screen.getByLabelText("TRUST points"), { target: { value: "30" } });
    expect(screen.getByText(/Écarts du brouillon \(1\)/)).toBeTruthy();
    expect(screen.getByText("35 pts", { selector: "span" })).toBeTruthy();  // l'avant reste visible
    fireEvent.click(screen.getByText("Soumettre le brouillon"));
    expect(screen.getByText(/le motif de publication est obligatoire \(R7\)/)).toBeTruthy();
  });

  it("U2-35 V2-M11 types de CoC : registre à date, HAUTE force REVISION_KYC (SD-06 servi)", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("Règles"));
    fireEvent.click(screen.getByText("coc.types"));
    expect(screen.getByText("UBO_CHANGE")).toBeTruthy();
    expect(screen.getAllByText("HAUTE").length).toBe(2);                       // UBO + nationalité
    expect(screen.getByText(/refus typé SERVI par le moteur \(SD-06\)/)).toBeTruthy();
    expect(screen.getByText(/re-screening PROPOSÉ, jamais exécuté \(R42\/R44\)/)).toBeTruthy();
  });

  it("U2-36 V2-M11 Config & Go-live : requis manquants NOMMÉS, activation bloquée (R127/R128)", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("Banque"));
    fireEvent.click(screen.getByText("banque.golive"));
    expect(screen.getByText(/GO-LIVE BLOQUÉ \(R128\)/)).toBeTruthy();
    expect(screen.getByText(/gedDocTypes — types documentaires GED/)).toBeTruthy();   // nommé, pas compté
    expect(screen.getByText(/coreSystemeRef — référence core banking/)).toBeTruthy();
    expect(screen.getByText(/la signature du répondant bancaire/)).toBeTruthy();
    expect(screen.getByText(/le refus vient du moteur/)).toBeTruthy();
  });

  it("U2-37 V2-M11 recette client BAT : verdicts, écart bloquant, NON PROMOTABLE motivé (R333)", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByText("Banque"));
    fireEvent.click(screen.getByText("banque.bat"));
    expect(screen.getAllByText("PASS").length).toBe(4);
    expect(screen.getByText("ECHEC")).toBeTruthy();
    expect(screen.getByText("BLOQUANT")).toBeTruthy();
    expect(screen.getByText(/NON PROMOTABLE — le verdict fait autorité côté moteur/)).toBeTruthy();
    expect(screen.getByText(/visa de campagne manquant \(R15\)/)).toBeTruthy();
    expect(screen.getByText(/jamais un cahier rédigé à la main/)).toBeTruthy();
  });

  it("U2-38 V2-M12 polices vendorisées : 7 @font-face locaux, aucun appel sortant (on-premise)", () => {
    const faces = tokensCss.match(/@font-face/g) ?? [];
    expect(faces.length).toBe(7);                                              // Sans 400/400i/500/600/700 + Mono 400/500
    const sources = tokensCss.match(/src:\s*url\("([^"]+)"\)/g) ?? [];
    expect(sources.length).toBe(7);
    for (const s of sources) expect(s).toContain('url("./fonts/');             // vendorisé, chemin relatif bundlé
    expect(tokensCss).not.toMatch(/https?:\/\//);                              // zéro URL sortante (CDN interdit)
    expect(tokensCss).toContain("font-display: swap");                         // repli système sans blocage
  });

  // ══ V2-M14 — le registre des capacités : parcours client + TOUTE la v1, activable
  //    par licence (R320) et par profil (R282). Arbitrage PO du 11.08.2026. ══

  it("U2-39 V2-M14 registre : les 86 capacités v1 ont toutes une destination et un porteur", () => {
    expect(CAPACITES.length).toBe(86);   // les 86 écrans du ROUTEUR v1, pas les 82 du menu
    for (const c of CAPACITES) {
      expect(c.destination).toBeTruthy();                    // aucune capacité sans destination
      expect(c.roles.length).toBeGreaterThan(0);             // aucune capacité sans profil autorisé
      expect(["livre", "partiel", "absent"]).toContain(c.statut);
      // toute capacité non livrée DIT ce qui lui manque — pas de statut sans motif.
      if (c.statut !== "livre") expect((c.motif ?? "").length).toBeGreaterThan(10);
    }
    // L'état réel est ASSUMÉ, vérifié écran par écran (audit V2-M17). Le registre ne prétend
    // jamais mieux que l'état du code : ces trois nombres se corrigent par une CONSTRUCTION.
    // V2-M47 : 63/10/13 → 66/11/9. Les quatre capacités dont l'onglet de destination n'existait
    // pas ont été construites — `inference` passe à « partiel » et non à « livré », parce qu'il
    // lui manque encore le référentiel de profils, pas l'écran.
    expect(CAPACITES.filter((c) => c.statut === "livre").length).toBe(67);   // V2-M48 : + swiftlab
    expect(CAPACITES.filter((c) => c.statut === "partiel").length).toBe(10);
    expect(CAPACITES.filter((c) => c.statut === "absent").length).toBe(9);
    // les identifiants sont uniques : le deep-link ⌘K est sans ambiguïté.
    expect(new Set(CAPACITES.map((c) => c.id)).size).toBe(CAPACITES.length);
  });

  it("U2-40 V2-M14 licence (R320) : un module non licencié rend ses capacités INVISIBLES", () => {
    const socle = ["KYC", "AML", "SCREENING", "GED", "ACCREV", "COC", "ONBOARDING", "WORKFLOWS", "IA"];
    const sansPms = capacitesVisibles("RM", socle);
    expect(sansPms.some((c) => c.id === "pms")).toBe(false);          // PMS absent, pas grisé
    expect(capacitesVisibles("RM", [...socle, "PMS"]).some((c) => c.id === "pms")).toBe(true);
    // le socle (licence null) reste servi quelle que soit la licence — même liste vide.
    expect(capacitesVisibles("RM", []).every((c) => c.licence === null)).toBe(true);
    expect(licenceActive(null, [])).toBe(true);
    // un module marqué « † » (non encore ratifié à MODULES_PRODUIT) se teste sans son marqueur.
    expect(licenceActive("†ISLAMIC", ["ISLAMIC"])).toBe(true);
    expect(licenceActive("†ISLAMIC", [])).toBe(false);
  });

  it("U2-41 V2-M14 profil (R282) : un rôle ne voit que ses capacités — un écran non autorisé n'apparaît pas", () => {
    const tout = CAPACITES.map((c) => (c.licence ?? "").replace(/^†/, "")).filter(Boolean);
    const rm = capacitesVisibles("RM", tout);
    const mlro = capacitesVisibles("MLRO", tout);
    // le RM ne voit ni les communications MROS ni la supervision ES (matrice R282).
    expect(rm.some((c) => c.id === "mros")).toBe(false);
    expect(rm.some((c) => c.id === "surveillancees")).toBe(false);
    expect(mlro.some((c) => c.id === "mros")).toBe(true);
    // l'auditeur ne pilote rien : aucune capacité de paramétrage d'accès ne lui est ouverte.
    expect(capacitesVisibles("AUDIT", tout).some((c) => c.id === "paramnav")).toBe(false);
    // les deux gardes sont ET : le bon rôle sans la licence ne voit toujours rien.
    expect(capacitesVisibles("RM", []).some((c) => c.id === "kyc")).toBe(false);
  });

  it("U2-42 V2-M14 navigation : les destinations découlent du registre, jamais d'une liste en dur", () => {
    const tout = CAPACITES.map((c) => (c.licence ?? "").replace(/^†/, "")).filter(Boolean);
    const dAudit = destinationsVisibles("AUDIT", tout);
    expect(dAudit).toContain("rapports");
    expect(dAudit).not.toContain("entree");            // l'auditeur n'entre pas en relation
    // un RM pleinement licencié atteint les verticaux métiers ; sans licence, ils disparaissent.
    expect(destinationsVisibles("RM", tout)).toContain("islamic");
    expect(destinationsVisibles("RM", [])).not.toContain("islamic");
  });

  it("U2-48 V2-M29 Cross-Border : écran de plein droit — six familles du moteur, sources dites, R44 tenu", () => {
    render(<CrossBorder active="crossborder" onNavigate={() => undefined} />);
    // les six familles de routes du moteur ont chacune leur onglet (E-V2-1 soldé)
    for (const o of ["Exposition", "Matrice pays", "Dérogations", "Actes & pré-acte",
      "Sollicitation inversée", "Ordres & reporting"])
      expect(screen.getByRole("button", { name: o })).toBeTruthy();
    // l'AUM n'est PAS reconstitué : le modèle ne le porte pas, l'écran le dit
    expect(screen.getByText(/L'AUM par juridiction n'est PAS affiché/)).toBeTruthy();
    // R44 : le moteur consigne un verdict, il ne sanctionne pas
    expect(screen.getByText(/Il ne sanctionne pas, ne clôt pas un dossier/)).toBeTruthy();
  });

  it("U2-49 V2-M30 Cross-Border : les dérogations se LISENT ; deux états, jamais un troisième inventé ; l'acte nomme sa garde", () => {
    render(<CrossBorder active="crossborder" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Dérogations" }));
    // l'onglet est câblé sur la projection du moteur (E-V2-5 soldé) — plus de bandeau de maquette
    expect(screen.queryByText(/n'expose pas de route de lecture/)).toBeNull();
    expect(screen.getByText(/le moteur n'émet pas d'événement de refus/i)).toBeTruthy();
    // l'état est dérivé du visa : seules ces deux valeurs peuvent apparaître
    expect(screen.getAllByText(/VISÉE|EN ATTENTE DE VISA/).length).toBeGreaterThan(0);
    expect(screen.queryByText("REFUSÉE")).toBeNull();
    // l'acte dit sa garde ET sa route ; il n'exécute rien
    fireEvent.click(screen.getByRole("button", { name: "Viser une dérogation" }));
    const dit = screen.getAllByRole("status").map((n) => n.textContent).join(" ");
    expect(dit).toContain("R294");
    expect(dit).toContain("l'initiateur ne vise pas");
    expect(dit).toContain("POST /v1/crossborder/derogations/:id/visa");
  });

  it("U2-50 V2-M29 matrice : la version datée est portée, et une sync en échec ne se tait pas (R453)", () => {
    render(<CrossBorder active="crossborder" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Matrice pays" }));
    expect(screen.getByText("XBM-2026-07")).toBeTruthy();            // la version, pas « à jour »
    expect(screen.getByText(/synchronisation en échec depuis/)).toBeTruthy();
    expect(screen.getByText(/plus dangereuse qu'une matrice absente/)).toBeTruthy();
  });

  it("U2-51 V2-M29 bloc Métiers : la nav lit le registre — un module ne peut pas y être nommé autrement", () => {
    // le libellé du bloc « Métiers » vient de CAPACITES, jamais d'un littéral d'écran
    for (const m of MODULES_METIERS_DEMO)
      expect(CAPACITES.some((c) => c.destination === m.id && c.libelle === m.label)).toBe(true);
    expect(MODULES_METIERS_DEMO.some((m) => m.id === "crossborder")).toBe(true);
  });

  it("U2-52 V2-M31 Paramétrage : le registre §CrossBorder se règle depuis le Paramétrage, sous engagement (R462/R445)", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Cross-Border" }));
    expect(screen.getByText("crossborder.preActe.severites")).toBeTruthy();
    expect(screen.getByText("crossborder.localisationTemporaire.dureeMaxJours")).toBeTruthy();
    // une clé ENGAGEANTE ouvre le pop-up de responsabilité ; sans texte, rien ne se publie
    fireEvent.click(screen.getByText("crossborder.preActe.severites"));
    expect(screen.getByText("ENGAGEMENT REQUIS")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Modifier avec engagement" }));
    expect(screen.getByText(/le moteur REFUSE l'écriture/)).toBeTruthy();
    expect(screen.getByText(/grandfathering R29/)).toBeTruthy();      // portée : actes futurs
  });

  it("U2-53 V2-M32 Surveillance : AML Gap sous Surveillance — un signal se qualifie, il ne décide pas (R44)", () => {
    render(<Surveillance active="surveillance" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "AML Gap" }));
    expect(screen.getByText("SF-03")).toBeTruthy();                   // code de famille (V2-M15)
    expect(screen.getByText("Contrepartie sanctionnée sur un virement")).toBeTruthy();
    expect(screen.getByText("VRAI POSITIF")).toBeTruthy();            // la qualification est humaine
    expect(screen.getByText(/Un scénario ne DÉCIDE de rien/)).toBeTruthy();
  });

  it("U2-54 V2-M32 Surveillance : le référentiel dit les 4 familles ET l'écart CPSI, sans dupliquer une règle", () => {
    render(<Surveillance active="surveillance" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Référentiel" }));
    for (const f of ["Surveillance transactionnelle", "AML Gap", "Conformité Shariah", "Bibliothèque CPSI"])
      expect(screen.getAllByText(f).length).toBeGreaterThan(0);   // « AML Gap » est aussi un onglet
    expect(screen.getByText("128")).toBeTruthy();                     // le total, pas 128 lignes recopiées
    expect(screen.getByText("front v1 seulement")).toBeTruthy();      // l'écart est PORTÉ
    expect(screen.getByText(/E-AML-2 est ouvert, il n'est pas comblé/)).toBeTruthy();
  });

  it("U2-55 V2-M33 : aucun contrôle inerte dans l'UI v2 — un bouton qui ne fait rien MENT", () => {
    // Garde de SOURCE : elle rougit si un placeholder revient, quel que soit l'écran. Un bouton
    // sans action promet une capacité, occupe la place où l'utilisateur la cherchera, et fait
    // passer l'écran pour plus avancé qu'il n'est. On l'interdit par un test, pas par une
    // consigne : une consigne s'oublie au lot suivant.
    const dir = join(process.cwd(), "src/ui2");
    const fautes: string[] = [];
    const parcourir = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) { parcourir(p); continue; }
        if (!e.name.endsWith(".tsx") || e.name.endsWith(".test.tsx")) continue;
        const src = readFileSync(p, "utf8");
        for (const [i, ligne] of src.split("\n").entries()) {
          if (/on(Open|Click|Navigate)=\{\(\)\s*=>\s*undefined\}/.test(ligne))
            fautes.push(`${e.name}:${i + 1} — gestionnaire inerte`);
          if (/<Ui2Bouton(\s+primaire)?>/.test(ligne))
            fautes.push(`${e.name}:${i + 1} — <Ui2Bouton> sans onClick`);
        }
      }
    };
    parcourir(dir);
    expect(fautes).toEqual([]);
  });

  it("U2-56 V2-M34 : le CÂBLAGE se mesure — nombre d'écritures réelles de l'UI v2 vers le moteur", () => {
    // Le compteur honnête (docs/AUDIT-CABLAGE-V2.md). L'audit de couverture comptait des
    // SURFACES et annonçait 63 capacités livrées ; sous le seul critère qui compte — poser
    // l'acte et que le moteur l'enregistre — le nombre était 0. Ce test AFFICHE la valeur au
    // lieu de la raconter, et le chiffre attendu se relève à chaque acte câblé.
    const dir = join(process.cwd(), "src/ui2");
    let ecritures = 0, ecrans = 0;
    const parcourir = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) { parcourir(p); continue; }
        if (!/\.(tsx|ts)$/.test(e.name) || e.name.endsWith(".test.tsx")) continue;
        const src = readFileSync(p, "utf8");
        // On compte des APPELS, pas des mentions : un `apiPost` cité dans un commentaire ou
        // listé dans un import n'écrit rien. D'où le `[<(]` exigé derrière le nom.
        ecritures += (src.match(/\b(apiPost|apiPut|apiPatch|apiDelete)\s*[<(]/g) ?? []).length;
        // « écran qui pose un acte » : celui qui appelle le hook OU qui monte la barre
        // mutualisée. On exclut le module qui les définit — il n'est l'écran de personne.
        if (e.name !== "acte-moteur.tsx"
          && (/=\s*useActeMoteur\s*\(/.test(src) || /<BarreActes\b/.test(src))) ecrans += 1;
      }
    };
    parcourir(dir);
    // Attendu = l'état RÉEL du jour. Relever ce nombre est le geste qui atteste un câblage ;
    // le baisser sans motif est une régression que ce test rend visible.
    // 0 → 1 au lot V2-M35 (UN chemin d'écriture, acte-moteur.tsx, emprunté par la Surveillance).
    // 1 → 2 écrans au lot V2-M36 (Cross-Border), → 3 au lot V2-M37 (Rapports : MROS,
    // habilitations, veille, registre). Relever ces nombres atteste un câblage.
    expect(ecritures).toBe(1);
    expect(ecrans).toBe(3);
  });

  it("U2-57 V2-M35 : l'acte PART vraiment, et le refus du moteur s'AFFICHE au lieu de disparaître", async () => {
    // Le sujet du lot n'est pas le succès, c'est le REFUS. Les gardes du produit (R7 motif,
    // R13 second regard, R445 engagement, R294 rôle) ne vivent qu'au moteur : une UI qui avale
    // les erreurs les rend invisibles — l'utilisateur croit avoir agi, la banque croit la garde
    // active, et rien n'a été écrit.
    render(<Surveillance active="surveillance" onNavigate={() => undefined} />);
    // 1. la garde locale tient : sans motif, rien ne part (R7)
    fireEvent.click(screen.getByText("Enregistrer la qualification"));
    expect(screen.queryByText(/Décision soumise/)).toBeNull();
    // 2. avec une option et un motif, l'acte est soumis et son ISSUE est rendue
    fireEvent.click(screen.getByText("Faux positif"));
    fireEvent.change(screen.getAllByLabelText("Motif")[0],
      { target: { value: "Flux justifié par le contrat de vente produit." } });
    fireEvent.click(screen.getByText("Enregistrer la qualification"));
    expect(await screen.findByText(/Décision soumise/)).toBeTruthy();
    // 3. l'API n'étant pas connectée en test, le moteur REFUSE : l'écran le dit, sans rien simuler
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain("AUCUNE ÉCRITURE");
    expect(alerte.textContent).toMatch(/rien n'a été écrit et rien n'a été simulé/);
    expect(alerte.textContent).toContain("/v1/riskcases");        // la route est nommée
    // 4. et surtout : plus jamais « Qualification enregistrée » quand rien n'est parti
    expect(screen.queryByText(/Qualification enregistrée/)).toBeNull();
  });

  it("U2-58 V2-M36 Cross-Border : les actes se POSENT — champs du moteur, route résolue, refus affiché", async () => {
    render(<CrossBorder active="crossborder" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Dérogations" }));
    fireEvent.click(screen.getByRole("button", { name: "Demander une dérogation" }));
    // les champs sont ceux que le CONTRÔLEUR exige, pas une invention d'écran
    expect(screen.getByLabelText("Motif (R7 — obligatoire)")).toBeTruthy();
    expect(screen.getByLabelText("Juridiction")).toBeTruthy();
    // un acte INCOMPLET part quand même : la garde est au moteur, l'écran ne la re-implémente pas
    fireEvent.click(screen.getByRole("button", { name: "Poser l'acte" }));
    const refus = await screen.findByRole("alert");
    expect(refus.textContent).toContain("AUCUNE ÉCRITURE");
    expect(refus.textContent).toContain("/v1/crossborder/derogations");
  });

  it("U2-59 V2-M36 : un acte de LECTURE (rejeu R48) résout sa route et dit qu'aucune donnée réelle n'est servie", async () => {
    render(<CrossBorder active="crossborder" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Actes & pré-acte" }));
    fireEvent.click(screen.getByRole("button", { name: "Rejouer un verdict à date" }));
    fireEvent.change(screen.getByLabelText("Objet"), { target: { value: "KYC-2026-00512" } });
    fireEvent.change(screen.getByLabelText("Date du rejeu"), { target: { value: "2026-07-22" } });
    fireEvent.click(screen.getByRole("button", { name: "Interroger le moteur" }));
    const r = await screen.findByRole("alert");
    expect(r.textContent).toMatch(/aucune donnée réelle n'est affichée/);
    // la route porte l'objet ET la date : c'est ce qui distingue un rejeu d'une lecture courante
    expect(r.textContent).toContain("KYC-2026-00512");
    expect(r.textContent).toContain("asOf=2026-07-22");
  });

  it("U2-60 V2-M37 Rapports : les actes MROS se posent — et la LEVÉE de gel existe enfin", async () => {
    render(<Pilotage active="rapports" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "MROS · goAML" }));
    // la garde du gel annonçait un acte symétrique que l'écran ne permettait pas : il est là
    const lever = screen.getByRole("button", { name: "Lever un gel" });
    expect(lever).toBeTruthy();
    fireEvent.click(lever);
    expect(screen.getByLabelText("Motif de la levée (R131)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Poser l'acte" }));
    const r = await screen.findByRole("alert");
    expect(r.textContent).toContain("AUCUNE ÉCRITURE");
    expect(r.textContent).toContain("/v1/mros");
    expect(r.textContent).toContain("gel/lever");           // la route symétrique, résolue
  });

  it("U2-61 V2-M37 : la barre d'actes est MUTUALISÉE — un seul formulaire pour tous les écrans", () => {
    // Trois écrans posent des actes ; une deuxième copie du formulaire aurait été le début de
    // la dérive que ce chantier corrige. Le composant partagé est déclaré UNE fois.
    const dir = join(process.cwd(), "src/ui2");
    let definitions = 0, emplois = 0;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith(".tsx") || e.name.endsWith(".test.tsx")) continue;
      const src = readFileSync(join(dir, e.name), "utf8");
      definitions += (src.match(/export function BarreActes\b/g) ?? []).length;
      emplois += /<BarreActes\b/.test(src) ? 1 : 0;
    }
    expect(definitions).toBe(1);
    expect(emplois).toBeGreaterThanOrEqual(2);
  });

  // ── V2-M47 : les quatre capacités v1 dont l'ONGLET DE DESTINATION n'existait pas ──────────
  // `capacites.ts` les portait honnêtement en « absent » avec pour motif « onglet non
  // construit ». Les construire ferme l'écart ; ces quatre gardes vérifient qu'il reste fermé.

  it("U2-62 V2-M47 DossierKyc : l'onglet Exigences existe, et il n'INVENTE aucune exigence", () => {
    render(<DossierKyc active="kyc" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Exigences" }));
    // Sans API, le ledger ne rend rien : l'écran DIT que le référentiel doit être publié.
    // C'est le contraire d'une checklist par défaut — inventer des exigences serait pire que rien.
    expect(screen.getByText(/le moteur ne rend aucune exigence/i)).toBeTruthy();
    expect(screen.getByText(/n'en fabrique pas/i)).toBeTruthy();
    // et aucune puce SATISFAITE ne peut apparaître sans réponse du moteur
    expect(screen.queryByText("SATISFAITE")).toBeNull();
  });

  it("U2-63 V2-M47 DossierKyc : l'onglet Pré-revue IA nomme sa source et rappelle que l'IA PROPOSE (R44)", () => {
    render(<DossierKyc active="kyc" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Pré-revue IA" }));
    expect(screen.getByText(/PROPOSITION/)).toBeTruthy();
    expect(screen.getByText(/le traiter est un acte humain/i)).toBeTruthy();
    // aucun visa, aucune clôture depuis cet onglet
    expect(screen.queryByRole("button", { name: /Viser|Clôturer/ })).toBeNull();
  });

  it("U2-64 V2-M47 Paramétrage · IA : le journal des runs porte le budget FIGÉ et la porte humaine", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "IA" }));
    expect(screen.getByText("olivia.gouvernance.curseur")).toBeTruthy();   // les clés d'abord
    fireEvent.click(screen.getByRole("button", { name: "Runs Olivia" }));
    // les NOMS sont ceux du moteur (missionCode, statuts de la machine R260) — pas des libellés d'écran
    expect(screen.getByText("PREREVUE_DOSSIER")).toBeTruthy();
    expect(screen.getByText("PAUSE_PORTE")).toBeTruthy();
    expect(screen.getByText(/étapes · 18400\/120000 tok/)).toBeTruthy();   // consommé / budget figé (R262)
    expect(screen.getByText(/elle se prend dans le run, jamais depuis cette liste/)).toBeTruthy();
    expect(screen.getByText("LECTURE SEULE")).toBeTruthy();
  });

  it("U2-65 V2-M47 Paramétrage · Workflow : les définitions ET les instances en cours, sans circulation", () => {
    render(<ParamSandbox active="param" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Workflow" }));
    expect(screen.getByText("workflow.WF-KYC-03")).toBeTruthy();           // définitions
    fireEvent.click(screen.getByRole("button", { name: "Instances en cours" }));
    expect(screen.getByText("KYC-2026-0142")).toBeTruthy();
    expect(screen.getByText("KYC:CDD")).toBeTruthy();                      // type du moteur
    expect(screen.getByText("1/2")).toBeTruthy();                          // compte de visas du moteur (R13/R15)
    expect(screen.getByText(/aucune circulation ne se déclenche depuis cette liste/)).toBeTruthy();
  });

  // ── V2-M48 : Transactions & Marchés — construire ce que le moteur peut servir, NOMMER ce qui
  // dépend d'un port. Le périmètre du lot a été décidé par l'API vivante, pas par le registre.

  it("U2-67 V2-M48 Surveillance : l'onglet SWIFT/SEPA POSE l'analyse et conserve la quarantaine", () => {
    render(<Surveillance active="surveillance" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "SWIFT/SEPA" }));
    // l'acte réel, avec la garde du moteur en toutes lettres (R300)
    fireEvent.click(screen.getByRole("button", { name: "Analyser un message SWIFT/SEPA" }));
    expect(screen.getByText(/QUARANTAINE MOTIVÉE/)).toBeTruthy();
    expect(screen.getByText(/jamais une extraction devinée/)).toBeTruthy();
    // un message refusé n'est pas jeté : son motif reste lisible
    expect(screen.getByText(/en-tête SWIFT absent/)).toBeTruthy();
    // un message sans transaction correspondante est dit ORPHELIN, pas rattaché au hasard
    expect(screen.getByText("ORPHELINE")).toBeTruthy();
  });

  it("U2-68 V2-M48 Surveillance : la vue Settlement DIT l'absence de port au lieu de simuler des lots", () => {
    render(<Surveillance active="surveillance" onNavigate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Settlement" }));
    expect(screen.getByText("AUCUN PORT CORE BANKING")).toBeTruthy();
    expect(screen.getByText(/l'import REFUSE explicitement/)).toBeTruthy();
    expect(screen.getByText(/ce qui manque à cette vue n'est pas un écran, c'est un port/)).toBeTruthy();
    // et surtout : aucun lot inventé
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(3);
  });

  it("U2-69 V2-M48 registre : une capacité bloquée par un PORT nomme ce port — plus de motif vague", () => {
    // Avant ce lot, trois capacités disaient « onglet Transactions commun ». C'est un constat
    // d'écran, pas un diagnostic : il laissait croire qu'il suffisait de construire une vue.
    // La garde interdit le retour du motif vague sur cette famille.
    const famille = CAPACITES.filter((c) => c.groupeV1 === "Transactions & Marchés");
    expect(famille.length).toBeGreaterThan(0);
    for (const c of famille) {
      expect(c.motif ?? "").not.toMatch(/onglet Transactions commun/);
      // toute capacité encore amputée dit soit le port, soit l'écran vertical à bâtir
      if (c.statut === "partiel") expect(c.motif ?? "").toMatch(/port/i);
    }
  });

  it("U2-66 V2-M47 registre : plus aucune capacité « absent » ne s'excuse d'un onglet non construit", () => {
    // La garde qui empêche la régression de ce lot : si un onglet est déclaré comme destination
    // d'une capacité et que le motif d'absence est « onglet non construit », l'écart est ouvert.
    const restants = CAPACITES.filter((c) => c.statut === "absent" && /onglet de destination non construit/.test(c.motif ?? ""));
    expect(restants.map((c) => c.id)).toEqual([]);
  });
});
