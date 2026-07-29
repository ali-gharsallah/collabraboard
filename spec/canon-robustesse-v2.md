# CANON — ROBUSTESSE O-Live, SPEC v2 ADAPTÉE (exploration approfondie, PROPOSÉ)

Prolonge `canon-robustesse-adaptation.md` (v1) avec les faits vérifiés dans le code réel. La
spec source vise une O-Live **Python/FastAPI/Alembic event-sourcée** ; le dépôt est
**NestJS/Prisma/PostgreSQL**. Aucun code écrit ; ceci est la proposition à ratifier.

## 1. Résumé d'architecture (vérifié)

- **Pattern de persistance = CRUD-primaire + journal d'événements append-only (PAS event
  sourcing).** Les services écrivent les **tables d'état comme source de vérité** (ex.
  `kyc.service` : `tx.kycFile.create/update`×6, `kycAccessRule`, `kycLock.upsert`,
  `kycLockRequest.delete/upsert`, `kycQuestion.update`) **et** appendent `tx.domainEvent.create`
  (journal/outbox, append-only par trigger `outbox_guard`, chaînage `record_hash/prev_hash`).
  L'état n'est **pas** reconstruit depuis les événements ; `domain_events` sert audit +
  intégration + quelques **projections** (`GoldenRecordProjector`, case proposals) alimentées
  **de façon ASYNCHRONE** par `OutboxWorker` (`published_at`).
- **Injection tenant dans Prisma = niveau APPLICATIF, pas `SET LOCAL`.** Le middleware
  (`tenant.middleware.ts`) extrait `tenantId` du JWT (RS256/JWKS) → `req.ctx`. `forTenant()`
  (`prisma.service.ts`) est un **stub NO-OP** : son `$extends` rend `query(args)` sans jamais
  poser `app.tenant_id`. **Aucun code runtime** n'exécute `set_config('app.tenant_id')`
  (grep : seulement des commentaires). L'isolation runtime repose donc sur le **filtrage
  applicatif explicite** `WHERE tenant_id = ctx.tenantId` dans les services.
- **Rôle DB applicatif = `olive`, SUPERUSER, propriétaire des 79 tables → RLS CONTOURNÉE au
  runtime.** `pg_roles` : `olive super=true`, `olive_app super=false bypassrls=false`,
  `pg_tables` : les 79 tables appartiennent à `olive`. Un **superuser bypasse la RLS même en
  `FORCE`**. `DATABASE_URL=postgresql://olive:...` partout (`.env`, CI). Le rôle non-owner
  `olive_app` n'est utilisé QUE par la recette 4b (qui prouve l'isolation SQL, sans GUC → 0 ligne).

## 2. Verdicts sur les 3 vérifications demandées

