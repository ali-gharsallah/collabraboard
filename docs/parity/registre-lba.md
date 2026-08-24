# Parité — Registre des relations d'affaires / LBA (`registre`)

**Source** : `docs/reference/olive-demo.html`
- `RegistreLbaScreen` (écran) : 29252–29400
- `regRelationRow` / `regFiche` / `regAuditSample` : 29218–29251

## Fichiers portés
- `apps/web/src/parity/registre-support.ts` — reconstitution de ligne (art. 7 LBA), fiche de
  contrôle par relation (art. 3/4/6/7 LBA), échantillonnage d'audit stratifié reproductible (amlHash).
- `apps/web/src/parity/RegistreLbaScreen.tsx` — écran 2 onglets (Registre / Échantillonnage d'audit).
- Wiring `Shell.tsx` : `case "registre"`.

## Réutilise (déjà porté)
- `kycsByClientId`, `ExportBtn` (components-data), `wfNomenclature`/`wfNomColor`/`wfNomBg` (kyc-support),
  `Badge` (components), `amlHash`, `ACCOUNT_REVIEWS_DATA` (fixture), `pushParamAudit`.

## Consigné (hors périmètre, non porté)
- **`AML_ALERTS`** (alertes AML) → `[]` (idem aml.ts) ⇒ colonne « Alertes NEW » vide.
- **`MROS_REPORTS`** (déclarations MROS) → `[]` — **identique à la source** (`var MROS_REPORTS = []`),
  ⇒ colonne MROS vide. Aucune divergence : la source elle-même part d'un registre MROS vide.
- Complétude, UBO, score de risque, revues en retard, hits de screening et verdict de contrôle
  restent **réellement calculés** depuis KYC/AR.

## Réellement calculé (pas figé)
- 84 lignes reconstituées en direct · 19 EDD · 22 revues en retard · 62 dossiers incomplets.
- Verdict par relation (CONFORME/RÉSERVES/NON CONFORME) selon le nombre de checks KO.
- Échantillon d'audit stratifié (4 HIGH · 4 MEDIUM · 2 LOW), tirage reproductible par seed.
- Colonne screening : ADVERSE (CLI-00003), PEP (CLI-00176) — cohérent avec Corroboration KYC.

## Vérification
- `pnpm run build` → 0 fuite parité (`regRelationRow`, `regAuditSample`, `runExoticOverlay`,
  `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; table 84 relations complète, verdicts et compteurs exacts.
