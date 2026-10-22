#!/usr/bin/env bash
# Nightly database backup (add to cron: 30 2 * * * /opt/cv-builder/backup.sh).
# Keeps 14 days of compressed dumps in ./backups; copy them off the server too.
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env.production; set +a

mkdir -p backups
stamp=$(date +%Y%m%d-%H%M)
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-cvb}" -d "${POSTGRES_DB:-cvb}" --format=custom > "backups/cvb-$stamp.dump"
find backups -name 'cvb-*.dump' -mtime +14 -delete
echo "backups/cvb-$stamp.dump"
