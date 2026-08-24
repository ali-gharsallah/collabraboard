# O-Live Web — build Vite servi par nginx. Build depuis la RACINE du repo :
#   docker build -f apps/web/Dockerfile -t olive-web .
# window.OLIVE_API_URL est injecté au DÉMARRAGE (env OLIVE_API_URL) — null ⇒ mode démo (seed).
FROM node:20-slim AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @olive/web run build

FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
# Injection de OLIVE_API_URL dans index.html au démarrage du conteneur (hook nginx officiel).
COPY apps/web/docker-inject-api-url.sh /docker-entrypoint.d/40-olive-api-url.sh
RUN chmod +x /docker-entrypoint.d/40-olive-api-url.sh
EXPOSE 80
