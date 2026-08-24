# O-Live API — image multi-étage (monorepo pnpm). Build depuis la RACINE du repo :
#   docker build -f apps/api/Dockerfile -t olive-api .
# La démo l'orchestre via docker-compose.yml (service `api`, + `migrate` pour db push/prisma:post).
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /repo

# ── Étape deps : n'installe que sur les manifests (cache Docker) ──
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/workflow-engine/package.json packages/workflow-engine/
RUN pnpm install --frozen-lockfile

# ── Étape build : sources + prisma generate + nest build ──
FROM deps AS build
COPY . .
RUN pnpm --filter @olive/api exec prisma generate
RUN pnpm --filter @olive/api run build

# ── Étape runtime : dist + node_modules + prisma (CLI dispo pour le service migrate) ──
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 3000
# Secrets FAIL-FAST au boot (AUDIT_HMAC_SECRET, MFA_ENC_KEY) : fournis par le compose (valeurs démo).
CMD ["node", "dist/main.js"]
