#!/bin/sh
# Injecte OLIVE_API_URL dans index.html au démarrage (nginx exécute /docker-entrypoint.d/*.sh).
# Absent/vide ⇒ on laisse `||null` : le front reste en MODE DÉMO (seed + bandeau). Défini ⇒ API réelle.
set -e
INDEX=/usr/share/nginx/html/index.html
if [ -n "${OLIVE_API_URL:-}" ] && [ -f "$INDEX" ]; then
  # Remplace `window.OLIVE_API_URL=window.OLIVE_API_URL||null` par l'URL fournie.
  sed -i "s#window.OLIVE_API_URL=window.OLIVE_API_URL||null#window.OLIVE_API_URL=\"${OLIVE_API_URL}\"#" "$INDEX"
  echo "[olive-web] OLIVE_API_URL = ${OLIVE_API_URL}"
else
  echo "[olive-web] OLIVE_API_URL non défini — mode démo (seed)."
fi
