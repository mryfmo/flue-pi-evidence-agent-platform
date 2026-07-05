#!/usr/bin/env bash

# @file scripts/deploy-smoke.sh
# @brief Smoke test the deployable validation image as a service.
# @description
#   Detects Docker first, then Apple container, builds flue-pi-eap:validate,
#   verifies the deterministic Flue/Pi smoke workflow, and starts the built
#   Node server inside the image to poll /health.

set -euo pipefail

image="${IMAGE_NAME:-flue-pi-eap:validate}"
ack_marker="${SMOKE_ACK_MARKER:-ack:hello}"

if command -v docker >/dev/null 2>&1; then
  runtime="docker"
elif command -v container >/dev/null 2>&1; then
  runtime="container"
else
  echo "error: install docker or Apple container" >&2
  exit 127
fi

"$runtime" build -t "$image" .

smoke_status=0
smoke_output="$("$runtime" run --rm "$image" npm run flue:smoke 2>&1)" || smoke_status=$?
if [[ "$smoke_status" -ne 0 ]]; then
  printf '%s\n' "$smoke_output" >&2
  exit "$smoke_status"
fi
if ! grep -Fq "$ack_marker" <<<"$smoke_output"; then
  printf '%s\n' "$smoke_output" >&2
  echo "error: flue:smoke output did not contain $ack_marker" >&2
  exit 1
fi

"$runtime" run --rm "$image" sh -ceu '
  npm run flue:build >/tmp/flue-build.log 2>&1
  PORT=3000 ./node_modules/node/bin/node dist/server.mjs >/tmp/flue-server.log 2>&1 &
  pid=$!
  trap "kill $pid 2>/dev/null || true" EXIT
  for _ in $(seq 1 60); do
    if ./node_modules/node/bin/node -e "fetch(\"http://127.0.0.1:3000/health\").then((r) => process.exit(r.status === 200 ? 0 : 1)).catch(() => process.exit(1))"; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      exit 0
    fi
    sleep 1
  done
  cat /tmp/flue-build.log >&2
  cat /tmp/flue-server.log >&2
  exit 1
'

echo "deploy-smoke: PASS image=$image ack=$ack_marker health=/health"
