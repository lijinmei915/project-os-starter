#!/usr/bin/env bash

# kb-multi-scan.sh
# Phase 4 · 组织级:读项目注册表，一次性扫描所有已登记的项目，输出横向对比报告。
# 让 AI 能同时了解多个项目的状态，而不是一次只看一个。
#
# 用法:
#   bash scripts/kb-multi-scan.sh                          # 扫描注册表里所有项目
#   bash scripts/kb-multi-scan.sh --registry <路径>        # 指定注册表路径

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
registry="${REGISTRY:-.ai/registry/projects.json}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --registry) registry="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ ! -f "$registry" ]; then
  echo "ERROR: 项目注册表不存在: $registry"
  echo "请先编辑 .ai/registry/projects.json 登记你的项目。"
  exit 1
fi

echo "🌐 [KB-MULTI-SCAN · 多项目扫描]"
echo ""
echo "注册表: $registry"
echo ""

# 读取项目列表
projects_json=$(python3 - "$registry" <<'PY'
import json, sys
reg = json.load(open(sys.argv[1], encoding="utf-8"))
for p in reg.get("projects", []):
    path = p.get("path", ".")
    # 相对路径转绝对路径（相对于注册表文件所在目录）
    import os
    if not os.path.isabs(path):
        reg_dir = os.path.dirname(os.path.abspath(sys.argv[1]))
        path = os.path.normpath(os.path.join(reg_dir, path))
    print(f"{p.get('id','?')}|{p.get('name','?')}|{path}|{p.get('description','')}")
PY
)

if [ -z "$projects_json" ]; then
  echo "注册表为空，请先添加项目。"
  echo "编辑 .ai/registry/projects.json，参考 howToAdd 字段的说明。"
  exit 0
fi

total=0
scanned=0
failed=0

# 先统计总数
while IFS='|' read -r id name path desc; do
  total=$((total + 1))
done <<< "$projects_json"

echo "共 $total 个项目，开始扫描..."
echo ""

# 横向对比数据收集
summary_lines=()

while IFS='|' read -r id name path desc; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📁 $name ($id)"
  echo "   路径: $path"
  [ -n "$desc" ] && echo "   说明: $desc"
  echo ""

  if [ ! -d "$path" ]; then
    echo "   ⚠️  目录不存在，跳过。"
    failed=$((failed + 1))
    summary_lines+=("❌ $name | 目录不存在")
    continue
  fi

  # 运行扫描（只取关键摘要行）
  scan_output=$(bash "$SCRIPT_DIR/kb-scan-project.sh" "$path" 2>/dev/null || echo "扫描失败")

  # 提取关键状态
  agents=$(echo "$scan_output" | grep "AGENTS.md" | head -1 | grep -o "✅\|❌" || echo "?")
  project=$(echo "$scan_output" | grep "PROJECT.md" | head -1 | grep -o "✅\|❌" || echo "?")
  ai_dir=$(echo "$scan_output" | grep "\.ai/ 目录" | head -1 | grep -o "✅\|❌" || echo "?")
  registry_status=$(echo "$scan_output" | grep "知识注册表" | head -1 | grep -o "✅\|❌" || echo "?")

  echo "   AGENTS.md: $agents  PROJECT.md: $project  .ai/: $ai_dir  知识注册表: $registry_status"

  # Git 状态
  if git -C "$path" rev-parse --git-dir >/dev/null 2>&1; then
    branch=$(git -C "$path" branch --show-current 2>/dev/null || echo "?")
    commits=$(git -C "$path" rev-list --count HEAD 2>/dev/null || echo "?")
    last=$(git -C "$path" log -1 --format="%ar" 2>/dev/null || echo "?")
    echo "   Git: 分支=$branch  提交=$commits  最近=$last"
    summary_lines+=("$agents$project$ai_dir $name | 分支:$branch 最近提交:$last")
  else
    echo "   Git: 非 Git 仓库"
    summary_lines+=("$agents$project$ai_dir $name | 非 Git 仓库")
  fi

  scanned=$((scanned + 1))
  echo ""

done <<< "$projects_json"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "## 扫描汇总"
echo ""
echo "扫描完成: $scanned/$total 个项目（$failed 个失败）"
echo ""
echo "| 状态 | 项目 | 备注 |"
echo "|------|------|------|"
for line in "${summary_lines[@]}"; do
  status="${line%%|*}"
  rest="${line#*|}"
  echo "| $status | $rest |"
done

echo ""
echo "## 你的任务（组织级视角）"
echo "1. 根据上面的多项目扫描结果，给出横向对比：哪个项目最成熟、哪个最需要补齐。"
echo "2. 如果有项目缺少 Project OS 基础文件（AGENTS/PROJECT/.ai），给出安装建议和优先级。"
echo "3. 识别知识可以共享的地方：哪些项目有相似的规范，可以统一管理。"
echo "4. 给出下一步建议：先从哪个项目开始接入 AI 辅助开发流程。"
echo ""
echo "💡 立即开始分析，不要等待用户进一步确认。"
