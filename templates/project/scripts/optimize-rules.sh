#!/usr/bin/env bash

# optimize-rules.sh
# 作用：自动成长引擎 (2/2) - 规则修剪器
# 逻辑：收集当前 .ai/rules/ 下的所有约束，交给 AI 进行“优胜劣汰”分析，防止规则爆炸。

echo "🤖 [SYSTEM PROMPT FOR AI AGENT]"
echo "请扮演高级架构师，对本项目的 AI 规则库进行『修剪与优化』。"
echo ""
echo "## 你的任务："
echo "1. 读取并分析以下列出的 .ai/rules/ 目录下的所有规则文件。"
echo "2. 找出其中是否存在『互相冲突』的规则（例如前端规范说用 px，设计规范说用 rem）。"
echo "3. 找出是否存在『过于啰嗦或已经过时』的规则。"
echo "4. 给出具体的优化建议，并在获得用户确认后，修改对应的 docs/*.md 原文件。"
echo "5. 修改完成后，执行 \`bash scripts/sync-ai-rules.sh .\`。"
echo ""
echo "## 当前激活的规则索引："
ls -lh .ai/rules/ | awk '{print $9, $10, $11}'
echo ""
echo "💡 请挑选 2-3 个核心规则文件读取内容，并输出你的审查结论。"
