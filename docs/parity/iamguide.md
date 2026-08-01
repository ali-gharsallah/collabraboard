# Parité — IAM / Sécurité & accès (`iamguide`)

**Source** : `docs/reference/olive-demo.html` — `IamGuideScreen` : 40355–40396 · données 40326–40354.

## Fichiers portés
- `apps/web/src/parity/iam-guide-support.ts` — `IAM_BRIQUES` (6 briques : auth vérifiée, MFA/TOTP, RBAC,
  SSO, rotation JWKS, admin comptes), `IAM_DEMO_STEPS` (scénario de démo 7 min), `IAM_OBJECTIONS`. Verbatim.
- `apps/web/src/parity/IamGuideScreen.tsx` — écran guide/fil-de-démo porté verbatim, 3 onglets :
  « Ce que couvre l'IAM » (cartes briques + preuve tests), « Scénario de démo (7 min) », « Objections
  fréquentes ». Statique (pédagogique).
- Wiring `Shell.tsx` : `case "iamguide"`.

## Réutilise (déjà porté)
- `T` (tokens).

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité.
- Dev-transform esbuild + Playwright : 0 erreur runtime.
