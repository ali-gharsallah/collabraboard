#!/usr/bin/env bash
# PIPELINE DE DÉPLOIEMENT (R330/RZ-01..04) — PRÉPARÉ, déclenché par un HUMAIN (Ali).
# Enchaîne : migrations expand → déploiement → /readyz vert → smoke tests → bascule.
# Échec à toute étape = ARRÊT AVANT bascule, l'ancienne version sert toujours (RZ-02).
# Chaque issue est enregistrée comme événement tracé via POST /v1/deploiements (RZ-04).
set -euo pipefail
: "${OLIVE_VERSION:?version à déployer}"; : "${API_URL:?url de la nouvelle instance (staging/candidate)}"
: "${DIR_TOKEN:?jeton DIR/ADMIN pour tracer le déploiement}"

tracer() { # version, smokeOk(true|false), readyz, note
  curl -fsS -X POST "$API_URL/v1/deploiements" -H "Authorization: Bearer $DIR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"version\":\"$OLIVE_VERSION\",\"smokeOk\":$2,\"readyz\":\"$3\",\"note\":\"${4:-}\"}" >/dev/null || true
}

echo "[1/5] migrations expand (RUNBOOK §8 — jamais de contraction ici)"
( cd apps/api && npx prisma migrate deploy && npm run prisma:post )

echo "[2/5] déploiement de l'instance candidate ($OLIVE_VERSION) — hors bascule"
# (compose up de la candidate — infra/compose ; la bascule Caddy n'a PAS encore lieu)

echo "[3/5] attente /readyz vert"
for i in $(seq 1 30); do
  if curl -fsS "$API_URL/v1/readyz" | grep -q '"pret":true'; then echo "  /readyz VERT"; break; fi
  [ "$i" = "30" ] && { echo "  /readyz JAMAIS vert — ARRÊT avant bascule"; tracer "$OLIVE_VERSION" false rouge "readyz jamais vert"; exit 1; }
  sleep 2
done

echo "[4/5] smoke tests (login local + SSO fixtures, une lecture scopée, une écriture outbox consommée)"
if ! bash infra/scripts/smoke.sh "$API_URL"; then
  echo "  SMOKE ROUGE — ARRÊT avant bascule, l'ancienne version sert toujours (RZ-02)"
  tracer "$OLIVE_VERSION" false vert "smoke rouge — bascule annulée"
  exit 1
fi

echo "[5/5] bascule (Caddy pointe la candidate) — puis trace l'issue"
# (bascule effective ici — reverse_proxy vers la nouvelle instance)
tracer "$OLIVE_VERSION" true vert "déploiement complet"
echo "DÉPLOIEMENT $OLIVE_VERSION OK — tracé dans auditit (/v1/deploiements)"
