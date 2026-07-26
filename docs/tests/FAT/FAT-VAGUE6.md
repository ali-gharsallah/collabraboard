# Tests d'Acceptation Fonctionnelle — Vague 6 (Paramétrage & Gouvernance)

**Exécutés le 2026-07-26 contre le backend réel (2 FAT)** (`apps/api/test/e2e/fat-vague6.e2e-spec.ts`).
Preuve brute : `docs/tests/PREUVES/fat-vague6-run.txt`. Statut global : **2/2 PASS**.
Objet : la gouvernance du paramétrage — registre R-Q ratifié R125→R128. Zéro invention.

Légende criticité : **C** = critique (bloquant recette) · **M** = majeur · **m** = mineur.

| ID FAT | Persona | Objectif métier | Préconditions | Étapes (langage humain) | Résultat attendu (métier) | Règle / exigence | Criticité | Statut |
|---|---|---|---|---|---|---|---|---|
| **FAT-PARAM-01** | Compliance Officer | Changer un paramètre = changer une règle : c'est tracé, motivé, jamais rétroactif | Registre R-Q | 1. Je lis le registre. 2. J'écris une valeur typée + motivée. 3. Sans motif. 4. Mauvais type. 5. Effet rétroactif. 6. Je relis la valeur à une date passée. | Registre **généré du canon** (R125) ; écriture **matérialisée** ; sans motif **refusé** (R7) ; mauvais type **refusé** (R125) ; rétroactif **refusé** (R126) ; valeur d'alors = défaut (R127). | R125/R126/R127/R7 | **C** | ✅ PASS |
| **FAT-GOLIVE-01** | Compliance Officer | Pas de go-live sur un questionnaire troué ; l'activation est signée | Config en cours | 1. Je reconstruis la config à une date. 2. J'active sans signature. 3. J'active avec une clé requise manquante. 4. Je renseigne les requises + signe, puis j'active. | Config **complète reconstruite** (R127) ; sans signature **refusé** (R128) ; clé requise manquante **nommée** (R128) ; puis tenant **ACTIF**. | R127/R128 | **C** | ✅ PASS |

**Portes backend nouvelles (spec-first, sur méthodes ratifiées)** : `GET /v1/parametres/config` (`configALaDate`, R127) · `POST /v1/parametres/activer` (`activer`, R128) ajoutées à `ParametresController`. Le registre (`GET /registre`, `GET/POST /valeur/:cle`) était déjà câblé (lot 46).

**Conformité schéma ↔ canon** : `ParametresService.activer` écrivait `tenant.statut`/`rqSignePar`/`rqSigneAt`, **absents du modèle `Tenant`** (fake du corpus vert, vrai endpoint en échec « Unknown argument `statut` »). Les 3 colonnes nullables ont été ajoutées (alignement schéma↔service ratifié, précédent lot 41), **baseline régénérée**, `prisma validate` OK, harnais **inchangé à 425**. `tenants` hors boucle RLS FORCE (table racine) — colonnes nullables sûres.

**Différé, signalé** : les **bacs à sable de dry-run** (R93→R99 : abaisser un seuil → alertes nommées, stress test, tension combinée) n'ont **pas** de service Nest ratifié — ils vivent seulement dans la maquette `olive-demo.html`. À ouvrir sur canon, pas inventés. Cf. `docs/DECALAGE-FRONT-DEMO.md`.
