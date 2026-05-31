#!/usr/bin/env bash

# check-design.sh
# 检查项目设计规范的执行情况（如 Design Tokens, 视觉差异等）。

PROJECT_DIR="${1:-.}"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Directory $PROJECT_DIR does not exist."
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

echo "🎨 检查设计与 UI 测试规范..."
SCORE=0
TOTAL=4

# 1. 检查设计标准文档
if [ -f "docs/DESIGN_STANDARDS.md" ]; then
  echo "✅ 发现 docs/DESIGN_STANDARDS.md"
  SCORE=$((SCORE + 1))
else
  echo "❌ 缺少 docs/DESIGN_STANDARDS.md"
fi

# 2. 检查 Tokens 文档
if [ -f "docs/design/tokens.md" ]; then
  echo "✅ 发现 docs/design/tokens.md"
  SCORE=$((SCORE + 1))
else
  echo "⚠️ 缺少 docs/design/tokens.md (设计系统规范核心)"
fi

# 3. 检查是否有视觉回归测试脚本
if [ -f "tests/screenshot-regression.sh" ] || [ -f "tests/visual-diff.mjs" ]; then
  echo "✅ 发现视觉回归/差异测试脚本"
  SCORE=$((SCORE + 1))
else
  echo "⚠️ 缺少视觉差异测试工具 (如 visual-diff.mjs)"
fi

# 4. 启发式检查 CSS 中是否有硬编码的非 token 颜色 (极其简单的检查，可扩展)
# 查找 src 目录下 css/scss 文件中是否包含 #HEX 颜色，这通常意味着没用 token
if [ -d "src" ]; then
  HARDCODED_COLORS=$(find src -type f -name "*.css" -o -name "*.scss" 2>/dev/null | xargs grep -E "#[0-9a-fA-F]{3,6}" | head -n 1)
  if [ -n "$HARDCODED_COLORS" ]; then
     echo "⚠️ 警告: 发现可能未使用 Design Token 的硬编码颜色色值"
  else
     echo "✅ 样式文件未发现明显的硬编码十六进制颜色 (假定使用了 Tokens/变量)"
     SCORE=$((SCORE + 1))
  fi
else
  echo "⚠️ 缺少 src 目录，跳过样式硬编码检查"
fi


echo "----------------------------------------"
echo "设计规范检查得分: $SCORE / $TOTAL"

if [ $SCORE -lt 2 ]; then
  echo "⚠️ 设计工程化程度较低，建议完善设计 Token 并引入视觉回归测试。"
  exit 1
fi

exit 0
