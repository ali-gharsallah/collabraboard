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
import { EntreeRelation } from "./EntreeRelation";
import { EntityList, MesClients } from "./Listes";
import { Surveillance } from "./Surveillance";
import { Pilotage } from "./Pilotage";
import { AuditRejeu } from "./AuditRejeu";
import { ParamSandbox } from "./ParamSandbox";

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
    expect(cc[0].detail).toContain("fusionné");
    expect(chercher("bacs à sable", { ecrans: ECRANS_MIGRES, ...vide }, tr)[0].cible).toBe("param");
    expect(chercher("capacité équipe", { ecrans: ECRANS_MIGRES, ...vide }, tr)[0].cible).toBe("rapports");
    expect(chercher("compliance center", { ecrans: ECRANS_MIGRES, ...vide }, tr)[0].cible).toBe("surveillance");
    // la table couvre bien les ~50 écrans des trois blocs du README
    expect(ECRANS_MIGRES.length).toBeGreaterThanOrEqual(50);
    const cibles = new Set(ECRANS_MIGRES.map((e) => e.id));
    for (const c of cibles) expect(["journee", "dossiers", "clients", "entree", "kyc",
      "surveillance", "revue", "rapports", "param"]).toContain(c);   // aucune destination orpheline
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
    fireEvent.click(screen.getByText("Pilotage (écran 08)"));                    // retour : écran 08 intact
    expect(screen.getByText(/seul goulot interne/)).toBeTruthy();
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
});
