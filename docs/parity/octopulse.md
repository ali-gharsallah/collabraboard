# Parité — Octopulse OppRisk (`opprisk`)

**Source** : `docs/reference/olive-demo.html`
- `OctopulseScreen` (écran) : 31477–31562
- `OCTOPULSE_CFG` / `OCTOPULSE_INCIDENTS` : 31470–31476

## Fichiers portés
- `apps/web/src/parity/octopulse-support.ts` — `OCTOPULSE_CFG` (connecteur), `OCTOPULSE_INCIDENTS` (4 incidents rattachés à CLIENTS[7/12/3]).
- `apps/web/src/parity/OctopulseScreen.tsx` — écran (connecteur + incidents synchronisés par sévérité).
- Wiring `Shell.tsx` : `case "opprisk"`.

## Réutilise (déjà porté)
- `clientById` (components-data.tsx), `amlHash` (preonboarding-support.ts), `pushParamAudit`.

## Consigné
Aucun. Écran autonome : connecteur simulé + incidents seed rattachés aux clients réels.

## Vérification
- `pnpm run build` → 0 fuite parité (`OCTOPULSE_INCIDENTS`, `runExoticOverlay`, `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; connecteur « Connecté » + 4 incidents (HIGH/MEDIUM/LOW) avec clients liés.
