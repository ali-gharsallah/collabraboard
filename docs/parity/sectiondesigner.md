# Parité — Section Designer KYC / AR / GAR (`sdkyc` · `sdar` · `sdgar`)

**Source** : `docs/reference/olive-demo.html`
- `SectionDesignerScreen` : 24613–24735 (3 routes via prop `kind` : KYC / AR / GAR)
- anatomie R78 : 24568–24632 · sections KYC/AR/GAR : 21766–21793 · champs & droits : 24736–24773

## Fichiers portés
- `apps/web/src/parity/section-designer-support.ts` — données & helpers verbatim : `WF_SECTION_PHASES`,
  `WF_SECTION_RIGHTS`, `sdRights`/`sdToggleRight` (droits cumulables, Masqué exclusif), `WF_SD_KEYROLES`,
  `WF_RIGHT_C`, `sdEnsureAnatomy` (R78), `WF_SD_KINDS`, `WF_KYC_ROLES`, `WF_KYC_SECTIONS_PARAM` (13),
  `WF_AR_SECTIONS_PARAM` (6), `WF_GAR_SECTIONS_PARAM` (5), `wfChamps`/`WF_FIELD_DEFAULTS`/`WF_FIELDS`/
  `WF_PROD_SEC2PARAM` (défauts alimentés des vrais champs KYC via `QUESTIONS_TEMPLATE`), `WF_MODES`.
- `apps/web/src/parity/SectionDesignerScreen.tsx` — **un seul écran, 3 routes** (`kind` KYC/AR/GAR).
  Onglet **Sections & visas** porté verbatim : tableau des sections (préparateur, nb de questions, visa +
  validateur R2, phase workflow), **réordonnancement par drag & drop** (tracé), **anatomie dépliable** par
  section (R78 : droits par rôle Masqué/Lecture/Écriture/Requis, échange, préparateur/validateur/phase),
  ajout de section. Toutes les mutations tracées au `PARAM_AUDIT`.
- Wiring `Shell.tsx` : `case "sdkyc"` (KYC), `case "sdar"` (AR), `case "sdgar"` (GAR).

## Réutilise (déjà porté)
- `QUESTIONS_TEMPLATE` (kyc-detail-data — alimente les défauts de champs), `wfCarte`/`wfBouton` (wf-styles),
  `pushParamAudit`.

## Réellement calculé (pas figé)
- Les 3 jeux de sections sont réellement modifiables : basculer un visa, changer validateur/préparateur/
  phase, cocher les droits par rôle, réordonner par glisser-déposer, ajouter une section — chaque acte mute
  l'état partagé et se trace. Le compteur de questions est lu de `wfChamps` (défauts KYC = vrais champs
  production via `QUESTIONS_TEMPLATE`).

## Consigné (hors périmètre parité — pour l'instant)
- Onglet **Questionnaire Builder** (`QuestionnaireBuilderScreen`, éditeur drag & drop complet : palette de
  types, glisser-déposer inter-sections, panneau de propriétés, aperçu vivant, export JSON) → panneau de
  consignation neutre. Sous-écran dédié, port ultérieur. L'onglet Sections & visas est pleinement fonctionnel.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`SectionDesignerScreen`, `WF_SD_KINDS`,
  `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; sections KYC + anatomie R78 (droits par rôle) conformes.
