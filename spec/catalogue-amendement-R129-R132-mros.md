# Catalogue O-Live — Amendement PROPOSÉ (R129 → R132) · Bloc 22 « Communication MROS — art. 9 LBA »

**Statut : RATIFIÉ le 19.07.2026 par Ali Gharsallah.**
Numérotation continue après R128. Famille de scénarios : **MR** (vérifiée libre — Word + spec).
**Le catalogue précède le code.**

## Le problème — le dernier grand workflow sans règles

L'AML détecte (R80-R82), les risk cases instruisent (R83), mais **la fin du chemin — communiquer
au MROS — n'a aucune règle**. Or c'est le point le plus exposé juridiquement de toute la
plateforme : art. 9 LBA (obligation de communiquer en cas de soupçon fondé), art. 10 (blocage
des avoirs), art. 10a (interdiction d'informer). Une plateforme AML qui ne gouverne pas sa
propre sortie MROS est une voiture sans freins. Quatre règles — et, discipline R125 oblige, les
nouveaux paramètres entrent **au registre R-Q**, jamais en sauvage.

**Limite assumée (écart signalé, pas caché)** : le registre des risk cases (R83) n'a pas encore
de service backend — la communication porte une référence `riskCaseId` opaque ; la garde
« décision depuis un cas ESCALADÉ seulement » sera câblée quand le bloc risk cases atterrira
(candidat R133+).

---

## R129 — La décision de communiquer est humaine, motivée — et la non-communication aussi

Seul un **rôle habilité** (paramètre tenant `mrosRolesHabilites`, défaut `["MLRO"]`) peut
décider `COMMUNIQUER` ou `NE_PAS_COMMUNIQUER`. Dans **les deux cas**, motif obligatoire (R7) et
décision tracée (jeton) : la non-communication motivée est une exigence d'audit au même titre
que la communication — c'est elle qu'un inspecteur regarde en premier. Le système et l'IA ne
déclenchent **jamais** (R44) ; ils préparent.

> **Scénario MR-01 — Le rôle habilité décide, motivé**
> **Quand** un RM tente de décider **Alors** refus (rôle non habilité, paramètre R-Q)
> **Quand** le MLRO décide COMMUNIQUER sans motif **Alors** refus (R7)
> **Quand** il décide motivé **Alors** la décision est tracée et le dossier de communication naît

> **Scénario MR-02 — Ne pas communiquer se motive aussi**
> **Quand** le MLRO décide NE_PAS_COMMUNIQUER avec motif
> **Alors** la décision est tracée à l'identique — l'audit de l'abstention existe

## R130 — Le dossier de communication : des références figées, opposables byte par byte

La communication **assemble des références** (signaux, transactions au motif, extraits KYC,
documents GED : IDs + **empreintes SHA-256**), jamais des copies libres. Le dossier est **figé**
à la décision : empreinte d'ensemble calculée, contenu append-only (R48). Ce qui a été transmis
au MROS se **relit à l'identique** (R49) — sans reconstruction.

> **Scénario MR-03 — Le dossier se fige et se relit tel quel**
> **Étant donné** une communication décidée avec 3 pièces référencées
> **Alors** chaque pièce porte type + id + empreinte, et le dossier une empreinte d'ensemble
> **Quand** on le relit **Alors** il est identique — et toute tentative de modification est refusée

## R131 — Le gel d'avoirs (art. 10) : posé par l'humain, appliqué par le moteur, jamais levé seul

La **notification du MROS** (transmission à l'autorité / non-transmission) se saisit. Sur
notification de transmission, le **gel des avoirs** est posé par décision humaine tracée, avec
**échéance légale surveillée** (`mrosGelJoursOuvrables`, défaut 5). Pendant le gel, le moteur
**bloque les transactions** du client (contrainte structurelle type R13 — c'est un vrai blocage
réglementaire, pas un SLA). L'échéance **alerte une fois** (R39) ; la levée est **explicite et
motivée** — jamais automatique.

> **Scénario MR-04 — Le gel bloque, la levée est un acte**
> **Étant donné** un gel posé sur notification de transmission
> **Quand** une transaction du client est vérifiée **Alors** elle est BLOQUÉE (motif : gel art. 10)
> **Quand** le gel est levé motivé **Alors** les transactions repassent, levée tracée

> **Scénario MR-05 — L'échéance alerte, ne lève pas**
> **Étant donné** un gel dont l'échéance est dépassée
> **Quand** le tick passe **Alors** alerte UNE fois — le gel RESTE actif (la levée est humaine)

## R132 — L'interdiction d'informer (art. 10a) : default-deny et accès tracés

La communication n'est **visible qu'aux rôles habilités** (default-deny, même mécanique que
R112) ; tout accès — accordé **ou refusé** — est tracé : « qui a tenté de voir quoi » fait
partie du dossier. Le client, le RM, les exports client-facing **n'en voient jamais
l'existence** : la garde de visibilité est structurelle, pas une convention d'écran.

> **Scénario MR-06 — Le RM ne voit rien, et sa tentative se voit**
> **Quand** un RM tente de lire la communication **Alors** refus (default-deny) + accès refusé tracé
> **Quand** le MLRO la lit **Alors** servie, lecture tracée

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Modèle | `MrosCommunication` (tenantId, riskCaseId, clientId, decision, motif, decidePar/At, pieces Json [{type,id,sha256}], dossierSha256, notification?, gelActif, gelEcheance, gelPosePar/LevePar+motifs) — **append-only sur le dossier** (les champs de gel évoluent, les pièces jamais) |
| Service | `MrosService(prisma, audit)` : `decider` (R129/R130 — fige et empreinte), `relire` (R130), `saisirNotification` + `poserGel` / `leverGel` + `verifierTransaction` (R131 — le moteur transactions appelle, pattern R110) + `tickGel` (R39), `lire` (R132, default-deny tracé) |
| Paramètres R-Q | **au registre (R125)** : `mrosRolesHabilites` (json, `["MLRO"]`, R129/R132) · `mrosGelJoursOuvrables` (int, 5, R131) |
| Événements | `mros.decision` · `mros.notification` · `mros.gel.pose` · `mros.gel.echeance` · `mros.gel.leve` · `mros.acces.refuse` · `mros.acces` |
| RLS / append-only | `mros_communications` : RLS ; immuabilité des pièces garantie par le service (le gel évolue) |

Tests : MR-01..06 (`mros.wiring.spec.ts`). Écrits **avant** l'implémentation. Réflexes appliqués :
statuts/contrats copiés des sources, jamais de mémoire.

`RATIFIÉ le 19.07.2026 par Ali Gharsallah`
