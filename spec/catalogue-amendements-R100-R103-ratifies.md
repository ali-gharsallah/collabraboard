# Catalogue O-Live — Amendements RATIFIÉS (R100 → R103)

**Statut : RATIFIÉ.** Ratification : Ali Gharsallah, 2026-07-15. Rédigé le 15.07.2026. Numérotation continue à partir de R99
(plus haute règle ratifiée). Famille de scénarios : **SC**.

**Ordre respecté cette fois** : ces règles sont écrites **avant** leur implémentation. Les blocs
précédents (IAM, bacs à sable) avaient été codés d'abord — écart assumé et tracé au catalogue v2.2.
Ici, le catalogue précède.

---

## Le problème

Le rapprochement de noms est un problème résolu depuis vingt ans, et tous les fournisseurs vendent la
même donnée. Aucune banque n'a jamais été sanctionnée parce que sa liste était mauvaise.

Elles l'ont été parce qu'elles ne savaient pas dire **ce qu'elles avaient fait d'un hit** — ou parce
qu'un hit qualifié « faux positif » un mardi n'avait ni auteur, ni motif, ni date, ni version de liste.

Ces quatre règles couvrent exactement cet écart.

---

## R100 — Un hit n'est pas une alerte

**Règle.** Le rapprochement d'un client avec une entrée de liste produit un **hit brut** : un événement
horodaté portant le score, l'entrée rapprochée, et **la version de la liste** contre laquelle il a été
produit. Un hit brut n'est ni une alerte, ni un soupçon, ni une décision — c'est de la matière.

Il ne devient **alerte** qu'après qualification humaine (R101). Présenter des hits bruts à un analyste
comme des alertes, c'est le noyer : à 85 de seuil, un portefeuille de 2 000 clients produit 262 hits
dont 222 sont des faux positifs.

> **Scénario SC-01 — Le hit est une matière, pas un verdict**
> **Étant donné** un client dont le nom se rapproche d'une entrée de liste au-dessus du seuil
> **Quand** le screening s'exécute
> **Alors** un hit brut est produit, portant le score, l'uid de l'entrée et **la version de la liste**
> **Et** aucune alerte n'est créée
> **Et** aucun case n'est ouvert
> **Et** le hit est horodaté et rejouable (R48/R49)

---

## R101 — Qualification motivée

**Règle.** Un hit brut se qualifie en **vrai positif** ou **faux positif**, par une **personne nommée**,
avec un **motif obligatoire** (R7) choisi dans le référentiel des motifs standardisés. Aucune
qualification anonyme, aucune qualification sans motif — y compris pour un faux positif évident.

*Pourquoi y compris l'évident :* c'est précisément le hit « évident » que l'inspecteur choisira, trois
ans plus tard, pour demander qui l'a écarté et pourquoi.

> **Scénario SC-02 — Écarter un hit est une décision, pas un geste**
> **Étant donné** un hit brut non qualifié
> **Quand** un utilisateur tente de le qualifier sans motif
> **Alors** la qualification est refusée
> **Quand** il le qualifie « faux positif » avec le motif « homonyme — date de naissance incompatible »
> **Alors** la qualification est enregistrée avec son auteur, son motif et son horodatage
> **Et** le hit ne remonte plus à l'analyste
> **Quand** il qualifie un hit « vrai positif »
> **Alors** une escalade est proposée (gel, clarification, MROS) — **proposée, pas exécutée** (R39/R44)

---

## R102 — Whitelist datée, jamais éternelle

**Règle.** Un faux positif qualifié écarte le hit **pour cette entrée et cette version de liste**. Si
l'entrée de liste **change** — nouvel alias, nouvelle date de naissance, nouveau programme — la
whitelist ne s'applique plus : le hit **réapparaît** et doit être re-qualifié.

Une whitelist éternelle est une bombe à retardement : elle transforme une décision prise sur les
informations de 2024 en aveuglement permanent.

> **Scénario SC-03 — Une décision vaut pour ce qu'on savait ce jour-là**
> **Étant donné** un hit qualifié « faux positif » contre l'entrée E en version V1
> **Quand** le screening rejoue contre la version V1
> **Alors** le hit reste écarté
> **Quand** l'entrée E est modifiée (nouvel alias) et la liste passe en V2
> **Alors** le hit **réapparaît** comme non qualifié
> **Et** le motif de la qualification précédente reste consultable — il n'est pas effacé (R48)

---

## R103 — Preuve de fraîcheur

**Règle.** Chaque passage de screening laisse une trace, **même sans aucun hit** : quel périmètre a été
confronté, à quelle version de quelle liste, à quel horodatage, avec quels seuils et quel réglage de
pré-filtre.

*Pourquoi :* l'attente du régulateur n'est pas « avez-vous un outil », c'est « votre base a-t-elle été
confrontée à cette inscription, et quand ». Un screening sans trace de passage ne prouve rien —
l'absence de hit n'est pas une preuve de contrôle.

Et le **réglage du pré-filtre fait partie de la trace** : trois nombres décident de ce qui n'a jamais
été comparé. Les taire, c'est cacher l'essentiel.

> **Scénario SC-04 — L'absence de hit doit se prouver**
> **Étant donné** une liste en version V et un portefeuille de N clients
> **Quand** le screening s'exécute et ne produit aucun hit
> **Alors** une trace de passage est enregistrée : périmètre, version de liste, horodatage, seuil,
>   réglage du pré-filtre
> **Et** cette trace est rejouable à date (R49)
> **Quand** l'inspecteur demande « cette inscription a-t-elle été confrontée à votre base, et quand ? »
> **Alors** la réponse est lisible sans reconstruction

---

## Ce que ces règles impliquent, techniquement

| Règle | Conséquence sur le modèle |
|---|---|
| R100 | table `screening_hit` : client, entrée, score, **version de liste**, horodatage, statut `BRUT` |
| R101 | table `screening_qualification` : hit, verdict, **motif** (référentiel R7), auteur, horodatage |
| R102 | la whitelist référence **(entrée, version)** — jamais l'entrée seule. Un hash de l'entrée détecte le changement |
| R103 | table `screening_run` : périmètre, liste + version, horodatage, seuil, réglage du pré-filtre, nb de hits |

Rien de tout cela n'est spécifique au screening : c'est le moteur existant (événement tracé, motif
obligatoire, date d'effet, rejeu) appliqué à un déclencheur de plus. **C'est bien le signe que
l'architecture tient.**

---

## Décision rendue

**RATIFIÉ** le 15.07.2026 par Ali Gharsallah, sans amendement. Les scénarios SC-01..SC-04 rejoignent le
corpus exécutable. Le code s'écrit après — et il a été écrit après.
