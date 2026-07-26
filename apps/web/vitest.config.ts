import { defineConfig } from "vitest/config";

// Vitest — introduit de façon INCRÉMENTALE (SPEC-FRONT-CÂBLAGE v2, décision « au fil des nouveaux
// blocs »). Couvre la couche FE-CORE (src/lib/api.ts) : modes d'auth, rejeu à date, erreurs
// normalisées. jsdom fournit window/sessionStorage. N'affecte pas `vite build`.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: true,
  },
});
