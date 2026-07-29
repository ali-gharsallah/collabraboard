#!/usr/bin/env bash
# §4 — WAL archivé en continu vers SOS (WAL-G), rétention 30 j + snapshot quotidien.
# Cron : base quotidienne + delete retain. La preuve n'est PAS ce script : c'est
# restore-test.sh exécuté et chronométré — « un backup non restauré n'existe pas ».
set -euo pipefail
: "${WALG_S3_PREFIX:?s3://olive-<env>-backups/pg (endpoint SOS via AWS_ENDPOINT)}"
: "${PGDATA:?répertoire de données Postgres}"
wal-g backup-push "$PGDATA"
wal-g delete retain FULL 30 --confirm
echo "backup-walg OK $(date -Is)"
