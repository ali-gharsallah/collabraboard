# ES-7 — Extension de la série : décisions PEP par rejeu

Décision (suite de la demande PO « continuer la série ES là où le rejeu est le produit ») :
après les alertes (ES-2) et la timeline des hits (ES-6), le contexte suivant est la VIE PEP
d'une personne — le hit propose, l'humain rejette (motif R7) ou PEPise, l'humain lève (R33).
L'auditabilité rejouable a une valeur produit directe : qui a décidé quoi, quand, sur la foi
de quelle proposition (ADR-PEP-001).

## Livré
- **Monolithe : ZÉRO changement.** Les 4 types étaient déjà émis (screening.service,
  personnes.service) ET déjà consommés par ES-1 : `pep.proposition.creee` / `pep.proposition.rejetee`
  (catalogue C6) + `personne.pep.declare` / `personne.pep.leve` (gardes locales ES —
  cf. docs/notes/ES-catalogue-gaps.md, toujours candidats à monter au catalogue).
- **Sidecar ES** : `EsPep` reconstruit l'état PEP d'une personne et la file PEP PAR REJEU
  des faits d'entrée (`rejouerPep` pur, aucune table, aucun cache — C8).
  Statuts rejoués : PROPOSE → REJETE | PEPISE → LEVE.
- **Liaison structurelle assumée** : `pep.proposition.rejetee` ne porte que la `cle`
  (payload {cle, motif, par}) — l'attribution à une personne passe par la carte
  cle→personId construite des propositions. Un rejet dont la proposition n'a jamais été
  consommée (antérieure à la naissance du souscripteur) est INATTRIBUABLE : il n'apparaît
  dans aucune timeline — assumé, pas de backfill inventé (même doctrine qu'ES-6).
- **Chronologie inter-flux** : les 4 flux de faits sont fusionnés par `at` source avec
  tie-break par `source_event_id` (l'id outbox est GLOBAL, contrairement à `seq` qui est
  locale à chaque stream physique scopé tenant).
- **Recette ES7-01..04** : cycle complet PROPOSE→PEPISE→LEVE avec timeline et traces
  (source, sourceHitId, décideur), rejet attribué par la liaison cle→personId, file
  reconstructible + rebuild from scratch identique, et SENS UNIQUE prouvé (ES ne crée
  aucune ligne `persons` — `statut_pep` reste l'autorité, écrite par personnes.service seul).

## Discours (même doctrine que §7 du doc ES)
Après bascule humaine du shadow : « la timeline des décisions PEP est event-sourcée » —
jamais plus large. L'AUTORITÉ du statut PEP reste `persons.statut_pep` décidé par un humain
(ADR-PEP-001, Option C) : ES fournit la vue rejouable, il ne décide rien et n'écrit rien.
