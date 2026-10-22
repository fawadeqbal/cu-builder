#!/usr/bin/env bash
# Runs on the VPS (from the deploy workflow, or by hand): pull the images and restart.
# Migrations run in the one-off "migrate" service before the API starts.
set -euo pipefail
cd "$(dirname "$0")"

export IMAGE_TAG="${IMAGE_TAG:-latest}"
compose() { docker compose -f docker-compose.prod.yml --env-file .env.production "$@"; }

compose pull web api worker migrate
compose up -d --remove-orphans
compose ps
docker image prune -f >/dev/null
