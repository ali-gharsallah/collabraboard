# Fiche de parité — CustodyTAScreen (Custody & Transfer Agent) — v1
Source : olive-demo.html **24834–24961**. Ports : `CustodyTAScreen.tsx` + `cta-support.ts` + `wf-styles.ts`.
Branché : NAV Wealth & Marchés → « Custody & Transfer Agent » (`case "custody"`).
Porté verbatim : registre nominatif (TA, parts + % token), positions (Custody), mouvements chaînés
(hash `ctaHash` djb2), modale « Tokeniser un actif » (ajout TKN + registre), modale « Transférer des
parts » (DVP, contrôle solde, mouvement chaîné au registre). Données CTA_TOKENS/REGISTRE/MOUVEMENTS
verbatim. Titre coquille = "custody" (SCREEN_LABEL.custody absent — fallback id, verbatim).
Preuve : capture → 0 erreur runtime. Frontière : 80/80 · budget 177.5 kB gz.
