#!/usr/bin/env bash
set -euo pipefail

target="."
write_report=0

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/recommend-next.sh [target] [--write-report]

Scans a project and prints Project OS recommendations as JSON:
  evidence -> signals -> gaps -> recommendations -> checks

Options:
  --write-report  Also write .project-os/recommendations/recommend-next.json
  -h, --help      Show this help
USAGE
}

if [ "$#" -gt 0 ] && [ "${1#-}" = "$1" ]; then
  target="$1"
  shift
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --write-report)
      write_report=1
      shift
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

runtime_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d "$target" ]; then
  echo "ERROR: target directory not found: $target"
  exit 2
fi

cd "$target"

contract_registry="$runtime_root/schemas/file-contracts.v0.1.json"

json_escape_value() {
  printf '%s' "$1" | awk 'BEGIN { ORS = "" } {
    gsub(/\\/, "\\\\")
    gsub(/"/, "\\\"")
    gsub(/\t/, "\\t")
    gsub(/\r/, "\\r")
    gsub(/\n/, "\\n")
    printf "%s", $0
  }'
}

json_string() {
  printf '"%s"' "$(json_escape_value "$1")"
}

json_array() {
  first=1
  printf '['
  for item in "$@"; do
    if [ "$first" -eq 0 ]; then
      printf ','
    fi
    first=0
    json_string "$item"
  done
  printf ']'
}

has_file() {
  [ -f "$1" ]
}

has_dir() {
  [ -d "$1" ]
}

has_any_file() {
  pattern="$1"
  find . \
    -path './.git' -prune -o \
    -path './node_modules' -prune -o \
    -path './.project-os' -prune -o \
    -type f -name "$pattern" -print -quit 2>/dev/null | grep -q .
}

has_any_path() {
  find . \
    -path './.git' -prune -o \
    -path './node_modules' -prune -o \
    -path './.project-os' -prune -o \
    "$@" -print -quit 2>/dev/null | grep -q .
}

