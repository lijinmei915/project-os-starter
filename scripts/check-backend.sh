#!/usr/bin/env bash

# check-backend.sh
# 检查后端项目的基本健康状态和规范执行情况。

PROJECT_DIR="${1:-.}"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Directory $PROJECT_DIR does not exist."
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

echo "🔍 检查后端项目规范..."
SCORE=0
TOTAL=4

# 1. 检查规范文档
if [ -f "docs/BACKEND.md" ]; then
  echo "✅ 发现 docs/BACKEND.md"
  SCORE=$((SCORE + 1))
else
  echo "❌ 缺少 docs/BACKEND.md"
fi

# 2. 检查环境配置模板
if [ -f ".env.example" ] || [ -f "env.example" ]; then
  echo "✅ 发现 .env.example"
  SCORE=$((SCORE + 1))
else
  echo "❌ 缺少 .env.example，不利于环境隔离与交接"
fi

# 3. 检查包依赖/项目文件
if [ -f "package.json" ] || [ -f "requirements.txt" ] || [ -f "Pipfile" ] || [ -f "go.mod" ] || [ -f "pom.xml" ] || [ -f "build.gradle" ]; then
  echo "✅ 发现依赖配置文件"
  SCORE=$((SCORE + 1))
else
  echo "❌ 未检测到常见的后端包管理文件"
fi

# 4. 检查是否有独立的源码目录 (启发式)
if [ -d "src" ] || [ -d "app" ] || [ -d "internal" ] || [ -d "server" ]; then
  echo "✅ 发现标准的源码目录 (src/app/internal/server)"
  SCORE=$((SCORE + 1))
else
  echo "⚠️ 未发现典型的后端源码组织结构"
fi

echo "----------------------------------------"
echo "后端检查得分: $SCORE / $TOTAL"

if [ $SCORE -lt 2 ]; then
  echo "⚠️ 后端规范执行度较低，建议参考 docs/BACKEND.md 补充必要文件。"
  exit 1
fi

exit 0
