# Tests d'Acceptation Fonctionnelle — Vague 17 (MOD Décision NBA, R243→R246)

**Exécutés le 2026-07-27 contre le backend réel (6 FAT)** (`apps/api/test/e2e/fat-vague17.e2e-spec.ts`).
Preuve : `docs/tests/PREUVES/fat-vague17-run.txt`. Statut : **6/6 PASS** + composant FE-40 (Vitest+RTL+MSW).
Objet : le service **Décision NBA** (amendement A2 §A2.2), **ratifié** (« OK pour R239..R246 »). Spec-first depuis
le Gherkin NB-01..06 (`spec/vague17-scenarios/NBA-MOD.feature`). **Clôt A2 et la plage R239→R246.**

| ID FAT | Objectif métier | Résultat attendu | Règle | Statut |
|---|---|---|---|---|
| **NB-01** | Suggestion immuable une fois proposée | Aucune route de modification (`PATCH` → 404) ; proposition & facteurs intacts | R243 | ✅ PASS |
| **NB-02** | Décision unique | `NBA_DECIDED { acteur }` append-only ; seconde décision → **`NBA_ALREADY_DECIDED`** (409) | R244 | ✅ PASS |
| **NB-03** | Motif de rejet paramétré | rejet sans motif → **`NBA_REJECT_RATIONALE_REQUIRED`** ; motivé accepté | R244 | ✅ PASS |
| **NB-04** | Ajustement non vide | ADJUST sans adjustment → **`NBA_ADJUSTMENT_REQUIRED`** ; proposition d'origine intacte | R244 | ✅ PASS |
| **NB-05** | Humain seulement, zéro exécution directe | compte de service → **`NBA_DECISION_HUMAN_ONLY`** ; ACCEPT → **seul effet NBA = `NBA_DECIDED`** ; la **tâche naît du service Tâches** (TA-01) | R245 / R44 | ✅ PASS |
| **NB-06** | Rejeu des suggestions & décisions | inexistante avant création ; **DECIDED { REJECT, acteur }** après décision | R246 / R48 | ✅ PASS |

**Backend nouveau** : `NbaModule` — `GET /v1/nba?context=&subjectId=&status=`, `GET /:id[?asOf=]` (rejeu R246),
`POST /v1/nba/propose` (surface moteur), `POST /:id/decision` (R244/R245). **Modèle `NbaSuggestion` nouveau**
(RLS FORCE tenant ; baseline régénérée, recette RLS OK). Registre R-Q enrichi (`nbaTtlDays`, `nbaRejectRationaleRequired`).
**Cross-service (R245)** : `NbaModule` importe `TasksModule` ; sur ACCEPT/ADJUST, `NbaService` **n'écrit que dans son
agrégat + émet `NBA_DECIDED`**, puis appelle `TasksService.creerDepuisEvenement` (la tâche naît du service Tâches — NB-05 ↔ TA-01).

**Front** : `NextBestAction.tsx` **décision active** — suggestions `/v1/nba` + Accepter/Ajuster/Rejeter câblés
(`POST /:id/decision`, R44) ; composant FE-40 (Vitest+RTL+MSW). **Harnais offline inchangé à 425** ; e2e **78 → 84**.

**R239→R246 : intégralement ratifié ET implémenté** (Tâches V16 + NBA V17). L'amendement A2 est clos.
