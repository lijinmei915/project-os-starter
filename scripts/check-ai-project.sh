#!/usr/bin/env bash
set -u

target="."
write_report=0

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
    --html)
      # Deprecated: HTML 报告页已合并到根目录 index.html，不再生成副本。
      shift
      ;;
    -h|--help)
      cat <<'USAGE'
Usage:
  bash scripts/check-ai-project.sh [target] [--write-report]

Checks AI engineering completeness:
  - system rules
  - developer environment
  - user intent / project state
  - project files / architecture
  - tool feedback / testing
  - handoff continuity

Reports:
  --write-report  Write .project-os/reports/ai-project-report.md
                  and .project-os/reports/ai-project-report.json

可视化报告：直接用浏览器打开项目根目录的 index.html。
USAGE
      exit 0
      ;;
    *)
      echo "ERROR: unknown option: $1"
      exit 2
      ;;
  esac
done

if [ ! -d "$target" ]; then
  echo "ERROR: target directory not found: $target"
  exit 2
fi

cd "$target" || exit 2

score=0
max_score=100
maturity_score=0
maturity_max_score=100
generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
report_file=".project-os/reports/ai-project-report.md"
json_file=".project-os/reports/ai-project-report.json"
report_modules_file="${AI_PROJECT_REPORT_MODULES:-schemas/ai-project-report.v0.1.json}"
tmp_report="$(mktemp)"
tmp_items="$(mktemp)"
tmp_maturity="$(mktemp)"

has_file() {
  [ -f "$1" ]
}

has_dir() {
  [ -d "$1" ]
}

has_any() {
  file="$1"
  shift
  [ -f "$file" ] || return 1
  for pattern in "$@"; do
    if grep -qi -- "$pattern" "$file"; then
      return 0
    fi
  done
  return 1
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
      if (line ~ /^[[:space:]]*[-*][[:space:]]*`?未记录`?[[:space:]]*$/) next
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

has_quality_any() {
  file="$1"
  min_lines="$2"
  shift 2
  is_substantive_doc "$file" "$min_lines" && has_any "$file" "$@"
}

escape_html() {
  sed \
    -e 's/&/\&amp;/g' \
    -e 's/</\&lt;/g' \
    -e 's/>/\&gt;/g' \
    -e 's/"/\&quot;/g'
}

json_escape() {
  awk 'BEGIN { ORS = "" } {
    gsub(/\\/, "\\\\")
    gsub(/"/, "\\\"")
    gsub(/\t/, "\\t")
    gsub(/\r/, "\\r")
    printf "%s", $0
  }'
}

