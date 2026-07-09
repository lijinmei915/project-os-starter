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

log "frontmatter check"
bash "$root/scripts/check-frontmatter.sh" "$root"

log "file contracts"
bash "$root/scripts/check-file-contracts.sh" "$root"

log "documentation structure"
bash "$root/scripts/check-doc-structure.sh" "$root"

log "check all"
bash "$root/scripts/check-all.sh" "$root"

log "template sync strict"
bash "$root/scripts/check-template-sync.sh" "$root" --strict

log "secret safety check"
PROJECT_OS_ALLOW_EMPTY_PROVIDER_KEYS=1 bash "$root/scripts/check-secrets.sh" "$root"

log "score schema"
assert_file "$root/schemas/ai-project-score.schema.json"
assert_file "$root/schemas/ai-project-score.v0.2.json"
grep -q '"modelId": "ai-project-engineering-score"' "$root/schemas/ai-project-score.v0.2.json"
grep -q '"version": "0.2"' "$root/schemas/ai-project-score.v0.2.json"
assert_file "$root/schemas/ai-project-report.schema.json"
assert_file "$root/schemas/ai-project-report.v0.1.json"
assert_file "$root/schemas/project-run.schema.json"
assert_file "$root/schemas/project-os-config.schema.json"
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

log "project runner"
runner_fixture="$tmp_dir/runner-fixture"
mkdir -p "$runner_fixture"
cat > "$runner_fixture/README.md" <<'EOF'
# Runner Fixture

Small fixture for Project OS runner tests.
EOF
mkdir -p "$runner_fixture/.project-os"
cat > "$runner_fixture/.project-os/state.json" <<'EOF'
{
  "name": "runner-fixture",
  "phase": "init",
  "stage": "Fixture",
  "status": {
    "done": [],
    "doing": [],
    "blocked": [],
    "next": []
  }
}
EOF
if command -v cargo >/dev/null 2>&1; then
  cargo run --quiet --manifest-path "$root/cli/Cargo.toml" -- state sync "$runner_fixture" --set phase=stabilizing --set stage=Synced --output json >/tmp/project-os-state-sync.log
  if command -v node >/dev/null 2>&1; then
    node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(r.schemaVersion!=="project-os.state-sync-result.v0.1" || r.status!=="passed" || !r.bundle) process.exit(1); const s=JSON.parse(fs.readFileSync(process.argv[2],"utf8")); if(s.phase!=="stabilizing" || s.stage!=="Synced") process.exit(1); if(!fs.existsSync(r.bundle)) process.exit(1);' /tmp/project-os-state-sync.log "$runner_fixture/.project-os/state.json"
  fi
  cp "$runner_fixture/.project-os/state.json" "$runner_fixture/.project-os/state.valid.json"
  node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); s.phase="wrong"; fs.writeFileSync(process.argv[1], JSON.stringify(s, null, 2));' "$runner_fixture/.project-os/state.json"
  set +e
  cargo run --quiet --manifest-path "$root/cli/Cargo.toml" -- state sync "$runner_fixture" >/tmp/project-os-state-invalid.log 2>/tmp/project-os-state-invalid.err
  state_invalid_exit=$?
  set -e
  if [ "$state_invalid_exit" -eq 0 ] || ! grep -q "phase must" /tmp/project-os-state-invalid.err; then
    echo "ERROR: invalid state should fail state sync"
    exit 1
  fi
  mv "$runner_fixture/.project-os/state.valid.json" "$runner_fixture/.project-os/state.json"
fi
bash "$root/scripts/ai-project.sh" report "$runner_fixture" >/dev/null
entry_context="$(find "$runner_fixture/.project-os/entry-contexts" -maxdepth 1 -name '*.json' -print -quit)"
assert_file "$entry_context"
if command -v node >/dev/null 2>&1; then
  node -e 'const fs=require("fs"); const c=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(c.schemaVersion!=="project-os.entry-context.v0.1") process.exit(1); if(c.entry!=="cli" || c.intent!=="report" || c.mode!=="readonly") process.exit(1); if(!c.request?.id || !c.project?.path || c.trigger?.source!=="manual-cli") process.exit(1);' "$entry_context"
