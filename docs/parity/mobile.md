# Fiche de parité — MobileBankingScreen (Mobile Banking) — v1

Source : `docs/reference/olive-demo.html` **32100–32196**. Ports : `MobileBankingScreen.tsx` +
`transfers-support.ts` (moteur transferts partagé). Branché : NAV « Wealth & Marchés » → « Mobile Banking » (`case "mobile"`).

## Porté (v1) — verbatim
- Maquette téléphone : en-tête BANQUE OLIVE SUISSE + salutation multilingue (HELLO/corrLang), pavé PIN
  (4 chiffres → login), 4 onglets bas (Comptes / Titres / Payer / Messages).
- Comptes : courant CHF / dépôt titres (profil PMS) / compte USD (valeurs dérivées de l'AUM).
- Titres : positions `pmsPortfolio` (7 premières) + message dérive.
- Payer : formulaire (bénéficiaire, IBAN, pays, montant) → `transferCreate` (contrôles pré-exécution,
  statut EXÉCUTÉ / PENDING_APPROVAL / BLOQUÉ).
- Messages : conseiller + banque (corrLang).
- Client : premier client exotique (`c.exotic` via exoticOverlay).

## transfers-support.ts (moteur partagé — Mobile / Transferts / Settlement / bouton PMS)
`transferControls` (6 contrôles : sanctions destination, screening bénéficiaire, plausibilité éco,
état KYC, alertes AML, MROS art. 9a, cross-border) + `transferCreate`. **Consigné** : `screenMatch`
(Screening), `cbCountry` (Cross-Border), `AML_ALERTS`, `MROS_REPORTS` stubés neutres → aucun blocage
ajouté ; à rebrancher au portage de ces modules. Les contrôles pays-destination (XFER_SANCTIONED/
SENSITIVE), plausibilité et état KYC restent **réels**.

Preuve : capture → login → Mobile Banking → PIN → 0 erreur runtime. Frontière : 80/80 · budget 177.5 kB gz.
