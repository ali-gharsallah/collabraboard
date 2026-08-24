# Parité — Bac à sable AML (`sbaml`)

**Source** : `docs/reference/olive-demo.html`
- `AmlSandboxScreen` : 18561–18804 · helpers partagés : `amlSbFmt` 18556, `sbTension`/`SbStress`/`sbProposer`/`SB_SOURCES` 18869–18936

## Fichiers portés
- `apps/web/src/parity/sandbox-support.tsx` — **helpers partagés des bacs à sable** (réutilisés par tout
  le cluster + `sbowner`) : `amlSbFmt` (formatteur), `sbTension` (jauge de charge/stress), `SbStress`
  (graphe « point de rupture » — détecte une hausse disproportionnée), registre du **comité de
  paramétrage** (`SB_RECOS` + `sbProposer` — soumission tracée), `SB_SOURCES`.
- `apps/web/src/parity/AmlSandboxScreen.tsx` — écran dry-run (R70) porté verbatim : sélection d'un
  scénario, édition des **seuils par groupe** et de la **portée** (ajout/retrait de groupes),
  recalcul immédiat des alertes (KPI actuelles/simulées/delta/nouvelles/disparues/clients touchés),
  listes nommées, date de mise en vigueur (R29), « Appliquer en production » et « Proposer au comité ».
- Wiring `Shell.tsx` : `case "sbaml"`.

## Réutilise (déjà porté)
- `CPSI_SCENARIOS`/`CPSI_GROUPES` (cpsi-data-support), `cpsiMembres`/`cpsiAttr`/`CPSI_OPS`
  (cpsi-engine-support), `pushParamAudit`.

## Réellement calculé (pas figé)
- Rejoue le scénario sur la population CPSI réelle. Baisser un seuil recalcule en direct les alertes
  qui apparaissent/disparaissent, nommément (ex. seuil 60→1 sur « Structures offshore à risque » :
  31→41 alertes, +10 nouvelles, 10 clients touchés). Stress test balaie ×0.6…×1.4 pour révéler un
  point de rupture. Appliquer mute `sc.groupes_seuils` avec date de mise en vigueur (grandfathering R29,
  journalisé) ; Proposer pousse une reco au comité (`sbowner`, à venir).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`SbStress`, `sbProposer`,
  `SB_RECOS`, `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; recalcul dry-run et stress test conformes.
