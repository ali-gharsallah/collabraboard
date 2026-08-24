# Parité — Scénarios AML & groupes de population (`cpsigroupes`)

**Source** : `docs/reference/olive-demo.html`
- `CpsiGroupesScreen` : 26581–26843 · `CpsiSandboxAml` : 26773-zone (27773–27901)
- Moteur : signaux/scénarios 26211–26252, 26458–26516, 26563–26578, 27757–27772

## Fichiers portés
- `apps/web/src/parity/CpsiGroupesScreen.tsx` — écran à 2 onglets (**Scénarios AML** / **Groupes de
  population**) + `CpsiSandboxAml` (bac à sable dry-run). Porté verbatim en `React.createElement`
  (le source l'est aussi). Adaptation ESM : `CPSI_USER = user` → `cpsiSetUser(user)`.
- `apps/web/src/parity/cpsi-engine-support.ts` (**étendu**) — moteur de scénarios/signaux ajouté par
  appariement d'accolades : `cpsiSignaux` (R80/R81 — 1 signal dédupliqué par (client, scénario), scoré
  impact+fréquence, classé ALERTE/NEAR_MISS/ANALYSE vs seuil X), `cpsiAlertesParScenario` (référentiel
  franchissements/HIGH/MEDIUM), `cpsiSimulerScenarios` (dry-run × sensibilité), `cpsiEvaluerScenario`
  (hits par groupe), `cpsiImpact`/`cpsiFreqNorm`/`cpsiPenaliteFP` (R82), `cpsiCreerGroupe` (R74 tracé) ;
  constantes `CPSI_SEUIL_ALERTE`/`CPSI_MARGE_NM`/`CPSI_W_IMPACT`/`CPSI_W_FREQ`/`CPSI_FP`/`CPSI_FP_ACTIVE` ;
  données `CPSI_CHAMPS`/`CPSI_OP_LIST`/`CPSI_FAM_GROUPES`/`CPSI_FAM_SCEN`.
- Wiring `Shell.tsx` : `case "cpsigroupes"`.

## Réutilise (déjà porté)
- `CPSI_GROUPES`/`CPSI_SCENARIOS` (cpsi-data-support), `cpsiMembres`/`cpsiPopulation`/`cpsiAttr`/`CPSI_OPS`/
  `CPSI_OPLIB`/`cpsiDecrireGroupes` (cpsi-engine-support), `pushParamAudit`.

## Réellement calculé (pas figé)
- Chaîne de qualification vivante : **755 franchissements** bruts → dédupliqués en **617 signaux** scorés →
  **331 alertes · 62 near-miss · 224 analyses** (seuil X). Référentiel des 65 scénarios (8 domaines) avec
  attribut surveillé, nb de groupes, franchissements/HIGH/MEDIUM réels par scénario.
- Vue « Par domaine » : seuils par groupe éditables (R73), effectifs et hits recalculés en direct.
- Groupes : éditeur de prédicats (ET/OU, opérateurs ∈/≥/…), table « en clair » (règle d'appartenance,
  barème hérité/surchargé, effectif réel : PP 27, SA/SARL 18, Trusts&fondations 14…).
- `CpsiSandboxAml` : curseur de sensibilité (× seuils) projetant le volume d'alertes sans rien muter (R70).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`cpsiSignaux`,
  `cpsiSimulerScenarios`, `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; les 2 onglets et le bac à sable conformes.