| Vérification | Verdict |
|--------------|---------|
| **Event store ou CRUD ?** | **CRUD-primaire** (tables d'état = vérité) **+ journal append-only** `domain_events` (outbox/audit) + projections outbox async. PAS d'event sourcing. |
| **Tenant injecté via `SET LOCAL` transactionnel ?** | **NON.** `forTenant()` est un no-op ; aucun `SET LOCAL app.tenant_id` runtime. Isolation runtime = **filtrage applicatif**. |
| **Rôle DB non-owner ?** | **NON.** L'app tourne en `olive` (**superuser + propriétaire**) → **RLS FORCE contournée au runtime** (le « piège classique » de la spec est présent). `olive_app` (non-owner) existe mais n'est pas utilisé par l'app. |

## 3. Écarts bloc par bloc (3 statuts)

| Bloc | Objet | Statut | Justification / preuve attendue |
|------|-------|--------|--------------------------------|
| **0** (R335/RB) | Baseline, flags, rollback | **FAIT** | Flags RB-01..05 · snapshot surface API RB-06..07 (321 routes, no-drift) · golden invariants GLD-01..05 (isolation, RBAC, 4-yeux, append-only) · docs rollback/flags · tag `baseline-pre-robustness`. e2e **341/341**. Backups/CI/R334 = existants, référencés. |
| **A** (R336/LK) | Locking optimiste | **FAIT (mécanisme + preuve, sur `kyc_files`)** | Colonne `version` sur `kyc_files` (migration expand-only) + helper `majVersionnee()` (`UPDATE … WHERE id AND version`, version++) sous `FF_OPTIMISTIC_LOCKING` (défaut off = **shadow** : signale un conflit mais applique en legacy) + `ConcurrencyConflictError` → **filtre global 409** typé. Prouvé : **LK-01/03** (harnais : conflit/shadow/succès + mapping 409), **LK-02** (concurrence RÉELLE : 2 écritures même version → 1 réussit, 1 conflit), **LK-04** (atomicité : rollback si échec après 1re écriture). Adoption progressive aux autres tables d'état (`kyc_locks`, `coc_files`, `tx_verdicts`, `risk_cases`) = même patron, consigné. |
| **B** (R337/IDM) | Idempotence commandes | **À ADAPTER** | Applicable tel quel, en NestJS : garde/dépendance `Idempotency-Key` + table `processed_commands` écrite **dans la même transaction** que l'écriture d'état + l'append d'événement. Rejeu → réponse snapshotée. |
| **C** (R338/PJ) | Projections reconstructibles | **DÉJÀ (part.) + N/A (part.)** | Projections **event-derived** (golden record, case proposals) **existent déjà** via outbox **ASYNC** — ce qui **contredit** l'exigence spec « synchrone, sans bus » ⇒ cette exigence est **N/A** (choix assumé d'O-Live). Adaptation : (a) documenter le modèle outbox ; (b) test de **reconstructibilité** des SEULES projections dérivées d'événements (rebuild vs incrémental) ; (c) PAS de rebuild du CRUD (il n'est pas dérivé d'événements). |
| **D-runtime** (existant) | Multi-tenancy RLS | **FAIT (pragmatique : prouvé + documenté)** | `withTenant()` RÉEL (flag `FF_RLS_ENFORCED`, défaut OFF = legacy) remplace le stub mort `forTenant` : sous flag, `SET LOCAL app.tenant_id` par transaction. **RLS-01..04** prouvent : mécanisme SET LOCAL · `olive_app` non-super/non-owner (anti-bypass) · enforcement réel (avec GUC → son tenant, sans → 0) · pas de fuite hors tx. `docs/multi-tenancy.md` (CISO) + activation 2-temps. **Écart consigné** : 64 fichiers en requêtes directes restent couverts par le filtrage applicatif (migration progressive vers `withTenant` = chemin d'adoption avant `FF_RLS_ENFORCED=on`). NON enrobé les 64 fichiers (décision PO : pragmatique). |
| **E** (R339/EV) | Versioning/upcasting | **À ADAPTER** | Applicable : `event_version` sur `domain_events` (+ backfill 1, colonne déjà absente à ajouter en expand-only), désérialisation centralisée + registre d'upcasters `dict→dict` en **TS/zod** (pas Pydantic), fixtures `legacy_events/`. Upcast à la LECTURE seule (event store append-only, R48). |

**Non applicables (à ne pas implémenter)** : `load_aggregate()`/append-events-only (pas d'event
sourcing) · Alembic `downgrade`/roundtrip (Prisma forward + expand/contract R334) · Pydantic
upcasters (TS) · projections **synchrones** (O-Live = outbox async assumé).

## 4. Spec v2 — ordre & principes adaptés

**Réordonnancement proposé** (la spec ordonne 0→A→B→C→D→E ; je propose d'élever le durcissement
runtime RLS, car le contournement actuel est une faille de sécurité réelle, pas une amélioration) :

1. **Bloc 0** — finir (snapshot surface API déterministe sans Swagger + golden parcours par invariants).
2. **Bloc D-runtime** (R… existant, durcissement) — connexion `olive_app` + `SET LOCAL` réel +
   tests anti-bypass, sous `FF_RLS_ENFORCED` (shadow : double-contrôle applicatif ET RLS).
   **Valeur sécurité/FINMA maximale, effort modéré.**
3. **Bloc A** (R336/LK) — locking optimiste **sur tables d'état**, `FF_OPTIMISTIC_LOCKING` (shadow).
4. **Bloc B** (R337/IDM) — idempotence commandes, `FF_IDEMPOTENCY`.
5. **Bloc E** (R339/EV) — versioning/upcasting (additif, sans flag).
6. **Bloc C** (R338/PJ) — reconstructibilité des projections event-derived + doc outbox.

**Invariants tenus partout** : gel R1-R51 / cpsi INTOUCHÉ ; event store append-only (upcast en
lecture) ; migrations expand-only en N (R334) ; TDD ; réversibilité (flag → revert → migration →
restore) ; suite complète verte à chaque frontière ; chaque bloc teste ses deux modes de flag.

**Application OctoPulse (2e temps, dépôt séparé)** : Blocs B + D prioritaires (même argument
FINMA) ; A = locking par colonne `version` sur tables mutables (identique à l'adaptation A ci-dessus,
la spec le prévoyait déjà) ; migrations versionnées + mypy strict.
