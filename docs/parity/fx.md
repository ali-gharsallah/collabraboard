# Fiche de parité — FxScreen (Multi-devise & FX) — v1

Source : `docs/reference/olive-demo.html` **31692–31754** (écran) + **31680–31691** (moteur).
Ports : `apps/web/src/parity/FxScreen.tsx` + `apps/web/src/parity/fx-support.ts`.
Branché : NAV « Wealth & Marchés » → « Multi-devise & FX » (`case "fx"`).

## Porté (v1) — verbatim
- Moteur (`fx-support.ts`) **déterministe** (amlHash) : `FX_CCYS` (7 devises), `FX_BASE`,
  `fxRate(ccy, monthIdx)` (fixing avec ondulation sinusoïdale + bruit), `fxHistory` (12 mois).
- En-tête « 💱 Multi-devise & taux de change » + « 7 devises · fixing 2026-07-11 · historisation 12 mois ».
- **Fixings vs CHF** : ligne par devise (≠ CHF) — paire, taux (4 déc.), variation ▲/▼ %, sparkline SVG
  12 mois (vert si hausse, rouge si baisse) ; clic → change la devise de base (surlignage olive).
- **Historique {base}/CHF — 12 mois** : barre normalisée + taux par mois (MONTHS), dernier en gras
  olive, variation mensuelle colorée.
- **Convertisseur** : montant (filtré numérique) × fixing courant → « CHF … » (format fr-CH).

Preuve : capture `parity-app.html` → login → Wealth & Marchés → Multi-devise & FX → 0 erreur runtime.
USD/CHF 0.8673 (+2.12%), historique 12 mois, conversion 1 000 000 USD → CHF 867 300.

Frontière : 80/80 vitest · build sans fuite parity dans dist · budget 177.5 kB gz.

## Note
`fxRate` est aussi consommé par l'Analyseur SWIFT/SEPA (SwiftLabScreen) — réutilisable au portage
de cet écran.
