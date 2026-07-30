# Parité — Comité de paramétrage / owner (`sbowner`)

**Source** : `docs/reference/olive-demo.html`
- `OwnerSandboxScreen` : 19561–19712

## Fichiers portés
- `apps/web/src/parity/OwnerSandboxScreen.tsx` — écran d'**arbitrage** porté verbatim : registre des
  recommandations proposées par les bacs à sable, filtres (en attente/acceptées/refusées/toutes),
  **stress test cumulé** (additionne les impacts des recommandations cochées → jauge de tension),
  **accepter & appliquer** (exécute `r.apply()`, date de mise en vigueur R29) ou **refuser** avec
  motif obligatoire (R7). Chaque décision tracée.
- Wiring `Shell.tsx` : `case "sbowner"`.

## Réutilise (déjà porté)
- `SB_RECOS`/`SB_SOURCES` (sandbox-support — registre partagé alimenté par `sbProposer` des 4 bacs),
  `pushParamAudit`.

## Réellement calculé (pas figé) — chaîne bout-en-bout
- Boucle **proposition → arbitrage** vérifiée en direct : proposer depuis le bac AML (seuils) et le bac
  BRM (bandes) fait apparaître ici RECO-001/RECO-002 avec leur impact mesuré et leur auteur par rôle
  (I. Vernet CO Senior, L. Romano BRM). Cocher plusieurs recommandations cumule leurs impacts
  (+10 alertes · +1 EDD · +10 clients touchés) et calcule la tension combinée — « un changement isolé
  est anodin, dix simultanés noient les équipes ». Accepter exécute réellement le `apply()` de la reco
  (mute le paramétrage en vigueur) ; refuser exige un motif (R7), opposable.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`OwnerSandboxScreen`, `parity/`
  absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; chaîne propose (AML+BRM) → arbitrage conforme.
