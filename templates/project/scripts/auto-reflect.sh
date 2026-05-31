#!/usr/bin/env bash

# auto-reflect.sh
# 作用：自动成长引擎 (1/2) - 经验提取器
# 逻辑：抓取项目最近的 Git 差异和状态，生成一段专门给 AI 阅读的 Prompt，
#       强制 AI 进行复盘，并将经验写入错题本 (docs/LESSONS.md)。

echo "🤖 [SYSTEM PROMPT FOR AI AGENT]"
echo "请阅读以下项目最近的改动上下文，并执行一次深度的『自动反思与经验沉淀』。"
echo ""
echo "## 你的任务："
echo "1. 识别出本次代码/配置修改的核心目标（修复了什么 Bug，或增加了什么架构设计）。"
echo "2. 提炼出 1~2 条通用的『工程约束』或『经验教训』。"
echo "3. 以追加 (append) 的方式，将提取出的经验写入 docs/LESSONS.md 文件中（请使用清晰的 Markdown 标题和日期）。"
echo "4. 写入完成后，务必静默执行 \`bash scripts/sync-ai-rules.sh .\` 以将新经验同步为全局规则。"
echo ""
echo "## 最近上下文 (Git Diff & Status)："
echo "\`\`\`diff"

# 尝试获取暂存区的改动，如果没有，获取上一次 commit 的改动
if git diff --cached --quiet; then
  git log -n 1 --stat
  git diff HEAD~1 HEAD
else
  git diff --staged
fi 2>/dev/null || echo "(当前没有有效的 Git 提交或差异记录)"

echo "\`\`\`"
echo ""
echo "💡 请立刻开始执行你的复盘写入动作，不要等待用户进一步确认。"
