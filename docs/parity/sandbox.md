# Parité — Bac à sable Workflow / moteur R2/R13 (live) (`sandbox`)

**Source** : `docs/reference/olive-demo.html`
- `WfSandboxScreen` : 24472–24565 · `GlobalSandboxScreen` (wrapper) : 24567
- moteur `WF_ENGINE` + composants/helpers `WfBranche`/`WfPuce`/`wfSections`/`wfVisaDe` : olive-wf-engine (déjà porté)

## Fichiers portés
- `apps/web/src/parity/WfSandboxScreen.tsx` — écran **live** (seul non dry-run du cluster) porté verbatim :
  moteur réel `WF_ENGINE` sur les dossiers de démo (D-2026-001/002/003 + ceux créés à la volée par
  l'écran OIL), diagramme de branche par dossier, tableau des sections (état, visa, validateur R2,
  préparateurs R13), **écran de visa** (modale) : accorder / refuser (motif obligatoire R7) / engagement
  de responsabilité pour la finale (R14). Chaque action passe par le moteur — les invariants sont
  **appliqués réellement** : signer sans être le validateur nommé lève R2, refuser sans motif lève R7,
  valider la finale sans cocher l'engagement lève R14.
- Wiring `Shell.tsx` : `case "sandbox"` (le prop `go` de `GlobalSandboxScreen` est ignoré par le wrapper).

## Réutilise (déjà porté)
- `WF_ENGINE`/`WF_IDS`/`WF_ACTEURS`/`WF_TITULAIRES`/`WfBranche`/`WfPuce`/`wfSections`/`wfVisaDe`
  (olive-wf-engine — moteur R1–R62 + seed `wfSemerDemo`), `wfCarte`/`wfBouton` (wf-styles).

## Réellement calculé (pas figé) — moteur vivant partagé
- `WF_ENGINE` est un **état de module partagé** : les dossiers OIL créés dans l'écran OIL (`WF_IDS.push`)
  apparaissent ici, et un visa accordé/refusé ici mute le dossier pour toute la session. Testé en direct :
  signer la validation finale de D-2026-003 en tant que « L. Morel (RM) » → **R2 appliqué** (« n'est pas
  le validateur nommé (H. Brunner (Head PB)) — visa réservé »). Accorder journalise (R49) ; refuser exige
  un motif (R7) et repasse la section « En préparation » ; la finale exige l'engagement (R14).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`WfSandboxScreen`, `parity/`
  absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; R2 appliqué en direct dans l'écran de visa.
