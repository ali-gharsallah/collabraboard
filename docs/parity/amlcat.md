# Parité — Règles AML (`amlcat`)

**Source** : `docs/reference/olive-demo.html`
- `AmlEncyclopediaScreen` (écran) : 26972–27122
- `C48_AML` / `C48_ISL` (catalogue Gherkin) : 26807–26843
- `AML_NOMS_FR` / `amlThemeOf` / `amlCleanName` / `amlHitsSeries` : 26922–26971

## Fichiers portés
- `apps/web/src/parity/aml-catalog-support.ts` — `C48_AML` (18), `C48_ISL` (15), `AML_NOMS_FR`,
  `amlThemeOf`, `amlCleanName`, `amlHitsSeries`, `RULE_PARAM_KEY`.
- `apps/web/src/parity/AmlEncyclopediaScreen.tsx` — référentiel unifié 87 règles, cartes dépliables,
  seuils/poids éditables, simulation, journal des signaux.
- Wiring `Shell.tsx` : `case "amlcat"`.

## Réutilise (déjà porté)
- `AML_SCORING_RULES`/`AML_PARAMS` (aml.ts), `AML_SCENARIOS` (aml-workspace-support),
  `SectionTitle`/`Badge`/`ExportBtn`, `pushParamAudit`.

## Consigné (hors périmètre, non porté)
- **`CPSI_SCENARIOS` / `CPSI_GROUPES`** (profilage continu) → `undefined` : la garde
  `typeof … !== "undefined"` de la source saute cette section — ces scénarios (seuils par groupe)
  n'apparaissent pas. Fidèle tant que le moteur CPSI n'est pas porté. À compléter au portage CPSI.

## Réellement calculé
- 87 règles : 36 scoring (socle) + 36 scénarios AML (dont catalogue Gherkin R189-R206) + 15 Islamic.
- Thèmes dérivés (`amlThemeOf`), séries de hits 6 mois déterministes (`amlHitsSeries`).
- Édition de poids/seuils/paramètres tracée (pushParamAudit), simulation → journal des signaux.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`amlHitsSeries`, `amlThemeOf`,
  `C48_ISL`, `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; 87 règles, filtres de thème et sparklines exacts.
