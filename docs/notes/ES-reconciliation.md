# ES-4 — Rapport de réconciliation (parallel run, corpus de fixtures)

Généré par la recette CI `test/e2e/es-shadow.e2e-spec.ts` (le rapport vit AUSSI au stream
`shadow`, événement `ReconciliationExecutee`). Mode shadow STRUCTUREL : le service n'importe
pas le canal de proposition — aucune émission réelle possible (invariant 6).

## Corpus couvrant (ES4-02) — critères de bascule

| Critère | Verdict |
|---|---|
| Zéro alerte existante manquée par ES sur le corpus | **OUI** |
| Écarts additionnels tous expliqués | **OUI** (evt-Y : « détection additionnelle ES, revue et assumée ») |
| → basculePermise (ET logique) | **OUI** |

## Contre-exemples prouvés en CI (les critères savent dire NON)

- ES4-01 : alerte existante `evt-W` (aml-2g) NON retrouvée par ES → critère 1 **NON**, bascule refusée.
- ES4-03 : écart additionnel `evt-Y` sans diagnostic → critère 2 **NON**, bascule refusée.

**La bascule (shadow=false) n'est PAS dans ce prompt** : décision humaine séparée, sur la foi
de ce rapport régénéré sur le corpus réel du tenant. Jusque-là, l'interdit de langage §3.6
demeure : aucune démo ne présente ce module.
