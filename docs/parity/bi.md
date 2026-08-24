# Parité — BI Data & reporting sur mesure (`bi`)

**Source** : `docs/reference/olive-demo.html`
- `BiScreen` (écran) : 33119–33260
- `biAggregate` : 33083–33105 · `BiBars` : 33106–33118

## Fichiers portés
- `apps/web/src/parity/bi-support.ts` — `biAggregate` (agrégation dimension × mesure sur données vivantes).
- `apps/web/src/parity/BiScreen.tsx` — 3 onglets (Vues préconstruites / Explorateur / Extractions) + `BiBars`.
- `components-data.tsx` : `clientLifecycleStatus` exporté.
- Wiring `Shell.tsx` : `case "bi"`.

## Réutilise (déjà porté)
- `AML_ALERTS` (aml-workspace-support), `CONTACT_REPORTS` (contactreports-support),
  `kycsByClientId`/`clientById`/`ExportBtn`, `TRANSFER_ORDERS`.

## Consigné (hors périmètre, non porté)
- **`TX_DATA`** → [] : la vue « Top corridors transactionnels » et l'extraction Transactions
  ressortent vides. Le reste (segments, alertes, hits, contacts, millésimes) est réellement agrégé.
- Note fidélité : la dimension « lifecycle » utilise `clientLifecycleStatus(c).label` — comme la
  source, `.label` sur une chaîne donne `undefined` (quirk source reproduit verbatim).

## Réellement calculé
- AUM par segment (UHNWI/HNWI/Affluent), alertes AML par typologie (SANCTIONS 24 · PEP 16 ·
  ADVERSE_MEDIA 13 = 53, cohérent avec la file AML), dossiers KYC par millésime, explorateur dim×mesure.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`biAggregate`, `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; 4 vues préconstruites exactes, compteurs cohérents.
