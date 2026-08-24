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

## Champ obligatoire + câblage back-end (demande Ali)
- **Front (parité)** : colonne **Obligatoire (R78)** par champ — bascule Obligatoire / Facultatif
  (désactivée si le champ est en mode « Désactivé »), tracée. L'aperçu vivant marque les champs
  obligatoires d'un **✱** rouge et applique `required` + bordure rouge à l'input. Un pied de page
  **« Câblage back-end — paramètre gouverné (R-Q) »** affiche l'écriture courante (JSON exact qui serait
  posté).
- **Back-end** (`apps/api/src/modules/parametres`) : nouveau paramètre gouverné
  `champsObligatoiresParSection` (type `json`, défaut `{}`, règle **R78**, non requis au go-live) dans le
  registre R-Q. Structure `{ "CTX/SECTION_CODE": ["Libellé du champ", …] }`. Écrit via
  `POST /parametres/valeur/champsObligatoiresParSection` : acte **motivé (R7)**, à effet daté **(R29)**,
  append-only (`TenantParamChange`), rejeu à date (R127). Un champ obligatoire manquant est un refus
  explicite au dépôt, jamais un blocage silencieux.
- **Test** : `parametres.wiring.spec.ts` étendu — **RQ-07** (registre typé + refus R7 sans motif +
  matérialisation de la vue effective). `bash scripts/run-rule-tests.sh` → paramètres R-Q **8/8**
  (RQ-01..07), suite complète verte (exit 0).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`ParamFieldsScreen`,
  `champsObligatoiresParSection` absents de `dist`).
- Backend : `scripts/run-rule-tests.sh` → RQ-01..07 8/8, suite complète exit 0 (harnais autonome, sans DB).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; modes, obligatoire, aperçu vivant et payload gouverné conformes.
