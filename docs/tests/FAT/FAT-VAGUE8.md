# Tests d'Acceptation Fonctionnelle — Vague 8 (Référentiel AML : scénarios & seuils)

**Exécutés le 2026-07-26 contre le backend réel (2 FAT)** (`apps/api/test/e2e/fat-vague8.e2e-spec.ts`).
Preuve brute : `docs/tests/PREUVES/fat-vague8-run.txt`. Statut global : **2/2 PASS**.
Objet : l'écran « Référentiel AML » de la maquette (`amlcat`), sur le canon ratifié R189→R206. Zéro invention.

Légende criticité : **C** = critique (bloquant recette) · **M** = majeur · **m** = mineur.

| ID FAT | Persona | Objectif métier | Préconditions | Étapes (langage humain) | Résultat attendu (métier) | Règle / exigence | Criticité | Statut |
|---|---|---|---|---|---|---|---|---|
| **FAT-AMLCAT-01** | Compliance Officer | Voir le catalogue complet des scénarios de surveillance et leurs seuils | Tenant | 1. J'ouvre le référentiel AML. | **18 scénarios** (R189→R206) avec code/type/niveau/libellé ; seuils **effectifs** (défauts du canon). | R189→R206 (référentiel) | **M** | ✅ PASS |
| **FAT-AMLCAT-02** | Compliance Officer | Un seuil se change par la **gouvernance** (registre), jamais en dur, et le référentiel le reflète | Seuil AML au registre | 1. Je change `amlStructuringSeuilChf` au registre (motivé, R126). 2. Je rouvre le référentiel. | Le référentiel affiche la **nouvelle valeur effective** (100 000 → 50 000) — piloté par le registre R-Q (R125→R127). | R125/R126/R127 | **M** | ✅ PASS |

**Porte backend nouvelle (spec-first, projection du canon)** : `GET /v1/aml/referentiel` (`AmlService.referentiel` → `{ scenarios: REFERENTIEL_AML, seuils: paramsDepuisSettings(tenant.settings) }`). `REFERENTIEL_AML` = index **factuel** des 18 détecteurs ajouté à `aml-scoring.engine.ts` (métadonnées, pas de règle nouvelle). **Aucun modèle Prisma nouveau** ; harnais AML **inchangé à 45/45**.

**Tie-in gouvernance** : le référentiel relit les seuils **à chaud** depuis le registre R-Q (Vague 6). Changer une règle de surveillance = un **acte motivé au registre** (R126), jamais un chiffre codé en dur. Le moteur SIGNALE, il ne décide jamais seul — la levée reste humaine (R39).
