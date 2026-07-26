# Tests d'Acceptation Fonctionnelle — Vague 9 (Bac à sable AML : dry-run d'un seuil)

**Exécutés le 2026-07-26 contre le backend réel (2 FAT)** (`apps/api/test/e2e/fat-vague9.e2e-spec.ts`).
Preuve brute : `docs/tests/PREUVES/fat-vague9-run.txt`. Statut global : **2/2 PASS**.
Objet : l'écran « Bac à sable AML » de la maquette (`sbaml`) — *voir avant d'écrire* (R94, scénario **B-02**),
sur le moteur PUR ratifié (R189→R206). Zéro invention.

Légende criticité : **C** = critique (bloquant recette) · **M** = majeur · **m** = mineur.

| ID FAT | Persona | Objectif métier | Préconditions | Étapes (langage humain) | Résultat attendu (métier) | Règle / exigence | Criticité | Statut |
|---|---|---|---|---|---|---|---|---|
| **FAT-SBAML-01** | Compliance Officer | Simuler un seuil sur données réelles et voir l'impact **nominatif**, sans rien écrire | Tenant ; un client dont 5 virements (149 000 CHF, même UBO, 38h) ne franchissent pas le seuil actuel | 1. Je simule `amlStructuringSeuilChf` relevé (100 000 → 200 000). | Le système montre **avant / après / nouvelles / disparues** ; chaque nouvelle est **nommée** (client, fait, règle R189 franchie) ; **`ecriture=false`** et **0 signal en base** (R70). | R94 / B-02 / R70 | **C** | ✅ PASS |
| **FAT-SBAML-02** | Compliance Officer | Proposer n'est pas appliquer : la simulation ne matérialise rien, l'application passe par le registre | Seuil AML au registre | 1. Après la simulation, je lis la valeur effective du seuil. 2. J'applique via le registre (motivé, R126). 3. Je relis la valeur effective. | Après simulation, la valeur est **inchangée** (100 000). Après application gouvernée, elle vaut **200 000**, écrite à sa date d'effet (R29) et journalisée. | R94 / R96 / R126 / R29 | **M** | ✅ PASS |

**Porte backend nouvelle (spec-first, projection du canon)** : `POST /v1/aml/sandbox`
(`AmlService.sandbox` → `{ override, ecriture:false, totaux, parClient, nouvelles, disparues }`).
Le service rejoue le moteur **pur** `evaluer(contexte, params)` avec les seuils **actuels** (`paramsDepuisSettings(tenant.settings)`)
puis **simulés** (`{...settings, [cle]: valeur}`), et **diffe par règle** pour rendre l'impact nominatif.
**Aucune écriture** (ni signal, ni tâche, ni case — R70) : lecture seule du tenant + moteur pur.
La clé simulée doit être un paramètre **AML gouverné du registre** (préfixe `aml`, R125) — sinon `400`.
**Aucun modèle Prisma nouveau** ; moteur AML **inchangé** ; harnais AML **inchangé à 45/45** (grand total **425/425**).

**Tie-in gouvernance** : le bac à sable **propose** ; l'owner **arbitre** (R96). L'application n'est **jamais** un
chiffre codé en dur : elle passe par la porte d'écriture existante du registre R-Q
(`POST /v1/parametres/valeur/:cle`, motivé R126, à effet daté R29, journalisé). Le dry-run et l'application
partagent le **même moteur** et le **même registre** — la simulation dit la vérité de ce que l'écriture ferait.
