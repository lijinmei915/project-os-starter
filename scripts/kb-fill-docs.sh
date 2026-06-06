#!/usr/bin/env bash

# kb-fill-docs.sh
# 装完文件的下一步：引导式填充 + 文档串联。
# 解决痛点：向导只生成空模板，用户拿到一堆空表格不知道填什么。
# 做法：扫描项目里还是空模板的工程文档 → 按依赖顺序整理出引导 prompt →
#       AI 用最少的问题问用户关键信息 → 把答案填进各文档，且文档间内容互相引用、保持一致。
#
# 用法:
#   bash scripts/kb-fill-docs.sh [目标项目路径]    # 默认当前目录

set -euo pipefail

target="${1:-.}"
[ -d "$target" ] || { echo "ERROR: 目录不存在: $target"; exit 1; }
target="$(cd "$target" && pwd)"

echo "🧩 [KB-FILL-DOCS · 引导填充 + 文档串联]"
echo ""
echo "目标项目: $target"
echo ""

# 判断一个文档是不是「还没填的空模板」：含占位符 [例如 / ____ / TODO，或正文很短
is_empty_template() {
  local f="$1"
  [ -f "$f" ] || return 1
  if grep -qE '\[例如|____|TODO|<.*占位|待填' "$f" 2>/dev/null; then return 0; fi
  # 去掉 frontmatter 和引用块后，正文少于 15 行也算空
  local body_lines
  body_lines=$(grep -vE '^---|^>|^#|^\s*$' "$f" 2>/dev/null | wc -l | tr -d ' ')
  [ "$body_lines" -lt 15 ]
}

# 填充链：按依赖顺序，前面定了后面才好填
# 格式: 文件|该问用户什么|依赖谁
declare -a CHAIN=(
  "PROJECT.md|项目定位、当前阶段、要解决什么|—"
  "docs/TECH_STACK.md|前端/后端框架、语言、构建工具、组件库|PROJECT"
  "docs/CODE_STRUCTURE.md|目录怎么分层、各目录放什么|TECH_STACK（按选定技术栈写目录）"
  "docs/DESIGN_STANDARDS.md|设计 token、配色、组件库策略、视觉边界|TECH_STACK + 已有 token 文件"
  "docs/NAMING.md|文件/变量/组件命名规则|TECH_STACK"
  "docs/ENVIRONMENT.md|怎么启动、依赖、环境变量|TECH_STACK"
  "docs/ARCHITECTURE.md|系统模块划分、数据流、边界|以上都定了再综合"
)

echo "## 待填充文档（按依赖顺序，前面先定）"
echo ""
pending=()
i=1
for item in "${CHAIN[@]}"; do
  f="${item%%|*}"
  rest="${item#*|}"
  ask="${rest%%|*}"
  dep="${rest#*|}"
  path="$target/$f"
  if [ -f "$path" ]; then
    if is_empty_template "$path"; then
      echo "  $i. ⬜ $f"
      echo "       该问用户: $ask"
      echo "       依赖: $dep"
      pending+=("$f|$ask")
      i=$((i+1))
    else
      echo "  ✅ $f（已填，跳过）"
    fi
  fi
done
echo ""

if [ ${#pending[@]} -eq 0 ]; then
  echo "🎉 所有工程文档都已填充，无需引导。"
  exit 0
fi

# 已有的 token / 真相源，填充时要引用
echo "## 可引用的已有真相源"
echo ""
for ref in "theme/fx-theme.css" "docs/TOKENS.md" "$(ls "$target"/*tokens* 2>/dev/null)"; do
  [ -f "$target/$ref" ] && echo "  • $ref（填 DESIGN_STANDARDS 时引用，别另起一套）"
done
[ -f "$target/.project-os/graph/knowledge-registry.json" ] && echo "  • knowledge-registry.json（已有知识索引）"
echo ""

echo "## 你的任务（引导填充专家模式）"
echo ""
echo "1. **按上面的依赖顺序，一个一个填**，不要跳。前面的答案决定后面怎么写。"
echo "2. **每次只问用户一组最关键的问题**（比如先只问技术栈），拿到答案再填，别一次抛十个问题。"
echo "3. **填充时文档要串起来**："
echo "   - TECH_STACK 定了 React → CODE_STRUCTURE 的目录就按 React 写（components/ hooks/ ...）"
echo "   - DESIGN_STANDARDS 引用已有的 token 真相源，不另造一套颜色"
echo "   - NAMING 的规则要和 TECH_STACK 的语言一致（TS 就写 TS 命名约定）"
echo "4. **能从已有文件推断的，先填好再让用户确认**，不要明知道答案还问（比如 token 已经在 fx-theme.css 里，直接读，别问用户颜色）。"
echo "5. 每填完一个文档，告诉用户「填了什么、依据是什么」，确认后再填下一个。"
echo ""
echo "💡 从第 1 个文档开始，先问用户那一组问题。不要等用户进一步确认就开始引导。"
