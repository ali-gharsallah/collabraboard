# Parité — Analyseur SWIFT / SEPA (`swiftlab`)

**Source** : `docs/reference/olive-demo.html`
- `swiftAnalyze` (moteur) : 31761–31879
- `SwiftLabScreen` (écran) : 31880–32036
- `SWIFT_SAMPLES` (exemples) : 31756
- `RISK_COUNTRIES` / `riskCountryOf` / `RC_LEVELS` : 31620–31637

## Fichiers portés
- `apps/web/src/parity/swift-support.ts` — `SWIFT_SAMPLES`, `swiftAnalyze` (décorticage MT103 / MT202(COV) / SEPA pain.001).
- `apps/web/src/parity/risk-country-support.ts` — `RISK_COUNTRIES`, `riskCountryOf`, `RC_LEVELS` (module partagé : transferts, AML, SWIFT, corroboration).
- `apps/web/src/parity/SwiftLabScreen.tsx` — écran (2 colonnes : saisie message + décorticage/contrôles).
- Wiring `Shell.tsx` : `case "swiftlab"`.

## Réutilise (déjà porté)
- `fxRate` (fx-support.ts) — fixing devise → CHF sur `:32A:` / `<Amt>`.
- `pushParamAudit` (param-audit-support.ts) — trace « SWIFT Lab — analyse d'un message ».

## Consigné (hors périmètre, non porté)
- **`screenMatch`** (moteur de screening sanctions/PEP, source 33914) → stub `[]` :
  aucun hit ≥ 70. Les contrôles « Screening bénéficiaire / donneur d'ordre » ressortent
  donc systématiquement **OK** — fidèle tant que le Screening n'est pas porté.
  À compléter au portage de l'écran Screening (branchement direct, aucune autre modif).

## Réellement calculé (pas figé)
- Décorticage champ par champ des trois formats (regex identiques à la source).
- Contrôles **pays à risque** : `BIC banque bénéficiaire` et `Pays du compte` via `riskCountryOf`
  (ex. BIC `SBERRUMM` → Russie **KO**, IBAN `AE…` → **ATTENTION**).
- Conversion FX du montant sur devise ≠ CHF.
- Détection mot-clé sensible du motif (CASH/CRYPTO/CONSULT).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (marqueurs `swiftAnalyze`,
  `Décortiquer`, `runExoticOverlay`, `parity/` absents de `dist`) · budget 177.5 kB gz.
- Playwright : 0 erreur runtime, MT103 décortiqué, contrôles pays à risque exacts.
