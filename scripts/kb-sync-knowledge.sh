#!/usr/bin/env bash

# kb-sync-knowledge.sh
# Phase 4 · 组织级:知识【提案式】同步。
#
# 设计原则:不擅自往别人项目塞文件。把可复用资产打包到目标项目的隔离区
#          .ai/incoming/sync-<日期>/，附一份 SYNC-MANIFEST.md 说明，
#          由目标项目的 AI 自己判断采纳哪些、拒绝哪些。
#
# 绝不做的事:
#   - 不碰目标项目任何现有文件
#   - 不往正式目录(.ai/rules 等)直接写
#   - 不泄漏来源项目的隐私(如 projects.json 项目注册表)
#   - 不在目标项目生成衍生物(图谱由目标采纳后自己生成)
#
# 用法:
#   bash scripts/kb-sync-knowledge.sh <目标项目路径>
#   bash scripts/kb-sync-knowledge.sh --list   # 列出可提案的资产

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_NAME="$(basename "$SOURCE_ROOT")"

# 可提案的资产白名单（注意：不含 .ai/registry，那是来源项目的隐私）
SYNC_DIRS=(".ai/rules" ".ai/safety")

if [ "${1:-}" = "--list" ]; then
  echo "📋 可提案的知识资产（不含隐私）："
  echo ""
  for d in "${SYNC_DIRS[@]}"; do
    echo "  $d/:"
    ls "$SOURCE_ROOT/$d/" 2>/dev/null | sed 's/^/    /'
    echo ""
  done
  echo "❌ 不会提案：.ai/registry/projects.json（含来源项目所有路径，属隐私）"
  echo "❌ 不会提案：知识图谱（衍生物，由目标项目采纳后自己生成）"
  exit 0
fi

target="${1:-}"
if [ -z "$target" ]; then
  echo "用法: bash scripts/kb-sync-knowledge.sh <目标项目路径>"
  echo "      bash scripts/kb-sync-knowledge.sh --list"
  exit 1
fi

[ -d "$target" ] || { echo "ERROR: 目录不存在: $target"; exit 1; }
target="$(cd "$target" && pwd)"

if [ "$target" = "$SOURCE_ROOT" ]; then
  echo "ERROR: 目标就是来源项目本身，无需同步。"
  exit 1
fi

stamp="$(date +%Y%m%d)"
incoming_rel=".ai/incoming/sync-$stamp"
incoming="$target/$incoming_rel"
manifest="$incoming/SYNC-MANIFEST.md"
now="$(date '+%Y-%m-%d %H:%M')"

echo "📦 [KB-SYNC-KNOWLEDGE · 提案式同步]"
echo ""
echo "来源: $SOURCE_NAME"
echo "目标: $target"
echo "打包到隔离区: $incoming_rel/"
echo ""

mkdir -p "$incoming"

# 复制资产到隔离区（不进正式目录）
file_list=()
for d in "${SYNC_DIRS[@]}"; do
  src="$SOURCE_ROOT/$d"
  [ -d "$src" ] || continue
  dst="$incoming/$(basename "$d")"
  mkdir -p "$dst"
  for f in "$src"/*; do
    [ -f "$f" ] || continue
    fname="$(basename "$f")"
    cp "$f" "$dst/$fname"
    file_list+=("$d/$fname")
    echo "  打包: $d/$fname"
  done
done

echo ""
echo "生成提案说明: $incoming_rel/SYNC-MANIFEST.md"

# 生成 MANIFEST（面向目标项目的 AI）
{
  echo "# 知识同步提案（待你审阅）"
  echo ""
  echo "> ⚠️ 这是一份**提案包**，不是已生效的配置。"
  echo "> 这些文件还**没有**进入你项目的正式目录，需要你判断后手动采纳。"
  echo ""
  echo "## 这是什么"
  echo ""
  echo "来自 \`$SOURCE_NAME\` 项目的一套 AI 工程化资产（AI 行为规则 + 安全契约）。"
  echo "目的是让你这个项目也能被 AI 稳定理解和接手。"
  echo ""
  echo "## 来源信息"
  echo ""
  echo "- 来源项目: \`$SOURCE_NAME\`"
  echo "- 打包时间: $now"
  echo "- 打包方式: 提案式（不碰你的任何现有文件）"
  echo ""
  echo "## 包含的文件（共 ${#file_list[@]} 个）"
  echo ""
  for item in "${file_list[@]}"; do
    echo "- \`$item\`"
  done
  echo ""
  echo "## 为什么给你"
  echo ""
  echo "- \`.ai/rules/\`：通用的 AI 工程规范（代码结构、命名、测试、文档等约定）"
  echo "- \`.ai/safety/\`：AI 文件操作的安全边界契约（可写/只读/禁区）"
  echo ""
  echo "## 怎么采纳（你来决定）"
  echo ""
  echo "1. 逐个看这些文件，判断哪些**符合你项目的实际情况**。"
  echo "2. 把你认可的文件从 \`$incoming_rel/\` 复制到正式位置，例如："
  echo "   \`\`\`bash"
  echo "   cp $incoming_rel/rules/code_structure.md .ai/rules/"
  echo "   \`\`\`"
  echo "3. 采纳后，在你项目的 HANDOFF.md 里记一句：\"采纳了来自 $SOURCE_NAME 的 X 条规则\"。"
  echo ""
  echo "## 怎么拒绝"
  echo ""
  echo "直接删掉整个隔离目录即可，不会影响你项目任何东西："
  echo "\`\`\`bash"
  echo "rm -rf $incoming_rel"
  echo "\`\`\`"
  echo ""
  echo "## ⚠️ 风险提示"
  echo ""
  echo "- 这些是**通用模板**，可能和你项目的实际技术栈/约定不符，请逐个判断，不要无脑全采纳。"
  echo "- 采纳前建议先读你项目自己的 \`PROJECT.md\` / \`HANDOFF.md\`，避免规则冲突。"
  echo "- 不含来源项目的隐私信息（如项目注册表）。"
} > "$manifest"

echo ""
echo "## 提案完成"
echo ""
echo "✅ 已打包 ${#file_list[@]} 个文件到隔离区，未碰目标项目任何现有文件。"
echo "✅ 目标项目的 AI 下次打开会看到提案包，自行决定采纳或拒绝。"
echo ""
echo "💡 提示目标项目的 AI 阅读: $incoming_rel/SYNC-MANIFEST.md"
