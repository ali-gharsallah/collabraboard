# Tests d'Acceptation Fonctionnelle — Vague 13 (MOD-43 Formations & Certifications, R231→R238)

**Exécutés le 2026-07-27 contre le backend réel (8 FAT)** (`apps/api/test/e2e/fat-vague13.e2e-spec.ts`).
Preuve : `docs/tests/PREUVES/fat-vague13-run.txt`. Statut : **8/8 PASS**. + composant FE-FORM (Vitest+RTL+MSW).
Objet : MOD-43 — Formations & Certifications, **ratifié** (« OK pour R222..R238 », Ali). Spec-first depuis le
Gherkin FO-01..08 (`spec/vague13-scenarios/FORMATIONS-MOD43.feature`). Zéro invention hors du canon ratifié.

| ID FAT | Persona | Objectif métier | Étapes | Résultat attendu | Règle | Criticité | Statut |
|---|---|---|---|---|---|---|---|
| **FO-01** | RH/CO | Référentiel 100% tenant, aucun type en dur | Tenant A définit « AML annuelle », B non | A le voit, B ne le voit pas | R231 | **M** | ✅ PASS |
| **FO-02** | Collaborateur | Compléter = événement + attestation | Compléter avec `attestationDocId` (mode AUTO) | Statut **COMPLETED** ; événement `training.completed` `{ docId }` | R232 | **C** | ✅ PASS |
| **FO-03** | RH | Rappels J-x informatifs | `tick` aux J-30 et J-7 d'une certif | 2 rappels émis ; **rien n'est bloqué** | R233 / R39 | **m** | ✅ PASS |
| **FO-04** | Auditeur | Attestations append-only | 2 attestations même formation ; tenter UPDATE | Les 2 conservées ; **UPDATE refusé** | R234 | **M** | ✅ PASS |
| **FO-05** | CF | Validation par visa (mode VALIDATED) | Dépôt → visa CF | Dépôt → IN_PROGRESS/PENDING ; visa → **COMPLETED** | R235 / R15 | **M** | ✅ PASS |
| **FO-06** | Collaborateur | Auto-validation interdite | L'auteur signe sa propre complétion | **`TRAINING_SELF_VALIDATION_FORBIDDEN`** (403) | R235 / R13 | **C** | ✅ PASS |
| **FO-07** | RM/BRM/CO | Visibilité par profil | Chacun liste les dossiers | RM voit le sien ; BRM voit son équipe ; CO voit tout | R236 | **M** | ✅ PASS |
| **FO-08** | Compliance | Rejeu certifiant | « certifié X au 2025-05-20 ? » (expirée puis renouvelée) | **NON certifié** + historique justificatif (2 lignes) | R238 | **M** | ✅ PASS |

**Backend nouveau (spec-first)** : `FormationsModule` — `GET /v1/formations/catalog` (R231), `GET|POST /v1/formations/assignments`,
`POST /assignments/:id/complete` (R232/R235), `POST /assignments/:id/visa` (R235/R13), `POST /certifications` + `GET /certifications?userId=&asOf=` (R234/R238),
`POST /rappels/tick` (R233). **3 modèles Prisma nouveaux** : `TrainingAssignment` (cycle de vie), `Certification` & `TrainingAttestation`
(**append-only** R234, triggers `audit_immutable`). Les 3 tables sont **RLS FORCE tenant** (post-deploy) ; **baseline régénérée**, `prisma validate` OK.
Registre R-Q enrichi (R231/R233/R235/R236) : `trainingCatalog`, `trainingReminderDays`, `trainingCompletionValidation`, `trainingVisibiliteRoles`.

**Front** : `Formations.tsx` (catalogue, dossiers selon profil, dépôt d'attestation → **GED via backend** jamais un service externe,
validation par visa, rejeu certifiant à date) + composant FE-FORM (Vitest+RTL+MSW). **Harnais offline inchangé à 425** (fakes). e2e **50 → 58**.

**Reste (Vague 14)** : MOD-75 Business Trip (R222→R230) — BT-08/R237 lira la certification voyageur **depuis MOD-43** (dépendance).
