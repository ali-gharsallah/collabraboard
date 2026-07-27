# Tests d'Acceptation Fonctionnelle — Vague 12 (Workflow Instances, FE-WFI)

**Exécutés le 2026-07-27 contre le backend réel (3 FAT)** (`apps/api/test/e2e/fat-vague12.e2e-spec.ts`).
Preuve : `docs/tests/PREUVES/fat-vague12-run.txt`. Statut : **3/3 PASS**. + composant `FE-WFI` (Vitest+RTL+MSW).
Objet : l'écran **Workflow Instances** (`WorkflowInstances.tsx`) câblé au backend, sur le workflow gouverné
**ratifié** = le **dossier KYC** (`kyc-workflow.chaine`, R171-173). Zéro invention : l'instance EST le dossier KYC.

| ID FAT | Persona | Objectif métier | Préconditions | Étapes | Résultat attendu | Règle / exigence | Criticité | Statut |
|---|---|---|---|---|---|---|---|---|
| **FAT-WFI-01** | Compliance Officer | Voir la liste des instances (workflows en cours) | Un dossier KYC créé (chemin ratifié `POST /v1/kyc`) | 1. J'ouvre `/v1/workflow-instances`. | L'instance apparaît : `code`, `type` (`KYC:…`), `status` (IN_PROGRESS), `visas` « signés/total ». | projection R171-173 | **M** | ✅ PASS |
| **FAT-WFI-02** | Compliance Officer | Voir les étapes et les visas (uniformes R15) d'une instance | Un visa signé (four-eyes R13 respecté) | 1. Un CO répond, un autre CO vise IDENTITY. 2. J'ouvre le détail. | `steps` = sections ; le visa IDENTITY porte son **statut** et son **signataire** (`signePar`). | R15 / R13 | **C** | ✅ PASS |
| **FAT-WFI-03** | Compliance Officer | La timeline est fidèle à l'audit | — | 1. J'ouvre `/:id/events`. | Timeline **append-only** dans l'ordre serveur, contenant `kyc.created` (FE-20). | FE-20 / R48-esprit | **M** | ✅ PASS |

**Porte backend nouvelle (thin, projection — A1/D1)** : `GET /v1/workflow-instances`, `GET /:id`, `GET /:id/events`
(`WorkflowInstancesModule`). Lecture seule sur `KycFile` (instance) + `KycVisa` (visas R15) + `DomainEvent`
(timeline par `aggregateId`). **Aucun modèle Prisma nouveau, aucune règle nouvelle** : la porte relaie/projette,
ne décide pas (PT-01). Métadonnées seulement (jamais le contenu des questions — R110).

**Front** : `WorkflowInstances.tsx` (liste → détail : workflow horizontal des sections, panneau visas via
`<VisaBadge>` composant **unique** R15, timeline append-only) ; `asOf` → bandeau « Vue historique — lecture seule » ;
fallback seed signalé si backend absent. `<VisaBadge>` = `apps/web/src/components/VisaBadge.tsx`.

**Écart mis à jour (ECARTS-FRONT §5)** : FE-WFI **résolu** — l'écran n'est plus en FE-05 seed, il est **réellement
câblé** au workflow gouverné ratifié (KYC). Les autres types de workflow s'ajouteront avec leur canon ; **Tâches**
reste en FE-05 (pas de service backlog ratifié).
