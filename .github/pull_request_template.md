# Pull Request — O-Live

## Règle(s) / écran(s) livrés

<!-- R-numéros ou écrans concernés, avec la famille de tests (ex. XB-01..05, LG-01..05). -->

## Canon & écarts

- [ ] Le canon correspondant est RATIFIÉ (référence `spec/…`) — aucune règle inventée.
- [ ] Tout écart au canon est CONSIGNÉ dans `docs/ECARTS-FRONT.md` (jamais un écart silencieux).

## Vérification (suite complète verte à la frontière)

- [ ] `tsc --noEmit` + `eslint` (api)
- [ ] e2e complet (`jest --config jest-e2e.config.js --runInBand`)
- [ ] harnais de règles (`pnpm test:rules`)
- [ ] web : `vitest run` + `vite build`
- [ ] Python CPSI (`run_tests.py`) si `services/cpsi-server-py` est touché

## Conformité visuelle (canon triage final, séquence 6)

- [ ] Chaque écran NOUVEAU ou MODIFIÉ a sa ligne dans la grille 5 colonnes de
      `docs/CONFORMITE-VISUELLE.md` (nav & libellés I18N / structure / tokens / états / données).
- [ ] AUCUNE correction visuelle sans ligne de grille ; hiérarchie canon > maquette > goût.
- [ ] Aucune donnée de maquette migrée dans le code.
