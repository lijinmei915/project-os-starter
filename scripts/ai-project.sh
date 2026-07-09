#!/usr/bin/env bash
set -euo pipefail

command="${1:-}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$script_dir/.." && pwd)"
native_cli="$root/bin/project-os"

if [ -n "${PROJECT_OS_CLI_BIN:-}" ] && [ -x "$PROJECT_OS_CLI_BIN" ]; then
  exec "$PROJECT_OS_CLI_BIN" "$@" --runtime-root "$root"
fi

if [ "${PROJECT_OS_USE_NATIVE_CLI:-1}" = "1" ] && [ -x "$native_cli" ]; then
  exec "$native_cli" "$@" --runtime-root "$root"
fi

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/ai-project.sh <command> [target] [options]

Commands:
  context Write Entry Context only
  scan    Run unified entry scan loop and write reports
  check    Print AI project completeness score
  report   Print score and write markdown + JSON reports（可视化打开根目录 index.html）
  recommend  Print evidence-based next-step recommendations as JSON
  run     Run check + recommend + runtime probe and write a run record
  install  Install selected AI engineering docs

Examples:
  bash scripts/ai-project.sh scan .
  bash scripts/ai-project.sh context . --output json --persist none
  bash scripts/ai-project.sh check .
  bash scripts/ai-project.sh report .
  bash scripts/ai-project.sh recommend .
  bash scripts/ai-project.sh run .
  bash scripts/ai-project.sh install . --profile core
USAGE
}

json_escape() {
  printf '%s' "$1" | awk 'BEGIN { ORS = "" } {
    gsub(/\\/, "\\\\")
    gsub(/"/, "\\\"")
    gsub(/\t/, "\\t")
    gsub(/\r/, "\\r")
    gsub(/\n/, "\\n")
    printf "%s", $0
  }'
}

entry_intent_for_command() {
  case "$1" in
    scan) echo "scan" ;;
    check) echo "check" ;;
    report) echo "report" ;;
    recommend) echo "recommend" ;;
    run) echo "validate" ;;
    *) echo "$1" ;;
  esac
}

write_entry_context() {
  entry_command="$1"
  target="${2:-.}"

  if [ ! -d "$target" ]; then
    return 0
  fi

  target_abs="$(cd "$target" && pwd)"
  context_dir="$target_abs/.project-os/entry-contexts"
  mkdir -p "$context_dir"

  created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  request_id="$(date -u +%Y%m%dT%H%M%SZ)-$$-$entry_command"
  context_file="$context_dir/$request_id.json"
  intent="$(entry_intent_for_command "$entry_command")"
  branch=""
  commit=""

  if git -C "$target_abs" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    branch="$(git -C "$target_abs" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    commit="$(git -C "$target_abs" rev-parse HEAD 2>/dev/null || true)"
  fi

  {
    printf '{\n'
    printf '  "schemaVersion": "project-os.entry-context.v0.1",\n'
    printf '  "entry": "cli",\n'
    printf '  "mode": "readonly",\n'
    printf '  "intent": "%s",\n' "$(json_escape "$intent")"
    printf '  "actor": {\n'
    printf '    "type": "user",\n'
    printf '    "name": "%s"\n' "$(json_escape "${USER:-local}")"
    printf '  },\n'
    printf '  "project": {\n'
    printf '    "path": "%s"' "$(json_escape "$target_abs")"
    if [ -n "$branch" ]; then
      printf ',\n    "branch": "%s"' "$(json_escape "$branch")"
    fi
    if [ -n "$commit" ]; then
      printf ',\n    "commit": "%s"' "$(json_escape "$commit")"
    fi
    printf '\n  },\n'
    printf '  "request": {\n'
    printf '    "id": "%s",\n' "$(json_escape "$request_id")"
    printf '    "createdAt": "%s",\n' "$(json_escape "$created_at")"
    printf '    "source": "scripts/ai-project.sh"\n'
    printf '  },\n'
    printf '  "trigger": {\n'
    printf '    "source": "%s"\n' "$(json_escape "${PROJECT_OS_TRIGGER_SOURCE:-manual-cli}")"
    printf '  },\n'
    printf '  "permissions": {\n'
    printf '    "allowRead": true,\n'
    printf '    "allowWrite": false,\n'
    printf '    "allowNetwork": false,\n'
    printf '    "allowShell": false,\n'
    printf '    "policy": "readonly-local"\n'
    printf '  },\n'
    printf '  "trace": {\n'
    printf '    "gatewayRequestId": "%s"\n' "$(json_escape "$request_id")"
    printf '  }\n'
    printf '}\n'
  } > "$context_file"

  validate_entry_context "$context_file"

  export PROJECT_OS_ENTRY_CONTEXT="$context_file"
}

emit_cli_result() {
  result_command="$1"
  exit_code="$2"
  context_file="${PROJECT_OS_ENTRY_CONTEXT:-}"
  persist="${PROJECT_OS_PERSIST:-always}"

  if [ "${PROJECT_OS_OUTPUT:-file}" = "file" ]; then
    if [ -n "$context_file" ]; then
      echo "Entry context: $context_file"
    fi
    return 0
  fi

  entry_context="null"
  if [ -n "$context_file" ]; then
    entry_context="\"$(json_escape "$context_file")\""
  fi

  cat <<JSON
{
  "schemaVersion": "project-os.cli-result.v0.1",
  "status": "$([ "$exit_code" -eq 0 ] && echo passed || echo failed)",
  "exitCode": $exit_code,
  "entryContext": $entry_context,
  "command": "$(json_escape "$result_command")",
  "triggerSource": "$(json_escape "${PROJECT_OS_TRIGGER_SOURCE:-manual-cli}")",
  "persist": "$(json_escape "$persist")",
  "outputs": {}
}
JSON
}

