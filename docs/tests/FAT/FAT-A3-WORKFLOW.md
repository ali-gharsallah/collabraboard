# FAT — Amendement A3 (Lecture Workflow) : reconnaissance + porte A3.2 (CAS A)

**Exécutés le 2026-07-27 contre le backend réel (4 PT-01)** (`apps/api/test/e2e/fat-vague15.e2e-spec.ts`).
Preuve : `docs/tests/PREUVES/fat-vague15-run.txt`. Statut : **4/4 PASS** + composant FE-WFI (Vitest+RTL+MSW).

## Reconnaissance (verdict CAS A)

Consignée dans `docs/ECARTS-FRONT.md` §A3. Q1 (état persisté requêtable) & Q2 (listable sans rejeu) = **OUI**
→ **CAS A**. Q5 (visas R15) = OUI. Q4 (rejeu read-side `kyc a-date`) = OUI. Q3 = OUI avec **nuance acteur**
(présent dans le payload moteur, pas une colonne uniforme — surfacé, jamais synthétisé). Le read model R247
(CAS B) ne s'applique pas : l'état est déjà persisté et requêtable.

## Recette porte A3.2 (le port relaie, ne décide pas — moteur intouchable)

| ID | Objet | Vérifié | Statut |
|---|---|---|---|
| **PT-01a** | `GET /v1/workflow-instances` | Filtres `status`/`type`/`subjectId` ; `subjectRef` exposé ; liste sans rejeu | ✅ PASS |
| **PT-01b** | `GET /:id[?asOf=]` | `steps` + `visas` **format R15 exact** + `subjectRef` + `currentStep` ; `asOf` reconstruit l'état d'alors (délégué au ratifié `kyc a-date` ; visas par `signedAt ≤ asOf`) ; instance inexistante avant sa création | ✅ PASS |
| **PT-01c** | `GET /:id/events[?asOf=]` | Timeline append-only `type`+`at`+**acteur** (lu dans le payload moteur) ; `asOf` filtre les événements (R48) | ✅ PASS |
| **PT-01d** | Invariant no-write | **Aucun endpoint d'écriture** sur les instances (`POST /:id` → 404) — l'avancement passe par le moteur | ✅ PASS |

**Front** : `WorkflowInstances.tsx` enrichi — `currentStep`, **acteur dans la timeline** (FE-20), sélecteur **rejeu à date**
(FE-23 : « Vue historique — lecture seule », R48), visas via `<VisaBadge>` (R15, FE-21). Composant FE-WFI (Vitest+RTL+MSW).

**Invariants respectés** : moteur workflow (R1–R51) **non touché** ; aucun modèle Prisma nouveau ; aucun champ synthétisé
(acteur `null` quand le moteur ne l'a pas écrit) ; `asOf` délégué au rejeu **ratifié**. e2e **68 → 72**, harnais **inchangé à 425**.
