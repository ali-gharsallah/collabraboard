# Parité — Exécution & Settlement (`settlement`)

**Source** : `docs/reference/olive-demo.html`
- `SettlementScreen` (écran) : 31563–31691
- Moteur `settleHash` / `settleTokenize` / `settleOrders` / `STL_STATUS` / `STL_NEXT` : 31419–31469

## Fichiers portés
- `apps/web/src/parity/settlement-support.ts` — moteur complet : tokenisation, hachage chaîné,
  jambes cash/titres (DVP), dérivation des ordres depuis les mandats (PMS_UNIVERSE) et les
  ordres de transfert (TRANSFER_ORDERS).
- `apps/web/src/parity/SettlementScreen.tsx` — écran (compteurs par statut + liste + détail jeton).
- Wiring `Shell.tsx` : `case "settlement"`.

## Consignation LEVÉE
Le stub `settleOrders`/`settleTokenize` de `pms-support.ts` (empreinte minimale, file en mémoire)
est **remplacé** par le vrai moteur. `PmsScreen.tsx` importe désormais `settleOrders`/`settleTokenize`
depuis `settlement-support.ts` : les ordres de rééquilibrage PMS génèrent de vrais jetons chaînés
visibles ici. Aucun cycle d'import (settlement → pms pour PMS_UNIVERSE ; pms n'importe plus settlement).

## Réutilise (déjà porté)
- `amlHash`, `PMS_UNIVERSE` (pms-support), `TRANSFER_ORDERS` (transfers-support), `clientById`, `pushParamAudit`.

## Réellement calculé
- 4 ordres titres dérivés des mandats (indices PMS_UNIVERSE 2/7/11/15, clients réels) + ordres de
  paiement dérivés des transferts exécutés. Hash chaîné (prevHash/hash) et jambes DVP recalculés.
- Transition de cycle CREATED→VALIDATED→SENT→SETTLED réservée aux rôles ops (CO/CO_SR/MLRO/DIR/ADMIN).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`settleTokenize`, `hachage chaîné`,
  `parity/` absents de `dist`) · budget 177.5 kB gz.
- Playwright : 0 erreur runtime ; 4 ordres tokenisés, détail hash chaîné + jambes DVP exacts.
