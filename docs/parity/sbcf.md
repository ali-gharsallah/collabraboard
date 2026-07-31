# Parité — Bac à sable Central File / matrice documentaire (`sbcf`)

**Source** : `docs/reference/olive-demo.html`
- `CfSandboxScreen` : 19713–19856
- moteur documentaire `DOC_LIST`/`DOC_RULES_DEFAULT`/`docRuleEval`/`computeRequiredDocs` : 18132–18272

## Fichiers portés
- `apps/web/src/parity/preonboarding-support.ts` — ajout de la matrice documentaire (verbatim) :
  `DOC_LIST` (23 pièces), `DOC_RULES_DEFAULT` (R1–R7), `docRuleEval` (moteur M/O par doc × structure ×
  rôle), `computeRequiredDocs` (set requis Compte + rôles). `DOC_STRUCTURES` déjà présent.
- `apps/web/src/parity/CfSandboxScreen.tsx` — écran dry-run (R70) porté verbatim : sélecteur de structure,
  bascule des 7 règles documentaires, **calcul en direct** des documents requis (avant → après), documents
  **exigés en plus** / **retirés** par la simulation, KPIs (documents requis, exigés en plus, retirés,
  clients à relancer, pièces à collecter), **stress test** « charge documentaire » (nombre de documents
  selon la part des règles actives), **appliquer en production** (date d'effet R29, mute `DOC_RULES_DEFAULT`,
  trace `pushParamAudit`) ou **proposer au comité** (`sbProposer` source « REF », par C. Dupont / Central File).
- Wiring `Shell.tsx` : `case "sbcf"`.

## Réutilise (déjà porté)
- `DOC_STRUCTURES` (preonboarding-support), `CLIENTS` (fixture), `sbTension`/`SbStress`/`sbProposer`
  (sandbox-support), `pushParamAudit` (param-audit-support).

## Réellement calculé (pas figé)
- `computeRequiredDocs(structId, regles)` déroule `DOC_LIST × colonnes` via `docRuleEval` : désactiver R7
  (Origine des avoirs) sur la structure « Société SA/AG » retire réellement 3 pièces (SOW, SOF, Profil de
  transactions) → 19 → 16 documents requis. Les KPIs (clients à relancer = clients de la structure si des
  documents s'ajoutent, pièces à collecter = clients × nouveaux docs) et le stress test (documents requis
  pour 0/25/50/75/100 % de règles actives) sont recalculés à chaque bascule. Appliquer mute
  `DOC_RULES_DEFAULT` (grandfathering R29/R48 : dossiers déjà validés conformes à leur matrice d'origine) ;
  Proposer pousse une recommandation au comité (`sbowner`).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`CfSandboxScreen`,
  `computeRequiredDocs`, `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; bascule R7 → delta documentaire conforme.
