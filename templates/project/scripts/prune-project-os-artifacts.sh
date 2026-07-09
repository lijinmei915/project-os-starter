#!/usr/bin/env bash
set -euo pipefail

target="${1:-.}"
entry_keep="${PROJECT_OS_RETENTION_ENTRY_CONTEXTS:-50}"
run_keep="${PROJECT_OS_RETENTION_RUNS:-20}"

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/prune-project-os-artifacts.sh [target]

Prunes generated Project OS history while keeping recent records:
  .project-os/entry-contexts/*.json
  .project-os/runs/*.json
  .project-os/runs/logs/*
  .project-os/state-bundles/*.json

Environment:
  PROJECT_OS_RETENTION_ENTRY_CONTEXTS  default 50
  PROJECT_OS_RETENTION_RUNS            default 20
USAGE
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

if [ ! -d "$target" ]; then
  echo "ERROR: target directory not found: $target"
  exit 2
fi

case "$entry_keep" in
  ''|*[!0-9]*) echo "ERROR: PROJECT_OS_RETENTION_ENTRY_CONTEXTS must be a non-negative integer"; exit 2 ;;
esac

case "$run_keep" in
  ''|*[!0-9]*) echo "ERROR: PROJECT_OS_RETENTION_RUNS must be a non-negative integer"; exit 2 ;;
esac

target_abs="$(cd "$target" && pwd)"

prune_files() {
  dir="$1"
  keep="$2"
  pattern="$3"

  [ -d "$dir" ] || return 0

  find "$dir" -maxdepth 1 -type f -name "$pattern" -print \
    | sort -r \
    | awk -v keep="$keep" 'NR > keep { print }' \
    | while IFS= read -r file; do
        rm -f "$file"
      done
}

prune_run_logs() {
  runs_dir="$1"
  keep="$2"
  logs_dir="$runs_dir/logs"

  [ -d "$logs_dir" ] || return 0

  find "$runs_dir" -maxdepth 1 -type f -name '*.json' -print \
    | sort -r \
    | awk -v keep="$keep" 'NR <= keep { print }' \
    | sed 's/.*\///; s/\.json$//' > "$logs_dir/.keep-runs.tmp"

  find "$logs_dir" -mindepth 1 -maxdepth 1 -type d -print \
    | while IFS= read -r dir; do
        run_id="${dir##*/}"
        if ! grep -qx "$run_id" "$logs_dir/.keep-runs.tmp" 2>/dev/null; then
          rm -rf "$dir"
        fi
      done

  rm -f "$logs_dir/.keep-runs.tmp"
}

entry_dir="$target_abs/.project-os/entry-contexts"
runs_dir="$target_abs/.project-os/runs"
state_bundle_dir="$target_abs/.project-os/state-bundles"

prune_files "$entry_dir" "$entry_keep" '*.json'
prune_files "$runs_dir" "$run_keep" '*.json'
prune_files "$state_bundle_dir" "$run_keep" '*.json'
prune_run_logs "$runs_dir" "$run_keep"

echo "Project OS artifacts pruned: entry-contexts keep=$entry_keep, runs/state-bundles keep=$run_keep"