load_report_modules() {
  data_file="$1"

  awk '
    function string_value(line) {
      sub(/^[^:]*:[ \t]*"/, "", line)
      sub(/",[ \t]*$/, "", line)
      sub(/"$/, "", line)
      return line
    }
    function sections_value(line) {
      sub(/^.*\[/, "", line)
      sub(/\].*$/, "", line)
      gsub(/"/, "", line)
      gsub(/[ \t]*,[ \t]*/, "|", line)
      gsub(/^[ \t]+|[ \t]+$/, "", line)
      return line
    }
    /"id"[ \t]*:/ {
      id = string_value($0)
    }
    /"title"[ \t]*:/ {
      title = string_value($0)
    }
    /"sections"[ \t]*:/ {
      sections = sections_value($0)
    }
    /"help"[ \t]*:/ {
      help = string_value($0)
    }
    /^[ \t]*}[,]?[ \t]*$/ && title != "" {
      printf "%s\t%s\t%s\t%s\n", id, title, help, sections
      id = ""
      title = ""
      help = ""
      sections = ""
    }
  ' "$data_file"
}

add_item() {
  section="$1"
  status="$2"
  earned="$3"
  max="$4"
  label="$5"
  printf '%s\t%s\t%s\t%s\t%s\n' "$section" "$status" "$earned" "$max" "$label" >> "$tmp_items"
  score=$((score + earned))
}

award() {
  section="$1"
  points="$2"
  label="$3"
  add_item "$section" "PASS" "$points" "$points" "$label"
}

gap() {
  section="$1"
  points="$2"
  label="$3"
  add_item "$section" "GAP" "0" "$points" "$label"
}

add_maturity_item() {
  section="$1"
  status="$2"
  earned="$3"
  max="$4"
  label="$5"
  printf '%s\t%s\t%s\t%s\t%s\n' "$section" "$status" "$earned" "$max" "$label" >> "$tmp_maturity"
  maturity_score=$((maturity_score + earned))
}

maturity_award() {
  section="$1"
  points="$2"
  label="$3"
  add_maturity_item "$section" "PASS" "$points" "$points" "$label"
}

maturity_gap() {
  section="$1"
  points="$2"
  label="$3"
  add_maturity_item "$section" "GAP" "0" "$points" "$label"
}

check_file() {
  section="$1"
  file="$2"
  points="$3"
  label="$4"
  if has_file "$file"; then
    award "$section" "$points" "$label"
  else
    gap "$section" "$points" "$label"
  fi
}

check_doc_quality() {
  section="$1"
  file="$2"
  points="$3"
  pass_label="$4"
  min_lines="$5"
  gap_label="${6:-$file 缺失或仍像空模板}"
  if is_substantive_doc "$file" "$min_lines"; then
    award "$section" "$points" "$pass_label"
  else
    gap "$section" "$points" "$gap_label"
  fi
}

check_content() {
  section="$1"
  file="$2"
  points="$3"
  label="$4"
  shift 4
  if has_any "$file" "$@"; then
    award "$section" "$points" "$label"
  else
    gap "$section" "$points" "$label"
  fi
}

check_doc_content() {
  section="$1"
  file="$2"
  points="$3"
  label="$4"
  min_lines="$5"
  shift 5
  if has_quality_any "$file" "$min_lines" "$@"; then
    award "$section" "$points" "$label"
  else
    gap "$section" "$points" "$file 内容不足，仍像空模板或缺少关键说明"
  fi
}

section_score() {
  section="$1"
  awk -F '\t' -v section="$section" '$1 == section { earned += $3; max += $4 } END { printf "%d/%d", earned, max }' "$tmp_items"
}

section_percent() {
  section="$1"
  awk -F '\t' -v section="$section" '$1 == section { earned += $3; max += $4 } END { if (max == 0) print 0; else printf "%d", (earned * 100 / max) }' "$tmp_items"
}

maturity_section_score() {
  section="$1"
  awk -F '\t' -v section="$section" '$1 == section { earned += $3; max += $4 } END { printf "%d/%d", earned, max }' "$tmp_maturity"
}

status_text() {
  if [ "$score" -ge 85 ]; then
    printf '状态良好'
  elif [ "$score" -ge 70 ]; then
    printf '可用，有缺口'
  else
    printf '需要补工程文档'
  fi
}

status_class() {
  if [ "$score" -ge 85 ]; then
    printf 'strong'
  elif [ "$score" -ge 70 ]; then
    printf 'usable'
  else
    printf 'weak'
  fi
}

maturity_status_text() {
  if [ "$maturity_score" -ge 85 ]; then
    printf '工程闭环较完整'
  elif [ "$maturity_score" -ge 65 ]; then
    printf '上下文可用，工程化有缺口'
  else
    printf '文件骨架可用，工程闭环不足'
  fi
}

maturity_status_class() {
  if [ "$maturity_score" -ge 85 ]; then
    printf 'strong'
  elif [ "$maturity_score" -ge 65 ]; then
    printf 'usable'
  else
    printf 'weak'
  fi
}

check_doc_quality "系统规则" "AGENTS.md" 8 "存在可用 AGENTS.md，作为 AI 规则入口" 8
check_doc_content "系统规则" "AGENTS.md" 7 "AGENTS.md 说明了 AI 行为、安全边界或文档规则" 8 "Safety" "Documentation" "Routing" "规则" "文档"

check_doc_quality "开发者规则" "docs/ENVIRONMENT.md" 8 "存在可用 docs/ENVIRONMENT.md，说明环境、依赖、变量或外部服务" 5
if has_file "package.json" || has_quality_any "README.md" 4 "install" "start" "run" "启动" "安装" "环境"; then
  award "开发者规则" 7 "README 或 package 信息提供了安装、启动或运行入口"
else
  gap "开发者规则" 7 "README 或 package 信息应提供安装、启动或运行入口，不能只是空模板"
fi

check_doc_quality "用户意图" "PROJECT.md" 8 "存在可用 PROJECT.md，记录当前项目状态" 4
check_doc_content "用户意图" "PROJECT.md" 7 "PROJECT.md 包含项目定位、当前阶段、状态或下一步重点" 4 "当前阶段" "当前状态" "下一步" "定位" "phase" "status"

if is_substantive_doc "docs/ARCHITECTURE.md" 4 || is_substantive_doc "docs/CODE_STRUCTURE.md" 4; then
  award "项目文件" 7 "存在架构说明或代码结构说明"
else
  gap "项目文件" 7 "建议补可用的 docs/ARCHITECTURE.md 或 docs/CODE_STRUCTURE.md，不能只是空模板"
fi
if has_quality_any "docs/ARCHITECTURE.md" 4 "模块" "职责" "数据流" "边界" "module" "boundary" || has_quality_any "docs/CODE_STRUCTURE.md" 4 "职责" "目录" "结构"; then
  award "项目文件" 3 "架构文档说明了模块职责或边界"
else
  gap "项目文件" 3 "架构文档应说明模块职责或边界，不能只是目录占位"
fi

check_doc_quality "工具反馈" "docs/TESTING.md" 7 "存在可用 docs/TESTING.md" 4
if has_file "scripts/check-runtime.sh" || has_file "scripts/check-ai-project.sh" || has_any "package.json" '"test"' "vitest" "jest" "playwright"; then
  award "工具反馈" 8 "项目提供了测试或检查命令"
else
  gap "工具反馈" 8 "建议补一个明确的测试或检查命令"
fi

check_doc_quality "交接摘要" "HANDOFF.md" 9 "存在可用 HANDOFF.md" 4
check_doc_content "交接摘要" "HANDOFF.md" 6 "HANDOFF.md 包含当前状态、风险或下一步" 4 "当前状态" "风险" "下一步" "blocked" "next"

check_doc_quality "决策和运行" "docs/DECISIONS.md" 5 "存在可用 docs/DECISIONS.md，用于记录关键决策" 3
if is_substantive_doc "docs/RUNBOOK.md" 3 || is_substantive_doc "docs/CHANGELOG.md" 3; then
  award "决策和运行" 5 "存在运行手册或变更记录"
else
  gap "决策和运行" 5 "建议补可用的 docs/RUNBOOK.md 或 docs/CHANGELOG.md"
fi

check_doc_quality "命名和文档治理" "docs/NAMING.md" 3 "存在可用 docs/NAMING.md，说明文档命名规范" 4
check_doc_quality "命名和文档治理" "docs/DOCUMENTATION.md" 2 "存在可用 docs/DOCUMENTATION.md，说明文档边界" 4

state_stage=""
if has_file ".project-os/state.json"; then
  state_stage="$(sed -n 's/.*"stage"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' .project-os/state.json | head -n 1)"
fi

if [ -n "$state_stage" ] && has_any "PROJECT.md" "$state_stage"; then
  maturity_award "评分与状态源" 8 "PROJECT.md 与 .project-os/state.json 的当前阶段一致"
else
  maturity_gap "评分与状态源" 8 "PROJECT.md 与 .project-os/state.json 应保持当前阶段一致"
fi

if has_file "schemas/ai-project-score.schema.json" && has_file "schemas/ai-project-score.v0.2.json" && has_any "schemas/ai-project-score.v0.2.json" "ai-project-engineering-score" "\"version\": \"0.2\""; then
  maturity_award "评分与状态源" 7 "存在评分模型 schema 和 v0.2 数据源"
else
  maturity_gap "评分与状态源" 7 "建议补评分模型 schema 和 v0.2 数据源，避免评分规则只藏在脚本里"
fi

if has_any "docs/PRODUCT_PLAN.md" "100/100" "真实工程成熟" "工程闭环"; then
  maturity_award "评分与状态源" 5 "路线图已说明文件完整度不等于真实工程成熟度"
else
  maturity_gap "评分与状态源" 5 "路线图应说明文件完整度和工程成熟度的差异"
fi

if has_file "scripts/test.sh" || has_file "tests/run.sh" || has_file "tests/run-tests.sh" || has_any "package.json" '"test"' "vitest" "jest" "playwright"; then
  maturity_award "测试与质量门禁" 8 "存在可执行测试入口"
else
  maturity_gap "测试与质量门禁" 8 "缺少可执行测试入口，目前更像人工验收清单"
fi

if has_file "scripts/create-test-fixtures.sh" || has_dir "fixtures"; then
  maturity_award "测试与质量门禁" 5 "存在测试夹具或夹具生成脚本"
else
  maturity_gap "测试与质量门禁" 5 "建议补 fixtures，覆盖空项目、老项目、缺文档项目和完整项目"
fi

if has_dir ".github/workflows" && find ".github/workflows" -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null | grep -q .; then
  maturity_award "测试与质量门禁" 6 "存在 CI workflow"
else
  maturity_gap "测试与质量门禁" 6 "缺少 CI workflow，核心检查还不能在提交后自动复现"
fi

if has_any "scripts/check-template-sync.sh" "--strict"; then
  maturity_award "测试与质量门禁" 6 "模板同步检查支持严格模式"
else
  maturity_gap "测试与质量门禁" 6 "check-template-sync.sh 应支持 --strict，作为 CI gate 使用"
fi

if has_file "index.html" && has_any "index.html" "kitAnalyzeBtn" "JSZip"; then
  maturity_award "报告与组件工程" 5 "存在浏览器可直接打开的 standalone 报告页"
else
  maturity_gap "报告与组件工程" 5 "建议提供浏览器可直接打开的 standalone 报告页（index.html）"
fi

if ! has_file "scripts/check-ai-project.sh"; then
  maturity_gap "报告与组件工程" 6 "缺少完整度报告脚本，无法判断报告 UI 是否已拆出"
elif awk '/^  cat .*<<HTML_HEAD/ || /^  cat .*<<HTML_AFTER_INTRO/ || /^  cat .*<<'\''HTML_FOOT'\''/ { found=1 } END { exit found ? 0 : 1 }' scripts/check-ai-project.sh; then
  maturity_gap "报告与组件工程" 6 "报告 UI 仍内联在 shell 脚本里，后续应拆成数据层和模板层"
else
  maturity_award "报告与组件工程" 6 "报告 UI 已从 shell 主逻辑中拆出"
fi

if has_file "docs/design/ai-project-assistant/components.ts" && has_file "docs/design/ai-project-assistant/data.ts"; then
  maturity_award "报告与组件工程" 5 "存在报告页组件契约和 TS 数据源"
else
  maturity_gap "报告与组件工程" 5 "建议补报告页组件契约和数据源"
fi

if has_file "tests/visual-diff.mjs" && has_file "tests/screenshot-regression.sh"; then
  maturity_award "报告与组件工程" 4 "存在报告页截图和视觉 diff 验收"
elif has_file "tests/visual-regression.md" || has_file "tests/screenshot-regression.sh" || has_dir "tests/screenshots"; then
  maturity_award "报告与组件工程" 4 "存在报告页截图或视觉回归验收"
else
  maturity_gap "报告与组件工程" 4 "缺少报告页截图 / 视觉 diff 回归，视觉变化仍主要靠人工看"
fi

if has_file "VERSION"; then
  maturity_award "分发与发布" 4 "存在版本号文件"
else
  maturity_gap "分发与发布" 4 "建议补 VERSION 或等价版本来源"
fi

if has_any "docs/RUNBOOK.md" "发布前检查" "release" "VERSION"; then
  maturity_award "分发与发布" 5 "运行手册包含发布前检查"
else
  maturity_gap "分发与发布" 5 "运行手册应说明发布前检查"
fi

if has_file "tests/run-tests.sh" || has_file "scripts/test-install-profiles.sh"; then
  maturity_award "分发与发布" 6 "安装 profile 有自动化回归入口"
else
  maturity_gap "分发与发布" 6 "core/product/full 安装 profile 仍缺少自动化回归入口"
fi

if has_dir "adapters"; then
  maturity_award "老项目与跨工具" 5 "存在跨工具 adapter"
else
  maturity_gap "老项目与跨工具" 5 "建议补 Claude / Codex / Cursor / Gemini 等 adapter"
fi

if has_file "tests/cross-tool-matrix.md" && ! has_any "tests/cross-tool-matrix.md" "待测" "TODO"; then
  maturity_award "老项目与跨工具" 5 "跨工具验收矩阵已完成"
else
  maturity_gap "老项目与跨工具" 5 "跨工具验收矩阵仍有待测项"
fi

if has_any "HANDOFF.md" "风险" "下一步" "当前状态"; then
  maturity_award "交接治理" 5 "HANDOFF.md 包含当前状态、风险和下一步"
else
  maturity_gap "交接治理" 5 "HANDOFF.md 应包含当前状态、风险和下一步"
fi

if has_any "docs/CHANGELOG.md" "self engineering" "自身工程化" && has_any "docs/DECISIONS.md" "PRODUCT_PLAN" "自身工程化"; then
  maturity_award "交接治理" 5 "自身工程化路线已进入 CHANGELOG 和 DECISIONS"
else
  maturity_gap "交接治理" 5 "结构性工程化路线应进入 CHANGELOG 和 DECISIONS"
fi

{
  printf '# AI 项目工程完整度报告\n\n'
  printf '项目路径：%s\n' "$(pwd)"
  printf '生成时间：%s\n\n' "$generated_at"
  printf '## 分数总览\n\n'
  printf 'AI 工程上下文完整度：%s/%s\n' "$score" "$max_score"
  printf 'AI 工程成熟度：%s/%s\n' "$maturity_score" "$maturity_max_score"
  printf '成熟度状态：%s\n\n' "$(maturity_status_text)"

  current_section=""
  while IFS="$(printf '\t')" read -r section status earned max label; do
    if [ "$section" != "$current_section" ]; then
      [ -n "$current_section" ] && printf '\n'
      printf '## %s (%s)\n' "$section" "$(section_score "$section")"
      current_section="$section"
    fi
    if [ "$status" = "PASS" ]; then
      printf -- '- 通过 (+%s): %s\n' "$earned" "$label"
    else
      printf -- '- 缺口 (+0/%s): %s\n' "$max" "$label"
    fi
  done < "$tmp_items"

  printf '\n## 工程成熟度 v0.2\n'

  current_section=""
  while IFS="$(printf '\t')" read -r section status earned max label; do
    if [ "$section" != "$current_section" ]; then
      [ -n "$current_section" ] && printf '\n'
      printf '### %s (%s)\n' "$section" "$(maturity_section_score "$section")"
      current_section="$section"
    fi
    if [ "$status" = "PASS" ]; then
      printf -- '- 通过 (+%s): %s\n' "$earned" "$label"
    else
      printf -- '- 缺口 (+0/%s): %s\n' "$max" "$label"
    fi
  done < "$tmp_maturity"

  printf '\n## 结果\n\n'
  printf 'AI 工程上下文完整度：%s/%s\n' "$score" "$max_score"
  printf 'AI 工程成熟度：%s/%s\n' "$maturity_score" "$maturity_max_score"
  printf '状态：%s\n' "$(maturity_status_text)"
} | tee "$tmp_report"


write_json_items() {
  source_file="$1"
  wanted_status="$2"
  first=1

  awk -F '\t' -v wanted_status="$wanted_status" '$2 == wanted_status { print $1 "\t" $3 "\t" $4 "\t" $5 }' "$source_file" |
  while IFS="$(printf '\t')" read -r section earned max label; do
    section_json="$(printf '%s' "$section" | json_escape)"
    label_json="$(printf '%s' "$label" | json_escape)"
    if [ "$first" -eq 0 ]; then
      printf ',\n'
    fi
    first=0
    printf '      {"section":"%s","earned":%s,"max":%s,"label":"%s"}' "$section_json" "$earned" "$max" "$label_json"
  done
}

write_json_report() {
  project_path_json="$(pwd | json_escape)"
  generated_at_json="$(printf '%s' "$generated_at" | json_escape)"
  context_status_json="$(status_text | json_escape)"
  maturity_status_json="$(maturity_status_text | json_escape)"
  context_gap_count="$(awk -F '\t' '$2 == "GAP" { count++ } END { printf "%d", count }' "$tmp_items")"
  maturity_gap_count="$(awk -F '\t' '$2 == "GAP" { count++ } END { printf "%d", count }' "$tmp_maturity")"

  {
    printf '{\n'
    printf '  "generatedAt": "%s",\n' "$generated_at_json"
    printf '  "projectPath": "%s",\n' "$project_path_json"
    printf '  "scores": {\n'
    printf '    "context": {"score": %s, "max": %s, "status": "%s", "gapCount": %s},\n' "$score" "$max_score" "$context_status_json" "$context_gap_count"
    printf '    "maturity": {"score": %s, "max": %s, "status": "%s", "gapCount": %s}\n' "$maturity_score" "$maturity_max_score" "$maturity_status_json" "$maturity_gap_count"
    printf '  },\n'
    printf '  "contextGaps": [\n'
    write_json_items "$tmp_items" "GAP"
    printf '\n  ],\n'
    printf '  "maturityGaps": [\n'
    write_json_items "$tmp_maturity" "GAP"
    printf '\n  ],\n'
    printf '  "files": {\n'
    printf '    "markdown": "%s",\n' "$report_file"
    printf '    "json": "%s"\n' "$json_file"
    printf '  }\n'
    printf '}\n'
  } > "$json_file"
}

if [ "$write_report" -eq 1 ]; then
  mkdir -p "$(dirname "$report_file")"
  cp "$tmp_report" "$report_file"
  write_json_report
  echo "报告已写入：$report_file"
  echo "JSON 报告已写入：$json_file"
fi


rm -f "$tmp_report" "$tmp_items" "$tmp_maturity"
