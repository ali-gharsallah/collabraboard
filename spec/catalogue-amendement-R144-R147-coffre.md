# Catalogue O-Live — Amendement PROPOSÉ (R144 → R147) · Bloc 26 « Le coffre — stockage gouverné »

**Statut : RATIFIÉ le 20.07.2026 par Ali Gharsallah.**
Numérotation continue après R143. Famille de scénarios : **CV** (vérifiée libre — Word + spec ;
ST écartée : prise par les stress tests du catalogue R1-R56).
**Le catalogue précède le code.**

## Le problème — la dernière promesse sans acte

Toute la GED (R109→R139) manipule des empreintes de contenus… qui ne sont stockés nulle part :
le port stockage est déclaré, jamais implémenté. C'est le dernier endroit où O-Live affirme
quelque chose qu'il ne fait pas. Quatre règles gouvernent **le coffre** — et l'adaptateur
Exoscale SOS (résidence suisse) est livré avec, prêt au câblage.

---

## R144 — Le contenu vit au coffre ; le système n'en garde que l'empreinte et la clé

Tout dépôt écrit le contenu **via le port stockage** sous une clé **déterministe**
(`{tenantId}/{documentId}/v{numero}`) ; la base ne stocke **jamais** le contenu — seulement
l'empreinte SHA-256 (R109) et la clé de coffre. Pas de port configuré → **refus explicite**
(pattern R114 : jamais de simulacre — un dépôt « réussi » sans coffre serait un mensonge). La
région de résidence est un paramètre contractuel du registre (`storageRegion`, défaut
`ch-gva-2` — Genève).

> **Scénario CV-01 — Le coffre reçoit, la base ne garde que la preuve**
> **Quand** un contenu est déposé **Alors** le port reçoit clé déterministe + contenu + région,
> la base porte empreinte + clé de coffre et **AUCUN contenu**
> **Quand** aucun port n'est configuré **Alors** refus explicite — pas de dépôt fantôme

> **Scénario CV-02 — La résidence est un paramètre du registre**
> **Étant donné** un tenant dont le registre fixe `storageRegion` = ch-dk-2
> **Quand** un contenu est déposé **Alors** le port reçoit cette région (R-Q fait foi, R125)

## R145 — La restitution re-vérifie TOUJOURS — un coffre altéré ne sert rien

Toute lecture recalcule l'empreinte du contenu lu **avant de servir** (R111 étendu au stockage
réel). Discordance → le contenu n'est **pas servi**, refus explicite, **alerte d'intégrité**
tracée. La confiance dans le coffre n'existe pas : elle se recalcule à chaque lecture.

> **Scénario CV-03 — L'altération au coffre est un refus, pas un incident silencieux**
> **Quand** le contenu lu correspond à l'empreinte **Alors** servi
> **Quand** le coffre rend un contenu altéré **Alors** REFUS, contenu non servi, alerte tracée

## R146 — Le coffre est scopé tenant et chiffré — et ne s'efface que par R115

La clé de coffre porte le `tenantId` en **préfixe vérifié à la lecture** : demander une clé
d'un autre tenant est un refus **structurel** (l'isolation ne dépend pas de la politesse de
l'appelant). Le port reçoit la référence de chiffrement du tenant (`storageChiffrement` —
enveloppe par tenant). La **suppression au coffre n'existe que par la destruction certifiée
R115** : le contenu part, l'empreinte et le certificat **survivent** en base.

> **Scénario CV-04 — L'isolation est structurelle, le chiffrement transmis**
> **Quand** t2 demande une clé préfixée t1 **Alors** refus structurel (préfixe vérifié)
> **Et** chaque écriture porte la référence de chiffrement du tenant

> **Scénario CV-05 — On n'efface qu'en certifiant**
> **Quand** une purge est demandée hors destruction certifiée **Alors** refus (R115 seul chemin)
> **Quand** la destruction certifiée passe **Alors** coffre purgé, empreinte + certificat SURVIVENT

## R147 — Le coffre se réconcilie — la mesure, jamais la purge automatique

Un tick d'inventaire compare base ↔ coffre : **orphelin au coffre** (clé sans version) →
alerte ; **manquant au coffre** (version sans contenu) → alerte **CRITIQUE** + tâche. Le tick
**mesure et notifie** (R39) — il ne supprime ni ne répare jamais seul : un écart d'inventaire
est un fait d'audit, pas un ménage.

> **Scénario CV-06 — L'inventaire alerte, ne touche à rien**
> **Étant donné** un orphelin au coffre et une version sans contenu
> **Quand** le tick passe **Alors** alerte simple + alerte CRITIQUE + tâche, UNE fois —
> et NI suppression NI recréation

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Port | `StoragePort { ecrire(cle, contenu, opts{region, chiffrementRef}), lire(cle), supprimer(cle), lister(prefixe) }` |
| Service | `CoffreService(prisma, audit, ports { storage })` : `ecrire` (R144 — clé déterministe, jamais de contenu en base), `lire` (R145 — re-vérification systématique), `purgerCertifie` (R146/R115), `reconcilier` (R147) |
| **Adaptateur livré** | `s3-storage.adapter.ts` — Exoscale SOS (S3-compatible, endpoint `sos-{region}.exo.io`), SSE, prêt au câblage verbatim (précédent : claude-ia.adapter.ts) — NON exécuté ici (réseau), recette d'activation au RUNBOOK |
| Schéma | `DocumentVersion.storageKey String?` (diff additif) |
| Paramètres R-Q | **au registre (R125)** : `storageRegion` (string, `ch-gva-2`, R144/R146) · `storageChiffrement` (string réf. enveloppe, R146) |
| Événements | `coffre.ecrit` · `coffre.integrite.alerte` · `coffre.purge.certifiee` · `coffre.reconciliation.orphelin` · `coffre.reconciliation.manquant` · `tache.coffre.reconciliation` |
| Câblage GED (documenté, lot suivant) | `GedService.deposer/restituer` passent par le coffre — MIGRATION DOUCE notée au RUNBOOK, pas de réécriture des services dans CE lot |

Tests : CV-01..06 (`coffre.wiring.spec.ts`), écrits **avant** l'implémentation.

`RATIFIÉ le 20.07.2026 par Ali Gharsallah`
