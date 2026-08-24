# ES-1 — Souscription outbox et faits d'entrée (gate + décisions)

Référence : `docs/SURVEILLANCE-ES.md` §2, prompt ES-1.

## Livré

- **`surveillance-es/contracts/`** — gardes anti-corruption LOCALES, un fichier par type,
  version explicite (v1) : `tx.flux.importee`, `kyc.validated`, `screening.escalade.proposee`,
  `pep.proposition.creee`, `pep.proposition.rejetee`, `personne.pep.declare`, `personne.pep.leve`.
  Les schémas valident les champs REQUIS et laissent passer l'évolution additive ; le fait stocke
  le payload ORIGINAL (la garde est une porte, pas une transformation). ES-5 adossera au
  catalogue central les types qu'il couvre (3 des 7 aujourd'hui).
- **Migration `20260807000002_es_souscription`** — `es.subscription_cursor` (consumer, last_seq,
  nb_faits, nb_quarantaine) : table d'infrastructure NON tenantée (même statut que
  `event_consumers`), justification en tête de migration.
- **`EsSubscriber`** — drainage sur la mécanique R286 (watermark persisté, at-least-once,
  naissance AU PRÉSENT : curseur créé à MAX(id), jamais de rejeu implicite) SANS toucher
  `events/outbox.worker.ts`. Conforme → fait d'entrée `fait.<type>` (stream `fait-entree`,
  payload = {source, donnees}, `source_event_id` = id outbox) ; non conforme → stream
  `quarantine` avec le détail zod + compteur — jamais de crash, jamais de skip silencieux.
  Curseur avancé APRÈS chaque événement : une coupure re-livre au plus l'événement en cours,
  l'idempotence par `source_event_id` rend la reprise sans doublon. DORMANT par défaut
  (timer sous `ES_SOUSCRIPTEUR=on` seulement — §1 : pas actif avant ES-4).

## Décisions prises en construisant

1. **Streams scopés tenant** — l'unicité `es.events (stream_type, stream_id, seq)` est globale
   (sans tenant) : deux tenants partageant un stream nommé par type seul entreraient en
   collision de séquence. Le stream physique est donc `stream_id = <tenantId>:<type>`
   (`cleFlux()`), la contrainte du store reste celle du doc. Découvert par un vrai conflit
   en recette, pas en théorie.
2. **Recul de curseur = acte explicite** — la recette d'idempotence recule le curseur jusqu'à
   NOS événements, pas à 0 : reculer à 0 rejouerait l'historique d'autres tenants — exactement
   le rejeu implicite que R286 interdit.

## Gate ES-1 — verdicts

| Critère | Verdict |
|---|---|
| Consommation nominale / rattrapage / quarantaine / idempotence | ✅ ES1-01..05, 5/5 |
| Couper/relancer ne perd ni ne duplique aucun fait | ✅ ES1-05 (drain par lots de 2, nouvelle instance à mi-course, aucun perdu/dupliqué) |

Suite e2e complète : 64 suites, 422/422 (label CI ajusté). Lint/typecheck verts,
analyzers migrations 17/0 violation, no-drift Prisma inchangé.