fi
if command -v cargo >/dev/null 2>&1; then
  cargo run --quiet --manifest-path "$root/cli/Cargo.toml" -- context "$runner_fixture" --runtime-root "$root" --trigger-source desktop --output json >/tmp/project-os-native-context.log
  if command -v node >/dev/null 2>&1; then
    node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(r.schemaVersion!=="project-os.cli-result.v0.1" || r.command!=="context" || r.triggerSource!=="desktop" || !r.entryContext) process.exit(1);' /tmp/project-os-native-context.log
  fi
  native_context="$(python3 - "$runner_fixture/.project-os/entry-contexts" <<'PY'
import json
import pathlib
import sys

context_dir = pathlib.Path(sys.argv[1])
for path in sorted(context_dir.glob("*.json")):
    data = json.loads(path.read_text())
    if data.get("request", {}).get("source") == "project-os" and data.get("trigger", {}).get("source") == "desktop":
        print(path)
        raise SystemExit(0)
raise SystemExit(1)
PY
)"
  assert_file "$native_context"
  if command -v node >/dev/null 2>&1; then
    node -e 'const fs=require("fs"); const c=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(c.schemaVersion!=="project-os.entry-context.v0.1") process.exit(1); if(c.entry!=="cli" || c.intent!=="scan" || c.request?.source!=="project-os" || c.trigger?.source!=="desktop") process.exit(1);' "$native_context"
  fi
else
  echo "[test] cargo not found; skipped native project-os CLI"
fi
bash "$root/scripts/exec/project-os.sh" context "$runner_fixture" --output json --persist none >/tmp/project-os-layered-context.log
if command -v node >/dev/null 2>&1; then
  node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(r.schemaVersion!=="project-os.cli-result.v0.1" || r.persist!=="none" || r.entryContext!==null) process.exit(1);' /tmp/project-os-layered-context.log
fi
mkdir -p "$runner_fixture/.project-os"
global_config_dir="$tmp_dir/global-config"
mkdir -p "$global_config_dir"
cargo run --quiet --manifest-path "$root/cli/Cargo.toml" -- config init --global --path "$global_config_dir/init-config.json" >/tmp/project-os-config-init.log
assert_file "$global_config_dir/init-config.json"
assert_contains "$global_config_dir/init-config.json" '"schemaVersion": "project-os.config.v0.1"'
cat > "$global_config_dir/config.json" <<'EOF'
{
  "schemaVersion": "project-os.config.v0.1",
  "cli": {
    "defaultPersist": "none",
    "defaultOutput": "json",
    "lockWrites": true,
    "staleLockSeconds": 600
  }
}
EOF
PROJECT_OS_GLOBAL_CONFIG="$global_config_dir/config.json" cargo run --quiet --manifest-path "$root/cli/Cargo.toml" -- context "$runner_fixture" --runtime-root "$root" >/tmp/project-os-global-config.log
if command -v node >/dev/null 2>&1; then
  node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(r.schemaVersion!=="project-os.cli-result.v0.1" || r.persist!=="none" || r.outputMode!=="json" || r.entryContext!==null || r.config?.sources?.persist!=="global-config" || r.config?.sources?.outputMode!=="global-config") process.exit(1);' /tmp/project-os-global-config.log
