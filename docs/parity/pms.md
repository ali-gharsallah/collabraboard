# Fiche de parité — PmsScreen (Portfolio Management System) — v1

Source : `docs/reference/olive-demo.html` **33546–33781** (écran + PmsSpark 33434 + PmsMandateExtras
33501) + **33190–33500** (moteur). Ports : `apps/web/src/parity/PmsScreen.tsx` +
`apps/web/src/parity/pms-support.ts`. Branché : NAV « Wealth & Marchés » → « PMS » (`case "pms"`).

## Porté (v1) — verbatim
- Moteur (`pms-support.ts`) **entièrement déterministe** (amlHash, iso-fonctionnel avec cache) :
  `PMS_UNIVERSE` (22 instruments), `PMS_PROFILES` (Conservateur/Équilibré/Dynamique/Agressif),
  `pmsProfileFor`, `pmsPortfolio`/`__pmsPortfolioRaw` (construction pilotée par l'allocation cible +
  jitter + violations délibérées rares + limite émetteur + **breaches** SUITABILITY/CONCENTRATION/
  RESTRICTION ESG/SHARIAH), `pmsEnrich`/`__pmsEnrichRaw` (positions valorisées, perf 12 mois vs bench),
  `pmsRebalanceProposal`, `pmsPreTradeCheck` (verdict PASS/WARN/BLOCK), `pmsReportMd`,
  `pmsRebalanceFor`, `pmsSuitability` (adéquation LSFin), `pmsRiskMetrics` (vol/MDD/VaR/SRRI).
- Écran, 4 onglets :
  - **Mandats** : table (Client + ☪/🌱, Mandat, Profil LSFin, Devise, Valeur, Perf YTD, vs bench,
    Dérive, Breaches) ; ligne dépliable → Positions (ISIN/classe/poids/valM/perf) + Allocation vs cible
    (barres + repère cible) + Breaches détaillées.
  - **Mandat détail** : sélecteur client → KPI (valorisation/liquidités/perf/frais/TER), `PmsSpark`
    (SVG 12 mois mandat vs bench), table positions valorisées (qté/prix/valeur/P&L), export
    « ⬇ Rapport de gestion » (Blob markdown `pmsReportMd`), + `PmsMandateExtras` (rééquilibrage,
    adéquation LSFin, risque + jauge SRRI).
  - **Contrôles & dérives** : breaches groupées par type + top-10 dérives ≥ 8% avec propositions.
  - **Pre-Trade Check** : simulateur d'ordre (portefeuille × instrument × %) → verdict + contrôles
    détaillés (suitability/concentration/ESG/Shariah/liquidités).

Preuve : capture `parity-app.html` → login → Wealth & Marchés → PMS → onglets Mandats (ligne dépliée)
& Pre-Trade → 0 erreur runtime. 84 mandats, 37 breaches, 55 en dérive ≥ 8% — tous calculés.

## Consignations
- **Settlement** non porté → `settleOrders`/`settleTokenize` stubés localement (file mémoire +
  tokenizer minimal) : le bouton « Générer les ordres → Settlement » de `PmsMandateExtras` reste
  fonctionnel côté UI (passe à « ✓ Ordres envoyés »). À rebrancher au portage de « Exécution & Settlement ».
- `pushParamAudit` : no-op (hors périmètre front).
- **Débloque Pré-prospection** : `pmsPortfolio` est désormais importable ; il restera à porter
  `aumMOf` + l'`exoticOverlay` (mutation globale de CLIENTS) pour finir `crossSellFor`.
