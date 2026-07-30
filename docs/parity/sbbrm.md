# Parité — Bac à sable BRM (`sbbrm`)

**Source** : `docs/reference/olive-demo.html`
- `BrmSandboxScreen` : 19150–19327 · `BRM_LBL` : 19144–19148

## Fichiers portés
- `apps/web/src/parity/BrmSandboxScreen.tsx` — écran dry-run (R70) porté verbatim : curseurs de
  **pondération** par facteur (statiques + signaux), **bandes** LOW/MEDIUM et **demi-vie**, recalcul du
  portefeuille entier (répartition avant/après, clients qui basculent de bande, vers/hors HIGH=EDD),
  stress test sur la position de la bande, date de mise en vigueur (R29), appliquer / proposer au comité.
  `BRM_LBL` inline.
- Wiring `Shell.tsx` : `case "sbbrm"`.

## Réutilise (déjà porté)
- `CPSI` (cfg/pop), `cpsiPopulation`, `cpsiScore` (cpsi-engine-support), `sbTension`/`SbStress`/
  `sbProposer` (sandbox-support), `pushParamAudit`.

## Réellement calculé (pas figé)
- Chaque point de pondération / position de bande re-score les 84 clients : ex. MEDIUM 70→55 = 1 client
  bascule (Costa SA MEDIUM→HIGH·EDD), HIGH 6→7, répartition 67/11/6 → 67/10/7. Appliquer mute `CPSI.cfg`
  (invalide le cache `CPSI.pop`) avec grandfathering (R29/R48) ; Proposer pousse une reco au comité.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`BrmSandboxScreen`, `BRM_LBL`,
  `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; re-scoring et bascules de bande conformes.
