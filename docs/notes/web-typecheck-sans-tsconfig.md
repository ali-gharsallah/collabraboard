# apps/web : le script `typecheck` échoue faute de tsconfig.json

Constat du 2026-08-10 (lot V2-M8, hors périmètre — consigné sans correction
opportuniste) : `apps/web` n'a **aucun** `tsconfig.json` ; `pnpm run typecheck`
(`tsc --noEmit`) affiche l'aide du compilateur et sort en code 1. La CI est
verte car elle n'exécute pas ce script pour `apps/web` — le typage n'y est
vérifié que par l'éditeur et par esbuild (qui **transpile sans vérifier**).

Options pour un prompt dédié : (a) ajouter un `tsconfig.json` (base Vite React)
et brancher `typecheck` en CI comme pour `apps/api` ; (b) retirer le script
mort. L'option (a) est recommandée — plusieurs erreurs de type ne seraient
aujourd'hui détectées par rien.
