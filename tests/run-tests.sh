#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

log() {
  printf '[test] %s\n' "$*"
}

assert_file() {
  file="$1"
  if [ ! -f "$file" ]; then
    echo "ERROR: expected file not found: $file"
    exit 1
  fi
}

assert_no_file() {
  file="$1"
  if [ -e "$file" ]; then
    echo "ERROR: unexpected file exists: $file"
    exit 1
  fi
}

assert_contains() {
  file="$1"
  pattern="$2"
  if ! grep -q "$pattern" "$file"; then
    echo "ERROR: expected pattern not found in $file: $pattern"
    exit 1
  fi
}

log "runtime check"
bash "$root/scripts/check-runtime.sh" "$root"

log "template sync strict"
bash "$root/scripts/check-template-sync.sh" "$root" --strict

log "secret safety check"
bash "$root/scripts/check-secrets.sh" "$root"

log "score schema"
assert_file "$root/schemas/ai-project-score.schema.json"
assert_file "$root/schemas/ai-project-score.v0.2.json"
grep -q '"modelId": "ai-project-engineering-score"' "$root/schemas/ai-project-score.v0.2.json"
grep -q '"version": "0.2"' "$root/schemas/ai-project-score.v0.2.json"
assert_file "$root/schemas/ai-project-report.schema.json"
assert_file "$root/schemas/ai-project-report.v0.1.json"
grep -q '"modelId": "ai-project-engineering-report"' "$root/schemas/ai-project-report.v0.1.json"
grep -q '"version": "0.1"' "$root/schemas/ai-project-report.v0.1.json"

log "report model consistency"
if command -v node >/dev/null 2>&1; then
  node "$root/tests/check-report-model.mjs" "$root"
else
  echo "[test] node not found; skipped report model consistency"
fi

log "AI project report"
bash "$root/scripts/check-ai-project.sh" "$root" --write-report >/dev/null
grep -q "AI 工程成熟度" "$root/.project-os/reports/ai-project-report.md"
assert_file "$root/.project-os/reports/ai-project-report.json"
assert_contains "$root/.project-os/reports/ai-project-report.json" '"scores"'
assert_file "$root/index.html"

log "old project document quality"
poor_docs="$tmp_dir/poor-docs"
mkdir -p "$poor_docs/docs"
cat > "$poor_docs/AGENTS.md" <<'EOF'
# AGENTS

TODO
EOF
cat > "$poor_docs/PROJECT.md" <<'EOF'
# 项目状态

未记录
EOF
cat > "$poor_docs/HANDOFF.md" <<'EOF'
# 当前交接

暂无记录
EOF
cat > "$poor_docs/docs/ENVIRONMENT.md" <<'EOF'
# 环境说明

| 变量 | 用途 |
|------|------|
| 未记录 | 未记录 |
EOF
cat > "$poor_docs/docs/ARCHITECTURE.md" <<'EOF'
# 架构说明

TODO: 待补
EOF
cat > "$poor_docs/docs/TESTING.md" <<'EOF'
# 测试说明

未记录
EOF
cat > "$poor_docs/docs/DECISIONS.md" <<'EOF'
# 决策记录

暂无记录
EOF
cat > "$poor_docs/docs/RUNBOOK.md" <<'EOF'
# 运行手册

TODO
EOF
cat > "$poor_docs/docs/NAMING.md" <<'EOF'
# 命名规范

未记录
EOF
cat > "$poor_docs/docs/DOCUMENTATION.md" <<'EOF'
# 文档规范

未记录
EOF
bash "$root/scripts/check-ai-project.sh" "$poor_docs" --write-report >/dev/null
poor_report="$poor_docs/.project-os/reports/ai-project-report.md"
assert_file "$poor_report"
assert_contains "$poor_report" "AGENTS.md 缺失或仍像空模板"
assert_contains "$poor_report" "PROJECT.md 缺失或仍像空模板"
assert_contains "$poor_report" "HANDOFF.md 缺失或仍像空模板"
if grep -q "AI 工程上下文完整度：100/100" "$poor_report"; then
  echo "ERROR: placeholder docs should not score 100/100"
  exit 1
fi

log "screenshot regression"
bash "$root/tests/screenshot-regression.sh"

log "visual diff self-test"
if command -v node >/dev/null 2>&1; then
  node "$root/tests/visual-diff.mjs" --self-test
else
  echo "[test] node not found; skipped visual diff self-test"
fi

