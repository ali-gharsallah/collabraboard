# Parité — Veille réglementaire IA (`regwatch`)

**Source** : `docs/reference/olive-demo.html`
- `RegWatchScreen` (écran) : 32987–33015
- `REG_WATCH` (données) + `regWatchAi` (analyse d'impact) : 20623–20646

## Fichiers portés
- `apps/web/src/parity/regwatch-support.ts` — `REG_WATCH` (5 publications FINMA/FATF/CDB/LSFin/SECO), `regWatchAi` (analyse d'impact déterministe par id).
- `apps/web/src/parity/RegWatchScreen.tsx` — écran (liste + panneau assistant IA + bouton « collecte IA locale »).
- Wiring `Shell.tsx` : `case "regwatch"`.

## Réutilise (déjà porté)
- `Badge` (components.tsx) — source + impact.
- `pushParamAudit` (param-audit-support.ts) — trace « collecte IA ».

## Consigné
Aucun. L'écran est autonome : la « collecte IA (locale) » et l'analyse d'impact sont
des textes déterministes (mappés par id), fidèles à la source — aucun moteur externe.

## Vérification
- `pnpm run build` → 0 fuite parité (`regWatchAi`, `runExoticOverlay`, `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; 5 publications avec badges source/impact, analyse d'impact RW-1 affichée.
