#!/usr/bin/env bash
# SMOKE TESTS (R330) — le minimum qui prouve que l'instance SERT vraiment, avant bascule.
# Réservé au pipeline ; échec = code non nul (deploy.sh arrête AVANT bascule).
set -euo pipefail
API="${1:?url}"
# 1. /readyz vert (re-vérifié ici — le pipeline peut appeler smoke seul)
curl -fsS "$API/v1/readyz" | grep -q '"pret":true'
# 2. login LOCAL de fixture (les identifiants de smoke vivent au coffre, jamais au repo)
: "${SMOKE_EMAIL:?}"; : "${SMOKE_PASSWORD:?}"
TOKEN=$(curl -fsS -X POST "$API/v1/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] || { echo "smoke: login local échoué"; exit 1; }
# 3. une lecture SCOPÉE (le jeton commande — R328)
curl -fsS "$API/v1/tasks" -H "Authorization: Bearer $TOKEN" >/dev/null
echo "smoke OK"
