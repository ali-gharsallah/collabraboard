# Parité — Bac à sable KYC (`sbkyc`)

**Source** : `docs/reference/olive-demo.html`
- `KycSandboxScreen` : 18944–19149 · constantes `KYC_SB_ENCOURS`/`KYC_SB_LABELS`/`KYC_SB_DROITS` : 18937–18943

## Fichiers portés
- `apps/web/src/parity/KycSandboxScreen.tsx` — écran dry-run (R70) porté verbatim : sélection d'une
  section, édition des **droits par question** (EDIT/VIEW/REQUIRED/HIDDEN), ajout de questions,
  recalcul immédiat des dossiers en cours impactés, charge de réponses à collecter, ventilation
  **par RM** (« qui fera le travail »), stress test, date de mise en vigueur (R29), appliquer /
  proposer au comité. Constantes `KYC_SB_*` inline.
- Wiring `Shell.tsx` : `case "sbkyc"`.

## Réutilise (déjà porté)
- `QUESTIONS_TEMPLATE` (kyc-detail-data), `KYCS_DATA` (fixture), `sbTension`/`SbStress`/`sbProposer`
  (sandbox-support), `pushParamAudit`.

## Réellement calculé (pas figé)
- Rendre une question obligatoire rend incomplets d'un coup les dossiers en cours (statuts
  DRAFT/IN_PROGRESS/UNDER_REVIEW/PENDING_APPROVAL) : ex. « Type de mandat » EDIT→REQUIRED = 50 dossiers
  impactés, 50 réponses à collecter, ventilées par RM (Patrick Durand 8, J.-P. Favre 7…). Les dossiers
  APPROVED restent protégés par grandfathering (R29/R48). Appliquer mute `QUESTIONS_TEMPLATE[section]` ;
  Proposer pousse une reco au comité.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`KycSandboxScreen`, `KYC_SB_LABELS`,
  `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; recalcul d'impact et ventilation RM conformes.
