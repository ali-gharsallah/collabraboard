# Fiche de parité — TasksScreen (Tâches CRM) — v1

Source : `docs/reference/olive-demo.html` **42503–42656**. Port : `apps/web/src/parity/TasksScreen.tsx`.
Branché : NAV « Front & Croissance » → « Tâches » (`case "tasks"`).

## Porté (v1) — verbatim
- En-tête « Tâches ✓ » + « File contextuelle — générée par les workflows (auto) ou créée
  manuellement. » + bouton « + Nouvelle tâche » / « ✕ Fermer ».
- KPI (via `StatsToggle`, regroupés Accueil — Annexe B.6) : Ouvertes / En retard / Échéance
  aujourd'hui / Terminées (calculés sur le périmètre courant, `TODAY = 2026-06-29`).
- Filtres : périmètre Toutes / Mes tâches (assigneeId = user.id) · statut Ouvertes / Tout statut /
  Terminées · priorité Toute / Critique / Haute / Moyenne / Basse (chips `chip()`).
- Panneau de création (`creating`) : intitulé, type (`TASK_TYPE_LABELS`), client (40 premiers),
  assigné à (`TASK_ASSIGNEES`), priorité, échéance → `createTask` (id TSK-2026-…, status TODO).
- Table triée (terminé en bas · en retard d'abord · échéance croissante · priorité) :
  Priorité (Badge `priColor`/`priLabel`) · Tâche (titre + chip type + « ⚙ auto » si généré + kycRef
  monospace) · Client · Échéance (rouge + ⚠ si en retard) · Assigné à (`reassign` inline) ·
  Statut (`setStatus` : À faire / En cours / En attente / Terminé, couleur `stMeta`) ·
  Action « ✓ Terminer » / « Rouvrir » (`toggleDone`). État vide « Aucune tâche pour ce filtre. »
- Note de pied : tâches ⚙ auto = workflows ; filtre « Mes tâches » = assignées à l'utilisateur connecté.
- Données ajoutées aux fixtures (extract_demo_data.mjs) : `TASKS_DATA` (16), `TASK_TYPE_LABELS` (9),
  `TASK_ASSIGNEES` (10) — littéraux verbatim.

Preuve : capture `parity-app.html` → login → Front & Croissance → Tâches → 0 erreur runtime.
Tri, badges, ⚙ auto, échéances en retard, réassignation/statut/terminer inline conformes.
