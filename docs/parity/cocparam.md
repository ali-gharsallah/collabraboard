# Parité — CoC Types & sensibilité (`cocparam`)

**Source** : `docs/reference/olive-demo.html`
- `CocParamScreen` : 25631–25795 · moteur CoC : 21758–21806

## Fichiers portés
- `apps/web/src/parity/coc-support.ts` — moteur de configuration CoC (porté verbatim) :
  `COC_CONFIG` (dérivé de `COC_CONFIG_DEFAULT` + `cpsiSev`/`actions`), `COC_ACT_LABEL`, `COC_ACTION_DONE`,
  `COC_CREATED_TASKS` (= TASKS_DATA, même référence), `cocActions`, `cocPrimaryAction` ;
  ré-exporte `COC_TYPE_LABELS` (mutable — ajout de types), `COC_ROLES`, `COC_DATA`.
- `apps/web/src/parity/CocParamScreen.tsx` — écran « CoC — Types & sensibilité », porté verbatim en
  `React.createElement` : règle en clair (R68), ajout de type (R74), table de paramétrage
  (matérialité, actions multi-sélection, rôle affecté, sévérité du signal CPSI), file « Actions en
  attente » alimentée par `COC_DATA` (traiter → trace PARAM_AUDIT, crée éventuellement une tâche).
- `cpsi-engine-support.ts` : ajout `cpsiUser()` (getter du CPSI_USER pour l'id du créateur de tâche).
- Wiring `Shell.tsx` : `case "cocparam"`.

## Adaptation ESM
- `CPSI_USER` (global source) → `cpsiSetUser(user)` en tête + `cpsiUser()` pour l'id.

## Réellement calculé (pas figé)
- 41 types de changement paramétrés ; matérialité Haute force « Révision KYC » ; chaque type émet un
  signal CPSI `coc_sensible` de la sévérité paramétrée (0-3), qui pèse dans le score perpétuel.
- File « Actions en attente » dérivée de `COC_DATA` × `cocActions` (router/KYC/tâche), traçée.

## Consigné
- « Une seule vérité » (source) : `COC_CONFIG` gouverne aussi l'écran opérationnel Change of
  Circumstances. L'écran opérationnel `coc` (CocScreen, source 42346) — porté antérieurement — conserve
  une **copie locale** seedée du même `COC_CONFIG_DEFAULT` ; le partage d'un `COC_CONFIG` unique entre
  les deux écrans n'est **pas encore branché** (rewiring de CocScreen différé).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`cocActions`, `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; règle/ajout/table/severités conformes.
