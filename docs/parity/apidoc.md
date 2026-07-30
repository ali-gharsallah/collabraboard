# Parité — API & Intégrations (`apidoc`)

**Source** : `docs/reference/olive-demo.html`
- `ApiDocScreen` (écran) : 31257–31404
- `API_SPEC` / `apiOpenapiYaml` : 31179–31256

## Fichiers portés
- `apps/web/src/parity/apidoc-support.ts` — `API_SPEC` (7 domaines d'endpoints), `apiOpenapiYaml`
  (génération OpenAPI 3.1 depuis le référentiel).
- `apps/web/src/parity/ApiDocScreen.tsx` — référentiel dépliable + export OpenAPI 3.1 (yaml).
- Wiring `Shell.tsx` : `case "apidoc"`.

## Réutilise
- `pushParamAudit` (param-audit-support).

## Consigné
Aucun. Écran de référence statique (endpoints, scopes, rate limits, req/res/erreurs) + export
OpenAPI généré depuis API_SPEC (Blob/URL en navigateur, fidèle).

## Vérification
- `pnpm run build` → 0 fuite parité (`apiOpenapiYaml`, `olive-openapi-v1`, `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; 7 domaines, endpoint dépliable (auth/token) exact.
