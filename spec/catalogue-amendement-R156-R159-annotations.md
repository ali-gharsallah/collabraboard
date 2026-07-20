# Catalogue O-Live — Amendement PROPOSÉ (R156 → R159) · Bloc 29 « Annotations & caviardage — le regard sans la plume »

**Statut : RATIFIÉ le 20.07.2026 par Ali Gharsallah.**
Numérotation continue après R155. Famille de scénarios : **AN** (vérifiée libre — Word v4.12 + spec).
**Le catalogue précède le code.** Origine produit : écart Therefore n° 3, le dernier. Chez eux,
annoter écrit dans le document ; chez nous, **l'original est intouchable** — le travail humain
vit dans des calques, la divulgation dans des dérivés certifiés.

## R156 — L'annotation est un CALQUE — jamais une écriture sur l'original

Surlignage, note, tampon : l'annotation vit dans une table séparée qui **référence** (document,
version, ancre de position) — l'original et son empreinte (R109/R145) restent intacts au bit
près. Chaque annotation est **signée** (auteur jeton, horodatage) et typée. Le retrait se
motive (R7) et se trace : le calque est un espace de travail, pas une zone de non-droit.

> **Scénario AN-01 — Le calque n'effleure pas l'original**
> **Quand** le CO surligne et note une version **Alors** l'annotation référence (doc, version,
> ancre), signée — et l'empreinte de la version est IDENTIQUE avant/après
> **Scénario AN-02 — Le retrait se motive**
> **Quand** l'annotation est retirée sans motif **Alors** refus (R7)
> **Quand** motivée **Alors** retirée + retrait tracé (auteur, motif)

## R157 — L'annotation est habilitée — et son cercle de visibilité est déclaré

Annoter exige un droit du registre (`annotationRoles`, défaut CO/CF/RM) — default-deny,
tentative tracée (mécanique R112). Chaque annotation déclare son **cercle** : `PRIVEE`
(l'auteur seul), `DOSSIER` (quiconque voit le document — R112/R149). Une annotation ne fuite
**jamais** à qui ne voit pas le document porteur : le filtre s'applique au résultat, l'existence
même est protégée (pattern R149).

> **Scénario AN-03 — Le cercle tient, l'existence ne fuite pas**
> **Quand** un rôle hors registre annote **Alors** refus + tentative tracée
> **Quand** le RM liste : il voit ses PRIVEE + les DOSSIER des documents qu'il voit —
> les PRIVEE d'autrui : invisibles ; les annotations d'un document hors droits : invisibles

## R158 — Le caviardage produit un NOUVEAU dérivé certifié — l'original demeure

Caviarder = déclarer des **zones**, chacune avec son **motif** (base légale : secret d'affaires,
données de tiers, LPD…) — habilitation dédiée (`caviardageRoles`, défaut CO/CF). Le résultat
est un **dérivé** portant sa propre empreinte ET l'empreinte de la version source (chaînage
prouvable), statut `CAVIARDE`. Zones, motifs, auteur : tout est l'événement. L'original n'est
ni modifié, ni déplacé, ni re-signé — il demeure, au bit près.

> **Scénario AN-04 — Le dérivé naît, l'original ne bouge pas**
> **Quand** le CF caviarde 2 zones motivées **Alors** dérivé créé (empreinte propre + empreinte
> source chaînée, zones+motifs tracés) — et l'original est IDENTIQUE au bit près
> **Scénario AN-05 — Pas de zone muette, pas de main non habilitée**
> **Quand** une zone est sans motif **Alors** refus **Quand** un rôle hors registre caviarde
> **Alors** refus + tentative tracée

## R159 — La divulgation ne sert QUE le caviardé — l'original ne sort jamais par accident

Divulguer à un tiers est un **acte** qui référence un dérivé caviardé (id + empreinte dans
l'événement : on prouve APRÈS COUP ce qui est exactement sorti). Cette voie **refuse**
l'original et toute version non caviardée : servir l'original à l'extérieur exigerait un
autre acte, explicite et distinct — le défaut protège.

> **Scénario AN-06 — Ce qui sort est prouvé, l'original ne sort pas**
> **Quand** le CF divulgue le dérivé **Alors** événement (destinataire, dériveId, empreinte)
> **Quand** il tente de divulguer la version ORIGINALE par cette voie **Alors** refus explicite

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Modèle | `Annotation` (tenantId, documentId, versionId, ancre json, type, contenu, cercle `PRIVEE\|DOSSIER`, auteur, at) · `CaviardageDerive` (tenantId, documentId, versionId source, shaSource, shaDerive, zones json [{zone, motif}], statut `CAVIARDE`, par, at) — RLS ×2 |
| Service | `AnnotationService(prisma, audit)` : `annoter`, `retirerAnnotation` (R7), `listerAnnotations` (filtre au résultat), `caviarder`, `divulguer` |
| Paramètres R-Q | **au registre (R125)** : `annotationRoles` (défaut ["CO","CF","RM"]) · `caviardageRoles` (défaut ["CO","CF"]) |
| Événements | `annotation.posee` · `annotation.retiree` · `annotation.acces.refuse` · `caviardage.produit` · `caviardage.refuse` · `divulgation.executee` · `divulgation.refusee` |
| Câblage (documenté, lot dédié) | le dérivé caviardé se dépose au coffre (R144) comme tout contenu ; la recherche (R148) n'indexe pas les dérivés caviardés (ils servent la sortie, pas la consultation interne) |

Tests : AN-01..06 (`annotation.wiring.spec.ts`), écrits **avant** l'implémentation.

`RATIFIÉ le 20.07.2026 par Ali Gharsallah`
