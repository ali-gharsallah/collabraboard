# Parité — Paramétrage → Champs & droits par section (`paramfields`)

**Source** : `docs/reference/olive-demo.html`
- `ParamFieldsScreen` : 24775–24832 (données/helpers `wfChamps`/`WF_MODES`/`WF_FIELD_DEFAULTS` portés dans
  `section-designer-support`)

## Fichiers portés
- `apps/web/src/parity/ParamFieldsScreen.tsx` — écran porté verbatim : sélecteur contexte (KYC / Account
  Review / Grouped AR) + section, tableau des champs avec mode **Désactivé / Lecture / Lecture & écriture**
  (bascule immédiate, journalisée), ajout de champ, et **aperçu vivant** de la section telle que
  l'utilisateur la verra (champs masqués retirés, lecture seule grisés).
- Wiring `Shell.tsx` : `case "paramfields"`.

## Réutilise (déjà porté au Section Designer)
- `WF_KYC_SECTIONS_PARAM`/`WF_AR_SECTIONS_PARAM`/`WF_GAR_SECTIONS_PARAM`, `wfChamps` (défauts alimentés des
  vrais champs KYC via `QUESTIONS_TEMPLATE`), `WF_MODES` (section-designer-support), `wfCarte`/`wfBouton`
  (wf-styles), `pushParamAudit`.

## Réellement calculé (pas figé)
- Les champs affichés sont les **vrais champs des écrans KYC production** (Type de cocontractant,
  Dénomination, Forme juridique, PEP, résidences fiscales…) via `QUESTIONS_TEMPLATE` (une seule vérité,
  R-Q). Basculer un mode mute `WF_FIELDS` (état partagé avec le Section Designer) en direct et se trace ;
  l'aperçu se recompose immédiatement. Ajouter un champ l'insère dans la section.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`ParamFieldsScreen`, `parity/` absents
  de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; modes de champ + aperçu vivant conformes.
