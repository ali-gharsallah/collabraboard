# Olive MVP — production-ready, minimal, scalable

## État réel vérifié au 2026-07-22
Diagnostic automatisé (voir `docs/ETAT-REEL-VERIFIE.md`). Périmètre **réellement en code** :
règles **R1→R221** (dont AML privé R189-R206 et couche Shariah/Islamic R207-R221, **mergés**),
**27 modules NestJS** écrivant en Postgres réel (0 mock jest), **431 tests verts** (425 harnais
de règles + 6 e2e sur vraie DB), RLS FORCE multi-tenant prouvée. Le frontend appelle le backend
(`/v1/...`) avec un **fallback seed** si `OLIVE_API_URL` est absent (mode démo). Rejeu-à-date :
présent pour les **paramètres** (R127, exposé HTTP), pas généralisé aux agrégats métier.
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
