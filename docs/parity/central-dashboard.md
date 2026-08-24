# Parité — Dashboard central / Accueil (`home` + `dashboard`)

**Source** : `docs/reference/olive-demo.html`
- `CentralDashboardScreen` (écran, 3 onglets home/cockpit/kpi) : 32564–32814
- `GlobalKpiPanel` : 32510–32563 · `REG_DEADLINES` : 32700-zone
- `crmRelances`/`crmOpportunities` : 29976–30011

## Fichiers portés
- `apps/web/src/parity/crm-support.ts` — `crmRelances` (relances échues), `crmOpportunities`
  (couverture / dérive PMS / dossier incomplet).
- `apps/web/src/parity/CentralDashboardScreen.tsx` — 3 onglets + `GlobalKpiPanel` + `REG_DEADLINES`.
- Wiring `Shell.tsx` : `case "home"` (Accueil, écran d'atterrissage) **et** `case "dashboard"`
  → CentralDashboardScreen (routage identique à la source).

## Réutilise (déjà porté)
- `AML_ALERTS`/`aiContextualizeAlert` (aml-workspace-support), `TRANSFER_ORDERS`/`XFER_STATUS_META`,
  `pmsPortfolio`, `STAFF_DATA`/`staffProfile`, `regRelationRow`/`regFiche`, `PROSPECT_LEADS`,
  `WF_MGMT_TEMPLATES`, `PARAM_AUDIT`, `wfNomenclature`, `KpiCard`/`Badge`/`ExportBtn`, fixtures KYC/AR/PROSPECTS.

## Consigné (hors périmètre, non porté)
- `screenHits` (Screening) → [] : « Hits à trancher » = 0.
- `REPORTING_DATA` (SAR/MROS/FINMA) → [] : « Déclarations SAR/MROS » et « Reporting FINMA » = 0.
- `MROS_REPORTS`/`mrosAckAge` → [] / null : section « Suivi MROS » (cockpit CO) vide.
- `BUSINESS_TRIPS` → undefined : « Business Trips » = 0 (garde `typeof`).
- `TX_DATA` → [] : KPI transactions à 0. À rebrancher aux portages Screening / Reporting / MROS / Business Trip.

## Réellement calculé (pas figé)
- Tuiles d'action : KYC en cours (23), Alertes NEW (53), Ordres en attente (2), Relances échues (24),
  Revues en retard (25), Dérives ≥10% PMS (46), Habilitations échues (4).
- KPI centraux + GlobalKpiPanel (6 domaines), AML par type (24/16/13 = 53), estimation IA faux positifs,
  cockpit par rôle (RM/CO/autre), tâches paramétrables tracées.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`GlobalKpiPanel`,
  `aiContextualizeAlert`, `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; écran d'atterrissage complet, compteurs cohérents avec la file AML.
