# ES-8 — Montée au catalogue des 4 derniers types en garde locale (solde d'ES-5)

Suite « Next es » (2026-08-08). ES-5 avait adossé les gardes ES au catalogue central pour
les types qu'il couvrait et consigné les 4 absents dans `docs/notes/ES-catalogue-gaps.md`.
ES-8 les fait monter — même geste, dernier lot :

## Livré
- **Catalogue C6** (`apps/api/src/contracts/events-catalog.ts`) : 4 schémas STRICTS v1,
  copies exactes des payloads RÉELS des émetteurs (pas de champ inventé) —
  `tx.flux.importee` {refExterne, source, compte, clientId?} (txflux),
  `kyc.validated` {code, validatedBy} (kyc.service),
  `personne.pep.declare` {source, sourceHitId?} et `personne.pep.leve`
  {decideur, sourceHitId?} (personnes.service, seul écrivain — ADR-PEP-001).
  Les 4 types SORTENT de TYPES_EN_ATTENTE (568 → 564).
- **kyc.service** : le `domainEvent.create` direct de `kyc.validated` passe par le wrapper
  `emit` (emitEvent) — le catalogue valide désormais ce write. L'ordre des gardes de
  `validate()` est INTACT (invariant 3) : seul le mécanisme d'écriture de l'événement change,
  au même point de la transaction. Les 3 autres creates directs de kyc.service
  (`kyc.created`, `prospect.retour.refuse.detecte`, `kyc.access.modifie`) restent au backlog
  L5 — hors périmètre ES (non consommés par le sidecar).
- **Contrats ES** (`surveillance-es/contracts/index.ts`) : `DU_CATALOGUE` = les 9 types
  consommés ; les 4 fichiers de garde locale sont SUPPRIMÉS. Zéro duplication de schéma.

## Sémantique assumée (frontière)
Les schémas catalogue sont `.strict()` là où les gardes locales toléraient l'additif.
Par construction, tout événement qui passe `emitEvent` passe la garde ES ; un payload
historique additif partirait en QUARANTAINE — visible, jamais silencieux (invariant ES-1),
et la quarantaine du tenant de démo est vérifiée à zéro par les specs.

## État de la série ES
ES-0..ES-8 codés. Restent : la BASCULE humaine ES-4 (shadow → actif, critères oui/non du
rapport de réconciliation) et le discours §7 qu'elle autorise.
