# Audit de couverture `withTenant()` — RLS runtime

> État à la date de l'audit. Ne remplace pas `docs/multi-tenancy.md` (mécanisme) — le complète
> par la **couverture réelle** des chemins d'accès données.

## 1. Constat central

`withTenant()` (`apps/api/src/common/prisma.service.ts`) **n'a aucun appelant en production**.
Recherche exhaustive sur `apps/api` :

- définition : `src/common/prisma.service.ts:22`
- unique usage : `test/e2e/rls-runtime.e2e-spec.ts` (recette 4b)

Conséquence : sous `FF_RLS_ENFORCED=off` (défaut actuel) **et** connexion en `olive`
(superuser/owner), la RLS est dormante et l'isolation tient par le **filtrage applicatif**
`WHERE tenant_id = ctx.tenantId` (défense en profondeur — à conserver).

Sous `FF_RLS_ENFORCED=on` + rôle non-owner `olive_app`, **chaque requête bare** (sans GUC posé)
verrait 0 ligne. Il faut donc que les chemins d'écriture/lecture métier passent par un GUC
`app.tenant_id` correctement posé.

## 2. Chemins hors requête HTTP (background, `setInterval`)

| Chemin | Fichier | Tenant dispo | Wrappable | Note |
|---|---|---|---|---|
| `OutboxWorker.drainerConsommateur` → `c.handle(ev, this.prisma)` | `outbox.worker.ts:99` | `ev.tenant_id` | **oui** | voir §4 item 1 |
| ↳ `GoldenRecordProjector.handle(ev, db)` | `golden-record.projector.ts` | `ev.tenant_id` | **oui** | utilise le `db` passé + filtre tenant |
| ↳ `CaseProposalConsumer.handle(ev, _db)` | `case-proposal.consumer.ts` | `ev.tenant_id` | **partiel** | délègue à `RiskCaseService` (prisma propre) → GUC non propagé |
| `OutboxWorker.publier` | `outbox.worker.ts:135` | — | **non** | stream global cross-tenant PAR CONCEPTION |
| `OutboxWorker.slaSweep` → `onboarding.tickSla` | `outbox.worker.ts:74` | par tenant | **partiel** | `OnboardingService` a son prisma propre → GUC non propagé |
| SSE `servir()` setInterval | `sse.controller.ts:67` | `ctx.tenantId` (HTTP) | n/a | contexte HTTP ; filtre déjà `WHERE tenant_id` |

### Point d'architecture — l'outbox lit un stream global

`drainerConsommateur` et `publier` lisent `domain_events` **sans filtre tenant** (`WHERE id > lastSeq`,
`WHERE published_at IS NULL`) : c'est un flux unique ordonné, volontairement cross-tenant (R285/R286).
On ne peut donc pas « poser un tenant » pour tout le drain. Le modèle correct (consigne) :

1. lecture **privilégiée** du stream (le worker franchit légitimement les tenants),
2. **par événement**, poser `app.tenant_id = ev.tenant_id` avant d'appeler le handler.

Cela ne bénéficie qu'aux handlers qui **utilisent réellement** le `db`/`tx` passé :
- `golden-record` : ✅ `db.kycFile.findFirst(... ev.tenant_id ...)`, `db.client.findFirst(...)`
- `case-proposal` / `slaSweep` : ❌ délèguent à des services à `PrismaService` **injecté propre** ;
  le `tx` n'y est pas propagé. Leur isolation réelle sous enforcement exige une stratégie GUC
  **request-scoped** (AsyncLocalStorage ou transaction par requête) — refacto à part, non couverte
  ici pour préserver « 506 tests verts » (invérifiable sans e2e Postgres/Docker).

## 3. Les 6 tables filles KYC sans `tenant_id`

`kyc_sections, kyc_questions, kyc_access_rules, kyc_question_history, kyc_visas, kyc_lock_requests`.

La boucle FOREACH de `post-deploy-v2.sql` est gardée par un test
`information_schema.columns … column_name = 'tenant_id'` → ces 6 tables sont **sautées** :
**aucune policy RLS** ne leur est appliquée (malgré `FORCE` posé via la même boucle uniquement
sur les tables tenantées). Sous enforcement, une lecture directe (`SELECT * FROM kyc_visas`)
**fuiterait cross-tenant** : l'isolation transitive par FK reste **applicative**, pas DB.

**Correctif retenu (coût faible)** : policy RLS par **sous-requête FK** sur le parent tenanté —
aucune colonne nouvelle, aucune migration de données. Exemple pour `kyc_sections` :

```sql
CREATE POLICY tenant_isolation ON kyc_sections USING (
  EXISTS (SELECT 1 FROM kyc_files f
          WHERE f.id = kyc_sections.kyc_file_id
            AND f.tenant_id = current_setting('app.tenant_id', true)::uuid));
```

## 4. Livrables (sûrs, 506 verts, filtres applicatifs conservés)

1. **Wrap flag-gated du drain outbox** — `outbox.worker.ts`. Sous `FF_RLS_ENFORCED` :
   `this.prisma.withTenant(ev.tenant_id, (tx) => c.handle(ev, tx))` ; sinon chemin legacy
   `c.handle(ev, this.prisma)` **octet-identique**. Bénéficie à golden-record ; documente la
   limite case-proposal/slaSweep.
2. **Policies FK-subquery** pour les 6 tables filles (`post-deploy-v2.sql`, idempotent).
3. **`docs/rls-cutover-checklist.md`** — bascule 2 temps (`DATABASE_URL → olive_app`, puis
   `FF_RLS_ENFORCED=on`) + rollback.
4. **Recette 4b étendue** (`rls-runtime.e2e-spec.ts`) : RLS-05 (isolation croisée A/B sur
   `clients, kyc_files, personnes, domain_events, documents`) + RLS-06 (isolation transitive
   des 6 filles). Ne s'exécute que sous e2e Postgres → hors des 506.

## 5. Reste à faire (hors périmètre de ce lot)

- **Chemin HTTP** : aucune requête HTTP ne passe par `withTenant()`. L'enforcement réel du
  chemin HTTP demande une stratégie GUC request-scoped (interceptor + AsyncLocalStorage, ou
  transaction-par-requête). Refacto structurante, à planifier avec e2e Postgres actif.
- **`RiskCaseService` / `OnboardingService`** : idem — le GUC doit être posé au niveau de leur
  propre `PrismaService`, pas via le `tx` de l'outbox.
