# Tests d'Acceptation Fonctionnelle — Vague 10 (Front-câblage v2, phase 1 : FE-CORE + Ports + NBA)

**Exécutés le 2026-07-26** — backend réel : 2 FAT (`apps/api/test/e2e/fat-vague10.e2e-spec.ts`,
preuve `docs/tests/PREUVES/fat-vague10-run.txt`) ; couche front FE-CORE : 5 tests Vitest
(`apps/web/src/lib/api.test.ts`, preuve `docs/tests/PREUVES/fe-core-vitest.txt`). Statut : **2/2 + 5/5 PASS**.
Objet : `SPEC-FRONT-CÂBLAGE v2` — écrans **Ports** (FE-PORT) et **Next Best Action** (FE-NBA), sur la
couche **FE-CORE** (`src/lib/api.ts`). Décisions actées (cf. `docs/ECARTS-FRONT.md`) : portes minces où un
service ratifié existe · JWT par défaut · adoption incrémentale · préfixe `/v1`. **Zéro invention.**

Légende criticité : **C** = critique · **M** = majeur · **m** = mineur.

## Backend réel (Ports — porte mince, projection des ports ratifiés)

| ID FAT | Persona | Objectif métier | Préconditions | Étapes | Résultat attendu | Règle / exigence | Criticité | Statut |
|---|---|---|---|---|---|---|---|---|
| **FAT-PORT-01** | Admin | Voir l'état des ports sans jamais voir de secret | Tenant nu | 1. J'ouvre `/v1/ports`. | **3 ports RATIFIÉS** (core-banking R167, ia R163, storage R180) ; tenant nu → tous **NOT_CONFIGURED** ; **aucun secret** dans la charge ; fx/custody/mobile **non listés** (non ratifiés). | R167/R163/R180 (projection) · « pas de secret » | **C** | ✅ PASS |
| **FAT-PORT-02** | Admin | Configurer un port est un acte gouverné, reflété par l'état | — | 1. Je déclare `coreSystemeRef` au registre (motivé, R126). 2. Je relis `/v1/ports` + health. 3. Je teste un port inconnu. | core-banking → **CONFIGURED** ; `health` = CONFIGURED + `checkedAt` ; port inconnu `fx` → **404** (jamais fabriqué). | R167 / R126 | **M** | ✅ PASS |

## Front FE-CORE (couche API et session — Vitest, `src/lib/api.ts`)

| ID | Objectif | Vérifié | Exigence | Statut |
|---|---|---|---|---|
| **FE-01** | Mode seed sans backend | `OLIVE_API_URL` absent → lecture retombe sur le seed (`isDemo=true`) ; écriture `apiPost` refusée (`DEMO_MODE`). | FE-01 | ✅ PASS |
| **FE-02** | Propagation des en-têtes | headers-mode → requête portant `x-tenant-id/x-user-id/x-user-role` ; **FE-02bis** JWT (défaut) → `Authorization: Bearer`, pas de `x-*`. | FE-02 / auth | ✅ PASS |
| **FE-03** | Rejeu à date (R48/R49) | `OLIVE_AS_OF` → `?asOf=` propagé ; vue historique → écriture refusée (`HISTORICAL_VIEW`). | FE-03 / R48 | ✅ PASS |
| **FE-04** | Erreur métier non traduite | `422 { code, message }` → `OliveError` porte `code`/`status`/`message` **serveur, tel quel**. | FE-04 | ✅ PASS |

**Porte backend nouvelle** : `GET /v1/ports`, `GET|POST /v1/ports/:portId/health` (`PortsModule`, lecture pure).
Le statut d'un port se déduit de la **présence** de sa config au registre R-Q (clés `coreSystemeRef`/
`iaProviderRef`/`docStorage`) — **jamais du secret**, qui ne transite pas. **Aucun modèle Prisma nouveau.**

**Écrans front** : `Ports.tsx` (FE-PORT, `<PortPanel>` : refus gracieux, « Re-tester » relit l'état sans
mutation optimiste) et `NextBestAction.tsx` (FE-NBA, lecture des gestes R187 avec cadre R44 ; la **route de
décision** NBA n'étant pas ratifiée, les actions Accepter/Ajuster/Rejeter sont **présentées mais désactivées**
— en attente de canon, jamais inventées). Couche `src/lib/api.ts` étendue (apiPost, asOf, OLIVE_AUTH_MODE) +
hook `useApiOrSeed`. **Vitest** introduit de façon incrémentale (`pnpm --filter web test:unit`).

## Écarts signalés (non résolus par invention — `docs/ECARTS-FRONT.md`)

- **Workflow Instances (FE-WFI)** et **Tâches (FE-TASK)** : **GELÉS** — aucun service ratifié (workflow = *définitions* R171-173 ; pas de backlog de tâches). Non codés.
- **Décision NBA** (`POST /nba/:id/decision`) : non ratifiée — écran NBA en lecture seule.
- **Ports fx/custody/mobile** : non ratifiés — non listés.
- **Auth headers-mode** : câblée mais **inerte** (le backend exige JWT RS256).
- **Zone canon manquant** (Command Center, Investigation, SWIFT, Legal, Octopulse, CPSI-Nest, Olivia/BI, IAM/SSO écrans, Audit) : **zéro code**.
- **R222..R238** (Business Trip / Formations) : **PROPOSÉES, gelées** — Gherkin seul dans `spec/proposed-R222-R238/` (attente « OK pour R222..R238 »).
