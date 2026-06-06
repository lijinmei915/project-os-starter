#!/usr/bin/env bash

# kb-tech-review.sh
# Phase 2/3 · 主动专家:站在知识层(架构/规范)+ repo map(符号定义/调用关系)之上做代码评审。
# 逻辑:读 registry 评审知识 + repo-map 符号上下文 → 拿 git diff → 输出给 AI 的评审 prompt。
# 用法: bash scripts/kb-tech-review.sh [file_or_dir]   # 不传则用 git diff HEAD

set -euo pipefail

target="${1:-}"
registry=".project-os/graph/knowledge-registry.json"
repo_map=".project-os/graph/repo-map.json"

if [ ! -f "$registry" ]; then
  echo "ERROR: 知识注册表不存在。请先运行: bash scripts/build-project-graph.sh ."
  exit 1
fi

# 拿代码 diff
if [ -n "$target" ] && [ -e "$target" ]; then
  diff_content="$(git diff HEAD -- "$target" 2>/dev/null || cat "$target")"
  diff_label="文件: $target"
else
  diff_content="$(git diff HEAD 2>/dev/null || echo '')"
  diff_label="git diff HEAD"
  if [ -z "$diff_content" ]; then
    diff_content="$(git diff HEAD~1 HEAD 2>/dev/null || echo '(无可用 diff)')"
    diff_label="git diff HEAD~1 HEAD"
  fi
fi

echo "🔍 [KB-TECH-REVIEW · 技术评审专家]"
echo ""
echo "评审范围: $diff_label"
echo ""

# repo-map：被评审文件的符号上下文（若有）
if [ -f "$repo_map" ] && [ -n "$target" ] && [ -f "$target" ]; then
  echo "## 符号上下文 (repo-map)"
  echo ""
  python3 - "$repo_map" "$target" <<'PY'
import json, sys, os
rm = json.load(open(sys.argv[1], encoding="utf-8"))
target = sys.argv[2].lstrip('./')
for f in rm.get("files", []):
    if f["id"] == target or f["id"].endswith(os.path.basename(target)):
        if f.get("defines"):
            print(f"- **{f['id']}** 定义了: `{'`, `'.join(f['defines'][:15])}`")
        if f.get("calls"):
            print(f"  调用了: `{'`, `'.join(f['calls'][:10])}`")
        break
else:
    # 尝试查找 diff 涉及的文件
    print("(被评审文件未在 repo-map 中，可先运行 bash scripts/build-repo-map.sh 生成)")
PY
  echo ""
fi

# 从 registry 中提取评审相关知识条目
echo "## 评审知识库(相关规范)"
echo ""
python3 - "$registry" <<'PY'
import json, sys
reg = json.load(open(sys.argv[1], encoding="utf-8"))
# 评审相关关键词
keywords = ["规范", "架构", "结构", "命名", "前端", "后端", "设计", "测试", "约束", "边界", "踩坑"]
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
echo "## 待评审代码"
echo ""
echo '```diff'
printf '%s\n' "$diff_content" | head -300
echo '```'
echo ""
echo "## 你的任务(技术评审专家模式)"
echo "1. 对照上面的知识库规范，逐条检查代码是否合规。"
echo "2. 发现问题按严重程度分级：🔴 必须改 / 🟡 建议改 / 🟢 可以更好。"
echo "3. 每条问题给出：问题描述 + 违反了哪条规范(引用知识库条目) + 修复建议。"
echo "4. 如果知识库里没有覆盖某个问题域，说明是基于通用最佳实践判断。"
echo "5. 末尾给出总体评价：可合并 / 建议修改后合并 / 不建议合并。"
echo ""
echo "💡 立即开始评审，不要等待用户进一步确认。"
