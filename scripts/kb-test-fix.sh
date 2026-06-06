#!/usr/bin/env bash

# kb-test-fix.sh
# Phase 2 · 主动专家:站在知识层(测试规范/架构)之上，帮助修复失败的测试或补写缺失的测试。
# 逻辑:读 registry 测试相关知识 → 读测试失败信息(参数或 stdin) → 输出给 AI 的修复 prompt。
# 用法: bash scripts/kb-test-fix.sh [test_output_file]
#   不传文件则尝试读 .project-os/reports/ 下最近的测试输出，或从 stdin 读。

set -euo pipefail

test_input="${1:-}"
registry=".project-os/graph/knowledge-registry.json"

if [ ! -f "$registry" ]; then
  echo "ERROR: 知识注册表不存在。请先运行: bash scripts/build-project-graph.sh ."
  exit 1
fi

# 拿测试失败信息
test_content=""
test_label=""
if [ -n "$test_input" ] && [ -f "$test_input" ]; then
  test_content="$(cat "$test_input")"
  test_label="文件: $test_input"
elif [ -f ".project-os/reports/test-output.txt" ]; then
  test_content="$(cat .project-os/reports/test-output.txt)"
  test_label=".project-os/reports/test-output.txt"
elif ! [ -t 0 ]; then
  test_content="$(cat)"
  test_label="stdin"
else
  # 尝试直接运行测试拿输出
  test_content="$(bash scripts/check-testing.sh . 2>&1 || true)"
  test_label="check-testing.sh 实时输出"
fi

echo "🧪 [KB-TEST-FIX · 测试修复专家]"
echo ""
echo "测试信息来源: $test_label"
echo ""

# 测试相关知识条目
echo "## 测试知识库(相关规范)"
echo ""
python3 - "$registry" <<'PY'
import json, sys
reg = json.load(open(sys.argv[1], encoding="utf-8"))
keywords = ["测试", "验收", "质量", "检查", "AI 生成代码", "偏离"]
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
echo "## 测试输出 / 失败信息"
echo ""
echo '```'
printf '%s\n' "$test_content" | head -200
echo '```'
echo ""
echo "## 你的任务(测试修复专家模式)"
echo "1. 读测试知识库，理解本项目的测试方法和验收标准。"
echo "2. 分析测试失败信息：是代码问题 / 测试写错了 / 环境问题 / 评分模型误报？"
echo "3. 给出修复方案：改哪个文件、改什么，或者为什么标注为不适用(如 Shell 项目无 npm)。"
echo "4. 如果需要补写新测试，给出测试代码草稿，并说明放在哪个文件。"
echo "5. 修复后建议用什么命令验收。"
echo ""
echo "💡 立即开始分析并给出修复方案，不要等待用户进一步确认。"
