#!/usr/bin/env bash

# kb-workflow.sh
# Phase 4 · 流程编排:把多个专家技能串成完整研发工作流。
# AI 不再只能做单个动作，而是能按任务类型自动走完整个流程链。
#
# 用法:
#   bash scripts/kb-workflow.sh ask    "我想知道..."         # 问答
#   bash scripts/kb-workflow.sh debug  "遇到了这个问题..."    # 排障
#   bash scripts/kb-workflow.sh review "scripts/xxx.sh"      # 代码评审
#   bash scripts/kb-workflow.sh full   "任务描述"             # 完整流程
#   bash scripts/kb-workflow.sh --help                        # 帮助

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mode="${1:-}"
input="${2:-}"

usage() {
cat <<'USAGE'
kb-workflow — 研发流程编排器

用法:
  bash scripts/kb-workflow.sh <模式> "<输入>"

模式:
  ask    "问题"      → 知识问答（先查知识库再回答）
  debug  "问题描述"  → 排障流程（Git快照 → 排障分析）
  review "文件路径"  → 代码评审（符号分析 → 规范评审 → 测试检查）
  full   "任务描述"  → 完整流程（Git快照 → 排障 → 评审 → 测试）

示例:
  bash scripts/kb-workflow.sh ask    "这个项目怎么部署"
  bash scripts/kb-workflow.sh debug  "启动时报 API_KEY 缺失"
  bash scripts/kb-workflow.sh review "scripts/check-ai-project.sh"
  bash scripts/kb-workflow.sh full   "修复体检报告的评分缺口"
USAGE
}

if [ "$mode" = "--help" ] || [ "$mode" = "-h" ] || [ -z "$mode" ]; then
  usage; exit 0
fi

if [ -z "$input" ]; then
  echo "ERROR: 请提供输入内容"
  usage; exit 1
fi

# 分隔线
sep() { printf '\n%s\n\n' "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

echo "🔄 [KB-WORKFLOW · 研发流程编排]"
echo ""
echo "模式: $mode"
echo "任务: $input"
sep

case "$mode" in

  # ── ask：知识问答 ──────────────────────────────
  ask)
    echo "## 步骤 1/1 · 知识问答"
    echo ""
    bash "$SCRIPT_DIR/kb-just-ask.sh" "$input"
    ;;

  # ── debug：排障流程 ────────────────────────────
  debug)
    echo "## 步骤 1/2 · Git 仓库快照（了解项目近况）"
    echo ""
    bash "$SCRIPT_DIR/kb-git-query.sh" . --depth 10
    sep

    echo "## 步骤 2/2 · 排障分析"
    echo ""
    bash "$SCRIPT_DIR/kb-problem-solve.sh" "$input"
    ;;

  # ── review：代码评审流程 ───────────────────────
  review)
    echo "## 步骤 1/3 · 代码符号分析（了解文件结构）"
    echo ""
    if [ -f "$input" ]; then
      python3 "$SCRIPT_DIR/extract-symbols.py" "$input" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(f'文件: $input')
print(f'语言: {d[\"lang\"]}')
if d['defines']: print(f'定义了 {len(d[\"defines\"])} 个函数/类: ' + ', '.join(d['defines'][:10]))
if d['calls']:   print(f'调用了: ' + ', '.join(d['calls'][:8]))
if d['imports']: print(f'导入了: ' + ', '.join(d['imports'][:5]))
" 2>/dev/null || echo "（符号提取失败，继续评审）"
    else
      echo "（路径不是单文件，跳过符号分析）"
    fi
    sep

    echo "## 步骤 2/3 · 技术评审"
    echo ""
    bash "$SCRIPT_DIR/kb-tech-review.sh" "$input"
    sep

    echo "## 步骤 3/3 · 测试检查"
    echo ""
    bash "$SCRIPT_DIR/kb-test-fix.sh"
    ;;

  # ── full：完整研发流程 ─────────────────────────
  full)
    echo "## 步骤 1/5 · Git 仓库快照（了解项目近况）"
    echo ""
    bash "$SCRIPT_DIR/kb-git-query.sh" . --depth 10
    sep

    echo "## 步骤 2/5 · 知识检索（找到相关规范）"
    echo ""
    bash "$SCRIPT_DIR/kb-just-ask.sh" "$input"
    sep

    echo "## 步骤 3/5 · 排障 / 方案分析"
    echo ""
    bash "$SCRIPT_DIR/kb-problem-solve.sh" "$input"
    sep

    echo "## 步骤 4/5 · 写代码（带项目上下文）"
    echo ""
    bash "$SCRIPT_DIR/kb-just-coding.sh" "$input"
    sep

    echo "## 步骤 5/5 · 评审与测试检查"
    echo ""
    bash "$SCRIPT_DIR/kb-tech-review.sh"
    ;;

  *)
    echo "ERROR: 未知模式 '$mode'，支持: ask / debug / review / full"
    usage; exit 1
    ;;
esac

sep
echo "## 综合指令（给 AI）"
echo ""
echo "你已收到以上 $mode 模式的完整上下文。现在请："
case "$mode" in
  ask)
    echo "1. 从知识地图中匹配 1~3 个相关文件，读取后回答用户问题。"
    echo "2. 回答末尾注明引用来源。"
    ;;
  debug)
    echo "1. 结合 Git 快照和排障知识，定位问题根因。"
    echo "2. 给出修复步骤（先验证什么 → 再改什么 → 怎么确认修好了）。"
    echo "3. 如果是已知坑，说明来自哪条 LESSONS 记录。"
    ;;
  review)
    echo "1. 结合符号分析和评审知识，给出分级问题清单（🔴必须改/🟡建议/🟢优化）。"
    echo "2. 分析测试状态，说明是否需要补测试。"
    echo "3. 给出总体结论：可合并 / 修改后合并 / 不建议合并。"
    ;;
  full)
    echo "1. 基于 Git 快照理解项目近况。"
    echo "2. 用知识库规范作为判断标准。"
    echo "3. 分析问题根因，给出方案。"
    echo "4. 按项目规范写出代码（目录/命名/约定全部符合知识库）。"
    echo "5. 列出改动文件和内容，等用户确认再写入。"
    echo "6. 改完后说明怎么验证（测试命令/验收方式）。"
    ;;
esac
echo ""
echo "💡 立即开始，不要等待用户进一步确认。"
