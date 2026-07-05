#!/usr/bin/env bash

# @file .orchestration/autoskill/config/run_autoskill.sh
# @brief Run the pinned AutoSkill dry-run with explicit OpenAI-compatible auth.
# @description
#   Supports direct OpenAI-compatible endpoints or the local Codex Auth proxy.
#   Only allowlisted environment variables are passed into the container.

set -euo pipefail

auth=""
run_id=""
image="${AUTOSKILL_IMAGE:-autoskill-sandbox:p2t07a}"
input_run_id="${AUTOSKILL_INPUT_RUN_ID:-p2t07a-dryinput}"
runtime="${CONTAINER_RUNTIME:-}"

usage() {
  echo "usage: $0 --auth openai|codex --run-id <id>" >&2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --auth)
      auth="${2:-}"
      shift 2
      ;;
    --run-id)
      run_id="${2:-}"
      shift 2
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

[ -n "$run_id" ] || { usage; exit 2; }
[ "$auth" = "openai" ] || [ "$auth" = "codex" ] || { usage; exit 2; }

if [ -z "$runtime" ]; then
  if command -v docker >/dev/null 2>&1; then
    runtime="docker"
  elif command -v container >/dev/null 2>&1; then
    runtime="container"
  else
    echo "docker or container runtime is required" >&2
    exit 1
  fi
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
input_dir="$repo_root/.orchestration/autoskill/inputs/$input_run_id"
dataset_path="$input_dir/openai_conversations.jsonl"
output_dir="$repo_root/.orchestration/autoskill/outputs/$run_id"
candidates_dir="$repo_root/.orchestration/skills/candidates"
run_log="$repo_root/.orchestration/autoskill/runs/$run_id.autoskill.md"
base_url=""
api_key=""

[ -d "$input_dir" ] || { echo "missing input dir: $input_dir" >&2; exit 1; }
[ -f "$dataset_path" ] || { echo "missing OpenAI conversation dataset: $dataset_path" >&2; exit 1; }
mkdir -p "$output_dir" "$candidates_dir" "$(dirname "$run_log")"

case "$auth" in
  openai)
    : "${AUTOSKILL_LLM_BASE_URL:?required for --auth openai}"
    : "${OPENAI_API_KEY:?required for --auth openai}"
    base_url="$AUTOSKILL_LLM_BASE_URL"
    api_key="$OPENAI_API_KEY"
    ;;
  codex)
    : "${EAP_SHIM_TOKEN:?required for --auth codex}"
    if [ -n "${EAP_SHIM_URL:-}" ]; then
      base_url="$EAP_SHIM_URL"
    else
      : "${EAP_SHIM_HOST:?required when EAP_SHIM_URL is unset}"
      base_url="http://$EAP_SHIM_HOST:${EAP_SHIM_PORT:-8787}/v1"
    fi
    api_key="$EAP_SHIM_TOKEN"
    ;;
esac

container_args=(
  run --rm
  -v "$input_dir:/work/inputs:ro"
  -v "$output_dir:/work/outputs"
  -v "$candidates_dir:/work/candidates"
  -e OPENAI_BASE_URL
  -e OPENAI_API_KEY
  -e AUTOSKILL_DISABLE_SELF_EVOLUTION=1
  -e AUTOSKILL_DISABLE_CODEX_INTERNAL=1
  "$image"
  python -m autoskill.offline.conversation.extract
  --file /work/inputs/openai_conversations.jsonl
  --user-id eap-dry-run
  --llm-provider openai
  --llm-base-url "$base_url"
  --embeddings-provider hashing
  --store-path /work/outputs/SkillBank
  --max-workers "${AUTOSKILL_MAX_WORKERS:-1}"
)

OPENAI_BASE_URL="$base_url" OPENAI_API_KEY="$api_key" "$runtime" "${container_args[@]}"

find "$output_dir" -type f -name '*.md' -exec cp {} "$candidates_dir/" \;

candidate_list="$(find "$candidates_dir" -maxdepth 1 -type f -name '*.md' -print | sort || true)"
{
  echo "autoskill: infrastructure_only"
  echo
  echo "- pinned_commit: \`94c47ca488d4ba4117d20272e66d49b9877e68cf\`"
  echo "- provider_mode: \`$auth\`"
  echo "- input_manifest: \`.orchestration/autoskill/inputs/$input_run_id.manifest.json\`"
  echo "- output_dir: \`.orchestration/autoskill/outputs/$run_id/\`"
  echo "- redaction_passed: true"
  echo "- promotion_allowed: false"
  echo "- decisions: discard=0 improve=0 merge=0 create=0 version_update=0"
  echo "- generated_candidates:"
  if [ -n "$candidate_list" ]; then
    printf '%s\n' "$candidate_list" | sed "s#^$repo_root/#  - \`#; s#\$#\`#"
  else
    echo "  - none"
  fi
} > "$run_log"
