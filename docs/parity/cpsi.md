# Parité — Profilage CPSI (`cpsi`)

**Source** : `docs/reference/olive-demo.html`
- `CpsiScreen` : 25445–25488 · `CpsiAiguillageCard` : 25489–25508 · `CpsiInsiderCard` : 27218–27265
- Moteur CPSI : 25322–25444 (données + score) + 25795–25969 (aiguillage, enrichissement, initiés) + 26041–26068 (groupes)

## Fichiers portés
- `apps/web/src/parity/cpsi-engine-support.ts` — **moteur CPSI complet** : tables de risque
  (pays/structure/secteur), `CPSI_DEFAUTS`, population enrichie (`cpsiEnrichir`, LCG déterministe par id),
  score statique+comportemental à demi-vie (`cpsiScore`), bandes, stats, propositions d'aiguillage
  (`cpsiPropositionsAiguillage`/`Adopter`/`Rejeter`), liste d'initiés MAR (`cpsiInsiders`/`Tagger`/`Lever`),
  groupes de population (`cpsiGroupePredicatVrai`/`cpsiMembres`/`cpsiDecrireGroupes`), `CPSI_OPS`/`CPSI_OPLIB`.
- `apps/web/src/parity/CpsiScreen.tsx` — écran Profilage + carte Aiguillage + carte Initiés MAR.
- Wiring `Shell.tsx` : `case "cpsi"`.

## Réutilise (déjà porté)
- `AML_ALERTS` (aml-workspace-support) — alimente les **signaux comportementaux** (alerte_fondee/non_fondee).
- `CPSI_GROUPES` (cpsi-data-support), `CLIENTS`/`KYCS_DATA`, `pushParamAudit`.

## Adaptation ESM
- `CPSI_USER` (réassigné dans la source) → holder local + `cpsiSetUser(user)` (bindings ESM en lecture seule).

## Réellement calculé (pas figé)
- Score perpétuel par client : statique (pays/structure/PEP/secteur) + comportemental
  (Σ signaux × sévérité × 2^(−âge/half-life=180j)), plafonné 100, bandes LOW/MEDIUM/HIGH.
- Répartition HIGH avec drivers (ex. Al-Maktoum/Nguyen 100 ; Haddad Trust 73.68 dont alerte_fondee@J-1 +35.86).
- Propositions d'aiguillage (durcissement/allègement, décision humaine R44), liste d'initiés MAR (5, hash déterministe).
- Habilitation initié : réservée aux rôles compliance (HPB = lecture seule, fidèle).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`cpsiEnrichir`,
  `cpsiPropositionsAiguillage`, `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; règles, répartition HIGH et liste d'initiés exactes.
