# Catalogue O-Live — Amendement PROPOSÉ (R170) · « La rétention naît au classement »

**Statut : RATIFIÉ le 21.07.2026 par Ali Gharsallah.**
Numérotation continue après R169. Famille : **RN** (vérifiée libre — RT est PRIS, 4e collision
évitée par la vérification systématique). **Le catalogue précède le code.** Trou identifié à
l'audit du paramétrage : `retentionUntil` existe par document et GD-11 sait proposer la
destruction — mais RIEN ne posait l'échéance. R170 est le chaînon entre le classement et
l'oubli certifié.

## R170 — La rétention naît au classement — le type porte sa durée

Chaque type du plan de classement (`gedDocTypes`) peut porter **`retentionAnnees`**
(paramètre R-Q — la clé maîtresse s'enrichit, aucune clé nouvelle). Au classement (R139),
si le type porte une durée, l'échéance **`retentionUntil` est posée** (date du classement +
durée) et portée à l'événement. Sans durée : pas d'échéance — GD-11 ne proposera jamais.
L'aval est INCHANGÉ : l'échéance **propose** (GD-11), la destruction se **décide** (R7),
rien n'est bloqué (R39). R170 amende le comportement de `classer` — les suites existantes
(GI, CB) restent vertes : c'est le filet de non-régression.

> **Scénario RN-01 — Le type à 10 ans pose l'échéance**
> **Quand** un justificatif est classé vers un type `retentionAnnees: 10`
> **Alors** `retentionUntil` = classement + 10 ans, et l'événement de classement la porte

> **Scénario RN-02 — Sans durée, pas d'échéance**
> **Quand** le type ne porte pas de durée **Alors** `retentionUntil` reste nul —
> le tick GD-11 ne proposera jamais ce document

> **Scénario RN-03 — Le chaînon complet**
> **Étant donné** un document classé sous durée **Quand** le tick passe APRÈS l'échéance
> **Alors** la destruction est PROPOSÉE (GD-11, intouché) — statut toujours ACTIF (R39),
> une seule fois

> **Scénario RN-04 — Garde**
> **Quand** l'échéance est posée **Alors** rien n'est bloqué : le document se cherche, se
> consulte, vit — l'échéance est une DATE, pas une punition

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Service | `ged-ingestion.classer` : calcule `retentionUntil` depuis `typ.retentionAnnees` — SEULE modification ; GD-11 (`tickRetention`) INTOUCHÉ |
| Paramètres R-Q | **aucune clé nouvelle** : `retentionAnnees` vit dans `gedDocTypes` (description du registre mise à jour) |
| Événement | `ged.classement` porte désormais `retentionUntil` (nullable) |
| Non-régression | suites GI + CB existantes vertes obligatoires après modification |

Tests : RN-01..04 (`retention.wiring.spec.ts`), écrits **avant** la modification.

`RATIFIÉ le 21.07.2026 par Ali Gharsallah`
