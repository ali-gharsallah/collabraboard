# Frontière du contexte Surveillance (P-L3-1)

> Constat lecture seule. Décision de référence : `docs/adr/ADR-TM-001.md` — **Option C** : la Surveillance
> (Transaction Monitoring) est un **contexte borné LOGIQUE in-monolith**. La frontière n'est pas un
> réseau : c'est une **discipline d'imports**. Ce document cartographie les entrées/sorties et liste
> chaque **violation** (import direct inter-contexte) avec `fichier:ligne`, puis déclare les **ports**
> TypeScript aux points de croisement — *déclaration seulement*, la matérialisation est P-L3-2.

## Périmètre du contexte

Modules internes : **`screening`**, **`aml`**, **`riskcases`**, **`mros`**
(`apps/api/src/modules/{screening,aml,riskcases,mros}`). Dépendances propres au contexte :
`@olive/screening-engine` (paquet), `aml-scoring.engine.ts` (local). Le CPSI Python (`services/cpsi-server-py`)
est un moteur externe atteint par le pont `bridge.py` (contrat R248, cf. `docs/contracts/cpsi.schema.json`).

## Ce qui ENTRE (inbound)

1. **HTTP (propre)** — chaque module expose un contrôleur (`screening.module`, `aml.controller` /
   `aml-gap.controller`, `risk-case.controller`, `mros.module`). Le monde extérieur passe par le jeton +
   la route, jamais par un import de service. ✔ pas de couplage.
2. **Événements consommés (propre)** — le contexte réagit à des événements du journal append-only
   (ex. `cpsi.case_proposal.emitted` → ouverture d'un risk case). ✔ découplage par le journal.
3. **Appels de service DIRECTS (⚠ violations)** — deux modules externes importent un **interne** du
   contexte et l'injectent, court-circuitant tout port. Voir le tableau ci-dessous.

## Ce qui SORT (outbound) — propositions & verdicts

Le contexte n'exécute jamais une décision (R39/R44) : il **émet**. Sorties observées :

- `screening` → `screening.escalade.proposee` (VP → gel/clarification/MROS à arbitrer, R39/R44).
- `aml` → `aml.eval.completed`, `aml.eval.version_compared`, `dq.degraded`, `tuning.btl.campagne`,
  `tuning.calibrage.annuel` (signaux/propositions, jamais coercition).
- `mros` → `mros.gel.leve` (+ communications art. 9/10) ; **verdict** de gel rendu à l'appelant.
- `riskcases` → transitions de cas (ouverture/animation) issues des propositions.

Ces sorties transitent par le **journal** (événements) ou par une **valeur de retour de lecture**
(verdict), jamais par un effet de bord dans un module externe. ✔

## Violations de frontière (import direct inter-contexte)

| # | Sens | Import direct (`fichier:ligne`) | Ce qui est appelé | Port cible |
|---|---|---|---|---|
| **VIOL-1** | `transactions` → `mros` | `modules/transactions/transaction-gate.service.ts:4` (import), `:37` (type de `gardeGelMros`), `:40` (appel) | `mros.verifierTransaction(ctx, clientId)` → `{ bloquant, motif?, communicationId? }` (garde `gel-mros`, R131 / art. 10 LBA) | `PortGelMros` |
| **VIOL-2** | `events` → `riskcases` | `modules/events/case-proposal.consumer.ts:2` (import), `:14` (injection), `:20` (appel) | `riskCases.consommerProposition(ctx, cle)` sur `cpsi.case_proposal.emitted` (R133/R252) | `PortPropositionRiskCase` |
| **VIOL-3** | `events` → `riskcases` | `modules/events/events.module.ts:8` | `import { RiskCaseModule }` (câblage DI qui fournit `RiskCaseService` au consumer VIOL-2) | fourniture du port par jeton DI |

> **Aucune** violation entrante pour `screening` ni `aml` : aucun module externe n'importe
> `ScreeningService` / `AmlService` / `AmlGapService` / `AmlEvalService` (vérifié par grep). Leur
> frontière est déjà propre (HTTP + événements).

### Couplage sortant à signaler (hors ports de contexte)

`modules/aml/aml-eval.service.ts:10-11` importe le moteur **généré** à la racine
(`../../../../../src/aml/engine`, `../../../../../src/aml/detectors`). Ce n'est pas un croisement
module↔module runtime mais une dépendance **build-time au code généré** (le générateur fait foi).
À surveiller ; hors périmètre des ports de frontière (noté, non traité en L3).

## Ports TypeScript aux points de croisement (déclaration seulement — P-L3-2 matérialise)

Objectif : l'appelant externe dépend d'une **interface** (port), pas du service concret ; le module du
contexte l'implémente et le fournit sous un **jeton DI**. Zéro changement d'implémentation dans ce prompt.

```ts
// apps/api/src/modules/surveillance/ports.ts   (à CRÉER en P-L3-2 — ici : forme cible)
export type CtxSurveillance = { tenantId: string; userId: string; role: string };

/** VIOL-1 — Gel MROS. Consommé par `transactions` (garde R131), implémenté par `mros`. */
export interface PortGelMros {
  verifierTransaction(ctx: CtxSurveillance, clientId: string):
    Promise<{ bloquant: boolean; motif?: string; communicationId?: string }>;
}
export const PORT_GEL_MROS = Symbol("PortGelMros");   // jeton DI

/** VIOL-2/3 — Proposition de risk case. Consommé par `events`, implémenté par `riskcases`. */
export interface PortPropositionRiskCase {
  consommerProposition(ctx: CtxSurveillance, cle: string): Promise<unknown>;
}
export const PORT_PROPOSITION_RISK_CASE = Symbol("PortPropositionRiskCase");
```

## Plan P-L3-2 (matérialisation + test d'archi)

1. Créer `modules/surveillance/ports.ts` (ci-dessus).
2. `mros` fournit `PORT_GEL_MROS` (useExisting: `MrosService` — `verifierTransaction` a déjà la bonne
   forme) ; `riskcases` fournit `PORT_PROPOSITION_RISK_CASE` (useExisting: `RiskCaseService`).
3. `transaction-gate` : typer `gardeGelMros(mros: PortGelMros)` ; `case-proposal.consumer` : injecter
   `@Inject(PORT_PROPOSITION_RISK_CASE)` au lieu de `RiskCaseService`. Comportement identique → specs
   existantes vertes.
4. **Test d'architecture** (ESLint `no-restricted-imports` ou dependency-cruiser) : interdire tout import
   direct `modules/(screening|aml|riskcases|mros)/*` depuis l'extérieur du contexte (et inversement),
   sauf `modules/surveillance/ports`. Le violer localement → CI rouge.

**Critère de sortie P-L3-1 atteint** : chaque violation de frontière est listée avec `fichier:ligne`
(VIOL-1/2/3) ; les ports sont déclarés ; aucun refactor d'implémentation.
