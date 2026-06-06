#!/usr/bin/env bash

# kb-problem-solve.sh
# Phase 2 · 主动专家:站在知识层(踩坑记录/架构/环境)之上排查和解决工程问题。
# 逻辑:读 registry 排障相关知识 + 读 LESSONS.md 历史坑 → 输出给 AI 的排障 prompt。
# 用法: bash scripts/kb-problem-solve.sh "问题描述"

set -euo pipefail

problem="${*:-}"
registry=".project-os/graph/knowledge-registry.json"

if [ ! -f "$registry" ]; then
  echo "ERROR: 知识注册表不存在。请先运行: bash scripts/build-project-graph.sh ."
  exit 1
fi

if [ -z "$problem" ]; then
  echo "用法: bash scripts/kb-problem-solve.sh \"问题描述\""
  echo "示例: bash scripts/kb-problem-solve.sh \"启动时报 DEEPSEEK_API_KEY 缺失\""
  exit 2
fi

echo "🛠️ [KB-PROBLEM-SOLVE · 排障专家]"
echo ""
echo "待解决问题:"
echo "  $problem"
echo ""

# 相关知识条目
echo "## 排障知识库"
echo ""
python3 - "$registry" <<'PY'
import json, sys
reg = json.load(open(sys.argv[1], encoding="utf-8"))
keywords = ["踩坑", "错误", "环境", "排查", "故障", "运行", "依赖", "启动", "约束", "避免", "修复"]
seen = {}
for e in reg.get("entries", []):
    teaches = e.get("teaches", "")
    use_when = e.get("useWhen", "")
    key = teaches
    if not key or key in seen:
        continue
    if any(kw in teaches or kw in use_when for kw in keywords):
        seen[key] = e
        stale = " ⚠️已过期" if e.get("stale") else ""
        print(f"- `{e['id']}`{stale}: {teaches}")
PY

echo ""

# 历史错误模式摘要
if [ -f "docs/LESSONS.md" ]; then
  echo "## 历史错误模式(LESSONS.md 摘要)"
  echo ""
  grep -E "^#{1,3} |^- \*\*|^> " docs/LESSONS.md 2>/dev/null | head -30 || true
  echo ""
fi

echo "## 你的任务(排障专家模式)"
echo "1. 先读排障知识库里相关文件，理解项目的环境约定和已知约束。"
echo "2. 对照历史错误模式，判断当前问题是否是已知坑的重现。"
echo "3. 给出排查步骤：先验证什么 → 再看什么 → 最后怎么修。"
echo "4. 给出修复方案，并说明如果不是已知问题、是否需要沉淀到 LESSONS.md。"
echo "5. 如果信息不足无法定位，列出还需要用户提供什么信息。"
echo ""
echo "💡 立即开始排障分析，不要等待用户进一步确认。"