fi
cat > "$global_config_dir/bad-config.json" <<'EOF'
{
  "schemaVersion": "project-os.config.v0.1",
  "cli": {
    "defaultPersist": "sometimes"
  }
}
EOF
set +e
PROJECT_OS_GLOBAL_CONFIG="$global_config_dir/bad-config.json" cargo run --quiet --manifest-path "$root/cli/Cargo.toml" -- context "$runner_fixture" --runtime-root "$root" --output json >/tmp/project-os-bad-global.log 2>/tmp/project-os-bad-global.err
bad_global_exit=$?
set -e
if [ "$bad_global_exit" -eq 0 ] || ! grep -q "cli.defaultPersist" /tmp/project-os-bad-global.err; then
  echo "ERROR: invalid global Project OS config should fail fast"
  exit 1
fi
cat > "$runner_fixture/.project-os/config.json" <<'EOF'
{
  "schemaVersion": "project-os.config.v0.1",
  "cli": {
    "defaultPersist": "full",
    "defaultOutput": "json",
    "lockWrites": true,
    "staleLockSeconds": 1
  }
}
EOF
PROJECT_OS_PERSIST=none PROJECT_OS_OUTPUT=file cargo run --quiet --manifest-path "$root/cli/Cargo.toml" -- context "$runner_fixture" --runtime-root "$root" >/tmp/project-os-config-priority.log
if command -v node >/dev/null 2>&1; then
  node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(r.schemaVersion!=="project-os.cli-result.v0.1" || r.persist!=="full" || r.outputMode!=="json" || !r.entryContext || r.config?.sources?.persist!=="project-config") process.exit(1);' /tmp/project-os-config-priority.log
fi
cargo run --quiet --manifest-path "$root/cli/Cargo.toml" -- context "$runner_fixture" --runtime-root "$root" --output json --persist none >/tmp/project-os-cli-priority.log
if command -v node >/dev/null 2>&1; then
  node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(r.persist!=="none" || r.entryContext!==null || r.config?.sources?.persist!=="command-line" || r.config?.sources?.outputMode!=="command-line") process.exit(1);' /tmp/project-os-cli-priority.log
fi
bash "$root/scripts/project-runner.sh" "$runner_fixture" --source local >/tmp/project-runner-test.log
runner_record="$(find "$runner_fixture/.project-os/runs" -maxdepth 1 -name '*.json' -print -quit)"
assert_file "$runner_record"
assert_file "$runner_fixture/.project-os/reports/ai-project-report.json"
assert_file "$runner_fixture/.project-os/recommendations/recommend-next.json"
if command -v node >/dev/null 2>&1; then
  node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(r.schemaVersion!=="project-os.project-run.v0.1") process.exit(1); if(!Array.isArray(r.commands) || r.commands.length < 3) process.exit(1); if(!r.outputs?.runRecord || !r.next?.requiresHumanConfirmation) process.exit(1);' "$runner_record"
fi
if command -v cargo >/dev/null 2>&1; then
  cargo run --quiet --manifest-path "$root/cli/Cargo.toml" -- report "$runner_fixture" --runtime-root "$root" --output report --persist none >/tmp/project-os-report-output.log
  if command -v node >/dev/null 2>&1; then
    node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(r.schemaVersion!=="project-os.cli-result.v0.1" || r.outputMode!=="report" || r.persist!=="none" || !r.embedded?.reportJson?.scores) process.exit(1);' /tmp/project-os-report-output.log
  fi
  mkdir -p "$runner_fixture/.project-os/locks"
  printf 'pid=test\n' > "$runner_fixture/.project-os/locks/project-os.lock"
  set +e
  cargo run --quiet --manifest-path "$root/cli/Cargo.toml" -- report "$runner_fixture" --runtime-root "$root" --output json --persist none >/tmp/project-os-lock-out.log 2>/tmp/project-os-lock-err.log
  lock_exit=$?
  set -e
  rm -f "$runner_fixture/.project-os/locks/project-os.lock"
  if [ "$lock_exit" -eq 0 ] || ! grep -q "project is locked" /tmp/project-os-lock-err.log; then
    echo "ERROR: project-os lock should reject concurrent writer"
    exit 1
  fi
  printf 'pid=stale\n' > "$runner_fixture/.project-os/locks/project-os.lock"
  touch -t 200001010000 "$runner_fixture/.project-os/locks/project-os.lock"
  cargo run --quiet --manifest-path "$root/cli/Cargo.toml" -- report "$runner_fixture" --runtime-root "$root" --output json --persist none --stale-lock-seconds 1 >/tmp/project-os-stale-lock.log
  if command -v node >/dev/null 2>&1; then
    node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(r.schemaVersion!=="project-os.cli-result.v0.1" || r.status!=="passed") process.exit(1);' /tmp/project-os-stale-lock.log
  fi
