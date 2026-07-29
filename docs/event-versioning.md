# Versioning & upcasting des événements — Bloc E (R339/EV)

## Problème

Le journal `domain_events` est **append-only** (trigger `outbox_guard`, chaînage
`record_hash/prev_hash`, R48) : un événement écrit en 2026 ne peut **jamais** être réécrit.
Or le schéma de son `payload` évoluera. Sans dispositif, tout consommateur devrait connaître
toutes les formes historiques d'un même type d'événement.

## Décision

- **`event_version` sur `domain_events`** (`INTEGER NOT NULL DEFAULT 1`, migration expand-only
  `20260729000003_add_event_version`). Tout événement produit porte sa version de schéma ;
  l'historique est rétro-daté à `1` par le `DEFAULT` (aucune réécriture).
- **Upcast À LA LECTURE seulement.** L'événement stocké reste figé. La montée de version se fait
  en mémoire, au moment de la lecture, via un registre d'upcasters.
- **Registre de fonctions PURES `payload → payload`**, chaînables, indexées par
  `type@fromVersion` (`src/modules/events/upcasters.ts`). Un upcaster `type@N` produit la
  version `N+1`. La chaîne complète `v1→…→vCible` est appliquée par `deserialiser()`, **unique**
  point de désérialisation.
- **Immuabilité du registre** : ré-enregistrer un `type@N` déjà présent lève une erreur. Un
  upcaster publié ne se redéfinit pas (sinon la relecture d'anciens événements changerait de sens).

## API

```ts
enregistrerUpcaster(type, fromVersion, (payload) => payload)   // additif, immuable
versionCible(type)                                             // plus haute version atteignable
deserialiser({ type, payload, eventVersion })                 // → { type, version, payload } upcasté
```

Ajouter une v2 d'un type = écrire **un** upcaster `type@1` (additif : nouveaux champs + défauts),
sans toucher aux événements stockés ni aux fixtures.

## Réversibilité

Purement **additif**, **sans feature flag** : aucun comportement legacy à préserver puisque le
registre vide laisse passer les payloads v1 tels quels (`versionCible = 1`). Rollback = retrait
de la colonne (contract-phase R334) ; les événements restent lisibles en version 1.

## Non applicable (écart consigné vs spec source)

La spec source vise des upcasters **Pydantic** (Python/FastAPI event-sourcé). O-Live est
**NestJS/Prisma, CRUD-primaire + journal append-only** : upcasters en **TS**, fixtures JSON
figées. Pas de reconstruction d'état depuis les événements (l'état vient des tables CRUD).

## Preuves

| Test | Portée | Vérifie |
|------|--------|---------|
| **EV-01** | e2e (DB réelle) | Tout événement produit porte `event_version ≥ 1` (défaut 1). |
| **EV-02** | harnais | Chaque fixture `legacy_events/*.v1.json` figée se désérialise sans erreur (aucune fixture modifiée). |
| **EV-03** | harnais | Chaîne `v1→v2→v3` additive appliquée à la lecture ; un événement déjà v2 ne rejoue que `v2→v3`. |
| **EV-03b** | harnais | Registre immuable : ré-enregistrer un `type@N` lève. |
| **EV-04** | e2e (DB réelle) | Événement **legacy** (fixture v1) injecté au journal → toujours lisible via `deserialiser()`, payload exploitable. |

Fixtures figées : `apps/api/test/fixtures/legacy_events/{kyc.created,kyc.access.modifie,audit_access}.v1.json`.
