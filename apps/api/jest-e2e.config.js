// Config e2e — absente du dépôt fusionné (l'en-tête des specs et le RUNBOOK la citaient
// sans qu'elle existe). ts-jest transforme le TS avec metadata de décorateurs (requis par
// l'IoC NestJS) ; diagnostics désactivés pour que d'éventuelles erreurs de type héritées
// n'empêchent pas l'exécution (mêmes conditions que run-rule-tests.sh --noEmitOnError false).
module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/e2e/**/*.e2e-spec.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  setupFiles: ["<rootDir>/test/e2e/env.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", {
      diagnostics: false,
      tsconfig: {
        target: "es2020",
        module: "commonjs",
        moduleResolution: "node",
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        // esModuleInterop=false : le code n'utilise que des imports nommés / `import * as`
        // sur des paquets CommonJS ; `import * as request from "supertest"` doit rester
        // appelable (l'interop le remplacerait par un objet non-callable).
        esModuleInterop: false,
        resolveJsonModule: true,
        skipLibCheck: true,
        strict: false,
      },
    }],
  },
  // @olive/shared est un package workspace (source TS) ; on le mappe vers ses sources
  // pour que ts-jest le transforme au lieu de le laisser dans node_modules non transformé.
  moduleNameMapper: {
    "^@olive/shared/(.*)$": "<rootDir>/../../packages/shared/$1",
    "^@olive/shared$": "<rootDir>/../../packages/shared/src/contracts",
  },
};
