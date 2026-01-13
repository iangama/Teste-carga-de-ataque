#!/usr/bin/env bash
set -euo pipefail
docker compose config >/dev/null
echo "compose OK"
