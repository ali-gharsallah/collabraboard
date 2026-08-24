# ES-3 — Projections et back-testing par rejeu (gate + décisions)

Référence : `docs/SURVEILLANCE-ES.md` §1 (« le back-testing est le produit »), prompt ES-3.

## Livré

- **`es-projections.service.ts`** — projection « file d'alertes » (statut, sévérité, âge,
  scénario, assignee, décision) : PURE lecture dérivée des streams `alerte`, reconstructible
  from scratch par définition (aucune table matérialisée, aucun cache — C8). Tri sévérité puis
  âge. L'isolation réel/simulé est STRUCTURELLE : la projection ne lit que `alerte`.
- **`es-backtest.service.ts`** — `executerBacktest(ctx, cmd, evaluateur, {lecture?})` :
  scénario (version + config DONNÉES) rejoué sur les faits d'entrée historiques d'une période.
  L'ÉVALUATEUR est INJECTÉ (fonction pure fait → verdict) — ce module n'invente aucun
  détecteur. `AlerteSimulee` + `BacktestExecute {rapport}` au stream `backtest` isolé.
  Borné (`periodeMaxJours`, défaut 365). Reproductible : runId = hash(entrée), un run existant
  renvoie SON rapport. Connexion de LECTURE injectable (prête pour un read replica ; défaut :
  base courante). Rapport : faits évalués, volumes simulé/réel, recouvrement
  (clé = `source_event_id` des faits déclencheurs), écarts dans les deux sens.
- **Store** : `readTousParType` (projections) ; `append` accepte un `at` MÉTIER optionnel et le
  souscripteur ES-1 propage désormais le `at` SOURCE sur les faits (sans quoi « période
  historique » n'aurait pas de sens).

## Décision (répétition de la leçon ES-1)

Le stream physique du backtest est scopé tenant (`stream_id = <tenant>:<runId>`) : le runId
déterministe est identique pour deux tenants qui testent le même scénario, et l'unicité du
store est globale — la collision a été VUE en recette (conflit de séquence inter-runs).

## Gate ES-3 — verdicts

| Critère | Verdict |
|---|---|
| Rebuild projection en CI | ✅ ES3-01 (deux reconstructions indépendantes identiques) |
| Backtest reproductible | ✅ ES3-02 (même entrée = même rapport ; config ≠ → run ≠) |
| Isolation réel/simulé | ✅ ES3-03 (simulées en `backtest` seul ; file inchangée) |
| Backtest 90 j < 60 s en local | ✅ ES3-06 : **164 ms** pour 2 000 faits |
| Rapport exemple committé | ✅ `docs/notes/ES-backtest-exemple.md` (sortie réelle) |

Suite e2e complète : 66 suites, 434/434 (label CI ajusté).
