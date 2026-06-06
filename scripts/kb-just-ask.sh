#!/usr/bin/env bash

# kb-just-ask.sh
# Phase 1 · 知识驱动:第一个主动消费知识的 skill。
# 逻辑:输入问题 → 读 knowledge-registry.json → 整理成知识地图 prompt →
#       让 AI 按 use_when 匹配该读哪些文件 → 据此回答并溯源。
# 设计:沿用 auto-reflect.sh 的模式,脚本不自做语义判断,只把结构化知识
#       喂给 AI,由 AI 完成匹配与回答。

set -euo pipefail

question="${*:-}"
registry=".project-os/graph/knowledge-registry.json"

if [ ! -f "$registry" ]; then
  echo "ERROR: 知识注册表不存在。请先运行: bash scripts/build-project-graph.sh ."
  exit 1
fi

if [ -z "$question" ]; then
  echo "用法: bash scripts/kb-just-ask.sh \"你的问题\""
  echo "示例: bash scripts/kb-just-ask.sh \"项目用什么前端框架,怎么启动\""
  exit 2
fi

echo "🧭 [KB-JUST-ASK · 知识驱动问答]"
echo ""
echo "用户问题:"
echo "  $question"
echo ""
echo "## 知识地图(按『何时查』匹配,定位该读哪些文件)"
echo ""

python3 - "$registry" <<'PY'
import json, sys
reg = json.load(open(sys.argv[1], encoding="utf-8"))
entries = reg.get("entries", [])

# 去重:同一 teaches 只保留一条,优先非 .ai/rules 软链接的原文路径
seen = {}
for e in entries:
    key = e.get("teaches", "")
    if not key:
        continue
    cur = seen.get(key)
    if cur is None:
        seen[key] = e
    elif cur["id"].startswith(".ai/") and not e["id"].startswith(".ai/"):
        seen[key] = e

if not seen:
    print("(知识注册表为空:没有任何文件声明 teaches/use_when 语义字段)")
else:
    for e in seen.values():
        stale = " ⚠️已过期" if e.get("stale") else ""
        print(f"- `{e['id']}`{stale}")
        print(f"  - 教会: {e.get('teaches','')}")
        print(f"  - 何时查: {e.get('useWhen','')}")
PY

echo ""
echo "## 你的任务"
echo "1. 从上面的知识地图里,按『何时查』匹配与用户问题最相关的 1~3 个文件。"
echo "2. 读这些文件,据此回答用户问题。"
echo "3. 回答末尾注明引用了哪些文件(知识溯源),让用户可复查。"
echo "4. 如果没有文件匹配,直接说明知识库未覆盖该问题,不要编造。"
echo ""
echo "💡 立即开始匹配并回答,不要等待用户进一步确认。"
