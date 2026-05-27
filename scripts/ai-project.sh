#!/usr/bin/env bash
set -euo pipefail

command="${1:-}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$script_dir/.." && pwd)"

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/ai-project.sh <command> [target] [options]

Commands:
  check    Print AI project completeness score
  report   Print score and write markdown + JSON reports（可视化打开根目录 index.html）
  install  Install selected AI engineering docs

Examples:
  bash scripts/ai-project.sh check .
  bash scripts/ai-project.sh report .
  bash scripts/ai-project.sh install . --profile core
USAGE
}

if [ -z "$command" ] || [ "$command" = "-h" ] || [ "$command" = "--help" ]; then
  usage
  exit 0
fi

shift || true

case "$command" in
  check)
    bash "$script_dir/check-ai-project.sh" "${1:-.}"
    ;;
  report)
    bash "$script_dir/check-ai-project.sh" "${1:-.}" --write-report
    ;;
  install)
    bash "$script_dir/install-project-os.sh" "$@"
    ;;
  *)
    echo "ERROR: unknown command: $command"
    usage
    exit 2
    ;;
esac
