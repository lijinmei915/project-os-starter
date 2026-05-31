#!/usr/bin/env bash

# check-testing.sh
# 检查项目的测试基础设施、规范以及 CI 自动化配置情况（QA/测试工程师视角）。

PROJECT_DIR="${1:-.}"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Directory $PROJECT_DIR does not exist."
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

echo "🧪 检查测试与质量保证 (QA) 规范..."
SCORE=0
TOTAL=4

# 1. 检查规范文档
if [ -f "docs/TESTING.md" ]; then
  echo "✅ 发现 docs/TESTING.md"
  SCORE=$((SCORE + 1))
else
  echo "❌ 缺少 docs/TESTING.md"
fi

# 2. 检查测试入口或测试脚本
if [ -f "tests/run-tests.sh" ] || [ -f "scripts/test.sh" ] || grep -q "\"test\":" package.json 2>/dev/null; then
  echo "✅ 发现可执行测试入口 (run-tests.sh 或 package.json test script)"
  SCORE=$((SCORE + 1))
else
  echo "⚠️ 缺少统一的可执行测试入口"
fi

# 3. 检查是否存在实际测试用例目录
if [ -d "tests" ] || [ -d "__tests__" ] || [ -n "$(find src -name "*.test.*" -o -name "*.spec.*" -print -quit 2>/dev/null)" ]; then
  echo "✅ 发现测试用例目录或测试文件 (*.test.* / *.spec.*)"
  SCORE=$((SCORE + 1))
else
  echo "⚠️ 未发现典型的单元测试或端到端测试用例"
fi

# 4. 检查 CI/CD 自动化
if [ -d ".github/workflows" ] || [ -f ".gitlab-ci.yml" ] || [ -f "bitbucket-ci.yml" ]; then
  echo "✅ 发现 CI/CD 自动化流水线配置"
  SCORE=$((SCORE + 1))
else
  echo "⚠️ 缺少 CI/CD 流水线配置，无法实现自动化门禁"
fi

echo "----------------------------------------"
echo "测试规范检查得分: $SCORE / $TOTAL"

if [ $SCORE -lt 2 ]; then
  echo "⚠️ 项目质量保障 (QA) 机制较为薄弱，建议参考 docs/TESTING.md 补充单元测试或 CI/CD 配置。"
  exit 1
fi

exit 0
