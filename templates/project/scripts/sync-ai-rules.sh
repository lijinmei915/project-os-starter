#!/usr/bin/env bash

# sync-ai-rules.sh
# 作用：强制维持单一真相源 (SSOT)。
# 逻辑：自动扫描项目中的核心规范文件，并在 .ai/rules/ 目录下动态生成相对软链接。
# 无论用户新增、删除或重命名文档，运行此脚本后 .ai/rules 都会与真实文件保持强一致。

PROJECT_DIR="${1:-.}"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Directory $PROJECT_DIR does not exist."
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

RULES_DIR=".ai/rules"
mkdir -p "$RULES_DIR"

# 1. 清理现有的所有软链接（或者失效的链接），确保是全新映射
# find "$RULES_DIR" -type l -delete # (兼容性更好的写法见下)
rm -f "$RULES_DIR"/*.md 2>/dev/null

echo "🔄 开始动态映射 AI 规则..."

# 2. 定义需要被 AI 识别的白名单目录/文件
# 将名称转为小写 kebab-case，例如 FRONTEND.md -> frontend.md
link_file() {
  local src_path="$1"
  local dest_name="$2"

  if [ -f "$src_path" ]; then
    # 计算相对路径，假设 $RULES_DIR 是 .ai/rules，深度固定为 2 级
    local relative_target="../../$src_path"
    ln -sf "$relative_target" "$RULES_DIR/$dest_name"
    echo "  🔗 映射: $dest_name -> $src_path"
  fi
}

# --- 映射根目录核心文件 ---
link_file "AGENTS.md" "system-agents.md"
link_file "PROJECT.md" "project-status.md"

# --- 映射 docs/ 下所有符合条件的规范文件 ---
if [ -d "docs" ]; then
  # 遍历 docs 根目录下的 md 文件
  for file in docs/*.md; do
    [ -f "$file" ] || continue

    filename=$(basename "$file")

    # 忽略掉 AI 不需要的日志/流水账类文档
    if [[ "$filename" == "CHANGELOG.md" ]] || [[ "$filename" == "LESSONS.md" ]]; then
      continue
    fi

    # 转换文件名为小写作为 alias
    # macOS/Linux 兼容的大小写转换
    dest_name=$(echo "$filename" | tr '[:upper:]' '[:lower:]')

    link_file "$file" "$dest_name"
  done

  # 特定深层文件单独映射 (如设计 token)
  link_file "docs/design/tokens.md" "design-tokens.md"
  link_file "docs/design/layout.md" "design-layout.md"
fi

echo "✅ 动态映射完成，唯一真相源 (SSOT) 已强制同步至 $RULES_DIR/"
exit 0
