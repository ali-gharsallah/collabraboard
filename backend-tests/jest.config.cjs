// Runner des suites AML gap (backend-tests/aml-gap). ts-jest, diagnostics OFF (mêmes conditions
// que apps/api/jest-e2e.config.js). Les blocs 50–60 (R340–R398) doivent être VERTS ; le bloc 61
// (Analytique 2G) reste ROUGE par construction (détecteur délégué au service CPSI Python — décision
// 4). Hors CI par défaut ; le step CI dédié n'exécute que les blocs 50–60 (voir .github/workflows).
module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  testMatch: ["<rootDir>/aml-gap/**/*.spec.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": ["ts-jest", {
      diagnostics: false,
      tsconfig: {
        target: "es2020",
        module: "commonjs",
        moduleResolution: "node",
        esModuleInterop: true,
        resolveJsonModule: true,
        skipLibCheck: true,
        strict: false,
      },
    }],
  },
};