fi

log "artifact pruning"
prune_fixture="$tmp_dir/prune-fixture"
mkdir -p "$prune_fixture/.project-os/entry-contexts" "$prune_fixture/.project-os/runs/logs" "$prune_fixture/.project-os/state-bundles"
for index in 01 02 03 04 05; do
  printf '{}\n' > "$prune_fixture/.project-os/entry-contexts/$index.json"
  printf '{}\n' > "$prune_fixture/.project-os/runs/$index.json"
  printf '{}\n' > "$prune_fixture/.project-os/state-bundles/$index.json"
  mkdir -p "$prune_fixture/.project-os/runs/logs/$index"
done
PROJECT_OS_RETENTION_ENTRY_CONTEXTS=2 PROJECT_OS_RETENTION_RUNS=2 bash "$root/scripts/prune-project-os-artifacts.sh" "$prune_fixture" >/dev/null
entry_count="$(find "$prune_fixture/.project-os/entry-contexts" -maxdepth 1 -name '*.json' | wc -l | tr -d ' ')"
run_count="$(find "$prune_fixture/.project-os/runs" -maxdepth 1 -name '*.json' | wc -l | tr -d ' ')"
state_bundle_count="$(find "$prune_fixture/.project-os/state-bundles" -maxdepth 1 -name '*.json' | wc -l | tr -d ' ')"
log_count="$(find "$prune_fixture/.project-os/runs/logs" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
if [ "$entry_count" != "2" ] || [ "$run_count" != "2" ] || [ "$state_bundle_count" != "2" ] || [ "$log_count" != "2" ]; then
  echo "ERROR: artifact pruning failed"
  exit 1
fi

log "recommendation engine"
recommend_fixture="$tmp_dir/recommend-fixture"
mkdir -p "$recommend_fixture/src" "$recommend_fixture/tests"
cat > "$recommend_fixture/package.json" <<'EOF'
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest"
  },
  "dependencies": {}
}
EOF
cat > "$recommend_fixture/src/App.tsx" <<'EOF'
export function App() {
  return null;
}
EOF
recommend_json="$tmp_dir/recommend.json"
bash "$root/scripts/recommend-next.sh" "$recommend_fixture" > "$recommend_json"
assert_contains "$recommend_json" '"schemaVersion":"project-os.recommendation.v0.1"'
assert_contains "$recommend_json" '"file":"docs/ENVIRONMENT.md"'
assert_contains "$recommend_json" '"file":"docs/TESTING.md"'
assert_contains "$recommend_json" '"file":"docs/TECH_STACK.md"'
if command -v node >/dev/null 2>&1; then
  node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(!Array.isArray(data.recommendations) || data.recommendations.length < 3) process.exit(1); for (const rec of data.recommendations) { if (!rec.reason || !Array.isArray(rec.evidence) || !rec.confidence || !rec.evidenceStrength || !rec.gapClarity || !rec.riskIfSkipped || !rec.confidenceReason || !rec.check || !("contract" in rec)) process.exit(1); } const env=data.recommendations.find(r=>r.file==="docs/ENVIRONMENT.md"); const testing=data.recommendations.find(r=>r.file==="docs/TESTING.md"); if(!env?.contract || env.contract.updatePolicy!=="merge" || !Array.isArray(env.contract.requiredSections) || !testing?.contract) process.exit(1);' "$recommend_json"
