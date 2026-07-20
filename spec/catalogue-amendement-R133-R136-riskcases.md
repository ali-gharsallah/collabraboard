# Catalogue O-Live — Amendement PROPOSÉ (R133 → R136) · Bloc 23 « Risk cases — l'instruction AML »

**Statut : RATIFIÉ le 20.07.2026 par Ali Gharsallah.**
Numérotation continue après R132. Famille de scénarios : **RK** (vérifiée libre — Word + spec).
**Le catalogue précède le code.**

## Le problème — et la dette qu'il solde

Le gestionnaire de risk cases (R83) n'existait qu'en UI : le backend n'a ni états, ni notes, ni
rattachement de signaux. Conséquence directe, actée dans l'amendement du bloc 22 comme *limite
assumée* : la décision MROS acceptait un `riskCaseId` **opaque**. Quatre règles créent
l'instruction — et **R136 ferme la limite** : la garde « décision depuis un cas ESCALADÉ
seulement » devient réelle, et le corpus MR est **renforcé** en conséquence (les faux MROS
sèment désormais un vrai cas — jamais un test affaibli, toujours renforcé).

---

## R133 — Le cas est une machine à états instruite, né d'au moins un signal

Un risk case naît du **rattachement d'au moins un signal** (jamais un cas vide) et vit dans des
états fermés : `NOUVELLE → EN_ANALYSE ⇄ CLARIFICATION → CLOTUREE | ESCALADEE`, et
`ESCALADEE → CLOTUREE` (la clôture post-escalade existe — c'est ELLE que R136 garde tant que la
communication MROS est active : gel actif, ou COMMUNIQUER sans notification saisie).
*Correction pré-ratification : la 1re rédaction faisait d'ESCALADEE un état sans sortie — le
premier run du corpus l'a montré (RK-06 inatteignable).* Transitions
légales seules ; les terminales exigent un **motif** (R7) ; chaque transition est un événement
(jeton, horodatage).

> **Scénario RK-01 — Pas de cas vide**
> **Quand** on ouvre un cas sans signal **Alors** refus (au moins un signal)
> **Quand** on l'ouvre sur le signal sig-441 **Alors** état NOUVELLE, ouverture tracée

> **Scénario RK-02 — Les états sont fermés, les terminaux motivés**
> **Quand** NOUVELLE → CLOTUREE directement **Alors** refus (transition illégale)
> **Quand** EN_ANALYSE → CLOTUREE sans motif **Alors** refus (R7) ; motivée **Alors** close, tracée

## R134 — L'instruction est append-only

Les **notes d'instruction** s'ajoutent — jamais ne s'éditent, jamais ne s'effacent (R48).
Chaque note porte auteur (jeton) et horodatage ; le dossier d'instruction se **relit
chronologiquement** tel qu'il s'est écrit (R49). C'est la matière première du dossier MROS
(R130) : une instruction éditable est une instruction indéfendable.

> **Scénario RK-03 — Les notes s'empilent, ne s'éditent pas**
> **Quand** deux notes sont ajoutées **Alors** relecture chronologique, auteurs et horodatages
> **Et** aucune API de modification ou suppression n'existe (append-only structurel)

## R135 — Le rattachement groupe sans fusionner, le SLA alerte sans clore

Des signaux se **rattachent** à un cas existant (l'instruction se déduplique) ; un signal ne vit
que dans **un** cas actif à la fois ; le **détachement se motive** (R7). Chaque état porte un
SLA (*registre R-Q* : `riskCaseSlaJours`, défauts NOUVELLE 2 j · EN_ANALYSE 15 j ·
CLARIFICATION 10 j) : le dépassement **alerte une fois** (R39) — jamais d'auto-clôture,
l'instruction est humaine.

> **Scénario RK-04 — Un signal, un cas actif**
> **Quand** sig-442 est rattaché au cas actif **Alors** rattachement tracé
> **Quand** on tente de le rattacher à un second cas actif **Alors** refus (déjà instruit)
> **Quand** on le détache motivé **Alors** détachement tracé — et il redevient rattachable

> **Scénario RK-05 — Le SLA alerte, n'instruit pas**
> **Étant donné** un cas EN_ANALYSE depuis 20 jours (SLA 15)
> **Quand** le tick passe **Alors** alerte + tâche UNE fois, état INCHANGÉ

## R136 — L'escalade arme la décision MROS — la limite du bloc 22 se ferme

`ESCALADEE` (motivée) expose le cas au circuit MROS. **Dès ce bloc**, `MrosService.decider`
vérifie que le cas **existe et est ESCALADÉ** — la *limite assumée* de R130 (`riskCaseId`
opaque) est levée, l'amendement du bloc 22 est amendé en ce sens, et le corpus MR est renforcé
(les faux sèment un cas ESCALADÉ). Symétriquement, **clore un cas dont la communication MROS
est active est refusé** : le dossier reste cohérent de bout en bout.

> **Scénario RK-06 — La chaîne se ferme : signal → cas → escalade → décision**
> **Étant donné** un cas EN_ANALYSE
> **Quand** le MLRO tente de décider MROS **Alors** refus (cas non escaladé)
> **Quand** le cas est ESCALADÉ motivé puis la décision COMMUNIQUER prise
> **Alors** la décision passe — et la CLÔTURE du cas est refusée tant que la communication est active

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Modèles | `RiskCase` (tenantId, clientId, statut, etatDepuis, slaSignale, signalIds Json, ouvertPar, motifTerminal/terminePar) · `RiskCaseNote` (append-only : caseId, texte, par, at) |
| Service | `RiskCaseService(prisma, audit)` : `ouvrir` (≥1 signal), `transitionner` (états fermés, terminaux motivés, clôture refusée si communication active), `noter` / `notes` (append-only), `rattacher` / `detacher` (unicité du signal dans les cas actifs), `tickSla` |
| **MrosService (modifié)** | `decider` : `riskCase` requis, statut `ESCALADEE` exigé — **corpus MR renforcé, jamais affaibli** (les faux sèment le cas) |
| Paramètre R-Q | **au registre (R125)** : `riskCaseSlaJours` { NOUVELLE: 2, EN_ANALYSE: 15, CLARIFICATION: 10 } |
| Événements | `riskcase.ouvert` · `riskcase.transition` · `riskcase.note` · `riskcase.signal.rattache` / `.detache` · `riskcase.sla.alerte` · `tache.riskcase.relance` |
| RLS / append-only | `risk_cases` : RLS · `risk_case_notes` : RLS **et** append-only |

Tests : RK-01..06 (`risk-case.wiring.spec.ts`) écrits **avant** l'implémentation, + mise à jour
du corpus MR (précondition semée). Contrats copiés des sources, jamais de mémoire.

`RATIFIÉ le 20.07.2026 par Ali Gharsallah`
