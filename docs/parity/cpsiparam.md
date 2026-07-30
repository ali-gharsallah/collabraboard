# Parité — CPSI Règles de calcul (`cpsiparam`)

**Source** : `docs/reference/olive-demo.html`
- `CpsiParamScreen` : 25508–25630

## Fichiers portés
- `apps/web/src/parity/CpsiParamScreen.tsx` — écran « CPSI — Règles de calcul (paramétrage) » :
  colonne **règles en clair** (R68) à côté du **bac à sable** de paramétrage (R70), rapport d'**impact
  simulé** (clients évalués, Δ moyen, nouveaux HIGH, charge de revues, franchissements de bande),
  **propositions d'Olivia** (R69 — adopter/rejeter avec motivation obligatoire), **journal CPSI**
  append-only (R49).
- Wiring `Shell.tsx` : `case "cpsiparam"`.

## Réutilise (moteur déjà porté)
- `cpsi-engine-support` : `CPSI` (cfg/journal), `cpsiStats`, `cpsiDecrireRegles`, `cpsiSimuler`,
  `cpsiAppliquer`, `cpsiPropositions`, `cpsiCandidatDeProposition`, `cpsiLog`, `cpsiUserNom`.

## Adaptation ESM
- `CPSI_USER = user` (source) → `cpsiSetUser(user)` (bindings ESM en lecture seule).

## Réellement calculé (pas figé)
- **Simuler l'impact** rejoue les scores CPSI sur la population avec les poids/half-life/bandes saisis
  (bac à sable — rien n'est modifié) : 84 clients évalués, franchissements de bande listés.
- Garde R70 : « Appliquer » reste désactivé tant que la signature du candidat ne correspond pas à la
  dernière simulation.
- Propositions d'Olivia (poids_signaux.alerte_fondee → 18 ; half_life_jours → 120) adoptables/rejetables,
  chaque décision journalisée (R44/R69).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`cpsiCandidatDeProposition`,
  `cpsiEnrichir`, `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; règles/paramétrage/impact simulé/propositions/journal conformes.
- En-tête « cpsiparam » (id brut) = comportement source fidèle (`SCREEN_LABEL[screen] || screen`,
  aucune entrée `cpsiparam` dans la table source).
