#!/usr/bin/env bash
set -euo pipefail

target="${1:-.}"
entry_keep="${PROJECT_OS_RETENTION_ENTRY_CONTEXTS:-50}"
run_keep="${PROJECT_OS_RETENTION_RUNS:-20}"
event_keep="${PROJECT_OS_RETENTION_EVENTS:-200}"
transaction_keep="${PROJECT_OS_RETENTION_TRANSACTIONS:-200}"
dry_run=0

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/prune-project-os-artifacts.sh [target] [--dry-run]

Prunes generated Project OS history while keeping recent records:
  .project-os/entry-contexts/*.json
  .project-os/runs/*.json
  .project-os/runs/logs/*
  .project-os/state-bundles/*.json
  .project-os/events/*.json
  .project-os/transactions/*.json (committed or rolled-back only)

Environment:
  PROJECT_OS_RETENTION_ENTRY_CONTEXTS  default 50
  PROJECT_OS_RETENTION_RUNS            default 20
  PROJECT_OS_RETENTION_EVENTS          default 200
  PROJECT_OS_RETENTION_TRANSACTIONS    default 200
USAGE
}

for argument in "$@"; do
  case "$argument" in
    -h|--help) usage; exit 0 ;;
    --dry-run) dry_run=1 ;;
    *) target="$argument" ;;
  esac
done

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

case "$event_keep" in
  ''|*[!0-9]*) echo "ERROR: PROJECT_OS_RETENTION_EVENTS must be a non-negative integer"; exit 2 ;;
esac

case "$transaction_keep" in
  ''|*[!0-9]*) echo "ERROR: PROJECT_OS_RETENTION_TRANSACTIONS must be a non-negative integer"; exit 2 ;;
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
        if [ "$dry_run" -eq 1 ]; then
          printf 'candidate: %s\n' "$file"
        else
          rm -f "$file"
        fi
      done
}

prune_terminal_transactions() {
  dir="$1"
  keep="$2"
  [ -d "$dir" ] || return 0

  count=0
  find "$dir" -maxdepth 1 -type f -name '*.json' -print \
    | sort -r \
    | while IFS= read -r file; do
        if grep -Eq '"state"[[:space:]]*:[[:space:]]*"prepared"' "$file"; then
          continue
        fi
        count=$((count + 1))
        if [ "$count" -le "$keep" ]; then
          continue
        fi
        if [ "$dry_run" -eq 1 ]; then
          printf 'candidate: %s\n' "$file"
        else
          rm -f "$file"
        fi
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
events_dir="$target_abs/.project-os/events"
transactions_dir="$target_abs/.project-os/transactions"

prune_files "$entry_dir" "$entry_keep" '*.json'
prune_files "$runs_dir" "$run_keep" '*.json'
prune_files "$state_bundle_dir" "$run_keep" '*.json'
prune_run_logs "$runs_dir" "$run_keep"
prune_files "$events_dir" "$event_keep" '*.json'
prune_terminal_transactions "$transactions_dir" "$transaction_keep"

if [ "$dry_run" -eq 1 ]; then
  echo "Project OS artifact cleanup candidates: entry-contexts keep=$entry_keep, runs/state-bundles keep=$run_keep, events keep=$event_keep, terminal-transactions keep=$transaction_keep"
else
  echo "Project OS artifacts pruned: entry-contexts keep=$entry_keep, runs/state-bundles keep=$run_keep, events keep=$event_keep, terminal-transactions keep=$transaction_keep"
fi
