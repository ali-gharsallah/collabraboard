#!/usr/bin/env bash
# §4 — LE critère : restauration TESTÉE sur staging, documentée, CHRONOMÉTRÉE.
# À exécuter (humain) après chaque changement de topologie, et au moins mensuellement.
set -euo pipefail
: "${WALG_S3_PREFIX:?}"; : "${PGDATA_RESTORE:?répertoire CIBLE (vide) du restore}"
debut=$(date +%s)
wal-g backup-fetch "$PGDATA_RESTORE" LATEST
cat > "$PGDATA_RESTORE/recovery.signal" <<< ""
echo "restore_command = 'wal-g wal-fetch %f %p'" >> "$PGDATA_RESTORE/postgresql.auto.conf"
pg_ctl -D "$PGDATA_RESTORE" -w start
psql -h /tmp -c "SELECT count(*) FROM tenants" postgres    # la base répond avec des données
pg_ctl -D "$PGDATA_RESTORE" -w stop
echo "RESTAURATION OK en $(( $(date +%s) - debut )) s — consigner la durée (RTO mesuré, §10)"
