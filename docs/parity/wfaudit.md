# Parité — Audit FINMA / rejeu & preuves (`wfaudit`)

**Source** : `docs/reference/olive-demo.html`
- `WfAuditScreen` : 24338–24419

## Fichiers portés
- `apps/web/src/parity/WfAuditScreen.tsx` — écran d'audit du workflow porté verbatim, 3 blocs :
  - **Export d'audit scellé (R62)** : `WF_ENGINE.exportSealed(...)` produit le journal complet scellé par
    hash SHA-256 chaîné ; `OliveWfEngine.verifySealed(...)` le revérifie hors ligne ; téléchargement JSON
    (Blob) ; l'export est lui-même journalisé.
  - **Rejeu à date (X-02)** : curseur reconstruisant l'état du dossier « tel qu'il était » depuis le
    journal append-only (`wfRejoue`, R48/R49) — diagramme de branche + liste d'événements horodatés.
  - **Preuve du 4-yeux (X-05)** : `wfPreuve4Yeux()` extrait préparateurs vs signataire de chaque visa —
    verdict conforme R13 / VIOLATION si le signataire figure parmi les préparateurs.
- Wiring `Shell.tsx` : `case "wfaudit"`.

## Réutilise (déjà porté)
- `WF_ENGINE`/`OliveWfEngine`/`WF_IDS`/`WF_TITULAIRES`/`WfBranche`/`wfRejoue`/`wfPreuve4Yeux`
  (olive-wf-engine — moteur event-sourced R1–R62), `wfCarte`/`wfBouton` (wf-styles).

## Réellement calculé (pas figé) — moteur vivant
- Le scellé est un **vrai SHA-256 chaîné** recalculé et revérifié en direct (testé : « ✓ Scellé vérifié ·
  27 événements · SHA-256 a800513725b4e901…31538d52 »). Le rejeu reconstruit réellement le dossier à
  l'événement N (6/13 → DOSSIER_CREE → CHAMP_MODIFIE → SECTION_SOUMISE → VISA_ACCORDE…). La preuve 4-yeux
  lit le journal partagé `WF_ENGINE` (inclut les dossiers OIL créés à la volée). Toute altération du
  journal casserait le scellé (verifySealed → false).

## Consigné (hors périmètre parité)
- `currentUser` (identité nominale de l'auditeur pour l'entête d'export) non câblé en parité → le garde
  `typeof currentUser` retombe sur « Auditeur ». Aucun effet visible sur le scellé ou les preuves.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`WfAuditScreen`, `parity/`
  absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; scellé vérifié + rejeu + preuve 4-yeux conformes.
