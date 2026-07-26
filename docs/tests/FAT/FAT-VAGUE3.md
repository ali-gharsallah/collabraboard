# Tests d'Acceptation Fonctionnelle — Vague 3 (Le cycle client de bout en bout)

**Exécutés le 2026-07-22 contre le backend réel (7 FAT)** (`apps/api/test/e2e/fat-vague3.e2e-spec.ts`).
Preuve brute : `docs/tests/PREUVES/fat-vague3-run.txt`. Statut global : **7/7 PASS**.

Légende criticité : **C** = critique (bloquant recette) · **M** = majeur · **m** = mineur.

| ID FAT | Persona | Objectif métier | Préconditions | Étapes (langage humain) | Résultat attendu (métier) | Règle / exigence | Criticité | Statut |
|---|---|---|---|---|---|---|---|---|
| **FAT-ONBOARD-01** | Relationship Manager | Ouvrir une relation et être **aiguillé** vers le bon niveau de diligence ; on n'ouvre pas un compte sans KYC validé | Tenant + client | 1. Je crée un KYC TRUST/LOMBARD/pays à risque. 2. Un KYC PP/CURRENT/CH. 3. J'ouvre un onboarding, entre en collecte, tente d'ouvrir. | Aiguillage **EDD** / **SDD** (trace de risque auditable) ; ouverture **refusée** (403) sans KYC VALIDATED. | R117/R118 · R119 | **C** | ✅ PASS |
| **FAT-SCREEN-01** | Compliance Officer | Qualifier un hit ; la décision est documentée et l'escalade **proposée**, jamais exécutée | Client dont le nom correspond à une entrée | 1. Je lance un screening. 2. Je qualifie sans motif. 3. Puis VRAI_POSITIF motivé. | Hit levé ; sans motif **refusé** (400, R7) ; VP → escalade **proposée** (événement), auteur = **jeton** ; run **toujours** tracé. | R100/R101/R7/R103 · R39/R44 | **C** | ✅ PASS |
| **FAT-REVIEW-01** | Compliance Officer | Conduire une revue dont la conclusion s'appuie sur des primitives **ratifiées**, sans agrégat inventé | KYC existant | 1. Je re-screene (revue). 2. Je constate la trace. 3. La conclusion passe par un visa KYC gouverné. | Re-screening **tracé** (R103, +1 run) ; décision via **four-eyes** KYC (créateur refusé, 409). | R103 · four-eyes (orchestration) | **C** | ✅ PASS |
| **FAT-UBO-01** | Relationship Manager | Voir la **chaîne de contrôle** : UBO rattaché et relations, cloisonnées | KYC + personnes | 1. Je rattache une personne comme **UBO**. 2. Je déclare une relation bijective. 3. Je relis. 4. Un autre tenant relit. | Rôle rattaché (R31) ; relation **relue des deux côtés** (R34) ; autre tenant → **0**. | R31 · R34 · RLS | **C** | ✅ PASS |
| **FAT-COC-01** | Compliance Officer | Un changement **matériel** (identité) déclenche le bon circuit, sans bascule d'état par effet de bord | Personne liée à un dossier | 1. J'enregistre un changement sur le **nom**. | Re-screening **déclenché** (R42) + CoC **propagé** au dossier (événements tracés), aucune bascule automatique. | R30 · R42 | **C** | ✅ PASS |
| **FAT-DASH-01** | COO | Voir **où sont les dossiers** et ce qui bloque, cloisonné au tenant | Stocks du tenant | 1. J'ouvre le tableau de bord (onboardings, dossiers, hits). 2. Un autre tenant regarde. | Stock lisible par état ; autre tenant → **0** onboarding (RLS). | Lecture agrégée · RLS | **M** | ✅ PASS |
| **FAT-CYCLE-01** | Bout-en-bout | Jouer un **dossier complet** — entrée → KYC → screening → revue → changement — sur le vrai backend | Tenant + client | 1. Aiguillage KYC. 2. Screening. 3. Revue (re-screening tracé). 4. CoC propagé. | Chaque étape laisse sa trace, **sans trou**, entièrement sur Postgres réel. | Objectif de fin de vague | **C** | ✅ PASS |

**Portes backend nouvelles (spec-first, sur services ratifiés)** : `ScreeningModule` (`/v1/screening/run`, `/hits`, `/hits/:id/qualify`, `/runs`) · `PersonnesModule` (`/v1/personnes`, `/:id/roles`, `/relations`, `/:id/relations`, `/:id/coc`) · lecture `GET /v1/onboarding`. **Aucun modèle Prisma nouveau** — tables préexistantes, déjà dans la boucle RLS FORCE.

**Écarts signalés (jamais résolus par invention)** :
- `PersonneLienService` (R152→R155) reste **dormant** : aucun modèle `Personne` au schéma (seul `PersonneLien` existe, sans backing model). La chaîne de contrôle exploitable est portée par `PersonnesService` (`Person`/`PersonRole`/`PersonRelation`).
- Le **% de détention / seuils CDB** n'est pas un attribut ratifié du modèle — l'écran montre les rôles et relations, aucun pourcentage fabriqué.
- **Account Review** n'a pas d'agrégat ratifié dédié : l'écran **orchestre** des primitives existantes (re-screening + visas KYC), documenté comme tel.