parse_legacy_entry_options() {
  PROJECT_OS_OUTPUT="file"
  PROJECT_OS_PERSIST="always"
  PROJECT_OS_TARGET="."
  PROJECT_OS_PASSTHROUGH=()
  target_set=0

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --output)
        PROJECT_OS_OUTPUT="${2:-file}"
        shift 2
        ;;
      --persist)
        case "${2:-auto}" in
          auto|none|full)
            PROJECT_OS_PERSIST="${2:-auto}"
            ;;
          always)
            PROJECT_OS_PERSIST="full"
            ;;
          never)
            PROJECT_OS_PERSIST="none"
            ;;
          *)
            echo "ERROR: --persist requires auto, none, or full"
            exit 2
            ;;
        esac
        shift 2
        ;;
      --trigger-source)
        PROJECT_OS_TRIGGER_SOURCE="${2:-manual-cli}"
        export PROJECT_OS_TRIGGER_SOURCE
        shift 2
        ;;
      --runtime-root)
        shift 2
        ;;
      --)
        shift
        PROJECT_OS_PASSTHROUGH+=("$@")
        break
        ;;
      -*)
        PROJECT_OS_PASSTHROUGH+=("$1")
        shift
        ;;
      *)
        if [ "$target_set" -eq 0 ]; then
          PROJECT_OS_TARGET="$1"
          target_set=1
        else
          PROJECT_OS_PASSTHROUGH+=("$1")
        fi
        shift
        ;;
    esac
  done
}

validate_entry_context() {
  context_file="$1"
  python3 - "$context_file" <<'PY'
import json
import sys

data = json.loads(open(sys.argv[1], encoding="utf-8").read())
required = ["schemaVersion", "entry", "mode", "intent", "actor", "project", "request"]
missing = [key for key in required if key not in data]
if missing:
    raise SystemExit(f"Entry Context validation failed: missing {', '.join(missing)}")
if data["schemaVersion"] != "project-os.entry-context.v0.1":
    raise SystemExit("Entry Context validation failed: invalid schemaVersion")
if data["entry"] not in ["desktop", "web", "ide", "cli", "ci", "api"]:
    raise SystemExit("Entry Context validation failed: invalid entry")
if data["mode"] not in ["readonly", "draft", "apply"]:
    raise SystemExit("Entry Context validation failed: invalid mode")
if data["intent"] not in ["scan", "check", "recommend", "report", "plan", "draft", "apply", "validate"]:
    raise SystemExit("Entry Context validation failed: invalid intent")
if not data["project"].get("path"):
    raise SystemExit("Entry Context validation failed: missing project.path")
request = data["request"]
if not request.get("id") or "T" not in request.get("createdAt", "") or not request.get("createdAt", "").endswith("Z"):
    raise SystemExit("Entry Context validation failed: invalid request")
trigger = data.get("trigger", {"source": "manual-cli"})
if trigger.get("source") not in ["desktop", "manual-cli", "ci", "gateway", "api", "ide", "automation"]:
    raise SystemExit("Entry Context validation failed: invalid trigger.source")
PY
}

prune_artifacts() {
  target="${1:-.}"
  if [ -f "$script_dir/prune-project-os-artifacts.sh" ]; then
    bash "$script_dir/prune-project-os-artifacts.sh" "$target" >/dev/null 2>&1 || true
  fi
}

if [ -z "$command" ] || [ "$command" = "-h" ] || [ "$command" = "--help" ]; then
  usage
  exit 0
fi

shift || true

case "$command" in
  context)
    parse_legacy_entry_options "$@"
    if [ "$PROJECT_OS_PERSIST" = "auto" ]; then
      case "${PROJECT_OS_TRIGGER_SOURCE:-manual-cli}" in
        ci|gateway|api|automation) PROJECT_OS_PERSIST="none" ;;
        *) PROJECT_OS_PERSIST="full" ;;
      esac
    fi
    if [ "$PROJECT_OS_PERSIST" != "none" ]; then
      write_entry_context "$command" "$PROJECT_OS_TARGET"
    fi
    emit_cli_result "$command" 0
    ;;
  scan)
    write_entry_context "$command" "${1:-.}"
    bash "$script_dir/project-runner.sh" "${1:-.}" --source local
    prune_artifacts "${1:-.}"
    ;;
  check)
    write_entry_context "$command" "${1:-.}"
    bash "$script_dir/check-ai-project.sh" "${1:-.}"
    prune_artifacts "${1:-.}"
    ;;
  report)
    write_entry_context "$command" "${1:-.}"
    bash "$script_dir/check-ai-project.sh" "${1:-.}" --write-report
    prune_artifacts "${1:-.}"
    ;;
  recommend)
    write_entry_context "$command" "${1:-.}"
    bash "$script_dir/recommend-next.sh" "${1:-.}" "${@:2}"
    prune_artifacts "${1:-.}"
    ;;
  run)
    write_entry_context "$command" "${1:-.}"
    bash "$script_dir/project-runner.sh" "${1:-.}" --source local "${@:2}"
    prune_artifacts "${1:-.}"
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
