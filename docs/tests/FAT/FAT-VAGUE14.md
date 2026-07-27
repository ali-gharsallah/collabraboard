# Tests d'Acceptation Fonctionnelle — Vague 14 (MOD-75 Business Trip, R222→R230)

**Exécutés le 2026-07-27 contre le backend réel (10 FAT)** (`apps/api/test/e2e/fat-vague14.e2e-spec.ts`).
Preuve : `docs/tests/PREUVES/fat-vague14-run.txt`. Statut : **10/10 PASS**. + composant FE-TRIP (Vitest+RTL+MSW).
Objet : MOD-75 — Business Trip, **ratifié** (« OK pour R222..R238 »). Spec-first depuis le Gherkin BT-01..10
(`spec/vague14-scenarios/BUSINESS-TRIP-MOD75.feature`). Second des deux domaines ; **BT-08/R237 lit la
certification voyageur depuis MOD-43** (Vague 13). Zéro invention hors du canon ratifié.

| ID FAT | Objectif métier | Résultat attendu | Règle | Criticité | Statut |
|---|---|---|---|---|---|
| **BT-01** | Cycle de vie événementiel | DRAFT → PENDING_APPROVAL + `TRIP_SUBMITTED` | R222 | **C** | ✅ PASS |
| **BT-02** | Pré-contrôle cross-border par destination | Avis SA `sollicitation=INTERDITE` attaché ; **le statut ne change pas** (l'avis ne décide pas) | R223 | **C** | ✅ PASS |
| **BT-03** | KYC non approuvé — INFORMATIF | Signal `KYC_NOT_APPROVED` ; **approbation possible** | R224 | **M** | ✅ PASS |
| **BT-04** | KYC non approuvé — BLOQUANT | Visa refusé : **`TRIP_KYC_NOT_APPROVED`** | R224 | **C** | ✅ PASS |
| **BT-05** | Visa uniforme + matrice tenant | 2 visas (SUPERIEUR + COMPLIANCE si destination à risque) ; **APPROVED aux deux signatures** | R225 / R15 | **M** | ✅ PASS |
| **BT-06** | Auto-approbation interdite | **`TRIP_SELF_APPROVAL_FORBIDDEN`** (le voyageur ne vise pas son voyage) | R225 / R13 | **C** | ✅ PASS |
| **BT-07** | Contact reports mesurés | 2 reports manquants notifiés ; **`bloque=false`** (jamais coercitif) | R226 / R39 | **m** | ✅ PASS |
| **BT-08** | Certification à la date du voyage | Cert expirant avant le départ → signal `CERTIFICATION_EXPIRED_AT_TRIP_DATE` (résolue **depuis MOD-43**) | R228 / R237 | **M** | ✅ PASS |
| **BT-09** | Rejeu avec grandfathering | Rejeu au 2026-03-01 → avis **V1** (`SOUMISE_A_LICENCE`, `referentielVersion=2026-01-01`), pas V2 | R229 / R29 | **M** | ✅ PASS |
| **BT-10** | Révision chaînée après approbation | V2 `PENDING_APPROVAL` (revision 2, `previousTripId`=V1) ; **V1 reste APPROVED** | R230 | **M** | ✅ PASS |

**Backend nouveau (spec-first)** : `BusinessTripModule` — `POST /v1/trips` (R222), `POST /:id/submit` (R223/R224/R228/R225),
`POST /:id/visa` (R225/R13/R224), `POST /:id/revise` (R230), `POST /:id/contact-reports/mesurer` (R226/R39),
`GET /:id?asOf=` (R229 rejeu grandfathering), `GET /v1/trips`. **2 modèles Prisma nouveaux** : `Trip` (avis/signaux/visas
projetés à la soumission ; JSON) & `TripVisa` (visa uniforme R15) ; **RLS FORCE tenant** ; baseline régénérée (recette RLS OK).
Registre R-Q enrichi (R223→R228). Cert résolue depuis la table `certifications` de MOD-43 à la **date du voyage** (R237).

**Front** : `BusinessTrip.tsx` (liste/création/soumission ; détail : destinations & avis colorés par verdict, signaux,
visas d'approbation via `<VisaBadge>` **composant unique** R15) + composant FE-TRIP (Vitest+RTL+MSW). **Harnais offline
inchangé à 425** (fakes). e2e **58 → 68**. Front : **35 écrans**.

**R222→R238 : intégralement implémenté** (MOD-43 Vague 13 + MOD-75 Vague 14). Le dossier `spec/proposed-R222-R238/`
n'a plus de règle en attente.
