# Catalogue O-Live — Amendement (R113 → R116) · Bloc 18 « GED — documents & preuve » (extension)

**Statut : RATIFIÉ le 19.07.2026 par Ali Gharsallah (séance tenante).**
Numérotation continue après R112. Scénarios : **GD-07 → GD-14** (continuation de la famille GD).
Méthode inchangée : scénarios ci-dessous → tests exécutables → code. Les fournisseurs externes
(TSA horodatage, QES, IA) sont des **ports** : le moteur définit le contrat, l'intégration
(Swisscom AIS, Skribble…) est un adaptateur de Phase 2.

---

## R113 — Ancrage : l'intégrité devient une antériorité opposable

R111 prouve qu'un contenu n'a pas changé ; R113 prouve **depuis quand**. Un tick quotidien
construit la **racine de Merkle** des empreintes de versions non encore ancrées et la fait
horodater par un tiers qualifié (RFC 3161 / ZertES — port TSA). Chaque version conserve sa preuve
d'appartenance (chemin de Merkle) ; toute restitution peut produire « ce document, dans cet état,
existait avant telle date », vérifiable sans faire confiance à O-Live.

> **Scénario GD-07 — Le lot du jour s'ancre, une fois**
> **Étant donné** trois versions déposées non ancrées
> **Quand** le tick d'ancrage passe
> **Alors** un lot est créé (racine de Merkle + jeton d'horodatage du TSA), événement `ged.ancrage.cree`
> **Et** les trois versions référencent le lot ; un second tick sans nouveau dépôt ne crée rien

> **Scénario GD-08 — La preuve d'appartenance se vérifie, la falsification échoue**
> **Étant donné** une version ancrée
> **Quand** sa preuve de Merkle est vérifiée contre la racine du lot
> **Alors** la vérification passe
> **Et** la même preuve appliquée à une empreinte étrangère échoue

## R114 — Signature électronique qualifiée : la signature est une version

La signature qualifiée (QES, équivalent manuscrit — ZertES) d'un document produit une **nouvelle
version** (succession R109) : contenu signé, empreinte propre, référence de preuve du prestataire,
signataire explicite. La version non signée reste consultable. Sans prestataire configuré, la
demande est refusée proprement — jamais de signature simulée.

> **Scénario GD-09 — Le formulaire CDB se signe en version n+1**
> **Étant donné** un FORM_CDB en version 1 et un prestataire QES configuré
> **Quand** la signature qualifiée est demandée pour un signataire
> **Alors** la version 2 est créée (empreinte du contenu signé, référence de preuve, signataire)
> **Et** `ged.signature.qualifiee` est émis ; la version 1 reste consultable

> **Scénario GD-10 — Pas de prestataire, pas de simulacre**
> **Étant donné** aucun prestataire QES configuré
> **Quand** une signature est demandée
> **Alors** le refus est explicite — aucune version, aucun événement de signature

## R115 — Rétention gouvernée : la destruction se décide, le hold gèle tout

L'échéance de rétention (LBA — `retentionUntil` du document) fait **proposer** la destruction
(événement + tâche, une fois) — jamais l'exécuter (doctrine R33/R44). La destruction est une
décision humaine motivée (R7) : le **contenu** est purgé, les **métadonnées et les empreintes
restent** (certificat de destruction — on prouve ce qui a existé et quand il a été détruit, par
qui, pourquoi). Un **legal hold** posé sur un client gèle proposition ET destruction jusqu'à sa
levée motivée.

> **Scénario GD-11 — L'échéance propose, ne détruit pas**
> **Étant donné** un document dont la rétention est échue
> **Quand** le tick de rétention passe
> **Alors** `ged.destruction.proposee` + tâche — UNE fois — et rien n'est détruit

> **Scénario GD-12 — La destruction certifiée conserve la preuve**
> **Quand** la destruction est décidée sans motif **Alors** refus (R7)
> **Quand** elle est décidée avec motif
> **Alors** statut DETRUIT, certificat `ged.destruction.certifiee` (empreintes conservées, auteur =
> jeton), le registre des versions et leurs sha256 SUBSISTENT

> **Scénario GD-13 — Le legal hold gèle tout**
> **Étant donné** un legal hold actif sur le client
> **Alors** le tick ne propose pas, et la destruction est refusée avec le motif du hold
> **Et** la levée du hold exige un motif et un auteur tracés

## R116 — Classification IA-assistée : l'IA propose, l'humain applique

À réception d'un contenu, l'IA (port — R44) peut proposer type de document et date d'expiration
détectée. La proposition est un **événement**, jamais une application : le type ne change que par
confirmation humaine tracée. Sans port IA, la fonction est simplement absente.

> **Scénario GD-14 — La proposition n'applique rien**
> **Étant donné** un port IA configuré proposant REGISTRE + expiration détectée
> **Quand** la classification est demandée puis confirmée par un humain
> **Alors** `ged.classification.proposee` (IA) précède `ged.classification.confirmee` (jeton)
> **Et** entre les deux, le type du document est resté inchangé

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Modèles | `AnchorBatch` (racineMerkle, jeton TSA, at) · `DocumentVersion` +`anchorBatchId?`, +`merkleProof?`, +`signature?` (Json) · `Document` +`legalHold`/`holdMotif`, +statut `DETRUIT`, +`destructionMotif/Par/At` · `retentionUntil` existant réutilisé |
| Service | `GedAvanceService` (ports injectés : tsa, qes, ia) : `tickAncrage`, `verifierPreuve`, `demanderSignature`, `tickRetention`, `detruire`, `poserHold`/`leverHold`, `classifier`/`confirmerClassification` |
| Merkle | feuilles = sha256 des versions, appariement sha256(gauche+droite), impair → duplication du dernier ; preuve = chemin {hash, côté} |
| RLS / append-only | `anchor_batches` rejoint la RLS ; reste append-only pur (jamais d'UPDATE) |
| Événements | `ged.ancrage.cree` · `ged.signature.qualifiee` · `ged.destruction.proposee/certifiee` · `ged.hold.pose/leve` · `ged.classification.proposee/confirmee` |

Tests : GD-07..14 (`ged-avance.wiring.spec.ts`) — écrits avant le code, ports factices.
