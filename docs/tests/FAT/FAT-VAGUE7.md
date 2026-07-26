# Tests d'Acceptation Fonctionnelle — Vague 7 (PMS : Mandats, Adéquation & Breaches)

**Exécutés le 2026-07-26 contre le backend réel (2 FAT)** (`apps/api/test/e2e/fat-vague7.e2e-spec.ts`).
Preuve brute : `docs/tests/PREUVES/fat-vague7-run.txt`. Statut global : **2/2 PASS**.
Doctrine : **INTÉGRER, pas refaire** — couche compliance sur les positions, pas un moteur de portefeuille. PMS ratifié R105→R108.

Légende criticité : **C** = critique (bloquant recette) · **M** = majeur · **m** = mineur.

| ID FAT | Persona | Objectif métier | Préconditions | Étapes (langage humain) | Résultat attendu (métier) | Règle / exigence | Criticité | Statut |
|---|---|---|---|---|---|---|---|---|
| **FAT-PMS-ADEQ-01** | Compliance Officer | Le profil de risque du CLIENT borne le mandat ; l'humain décide, rien n'est rétrogradé | Client profil LOW | 1. J'attache un mandat exigeant HIGH. 2. Un mandat HIGH existe déjà (client rétrogradé). 3. Je vérifie l'adéquation. | Attache HIGH sur LOW **refusée** (LSFin, R107) ; adéquation lève une **alerte nommée** sans rétrograder le mandat (R107). | R107 (LSFin) | **C** | ✅ PASS |
| **FAT-PMS-DRIFT-01** | Compliance Officer | L'écart d'allocation se CONSTATE (jamais de rééquilibrage auto) ; pre-trade bloque ; breach clôturé motivé | Mandat + positions hors bornes | 1. Je valorise (positions ACTIONS 90% > borne 60). 2. Pre-trade secteur exclu. 3. Pre-trade concentration. 4. Ordre conforme. 5. Clôture breach sans/avec motif. | Drift **détecté** + breach **OUVERT**, **positions intactes** (R105/R44) ; pre-trade **BLOQUE** exclusion + concentration (R106), ordre conforme **OK** ; clôture sans motif **refusée** (R7), avec motif → **CLOS**. | R105/R106/R108/R7 | **C** | ✅ PASS |

**Porte backend nouvelle (spec-first, sur service ratifié)** : `PmsModule` — `POST /v1/pms/mandats` · `GET /mandats` · `GET /mandats/:id/valoriser` · `POST /mandats/:id/pre-trade` · `GET /clients/:id/adequation` · `GET /breaches` · `POST /breaches/:id/clore`. Deux lectures additives (`mandats`/`breaches`). **Aucun modèle Prisma nouveau** — `mandates`/`positions`/`pms_breaches` préexistent, déjà RLS FORCE.

**Doctrine tenue** : les **positions** sont des données (import d'un core), **jamais calculées** ici ; le PMS O-Live ne rééquilibre pas, ne liquide pas — il **constate, bloque en amont, escalade** (R44/R39). C'est bien de l'**intégration**, pas la réimplémentation d'un moteur de portefeuille.
