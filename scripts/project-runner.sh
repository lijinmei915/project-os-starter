#!/usr/bin/env bash
set -euo pipefail

target="."
source_type="local"
source_uri=""

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/project-runner.sh [target] [--source local|git|zip|new] [--uri value]

Runs the minimal Project OS runner loop:
  check-ai-project -> recommend-next -> runtime/check-all probe -> run record

Outputs:
  .project-os/runs/<run-id>.json
  .project-os/runs/logs/<run-id>/*.log
USAGE
}

if [ "$#" -gt 0 ] && [ "${1#-}" = "$1" ]; then
  target="$1"
  shift
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --source)
      source_type="${2:-}"
      shift 2
      ;;
    --uri)
      source_uri="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown option: $1"
      usage
      exit 2
      ;;
  esac
done

case "$source_type" in
  local|git|zip|new) ;;
  *)
    echo "ERROR: unsupported source type: $source_type"
    exit 2
    ;;
esac

if [ ! -d "$target" ]; then
  echo "ERROR: target directory not found: $target"
  exit 2
fi

runtime_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target_abs="$(cd "$target" && pwd)"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
run_dir="$target_abs/.project-os/runs"
log_dir="$run_dir/logs/$run_id"
run_file="$run_dir/$run_id.json"
commands_file="$(mktemp)"

mkdir -p "$run_dir" "$log_dir" "$target_abs/.project-os/reports" "$target_abs/.project-os/recommendations"

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

record_command() {
  name="$1"
  command="$2"
  exit_code="$3"
  log_file="$4"
  printf '{"name":"%s","command":"%s","exitCode":%s,"logFile":"%s"}\n' \
    "$(json_escape "$name")" \
    "$(json_escape "$command")" \
    "$exit_code" \
    "$(json_escape "$log_file")" >> "$commands_file"
}

run_command() {
  name="$1"
  log_file="$log_dir/$name.log"
  shift
  command="$*"
  set +e
  "$@" > "$log_file" 2>&1
  exit_code=$?
  set -e
  record_command "$name" "$command" "$exit_code" "${log_file#$target_abs/}"
  return 0
}

run_command "check-ai-project" bash "$runtime_root/scripts/check-ai-project.sh" "$target_abs" --write-report
run_command "recommend-next" bash "$runtime_root/scripts/recommend-next.sh" "$target_abs" --write-report

if [ -f "$target_abs/scripts/check-all.sh" ]; then
  run_command "check-all" bash "$target_abs/scripts/check-all.sh" "$target_abs"
else
  run_command "runtime-probe" bash "$runtime_root/scripts/check-runtime.sh" "$target_abs"
fi

finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
report_json=".project-os/reports/ai-project-report.json"
report_md=".project-os/reports/ai-project-report.md"
recommend_json=".project-os/recommendations/recommend-next.json"
run_record=".project-os/runs/$run_id.json"

node - "$commands_file" "$run_file" "$run_id" "$started_at" "$finished_at" "$target_abs" "$source_type" "$source_uri" "$report_json" "$report_md" "$recommend_json" "$run_record" <<'NODE'
const fs = require("fs");
const [
  commandsFile,
  runFile,
  runId,
  startedAt,
  finishedAt,
  targetPath,
  sourceType,
  sourceUri,
  reportJson,
  reportMarkdown,
  recommendationsJson,
  runRecord
] = process.argv.slice(2);

const commands = fs.readFileSync(commandsFile, "utf8")
  .trim()
  .split(/\n/)
  .filter(Boolean)
  .map(line => JSON.parse(line));

const failed = commands.some(command => command.exitCode !== 0);
const status = failed ? "failed" : "passed";
const record = {
  schemaVersion: "project-os.project-run.v0.1",
  runId,
  startedAt,
  finishedAt,
  target: { path: targetPath },
  source: sourceUri ? { type: sourceType, uri: sourceUri } : { type: sourceType },
  status,
  commands,
  outputs: {
    reportJson,
    reportMarkdown,
    recommendationsJson,
    runRecord
  },
  next: {
    summary: failed ? "至少一个检查命令失败，请先查看 run 日志和报告。" : "Runner 已完成体检和推荐生成，可查看报告并决定下一步。",
    requiresHumanConfirmation: true
  }
};

fs.writeFileSync(runFile, `${JSON.stringify(record, null, 2)}\n`);
NODE

rm -f "$commands_file"

echo "Project run complete: $run_file"
