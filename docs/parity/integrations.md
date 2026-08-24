# Parité — Intégrations Core Banking (`integrations`)

**Source** : `docs/reference/olive-demo.html`
- `IntegrationsScreen` (écran) : 14538–14821
- `CORE_SYSTEMS` / `CANONICAL_OBJECTS` / `TARGET_APPS` / `MAP_LEVELS` / `STATUS_STYLE` / `FIELD_MAPPINGS` / `MIGRATION_STATUS` : 14473–14537

## Fichiers portés
- `apps/web/src/parity/integrations-support.ts` — systèmes cœur (Avaloq/Olympic/Temenos), objets
  canoniques, niveaux de mapping (Structural/Semantic/Contextual), mappings par système, migration.
- `apps/web/src/parity/IntegrationsScreen.tsx` — 3 onglets (Architecture SVG / Mapping / Migration).
- Wiring `Shell.tsx` : `case "integrations"`.

## Réutilise
- `Badge`, `OliveNote` (components).

## Consigné
Aucun. Écran de référence statique : diagramme d'architecture (adaptateurs → modèle canonique →
applications), table de mapping champ-par-champ, tableau de migration KYC/Review avec progression.

## Vérification
- `pnpm run build` → 0 fuite parité (`CANONICAL_OBJECTS`, `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; diagramme SVG rendu, KPI 2/3 · 7 · 300/413 · 65% exacts.
