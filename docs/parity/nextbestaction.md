# Parité — Prochaines meilleures actions / Next Best Action (`nextbestaction`)

**Source** : `docs/reference/olive-demo.html`
- `NextBestActionScreen` : 21673–21813 · moteur `NBA_ACTIONS`/`nbaSignalFor`/`nbaEmailDraft` : 21443–21484

## Fichiers portés
- `apps/web/src/parity/nba-support.ts` — moteur Next Best Action (verbatim) : `NBA_ACTIONS`
  (GAIN/LOSS/OPP/IDLE), `nbaSignalFor` (signal déterministe par client via `amlHash`), `nbaEmailDraft`
  (argumentaire d'email généré par type de signal).
- `apps/web/src/parity/NextBestActionScreen.tsx` — écran Assistant IA porté verbatim : analyse du
  portefeuille (scopé au RM/ARM connecté), KPIs (signaux détectés, gains/pertes potentiels,
  opportunités), liste triée par magnitude avec badge d'action, **modale email pré-configuré** éditable
  (objet + corps argumenté) → « Marquer comme envoyé » trace au `PARAM_AUDIT`.
- Wiring `Shell.tsx` : `case "nextbestaction"` (prop `user`).

## Réutilise (déjà porté)
- `CLIENTS` (fixture), `SCREEN_LABEL` (fixture), `KpiCard`/`StatsToggle` (components), `fl`
  (contactreports-support — libellés de champs), `pushParamAudit` (param-audit-support),
  `amlHash` (preonboarding-support).

## Réellement calculé (pas figé)
- Le signal de chaque client est déterministe (`amlHash(id|nba)` → GAIN/LOSS/OPP/IDLE + magnitude), la
  liste est triée par magnitude décroissante et scopée au portefeuille du RM/ARM connecté (sinon tous les
  clients). L'email est réellement composé à partir du type de signal et des champs client (nom, segment,
  RM). « Marquer comme envoyé » journalise l'action.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`NextBestActionScreen`,
  `nbaSignalFor`, `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; liste de signaux + modale email conformes.
