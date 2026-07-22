# Olive MVP — production-ready, minimal, scalable

## État réel vérifié au 2026-07-22
Certificat unique : **`docs/CERTIFICAT-ETAT.md`** · index maître : **`docs/PROJECT-INDEX.md`**.
Périmètre **réellement en code** : règles **R1→R221** (AML R189-R206 + Islamic R207-R221),
**27 modules NestJS** en Postgres réel (0 mock jest), **441 tests verts** (425 règles + 16 e2e),
RLS FORCE prouvée. **Vague 1** : 6 écrans React réels (Clients, KYC, Règles AML, File d'alertes,
Rejeu KYC à date, Finance Islamique), **fallback seed rendu visible** (bandeau). **Rejeu-à-date :
OUI** pour les paramètres (R127) **et** le dossier KYC (`/v1/kyc/:code/a-date`). Recette Vague 1 :
**10/10 FAT PASS**.
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
