# SURVEILLANCE-ES.md — Module event-sourcé en parallèle

Document **autonome et injectable** : à poser sous `docs/SURVEILLANCE-ES.md` et à citer
dans chaque prompt de la série ES. Il se suffit à lui-même — les sessions ES n'ont
besoin que de ce fichier + `CLAUDE.md`. Exécution **en parallèle** du PLAYBOOK
principal : périmètre de fichiers disjoint (voir §Règles de parallélisme), aucun
conflit de merge attendu avec les lots L2–L8.

---

## 1. Objet

Construire un contexte **« surveillance-es »** véritablement **event-sourcé**, en
sidecar du monolithe, sur le seul périmètre où l'event sourcing est le produit :
**les alertes de surveillance** (evidence figée, décisions rejouables, back-testing
par rejeu). Pattern strangler : le module pousse À CÔTÉ du système, alimenté par
lui, **sans jamais le modifier**. Précédent dans le repo : le CPSI (moteur satellite
couplé par propositions, R39/R44).

Ce que ce module N'EST PAS :
- PAS une migration du cœur KYC vers l'event sourcing (le monolithe reste
  CRUD-primaire, cf. `CLAUDE.md`).
- PAS un nouveau moteur de détection : AML 2G et CPSI restent les évaluateurs ;
  ce module apporte ce qui leur manque — persistance événementielle des alertes,
  evidence immuable, rejeu, back-testing.
- PAS actif tant que le parallel run (ES-4) n'est pas réconcilié.

## 2. Architecture (contrat)

```
MONOLITHE (apps/api, CRUD-primaire)          SURVEILLANCE-ES (event-sourcé)
  domain_events ──► outbox ──────────────►  Souscripteur (curseur persisté)
                                              │ garde anti-corruption (zod)
                                              ▼
                                            Event store dédié (schéma es)
                                              streams: alerte, scenario-run
                                              │ rejeu = source de l'état
                                              ▼
                                            Agrégats Alert / Projections file
                                              │
  API propositions (R44)  ◄────────────────  Sorties = PROPOSITIONS uniquement
```

- **Sens unique** : ES consomme le monolithe (via outbox), le monolithe ne connaît
  ES que comme un émetteur de propositions par ses API existantes.
- **Event store dédié** : schéma Postgres `es` dans la même instance (niveau 1
  d'isolation). Tables append-only par TRIGGER (UPDATE/DELETE interdits en SQL,
  pas seulement par convention). RLS FORCE + policy tenant, comme le reste.
- **Faits d'entrée vs événements natifs** : les événements consommés du monolithe
  sont stockés comme *faits d'entrée* horodatés (avec l'id d'événement source) ;
  les événements *natifs* du contexte (AlerteLevee, EvidenceFigee, AlerteDisposee,
  BacktestExecute…) sont la source de l'état des agrégats — c'est ici, et ici
  seulement, que « event-sourcé » est vrai.
- **Anti-corruption locale** : chaque type d'événement consommé est validé contre
  un schéma zod local à ES (`surveillance-es/contracts/`). Quand le catalogue
  central (P-L5-2 du PLAYBOOK) existera, ces schémas s'y adossent — d'ici là, ES
  ne bloque pas sur l'avancement du playbook principal.
- **Zéro transaction distribuée, zéro jointure inter-mondes** : une alerte
  référence un dossier par son code KYC + version, jamais par FK vers les tables
  du monolithe.

## 3. Invariants du module (s'ajoutent à ceux de CLAUDE.md)

1. Le store ES est **append-only par trigger SQL** — une écriture UPDATE/DELETE
   échoue en base, pas seulement en revue de code.
2. **Rejeu = vérité** : tout état d'agrégat ES doit être reconstructible depuis
   son stream ; un test de rebuild-from-scratch le prouve en CI.
3. **Evidence figée** : une alerte référence un snapshot immuable (faits d'entrée
   au moment du déclenchement + version du scénario + config) ; l'investigateur
   voit ce que le moteur a vu.
4. **Sorties = propositions** (R44) : ES n'écrit jamais dans les tables du
   monolithe ; il appelle les API existantes avec un compte de service identifié
   (`actor: surveillance-es@version`).
