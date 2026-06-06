#!/usr/bin/env bash

# kb-generate-docs.sh
# Phase 4 · 文档生成：带项目上下文生成标准工程文档（AGENTS/README/HANDOFF/PROJECT 等）。
# 和 kb-just-coding 一个套路：先读知识库，再生成符合本项目规范的文档，不是通用模板。
#
# 用法:
#   bash scripts/kb-generate-docs.sh <文档类型> [目标项目路径]
#   bash scripts/kb-generate-docs.sh agents    /path/to/project   # 生成 AGENTS.md
#   bash scripts/kb-generate-docs.sh readme    /path/to/project   # 生成 README.md
#   bash scripts/kb-generate-docs.sh handoff                      # 生成当前项目的 HANDOFF.md 草稿
#   bash scripts/kb-generate-docs.sh project                      # 生成当前项目的 PROJECT.md 草稿
#   bash scripts/kb-generate-docs.sh --list                       # 列出支持的文档类型

set -euo pipefail

doc_type="${1:-}"
target="${2:-.}"

if [ "$doc_type" = "--list" ] || [ -z "$doc_type" ]; then
  echo "支持的文档类型:"
  echo "  agents   → AGENTS.md（AI 行为规则）"
  echo "  claude   → CLAUDE.md（Claude Code 适配，控制 skill 路由）★ 赋能新项目必须同时生成"
  echo "  readme   → README.md（项目介绍 + 快速开始）"
  echo "  handoff  → HANDOFF.md（当前任务交接记录）"
  echo "  project  → PROJECT.md（项目状态快照）"
  echo "  lessons  → docs/LESSONS.md（错误复盘文件）"
  echo "  changelog→ docs/CHANGELOG.md（变更日志）"
  echo ""
  echo "用法: bash scripts/kb-generate-docs.sh <类型> [目标项目路径]"
  exit 0
fi

[ -d "$target" ] || { echo "ERROR: 目录不存在: $target"; exit 1; }
target="$(cd "$target" && pwd)"

registry=".project-os/graph/knowledge-registry.json"
[ -f "$registry" ] || { echo "ERROR: 知识注册表不存在，请先运行 build-project-graph.sh"; exit 1; }

echo "📝 [KB-GENERATE-DOCS · 文档生成]"
echo ""
echo "文档类型: $doc_type"
echo "目标目录: $target"
echo ""

# ── 文档规范知识 ─────────────────────────────────
echo "## 文档规范（知识库）"
echo ""
python3 - "$registry" <<'PY'
import json, sys
reg = json.load(open(sys.argv[1], encoding="utf-8"))
keywords = ["文档", "规范", "格式", "更新", "边界", "编写", "命名", "frontmatter", "治理", "交接"]
seen = {}
for e in reg.get("entries", []):
    teaches  = e.get("teaches",  "")
    use_when = e.get("useWhen",  "")
    key = teaches
    if not key or key in seen:
        continue
    if any(kw in teaches or kw in use_when for kw in keywords):
        seen[key] = e
        print(f"- `{e['id']}`: {teaches}")
PY
echo ""

# ── 目标项目现有文件 ─────────────────────────────
echo "## 目标项目现有情况"
echo ""
for f in AGENTS.md README.md PROJECT.md HANDOFF.md; do
  if [ -f "$target/$f" ]; then
    lines=$(wc -l < "$target/$f" | tr -d ' ')
    echo "- ✅ $f 已存在（$lines 行）"
  else
    echo "- ❌ $f 不存在"
  fi
done
echo ""

# Git 信息（帮 AI 了解项目背景）
if git -C "$target" rev-parse --git-dir >/dev/null 2>&1; then
  echo "## 目标项目 Git 信息"
  echo ""
  echo "- 分支: $(git -C "$target" branch --show-current 2>/dev/null || echo '?')"
  echo "- 提交数: $(git -C "$target" rev-list --count HEAD 2>/dev/null || echo '?')"
  echo "- 最近提交:"
  git -C "$target" log --oneline -5 --format="  - %h %s" 2>/dev/null || true
  echo ""
fi

# 目录结构
echo "## 目标项目目录结构"
echo ""
find "$target" -maxdepth 2 \
  -not -path "$target/.git/*" \
  -not -path "$target/node_modules/*" \
  -not -path "$target/.project-os/*" \
  \( -type d -o -name "*.md" -o -name "package.json" -o -name "*.sh" \) \
  | sed "s|$target/||" | sort | head -30
echo ""

# ── 文档类型专属指令 ─────────────────────────────
echo "## 生成指令（$doc_type）"
echo ""

