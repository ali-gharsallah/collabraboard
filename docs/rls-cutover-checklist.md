# RLS cutover — checklist de bascule en 2 temps (+ rollback)

> Runbook opérationnel pour passer la RLS de **prouvée-mais-dormante** à **enforced en ligne**.
> Complète `docs/multi-tenancy.md` (modèle) et `docs/rls-coverage-audit.md` (couverture).
> **Rien ici ne supprime le filtrage applicatif `WHERE tenant_id` (Couche 1, défense en profondeur).**

## 0. Modèle mental

Deux leviers **indépendants**, à activer dans l'ordre :

1. **`DATABASE_URL → olive_app`** (rôle non-owner, non-super) : sans ça, l'app tourne en `olive`
   (superuser/owner) qui **bypasse** la RLS FORCE — l'enforcement serait un no-op.
2. **`FF_RLS_ENFORCED=on`** : `withTenant()` pose `SET LOCAL app.tenant_id` par transaction.

Tant que (1) n'est pas fait, (2) seul ne change **rien** au runtime (bypass superuser).
Tant que (2) n'est pas fait, (1) seul **casserait** tout accès (0 ligne, aucun GUC posé).
→ L'ordre 1-puis-2 n'est jamais simultané en prod : voir le déroulé canari ci-dessous.

## 1. Pré-requis BLOQUANTS (à valider AVANT toute bascule prod)

- [ ] **Couverture des chemins d'accès** (`docs/rls-coverage-audit.md`). En enforced, TOUTE
      requête hors `withTenant()` voit 0 ligne. À ce jour :
  - [ ] **Chemin HTTP** : aucune requête HTTP ne passe encore par `withTenant()`. **Prérequis
        n°1** = stratégie GUC request-scoped (interceptor NestJS + AsyncLocalStorage, ou
        transaction-par-requête) OU migration explicite service par service. **Sans ça, ne PAS
        flipper (2) en prod** — l'app renverrait des listes vides.
  - [x] **Outbox drain → golden-record** : wrappé `withTenant(ev.tenant_id, …)` sous le flag.
  - [ ] **`RiskCaseService` / `OnboardingService` (case-proposal, slaSweep)** : utilisent leur
        `PrismaService` propre → le `tx` de l'outbox ne propage pas le GUC. À migrer avant flip.
- [ ] **Policies FK des 6 tables filles KYC** présentes (`post-deploy-v2.sql §2a-bis`) — sinon
      lecture directe cross-tenant. Vérifier : `SELECT tablename FROM pg_policies WHERE tablename
      IN ('kyc_sections','kyc_questions','kyc_access_rules','kyc_question_history','kyc_visas',
      'kyc_lock_requests');` → 6 lignes attendues.
- [ ] **Recette 4b + RLS-01..06 vertes** en CI e2e (Postgres) sur la cible.
- [ ] **Durcissement policy recommandé** (expand-only, R334) pour éviter le rejet dur si un GUC
      retombe à `''` sur une connexion réutilisée :
      `tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid` (→ 0 ligne au lieu
      d'une erreur `invalid input syntax for type uuid: ""`). À appliquer sur `tenant_isolation`
      AVANT de flipper le flag.
- [ ] **Rôle `olive_app` créé & aligné** : `NOSUPERUSER NOBYPASSRLS`, non-propriétaire des tables,
      `GRANT SELECT/INSERT/UPDATE/DELETE` sur le schéma applicatif, `GRANT USAGE` sur les séquences.
      Vérifier RLS-02 : `rolsuper=false`, `rolbypassrls=false`, pas owner.

## 2. Bascule (déroulé canari)

> Fenêtre de faible trafic. Un environnement **staging** identique doit avoir passé les mêmes pas.

### Temps 1 — connexion non-owner
1. [ ] Appliquer `prisma:post` (idempotent) sur la cible → policies + FORCE à jour (dont §2a-bis).
2. [ ] Poser `FF_RLS_ENFORCED=on` **d'abord** (encore en `olive` → RLS bypassée, mais `withTenant`
       commence à poser le GUC : aucun effet négatif, permet de « chauffer » les chemins wrappés).
3. [ ] **Canari** : router 1 instance sur `DATABASE_URL=…olive_app`. Surveiller :
   - taux d'erreur 5xx, listes vides anormales, `invalid input syntax for type uuid`,
   - `[outbox] tick/slaSweep` sans montée d'erreurs, watermark qui progresse,
   - `/readyz` vert.
4. [ ] Si canari sain ≥ 30 min → basculer **toutes** les instances sur `olive_app`.

### Temps 2 — vérification enforced
5. [ ] Preuve en ligne : en `olive_app`, une requête **bare** (hors `withTenant`) sur `clients`
       renvoie **0 ligne** ; via `withTenant(tenantA)` → seulement le tenant A.
6. [ ] Journal outbox : golden-record continue de projeter (kyc.validated → Client) sans dead-letter
       en hausse.

## 3. Rollback (immédiat, sans perte de données)

Les deux leviers sont réversibles indépendamment ; **aucune donnée n'est migrée** à la bascule.

- **Symptôme : listes vides / 5xx massifs après Temps 1**
  1. [ ] Re-router `DATABASE_URL → olive` (superuser/owner) : la RLS FORCE est de nouveau bypassée,
         Couche 1 (filtrage applicatif) reprend seule. Effet immédiat, pas de redeploy schéma.
  2. [ ] Optionnel : `FF_RLS_ENFORCED=off` pour revenir au chemin legacy octet-identique.
- **Symptôme : erreur `invalid input syntax for type uuid: ""`**
  → un chemin bare a réutilisé une connexion pool sans GUC. Rollback `DATABASE_URL → olive`,
    puis appliquer le durcissement `NULLIF(...)` (§1) avant nouvelle tentative.
- **Les policies restent en place** au rollback (elles sont inertes sous `olive`). Pas besoin de
  `DROP POLICY` : `post-deploy-v2.sql` est idempotent et les policies ne gênent pas un superuser.

## 4. Ce que la bascule NE fait PAS

- Elle ne supprime aucun `WHERE tenant_id` applicatif (Couche 1 reste la défense de tête).
- Elle ne modifie aucune ligne de données (pas de migration expand/contract déclenchée ici).
- Elle n'active pas à elle seule l'enforcement du chemin HTTP (voir pré-requis §1).
