# ES-2 — Agrégat Alerte event-sourcé + evidence figée (gate + décisions)

Référence : `docs/SURVEILLANCE-ES.md` §3 (invariants 2-4), prompt ES-2.

## Livré

- **`alerte.aggregate.ts`** — agrégat PUR, sans I/O : `rejouer(stream)` est l'état (aucune table
  d'état — invariant 2), `deciderLever/Assigner/Disposer` sont throw-first et ne produisent que
  des événements. Événements : `AlerteLevee {scenarioId, scenarioVersion, configRef, evidenceRef,
  severite}`, `AlerteAssignee`, `AlerteDisposee {decision, motif, par}`, `PropositionEmise`
  (trace). Types inconnus ignorés au rejeu (évolution additive du stream).
- **`alertes.service.ts` (`EsAlertes`)** — `lever` FIGE l'evidence AVANT la levée : snapshot
  `EvidenceFigee` (faits déclencheurs verbatim + paramètres du scénario à date) appendé au
  stream `evidence/<alerteId>`, référencé par seq (invariant 3 — l'investigateur voit ce que le
  moteur a vu). `assigner`/`disposer` relisent, rejouent, décident, appendent sous verrou
  optimiste. Ce module N'INVENTE AUCUN détecteur : `lever` reçoit le verdict d'un évaluateur
  existant avec ses faits.
- **Sortie R44 (invariant 4)** — `disposer(VRAI_POSITIF)` émet une PROPOSITION par l'API
  existante `TasksService.creerDepuisEvenement` (R239, hors du contexte Surveillance gardé) :
  tâche `REVUE_ALERTE_SURVEILLANCE` OUVERTE, assignée compliance, origine
  `surveillance-es:alerte:<id>` — rien n'est exécuté ; la trace `PropositionEmise` vit au stream.
  La tâche est créée AVANT l'append (échec d'append ⇒ tâche orpheline inoffensive ; l'inverse
  serait une action réglementaire perdue) — choix documenté dans le service.

## Décisions prises en construisant

1. **Compte de service = UUID fixe** — `audit_logs.actor` est une colonne uuid : l'identité
   lisible `surveillance-es@1` ne peut pas y entrer. Le compte de service est l'UUID constant
   `00000000-0000-4000-8000-00000000e5e5` (documenté dans le service) ; l'identité lisible
   voyage dans l'`origine` des tâches ET dans `PropositionEmise.acteur` — les deux se recoupent.
2. **TasksModule = seule dépendance sortante** — importée dans `surveillance-es.module.ts` avec
   justification ; la gate ES2-06 verrouille par scan de source : zéro import des modules à état
   métier (screening/aml/riskcases/mros/personnes/kyc/transactions/clients/onboarding).

## Gate ES-2 — verdicts

| Critère | Verdict |
|---|---|
| Cycle de vie complet par rejeu | ✅ ES2-01 (lever→assigner→disposer, version = seq) |
| Rebuild-from-scratch en CI | ✅ ES2-02 (instance neuve, `rejouer(read())` === état courant, identité stricte) |
| Evidence immuable | ✅ ES2-03 (snapshot identique après faits ultérieurs — la ref pointe un seq) |
| Proposition émise et tracée | ✅ ES2-05 (tâche OUVERTE côté monolithe + `task.created` + trace au stream) |
| Zéro import d'écriture vers le monolithe | ✅ ES2-06 (scan de source en CI, canal unique = tasks) |

Suite e2e complète : 65 suites, 428/428 (label CI ajusté). Frontière L3 verte, lint/typecheck verts.
