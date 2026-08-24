# Parité — Bac à sable Onboarding (`sbonb`)

**Source** : `docs/reference/olive-demo.html`
- `OnbSandboxScreen` : 19328–19560 · helpers `onbPays`/`onbCdbForm` : 19312–19327
- données `REF_ACCOUNT_TYPES` : 18042 · `WF_KYC_SECTIONS_PARAM` : 21782

## Fichiers portés
- `apps/web/src/parity/OnbSandboxScreen.tsx` — écran dry-run (R70) porté verbatim : formulaire de création
  (structure/pays/activité/type de compte/AUM/PEP), **aiguillage** calculé en direct (score →
  SDD/CDD/EDD, workflow, formulaire CDB, charge documentaire), explication **règle par règle**
  (« pourquoi ce score »), effet des **seuils d'aiguillage** sur le portefeuille réel (répartition
  SDD/CDD/EDD avant/après, clients qui basculent en EDD), stress test, appliquer / proposer au comité.
  Données `REF_ACCOUNT_TYPES`/`WF_KYC_SECTIONS_PARAM` + helpers `onbPays`/`onbCdbForm` inline.
- Wiring `Shell.tsx` : `case "sbonb"`.

## Réutilise (déjà porté)
- `evalAmlRules` (aml.ts), `DOC_STRUCTURES` (preonboarding-support), `WF_RULE_PARAMS` (kyc-support),
  `CPSI_PAYS_RISQUE`/`CPSI_SECTEUR_RISQUE` (cpsi-engine-support), `QUESTIONS_TEMPLATE` (kyc-detail-data),
  `CLIENTS` (fixture), `sbTension`/`SbStress`/`sbProposer` (sandbox-support), `pushParamAudit`.

## Réellement calculé (pas figé)
- Le profil saisi est scoré par `evalAmlRules` : ex. PEP → +25, tier SDD, WF_SDD, CDB A, règle PEP
  affichée dans « pourquoi ce score ». Déplacer les seuils SDD/CDD redistribue les 84 clients (SDD 58 /
  CDD 23 / EDD 3) et liste les clients qui passeraient en EDD. Appliquer mute `WF_RULE_PARAMS.WR0`
  (grandfathering R29) ; Proposer pousse une reco au comité.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`OnbSandboxScreen`,
  `WF_KYC_SECTIONS_PARAM`, `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; aiguillage et redistribution portefeuille conformes.