case "$doc_type" in
  claude)
    echo "生成 \`CLAUDE.md\` — Claude Code 适配文件（控制 skill 路由，赋能新项目必须有）"
    echo ""
    echo "⚠️  经验教训（LESSONS.md 2026-06-06）："
    echo "    没有 CLAUDE.md 时，全局 skill（如 intent-clarifier）会按词语模式"
    echo "    抢先触发，绕过项目知识层，问一堆已知答案的问题。"
    echo ""
    echo "要求："
    echo "1. 开头说明这是 Claude Code 适配文件，通用规则以 AGENTS.md 为准"
    echo "2. 必读区：列出进入项目必须先读的三个文件（AGENTS/PROJECT/HANDOFF）"
    echo "3. 路由规则：把项目的核心任务类型映射到正确处理方式，明确不要触发通用澄清流程"
    echo "4. 技术栈已锁定的项目：在 CLAUDE.md 里写明技术栈，让 AI 不用再问"
    echo "5. 状态速览：上次做到哪、下一步是什么（让新会话秒接手）"
    echo "6. ★ 必须包含「首次进入自动引导」段落 —— 这是自动触发填充的钥匙，原文如下："
    echo ""
    echo "   ## 🚀 首次进入自动引导（不靠用户记命令）"
    echo "   进入项目读完必读文件后，检查 docs/ 下是否还有空模板（含 \`[例如]\` / \`____\` / \`待填\` 占位符）。"
    echo "   若有 → **不要等用户开口，主动启动引导填充**："
    echo "   1. 按依赖顺序填：PROJECT → TECH_STACK → CODE_STRUCTURE → DESIGN_STANDARDS → NAMING"
    echo "   2. 每次只问用户一组最关键的问题，拿到答案再填"
    echo "   3. 文档间串联：技术栈定了，目录/命名/设计规范都跟着它写；设计规范引用已有 token，不另造"
    echo "   4. 能从已有文件推断的（如 token 已在 css 里）先填好再让用户确认，别明知故问"
    echo "   全部填完后，把本段标记为「✅ 已完成引导」。"
    echo ""
    echo "7. 生成草稿后告知用户，确认后写入 \`$target/CLAUDE.md\`"
    ;;
  agents)
    echo "生成 \`AGENTS.md\` — AI 行为规则文件"
    echo ""
    echo "要求："
    echo "1. 按上面的文档规范，在文件顶部加 YAML frontmatter（layer/type/last_verified）"
    echo "2. 标题下方加 '> 用途' 引用块"
    echo "3. 包含：必读文件列表、路由规则、AI 禁止行为、文档更新规则"
    echo "4. 路由规则参考 Project OS 的 AGENTS.md 格式，但内容针对这个项目"
    echo "5. 生成草稿后告知用户，确认后再写入 \`$target/AGENTS.md\`"
    ;;
  readme)
    echo "生成 \`README.md\` — 项目介绍 + 快速开始"
    echo ""
    echo "要求："
    echo "1. 加 YAML frontmatter"
    echo "2. 包含：一句话定位、快速开始步骤、关键入口文件导航"
    echo "3. 基于 Git 提交历史和目录结构推断项目用途，不要编造"
    echo "4. 生成草稿后告知用户，确认后再写入 \`$target/README.md\`"
    ;;
  handoff)
    echo "生成 \`HANDOFF.md\` — 当前任务交接记录"
    echo ""
    echo "要求："
    echo "1. 加 YAML frontmatter（layer: knowledge, type: status）"
    echo "2. 包含：上次做到哪、下一步建议、已知风险"
    echo "3. 基于 Git 最近提交推断当前进度"
    echo "4. 生成草稿后告知用户，确认后再写入 \`$target/HANDOFF.md\`"
    ;;
  project)
    echo "生成 \`PROJECT.md\` — 项目状态快照"
    echo ""
    echo "要求："
    echo "1. 加 YAML frontmatter（layer: knowledge, type: status）"
    echo "2. 包含：项目定位、当前架构、进度、已知问题、下一步重点"
    echo "3. 基于目录结构和 Git 历史推断，不要编造"
    echo "4. 生成草稿后告知用户，确认后再写入 \`$target/PROJECT.md\`"
    ;;
  lessons)
    echo "生成 \`docs/LESSONS.md\` — 错误复盘文件（空白模板）"
    echo ""
    echo "要求："
    echo "1. 加 YAML frontmatter（layer: knowledge, type: log）"
    echo "2. 包含：格式说明 + 各领域的空白分区（前端/后端/AI/部署等）"
    echo "3. 不填写具体内容，由用户自己记录"
    echo "4. 生成后确认写入 \`$target/docs/LESSONS.md\`"
    ;;
  changelog)
    echo "生成 \`docs/CHANGELOG.md\` — 变更日志"
    echo ""
    echo "要求："
    echo "1. 加 YAML frontmatter（layer: knowledge, type: log）"
    echo "2. 基于 Git 提交历史，提取有结构意义的改动条目"
    echo "3. 格式：日期 → 模块 → 改了什么/影响什么/相关文件"
    echo "4. 生成草稿后告知用户确认"
    ;;
  *)
    echo "未知文档类型: $doc_type"
    echo "运行 bash scripts/kb-generate-docs.sh --list 查看支持的类型"
    ;;
esac

echo ""
echo "💡 立即开始生成，输出草稿内容。不要直接写入文件，先展示草稿让用户确认。"
