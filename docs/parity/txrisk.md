# Parité — Transactions Risk Monitoring (`txrisk`)

**Source** : `docs/reference/olive-demo.html`
- `TransactionsRiskScreen` : 43589–43909 · données géo + TX : 43424–43588

## Fichiers portés
- `apps/web/src/parity/tx-support.ts` — données transactions & géo (verbatim) : `TX_HUBS` (coordonnées),
  `TX_HUB_CC` (drapeau par hub), `TX_DATA` (seed statique des transactions), `TX_RISK_C` (couleurs),
  `TX_CONTINENTS` (tracés SVG des continents).
- `apps/web/src/parity/TransactionsRiskScreen.tsx` — 3 vues : **Carte des corridors** (planisphère SVG,
  arcs animés par risque, nœuds pulsés sur les hubs à flux HIGH), **Top flux & détail** (top 5
  entrantes/sortantes CH, panneau de détail transaction), **Transactions** (tableau filtrable).
- Wiring `Shell.tsx` : `case "txrisk"`.

## Réutilise (déjà porté)
- `AML_SCENARIOS` (aml-workspace-support) — nombre de scénarios actifs dans le détail transaction ;
  `Badge`/`SectionTitle` (components).

## Réellement calculé (pas figé)
- Volume total, comptes HIGH, hubs/pays utilisés, volume agrégé par hub (taille des nœuds), arcs de
  Bézier projetés (lon/lat → x/y), filtre par risque, top 5 corridors entrants/sortants Suisse triés
  par montant, détail transaction (corridor, scénarios AML évalués).

## Consigné (hors périmètre parité)
- Enrichissement comportemental `behavAlert`/`addTx` (43466–43542) et ajout depuis les ordres de
  transfert (`TX_DATA.push`, 29843) non portés → `TX_DATA` = seed statique (dégradation fidèle : la
  carte et les tops reflètent le jeu de base, sans les transactions générées à la volée).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`TX_CONTINENTS`,
  `TransactionsRiskScreen`, `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; carte des corridors et top flux conformes.
