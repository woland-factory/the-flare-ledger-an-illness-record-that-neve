#!/usr/bin/env bash
set -euo pipefail
# PW_VERSION MUST equal the @playwright/test version npm ci installs. It is
# pinned EXACT in package.json; bump both together.
PW_VERSION="1.63.0"
# Run-scoped webServer port so concurrent runs on a shared host do not collide.
E2E_PORT="${E2E_PORT:-$((3100 + RANDOM % 800))}"
cd "$(dirname "$0")/.."
# The test database is in-process (PGlite), so there is no db container to
# start and no DATABASE_URL to pass. The suite is fully self-provisioning.
docker run --rm --init --ipc=host --network host \
  --user "$(id -u):$(id -g)" -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
  -e CI=1 -e E2E_PORT="$E2E_PORT" -v "$PWD":/work -w /work \
  "mcr.microsoft.com/playwright:v${PW_VERSION}-noble" \
  sh -c 'npm ci && npm run test:e2e'
