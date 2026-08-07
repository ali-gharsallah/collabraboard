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
