# O-Live — Modèle multi-tenant (Bloc D, pour CISO / due diligence)

**Modèle : `tenant_id` par ligne + Row Level Security PostgreSQL en `FORCE`.** Pas de schéma
par tenant, pas de base par tenant. Deux couches d'isolation, indépendantes :

## Couche 1 — filtrage applicatif (active aujourd'hui)
Le middleware (`tenant.middleware.ts`) extrait `tenant_id` du JWT (RS256/JWKS) → `req.ctx`.
Chaque service filtre explicitement `WHERE tenant_id = ctx.tenantId`. C'est l'isolation runtime
**effective aujourd'hui**.

## Couche 2 — RLS FORCE en base (défense en profondeur, prouvée)
`post-deploy-v2.sql` : `ENABLE`+**`FORCE ROW LEVEL SECURITY`** + policy
`tenant_isolation USING (tenant_id = current_setting('app.tenant_id')::uuid)` sur toutes les
tables tenantées ; rôle applicatif **`olive_app`** (non-superuser, non-propriétaire).
**Preuves automatisées** :
- recette CI **4b** : en `olive_app` **sans** GUC → **0 ligne** (SQL direct, pas via l'API) ;
- **RLS-01..04** (`test/e2e/rls-runtime.e2e-spec.ts`) : `withTenant()` pose `app.tenant_id` en
  SET LOCAL sous `FF_RLS_ENFORCED` (RLS-01) ; `olive_app` n'est ni superuser ni propriétaire
  (RLS-02, anti-bypass) ; **avec** le GUC on ne voit QUE son tenant, **sans**, zéro (RLS-03) ;
  hors de sa transaction scopée, aucune fuite du tenant précédent (RLS-04).

## État runtime & activation (déploiement en 2 temps)
**Aujourd'hui, l'app se connecte en `olive` (superuser, propriétaire des tables) → la RLS FORCE
est CONTOURNÉE au runtime** (un superuser bypasse la RLS). L'isolation runtime tient donc par la
Couche 1. La Couche 2 est **prouvée disponible** mais pas encore enforced en ligne.

**Activation (T2)** — bascule vers l'enforcement DB, sans perte de données :
1. Basculer `DATABASE_URL` vers le rôle **`olive_app`** (non-owner, non-super).
2. `FF_RLS_ENFORCED=on` : `withTenant()` pose le `SET LOCAL app.tenant_id` par transaction.
3. **N'accéder à la DB QUE via `withTenant()`** en mode enforced (jamais de requête « bare » :
   sur une connexion réutilisée du pool, le GUC retombe à `''` et `''::uuid` rejette — voir RLS-04).
4. **Durcissement recommandé** de la policy à l'activation :
   `tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid` → 0 ligne au lieu du
   rejet dur (expand-only, R334).

## Écart consigné
`withTenant()` est la brique sanctionnée ; **64 fichiers utilisent encore des requêtes Prisma
directes** (hors transaction). En mode legacy (flag off, connexion `olive`), ils sont couverts
par la Couche 1 (filtrage applicatif). Leur **migration progressive vers `withTenant()`** est le
chemin d'adoption avant de basculer `FF_RLS_ENFORCED=on` en production. Aucun de ces fichiers ne
fuit aujourd'hui : le filtrage applicatif est systématique (prouvé GLD-01, RLS croisée).
