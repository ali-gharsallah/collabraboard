# Catalogue O-Live — Amendement PROPOSÉ (R171 → R173) · Bloc 34 « Le workflow est un paramètre gouverné »

**Statut : RATIFIÉ le 21.07.2026 par Ali Gharsallah.**
Numérotation continue après R170. Famille : **WF** (vérifiée libre — Word et spec).
**Le catalogue précède le code.** Le front Appway : eux vendent un ATELIER de workflows —
flexible, donc dangereux : qui garantit qu'un dossier ouvert hier suit encore les règles
sous lesquelles il est né ? Chez O-Live, l'édition du workflow est un droit du tenant, mais
un droit GOUVERNÉ : versionné, daté, immuable une fois publié, avec grandfathering prouvé.
« Appway vous vend l'atelier ; O-Live vous livre la machine déjà conforme — et vous gardez
la clé du réglage. »

## R171 — La définition de workflow est un paramètre tenant VERSIONNÉ — publiée, elle est IMMUABLE

Une définition (étapes, sections, visas requis par rôle) appartient au tenant et se publie
avec une **date de mise en vigueur** (`depuisLe`, pattern R29). Une définition **publiée ne
se modifie jamais** : pour changer, on publie une **nouvelle version datée**. L'historique
complet reste lisible — le rejeu à date (R48) exige de savoir ce qui valait quand.

> **Scénario WF-02 — Publiée = gravée**
> **Quand** on tente de modifier une définition publiée **Alors** refus explicite
> **Quand** on publie une v2 datée **Alors** la v1 reste lisible, intacte, à sa date

## R172 — Le dossier emporte sa version — le grandfathering est structurel

La version applicable à un dossier se **résout par sa date d'ouverture** : un dossier ouvert
sous v1 **continue sous v1** même après publication de v2 — sans copie, sans figement
manuel, par résolution datée (patterns R29/R48). Une version à date future n'est applicable
à personne avant sa date.

> **Scénario WF-03 — Deux dossiers, deux mondes, une seule table**
> **Étant donné** v1 (01.01) et v2 (01.07) **Quand** le dossier A s'est ouvert le 15.03
> **Alors** il résout v1 **Quand** le dossier B s'ouvre le 15.07 **Alors** il résout v2
> **Et** la v3 datée 2027 ne s'applique encore à personne

## R173 — Publier est un ACTE gouverné — le brouillon ne s'applique jamais

L'édition vit en **brouillon** (modifiable à volonté, tracé). La **publication** est un acte
humain (jeton), **habilité** (`workflowRoles`, R-Q), **motivé** (R7), qui fige le contenu et
pose la date. Un brouillon n'est **jamais** résolu par un dossier — ce qui n'est pas publié
n'existe pas pour le moteur (pattern R114). Toute publication est un événement.

> **Scénario WF-04 — Le brouillon est invisible au moteur**
> **Quand** un brouillon existe **Alors** la résolution ne le voit pas
> **Quand** un rôle non habilité publie **Alors** refus tracé **Quand** on publie sans
> motif **Alors** refus R7

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Modèle | `WorkflowDef` (tenantId, code, version, statut `BROUILLON\|PUBLIEE`, depuisLe?, contenu json — étapes/sections/visas —, creePar, publiePar?, publieAt?, motif?) — @@unique(tenantId, code, version) — RLS |
| Service | `WorkflowDefService(prisma, audit)` : `creerBrouillon` / `modifierBrouillon` (R173), `publier` (R171/R173 — acte jeton motivé daté), `resoudre(code, dateOuverture)` (R172 — la version publiée la plus récente dont depuisLe ≤ date), `lister` |
| Paramètres R-Q | **au registre (R125)** : `workflowRoles` (défaut ["CO","ADMIN"]) |
| Événements | `workflow.def.brouillon` · `workflow.def.publiee` · `workflow.def.acces.refuse` |
| À suivre (lots dédiés) | l'écran WorkflowManagementScreen (l'atelier gouverné, front Appway) ; câblage `kyc_workflows`/moteur sur `resoudre` |

Tests : WF-01..05 (`workflow-def.wiring.spec.ts`), écrits **avant** l'implémentation.

`RATIFIÉ le 21.07.2026 par Ali Gharsallah`
