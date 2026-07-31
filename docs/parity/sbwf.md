# Parité — Bac à sable Workflow / visas & goulots (`sbwf`)

**Source** : `docs/reference/olive-demo.html`
- `WfDeltaSandboxScreen` : 19856–20016
- données `WF_SB_ROLES` : 19856 · `WF_KYC_SECTIONS_PARAM` : 21782 · `KYC_SB_ENCOURS` inline

## Fichiers portés
- `apps/web/src/parity/WfDeltaSandboxScreen.tsx` — écran dry-run (R70/R39) porté verbatim : chaîne de visas
  KYC par section (13 sections), bascule visa requis/aucun, choix validateur + suppléant (R4) par rôle,
  **calcul en direct** des visas ajoutés/retirés/réassignés, **charge de signature par rôle**
  (visas × dossiers en cours), détection du **goulot d'étranglement** (rôle concentrant ≥40 % des
  signatures), détection des **relais fictifs R4** (suppléant = validateur), KPIs, stress test
  « signatures à collecter », appliquer (R29) ou proposer au comité (`sbProposer` source « BRM »,
  par H. Peters / Head of PB). Données `WF_SB_ROLES`/`WF_KYC_SECTIONS_PARAM`/`KYC_SB_ENCOURS` inline.
- Wiring `Shell.tsx` : `case "sbwf"`.

## Réutilise (déjà porté)
- `KYCS_DATA` (fixture, dossiers en cours), `sbTension`/`SbStress`/`sbProposer` (sandbox-support),
  `pushParamAudit` (param-audit-support).

## Réellement calculé (pas figé)
- La charge par rôle = nombre de sections que le rôle doit viser × dossiers en cours (statut
  DRAFT/IN_PROGRESS/UNDER_REVIEW/PENDING_APPROVAL). Réassigner tous les validateurs sur « CO Senior »
  concentre 100 % des signatures sur ce rôle (goulot rouge) et crée 6 relais fictifs (sections où le
  suppléant devient aussi CO Senior). Le delta de signatures, la part du goulot et les conflits R4 sont
  recalculés à chaque bascule. Appliquer mute `WF_KYC_SECTIONS_PARAM` (grandfathering R29/R48) ; Proposer
  pousse une recommandation au comité (`sbowner`).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`WfDeltaSandboxScreen`, `parity/`
  absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; goulot + relais fictifs conformes.
