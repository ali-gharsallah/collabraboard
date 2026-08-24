# Parité — Formations & habilitations LBA (`formations`)

**Source** : `docs/reference/olive-demo.html`
- `FormationsScreen` (écran) : 29471–29630
- `CERT_CATALOG` / `STAFF_DATA` / `STAFF_HABS` / `staffCert` / `staffProfile` / `renewCert` / `trainingCrossChecks` : 29394–29470

## Fichiers portés
- `apps/web/src/parity/formations-support.ts` — catalogue certifications, staff, habilitations par
  rôle, calcul de statut (à jour / échéance / échu) via amlHash, recyclage, contrôles de cohérence.
- `apps/web/src/parity/FormationsScreen.tsx` — 3 onglets (Collaborateurs / Matrice / Contrôles).
- Wiring `Shell.tsx` : `case "formations"`.

## Réutilise (déjà porté)
- `amlHash`, `PARAM_AUDIT`/`pushParamAudit` (param-audit-support), `KYCS_DATA`/`ACCOUNT_REVIEWS_DATA` (fixtures).

## Consigné
- **`MROS_REPORTS`** → `[]` (identique à la source) : le contrôle de cohérence goAML ne se déclenche
  pas. Tous les autres croisements (piste d'audit, KYC assignés en CO, revues) sont réellement calculés.

## Réellement calculé
- Statut de chaque certification par collaborateur (amlHash déterministe) → 4 habilitations suspendues,
  2 échéances < 90j. Suspension automatique quand une certification requise est échue.
- Contrôles de cohérence : croisement certification échue × activité tracée (PARAM_AUDIT, KYC CO, revues).

## Vérification
- `pnpm run build` → 0 fuite parité (`trainingCrossChecks`, `HABILITATIONS SUSPENDUES`, `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; matrice 15×5 exacte, suspensions et échéances affichées.
