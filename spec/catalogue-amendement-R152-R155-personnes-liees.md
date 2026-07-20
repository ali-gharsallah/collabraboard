# Catalogue O-Live — Amendement PROPOSÉ (R152 → R155) · Bloc 28 « Les personnes liées — le lien est un acte »

**Statut : RATIFIÉ le 20.07.2026 par Ali Gharsallah.**
Numérotation continue après R151. Famille de scénarios : **PL** (vérifiée libre — Word v4.10 + spec).
**Le catalogue précède le code.** Origine : demande d'Ali — le processus « ajouter une personne
et son lien » (KYC, onboarding, fiche personne) est ambigu ; il devient UN GESTE : bouton →
popup → chercher-ou-créer → boutons de rôles **cumulables**. Ancrage : spec produit §6
(rôles officiels personne↔entité/compte · relations non officielles bijectives).

## R152 — Le lien se pose par un geste habilité — paramétrable, tracé

Ajouter (ou retirer) un lien exige un droit du **registre R-Q** : `lienRolesOfficiels`
(défaut `["CO","CF","RM"]`) pour les rôles juridiquement opposables, `lienRolesNonOfficiels`
(défaut `["RM","CO","CF"]`) pour les relations RM. Default-deny, tentative refusée **tracée**
(mécanique R112). Chaque pose/retrait est un événement (auteur jeton) ; le retrait se motive (R7).

> **Scénario PL-01 — Habilité pose, non-habilité tracé**
> **Quand** un rôle hors registre tente de lier **Alors** refus + tentative tracée
> **Quand** le CO lie **Alors** lien posé, événement (auteur, type, cible)

## R153 — Les types de liens sont un RÉFERENTIEL — extensible tenant, cumulable, sans doublon

Les types viennent du registre (`lienTypes`), **semé** des défauts de la spec §6.2/6.3 :
officiels (settlor/fondateur, trustee, protecteur, bénéficiaire, membre du conseil, UBO,
détenteur du contrôle, titulaire, co-titulaire, fondé de pouvoir — power of attorney, power of
information, signataire autorisé, administrateur, apporteur d'affaires, conseiller externe) et
non officiels (père/mère de, fils/fille de, époux·se de, frère/sœur de, associé de…). Un type
hors référentiel = refus. Le **CUMUL est la règle** (une personne = plusieurs rôles sur la même
cible) ; le doublon exact (même personne, même type, même cible) est refusé.

> **Scénario PL-02 — Cumul oui, doublon non, hors-référentiel non**
> **Quand** le CO pose TRUSTEE puis SIGNATAIRE sur la même personne/compte **Alors** 2 liens
> **Quand** il repose TRUSTEE **Alors** refus (doublon) **Quand** type « GOUROU » **Alors** refus

## R154 — La relation non officielle est BIJECTIVE — l'inverse est automatique, atomique

Poser « X père de Y » pose **dans la même transaction** « Y fils/fille de X » (table d'inverses
au référentiel, symétriques auto-inverses : époux·se, frère/sœur, associé). UN événement pour
la paire. Retirer l'une retire l'autre — motivé (R7). Jamais de demi-lien.

> **Scénario PL-03 — Le miroir existe dès la pose, disparaît au retrait**
> **Quand** « père de » est posé X→Y **Alors** « fils/fille de » existe Y→X, un seul événement
> **Quand** le lien est retiré (motivé) **Alors** les DEUX côtés disparaissent, retrait tracé

## R155 — Chercher-ou-créer — jamais de doublon silencieux, jamais de fiche muette

Le geste unique : **chercher** la personne (nom) ; si elle existe, la lier ; sinon **créer
minimal** (nom, physique/morale) puis lier — même transaction. À la création, une **détection
d'homonymie** signale (n'empêche pas — R39 : le système signale, l'humain décide) et une
**tâche de complétion** est ouverte (une fiche minimale n'est pas une fiche finie). Tout tracé.

> **Scénario PL-04 — Exister = lier ; créer = signaler + compléter**
> **Quand** la personne existe **Alors** liée sans création
> **Quand** elle n'existe pas **Alors** créée minimale + liée + tâche de complétion
> **Quand** un homonyme existe **Alors** création acceptée AVEC signal d'homonymie tracé

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Modèle | `PersonneLien` (tenantId, personneId, cibleType `COMPTE|KYC|PERSONNE`, cibleId, typeCode, categorie `OFFICIEL|NON_OFFICIEL`, paireId nullable — R154, posePar/At) — RLS |
| Service | `PersonneLienService(prisma, audit)` : `lier` (R152/R153/R154), `retirer` (R7/R154), `chercherOuCreerEtLier` (R155), `typesDisponibles` (référentiel servi à l'UI — les BOUTONS du popup) |
| Paramètres R-Q | **au registre (R125)** : `lienRolesOfficiels` · `lienRolesNonOfficiels` · `lienTypes` (json, semé spec §6.2/6.3 avec inverses) |
| Événements | `personne.lien.pose` · `personne.lien.retrait` · `personne.lien.acces.refuse` · `personne.creee.minimale` · `personne.homonymie.signal` · `tache.personne.completion` |
| **UI (livrée en démo)** | `LierPersonnePopup` — bouton « ＋ Lier une personne » → recherche live sur PERSONS_DATA → sélection OU création → **boutons-bascules de rôles par catégorie** (cumul) → « Attribuer ». Monté sur l'écran Personnes ; composant réutilisable au KYC/onboarding (câblage documenté) |

Tests : PL-01..04 + gardes (`personne-lien.wiring.spec.ts`), écrits **avant** l'implémentation.

`RATIFIÉ le 20.07.2026 par Ali Gharsallah`
