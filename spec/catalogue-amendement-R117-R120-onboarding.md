# Catalogue O-Live — Amendement PROPOSÉ (R117 → R120) · Bloc 19 « Onboarding — l'entrée en relation »

**Statut : PROPOSÉ** — en attente de ratification (Ali Gharsallah). Rédigé le 19.07.2026.
Numérotation continue après R116. Famille de scénarios : **OB** (vérifiée libre — spec md + Word).
**Le catalogue précède le code.**

## Le problème

L'Onboarding (MOD-69) est le premier maillon du menu Lifecycle et le seul sans règles au
catalogue. Les Spécifications Produit posent pourtant deux principes forts : « un KYC est créé
automatiquement à chaque onboarding » (§3.1) et « KYC APPROVED avant ouverture de compte »
(dépendance MOD-01 → MOD-09). Le mini-formulaire 4 infos (§3.2) existe côté KYC
(`KycService.create` : 4 infos → risque → workflow → initiation) mais **rien ne gouverne le
parcours** : états, transitions, refus, abandon, mesure du funnel. Quatre règles ferment le trou —
en **réutilisant** le moteur KYC existant, jamais en le dupliquant.

---

## R117 — Le parcours est une machine à états tracée

Un onboarding vit dans des états fermés :
`PROSPECT → COLLECTE → KYC_EN_COURS → DECISION → OUVERT | REFUSE | ABANDONNE`.
Seules les transitions légales existent (pas de saut d'étape) ; chaque transition est un
**événement** portant l'auteur (jeton) et l'horodatage ; les transitions terminales sensibles
(refus, abandon) exigent un **motif** (R7).

> **Scénario OB-01 — Pas de saut d'étape**
> **Étant donné** un onboarding à l'état PROSPECT
> **Quand** on tente PROSPECT → DECISION
> **Alors** la transition est refusée (transition illégale, états cités)
> **Et** PROSPECT → COLLECTE passe, tracée (auteur = jeton, horodatage)

> **Scénario OB-02 — Le refus se motive**
> **Quand** un refus est prononcé sans motif **Alors** le système refuse (R7)
> **Quand** il est motivé **Alors** l'état devient REFUSE, événement avec motif + auteur

## R118 — L'entrée en collecte crée le KYC — un seul, automatiquement

Le passage `PROSPECT → COLLECTE` porte le **mini-formulaire 4 infos** (nom légal, structure,
RM, type de compte — Spécifications Produit §3.2) et **délègue au moteur KYC existant** la
création (risque → workflow SDD/CDD/EDD → sections/visas). Le KYC créé est **lié** à
l'onboarding ; il n'existe qu'**un KYC actif par onboarding** (les révisions R2..Rn restent
l'affaire du cycle de vie KYC, pas de l'onboarding).

> **Scénario OB-03 — Un onboarding, un KYC, créé par le moteur**
> **Étant donné** un prospect et les 4 infos du mini-formulaire
> **Quand** l'onboarding passe en COLLECTE
> **Alors** le moteur KYC est appelé avec ces 4 infos (jamais un KYC construit à la main)
> **Et** le KYC créé est lié à l'onboarding, événement `onboarding.kyc.cree`
> **Et** une seconde entrée en collecte est refusée (un seul KYC actif)

## R119 — L'ouverture n'existe qu'après KYC APPROVED

La transition `DECISION → OUVERT` est **refusée** tant que le KYC lié n'est pas `APPROVED`
(contrainte réglementaire bloquante, même statut que R13 — pas un SLA R39). L'ouverture émet
`onboarding.ouvert` ; les effets aval (création de compte, tâches de bienvenue) sont des
consommateurs de cet événement, jamais des effets de bord de la transition.

> **Scénario OB-04 — Pas d'ouverture sans KYC approuvé**
> **Étant donné** un onboarding en DECISION dont le KYC lié est UNDER_REVIEW
> **Quand** l'ouverture est demandée
> **Alors** elle est refusée avec l'état du KYC dans le motif
> **Quand** le KYC passe APPROVED puis l'ouverture est redemandée
> **Alors** l'état devient OUVERT et `onboarding.ouvert` est émis

## R120 — Le funnel se mesure, il ne coerce pas

Chaque étape porte un **SLA paramétrable** (`Tenant.settings.onboardingSlaJours` — voie R-Q,
défauts : COLLECTE 30 j · KYC_EN_COURS 45 j · DECISION 10 j). Le dépassement **alerte une fois**
(événement + tâche de relance) — il n'abandonne jamais automatiquement (R39/R33 : l'abandon est
une décision humaine motivée, OB-02 s'applique). Le **funnel est rejouable** : les transitions
horodatées permettent de restituer délais par étape et taux de passage à tout inspecteur (R48/R49).

> **Scénario OB-05 — Le SLA alerte, n'abandonne pas**
> **Étant donné** un onboarding en COLLECTE depuis 35 jours (SLA 30)
> **Quand** le tick passe
> **Alors** une alerte + une tâche de relance sont émises — UNE fois
> **Et** l'état reste COLLECTE (jamais d'auto-abandon)

> **Scénario OB-06 — Le funnel se restitue**
> **Étant donné** un onboarding passé par PROSPECT → COLLECTE → KYC_EN_COURS
> **Quand** le funnel est demandé
> **Alors** chaque étape est restituée avec entrée, sortie et durée — depuis les événements (R48)

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Modèle | `Onboarding` (tenantId, prospectNom, structure, rmId, accountType, etape, etapeDepuis, kycFileId?, slaSignale, motifTerminal/terminePar) |
| Service | `OnboardingService(prisma, audit, kycSvc)` — **le moteur KYC est injecté**, jamais réimplémenté : `creer`, `transitionner` (garde des transitions légales), `tickSla`, `funnel` |
| Lien KYC | `DECISION → OUVERT` lit `kyc_files.status` ; la propagation golden record (R104) et l'adéquation PMS (R107) se déclenchent déjà en aval de `kyc.validated` — rien à ajouter |
| Paramètres R-Q | `onboardingSlaJours` { COLLECTE: 30, KYC_EN_COURS: 45, DECISION: 10 } |
| Événements | `onboarding.cree` · `onboarding.transition` · `onboarding.kyc.cree` · `onboarding.ouvert` · `onboarding.sla.alerte` · `tache.onboarding.relance` |
| RLS | `onboardings` rejoint la boucle RLS (table tenantée) |

Tests : OB-01..06 (`onboarding.wiring.spec.ts`, faux Prisma + faux moteur KYC injecté) —
écrits **avant** l'implémentation.

`RATIFIÉ le __________ par __________________`
