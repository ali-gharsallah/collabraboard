# Catalogue O-Live — Amendement PROPOSÉ (R109 → R112) · Bloc 18 « GED — documents & preuve »

**Statut : RATIFIÉ le 19.07.2026 par Ali Gharsallah.**
Numérotation continue après **R108**. Famille de scénarios : **GD** (vérifiée libre — spec md + Word v4).
**Le catalogue précède le code.**

## Le problème

Le backend a un modèle `Document` plat (un enregistrement = un fichier, sha256, rétention) et la
démo un écran GED complet — mais **aucune règle** : pas de versioning normé (le « nouveau
passeport » de P-01 écrase quoi ?), pas de péremption par type de document, pas de définition de
la complétude documentaire aux points de passage (validation KYC exige quoi ?), pas d'accès tracé.
Pour une banque, la GED **est** la preuve : ces quatre règles la mettent sous discipline.

---

## R109 — Le document est versionné, jamais supprimé

Un document est un **objet unique** rattaché (client, et optionnellement KYC ou personne), porteur
de **versions append-only** : déposer un nouveau fichier sur un document existant crée la version
n+1 ; toutes les versions restent restituables (conservation LBA — cohérence R35). Il n'existe
**aucune suppression physique** : le retrait est un **archivage logique motivé** (R7) et tracé
(auteur = jeton), le document reste restituable pour l'autorité.

> **Scénario GD-01 — Le nouveau passeport ne remplace pas, il succède**
> **Étant donné** un document PASSEPORT en version 1
> **Quand** un nouveau fichier est déposé sur ce document
> **Alors** la version 2 est créée (empreinte, déposant = jeton, horodatage)
> **Et** la version 1 reste consultable, le registre des versions est append-only
> **Et** un événement `ged.version.creee` est émis

> **Scénario GD-02 — L'archivage se motive, la restitution survit**
> **Étant donné** un document actif
> **Quand** son archivage est demandé sans motif
> **Alors** le système refuse (R7)
> **Quand** il est demandé avec motif
> **Alors** le statut passe ARCHIVE (motif + auteur jeton tracés) et le document RESTE restituable

## R110 — Péremption par type, complétude aux points de passage

Chaque **type de document** du référentiel tenant porte une durée de validité
(`Tenant.settings.gedDocTypes[]` : code, validité en mois, requis pour quels passages — voie R-Q).
L'expiration est **constatée** par le tick : événement `ged.expiration.detectee` + tâche de
renouvellement — elle ne bloque rien en continu (R39). La **complétude**, elle, se vérifie **aux
points de passage** (validation KYC, décision d'Account Review) : la liste des types requis
manquants ou expirés est retournée au moteur, qui applique son blocage à lui (même mécanique que
les questions REQUIRED).

> **Scénario GD-03 — L'expiration alerte, elle ne bloque pas**
> **Étant donné** un extrait de registre valable 12 mois, déposé il y a 13 mois
> **Quand** le tick de péremption passe
> **Alors** `ged.expiration.detectee` est émis + une tâche de renouvellement — UNE fois
> **Et** aucun dossier n'est bloqué par le tick lui-même

> **Scénario GD-04 — La complétude se vérifie au passage, pas dans le vide**
> **Étant donné** un KYC dont le passage exige PASSEPORT + FORM_CDB, avec un FORM_CDB absent et un
> PASSEPORT expiré
> **Quand** la complétude est vérifiée pour ce passage
> **Alors** la réponse liste les manquants (FORM_CDB) et les expirés (PASSEPORT), tracée
> **Et** c'est le moteur appelant (validation KYC) qui bloque — la GED constate

## R111 — L'intégrité se prouve à la restitution

Chaque version porte l'**empreinte SHA-256** calculée au dépôt. Toute restitution recalcule et
confronte : une divergence est une **altération détectée** — événement + refus de servir le
contenu comme authentique. Les métadonnées de dépôt (déposant, horodatage, empreinte) sont
immuables (registre append-only, R48).

> **Scénario GD-05 — L'altération ne passe pas inaperçue**
> **Étant donné** une version déposée avec son empreinte
> **Quand** la restitution vérifie un contenu conforme
> **Alors** la restitution est servie avec la preuve d'intégrité
> **Quand** le contenu a été altéré (empreinte divergente)
> **Alors** `ged.integrite.alerte` est émis et la restitution est refusée comme authentique

## R112 — L'accès aux documents est habilité et tracé

La consultation d'un document est soumise aux **rôles autorisés du type** (référentiel tenant,
default-deny — même doctrine que le contrôle d'accès KYC) et **chaque consultation est un
événement** : qui (jeton), quand, quel document, quelle version. L'inspecteur peut rejouer
« qui a vu quoi » (R48/R49).

> **Scénario GD-06 — Qui a vu quoi, prouvable**
> **Étant donné** un type FISCAL restreint aux rôles CO et CF
> **Quand** un RM tente de le consulter
> **Alors** l'accès est refusé (default-deny) ET le refus est tracé
> **Quand** un CO le consulte
> **Alors** `ged.acces` trace lecteur (jeton), document et version

---

## Ce que ces règles impliquent, techniquement

| Point | Conséquence |
|---|---|
| Modèles | `Document` (+ `personId?`, `kycFileId?`, `typeCode`, archivage motivé) · **`DocumentVersion`** (numero, sha256, deposePar, deposeAt — append-only, trigger R48) |
| Service | `GedService` : `deposer` (R109/R111), `archiver` (R109), `tickPeremptions` (R110), `verifierCompletude` (R110), `restituer` (R111/R112) |
| Paramètres R-Q | `Tenant.settings.gedDocTypes[]` : `{ code, validiteMois, requisPour[], rolesAutorises[] }` — défauts : ID/PASSEPORT 120 mois, REGISTRE 12, FORM_CDB sans péremption, FISCAL restreint CO/CF |
| Événements | `ged.version.creee` · `ged.archive` · `ged.expiration.detectee` · `tache.ged.renouvellement` · `ged.completude.verifiee` · `ged.integrite.alerte` · `ged.acces` |
| RLS / immuabilité | `document_versions` rejoint la boucle RLS **et** la liste append-only de post-deploy-v2 |
| Liens | P-01 (tâche `maj_ged` du CoC) cible désormais un dépôt R109 ; la validation KYC appelle `verifierCompletude` (R110) |

Tests exécutables : `GD-01..06` (`ged.wiring.spec.ts`). Écrits **avant** l'implémentation.

`RATIFIÉ le 19.07.2026 par Ali Gharsallah`
