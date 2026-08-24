# Parité — Administration (`admin`)

**Source** : `docs/reference/olive-demo.html`
- `AdminScreen` : 40526–40636 · `UserCreateModal` : 39207–39295 · `ADMIN_NAV` : 39881 · `SCOPE_OPTS` : 39135

## Fichiers portés
- `apps/web/src/parity/admin-support.ts` — `ADMIN_NAV` (barre latérale 30 panneaux, 4 groupes),
  `SCOPE_OPTS` (4 périmètres de visibilité), `WF_ROLE_UNIVERSE`, `wfEmit` (no-op consigné).
- `apps/web/src/parity/AdminScreen.tsx` — hub d'administration porté verbatim (barre latérale
  ADMIN_NAV + zone de contenu). Onglet **Utilisateurs & rôles (RBAC)** et **Créer un utilisateur**
  pleinement fonctionnels :
  - table des utilisateurs (dérivée de `USERS`, hors EDITOR) : rôle, équipe, authentification Local/SSO,
    MFA, statut, actions **Activer/Désactiver** et **Réinit. MFA** — chaque acte tracé au `PARAM_AUDIT` ;
  - **`UserCreateModal`** : nom → email généré automatiquement, mot de passe, rôle (univers WF + ADMIN/
    AUDIT/SECU), département auto-déduit, **scope client** (4 périmètres), MFA obligatoire — création
    poussée dans `USERS`, tracée (audit + `PARAM_CHANGED`).
- Wiring `Shell.tsx` : `case "admin"`.

## Réutilise (déjà porté)
- `USERS` (fixture), `Badge`/`SectionTitle` (components), `ROLE_LABELS` (offboarding-support),
  `pushParamAudit`.

## Réellement calculé (pas figé)
- Créer un utilisateur l'ajoute réellement au référentiel `USERS` (visible au sélecteur de connexion) ;
  activer/désactiver et réinitialiser la MFA mutent la vue en direct et se tracent. L'email est généré
  déterministiquement du nom, le département et le scope se déduisent du rôle.

## Consigné (hors périmètre parité)
- Les **28 autres panneaux d'administration** (matrice documentaire, matrice des droits, cloisonnement,
  LDAP, PMS/Cross-Border/pays à risque/sanctions/gouvernance/Business Trip/Account Review/offboarding
  admin, KYC types, workflows, référentiels, scoring, scénarios AML, registre R-Q, licences vendor,
  résilience…) → panneau de consignation neutre. Ce sont des modules gouvernés, souvent déjà présents
  comme écrans dédiés ailleurs. L'onglet Utilisateurs & rôles est le cœur IAM (MOD-30) et reste complet.

## Vérification
- `pnpm run test:unit` → 80/80 · `pnpm run build` → 0 fuite parité (`AdminScreen`, `ADMIN_NAV` absents de `dist`).
- Dev-transform esbuild + Playwright : 0 erreur runtime ; table RBAC + création d'utilisateur conformes.
