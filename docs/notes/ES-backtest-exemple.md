# ES-3 — Exemple de rapport de back-testing (gate, exécution réelle)

Produit par la recette `test/e2e/es-backtest.e2e-spec.ts` (ES3-06) sur la base locale :
scénario `SC-SEUIL@v1` (config `{ seuil: 10000 }`, évaluateur injecté — montant ≥ seuil),
**90 jours** de faits d'entrée historiques (2 000 faits `fait.tx.flux.importee` horodatés
au `at` source), stream `backtest` isolé.

**Durée mesurée : 164 ms** (gate : < 60 s — marge ×360).

```json
{
  "runId": "bt-SC-SEUIL@v1-7c288ac96742f301",
  "scenarioId": "SC-SEUIL",
  "scenarioVersion": "v1",
  "du": "2026-05-01T00:00:00.000Z",
  "au": "2026-07-30T00:00:00.000Z",
  "faitsEvalues": 2000,
  "volumeSimule": 200,
  "volumeReel": 0,
  "concordantes": 0,
  "seulementSimulees": 200,
  "seulementReelles": 0
}
```

Lecture du rapport :
- `runId` — hash déterministe de (scénario, version, config, période) : **même entrée = même
  run = même rapport** (ES3-02 le prouve ; une config différente = un run différent).
- `volumeSimule` / `volumeReel` — alertes SIMULÉES produites par le rejeu vs alertes RÉELLES
  levées sur la période (clé de recouvrement : `source_event_id` des faits déclencheurs).
- `concordantes` / `seulementSimulees` / `seulementReelles` — le recouvrement dans les deux
  sens ; sur ce corpus synthétique aucune alerte réelle n'existe dans la fenêtre, d'où 0/200/0.
  ES3-05 vérifie le cas mixte exact (1 concordante, 1 seulement-simulée, 1 seulement-réelle).
- Les `AlerteSimulee` vivent dans le stream_type `backtest` — la file d'alertes réelle ne les
  voit jamais (isolation STRUCTURELLE, ES3-03).