doc_meaningful_lines() {
  file="$1"
  [ -f "$file" ] || {
    printf '0\n'
    return 0
  }

  awk '
    {
      line = $0
      lower = tolower(line)
      if (line ~ /^[[:space:]]*$/) next
      if (line ~ /^[[:space:]]*#/) next
      if (line ~ /^[[:space:]]*>/) next
      if (line ~ /^[[:space:]]*```/) next
      if (line ~ /^[[:space:]]*\|/) next
      if (lower ~ /todo|tbd|待补|待填写|未记录|暂无记录|占位|placeholder|lorem|\{\{|\}\}/) next
      count++
    }
    END { printf "%d\n", count + 0 }
  ' "$file"
}

is_substantive_doc() {
  file="$1"
  min_lines="$2"
  [ -f "$file" ] || return 1
  meaningful_lines="$(doc_meaningful_lines "$file")"
  [ "$meaningful_lines" -ge "$min_lines" ]
}

has_package_script() {
  script_name="$1"
  [ -f package.json ] || return 1
  grep -Eq "\"$script_name\"[[:space:]]*:" package.json
}

has_package_scripts=0
has_runtime_scripts=0
has_test_signal=0
has_build_signal=0
has_env_signal=0
has_ui_signal=0
has_skill_signal=0
has_code_signal=0
has_multi_module_signal=0

if has_file package.json; then
  if grep -Eq '"scripts"[[:space:]]*:' package.json; then
    has_package_scripts=1
  fi
  if has_package_script dev || has_package_script start || has_package_script build; then
    has_runtime_scripts=1
  fi
  if has_package_script test || has_package_script lint; then
    has_test_signal=1
  fi
  if has_package_script build; then
    has_build_signal=1
  fi
fi

if has_dir src || has_dir app || has_dir pages || has_dir components || has_dir backend || has_dir server; then
  has_code_signal=1
fi

if has_dir tests || has_dir test || has_dir __tests__; then
  has_test_signal=1
fi

if has_file .env || has_file .env.local || has_file .env.development || has_any_file '*.env'; then
  has_env_signal=1
fi

if grep -R \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=.project-os \
  --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.cjs' \
  "process.env\\|import.meta.env\\|PUBLIC_" . \
  >/dev/null 2>&1; then
  has_env_signal=1
fi

if has_file index.html || has_dir components || has_dir pages || has_dir app || has_any_file '*.tsx' || has_any_file '*.jsx'; then
  has_ui_signal=1
fi

if has_dir .claude/skills || has_dir .agents/skills || has_dir .codex/skills || has_any_file 'SKILL.md'; then
  has_skill_signal=1
fi

module_count=0
for d in src app pages components backend server docs tests; do
  if has_dir "$d"; then
    module_count=$((module_count + 1))
  fi
done
[ "$module_count" -ge 3 ] && has_multi_module_signal=1

signal_rows=()
gap_rows=()
recommendation_rows=()
check_rows=()

add_signal() {
  id="$1"
  strength="$2"
  shift 2
  signal_rows+=("{\"id\":$(json_string "$id"),\"strength\":$(json_string "$strength"),\"evidence\":$(json_array "$@")}")
}

add_gap() {
  id="$1"
  title="$2"
  impact="$3"
  shift 3
  gap_rows+=("{\"id\":$(json_string "$id"),\"title\":$(json_string "$title"),\"impact\":$(json_string "$impact"),\"evidence\":$(json_array "$@")}")
}

add_recommendation() {
  file="$1"
  action="$2"
  reason="$3"
  confidence="$4"
  check="$5"
  evidence_strength="$6"
  gap_clarity="$7"
  risk_if_skipped="$8"
  confidence_reason="$9"
  shift 9
  contract_json="null"
  if [ -f "$contract_registry" ] && command -v node >/dev/null 2>&1; then
    contract_json="$(node - "$contract_registry" "$file" <<'NODE'
const fs = require("fs");
const [registryPath, file] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const contract = (data.contracts || []).find(item => item.file === file);
process.stdout.write(contract ? JSON.stringify({
  schemaVersion: data.schemaVersion,
  triggers: contract.triggers,
  requiredSections: contract.requiredSections,
  updatePolicy: contract.updatePolicy,
  validation: contract.validation
}) : "null");
NODE
)"
  fi
  recommendation_rows+=("{\"file\":$(json_string "$file"),\"action\":$(json_string "$action"),\"reason\":$(json_string "$reason"),\"evidence\":$(json_array "$@"),\"confidence\":$(json_string "$confidence"),\"evidenceStrength\":$(json_string "$evidence_strength"),\"gapClarity\":$(json_string "$gap_clarity"),\"riskIfSkipped\":$(json_string "$risk_if_skipped"),\"confidenceReason\":$(json_string "$confidence_reason"),\"check\":$(json_string "$check"),\"contract\":$contract_json,\"overridable\":true}")
}

add_check() {
  id="$1"
  command="$2"
  purpose="$3"
  check_rows+=("{\"id\":$(json_string "$id"),\"command\":$(json_string "$command"),\"purpose\":$(json_string "$purpose")}")
}

if [ "$has_package_scripts" -eq 1 ]; then
  add_signal "has_package_scripts" "strong" "package.json scripts"
fi
if [ "$has_runtime_scripts" -eq 1 ]; then
  add_signal "has_runtime_scripts" "strong" "package.json scripts.dev/start/build"
fi
if [ "$has_test_signal" -eq 1 ]; then
  add_signal "has_test_signal" "strong" "tests directory or package.json test/lint script"
fi
if [ "$has_env_signal" -eq 1 ]; then
  add_signal "has_environment_signal" "medium" ".env file or environment variable usage"
fi
if [ "$has_ui_signal" -eq 1 ]; then
  add_signal "has_ui_artifact" "medium" "index.html, pages, app, components, tsx or jsx files"
fi
if [ "$has_skill_signal" -eq 1 ]; then
  add_signal "has_skill_root" "strong" "SKILL.md or skill directory"
fi
if [ "$has_code_signal" -eq 1 ]; then
  add_signal "has_code_structure" "medium" "src, app, pages, components, backend or server directory"
fi
if [ "$has_multi_module_signal" -eq 1 ]; then
  add_signal "has_multi_module_structure" "medium" "three or more project module directories"
fi

if [ "$has_runtime_scripts" -eq 1 ] && ! is_substantive_doc docs/ENVIRONMENT.md 4; then
  add_gap "runtime_reproducibility_missing" "缺运行复现说明" "后续接手者可能不知道如何安装、启动和复现本地环境。" "package.json runtime scripts" "missing or thin docs/ENVIRONMENT.md"
  add_recommendation "docs/ENVIRONMENT.md" "create" "检测到项目有启动或构建脚本，但环境和启动说明缺失或信息量不足。" "high" "bash scripts/check-runtime.sh ." "strong" "clear" "后续接手者可能无法复现安装、启动和构建方式。" "强证据指向明确运行缺口，且该文档是继续接手的基础入口。" "package.json scripts.dev/start/build" "docs/ENVIRONMENT.md not substantive"
fi

if { [ "$has_package_scripts" -eq 1 ] || [ "$has_code_signal" -eq 1 ]; } && ! is_substantive_doc docs/TECH_STACK.md 4; then
  add_gap "tech_stack_boundary_missing" "缺技术栈边界记录" "AI 可能误判框架、运行时或版本边界，生成不匹配的代码。" "package.json or code directory" "missing or thin docs/TECH_STACK.md"
  add_recommendation "docs/TECH_STACK.md" "create" "检测到代码或依赖信号，但缺少技术栈和版本边界记录。" "medium" "bash scripts/check-runtime.sh ." "medium" "probable" "AI 可能按错误框架、运行时或版本生成代码。" "存在代码或依赖证据，但小项目也可能暂时不需要完整技术栈文档。" "package.json or code directory" "docs/TECH_STACK.md not substantive"
fi

if [ "$has_test_signal" -eq 1 ] && ! is_substantive_doc docs/TESTING.md 4; then
  add_gap "testing_contract_missing" "缺测试和验收说明" "有测试信号但没有验收边界，改动后容易只跑部分检查。" "tests or package.json test/lint script" "missing or thin docs/TESTING.md"
  add_recommendation "docs/TESTING.md" "create" "检测到测试目录或测试脚本，但测试和验收说明缺失或信息量不足。" "high" "bash scripts/check-runtime.sh ." "strong" "clear" "后续改动可能不知道必须跑哪些测试或如何验收。" "强测试证据指向明确验收缺口，且跳过会直接影响交付可信度。" "tests directory or package.json test/lint script" "docs/TESTING.md not substantive"
fi

if [ "$has_env_signal" -eq 1 ] && ! has_file .env.example; then
  add_gap "env_example_missing" "缺环境变量占位" "后续接手者可能不知道必须配置哪些变量，也容易把真实密钥写进文档。" ".env or environment variable usage" "missing .env.example"
  add_recommendation ".env.example" "create" "检测到环境变量或本地 env 文件，但缺少可提交的变量占位示例。" "high" "bash scripts/check-secrets.sh ." "strong" "clear" "真实密钥可能进入文档或仓库，接手者也不知道要配哪些变量。" "环境变量证据明确，缺少 .env.example 会同时影响安全和复现。" ".env file or env usage" "missing .env.example"
fi

if [ "$has_ui_signal" -eq 1 ] && ! is_substantive_doc docs/DESIGN_STANDARDS.md 4; then
  add_gap "design_boundary_missing" "缺设计边界" "页面或组件继续迭代时，视觉规则容易漂移。" "UI artifact signal" "missing or thin docs/DESIGN_STANDARDS.md"
  add_recommendation "docs/DESIGN_STANDARDS.md" "create" "检测到页面或组件信号，但设计边界文档缺失或信息量不足。" "medium" "bash scripts/check-runtime.sh ." "medium" "probable" "后续 UI 修改可能出现视觉风格漂移或组件边界不一致。" "有 UI 证据，但不是所有 UI 项目都需要立即补完整设计规范。" "index.html, app, pages, components, tsx or jsx files" "docs/DESIGN_STANDARDS.md not substantive"
fi

if [ "$has_multi_module_signal" -eq 1 ] && ! is_substantive_doc docs/ARCHITECTURE.md 4; then
  add_gap "architecture_boundary_missing" "缺架构和模块边界" "目录变多后，AI 和维护者容易改错模块或重复造入口。" "multi module directory signal" "missing or thin docs/ARCHITECTURE.md"
  add_recommendation "docs/ARCHITECTURE.md" "create" "检测到多个模块目录，但架构职责和边界说明缺失或信息量不足。" "medium" "bash scripts/check-runtime.sh ." "medium" "probable" "维护者或 AI 可能误判模块职责，造成重复实现或改错位置。" "多目录是中等强度架构信号，但目录多不一定代表架构已经复杂。" "multiple module directories" "docs/ARCHITECTURE.md not substantive"
fi

if [ "$has_skill_signal" -eq 1 ] && ! is_substantive_doc docs/SKILL_ENGINEERING.md 4; then
  add_gap "skill_engineering_contract_missing" "缺 Skill 工程边界" "Skill 会逐步膨胀，触发条件、参考资料和验收方式不稳定。" "skill root signal" "missing or thin docs/SKILL_ENGINEERING.md"
  add_recommendation "docs/SKILL_ENGINEERING.md" "create" "检测到 Skill 目录或 SKILL.md，但缺少 Skill 工程边界说明。" "high" "bash scripts/check-runtime.sh ." "strong" "clear" "Skill 可能膨胀成不可维护文件包，触发条件和验收方式不稳定。" "Skill 文件是强证据，且工程边界缺口会直接影响 AI 行为稳定性。" "SKILL.md or skill directory" "docs/SKILL_ENGINEERING.md not substantive"
fi

if ! is_substantive_doc HANDOFF.md 4; then
  add_gap "handoff_context_missing" "缺当前交接上下文" "下一位维护者或 AI 无法快速知道当前状态、风险和下一步。" "missing or thin HANDOFF.md"
  add_recommendation "HANDOFF.md" "update" "当前交接文档缺失或信息量不足，建议补当前状态、风险和下一步。" "high" "bash scripts/check-runtime.sh ." "strong" "clear" "下一位维护者或 AI 会缺少当前状态、风险和下一步。" "交接上下文是 Project OS 的核心入口，缺失时应默认优先补齐。" "HANDOFF.md not substantive"
fi

add_check "runtime" "bash scripts/check-runtime.sh ." "检查 Project OS 文档和运行规则是否自洽。"
if [ "$has_env_signal" -eq 1 ] || has_file .env.example; then
  add_check "secrets" "bash scripts/check-secrets.sh ." "检查密钥占位和 tracked files 是否安全。"
fi
if has_file scripts/check-ai-project.sh; then
  add_check "ai_project_report" "bash scripts/check-ai-project.sh . --write-report" "生成 AI 工程成熟度报告。"
fi

join_json_rows() {
  first=1
  for row in "$@"; do
    if [ "$first" -eq 0 ]; then
      printf ','
    fi
    first=0
    printf '%s' "$row"
  done
}

recommendation_count="${#recommendation_rows[@]}"
status="needs_action"
if [ "$recommendation_count" -eq 0 ]; then
  status="no_obvious_gap"
fi

generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
tmp_json="$(mktemp)"

{
  printf '{'
  printf '"schemaVersion":"project-os.recommendation.v0.1",'
  printf '"generatedAt":'
  json_string "$generated_at"
  printf ','
  printf '"target":'
  json_string "$(pwd)"
  printf ','
  printf '"status":'
  json_string "$status"
  printf ','
  printf '"summary":{"recommendationCount":%s,"signalCount":%s,"gapCount":%s},' "$recommendation_count" "${#signal_rows[@]}" "${#gap_rows[@]}"
  printf '"evidence":{"files":{'
  printf '"packageJson":%s,' "$(has_file package.json && echo true || echo false)"
  printf '"envExample":%s,' "$(has_file .env.example && echo true || echo false)"
  printf '"handoff":%s,' "$(has_file HANDOFF.md && echo true || echo false)"
  printf '"environmentDoc":%s,' "$(has_file docs/ENVIRONMENT.md && echo true || echo false)"
  printf '"testingDoc":%s,' "$(has_file docs/TESTING.md && echo true || echo false)"
  printf '"designStandardsDoc":%s,' "$(has_file docs/DESIGN_STANDARDS.md && echo true || echo false)"
  printf '"skillEngineeringDoc":%s' "$(has_file docs/SKILL_ENGINEERING.md && echo true || echo false)"
  printf '},'
  printf '"signals":{"packageScripts":%s,"runtimeScripts":%s,"testSignal":%s,"envSignal":%s,"uiSignal":%s,"skillSignal":%s,"codeSignal":%s}}' \
    "$([ "$has_package_scripts" -eq 1 ] && echo true || echo false)" \
    "$([ "$has_runtime_scripts" -eq 1 ] && echo true || echo false)" \
    "$([ "$has_test_signal" -eq 1 ] && echo true || echo false)" \
    "$([ "$has_env_signal" -eq 1 ] && echo true || echo false)" \
    "$([ "$has_ui_signal" -eq 1 ] && echo true || echo false)" \
    "$([ "$has_skill_signal" -eq 1 ] && echo true || echo false)" \
    "$([ "$has_code_signal" -eq 1 ] && echo true || echo false)"
  printf ','
  printf '"signals":['
  join_json_rows ${signal_rows[@]+"${signal_rows[@]}"}
  printf '],'
  printf '"gaps":['
  join_json_rows ${gap_rows[@]+"${gap_rows[@]}"}
  printf '],'
  printf '"recommendations":['
  join_json_rows ${recommendation_rows[@]+"${recommendation_rows[@]}"}
  printf '],'
  printf '"checks":['
  join_json_rows ${check_rows[@]+"${check_rows[@]}"}
  printf ']'
  printf '}\n'
} > "$tmp_json"

cat "$tmp_json"

if [ "$write_report" -eq 1 ]; then
  mkdir -p .project-os/recommendations
  cp "$tmp_json" .project-os/recommendations/recommend-next.json
fi

rm -f "$tmp_json"
