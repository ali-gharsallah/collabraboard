# CI rouge depuis ~30 runs — faux positif de la garde R329 (constat + correctif)

**Constat (2026-08-07, pendant le lot L6).** Tous les runs CI de la branche depuis au moins le
2026-08-06 16:06 UTC étaient ROUGES sur une seule et même étape : la garde R329
(« la démo n'a aucune voie spéciale »), un grep qui refuse tout `if (demo…)` / `=== "demo"` dans
`apps/api/src` et `apps/web/src`. Toutes les autres étapes (règles, gates moteur, budget bundle,
CPSI, RLS…) passaient.

**Cause.** Trois écrans-guides de la galerie parité utilisent un **identifiant d'onglet** nommé
`"demo"` (l'onglet « Scénario de démo (7 min) » / « Démo / POC ») :
`parity/EditorConsoleScreen.tsx`, `parity/IamGuideScreen.tsx`, `parity/CpsiGuideScreen.tsx`.
C'est un état de navigation UI, **pas** une voie de code conditionnelle au mode démo — l'intention
de R329 (aucun comportement métier spécial en démo) n'était pas violée.

**Correctif retenu.** Renommer les identifiants d'onglet (`"demo"` → `"scenario7min"` / `"poc"`),
**sans toucher à la garde** : affaiblir le grep (exclusions, motifs plus fins) aurait ouvert la
porte à de vrais `=== "demo"` futurs. Les libellés affichés ne changent pas ; aucun lien profond
ne référençait ces IDs (vérifié par grep).

**Leçon.** Un identifiant interne qui porte le même mot qu'un motif de garde CI finit par la
déclencher. Pour les prochains onglets/états : éviter les valeurs littérales `demo`, `test`,
`admin`… qui sont aussi des motifs de gardes.

## Rattrapage des dérives masquées (même journée, après levée du faux positif)

La garde R329 étant en AMONT du pipeline, ~30 runs n'ont jamais exécuté les étapes aval.
Rejouées localement une à une, quatre dérives accumulées pendant la période masquée :

1. **Surface API (RB-07)** — 53 routes ajoutées par les lots L2→L6 (rapports, PEP, listes,
   kyc processes, aml/*) jamais snapshotées → snapshot régénéré (`tools/api-contract/scan.mjs`),
   chaque route correspond à un endpoint volontaire d'un lot committé.
2. **CANON-MASTER (no-drift)** — document régénéré (`run.mjs`), 404 règles / 109 familles.
3. **MG-05 (migrations expand-only)** — la migration de réconciliation `20260805000002` porte
   `ALTER COLUMN "id" DROP DEFAULT` (kyc_processes) : résidu de `db push`, le client fournit
   toujours l'id, et la gate no-drift EXIGE la ligne. Exception DOCUMENTÉE par migration dans
   `tools/migrations/test.mjs` (doctrine EXC-1/EXC-2) — le harnais reste intact ailleurs.
4. **Grep AML Gap** — le générateur publie 27 invariants, la CI en grep-ait 25 → grep aligné.

Vérifié vert localement avant push : gates moteur 3s..3x · migrations 5/5 · FAT 4/4 · BAT 4/4 ·
canon-master 8/8 + --check · AML Gap 27/27 + 11 suites/179 · règles (exit 0) · L2 16/16 ·
registre C5 · frontière L3 · e2e 62 suites/411 · RLS 0 ligne · python 19/19, 11/11, 20/20,
canary, contrat 4/4, PEP↔CPSI 3/3 · front 114/114 + budget.
