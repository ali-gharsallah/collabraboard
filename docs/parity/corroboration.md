# Parité — Corroboration KYC (`corrob`)

**Source** : `docs/reference/olive-demo.html`
- `CorroborationScreen` (écran) : 32037–32099
- `corroborationFor` (moteur, 5 axes) : 31299–31342
- `CORROB_STATUS` : 32030–32036

## Fichiers portés
- `apps/web/src/parity/corrob-support.ts` — `CORROB_STATUS`, `corroborationFor` (croise déclaré × observé : PEP, activité, SOW, résidence, correspondance).
- `apps/web/src/parity/CorroborationScreen.tsx` — écran (liste dossiers signalés + fiche 5 axes + clarification tracée).
- Wiring `Shell.tsx` : `case "corrob"`.

## Réutilise (déjà porté)
- `kycsByClientId` (components-data.tsx) — dernier KYC + screening.
- `amlHash` (preonboarding-support.ts), `aumMOf` (demo-init.ts).
- `pushParamAudit` (param-audit-support.ts).

## Consigné (hors périmètre, non porté)
- **`TX_DATA`** (empreinte transactionnelle) non extraite en fixture (idem `aml.ts`) → `[]`.
  Les axes **ACT** (activité) et **RES** (résidence) reposent sur les flux : sans `TX_DATA`,
  ils ressortent « Corroboré » (aucun flux contradictoire observé) — fidèle tant que `TX_DATA`
  n'est pas porté. À compléter au portage des données transactionnelles.

## Réellement calculé (pas figé)
- Axe **PEP** : contradiction déclaré Non-PEP × hit PEP au screening (ex. Watanabe SA →
  « Hit PEP au screening (…) non levé » → Contradiction). Compteurs d'en-tête (contradictions /
  à vérifier / corroborés) dérivés en direct des 84 dossiers.
- Axe **SOW** : AUM ≥ 60M sans justificatif → à vérifier.

## Vérification
- `pnpm run build` → 0 fuite parité (`corroborationFor`, `runExoticOverlay`, `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; 84 dossiers · 7 contradictions · 7 à vérifier · 70 corroborés ;
  fiche 5 axes exacte (PEP contradiction réelle).
