// Config ESLint minimale (monorepo, racine). Cible : apps/api/src.
// Extends recommandés (eslint:recommended + typescript-eslint recommended, non type-checkés).
// Aucune règle exotique : on désactive seulement le bruit inadapté à ce code (any assumé,
// non-null assertions, catch vides volontaires du drain), on garde ce qui attrape de vrais
// défauts (imports/variables morts, etc.).
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.mjs",
      "**/*.cjs",
      "**/*.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/api/src/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",          // le code MVP assume `any` (fake Prisma, req.ctx…)
      "@typescript-eslint/no-non-null-assertion": "off",     // assertions ! volontaires (secrets fail-fast)
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],      // catch {} du drain outbox = intentionnel
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
  {
    // Harnais de test autonomes (run-rule-tests.sh) : variables intermédiaires de lisibilité
    // volontairement non lues. On ne modifie pas les tests pour satisfaire le linter.
    files: ["apps/api/src/**/*.spec.ts"],
    rules: { "@typescript-eslint/no-unused-vars": "off" },
  },
);
