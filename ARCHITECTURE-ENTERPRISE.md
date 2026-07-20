# Olive Enterprise — architecture cible & plan de convergence

Complète ARCHITECTURE.md (MVP). Source : revue d'architecture bancaire (20
briques). Principe senior : **modular monolith + ports** — chaque brique cible
a son interface dès aujourd'hui ; l'extraction en microservice est une décision
de déploiement, pas une réécriture.

## Gap analysis — 20 briques

| # | Brique | MVP aujourd'hui | Cible | Phase | Code posé ce commit |
|---|---|---|---|---|---|
| 1 | IAM | JWT RS256 + middleware | Keycloak (OIDC/SAML/SCIM/LDAP), MFA, device trust, impersonation auditée | **P1** | Keycloak dans compose.enterprise ; le middleware valide déjà des JWT OIDC-compatibles (issuer configurable) |
| 2 | API Gateway | — | WAF → Gateway (Kong/Traefik) : mTLS, quotas, versioning | P1 | Traefik dans compose.enterprise |
| 3 | Event Bus | Outbox → worker | Outbox → **EventBusPort** → BullMQ / Kafka / Rabbit | **P0 fait** | `ports/event-bus.port.ts` + 2 adaptateurs — le métier ne connaît plus le transport |
| 4 | Workflow Engine | Statuts en code | Service BPMN (state machine, timers, escalades) pour onboarding/pKYC/AR/trips/paiements/investigations/offboarding | P2 | `modules/workflow/` : port + ADR modular-monolith d'abord |
| 5 | Rule Engine | Règles en constantes | Règles AML/CDD/EDD/scoring/questionnaires/matrice docs **configurables** | P2 | `modules/rules/` : port `evaluate(ruleset, ctx)` |
| 6 | Olivia AI | Appels ad hoc | Gateway IA locale : LLM on-prem + RAG + vector DB + 11 agents, zéro Internet | P2 | isolé derrière `POST /ai/*` (jamais depuis le navigateur — leçon v0.1) |
| 7 | Digital Twin | — | Prod → anonymisation → jumeau → sandbox/simulation/entraînement | P3 | générateur synthétique (18) = première marche |
| 8 | Observabilité | — | OTel → Prometheus/Grafana/Loki/Jaeger + AlertManager | **P1** | otel-collector+prom+grafana+loki dans compose.enterprise ; hook OTel dans main.ts |
| 9 | Secrets | env vars | Vault : rotation certs/JWT/API keys | **P0 fait** | `ports/secrets.port.ts` (EnvAdapter dev, VaultAdapter) — plus un seul `process.env` métier |
| 10 | Chiffrement | TLS + SSE S3 | + KMS enveloppe + **chiffrement de colonne** (nom, IBAN, TIN, passeport…) | **P0 fait** | `crypto/field-encryption.service.ts` AES-256-GCM enveloppe, réel |
| 11 | Recherche | SQL LIKE | Postgres → CDC (Debezium) → OpenSearch | P2 | OpenSearch dans compose.enterprise |
| 12 | Screening | screenMatch interne | Service dédié async : WorldCheck/DowJones/OFAC/ONU/UE/SECO/PEP/adverse media | P2 | contrat `POST /v1/screening/match` déjà stable |
| 13 | AML Engine | scénarios en lib | Service séparé rules→thresholds→alerts→cases | P2 | même port que (5) |
| 14 | Génération doc | Markdown | Template engine Word/PDF/Excel/Email/ZIP fusion golden record | P2 | contrat legalGenerate = spec du service |
| 15 | Notifications | — | Email/SMS/Teams/Slack/Webhook/In-App | P1 | consommateur du bus (3) — aucune dépendance nouvelle |
| 16 | Scheduler | setInterval worker | Cron distribué : pKYC, expiry docs, relances, escalades | P1 | BullMQ repeatable jobs (déjà dans compose) |
| 17 | **Licence Olive** | — | Modules par tenant, seats, expiry, licence off-line signée | **P0 fait** | `modules/license/` réel : activation par module, signature Ed25519 off-line |
| 18 | Data Generator | hash déterministe (démo) | Générateur synthétique : clients/tx/trusts/UBO/PEP/sanctions/docs/cases | P2 | l'amlHash de la démo EST le prototype |
| 19 | Configuration Studio | Admin partiel | Zéro règle en dur : matrices, questionnaires, workflows, scoring, templates | P2-P3 | consomme (4)+(5) — l'Admin de la démo est la maquette |
| 20 | Cible | — | Diagramme ci-dessous | — | — |

## Architecture cible (reprise validée)
```
            CDN / WAF ─ API Gateway (mTLS, quotas, versions)
                 │
   IAM (Keycloak)│ Olivia AI Gateway (LLM local · RAG · agents)
                 │
  Client Svc · Workflow Engine · Rule Engine
  Documents  · Screening       · AML Engine
                 │
          PostgreSQL 16 (RLS, colonnes chiffrées)
                 │
        Outbox ─ EventBusPort ─ BullMQ→Kafka
                 │
  Notifications · Reporting · Webhooks · Scheduler
                 │
  OTel · Prometheus · Grafana · Loki · Jaeger
                 │
        Vault · KMS · Backups chiffrés · DR (RPO 15 min)
```

## Séquencement
- **P0 (ce commit)** : ports bus/secrets, chiffrement de colonne, licence — les
  briques dont l'ABSENCE force une réécriture plus tard.
- **P1 (pré-pilote)** : Keycloak, gateway, observabilité, notifications, scheduler.
- **P2 (pilote → 5 banques)** : workflow/rule engines, screening & AML services,
  OpenSearch, Olivia gateway, template engine, data generator.
- **P3 (scale)** : Configuration Studio complet, Digital Twin, Kafka si >200 tenants.
