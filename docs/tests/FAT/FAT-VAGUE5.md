# Tests d'Acceptation Fonctionnelle — Vague 5 (Rattrapage maquette : CRM & Workflow)

**Exécutés le 2026-07-26 contre le backend réel (4 FAT)** (`apps/api/test/e2e/fat-vague5.e2e-spec.ts`).
Preuve brute : `docs/tests/PREUVES/fat-vague5-run.txt`. Statut global : **4/4 PASS**.
Objet : rattraper la maquette `olive-demo.html` **là où le canon est ratifié** — zéro invention.

Légende criticité : **C** = critique (bloquant recette) · **M** = majeur · **m** = mineur.

| ID FAT | Persona | Objectif métier | Préconditions | Étapes (langage humain) | Résultat attendu (métier) | Règle / exigence | Criticité | Statut |
|---|---|---|---|---|---|---|---|---|
| **FAT-CRM-01** | Relationship Manager | Relire la relation d'un client et voir le prochain geste proposé | Client rattaché au RM | 1. J'ouvre la timeline. 2. Je lis les prochains gestes. | Timeline **projette** le journal (R186) ; gestes **proposés** (R187), jamais exécutés. | R186 · R187 | **M** | ✅ PASS |
| **FAT-CR-01** | Relationship Manager | Tracer un compte rendu d'entretien ; ne jamais fabriquer un brouillon IA fantôme | Type d'entretien paramétré | 1. Je crée un compte rendu. 2. Je demande un pré-remplissage IA (sans port). | Compte rendu **tracé** (R188) ; pré-remplissage **refusé** sans port IA (R138), saisie manuelle ouverte. | R188 · R138 | **M** | ✅ PASS |
| **FAT-WF-01** | Compliance Officer | Une définition de workflow se publie **datée et immuable** ; personne ne la modifie après | Brouillon de définition | 1. Non-habilité tente de publier. 2. Publication sans motif. 3. Publication datée + motivée. 4. Modif d'une version publiée. 5. Résolution à une date. | Non-habilité **refusé** (R173) ; sans motif **refusé** (R7) ; **PUBLIEE immuable** (R171) ; modif publiée **refusée** ; résolution rend la version applicable (R172, grandfathering). | R171/R172/R173/R7 | **C** | ✅ PASS |
| **FAT-CORROB-01** | Compliance Officer | Signaler une divergence d'identité sans rien modifier avant décision | Personne + dossier | 1. Je signale une divergence sur un champ d'identité. | Dossier **Central File ouvert** + tâche de corroboration (R36) ; **aucune** donnée modifiée avant décision humaine. | R36 | **C** | ✅ PASS |

**Portes backend nouvelles (spec-first, sur services ratifiés)** : `WorkflowModule` (`POST/PATCH /v1/workflow/definitions`, `/:id/publier`, `GET /definitions`, `/resoudre`) · route `POST /v1/personnes/:id/corroboration` ajoutée à `PersonnesModule`. **CRM** (`/v1/crm/…`) était **déjà câblé** (lot 46). **Aucun modèle Prisma nouveau** — `workflow_defs` préexiste, déjà dans la boucle RLS FORCE.

**Zéro invention** : les quatre écrans reposent sur du canon **déjà ratifié** (CRM R186→R188, Workflow R171→R173, Corroboration R36). C'est la partie « rattrapage maquette » réalisable sans nouvelles règles. Les domaines maquette sans canon (Command Center, Investigation, SWIFT, Legal, Octopulse, CPSI-Nest, Olivia/BI, IAM/SSO, Audit…) restent **en attente de canon** — cf. `docs/DECALAGE-FRONT-DEMO.md`.
