# Données de screening — développement & tests

**Trois jeux, une vérité terrain, deux bancs de mesure.** Tout est synthétique, déterministe
(graine `20260715`), et **structuré comme ce que vendent les providers** — structure seulement,
aucune donnée sous licence, aucune personne réelle.

```bash
npm run screening:data    # régénère les 4 fichiers
npm run screening:bench   # cas durs (golden set)
node services/screening/bench-portefeuille.mjs   # 2 000 clients × toutes les listes
```

## Les fichiers

| Fichier | Contenu |
|---|---|
| `sanctions-synth.json` | **625 entrées** : 420 personnes, 126 entités, 20 navires, 59 **SCO** (règle des 50 %), 24 radiées |
| `pep-synth.json` | **380 PEP** (22 catégories d'occupation, niveaux national/régional/local/international, actuels & anciens) + **109 RCA** (proches & associés, liés à leur PEP) + **60 SIP** (intérêt spécial / crime) |
| `clients-synth.json` | **2 000 clients** + la **vérité terrain** : hits plantés (vrais, translittérés, quasi-homonymes) |
| `golden-set.json` | **127 cas** avec réponse attendue — le juge du moteur |

## Fidélité aux feeds commerciaux

Vérifié par recherche (Dow Jones R&C, World-Check, ComplyAdvantage) le 15.07.2026 :

- **catégories** : Sanctions · PEP · RCA · SIP/SIE · SCO (entités détenues ≥ 50 % par un sanctionné)
- **identifiants multiples** : alias **typés** (AKA/FKA) avec **qualité** (strong/weak), nom en **script original**,
  dates de naissance **multiples** et parfois **partielles** (année seule), lieu de naissance, genre,
  nationalités, adresses, documents d'identité (passeport, registre du commerce)
- **PEP** : catégorie d'occupation, fonction, pays, niveau, dates début/fin, statut actuel/ancien
- **sanctions** : programme + base légale + autorité, date d'inscription, remarques, statut actif/radié

## Ce que les bancs ont révélé — cinq défauts, tous dans MON travail

1. **Les alias venaient de la liste** → le cas « translittération » testait la lecture d'un champ, pas le rapprochement.
2. **Les noms n'étaient pas uniques** → le cas « homonyme → ne doit pas matcher » était faux.
3. **Les vrais hits avaient une date de naissance aléatoire** → c'étaient des homonymes par construction ; le rappel mesuré ne voulait rien dire.
4. **Des hits « personne » étaient plantés sur des clients sociétés** (« Nikolay Volkov » de type SA).
5. **Le moteur ignorait l'IDF** → « Keller Invest » → « Petrov Invest » à 88, parce que « Invest » comptait autant qu'un patronyme.

*Un jeu de test se teste. Un moteur se mesure. Sans les deux, on ne sait rien.*

---

## Le pré-filtre (`blocking.mjs`)

Le banc portefeuille l'a prouvé nécessaire : **15 ms par client** en force brute → contre un feed réel
de 2 M d'entrées, **362 heures** pour 50 000 clients. Impraticable.

Index inversé de **trigrammes** (pas la première lettre : « Volkov » et « Wolkow » ne partagent pas
leur initiale, mais partagent « olk »). On n'interroge que les trigrammes **les plus rares** de la requête.

```
                    │ force brute │ pré-filtre │ gain
temps total         │    31894 ms │    1252 ms │ ×25.5
entrées comparées   │     2348000 │      69164 │ ×34
candidats / client  │        1174 │         35 │
vrais positifs      │          40 │         40 │
vrais positifs PERDUS : 0
```

**Le seul chiffre qui compte est le dernier.** Un pré-filtre qui gagne du temps en perdant des vrais
positifs rate **en silence** — c'est pire que pas de pré-filtre.

### ⚠ Deux honnêtetés sur cette mesure

1. **L'extrapolation du pré-filtre est refusée.** Multiplier 0,59 ms par (2 M / 1 174) donnerait un
   chiffre faux — et flatteur : le score fin est borné par le plafond de candidats, il ne croît pas
   avec le feed, mais l'index, lui, croît. Seule une liste de taille réelle donnera le vrai chiffre.
2. **Zéro perte, même à minPartages = 5** (10 candidats par requête). C'est trop beau : cela en dit
   plus sur la taille de la liste (1 174) que sur le pré-filtre. À cette échelle, les trigrammes rares
   désignent la cible presque à coup sûr. **Ce pré-filtre est prometteur, pas validé.**

### Et le réglage du pré-filtre est, lui aussi, un paramètre à instruire

`minPartages`, `maxTrigrammes`, `plafond` : trois nombres qui décident de ce qu'on ne verra jamais.
Même problème que les seuils AML, même réponse — on ne les fixe pas à l'aveugle, on mesure ce qu'ils
font perdre. C'est un bac à sable de plus.

---


**Aucune personne réelle. Aucune donnée sous licence.** Tout est synthétique et déterministe
(graine `20260715`) : même graine → même jeu → tests reproductibles et chiffres comparables dans le temps.

```bash
node services/screening/generate.mjs   # régénère les fixtures
node services/screening/bench.mjs      # juge un moteur contre le golden set
```

## Deux fichiers, deux natures — ne pas les confondre

| Fichier | Ce que c'est | À quoi ça sert |
|---|---|---|
| `fixtures/sanctions-synth.json` | fausse liste consolidée (180 entrées), structurée comme SECO/UE/ONU/OFAC | développer sans licence |
| `fixtures/golden-set.json` | 106 cas **avec la réponse attendue** | **juger** le moteur |

Un jeu de données sans réponses attendues ne teste rien. C'est le golden set qui fait le travail.

## Ce que le golden set couvre

| Catégorie | Cas | Doit matcher ? | Pourquoi c'est là |
|---|---|---|---|
| `exact` | 12 | oui | le minimum vital |
| `alias_connu` | 10 | oui | cas facile : l'alias est dans la liste |
| `translitteration_hors_liste` | 18 | oui | **le vrai test** : « Mohamad » quand la liste dit « Muhammad » et ne connaît pas cette variante |
| `ordre_nom` | 10 | oui | « Volkov Dmitri » vs « Dmitri Volkov » |
| `typo` | 10 | oui | une lettre manquante |
| `diacritiques` | 6 | oui | Müller / Muller |
| **`homonyme`** | 15 | **non** | même nom, date incompatible — **le cas le plus important** |
| `proche_non_liste` | 5 | **non** | ressemble, mais n'est pas |
| `entite_forme` | 10 | oui | « X Trading » vs « X Trading SA » |
| `client_ordinaire` | 10 | **non** | le volume normal d'une banque |

**Les 30 cas « ne doit PAS matcher » sont la moitié qui compte.** Sans eux, un moteur qui répond « oui » à
tout obtiendrait 100 % de rappel.

## Deux défauts que le banc a révélés — dans le jeu, pas dans le moteur

1. **Les alias étaient tirés de la liste.** Le cas « translittération » testait la capacité à lire un champ
   `alias`, pas à rapprocher. Corrigé : les variantes utilisées ne figurent nulle part dans la liste.
2. **Les noms n'étaient pas uniques.** Trente doublons sur soixante-dix-huit : le cas « homonyme → ne doit pas
   matcher » était donc faux, puisqu'une autre entrée du même nom matchait légitimement. Corrigé : unicité imposée.

*Un jeu de test se teste aussi. Le banc est ce qui le prouve.*

## La ligne de base

`baseline-engine.mjs` — normalisation (diacritiques, ponctuation, formes juridiques), tri des jetons,
Jaro-Winkler, discriminants de **type** et de **date de naissance**. Volontairement simple : son rôle
n'est pas d'être bon, mais de donner un point de comparaison chiffré. Tout moteur ultérieur
(pg_trgm, phonétique, fournisseur commercial) se juge contre ces chiffres.

Sa faiblesse connue : **4 typos ratés sur 10** à 85 — Jaro-Winkler sur jetons triés encaisse mal une
lettre manquante au milieu d'un nom. C'est là qu'un algorithme phonétique ou des n-grammes gagneraient.

## Ce que le banc produit — et pourquoi ça vaut de l'or

Le tableau rappel / précision par seuil **est** la matière du bac à sable de screening :

> « Abaisser le seuil de 85 à 75 : +1 vrai positif retrouvé, +4 faux positifs à qualifier. »

Aucune banque ne peut dire ça aujourd'hui. Toutes règlent ce seuil à l'aveugle.