5. **Idempotence de consommation** : re-livrer le même événement outbox ne produit
   ni doublon de fait ni double alerte (clé : id d'événement source).
6. **Interdit de langage** : tant que ES-4 n'est pas réconcilié, aucune démo ne
   présente ce module ; après, la formulation autorisée est « les alertes sont
   event-sourcées » — jamais « O-Live est event-sourcé ».

## 4. Règles de parallélisme (pour cohabiter avec le PLAYBOOK)

- **Périmètre de fichiers exclusif** : `apps/api/src/modules/surveillance-es/**`,
  `prisma/migrations/*_es_*`, `docs/notes/ES-*.md`, `docs/contracts/es/**`.
  AUCUNE modification hors de ce périmètre, à une exception près : l'enregistrement
  du module dans `app.module.ts` (une ligne, en fin de fichier, commit dédié).
- **Branches** : `feat/es-<n°prompt>` ; rebase sur main avant chaque session.
- **Points de synchronisation** avec le playbook principal :
  - après **L1** (signal fiable) : prérequis fortement recommandé — ne pas bâtir
    un système de preuve sur une CI qui ment ;
  - après **P-L5-2** (catalogue central) : remplacer les schémas anti-corruption
    locaux par des références au catalogue (prompt ES-5) ;
  - **L3** (ports) : indépendant — ES passe par l'outbox et les API publiques,
    pas par les internes du contexte Surveillance logique.
- Un prompt = une session = un commit ; gate vérifiée avant le prompt suivant.

## 5. Effort et jalons

~15–25 j·h au total. Chaque prompt livre un incrément démontrable ; ES-4 est le
jalon de vérité (parallel run réconcilié) — c'est lui qui autorise la bascule et
le discours commercial.

---

## 6. Prompts d'exécution

### ES-0 — Socle : store, triggers, RLS
```
Contexte : docs/SURVEILLANCE-ES.md §2-§3 (lis-le d'abord). Périmètre de fichiers :
§4 strictement.
Tâche : crée le module apps/api/src/modules/surveillance-es/ et la migration du
schéma Postgres `es` : table es.events (stream_type, stream_id, seq, type,
version, payload jsonb, source_event_id nullable, tenant_id, at timestamptz),
contrainte d'unicité (stream_type, stream_id, seq), index (tenant_id, at) et
(source_event_id). TRIGGERS interdisant UPDATE et DELETE (exception aucune).
RLS : ENABLE + FORCE + policy tenant_isolation sur le modèle de
prisma/post-deploy-v2.sql. Un EsEventStore service : append(stream, events[],
expectedSeq) avec verrou optimiste par seq attendu, read(stream) ordonné.
Specs : append/read, conflit de seq, UPDATE/DELETE rejetés PAR LA BASE (test SQL
brut), recette RLS (deux tenants, aucune fuite).
Gate : toutes specs vertes ; un UPDATE manuel en psql échoue avec l'erreur du trigger.
```

### ES-1 — Souscription outbox et faits d'entrée
```
Contexte : docs/SURVEILLANCE-ES.md §2 (anti-corruption, idempotence).
Tâche : un souscripteur qui lit l'outbox du monolithe (même mécanique de drainage
que les consommateurs existants — inspire-toi de events/outbox.worker.ts SANS le
modifier) pour les types : transactions ingérées, kyc.validated, hits screening,
événements PEP. Position de lecture persistée dans es.subscription_cursor ;
rattrapage complet après arrêt. Chaque événement consommé : validé par un schéma
zod local (surveillance-es/contracts/, un fichier par type, version explicite),
puis appendé comme FAIT D'ENTRÉE dans un stream es dédié avec source_event_id.
Payload non conforme → stream es.quarantine + compteur, jamais de crash ni de skip
silencieux. Idempotence : re-livraison du même source_event_id = no-op prouvé.
Specs : consommation nominale, rattrapage, quarantaine, idempotence.
Gate : couper/relancer le souscripteur en test ne perd ni ne duplique aucun fait.
```

### ES-2 — Agrégat Alerte event-sourcé + evidence figée
```
Contexte : docs/SURVEILLANCE-ES.md §3 (invariants 2-4).
Tâche : l'agrégat Alerte, état reconstruit PAR REJEU de son stream (aucune table
d'état) : AlerteLevee {scenarioId, scenarioVersion, configRef, evidenceRef,
severite}, AlerteAssignee, AlerteDisposee {decision, motif}, chaque transition un
événement. EvidenceRef pointe un snapshot immuable appendé au store (faits
d'entrée déclencheurs + paramètres du scénario à date). L'évaluation elle-même
appelle les évaluateurs EXISTANTS (logique AML 2G / verdicts CPSI consommés) —
ce module n'invente aucun détecteur. Toute disposition qui exige une action
monolithe (gel, requalification, PEPisation) sort en PROPOSITION via l'API
existante, compte de service surveillance-es, jamais d'écriture directe.
Specs : cycle de vie complet par rejeu, rebuild-from-scratch (état identique après
reconstruction totale du stream), evidence immuable (le snapshot ne bouge pas
quand les faits ultérieurs arrivent), proposition émise et tracée.
Gate : test rebuild-from-scratch en CI ; grep confirme zéro import d'écriture
vers les modules du monolithe.
```

### ES-3 — Projections et back-testing par rejeu
```
Contexte : docs/SURVEILLANCE-ES.md §1 (le back-testing est le produit).
Tâche : (1) projection « file d'alertes » (lecture : statut, sévérité, âge,
scénario) reconstructible from scratch — test de rebuild en CI. (2) Back-testing :
exécuter un scénario (version + config données) sur les faits d'entrée historiques
d'une période, en produisant des AlertesSimulees dans un stream backtest isolé
(jamais mêlées aux réelles), avec rapport : volume, recouvrement avec les alertes
réelles, delta. Exécution bornée (période max paramétrable) et conçue pour tourner
sur un read replica quand il existera (connexion lecture séparée injectable —
défaut : la base courante).
Specs : rebuild projection, backtest reproductible (même entrée = même rapport),
isolation réel/simulé.
Gate : backtest de 90 jours de fixtures < 60 s en local ; rapport committé en
exemple dans docs/notes/ES-backtest-exemple.md.
```

### ES-4 — Parallel run et réconciliation (jalon de vérité)
```
Contexte : docs/SURVEILLANCE-ES.md §3 invariant 6 — pas de démo avant ce jalon.
Tâche : mode shadow : sur le flux de fixtures/démo, ES évalue en parallèle des
évaluations existantes (sorties AML 2G / files d'éval) sans émettre aucune
proposition réelle (flag es.shadow=true, propositions écrites en stream shadow).
Rapport de réconciliation automatique : alertes concordantes, présentes seulement
côté ES, présentes seulement côté existant — chaque écart avec diagnostic dans
docs/notes/ES-reconciliation.md. Critères de bascule ÉCRITS dans le rapport :
zéro alerte existante manquée par ES sur le corpus ; écarts additionnels tous
expliqués. La bascule elle-même (shadow=false) N'EST PAS dans ce prompt — décision
humaine séparée.
Gate : rapport généré en CI sur le corpus de fixtures ; critères de bascule
évalués explicitement (oui/non par critère).
```

### ES-5 — Raccordement au catalogue central (après P-L5-2 du PLAYBOOK)
```
Prérequis : docs/contracts/events-catalog.ts existe (P-L5-2 mergé).
Tâche : remplace les schémas anti-corruption locaux de surveillance-es/contracts/
par des imports du catalogue central pour les types couverts ; conserve les schémas
locaux uniquement pour les types absents du catalogue, listés dans
docs/notes/ES-catalogue-gaps.md. Aucune autre modification.
Gate : specs ES-1 vertes inchangées ; zéro duplication de schéma pour un type
présent au catalogue.
```

---

## 7. Discours commercial autorisé (après ES-4 réconcilié)

- « **Les alertes de surveillance sont event-sourcées** : chaque alerte est une
  séquence d'événements immuables, son état est reconstruit par rejeu, son
  évidence est figée au déclenchement. »
- « **Le back-testing est un rejeu**, pas une simulation approximative : nouveau
  scénario, historique réel, rapport de recouvrement. »
- Toujours interdit : « O-Live est event-sourcé ». Le reste du système garde la
  formulation de la spec v2 §3 (journal immuable + état à date + référentiels
  versionnés).
