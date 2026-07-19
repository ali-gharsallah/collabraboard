# Olive — MVP production-ready : architecture système

## 1. Vue d'ensemble (minimal mais scalable)

```
                    ┌─────────────── Edge ───────────────┐
 Client (SPA) ──────▶  CDN statique (web/)  ·  WAF/TLS   │
                    └──────────────┬─────────────────────┘
                                   ▼
                    ┌── API stateless (NestJS ×N) ────────┐
                    │  JWT RS256 · tenant middleware ·     │
                    │  zod contracts partagés (packages/) │
                    └───┬──────────────┬─────────────┬────┘
                        ▼              ▼             ▼
                 PostgreSQL 16    Redis 7        MinIO/S3
                 (RLS par tenant) (BullMQ,       (GED objets,
                 + outbox         rate-limit,    SSE-C chiffré)
                 domain_events    sessions)
                        │
                        ▼
                 Outbox worker (×N, poll FOR UPDATE SKIP LOCKED)
                 → webhooks signés HMAC · projections · e-mails
```

**Pourquoi ça tient jusqu'à des millions d'utilisateurs :**
- API 100 % stateless → scale horizontal derrière un LB, aucune affinité.
- Postgres = source de vérité unique ; RLS par tenant = isolation au niveau
  moteur, pas seulement applicatif. Montée : read-replicas puis Citus/partition
  par tenant_id (le schéma est déjà partitionnable : tenant_id en tête de PK).
- Écritures asynchrones découplées par l'outbox : aucun événement perdu,
  rejouable, idempotent (event_id). Kafka ne devient nécessaire qu'à 200+
  banques (ADR-07) — l'outbox migre alors sans changer le modèle.
- GED sur objet S3 : capacité illimitée, empreinte SHA-256 calculée serveur.
- Zéro état en mémoire process → déploiement blue/green trivial.

## 2. Structure de fichiers
```
olive-mvp/
├── ARCHITECTURE.md · README.md · docker-compose.yml · package.json (workspaces)
├── .github/workflows/ci.yml          lint → typecheck → tests → build
├── packages/shared/src/contracts.ts  DTO zod partagés API/Web (1 seule vérité)
├── apps/api/
│   ├── prisma/schema.prisma          schéma multi-tenant complet
│   ├── prisma/post-deploy.sql        RLS + immuabilité audit + index outbox
│   └── src/
│       ├── main.ts · app.module.ts
│       ├── common/  tenant.middleware · audit.service (HMAC chaîné)
│       └── modules/ auth · clients · kyc (module durci v0.2.0) · events
└── apps/web/
    ├── src/app/router.tsx            routes par feature
    ├── src/lib/api.ts                client typé + fallback seed (démo/offline)
    └── src/features/clients/         liste + fiche (pattern à répliquer)
```

## 3. Schéma de base (résumé — détail dans prisma/schema.prisma)
tenants · users(role, tenant) · clients(golden record, risk) ·
kyc_files(code unique, révisions chaînées, workflow SDD/CDD/EDD) ·
kyc_sections/questions/history(HMAC) · kyc_visas · documents(sha256, rétention)
· domain_events(outbox) · audit_log(chaîné). Toutes les tables portent
tenant_id + RLS. Index : (tenant_id, created_at) partout, unique métier sur
kyc_code et client externalRef.

## 4. API (contrats stables — Idempotency-Key sur tout POST, erreurs RFC 7807)
| Méthode | Endpoint | Rôle |
|---|---|---|
| POST | /v1/auth/token | JWT RS256 (client_credentials / PKCE) |
| GET/POST | /v1/clients | Référentiel, pagination cursor |
| POST | /v1/clients/:id/events | Change of Circumstances entrant |
| POST | /v1/kyc | 4 infos → risque → workflow → initiation (lock consultatif) |
| PATCH | /v1/kyc/:code/questions/:qid | Réponse (default-deny + change tracker) |
| POST | /v1/kyc/:id/visa · /:id/validate | Visas · four-eyes → outbox |
| POST | /v1/documents | Multipart → S3, SHA-256, rétention art. 7 LBA |
| GET | /v1/events?cursor= | Flux outbox consommable (intégrations) |

## 5. Architecture UI
Feature folders (clients/, kyc/, documents/) : chaque feature = routes +
composants + hooks + appels typés depuis packages/shared. État serveur par
fetch + cache léger (le pattern useApiOrSeed permet le mode démo hors-ligne —
c'est exactement le pont avec la démo single-file actuelle). Design tokens
uniques (tokens.ts) — la palette olive de la démo est la référence.

## 6. Chemin de montée en charge
1 → 10k users : docker-compose ci-joint. 10k → 500k : API ×3 + PgBouncer +
read-replica + CDN. 500k → millions : partition par tenant, workers dédiés
par type d'événement, S3 multi-région, puis Kafka si >200 tenants (ADR-07).
