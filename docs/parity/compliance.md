# Parité — Compliance Center (`compliance`)

**Source** : `docs/reference/olive-demo.html`
- `ComplianceCenterScreen` (6 onglets) : 28792–29212
- Gouvernance règles AML : 15173–15310 · MROS + rapport LBA : 28623–28791

## Fichiers portés
- `apps/web/src/parity/compliance-support.ts` — **moteur Compliance** (appariement d'accolades) :
  gouvernance des règles AML (`amlRuleStats` fréquence/FP par règle sur le portefeuille réel,
  `amlProposals`/`amlSimulateGate`/`amlApproveProposal`/`amlRejectProposal`/`amlRevertRule`,
  `AML_RULE_VERSIONS`/`amlNextVersion`), déclarations **MROS** (`mrosDraftFromAlert` depuis une alerte,
  `mrosValidate`, export `mrosGoamlXml`, suivi délais `mrosAckAge`/`MROS_POLICY`), **rapport annuel LBA**
  (`lbaAnnualReport` consolidé multi-modules + `lbaReportMd` Markdown, art. 25a OBA-FINMA).
- `apps/web/src/parity/ComplianceCenterScreen.tsx` — 6 onglets (Règles AML / Dashboard / Heat map /
  Intelligence Studio / Déclarations MROS / Rapport Direction), porté verbatim. Onglet « Règles AML »
  = `AmlEncyclopediaScreen` (déjà porté).
- Wiring `Shell.tsx` : `case "compliance"`.

## Réutilise (déjà porté)
- `AML_SCORING_RULES`/`evalAmlRules`/`AML_PARAMS` (aml.ts), `RULE_PARAM_KEY` (aml-catalog-support),
  `AML_ALERTS` (aml-workspace-support), `regRelationRow`/`regFiche` (registre-support),
  `STAFF_DATA`/`staffProfile`/`trainingCrossChecks` (formations-support), `CB_RULES` (cross-border-support),
  `WF_MGMT_TEMPLATES` (wf-mgmt-support), `PARAM_AUDIT` (param-audit-support), `amlHash`, `KpiCard`.

## Réellement calculé (pas figé)
- Dashboard : 36/36 règles actives, 53 alertes (24 TP · 29 FP), 55 % de faux positifs, déclenchements
  par catégorie (Structure 115…), top règles par fréquence/FP.
- Heat map fréquence × impact ; Intelligence Studio (propositions IA avec simulation avant/après, versions
  & réversibilité R44) ; MROS (préparer/valider/exporter goAML, suivi J+10/J+20).
- **Rapport Direction** : consolidation en direct de 7 modules (relations par risque, dispositif,
  screening, MROS, formations, cross-border, recommandations générées), téléchargeable en Markdown.

## Consigné (hors périmètre parité)
- `TX_DATA` → [] : transactions liées d'une déclaration MROS et corridors HIGH vides (dégradation fidèle) ;
  `MROS_REPORTS` démarre vide (le seed historique dépendait de l'enrichissement TX). Créer une déclaration
  depuis une alerte reste fonctionnel.
- `wfEmit` → no-op (bus d'événements workflow, effet de bord hors périmètre).
- `MROS_REPORTS` est désormais possédé par compliance-support ; les écrans qui l'avaient consigné `[]`
  (CentralDashboard, registre, formations) conservent leur consignation locale (partage non rebranché).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`amlRuleStats`, `lbaAnnualReport`,
  `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; dashboard, heat map et rapport Direction conformes.
