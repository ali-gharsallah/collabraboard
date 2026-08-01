# Parité — CRM Banque (`crm`)

**Source** : `docs/reference/olive-demo.html`
- `CrmScreen` : 30105–30332 · `Crm360` : 30049–30104
- helpers `crmTierOf`/`crmCoverage`/`crmNnmPlan` : 30020–30048 (`crmRelances`/`crmOpportunities` déjà portés)

## Fichiers portés
- `apps/web/src/parity/crm-support.ts` — ajout (verbatim) de `crmTierOf` (tiering AUM A/B/C + SLA),
  `crmCoverage` (dernier contact vs SLA par client), `crmNnmPlan` (plan Net New Money 2026, cible 5 %
  de l'AUM par RM). Complète `crmRelances`/`crmOpportunities` déjà présents.
- `apps/web/src/parity/CrmScreen.tsx` — écran CRM porté verbatim avec le sous-composant `Crm360` :
  - **vue 360°** (par défaut) : sélecteur client scopé (cloisonnement), badge Tier, exotique, dernier
    contact vs SLA, 6 KPIs (AUM, valorisation PMS, perf YTD, risque, KYC, contrats), timeline relation,
    dossier & juridique (revues, contrats, GED, langue, desk) ;
  - **Journal** : consigner un contact (pousse dans `CONTACT_REPORTS`, tracé) + liste filtrable par canal ;
  - **Relances & opportunités** : relances planifiées (échéances J+/à venir, clôturer « Fait ») +
    opportunités dérivées des modules (couverture/portefeuille/dossier) ;
  - **Activité RM** : contacts, couverture 90 j, relances échues par RM.
- Wiring `Shell.tsx` : `case "crm"` (prop `user`).

## Réutilise (déjà porté)
- `CLIENTS`/`ACCOUNT_REVIEWS_DATA` (fixtures), `clientById`/`kycsByClientId` (components-data),
  `CONTACT_REPORTS` (contactreports-support), `pmsEnrich`/`pmsPortfolio` (pms-support),
  `clientVisibleTo` (cloison-support), `LEGAL_CONTRACTS`/`GED_DOCS` (legal-support), `aumMOf` (demo-init),
  `amlHash` (preonboarding-support), `pushParamAudit`.

## Réellement calculé (pas figé)
- Tiering, SLA de couverture, plan NNM, relances échues, opportunités et activité RM sont tous dérivés
  des données réelles (CONTACT_REPORTS, CLIENTS, PMS, KYCS). Consigner un contact et clôturer une relance
  mutent l'état partagé et se tracent au `PARAM_AUDIT`. Le cloisonnement scope la vue au RM/ARM connecté.

## Consigné (hors périmètre parité — pour l'instant)
- `GED_DOCS` est importé du module Legal (seed vide, alimenté par la génération de contrats). Le seed
  documentaire de 30 clients du bloc GED (source 30340) n'est pas encore porté → le compteur
  « Documents GED » de la vue 360° affiche 0 jusqu'au port de l'écran `ged`. Aucune autre dégradation.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`CrmScreen`, `crmNnmPlan`,
  `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; vue 360°, journal, relances & opportunités conformes.
