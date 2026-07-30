# Parité — Cross-Border (`crossborder`)

**Source** : `docs/reference/olive-demo.html`
- `CrossBorderScreen` (écran) : 29631–29755
- `CB_ACTIVITIES` / `CB_RULES` / `cbCountry` / `cbCheckTrip` / `CB_V_META` : préambule 29631

## Fichiers portés
- `apps/web/src/parity/cross-border-support.ts` — country manual (13 juridictions × 6 activités),
  `cbCountry`, `cbCheckTrip` (check pré-voyage tracé).
- `apps/web/src/parity/CrossBorderScreen.tsx` — 3 onglets (Matrice pays / Check pré-voyage / Par client).
- Wiring `Shell.tsx` : `case "crossborder"`.

## Consignation LEVÉE
`transfers-support.ts` utilisait un stub `cbCountry → null`. Il **importe désormais le vrai
`cbCountry`** depuis `cross-border-support` : le contrôle « Cross-border — réception d'ordres »
de la chaîne pré-exécution des transferts est réellement calculé pour les clients domiciliés
dans une juridiction du country manual.

## Réutilise
- `clientById`, `CLIENTS`, `pushParamAudit`, `T`.

## Réellement calculé
- Matrice de 13 juridictions × 6 activités (verdicts OK/Conditions/Interdit).
- Check pré-voyage : verdict par activité + consignation piste d'audit (AUTORISÉ / SOUS CONDITIONS / REFUS PARTIEL).
- Restrictions par client selon son pays de domicile.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`cbCheckTrip`,
  "avant tout Business Trip", `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; matrice 13×6 exacte.
