# Parité — CPSI Profilage continu / guide (`cpsiguide`)

**Source** : `docs/reference/olive-demo.html`
- `CpsiGuideScreen` : 18805–18867 · données `CPSI_ETAPES`/`CPSI_PIEGES`/`CPSI_DEMO` : 18774–18804

## Fichiers portés
- `apps/web/src/parity/cpsi-guide-support.ts` — **données du guide extraites verbatim** :
  `CPSI_ETAPES` (7 étapes du profilage), `CPSI_PIEGES` (4 pièges & réponses), `CPSI_DEMO` (scénario 7 min).
- `apps/web/src/parity/CpsiGuideScreen.tsx` — écran pédagogique à 3 onglets (process / démo / pièges),
  breadcrumb de la chaîne CPSI (Population → Groupes → Scénarios & seuils → Franchissements →
  Signaux (dédup) → Score & bandes → Propositions).
- Wiring `Shell.tsx` : `case "cpsiguide"`.

## Contenu (documentaire, pas de moteur)
- Fil conducteur de démo : franchissement ≠ alerte, seuils par groupe (proportionnalité FINMA),
  demi-vie des signaux, décision humaine (R44/R39), preuve à date (Audit).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`CPSI_ETAPES`, `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; 7 étapes, breadcrumb et onglets conformes à la source.
