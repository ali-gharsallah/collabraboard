# Parité — Legal / Contrats (`legal`)

**Source** : `docs/reference/olive-demo.html`
- `LegalScreen` (écran) : 31951–32036
- `LEGAL_TYPES` / `LEGAL_STATUS` / `LEGAL_CONTRACTS` / `legalGenerate` : 31340–31404

## Fichiers portés
- `apps/web/src/parity/legal-support.ts` — types/statuts, contrathèque générée (amlHash, 45 clients),
  génération de contrat depuis le golden record (profil PMS, frais, langue, RM).
- `apps/web/src/parity/cloison-support.ts` — **module partagé** : `CLOISON_RULES`, `DESKS`,
  `clientVisibleTo` (cloisonnement ALL/DESK/OWN) — réutilisable par toutes les vues à cloisonnement.
- `apps/web/src/parity/LegalScreen.tsx` — 3 onglets (Contrathèque / Échéancier / Générer).
- Wiring `Shell.tsx` : `case "legal"`.

## Réutilise (déjà porté)
- `clientById`, `amlHash`, `pmsPortfolio`/`pmsEnrich` (pms-support), `pushParamAudit`.

## Consigné (hors périmètre, non porté)
- **`GED_DOCS`** (documents GED, source 30297) → file locale `[]` : l'onglet « Générer » alimente
  cette file au lieu de la vraie GED. Contrathèque + échéancier pleinement fonctionnels.
  À rebrancher au portage de l'écran GED vivante.

## Réellement calculé
- 93 contrats générés (types/statuts/versions/échéances via amlHash), 13 échéances < 90 j.
- Génération de contrat remplie depuis le golden record (profil PMS, frais mgmtFee, langue, RM).
- Cloisonnement `clientVisibleTo` appliqué (Patrick Durand = HPB → ALL, voit tout).

## Vérification
- `pnpm run build` → 0 fuite parité (`legalGenerate`, `Contrathèque`, `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; 93 contrats listés, filtres et badges de statut exacts.
