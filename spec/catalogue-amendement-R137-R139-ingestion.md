# Catalogue O-Live — Amendement PROPOSÉ (R137 → R139) · Bloc 24 « Capture & ingestion GED »

**Statut : RATIFIÉ le 20.07.2026 par Ali Gharsallah.**
Numérotation continue après R136. Famille de scénarios : **IG** (vérifiée libre — Word + spec).
**Le catalogue précède le code.** Origine produit : écart Therefore, manque n° 1 (capture).

## Le problème

La GED O-Live (R109→R116) gouverne des documents déjà DANS le système — mais rien ne gouverne
leur ENTRÉE. Therefore capture (scan, e-mail, dossiers surveillés) ; nous n'avons ni canaux, ni
OCR, ni tri d'arrivée. Trois règles créent la porte d'entrée — avec les invariants maison : le
canal est déclaré, l'OCR est un dérivé jamais l'original, et l'arrivée est une quarantaine
qualifiée où l'humain classe.

**Écart signalé (pas de silence)** : le modèle `Document` du schéma repo est l'HISTORIQUE
(lignée v0.2 : `s3Key`, `A_VALIDER`) et ne reflète pas le contrat des services GED R109-R116 —
l'alignement complet est un chantier schéma dédié ; ce bloc reste ADDITIF (`GedIngestEntry`).

---

## R137 — Tout document entre par un canal déclaré — et son origine fait partie du dossier

Un document n'apparaît jamais « de nulle part » : il entre par un **canal du registre R-Q**
(`gedCanauxIngestion`, défaut `["SCAN","EMAIL","UPLOAD","API"]`) — canal hors registre = refus
(default-deny). L'ingestion crée le document (statut `A_CLASSER`) et sa v1 (empreinte SHA-256
réelle, R109) **plus une fiche d'origine** : canal, source (adresse, périphérique, appelant),
opérateur (jeton), horodatage. L'origine est une pièce du dossier — pas une métadonnée de
confort.

> **Scénario IG-01 — L'entrée est tracée, le canal inconnu refusé**
> **Quand** un PDF entre par UPLOAD **Alors** document A_CLASSER + v1 (empreinte réelle) +
> fiche d'origine complète (canal, source, opérateur jeton) + événement `ged.ingest`
> **Quand** un document tente d'entrer par « FAX » (hors registre) **Alors** refus

> **Scénario IG-02 — Le canal est un paramètre tenant**
> **Étant donné** un tenant dont le registre ajoute FAX
> **Quand** un document entre par FAX **Alors** accepté — le R-Q fait foi (R125)

## R138 — L'OCR est un port ; son résultat un dérivé versionné — jamais l'original

L'OCR passe par un **port** (pattern R114 : pas de prestataire configuré → refus explicite,
jamais de simulacre). Son résultat est un **dérivé** attaché à la version : texte, empreinte du
dérivé, moteur+version, horodatage. L'original reste intact au bit près (R109/R111 : le contenu
soumis est re-vérifié contre l'empreinte avant OCR). Un re-OCR **ajoute** un dérivé — le
précédent est conservé (on sait ce que chaque moteur a lu, et quand).

> **Scénario IG-03 — Le dérivé s'attache, l'original ne bouge pas**
> **Quand** l'OCR passe sur la v1 **Alors** dérivé (texte + empreinte + moteur) attaché,
> empreinte de la v1 INCHANGÉE **Quand** re-OCR **Alors** 2e dérivé, le 1er conservé

> **Scénario IG-04 — Pas de port, pas de simulacre ; contenu altéré, refus**
> **Quand** l'OCR est demandé sans prestataire **Alors** refus explicite (R114)
> **Quand** le contenu soumis ne correspond pas à l'empreinte **Alors** refus (R111)

## R139 — La boîte d'arrivée est une quarantaine qualifiée — l'humain classe

Un document ingéré est **A_CLASSER** : sans type, sans rattachement — et **invisible hors des
rôles habilités** (`gedInboxRoles`, défaut `["CO","CF"]` ; accès et refus tracés, mécanique
R112). Le **classement** (type du référentiel + rattachement client) est un acte humain tracé —
et le classeur doit être autorisé sur le TYPE cible (cohérence R112 : on ne classe pas vers ce
qu'on n'a pas le droit de voir). Un SLA d'arrivée (`gedInboxSlaJours`, défaut 2) **alerte une
fois** (R39) — rien ne se classe tout seul.

> **Scénario IG-05 — Le classement est un acte habilité, deux fois**
> **Quand** un RM (hors gedInboxRoles) tente de lister l'arrivée **Alors** refus tracé
> **Quand** le CO classe vers PASSEPORT + client c1 **Alors** type+client posés, ACTIF, tracé
> **Quand** le CO tente de classer vers un type qui exclut CO **Alors** refus (R112)

> **Scénario IG-06 — Le SLA d'arrivée alerte, ne classe pas**
> **Étant donné** un document A_CLASSER depuis 3 jours (SLA 2)
> **Quand** le tick passe **Alors** alerte + tâche UNE fois, document toujours A_CLASSER

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Modèle | `GedIngestEntry` (tenantId, documentId, canal, source, operateur, at) — additif ; `Document.statut` gagne la valeur `A_CLASSER`, `typeCode` nullable à l'arrivée (au contrat de service ; schéma historique = chantier signalé) |
| Service | `GedIngestionService(prisma, audit, ports { ocr })` : `ingerer` (R137), `ocriser` (R138 — vérifie l'empreinte, attache le dérivé), `listerArrivee` (R139, default-deny tracé), `classer` (R139, double habilitation), `tickArrivee` (R39) |
| Paramètres R-Q | **au registre (R125)** : `gedCanauxIngestion` (json) · `gedInboxRoles` (json) · `gedInboxSlaJours` (int, 2) |
| Événements | `ged.ingest` · `ged.ocr.derive` · `ged.inbox.acces.refuse` · `ged.classement` · `ged.inbox.sla` · `tache.ged.classement` |
| RLS | `ged_ingest_entries` : RLS |

Tests : IG-01..06 (`ged-ingestion.wiring.spec.ts`), écrits **avant** l'implémentation.

`RATIFIÉ le 20.07.2026 par Ali Gharsallah`
