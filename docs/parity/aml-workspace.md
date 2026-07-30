# Parité — AML Investigation Workspace (`aml`)

**Source** : `docs/reference/olive-demo.html`
- `AmlWorkspaceScreen` (écran, 4 vues : inbox/case/scenarios/dashboard) : 14822–14969
- `AML_ALERT_SRC` / `AML_ALERTS` / `amlLookup` / `aiContextualizeAlert` / `AML_ACTIONS` / helpers : 14671–14820
- `enrichScreening` (overlay démarrage) : 14685–14712
- `AML_SCENARIOS` : 18085–18122

## Fichiers portés
- `apps/web/src/parity/aml-workspace-support.ts` — seed d'alertes (dérivé du screening KYC),
  contextualisation IA locale déterministe (faisceau d'indices, score IA, verdict, action suggérée),
  actions de décision, `AML_SCENARIOS` (36, dont doublons de codes fidèles à la source).
- `apps/web/src/parity/AmlWorkspaceScreen.tsx` — 3 onglets + vue case détaillée.
- `demo-init.ts` — **`enrichScreening`** ajouté (mute KYCS_DATA au démarrage, ~45% des dossiers
  MEDIUM/HIGH CLEAR reçoivent un hit ⇒ cascade d'alertes). Exécuté avant construction de AML_ALERTS.
- Wiring `Shell.tsx` : `case "aml"`.

## Réutilise
- `amlHash`, `Badge`, `pushParamAudit`, fixtures KYCS_DATA/CLIENTS/PERSONS_DATA.
- `AML_SCENARIOS`/`AML_PARAMS`/`AML_SCORING_RULES` : le moteur de score `aml.ts` reste séparé
  (colonne « facteurs » du KYC) ; ce module apporte les scénarios + le workspace d'alertes.

## Consigné (hors périmètre, non porté)
- **`TX_DATA`** → [] : les alertes transactionnelles (ALT-TX, source 43469) ne sont pas seedées.
  Les alertes screening (OFAC/SECO/PEP/adverse) sont **réellement** dérivées et contextualisées.
- `offboarding-support`/`registre-support`/`transfers-support` gardent leur `AML_ALERTS = []` local
  (non rebranché sur ce module dans ce commit) — follow-up possible pour partager la file.

## Réellement calculé (pas figé)
- 53 alertes générées depuis le screening enrichi (cascade `enrichScreening` déterministe).
- Contextualisation IA : score de risque, verdict (Match pertinent / Faux positif / Contexte insuffisant),
  action suggérée (ESCALATE/CLEAR/REQUEST_INFO), faisceau d'indices — tout dérivé du KYC + pays + PEP.
- Dashboard : taux de faux positifs IA, backlog théorique 45→9 min, répartition par type.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`aiContextualizeAlert`,
  `enrichScreening`, `runExoticOverlay`, `parity/` absents de `dist`) · budget 177.5 kB gz.
- Playwright : 0 erreur runtime ; file de 53 alertes, badges type/statut + score IA exacts.
