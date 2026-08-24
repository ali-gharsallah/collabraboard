# Parité — Audit IT / intégrité & paramétrage (`auditit`)

**Source** : `docs/reference/olive-demo.html`
- `AuditITScreen` : 24420–24471

## Fichiers portés
- `apps/web/src/parity/AuditITScreen.tsx` — écran d'audit IT porté verbatim, 2 blocs :
  - **Contrôles d'intégrité** calculés en direct sur le journal `WF_ENGINE.audit()` : journal monotone
    (seq strictement croissants), unicité des séquences, activations de règles tenant rattachées à un ajout
    tracé, R13 sur tous les visas accordés (0 auto-validation), compteur de règles tenant actives ; +
    répartition des événements par type (chips).
  - **Journal des paramétrages** (`PARAM_AUDIT`) : liste filtrable des changements de paramètres tracés.
- Wiring `Shell.tsx` : `case "auditit"`.

## Réutilise (déjà porté)
- `WF_ENGINE`/`wfPreuve4Yeux` (olive-wf-engine — moteur event-sourced), `PARAM_AUDIT`
  (param-audit-support — journal partagé alimenté par les bacs à sable), `wfCarte` (wf-styles).

## Réellement calculé (pas figé)
- Les 5 contrôles sont de vrais invariants recalculés sur le journal (testé : 27 événements →
  DOSSIER_CREE × 4, CHAMP_MODIFIE × 9, SECTION_SOUMISE × 8, VISA_ACCORDE × 5, VISA_REFUSE × 1, tous ✔).
  Le contrôle R13 lit `wfPreuve4Yeux()` (violation si un signataire figure parmi ses préparateurs). Le
  journal des paramétrages reflète `PARAM_AUDIT` : vide en session neuve, il se remplit dès qu'un bac à
  sable applique un changement (`pushParamAudit`). Filtrage par texte (what/by) en direct.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`AuditITScreen`, `parity/`
  absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; contrôles d'intégrité et journal conformes.