fi

log "project graph"
bash "$root/scripts/build-project-graph.sh" "$root" >/dev/null
assert_file "$root/.project-os/graph/project-graph.json"
assert_contains "$root/.project-os/graph/project-graph.json" '"schemaVersion": "project-graph.v0.2"'
assert_contains "$root/.project-os/graph/project-graph.json" '"id":"AGENTS.md"'
assert_contains "$root/.project-os/graph/project-graph.json" '"archLayer":"governance"'
assert_contains "$root/.project-os/graph/project-graph.json" '"declares_dependency"'
if command -v node >/dev/null 2>&1; then
  node -e 'const fs=require("fs"); const g=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(!g.nodes || !g.nodes.length || !Array.isArray(g.edges)) process.exit(1); const a=g.nodes.find(n=>n.id==="AGENTS.md"); if(!a || a.archLayer!=="governance" || typeof a.stale!=="boolean") process.exit(1); if(typeof g.summary.staleCount!=="number") process.exit(1)' "$root/.project-os/graph/project-graph.json"
fi

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
assert_file "$tmp_dir/core/scripts/recommend-next.sh"
assert_file "$tmp_dir/core/scripts/add-project-docs.sh"
assert_file "$tmp_dir/core/scripts/build-project-graph.sh"
assert_file "$tmp_dir/core/schemas/ai-project-score.schema.json"
assert_file "$tmp_dir/core/schemas/ai-project-score.v0.2.json"
assert_file "$tmp_dir/core/schemas/ai-project-report.schema.json"
assert_file "$tmp_dir/core/schemas/ai-project-report.v0.1.json"
assert_file "$tmp_dir/core/index.html"
assert_file "$tmp_dir/core/templates/project-docs/docs/ARCHITECTURE.md"
assert_file "$tmp_dir/core/.project-os/reports/ai-project-report.json"
assert_no_file "$tmp_dir/core/docs/ARCHITECTURE.md"
bash "$tmp_dir/core/scripts/build-project-graph.sh" "$tmp_dir/core" >/dev/null
assert_file "$tmp_dir/core/.project-os/graph/project-graph.json"
bash "$tmp_dir/core/scripts/check-secrets.sh" "$tmp_dir/core" >/dev/null
bash "$tmp_dir/core/scripts/recommend-next.sh" "$tmp_dir/core" >/dev/null
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
assert_file "$tmp_dir/full/adapters/HERMES.md"
assert_file "$tmp_dir/full/docs/DESIGN_STANDARDS.md"

log "adapter install"
bash "$tmp_dir/full/scripts/install-adapter.sh" claude "$tmp_dir/full" >/dev/null
bash "$tmp_dir/full/scripts/install-adapter.sh" codex "$tmp_dir/full" >/dev/null
bash "$tmp_dir/full/scripts/install-adapter.sh" cursor "$tmp_dir/full" >/dev/null
bash "$tmp_dir/full/scripts/install-adapter.sh" gemini "$tmp_dir/full" >/dev/null
bash "$tmp_dir/full/scripts/install-adapter.sh" hermes "$tmp_dir/full" >/dev/null
assert_file "$tmp_dir/full/CLAUDE.md"
assert_file "$tmp_dir/full/CODEX.md"
assert_file "$tmp_dir/full/.cursor/rules/project-os.md"
assert_file "$tmp_dir/full/GEMINI.md"
assert_file "$tmp_dir/full/HERMES.md"
assert_contains "$tmp_dir/full/CLAUDE.md" "AGENTS.md"
assert_contains "$tmp_dir/full/CODEX.md" "AGENTS.md"
assert_contains "$tmp_dir/full/.cursor/rules/project-os.md" "AGENTS.md"
assert_contains "$tmp_dir/full/GEMINI.md" "AGENTS.md"
assert_contains "$tmp_dir/full/HERMES.md" "AGENTS.md"

log "all tests passed"
