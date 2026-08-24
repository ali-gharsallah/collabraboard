# Parité — Screening (`screening`)

**Source** : `docs/reference/olive-demo.html`
- `ScreeningTabs` : 39124 · `ScreeningScreen` (watchlists) : 17847 · `ScreeningQualifPanel` : 34107
- `ScreeningBatchPanel` : 34264 · `ScreeningTestPanel` : 34333 · moteur : 33845–34106

## Fichiers portés
- `apps/web/src/parity/screening-support.ts` — **moteur de screening** (appariement d'accolades) :
  `SANCTIONS_DB` (20 entrées OFAC/UE/SECO/ONU), matching flou (`screenNorm` normalisation,
  `screenLev` Levenshtein, `screenSim` tokens/alias, `screenMatch`), `screenHits` (file dérivée des
  dossiers KYC, confiance calculée par attributs : nom 40 · DOB 25 · pays 20 · qualité 15),
  qualification `screenQualify`/`screenConfirmFp` (TP/FP, four-eyes ≥ 80%), re-screening
  `screenRescreenOne`/`screenBatchRun`, adjudication IA locale `aiScreeningAnalyze`/`aiPrioritizeQueue`.
- `apps/web/src/parity/ScreeningScreen.tsx` — `ScreeningTabs` (5 onglets) + 4 panneaux portés verbatim.
- Wiring `Shell.tsx` : `case "screening"`.

## Réutilise (déjà porté)
- `amlHash` (preonboarding-support), `clientById` (components-data), `AML_ALERTS` (aml-workspace-support),
  `KYCS_DATA` (fixture), `pushParamAudit`, `Badge`/`SevPill`/`SectionTitle` (components).

## Réellement calculé (pas figé)
- **Qualification** : 53 hits dérivés des dossiers KYC (cascade enrichScreening), confiance calculée
  par attributs, décision TP (escalade)/FP (levée motivée, four-eyes ≥ 80%), tracée ; priorisation IA.
- **Re-screening** : batch/unitaire déterministe (nouveaux hits / levées auto), rapport de run tracé.
- **Test** : vrai moteur flou sur la base sanctions (ex. « Oleg Deripaska » → 100 % DERIPASKA via alias).
- **Watchlists** : file de hits qualifiables issue de KYCS_DATA.

## Consigné (hors périmètre parité)
- Onglet **« Preuves moteur »** (`MoteurPreuvesPanel`/`OLIVE_PROOFS`) : ce harnais rejoue les **services
  backend** de conformité (R104 · R100→R103 · R30→R36). Backend gouverné → panneau neutre consigné.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`screenHits`, `SANCTIONS_DB`,
  `parity/` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; qualification (53 hits) et moteur flou conformes.
