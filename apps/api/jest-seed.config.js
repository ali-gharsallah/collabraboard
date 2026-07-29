// Config du SEED démo (dette §11) — même machinerie ts-jest que l'e2e, périmètre disjoint :
// test/seed/*.seed.ts n'est JAMAIS ramassé par la suite e2e (testMatch distinct) et ne
// s'exécute que par `npm run seed:demo` avec la garde OLIVE_SEED_DEMO=1 (cf. le script).
const base = require("./jest-e2e.config.js");
module.exports = { ...base,
  testMatch: ["<rootDir>/test/seed/**/*.seed.ts"],
  setupFiles: ["<rootDir>/test/e2e/env.ts"],
};
