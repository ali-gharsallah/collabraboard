# Catalogue O-Live — Amendement PROPOSÉ (R148 → R151) · Bloc 27 « La recherche — trouver sans trahir »

**Statut : RATIFIÉ le 20.07.2026 par Ali Gharsallah.**
Numérotation continue après R147. Famille de scénarios : **RS** (vérifiée libre — Word v4.10 + spec).
**Le catalogue précède le code.** Origine produit : écart Therefore n° 2 (recherche plein texte).

## Le problème

Therefore indexe tout et cherche partout — et c'est précisément le danger en banque privée :
une recherche est le moyen le plus rapide de **fuiter l'existence** d'un document qu'on n'a pas
le droit de voir. Quatre règles font une recherche qui trouve **sans trahir** : l'index est un
dérivé rejouable (jamais une vérité), l'habilitation s'applique au **résultat**, la trace est
systématique, et l'index suit la vie du document jusqu'à sa destruction.

**Aucun paramètre tenant nouveau** — la recherche ne se paramètre pas, elle s'habilite : elle
hérite intégralement des registres existants (types R112, arrivée R139).

---

## R148 — L'index est un DÉRIVÉ rejouable — jamais une vérité

L'index plein texte se construit **depuis les dérivés OCR (R138) et les métadonnées** ; chaque
entrée porte la référence (document, version) et **l'empreinte du dérivé source** — jamais un
contenu faisant foi (la vérité reste l'original au coffre, R144/R109). L'index entier est
**rejouable** : sa reconstruction complète depuis la base produit des entrées d'empreintes
identiques. Il peut brûler sans perte.

> **Scénario RS-01 — L'entrée référence, la reconstruction reproduit**
> **Quand** une version OCRisée est indexée **Alors** l'entrée porte (documentId, versionId,
> empreinte du dérivé) — pas de vérité propre
> **Quand** l'index est reconstruit de zéro **Alors** les empreintes sont IDENTIQUES

> **Scénario RS-02 — La désynchronisation se détecte, ne se répare pas seule**
> **Étant donné** une entrée d'index dont le document a disparu hors flux
> **Quand** la réconciliation passe **Alors** alerte UNE fois (R39) — l'index n'est pas purgé
> en silence (un écart d'index est un fait d'audit, pattern R147)

## R149 — L'habilitation s'applique AU RÉSULTAT — l'existence même ne fuite pas

Chaque hit est filtré par les droits du chercheur **au moment de la recherche** : rôle autorisé
sur le TYPE du document (R112), et documents `A_CLASSER` cherchables par les seuls rôles
d'arrivée (R139). Un document hors droits **n'apparaît pas** — ni contenu, ni titre, ni
compteur : **l'existence est une information**. Le refus n'est pas une erreur : c'est un
résultat plus court.

> **Scénario RS-03 — Deux chercheurs, deux mondes**
> **Étant donné** un doc PASSEPORT (RM/CO/CF) et un doc FISCAL (CF seul), tous deux contenant « Dupont »
> **Quand** le CF cherche « dupont » **Alors** 2 résultats
> **Quand** le RM cherche « dupont » **Alors** 1 résultat — le FISCAL n'existe pas pour lui
> **Et** un document A_CLASSER contenant « dupont » n'apparaît que pour les rôles d'arrivée

## R150 — La recherche est tenant-scopée structurellement — et tracée

L'entrée d'index porte le tenant ; la requête d'un tenant ne rencontre **structurellement** que
son index (pattern R146). Chaque recherche est **tracée** : auteur (jeton), requête, nombre de
résultats servis — jamais les contenus. Qui cherche quoi fait partie du dossier de la banque.

> **Scénario RS-04 — La trace dit qui cherche, pas ce qui fut lu**
> **Quand** le CO cherche « dupont » **Alors** événement (auteur, requête, nb servis), SANS contenus
> **Quand** t2 cherche « dupont » **Alors** 0 résultat — structurel, pas filtré

## R151 — L'index suit la vie du document — jusqu'à l'oubli certifié

Le classement (R139) déclenche l'indexation ; une **nouvelle version OCRisée remplace** l'entrée
servie (on cherche l'état courant — l'historique se lit sur le document, pas dans l'index). La
**destruction certifiée (R115) retire** de l'index : un contenu détruit ne se cherche plus —
le retrait est tracé, l'empreinte survit en base (R146).

> **Scénario RS-05 — L'index sert l'état courant**
> **Quand** la v2 OCRisée est indexée **Alors** la recherche sert la v2 — une seule entrée par document

> **Scénario RS-06 — Détruit = introuvable, et le retrait est un événement**
> **Quand** la destruction certifiée passe **Alors** l'entrée est retirée, retrait tracé,
> la recherche ne trouve plus rien — l'empreinte, elle, survit en base

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Modèle | `SearchEntry` (tenantId, documentId UNIQUE par tenant, versionId, texte, shaDeriveSource, typeCode, statut, indexeAt) — RLS |
| Service | `RechercheService(prisma, audit)` : `indexer` (R148/R151 — depuis dérivés OCR + méta, remplace l'entrée du document), `chercher` (R149/R150 — filtre par droits AU résultat, trace), `retirer` (R151 — destruction), `reindexerTout` (R148 — rejouabilité), `reconcilierIndex` (R148/R39) |
| Paramètres R-Q | **aucun nouveau** — hérite de `gedDocTypes` (R112) et `gedInboxRoles` (R139) |
| Événements | `recherche.executee` · `recherche.index.entree` · `recherche.index.retrait` · `recherche.index.desync` |
| Câblage (documenté, lots suivants) | `classer` (R139) → `indexer` ; `ocriser` (R138) → `indexer` ; destruction (R115) → `retirer` |

Tests : RS-01..06 (`recherche.wiring.spec.ts`), écrits **avant** l'implémentation.

`RATIFIÉ le 20.07.2026 par Ali Gharsallah`
