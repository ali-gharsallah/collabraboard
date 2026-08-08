# Olive MVP — production-ready, minimal, scalable

<!-- CANON-STAMP:START (généré par tools/canon-master — NE PAS éditer) -->
> **Catalogue faisant foi : [`docs/CANON-MASTER.md`](docs/CANON-MASTER.md) — R1–R446, 115 artefacts, 110 familles.**
> Généré depuis le repo + gaté CI (porte 3c). Protocole de synchro claude.ai : [`docs/SYNC-CLAUDE-AI.md`](docs/SYNC-CLAUDE-AI.md).
<!-- CANON-STAMP:END -->

**Sources de vérité** (ne pas dupliquer à la main) :
- **Catalogue des règles** → **`docs/CANON-MASTER.md`** (GÉNÉRÉ : inventaire R1–R339+, mapping session→repo, R-Q, écrans, anomalies).
- **Certificat d'état** → `docs/CERTIFICAT-ETAT.md` · **index maître** → `docs/PROJECT-INDEX.md`.
- **Synchro projet claude.ai** → `docs/SYNC-CLAUDE-AI.md` (quel fichier exporter à chaque bloc).

## Architecture (résumé — détail : `docs/CANON-MASTER.md` §f invariants)

Plateforme CLM/KYC/AML multi-tenant pour banques privées suisses (CDB 20, LBA/OBA, LSFin/LEFin,
FINMA). Backend **NestJS + Prisma + PostgreSQL** (RLS FORCE, journaux append-only chaînés, rejeu à
date) · front **React/Vite** · moteur CPSI **Python isolé** derrière une porte à contrat versionné ·
Redis · SSE descendant · JWT RS256 + OIDC per-tenant. Monorepo pnpm. « AI-assisted, human-decided,
replayable by design. »

## Démarrage (dev local)

```bash
docker compose up -d                                   # postgres + redis + minio
pnpm i && pnpm -r build
pnpm --filter @olive/api exec prisma migrate deploy     # applique les migrations
pnpm --filter @olive/api run prisma:post                # RLS FORCE + immuabilité (R48)
OLIVE_SEED_DEMO=1 pnpm --filter @olive/api run seed:demo # tenant démo GWB (facultatif)
pnpm --filter @olive/api start                          # API :3000
pnpm --filter @olive/web dev                            # front :5173
```

Le module KYC reprend tel quel le module **durci v0.2.0** (isolation tenant, default-deny, HMAC,
lock consultatif, outbox). Rien n'est réinventé — on industrialise.
