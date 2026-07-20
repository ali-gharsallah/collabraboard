# Catalogue O-Live — Amendement PROPOSÉ (R164 → R166) · Bloc 32 « Les dossiers-vues — classer sans copier »

**Statut : RATIFIÉ le 20.07.2026 par Ali Gharsallah.**
Numérotation continue après R163. Famille : **VU** (vérifiée libre). **Le catalogue précède le
code.** Note d'écart évité : la « rétention calendaire » envisagée comme règle candidate EXISTE
déjà (GD-11, `tickRetention` — l'échéance propose, ne détruit pas) — la vérification
systématique a empêché un doublon. Le dernier confort GED réellement manquant : un document
visible dans plusieurs classements, sans jamais être copié.

## R164 — La vue est une REQUÊTE nommée — jamais une copie, jamais un conteneur

Une vue (« Passeports expirant en 2026 », « Dossiers du client X en attente ») est un
**critère enregistré** au registre tenant (`gedVues`) : le document n'existe qu'**une fois**,
il *apparaît* dans N vues. Créer/retirer une vue est habilité (`vueRoles`) et tracé ; retirer
une vue **ne détruit rien** (elle n'a jamais rien contenu) — le retrait se motive (R7).

> **Scénario VU-01 — N vues, un document, zéro copie**
> **Quand** un passeport correspond à 2 vues **Alors** il apparaît dans les deux — et la base
> n'en porte qu'UN **Quand** la vue est retirée (motivée) **Alors** le document est INTACT

## R165 — La vue s'évalue AU RÉSULTAT — même vue, deux rôles, deux contenus

L'évaluation applique le filtre d'habilitation **du regardeur** (types R112, arrivée R139 —
pattern R149) : la même vue servie à un CF et à un RM ne montre pas la même chose, et un
document hors droits n'y apparaît **ni en titre ni en compteur**. Chaque évaluation est
tracée (qui, quelle vue, combien servis — jamais les contenus, pattern R150).

> **Scénario VU-02 — Deux regardeurs, deux vues**
> **Étant donné** une vue « tout le client X » couvrant un PASSEPORT et un FISCAL (CF seul)
> **Quand** le CF évalue **Alors** 2 **Quand** le RM évalue **Alors** 1 — et la trace dit
> qui a regardé quoi

## R166 — La vue suit la vie — le détruit n'apparaît plus, nulle part

Un document DETRUIT (R115) disparaît de **toutes** les vues à l'évaluation — sans action,
sans oubli possible : la vue est une requête, l'état fait foi. Les critères supportent le
temps (`expireAvant`) : les vues d'échéance travaillent avec la rétention existante (GD-11)
sans la dupliquer.

> **Scénario VU-03 — L'oubli traverse les vues**
> **Quand** le document est détruit **Alors** toute vue qui le montrait ne le montre plus

---

## Implications techniques

| Point | Conséquence |
|---|---|
| Modèle | `GedVue` (tenantId, code UNIQUE par tenant, label, critere json {typeCode?, statut?, clientId?, expireAvant?}, creePar, at) — RLS |
| Service | `VuesService(prisma, audit)` : `creerVue` / `retirerVue` (R164, R7), `evaluer` (R165/R166 — filtre au résultat + trace), `listerVues` |
| Paramètres R-Q | **au registre (R125)** : `vueRoles` (défaut ["CO","CF","ADMIN"]) |
| Événements | `ged.vue.creee` · `ged.vue.retiree` · `ged.vue.evaluee` · `ged.vue.acces.refuse` |

Tests : VU-01..05 (`vues.wiring.spec.ts`), écrits **avant** l'implémentation.

`RATIFIÉ le 20.07.2026 par Ali Gharsallah`
