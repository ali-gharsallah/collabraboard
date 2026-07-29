// Catalogue des PARCOURS FAT (Factory Acceptance Test) — R332/FB. Chaque parcours est un
// voyage MÉTIER bout-en-bout ; il déclare les scénarios (identifiants de tests e2e RÉELS) et
// les règles (Rxxx) qu'il traverse, et le rôle du jeton de fixtures qui le porte. Le tracer
// VÉRIFIE que chaque scénario déclaré est adossé à un vrai test e2e et chaque règle au canon :
// la matrice de traçabilité n'est donc jamais de la fiction (FB-02). DEMO-SCRIPT est un
// parcours FAT à part entière (FB-04) — la démo n'a aucune voie spéciale (R329), elle est
// recette au même titre que les autres.
//
// SUBSTRAT (décision PO 2026-07-29) : parcours API à jetons réels = PORTE CI bloquante ;
// un job Playwright « recette visuelle » (non bloquant) double les parcours phares.

export const parcours = [
  {
    id: "PARC-KYC-AML",
    nom: "Ouverture de relation & surveillance AML",
    description: "Le client entre (KYC), la transaction est jaugée, l'alerte AML naît et se qualifie.",
    jetonRole: "CO_SR",
    scenarios: ["KYC-01", "KYC-02", "AML-01", "AML-02"],
    regles: ["R189", "R206"],
    e2e: "fat-vague1",
  },
  {
    id: "PARC-COC",
    nom: "Change of Circumstances",
    description: "Un changement de circonstances rouvre la revue et re-jauge le risque.",
    jetonRole: "CO",
    scenarios: ["CC-01", "CC-03", "CC-06", "CC-08", "RV-04"],
    regles: ["R133", "R136"],
    e2e: "fat-coc",
  },
  {
    id: "PARC-REVIEW",
    nom: "Revue périodique gouvernée",
    description: "La revue s'ouvre, se documente, se décide à quatre yeux, se clôt et se trace.",
    jetonRole: "CO_SR",
    scenarios: ["RV-01", "RV-03", "RV-05", "RV-08"],
    regles: ["R283"],
    e2e: "fat-reviews",
  },
  {
    id: "PARC-OFFBOARDING",
    nom: "Clôture de relation (art. 10a cloisonné)",
    description: "La sortie est gouvernée, sans oracle d'existence, art. 10a cloisonné.",
    jetonRole: "CO_SR",
    scenarios: ["OF-01", "OF-04", "OF-07", "OF-11", "OF-12"],
    regles: ["R267", "R271"],
    e2e: "fat-offboarding",
  },
  {
    id: "PARC-OLIVIA",
    nom: "Assistant compliance (propose / humain décide)",
    description: "Olivia s'ancre, propose une carte, jamais en prose ; l'humain décide (R44).",
    jetonRole: "CO_SR",
    scenarios: ["OL-01", "OL-16", "OL-24", "OL-32"],
    regles: ["R253", "R254", "R258"],
    e2e: "fat-olivia",
  },
  {
    id: "PARC-DEMO",
    nom: "Démo GWB — histoire complète (DEMO-SCRIPT)",
    description: "Le tenant de démo rejoue l'histoire bout-en-bout ; la démo est un tenant ordinaire.",
    jetonRole: "CO_SR",
    scenarios: ["DM-01", "DM-02", "DM-03"],
    regles: ["R329"],
    e2e: "fat-cloture-demo",
  },
];
