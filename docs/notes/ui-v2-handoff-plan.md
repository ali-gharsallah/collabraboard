# Handoff UI v2 — réception, plan d'attaque, décisions PO en attente

**Reçu le 2026-08-09** (zip « Pitch et maquette Olive 2 »), versé dans
`docs/design/design_handoff_olive_ui_v2/` (README complet, PROMPT, 4 planches HTML hifi,
10 captures 1440×900, globe d3-geo). **Statut : AUCUN code UI v2 écrit** — le PROMPT du
handoff l'exige : exploration → plan validé par le PO → implémentation. Cette note EST
l'exploration et le plan ; les 4 décisions métier ci-dessous bloquent le démarrage.

## Ce que le handoff demande (résumé fidèle)

Refonte complète de l'interface : architecture à 3 blocs (Mon espace · Parcours client ·
Pilotage, 10 entrées + palette ⌘K) au lieu de 60+ entrées à plat ; design tokens (ardoise/olive,
IBM Plex Sans/Mono, sémantique réglementaire stricte) ; 11 composants (StatusChip, StatTile,
WorkQueueRow, SectionChecklist, FieldCard, AiSuggestion, DecisionPanel, ImpactPreview,
EventTimeline, DiffRow, SandboxSlider) ; 10 écrans maquettés hifi, ~50 couverts par 6 patterns.
Contraintes fortes : i18n 4 langues préservée, aucune couleur en dur, contrastes AA ≥ 4,5:1,
bouton jamais grisé sans explication, motif obligatoire pour toute décision, l'IA ne propose
JAMAIS de décision sur une alerte critique (R44 rendu visible), aucun état client ne mute une
donnée métier (événement → projection — notre CRUD-primaire + journal témoin, PAS de l'event
sourcing).

## Convergences avec l'acquis (le repo fait foi)

- **`DecisionPanel` + motif obligatoire + « Effets de cette décision »** = exactement la barre de
  décision unifiée R474–R477 livrée côté API (Bloc 65 Volet B, `/v1/decisions`). L'écran 06
  (Revue périodique, Diff Review) = le delta R467 ; « Reporter les 28 sections inchangées » =
  le visa en bloc R467. La corbeille R478 = la file de travail de « Ma journée » (écran 01).
- **Écran 09 (Audit, rejeu)** = R48/R49 existants (rejeu à date, config d'époque).
- **Écran 10 (bac à sable dans l'écran de paramétrage)** = recoupe les 8 bacs à sable existants
  (décision PO n°1 ci-dessous) et l'« optimisation honnête » (alertes fondées perdues affichées).
- **FilterBar R404, i18n R326/R327, licences par module R320** : à préserver tels quels.

## Plan d'attaque proposé (après validation PO)

Suivre l'ordre du handoff, dans `apps/web` (React 19) — la démo HTML monofichier reste la
vitrine tant que la bascule n'est pas actée :
1. Tokens → thème (variables CSS), shell (Nav 248px, 2 headers, grille) ;
2. Composants transverses (StatusChip, StatTile, WorkQueueRow, EventTimeline) ;
3. « Ma journée » (branché sur /v1/decisions/corbeille — la corbeille R478 EST la file) ;
4. Palette ⌘K ; 5. Dossier KYC ; 6. AML + screening (DecisionPanel → /v1/decisions) ;
7. Revue + CoC (DiffRow → delta R467, ImpactPreview) ; 8. Pilotage/audit/paramétrage ;
9. Les ~50 écrans par patterns.
Jeu d'icônes vectoriel : à proposer au PO avant intégration (le handoff l'exige).

## Décisions PO — ARBITRÉES le 10.08.2026 (4× OUI, options recommandées)

1. **Les 8 bacs à sable** disparaissent comme entrées de menu → onglet Simulation dans chaque
   écran de paramétrage concerné (modèle écran 10) ; les deep-links existants redirigent.
2. **Doublon capacité d'équipe** → UN seul écran : encart dans « Ma journée » + vue détaillée
   dans Pilotage (écran 08).
3. **Fusion des trois tableaux de bord** (Compliance Center · Dashboard central · Command
   Center) → « Ma journée » (opérationnel — absorbe le cockpit par rôle v.15 ET la corbeille
   « À décider » R478) + « Rapports » (pilotage). Les trois écrans actuels quittent le menu.
4. **Modules verticaux** (PMS, FX, Custody, Mobile, OIL, Legal, Octopulse) → bloc « Métiers »
   optionnel, affiché uniquement si le module est licencié (R320).

**Le plan est donc VALIDÉ** — la refonte peut démarrer par l'étape 1 du handoff (tokens +
shell : variables de thème, Nav 248px à 3 blocs, les deux headers, la grille), avec montrée
au PO avant de continuer, comme le PROMPT l'exige.

## Clôture — 9 étapes LIVRÉES (10.08.2026, couche opt-in `apps/web/src/ui2/`)

1. Tokens + shell · 2. Composants transverses · 3. Ma journée (corbeille R478 branchée) ·
4. Palette ⌘K · 5. Dossier KYC (+ arbitrage PO « Lucide ») · 6. Surveillance 03+05
(DecisionPanel R474–R476, DiffTable) · 7. Revue 06 + CoC 07 (delta R467 branché,
ImpactPreview) · 8. Pilotage 08 + Audit-rejeu 09 (R48/R29) + Bac à sable 10 (SandboxSlider) ·
9. Entrée en relation 04 (la 10ᵉ maquette), pattern Entity List (Mes dossiers `/v1/kyc`,
Mes clients `/v1/clients` + onglet Personnes), et **cartographie de migration**
(`ui2/cartographie.ts`, ~55 écrans v1 → destination v2 dans la palette ⌘K — les 4 fusions
arbitrées comprises). **10/10 maquettes construites**, 19 tests vitest d'invariants du
handoff, captures Playwright livrées au PO à chaque étape, budget bundle gouverné
(220→270 par relèvements motivés, tout dans le chunk LAZY `ui2`).

**Reliquats assumés (hors périmètre de la couche opt-in)** : la bascule de l'UI v1 vers la
v2 (remplacer les écrans existants — décision PO séparée) ; vendorisation IBM Plex
(on-premise) ; onglets secondaires non maquettés (Transactions de Surveillance, Sorties de
Revue, sections de Paramétrage autres que l'écran 10) : couverts par la cartographie ⌘K et
les patterns, à construire à la demande.
