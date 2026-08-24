# Parité — Investigation financière (`invest`)

**Source** : `docs/reference/olive-demo.html`
- `InvestScreen` (écran) : 33016–33082

## Fichiers portés
- `apps/web/src/parity/InvestScreen.tsx` — cas compliance (regroupe ≥2 alertes d'un même client) + synthèse IA.
- Wiring `Shell.tsx` : `case "invest"`.

## Réutilise (déjà porté)
- **`AML_ALERTS`** + `aiContextualizeAlert` (aml-workspace-support) — les cas sont dérivés en direct
  de la file d'alertes AML seedée par la cascade `enrichScreening`.
- `Badge`, `ExportBtn`.

## Consigné
Aucun côté écran. Dépend de `AML_ALERTS` (alertes screening réelles ; alertes transactionnelles
consignées via TX_DATA, cf. aml-workspace.md).

## Réellement calculé
- 8 cas compliance dérivés des 53 alertes AML (clients avec ≥2 alertes convergentes,
  ex. Al-Maktoum SA 3, Nguyen SA 3). Synthèse IA du cas via `aiContextualizeAlert`.

## Vérification
- `pnpm run build` → 0 fuite parité (`cas-compliance`, `Cas compliance`, `parity/` absents de `dist`).
- Playwright : 0 erreur runtime ; 8 cas listés avec compteurs d'alertes exacts.
