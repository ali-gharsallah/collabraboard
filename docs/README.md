# Documentation O-Live — index de gouvernance

> **Le repo fait foi.** En cas de divergence entre un document ci-dessous et le code,
> c'est le code qui prime ; le document est corrigé, jamais l'inverse silencieusement.
> Trois natures de document : **normatif** (ce qui doit être vrai), **constat** (ce qui
> est vrai, mesuré en lecture seule), **décision** (un choix d'architecture tranché).

## Contexte permanent & plan

| Document | Nature | Rôle |
|---|---|---|
| [`/CLAUDE.md`](../CLAUDE.md) | normatif | Contexte permanent : réalité du système, invariants non négociables, interdits de langage, discipline d'exécution. |
| [`docs/PLAYBOOK.md`](./PLAYBOOK.md) | plan | Prompts d'exécution séquencés par lots L0→L8 ; un prompt = une session = un commit ; gate de lot avant lot suivant. |

## Spécifications (normatif)

| Document | Nature | Rôle |
|---|---|---|
| [`docs/OLive-Specification-Produit-v2-PostAudit.docx`](./OLive-Specification-Produit-v2-PostAudit.docx) | normatif | « La spec v2 » — spécification produit post-audit. |
| [`spec/wf-v2.md`](../spec/wf-v2.md) | normatif | « Le catalogue » — catalogue normatif des règles (noyau workflow-visa R1–R51 et au-delà). |

## Audit — Série 0 (constat, lecture seule, cité `chemin:ligne`)

| Document | Nature | Rôle |
|---|---|---|
| [`docs/audit/AUDIT.md`](./audit/AUDIT.md) | constat | « L'audit » — carte des modules, cycle de vie événementiel, mécanisme d'évaluation des règles, invariants, codé-en-dur vs configurable, 5 points de résistance. |
| [`docs/audit/RULES_INVENTORY.md`](./audit/RULES_INVENTORY.md) | constat | Inventaire R1–R51 : type, déclencheur, reformulable en Requirement, base réglementaire, % migrable. |
| [`docs/audit/TEST_AUDIT.md`](./audit/TEST_AUDIT.md) | constat | Dispositif de test : couverture par module, style d'assertion, zones non testées, plan 5 actions. |
| [`docs/audit/GAP_ANALYSIS.md`](./audit/GAP_ANALYSIS.md) | constat | 12 capacités screening (EXISTE/PARTIEL/ABSENT + RÉUTILISER/ÉTENDRE/CONSTRUIRE), questions TM, risques de collision (dont PEP déclaratif vs listes, C4). |
| [`docs/audit/EFFORT_REVISION.md`](./audit/EFFORT_REVISION.md) | constat | Révision des estimations d'effort à la lumière de l'audit ; estimation ascendante de la brique Surveillance. |

## Décisions d'architecture (ADR — tranchées)

| Document | Nature | Rôle |
|---|---|---|
| [`docs/adr/ADR-TM-001.md`](./adr/ADR-TM-001.md) | décision | Transaction Monitoring / Surveillance = **contexte borné logique in-monolith** (on ÉTEND, pas de service séparé). |
| [`docs/adr/ADR-PEP-001.md`](./adr/ADR-PEP-001.md) | décision | Autorité du statut PEP = **`personnes.statutPep`, décidé par un humain** ; les listes de screening *proposent* (R44). |

## Notes d'exécution

`docs/notes/` reçoit les notes hors-périmètre et les journaux de lot (L1.md, L2-blocages.md, …)
produits pendant l'exécution du playbook — découvertes consignées, jamais corrigées de façon
opportuniste (discipline « un prompt = un périmètre »).
