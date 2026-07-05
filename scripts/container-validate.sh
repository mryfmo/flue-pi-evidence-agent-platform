#!/usr/bin/env bash

# @file scripts/container-validate.sh
# @brief Build and run the release validation image.
# @description
#   Detects Docker first, then Apple container, builds flue-pi-eap:validate,
#   runs npm run validate-release in the image, and writes gate artifacts to a
#   host directory mounted at /app/artifacts.

set -euo pipefail

image="${IMAGE_NAME:-flue-pi-eap:validate}"
artifact_dir="${ARTIFACT_DIR:-$PWD/artifacts/container-validation}"

if command -v docker >/dev/null 2>&1; then
  runtime="docker"
elif command -v container >/dev/null 2>&1; then
  runtime="container"
else
  echo "error: install docker or Apple container" >&2
  exit 127
fi

mkdir -p "$artifact_dir"

"$runtime" build -t "$image" .
status=0
"$runtime" run --rm -v "$artifact_dir:/app/artifacts" "$image" || status=$?

echo "gate artifacts: $artifact_dir"
exit "$status"
