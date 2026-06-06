#!/usr/bin/env bash

# kb-just-coding.sh
# Phase 4 · 补全写代码缺环：带项目上下文写代码。
# 逻辑：读知识库(代码规范/目录结构/命名/踩坑) + repo-map(现有符号) → 给 AI 一份带项目背景的写码 prompt。
# 和静态 prompt 模板的区别：动态带入「这个项目」的规矩，不是通用模板。
#
# 用法:
#   bash scripts/kb-just-coding.sh "要写什么"
#   bash scripts/kb-just-coding.sh "写一个解析 frontmatter 的 Python 函数" --file scripts/new.py
#   bash scripts/kb-just-coding.sh "给 check-ai-project 加一个新的评分维度" --context scripts/check-ai-project.sh

set -euo pipefail

task="${1:-}"
context_file=""
output_file=""

# 解析参数
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)    output_file="$2";  shift 2 ;;
    --context) context_file="$2"; shift 2 ;;
    *) shift ;;
  esac
done

registry=".project-os/graph/knowledge-registry.json"
repo_map=".project-os/graph/repo-map.json"

if [ -z "$task" ]; then
  echo "用法: bash scripts/kb-just-coding.sh \"要写什么\" [--file 目标文件] [--context 参考文件]"
  echo "示例: bash scripts/kb-just-coding.sh \"写一个解析 yaml frontmatter 的函数\""
  exit 1
fi

if [ ! -f "$registry" ]; then
  echo "ERROR: 知识注册表不存在。请先运行: bash scripts/build-project-graph.sh ."
  exit 1
fi

echo "💻 [KB-JUST-CODING · 带上下文写代码]"
echo ""
echo "任务: $task"
[ -n "$output_file"  ] && echo "目标文件: $output_file"
[ -n "$context_file" ] && echo "参考文件: $context_file"
echo ""

# ── 1. 写码相关知识 ──────────────────────────────
echo "## 项目写码规范（知识库）"
echo ""
python3 - "$registry" <<'PY'
import json, sys
reg = json.load(open(sys.argv[1], encoding="utf-8"))
keywords = ["目录", "结构", "命名", "规范", "约定", "层", "架构", "代码", "测试", "踩坑", "错误", "避免"]
seen = {}
for e in reg.get("entries", []):
    teaches  = e.get("teaches",  "")
    use_when = e.get("useWhen",  "")
    key = teaches
    if not key or key in seen:
        continue
    if any(kw in teaches or kw in use_when for kw in keywords):
        seen[key] = e
        stale = " ⚠️已过期" if e.get("stale") else ""
        print(f"- `{e['id']}`{stale}: {teaches}")
PY

echo ""

# ── 2. 参考文件的符号上下文（若有）─────────────────
if [ -n "$context_file" ] && [ -f "$context_file" ] && [ -f "$repo_map" ]; then
  echo "## 参考文件符号（repo-map）"
  echo ""
  python3 - "$repo_map" "$context_file" <<'PY'
import json, sys, os
rm     = json.load(open(sys.argv[1], encoding="utf-8"))
target = sys.argv[2].lstrip('./')
for f in rm.get("files", []):
    if f["id"] == target or f["id"].endswith(os.path.basename(target)):
        if f.get("defines"):
            print(f"- `{f['id']}` 已定义: `{'`, `'.join(f['defines'][:15])}`")
        if f.get("calls"):
            print(f"  调用了: `{'`, `'.join(f['calls'][:10])}`")
        break
PY
  echo ""
fi

# ── 3. 目标文件已有内容（若有）──────────────────────
if [ -n "$output_file" ] && [ -f "$output_file" ]; then
  echo "## 目标文件现有内容"
  echo ""
  echo '```'
  head -60 "$output_file"
  echo '```'
  echo ""
fi

# ── 4. 目录结构速览（帮 AI 判断放哪）───────────────
echo "## 项目目录结构（顶层）"
echo ""
find . -maxdepth 2 \
  -not -path './.git/*' \
  -not -path './node_modules/*' \
  -not -path './.project-os/*' \
  -type d | sed 's|^\./||' | sort | head -20
echo ""

# ── 5. 写码指令 ──────────────────────────────────
echo "## 你的任务（写代码专家模式）"
echo ""
echo "需要写的内容: **$task**"
echo ""
echo "1. 先读上面的写码规范，确认："
echo "   - 这段代码该放在哪个目录/文件（参考目录结构和 CODE_STRUCTURE 规范）"
echo "   - 命名要符合项目约定（参考 NAMING 规范）"
echo "   - 有没有已知的相关踩坑要避开（参考 LESSONS）"
echo "2. 写出代码，附上："
echo "   - 放在哪个文件（路径）"
echo "   - 简短说明：做了什么、为什么这么写"
echo "3. 如果涉及修改现有文件，列出改动范围，等用户确认再动手。"
echo "4. 如果任务超出知识库覆盖范围（比如需要引入新依赖），先说明再动手。"
if [ -n "$output_file" ]; then
  echo "5. 目标输出文件：\`$output_file\`，写完后告知用户确认再写入。"
fi
echo ""
echo "💡 立即开始，不要等待用户进一步确认。"
