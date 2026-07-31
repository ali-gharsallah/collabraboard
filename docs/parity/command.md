# Parité — Command Center / GWB Compliance Command (`command`)

**Source** : `docs/reference/olive-demo.html`
- `CommandCenterScreen` : 34385–34551

## Fichiers portés
- `apps/web/src/parity/CommandCenterScreen.tsx` — écran « salle de contrôle » porté verbatim, palette
  autonome (police monospace, fond olive clair, bord-à-bord `margin: -24`). Contient :
  - **barre de tête** : GWB ⌁ COMPLIANCE COMMAND, horloge live (setInterval 1 s), point pulsé ;
  - **6 panneaux** : Signaux scorés 24 h (sparkline SVG), Risk cases actifs (aging + SLA/→MROS),
    Gels d'avoirs art. 10, KYC en revue, **carte thermique** scénarios AML × sévérité (6×4),
    **funnel** d'entrée en relation R117→R120 ;
  - **bandeau d'intégrité** : « l'écran se mesure » — règles R1→R136, catalogue (LU de `RULES_CATALOG`),
    corpus backend 224/224, preuves rejouables, audit trail append-only, RLS force ;
  - **fil de conformité** vertical append-only (12 événements, défilement toutes 2,6 s, honore
    `prefers-reduced-motion`).
- Wiring `Shell.tsx` : `case "command"`.

## Réutilise (déjà porté)
- `RULES_CATALOG` (fixture, 169 règles) — le catalogue affiché (`catN`) et le nombre de règles proposées
  (`catP`, statut `/PROPOS/`) sont **lus** du fixture, pas codés en dur.

## Réellement calculé (pas figé)
- Horloge et fil de conformité rafraîchis en direct (timers React nettoyés au démontage). Données du
  tableau de bord déterministes (LCG seedé `20260720` → mêmes chiffres à chaque ouverture, comme la
  maquette). `catN`/`catP` mesurés depuis `RULES_CATALOG` (169 · 0 en ratification).

## Consigné (hors périmètre parité)
- `OLIVE_PROOFS` (harnais de preuves backend, R100→R104) non porté → le garde `typeof OLIVE_PROOFS`
  retombe sur la valeur embarquée (**34** preuves rejouables), fidèle à la maquette. Aucune dégradation
  visible : le compteur affiché est identique.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`CommandCenterScreen`,
  `COMPLIANCE COMMAND`, `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; horloge, carte thermique, funnel et fil live conformes.
