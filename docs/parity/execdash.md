# Fiche de parité — ExecutiveDashboardScreen (Dashboard Exécutif) — v1

Source : `docs/reference/olive-demo.html` **20882–20983** (+ `parseAumValue`/`formatAumTotal` 20641–20661).
Ports : `apps/web/src/parity/ExecutiveDashboardScreen.tsx` + helpers dans `demo-init.ts`.
Branché : NAV « Wealth & Marchés » → « Dashboard Exécutif » (`case "execdash"`, `go = goTo`).

## Porté (v1) — verbatim
- En-tête « Vue consolidée · Direction » / `SCREEN_LABEL.execdash` + `ExportBtn` (CSV 10 métriques).
- **8 KpiCard** agrégés depuis les fixtures : AUM total (`parseAumValue`/`formatAumTotal`), Dossiers KYC
  (+ EDD), Taux d'approbation (approuvés/rejetés), Reviews en retard (OVERDUE), Clients PEP,
  Hits sanctions, Alertes ouvertes, SAR/MROS.
- **Pipeline KYC** (funnel 5 phases : Saisie RM / Revue Compliance / Clarifications AML / Comité /
  Approbation finale, depuis `wfPhase` des KYC actifs) + note SLA Phase 2.
- **Répartition par segment** (Mass Affluent → UHNWI) et **par risque** (Faible/Moyen/Élevé).
- **Top Relationship Managers** par AUM géré, **Top secteurs d'activité**, **Risque par pays**
  (drapeau, nb clients, score moyen coloré ; clic → `go("clients")`).

Preuve : capture `parity-app.html` → login → Wealth & Marchés → Dashboard Exécutif → 0 erreur runtime.
AUM CHF 1.81Md, 105 KYC, 89% approbation, funnel + segments + risques + top RM/secteurs/pays conformes.
La répartition par risque reflète l'`exoticOverlay` global (LOW→MEDIUM sur les clients exotiques).

## Consignations
- `AML_ALERTS` / `REPORTING_DATA` non portés → Hits sanctions / Alertes / SAR à 0 (cf. aml.ts).
  Se rempliront au portage des modules AML / MROS.

Frontière : 80/80 vitest · build sans fuite parity dans dist · budget 177.5 kB gz.
