// Config e2e — absente du dépôt fusionné (l'en-tête des specs et le RUNBOOK la citaient
// sans qu'elle existe). ts-jest transforme le TS avec metadata de décorateurs (requis par
// l'IoC NestJS) ; diagnostics désactivés pour que d'éventuelles erreurs de type héritées
// n'empêchent pas l'exécution (mêmes conditions que run-rule-tests.sh --noEmitOnError false).
module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/e2e/**/*.e2e-spec.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  // QUARANTAINE e2e (voir test/e2e/QUARANTINE.md). Les 9 suites autrefois exclues ont été
  // HERMÉTISÉES le 2026-08-05 et RÉINTÉGRÉES : 8 échouaient sur la garde R14 (engagement de
  // responsabilité désormais requis à la validation finale — le test ne l'envoyait pas), sur un
  // signed_by devenu uuid, ou sur les nouvelles clés requises R-Q (AML-gap) du go-live ; la 9e
  // (cloture-demo) avait un grep de source trop large (il confondait l'onglet d'AFFICHAGE
  // « demo » avec une branche de logique métier). Aucune suite ne reste en quarantaine.
  testPathIgnorePatterns: [
    "/node_modules/",
  ],
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
