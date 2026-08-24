# Parité — Transactions & Transferts (`transferts`)

**Source** : `docs/reference/olive-demo.html`
- `TransfersScreen` (écran) : 29856–29969
- `transferControls` : 29756–29832 (déjà porté) · `transferApprove`/`transferReject` : 29833–29852
- `XFER_CC_CITY` / `XFER_STATUS_META` : 29760 / 29853 · seed : 43528–43542

## Fichiers portés / étendus
- `apps/web/src/parity/transfers-support.ts` — **étendu** : `XFER_CC_CITY`, `XFER_STATUS_META`,
  `transferApprove` (four-eyes + dérogation WARN), `transferReject`, seed `seedTransfers` (5 ordres
  du jour dans tous les états, 2 exécutés via four-eyes).
- `apps/web/src/parity/TransfersScreen.tsx` — 2 onglets (Ordres & validations / Nouvel ordre).
- Wiring `Shell.tsx` : `case "transferts"`.

## Réutilise / partagé
- `transferControls`/`transferCreate` (déjà là, partagés avec Mobile/Settlement/PMS).
- `pushParamAudit`/`PARAM_AUDIT`, `T` (tokens).

## Consigné (hors périmètre, non porté)
- `screenMatch` → [] · `cbCountry` → null · `AML_ALERTS`/`MROS_REPORTS` → [] · `TX_DATA` → [] · `wfEmit` → no-op.
  Les contrôles sanctions-pays, plausibilité économique (AUM) et état KYC restent **réellement calculés** ;
  screening bénéficiaire, alertes AML, MROS et cross-border ressortent « OK » tant que ces moteurs
  ne sont pas portés. Four-eyes (créateur ≠ valideur) et dérogation WARN pleinement fonctionnels.

## Réellement calculé
- Chaîne de contrôle pré-exécution : pays sanctionné → BLOCK (ex. ORD RU) ; corridor sensible → WARN
  (AE) ; plausibilité montant/AUM ; état du dossier KYC. Verdict PASS/WARN/BLOCK.
- Validation four-eyes : rejet si créateur = valideur ; justification obligatoire si WARN.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`transferApprove`, `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; 5 ordres seedés, chaîne de contrôle et four-eyes exacts.
