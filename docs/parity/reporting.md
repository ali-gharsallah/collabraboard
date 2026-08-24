# Parité — Reporting réglementaire (`reporting`)

**Source** : `docs/reference/olive-demo.html`
- `ReportingScreen` : 32815–32986
- helpers/données `CRS_PARTNERS`/`crsReportable`/`fatcaReportable`/`crsXml`/`fatcaXml`/`regDownloadXml`/
  `REG_DEADLINES`/`sarGoamlXml`/`esisuisseView`/`REG_PRODUCTION` : 32732–32812

## Fichiers portés
- `apps/web/src/parity/reporting-support.ts` — générateurs XML et éligibilités (verbatim) :
  `CRS_PARTNERS` (14 juridictions), `crsReportable` (relations déclarables par pays partenaire,
  auto-cert selon complétude KYC), `fatcaReportable` (indices US, W-9/W-8BEN-E, GIIN), `crsXml`/`fatcaXml`
  (schémas OCDE CRS v2 / FATCA v2 simplifiés), `regDownloadXml` (Blob + audit), `sarGoamlXml` (goAML 4.0),
  `esisuisseView` (vue client unique, plafond CHF 100'000), `REG_DEADLINES`/`REG_PRODUCTION`.
- `apps/web/src/parity/ReportingScreen.tsx` — écran porté verbatim, 5 onglets : **CRS/EAR** (cartes par
  juridiction, XML par pays ou en lot, bandeau de production PRÉPARÉ→VALIDÉ→DÉPOSÉ avec contrôles de
  complétude), **FATCA** (8966 via IDES), **SAR/goAML** (export depuis `MROS_REPORTS`), **esisuisse**
  (garantie des dépôts, export CSV), **Échéancier** (deadlines réglementaires transmis/en retard/à venir).
- Wiring `Shell.tsx` : `case "reporting"` (prop `user`).

## Réutilise (déjà porté)
- `CLIENTS` (fixture), `kycsByClientId`/`ExportBtn` (components-data), `amlHash` (preonboarding-support),
  `pmsEnrich` (pms-support), `MROS_REPORTS`/`mrosAckAge` (compliance-support), `pushParamAudit`.

## Réellement calculé (pas figé)
- Les relations CRS/FATCA sont dérivées du portefeuille réel (pays, indices US, complétude KYC → auto-cert).
  Les XML (CRS OCDE v2, FATCA 8966, goAML 4.0) sont réellement composés et téléchargés (Blob), chaque
  génération tracée au `PARAM_AUDIT`. Le workflow de production (contrôles de complétude bloquant la
  validation) et la vue esisuisse (dépôts/couvert/hors garantie, agrégats) sont calculés. Les SAR
  proviennent du registre partagé `MROS_REPORTS` (alimenté par le Compliance Center).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`ReportingScreen`, `crsReportable`,
  `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; CRS par juridiction + esisuisse conformes.
