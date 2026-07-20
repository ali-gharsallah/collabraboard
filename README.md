# Olive MVP — production-ready, minimal, scalable
Monorepo pnpm. Voir ARCHITECTURE.md. Démarrage :
```bash
docker compose up -d          # postgres + redis + minio
pnpm i && pnpm -r build
pnpm --filter api prisma:migrate && pnpm --filter api start
pnpm --filter web dev
```
Le module KYC reprend tel quel le module **durci v0.2.0** (tests unitaires +
e2e inclus dans olive-consolidated) : isolation tenant, default-deny, HMAC,
lock consultatif, outbox. Rien n'est réinventé — on industrialise.
