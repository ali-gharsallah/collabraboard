# Tests rouges — AML gap waves 1+2 (générés)
12 suites (blocs 50–61), rouges par construction : `evaluateScenario` (src/aml/engine.ts) et les fixtures GT n'existent pas encore.
Ordre : implémenter les fixtures d'un bloc → le moteur du bloc → 100 % vert = bloc terminé (DoD).
Ne pas éditer les specs à la main : régénérer via tools/gen_aml_gap.py + ce script (toute évolution de règle = générateur).
Copier data/aml-gap-dataset-gt.json au chemin attendu par fixtures.ts (ou adapter l'import au repo).