log "cross-tool matrix"
assert_file "$root/tests/cross-tool-matrix.md"
if grep -q "待测\\|TODO" "$root/tests/cross-tool-matrix.md"; then
  echo "ERROR: cross-tool matrix still contains pending markers"
  exit 1
fi

log "install profiles"
mkdir -p "$tmp_dir/core" "$tmp_dir/product" "$tmp_dir/full"

bash "$root/scripts/install-project-os.sh" "$tmp_dir/core" --profile core >/dev/null
bash "$tmp_dir/core/scripts/check-runtime.sh" "$tmp_dir/core" >/dev/null
bash "$tmp_dir/core/scripts/check-ai-project.sh" "$tmp_dir/core" --write-report >/dev/null
assert_file "$tmp_dir/core/AGENTS.md"
assert_file "$tmp_dir/core/.env.example"
assert_file "$tmp_dir/core/PROJECT.md"
assert_file "$tmp_dir/core/HANDOFF.md"
assert_file "$tmp_dir/core/scripts/check-runtime.sh"
assert_file "$tmp_dir/core/scripts/check-secrets.sh"
assert_file "$tmp_dir/core/scripts/check-ai-project.sh"
assert_file "$tmp_dir/core/scripts/ai-project.sh"
assert_file "$tmp_dir/core/scripts/add-project-docs.sh"
assert_file "$tmp_dir/core/schemas/ai-project-score.schema.json"
assert_file "$tmp_dir/core/schemas/ai-project-score.v0.2.json"
assert_file "$tmp_dir/core/schemas/ai-project-report.schema.json"
assert_file "$tmp_dir/core/schemas/ai-project-report.v0.1.json"
assert_file "$tmp_dir/core/index.html"
assert_file "$tmp_dir/core/templates/project-docs/docs/ARCHITECTURE.md"
assert_file "$tmp_dir/core/.project-os/reports/ai-project-report.json"
assert_no_file "$tmp_dir/core/docs/ARCHITECTURE.md"
bash "$tmp_dir/core/scripts/check-secrets.sh" "$tmp_dir/core" >/dev/null
bash "$tmp_dir/core/scripts/add-project-docs.sh" "$tmp_dir/core" --profile product >/dev/null
assert_file "$tmp_dir/core/docs/ARCHITECTURE.md"
assert_file "$tmp_dir/core/docs/ENVIRONMENT.md"
bash "$tmp_dir/core/scripts/check-runtime.sh" "$tmp_dir/core" >/dev/null

bash "$root/scripts/install-project-os.sh" "$tmp_dir/product" --profile product >/dev/null
bash "$tmp_dir/product/scripts/check-runtime.sh" "$tmp_dir/product" >/dev/null
assert_file "$tmp_dir/product/docs/ARCHITECTURE.md"
assert_file "$tmp_dir/product/docs/ENVIRONMENT.md"
assert_file "$tmp_dir/product/docs/NAMING.md"
assert_file "$tmp_dir/product/docs/RUNBOOK.md"
assert_no_file "$tmp_dir/product/.claude/skills/project-setup/SKILL.md"

bash "$root/scripts/install-project-os.sh" "$tmp_dir/full" --profile full >/dev/null
bash "$tmp_dir/full/scripts/check-runtime.sh" "$tmp_dir/full" >/dev/null
assert_file "$tmp_dir/full/.claude/skills/project-setup/SKILL.md"
assert_file "$tmp_dir/full/adapters/CODEX.md"
assert_file "$tmp_dir/full/docs/DESIGN_STANDARDS.md"

log "adapter install"
bash "$tmp_dir/full/scripts/install-adapter.sh" claude "$tmp_dir/full" >/dev/null
bash "$tmp_dir/full/scripts/install-adapter.sh" codex "$tmp_dir/full" >/dev/null
bash "$tmp_dir/full/scripts/install-adapter.sh" cursor "$tmp_dir/full" >/dev/null
bash "$tmp_dir/full/scripts/install-adapter.sh" gemini "$tmp_dir/full" >/dev/null
assert_file "$tmp_dir/full/CLAUDE.md"
assert_file "$tmp_dir/full/CODEX.md"
assert_file "$tmp_dir/full/.cursor/rules/project-os.md"
assert_file "$tmp_dir/full/GEMINI.md"
assert_contains "$tmp_dir/full/CLAUDE.md" "AGENTS.md"
assert_contains "$tmp_dir/full/CODEX.md" "AGENTS.md"
assert_contains "$tmp_dir/full/.cursor/rules/project-os.md" "AGENTS.md"
assert_contains "$tmp_dir/full/GEMINI.md" "AGENTS.md"

log "all tests passed"
