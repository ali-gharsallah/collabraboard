# Modèle outbox & projections — Bloc C (R338/PJ)

## Ce qu'O-Live EST (et n'est pas)

O-Live est **CRUD-primaire** : les tables d'état (`kyc_files`, `clients`, `risk_cases`, …) sont la
**source de vérité**, écrites directement par les services. En **même transaction** que l'écriture
métier, le service appende un événement au journal `domain_events` (**outbox**, append-only par
trigger `outbox_guard`, chaînage `record_hash/prev_hash`, R48).

O-Live **n'est PAS event-sourcé** : l'état n'est jamais reconstruit depuis les événements. Le
journal sert **audit + intégration + quelques projections dérivées**.

> Écart consigné vs spec source (FastAPI event-sourcé) : `load_aggregate()` / reconstruction
> d'agrégat depuis les événements = **N/A**. Les projections **synchrones sans bus** de la spec
> sont également **N/A** : O-Live assume un transport **outbox asynchrone**.

## Le relais outbox (`OutboxWorker`)

- **Unique voie d'émission** (R285) : rien ne part qui n'ait d'abord été écrit dans l'outbox.
- **Transport = références, jamais le payload** (R285/AS-02) : le message porte `event_id`, `type`,
  `tenant_id`, `aggregate_id`. Le consommateur **relit la source de vérité** (qui applique RBAC/RLS).
- **AT-LEAST-ONCE** (R286) : chaque consommateur porte son **watermark** persisté
  (`event_consumers`), naît **au présent** (le rattrapage historique est un rejeu explicite),
  suit **retry + backoff bornés** puis **dead-letter** tracée — le flux repart toujours (R39).
- **Ordre garanti par flux** (id croissant) ; aucun consommateur ne suppose d'ordre inter-agrégats.

## Projections dérivées d'événements (reconstructibles)

Deux projections internes consomment l'outbox de façon **asynchrone** :

| Projection | Événement source | Effet |
|------------|------------------|-------|
| `GoldenRecordProjector` (R104) | `kyc.validated` | applique un **mapping fermé** KYC → fiche client (`riskLevel`). |
| `CaseProposalConsumer` (R286/UC-01) | `cpsi.case_proposal.emitted` | ouvre le risk case par la porte canonique idempotente. |

Ces projections sont **reconstructibles** : rejouer le journal (watermark → 0) reconvergent vers le
même état que le drain incrémental. Propriété garantie par : **handler déterministe** (relit la
source de vérité) + **idempotent** (GR-03 : pas de diff → pas d'écriture) + **mapping fermé**
(aucune synchro silencieuse hors liste). Un rebuild = repositionner le watermark à 0 et laisser le
drain rejouer (aucun code spécial, aucune réécriture d'événement).

## Ce qui N'est PAS reconstructible (par conception)

Les tables **CRUD source de vérité** (`kyc_files`, …) ne se reconstruisent **pas** depuis le
journal : l'événement porte une **référence** (`aggregate_id`), pas le payload métier complet
(R285). Rejouer un événement dont l'agrégat source manque **n'applique rien** et ne recrée pas la
source (PJ-03). C'est le choix assumé d'O-Live : la vérité est le CRUD, l'événement est un signal.

## Preuves (Bloc C)

| Test | Vérifie |
|------|---------|
| **PJ-01** | La projection golden-record se reconstruit du journal : **rebuild ≡ drain incrémental** (fonction déterministe des événements + tables source). |
| **PJ-02** | Le rebuild est **idempotent en état** : N reconstructions convergent vers le même état projeté ; GR-03 (rejeu d'un événement sur état convergé n'écrit rien). |
| **PJ-03** | **Écart consigné** : le CRUD n'est PAS reconstructible du journal (événement = référence, pas payload) ; rejeu d'un événement orphelin ne recrée pas le `kyc_file`. |

Voir aussi `docs/event-versioning.md` (Bloc E) : les événements rejoués passent par la
désérialisation centralisée (upcast à la lecture).
