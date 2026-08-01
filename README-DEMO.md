# O-Live — démarrage démo (clone → tout tourne en 3 commandes)

Pile complète en local via Docker : **Postgres → migrations (schéma + RLS) → API NestJS → Web**.
Aucun secret réel : les valeurs du `docker-compose.yml` sont des gabarits de démo.

## Pré-requis
- Docker + Docker Compose v2 (`docker compose`, pas `docker-compose`).
- (Pour les tests/seed hors conteneur : Node 20 + `corepack enable` → pnpm.)

## Les 3 commandes

```bash
# 1. Cloner
git clone <url-du-repo> collabraboard && cd collabraboard

# 2. Tout construire et démarrer (db + migrate + api + web).
#    `migrate` applique `prisma db push` PUIS `prisma:post` (post-deploy-v2.sql : RLS FORCE + policies)
#    avant que l'API ne démarre. La première fois, le build des images prend quelques minutes.
docker compose up --build -d

# 3. Semer le tenant de démo « Gharsallah Wealth Bank » (idempotent — rejouable sans dupliquer).
docker compose exec -e OLIVE_SEED_DEMO=1 api pnpm run seed:demo
```

Puis ouvrir **http://localhost:8080**. Connexion via un compte de démo (mot de passe `Demo-GWB-2026!`) —
p. ex. `marc@gwb-demo.ch` (RM/préparateur), `carla@gwb-demo.ch` (CO), `selim@gwb-demo.ch` (CO_SR/validateur).

| Service | URL | Rôle |
|---|---|---|
| Web (nginx + build Vite) | http://localhost:8080 | SPA — `OLIVE_API_URL=http://localhost:3000` |
| API (`/v1`) | http://localhost:3000/v1/healthz | NestJS, liveness publique |
| Postgres | `localhost:5432` (olive/olive/olive) | RLS FORCE prouvée (recette 4b) |

Arrêt : `docker compose down` (ajouter `-v` pour effacer les volumes db/minio).

## Séquence exacte orchestrée par `docker compose up`
1. **db** — Postgres 16, `healthcheck: pg_isready`.
2. **migrate** (attend db saine) — `npx prisma db push --skip-generate` puis
   `npx prisma db execute --file prisma/post-deploy-v2.sql` ; **sort** en succès.
3. **api** (attend `migrate` terminé + db saine) — secrets fail-fast fournis (`AUDIT_HMAC_SECRET`,
   `MFA_ENC_KEY`), `CORS_ORIGIN=http://localhost:8080`, écoute `:3000`. Healthcheck `/v1/healthz`.
4. **web** (attend api saine) — nginx sert le build ; `OLIVE_API_URL` injecté au démarrage
   (`docker-inject-api-url.sh`). Vide ⇒ mode démo (seed + bandeau) ; défini ⇒ API réelle.

## Ce que déroule le seed (histoire de bout en bout)
1 tenant, 6 personas (dont **RM préparateur** + **CO/CO_SR validateurs**), pipeline d'onboarding,
3 clients (3 structures), **création dossier KYC → personnes/PEP → documents → visa 4-yeux →
validation finale (ACTIF) → révision** (l'échéance de review naît à la validation, RV-01/07),
CPSI, CoC HAUTE, incident OpRisk, offboarding art. 10a. Tout par les **vraies APIs** (aucun INSERT
sur les tables des moteurs) : journal légitime, rejouable, montrable à un auditeur. Rejouer la
commande 3 laisse l'état identique (find-or-create par référence).

## Tests

**Unitaires / règles (sans base, sans Docker)** :
```bash
pnpm install
pnpm --dir apps/api run test:rules     # harnais moteur (fakePrisma)
pnpm --dir apps/web run test:unit      # écrans front (msw)
pnpm --dir apps/api run typecheck && pnpm --dir apps/web run build
```

**End-to-end (51 specs, Postgres jetable via Docker)** — dont `rls-runtime` (RLS croisée A/B) et
`optimistic-lock` (`LK-VISA-02`, double visa concurrent) :
```bash
pnpm --dir apps/api run test:e2e:setup     # db-test:5433 + db push + prisma:post
DATABASE_URL=postgresql://olive:olive@localhost:5433/olive_test \
AUDIT_HMAC_SECRET=$(openssl rand -hex 32) MFA_ENC_KEY=$(openssl rand -hex 32) \
  pnpm --dir apps/api run test:e2e
pnpm --dir apps/api run test:e2e:teardown  # arrêt + purge du volume
```

## Profil enterprise (optionnel)
Gateway, Keycloak, Vault, OpenSearch, Prometheus/Grafana/Loki :
```bash
docker compose -f docker-compose.yml -f docker-compose.enterprise.yml up -d
```

## Notes
- Le build des images (`apps/api/Dockerfile`, `apps/web/Dockerfile`) suit le patron multi-étage
  pnpm-workspace standard ; il n'a PAS été exécuté dans l'environnement de préparation (pas de
  démon Docker) — à valider au premier `up` sur un poste avec Docker.
- Repli sans Docker pour le web seul : `pnpm --dir apps/web run dev` (mode démo, `OLIVE_API_URL` nul).
