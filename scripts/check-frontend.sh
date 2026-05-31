#!/usr/bin/env bash

# check-frontend.sh
# 检查前端项目的基本健康状态和规范执行情况。

PROJECT_DIR="${1:-.}"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Directory $PROJECT_DIR does not exist."
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

echo "🔍 检查前端项目规范..."
SCORE=0
TOTAL=4

# 1. 检查规范文档
if [ -f "docs/FRONTEND.md" ]; then
  echo "✅ 发现 docs/FRONTEND.md"
  SCORE=$((SCORE + 1))
else
  echo "❌ 缺少 docs/FRONTEND.md"
fi

# 2. 检查包管理文件
if [ -f "package.json" ]; then
  echo "✅ 发现 package.json"
  SCORE=$((SCORE + 1))
else
  echo "❌ 缺少 package.json，未检测到典型前端项目结构"
fi

# 3. 检查代码质量配置
if grep -q "\"eslint\"" package.json 2>/dev/null || [ -f ".eslintrc" ] || [ -f ".eslintrc.js" ] || [ -f "eslint.config.js" ]; then
  echo "✅ 发现 ESLint 配置"
  SCORE=$((SCORE + 1))
else
  echo "⚠️ 缺少 ESLint 配置 (建议添加以保证代码质量)"
fi

# 4. 检查标准目录结构
if [ -d "src/components" ] || [ -d "src/pages" ] || [ -d "src/app" ] || [ -d "components" ]; then
  echo "✅ 发现标准前端源码目录结构"
  SCORE=$((SCORE + 1))
else
  echo "⚠️ 缺少常见的组件或页面目录 (src/components, src/pages 等)"
fi

echo "----------------------------------------"
echo "前端检查得分: $SCORE / $TOTAL"

if [ $SCORE -lt 2 ]; then
  echo "⚠️ 前端规范执行度较低，建议参考 docs/FRONTEND.md 补充必要文件。"
  exit 1
fi

exit 0
