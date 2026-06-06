#!/usr/bin/env bash

# kb-scan-project.sh
# Phase 3 · 接真实工具:把 Project OS 的体检能力用到任意外部项目上。
# 让 AI 能分析"别人的项目"，不只是自身。
#
# 用法:
#   bash scripts/kb-scan-project.sh <目标项目路径>
#   bash scripts/kb-scan-project.sh /path/to/other-project

set -euo pipefail

target="${1:-}"

if [ -z "$target" ]; then
  echo "用法: bash scripts/kb-scan-project.sh <目标项目路径>"
  echo "示例: bash scripts/kb-scan-project.sh ~/my-project"
  exit 1
fi

if [ ! -d "$target" ]; then
  echo "ERROR: 目录不存在: $target"
  exit 1
fi

# 把相对路径转成绝对路径
target="$(cd "$target" && pwd)"

echo "🔭 [KB-SCAN-PROJECT · 外部项目扫描]"
echo ""
echo "扫描目标: $target"
echo ""

# ---- 1. 基础文件结构 ----
echo "## 项目文件结构"
echo ""
find "$target" -maxdepth 2 \
  -not -path "$target/.git/*" \
  -not -path "$target/node_modules/*" \
  \( -type d -o -name "*.md" -o -name "package.json" -o -name "*.sh" \) \
  | sed "s|$target/||" | sort | head -50
echo ""

# ---- 2. Project OS 安装状态 ----
echo "## Project OS 安装状态"
echo ""
has_agents=false; has_project=false; has_handoff=false
[ -f "$target/AGENTS.md" ]  && has_agents=true
[ -f "$target/PROJECT.md" ] && has_project=true
[ -f "$target/HANDOFF.md" ] && has_handoff=true

echo "- AGENTS.md（AI行为规则）: $([ "$has_agents" = true ] && echo '✅ 存在' || echo '❌ 缺失')"
echo "- PROJECT.md（项目状态）:  $([ "$has_project" = true ] && echo '✅ 存在' || echo '❌ 缺失')"
echo "- HANDOFF.md（交接记录）:  $([ "$has_handoff" = true ] && echo '✅ 存在' || echo '❌ 缺失')"

if [ -d "$target/.ai" ]; then
  echo "- .ai/ 目录:              ✅ 存在（已接入 AI 工程支持）"
else
  echo "- .ai/ 目录:              ❌ 缺失（未安装 AI 工程支持）"
fi
echo ""

# ---- 3. 知识层状态 ----
echo "## 知识层状态"
echo ""
if [ -f "$target/.project-os/graph/knowledge-registry.json" ]; then
  entry_count=$(python3 -c "
import json
d=json.load(open('$target/.project-os/graph/knowledge-registry.json'))
print(len(d.get('entries',[])))
" 2>/dev/null || echo "?")
  echo "- 知识注册表: ✅ 存在（$entry_count 条语义索引）"
else
  echo "- 知识注册表: ❌ 缺失（建议运行 bash scripts/build-project-graph.sh）"
fi

if [ -f "$target/.project-os/graph/repo-map.json" ]; then
  file_count=$(python3 -c "
import json
d=json.load(open('$target/.project-os/graph/repo-map.json'))
print(len(d.get('files',[])))
" 2>/dev/null || echo "?")
  echo "- 代码符号地图: ✅ 存在（$file_count 个文件有符号）"
else
  echo "- 代码符号地图: ❌ 缺失（建议运行 bash scripts/build-repo-map.sh）"
fi
echo ""

# ---- 4. Git 概览 ----
if git -C "$target" rev-parse --git-dir >/dev/null 2>&1; then
  echo "## Git 仓库概览"
  echo ""
  echo "- 当前分支: $(git -C "$target" branch --show-current 2>/dev/null || echo '未知')"
  echo "- 总提交数: $(git -C "$target" rev-list --count HEAD 2>/dev/null || echo '?')"
  echo "- 最近改动:"
  git -C "$target" log --oneline -5 --format="  - %h %ad %s" --date=short 2>/dev/null || echo "  （无）"
  echo ""
fi

# ---- 5. 运行体检（如果目标项目有 check-ai-project.sh）----
if [ -f "$target/scripts/check-ai-project.sh" ]; then
  echo "## 快速体检（调用目标项目自带的 check-ai-project.sh）"
  echo ""
  cd "$target" && bash scripts/check-ai-project.sh . 2>/dev/null \
    | grep -E "完整度|成熟度|分|Score|✅|❌|GAP" | head -10 || echo "（体检运行失败）"
  echo ""
elif [ -f "$(dirname "$0")/check-ai-project.sh" ]; then
  echo "## 快速体检（使用 Project OS 自带的 check-ai-project.sh）"
  echo ""
  bash "$(dirname "$0")/check-ai-project.sh" "$target" 2>/dev/null \
    | grep -E "完整度|成熟度|分|Score|✅|❌|GAP" | head -10 || echo "（体检运行失败）"
  echo ""
fi

echo "## 你的任务"
echo "1. 根据上面的扫描结果，判断这个项目的 AI 工程化程度（哪些已具备，哪些缺失）。"
echo "2. 给出优先级建议：如果要让这个项目对 AI 更友好，最先该补什么。"
echo "3. 如果用户想把 Project OS 安装到这个项目，说明大致步骤。"
echo ""
echo "💡 立即开始分析，不要等待用户进一步确认。"
