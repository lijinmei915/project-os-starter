#!/usr/bin/env bash

# kb-git-query.sh
# Phase 3 · 接真实工具:查询任意 Git 仓库的历史、结构和近期改动。
# 让 AI 能"看到"一个真实项目发生了什么，不再只靠文档猜。
#
# 用法:
#   bash scripts/kb-git-query.sh [目录路径] [--depth N]
#   目录路径默认为当前目录，depth 默认为 20（最近 N 条提交）

set -euo pipefail

target="${1:-.}"
depth=20

# 解析参数
while [[ $# -gt 0 ]]; do
  case "$1" in
    --depth) depth="$2"; shift 2 ;;
    -*) shift ;;
    *) target="$1"; shift ;;
  esac
done

if [ ! -d "$target" ]; then
  echo "ERROR: 目录不存在: $target"
  exit 1
fi

cd "$target" || exit 1

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERROR: $target 不是 Git 仓库"
  exit 1
fi

echo "📂 [KB-GIT-QUERY · Git 仓库快照]"
echo ""
echo "仓库路径: $(pwd)"
echo ""

echo "## 基本信息"
echo ""
echo "- 当前分支: $(git branch --show-current 2>/dev/null || echo '未知')"
echo "- 最近 tag: $(git describe --tags --abbrev=0 2>/dev/null || echo '无 tag')"
echo "- 总提交数: $(git rev-list --count HEAD 2>/dev/null || echo '?')"
echo "- 工作区状态: $(git status --short 2>/dev/null | wc -l | tr -d ' ') 个文件有改动"
echo ""

echo "## 近期提交（最近 $depth 条）"
echo ""
git log --oneline -"$depth" --format="- %h %ad %s (%an)" --date=short 2>/dev/null || echo "（无提交记录）"
echo ""

echo "## 文件结构概览（顶层目录）"
echo ""
find . -maxdepth 2 \
  -not -path './.git/*' \
  -not -path './node_modules/*' \
  -not -path './.project-os/*' \
  \( -type d -o \( -type f -name "*.md" \) \) \
  | sed 's|^\./||' | sort | head -40
echo ""

echo "## 近期改动文件（最近 5 次提交）"
echo ""
git diff --name-only HEAD~5 HEAD 2>/dev/null | sort -u || echo "（无法获取）"
echo ""

echo "## 你的任务"
echo "1. 根据以上 Git 快照，理解这个项目的当前状态和近期动向。"
echo "2. 结合文件结构，判断项目属于什么阶段、主要在做什么方向的工作。"
echo "3. 如果用户有具体问题（如：最近改了什么、谁改的、为什么），基于上面信息回答。"
echo ""
echo "💡 立即开始分析，不要等待用户进一步确认。"
