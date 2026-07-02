#!/usr/bin/env bash
# 提交后检测改动量，超过阈值时提示 Claude 触发自动反思（写入前需用户确认）
THRESHOLD=50

lines=$(git diff HEAD~1 HEAD --shortstat 2>/dev/null | grep -oE '[0-9]+' | awk '{s+=$1} END {print s+0}')

if [ "${lines:-0}" -gt "$THRESHOLD" ]; then
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"刚才的提交改动约 %s 行，超过反思阈值（%s 行）。请运行 scripts/auto-reflect.sh 生成反思草稿，并询问用户是否要把总结写入 docs/LESSONS.md——必须等用户明确确认后才能写入，不要自动写。"}}' "$lines" "$THRESHOLD"
else
  echo '{}'
fi
