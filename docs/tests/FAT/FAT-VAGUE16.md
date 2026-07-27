# Tests d'Acceptation Fonctionnelle — Vague 16 (MOD Tâches, R239→R242)

**Exécutés le 2026-07-27 contre le backend réel (6 FAT)** (`apps/api/test/e2e/fat-vague16.e2e-spec.ts`).
Preuve : `docs/tests/PREUVES/fat-vague16-run.txt`. Statut : **6/6 PASS** + composant FE-TASK (Vitest+RTL+MSW).
Objet : le service **Tâches** (amendement A2 §A2.1), **ratifié** (« OK pour R239..R246 »). Spec-first depuis
le Gherkin TA-01..06 (`spec/vague16-scenarios/TASKS-MOD.feature`). L'écran Tâches sort du mode FE-05.

| ID FAT | Objectif métier | Résultat attendu | Règle | Statut |
|---|---|---|---|---|
| **TA-01** | Naissance par événement uniquement | Tâche **OPEN** née de `KYC_SECTION_REJECTED` + `TASK_CREATED` tracé | R239 | ✅ PASS |
| **TA-02** | Création manuelle gouvernée | `POST /v1/tasks` refusé → **`TASK_MANUAL_CREATION_DISABLED`** | R239 | ✅ PASS |
| **TA-03** | Visibilité scopée **serveur** | RM voit les siennes, BRM son équipe, CO tout ; **périmètre non élargissable** (`?assignee=` d'un autre → vide) | R240 | ✅ PASS |
| **TA-04** | Complétion événementielle immuable | `TASK_COMPLETED { acteur }` append-only ; re-complétion → **`TASK_ALREADY_COMPLETED`** (409) | R241 | ✅ PASS |
| **TA-05** | Habilitation de complétion | non-assigné non-habilité → **`TASK_COMPLETE_FORBIDDEN`** ; rôle habilité complète (acteur ≠ assignee, tracé) | R241 | ✅ PASS |
| **TA-06** | SLA mesuré, jamais coercitif | retard notifié, `bloque=false` ; la tâche reste OPEN & complétable | R242 / R39 | ✅ PASS |

**Backend nouveau** : `TasksModule` — `GET /v1/tasks?status=&assignee=&dueBefore=&subjectId=&asOf=` (R240, rejeu R48),
`POST /v1/tasks` (manuel gated R239), `POST /v1/tasks/from-event` (naissance événementielle R239),
`POST /:id/complete` (R241), `POST /:id/reassign` (**délégué au ratifié `WorkloadService.reassigner`**),
`POST /sla/tick` (R242). **Modèle `Task` étendu additivement** (`subjectType`/`subjectId`/`origine`/`completedBy`/
`completeComment`) — RLS FORCE déjà en place (table `tasks`) ; baseline régénérée.

**Écart signalé (ECARTS-FRONT)** : le vocabulaire de statut R239 (OPEN|COMPLETED|CANCELLED) est **mappé** sur le
vocabulaire ratifié du modèle `Task` (OUVERTE|FAITE|ANNULEE) pour ne pas casser workload (R183) — mapping DTO, pas de
canon changé.

**Front** : `Tasks.tsx` **sort du mode FE-05** — liste scopée serveur + complétion événementielle (FE-30..32) ;
composant FE-TASK (Vitest+RTL+MSW). **Harnais offline inchangé à 425** ; e2e **72 → 78**.

**Reste (Vague 17)** : service **Décision NBA** (R243→R246) — NB-05 fera **naître une tâche** de l'événement `NBA_DECIDED`
via `TasksService.creerDepuisEvenement` (dépendance, d'où l'ordre Tâches avant NBA).
