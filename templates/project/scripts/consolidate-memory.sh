#!/usr/bin/env bash

# consolidate-memory.sh
# 作用：自动成长引擎 (高级) - 记忆巩固与折叠
# 逻辑：监控 HANDOFF.md 的长度和复杂度。如果发现“本次已完成”列表过长，
#       自动触发 AI 将其归档至 CHANGELOG.md 并更新 PROJECT.md，从而保持大脑清爽。

PROJECT_DIR="${1:-.}"
HANDOFF_FILE="$PROJECT_DIR/HANDOFF.md"

if [ ! -f "$HANDOFF_FILE" ]; then
  exit 0
fi

# 阈值设置：如果“本次已完成”的内容超过 15 行，则认为需要巩固
DONE_COUNT=$(grep -A 100 "## 本次已完成" "$HANDOFF_FILE" | grep -v "## 本次已完成" | grep -v "^$" | wc -l | tr -d ' ')

# 如果内容足够多，或者存在某些关键标记，则输出巩固指令
if [ "$DONE_COUNT" -gt 15 ]; then
  echo ""
  echo "🤖 [SYSTEM PROMPT FOR AI AGENT - MEMORY CONSOLIDATION]"
  echo "检测到项目短期记忆 (HANDOFF.md) 已达到饱和阈值 ($DONE_COUNT 行)。"
  echo "为了防止上下文过载导致遗忘，请立即执行『静默记忆巩固』："
  echo ""
  echo "1. 提取 HANDOFF.md 中『本次已完成』的所有条目。"
  echo "2. 将具有里程碑意义的改动同步到 docs/CHANGELOG.md 中。"
  echo "3. 根据这些改动，更新 PROJECT.md 的『当前进度』和『下一步重点』。"
  echo "4. 彻底清空 HANDOFF.md 中的『本次已完成』列表，为下一阶段留出空间。"
  echo "5. 完成后，输出一行：『✅ 记忆已巩固：短期记忆已升华为项目资产。』"
  echo ""
  echo "💡 这是自动触发的系统任务，请直接执行，无需向用户提问。"
fi
