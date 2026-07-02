#!/usr/bin/env bash
# 模板质量检查脚本
# 用法：bash scripts/check-templates.sh
# 检查 templates/ 下所有 .md 模板的质量：互引、头部规范、断链、PRODUCT.md 覆盖等

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TPL_PROJECT="$REPO_ROOT/templates/project"
TPL_DOCS="$REPO_ROOT/templates/project-docs"

PASS=0
FAIL=0
WARN=0

pass() { echo "  ✅ $1"; ((PASS++)); }
fail() { echo "  ❌ $1"; ((FAIL++)); }
warn() { echo "  ⚠️  $1"; ((WARN++)); }

# Collect all template .md files (exclude design/ subfolder)
ALL_MD=()
while IFS= read -r f; do
  ALL_MD+=("$f")
done < <(find "$TPL_PROJECT" "$TPL_DOCS" -name "*.md" -not -path "*/design/*" -not -path "*/.claude/skills/*" -not -path "*/adapters/*" -not -path "*/templates/project/templates/*" -not -path "*/templates/project/docs/*" -not -path "*/templates/project/.claude/*" -not -path "*/templates/project/adapters/*" -not -path "*/templates/project/scripts/*" -not -path "*/templates/project/schemas/*" 2>/dev/null)

# Build a set of known template filenames (relative paths users would reference)
KNOWN_FILES=()
for f in "${ALL_MD[@]}"; do
  # Extract the "user-facing" path: AGENTS.md, docs/ARCHITECTURE.md, PRODUCT.md, .claude/CLAUDE.md, etc.
  rel="${f#$TPL_PROJECT/}"
  rel="${rel#$TPL_DOCS/}"
  KNOWN_FILES+=("$rel")
done
# Also add non-.md known files
KNOWN_FILES+=(".cursorrules" ".claude/launch.json")

echo ""
echo "━━━ 模板质量检查 ━━━"
echo ""

# ─── Check 1: Header convention ───
echo "📋 头部规范检查"
for f in "${ALL_MD[@]}"; do
  name="${f#$TPL_PROJECT/}"
  name="${name#$TPL_DOCS/}"

  has_purpose=$(grep -c '> 用途：\|> 本文件' "$f" 2>/dev/null || true)
  has_update=$(grep -c '> 什么时候更新：' "$f" 2>/dev/null || true)

  if [[ "$has_purpose" -gt 0 && "$has_update" -gt 0 ]]; then
    pass "$name — 头部完整"
  elif [[ "$has_purpose" -gt 0 ]]; then
    warn "$name — 有用途说明，缺「什么时候更新」"
  else
    fail "$name — 缺头部规范（需要「用途」和「什么时候更新」）"
  fi
done

echo ""

# ─── Check 2: Cross-reference isolation ───
echo "🔗 互引检查（每个文件至少引用 1 个其他 .md）"
for f in "${ALL_MD[@]}"; do
  name="${f#$TPL_PROJECT/}"
  name="${name#$TPL_DOCS/}"

  ref_count=$(grep -coE '[A-Z_]+\.md|docs/[A-Z_]+\.md|PRODUCT\.md|\.claude/[A-Za-z.]+\.md|\.github/[a-z-]+\.md' "$f" 2>/dev/null || true)

  if [[ "$ref_count" -gt 0 ]]; then
    pass "$name — $ref_count 处引用"
  else
    fail "$name — 零互引，完全孤立"
  fi
done

echo ""

# ─── Check 3: Broken links ───
echo "🔍 断链检查（引用的文件必须存在于模板库）"
KNOWN_SET=$(printf '%s\n' "${KNOWN_FILES[@]}")
broken_total=0

for f in "${ALL_MD[@]}"; do
  name="${f#$TPL_PROJECT/}"
  name="${name#$TPL_DOCS/}"

  # Extract referenced .md files
  refs=$(grep -oE '`[A-Za-z_./-]+\.md`' "$f" 2>/dev/null | tr -d '`' | sort -u || true)

  for ref in $refs; do
    # Skip external/example/anti-pattern refs
    [[ "$ref" == "GEMINI.md" ]] && continue
    [[ "$ref" == "CODEX.md" ]] && continue
    [[ "$ref" == "HERMES.md" ]] && continue
    [[ "$ref" == "CURSOR.md" ]] && continue
    [[ "$ref" == ".env.example" ]] && continue
    [[ "$ref" == "notes.md" ]] && continue
    [[ "$ref" == "misc.md" ]] && continue
    [[ "$ref" == "todo.md" ]] && continue
    [[ "$ref" == "final.md" ]] && continue
    [[ "$ref" =~ ^\.cursor/ ]] && continue

    # Check if ref exists in known files
    found=0
    for known in "${KNOWN_FILES[@]}"; do
      if [[ "$known" == "$ref" ]] || [[ "$known" == *"/$ref" ]] || [[ "$ref" == *"/$known" ]]; then
        found=1
        break
      fi
    done

    if [[ "$found" -eq 0 ]]; then
      # Check if file actually exists on disk
      if [[ -f "$TPL_PROJECT/$ref" ]] || [[ -f "$TPL_DOCS/$ref" ]]; then
        found=1
      fi
    fi

    if [[ "$found" -eq 0 ]]; then
      warn "$name → $ref（模板库中未找到）"
      ((broken_total++))
    fi
  done
done

if [[ "$broken_total" -eq 0 ]]; then
  pass "无断链"
fi

echo ""

# ─── Check 4: PRODUCT.md coverage ───
echo "📦 PRODUCT.md 覆盖检查（核心文件必须引用 PRODUCT.md）"
MUST_REF_PRODUCT=("AGENTS.md" "README.md" ".claude/CLAUDE.md" "docs/DESIGN_STANDARDS.md" "docs/PRODUCT_PLAN.md" "docs/DOCUMENTATION.md" ".cursorrules" ".github/copilot-instructions.md")

for target in "${MUST_REF_PRODUCT[@]}"; do
  found_file=""
  for f in "${ALL_MD[@]}"; do
    rel="${f#$TPL_PROJECT/}"
    rel="${rel#$TPL_DOCS/}"
    if [[ "$rel" == "$target" ]]; then
      found_file="$f"
      break
    fi
  done

  # Also check .cursorrules (not .md)
  if [[ -z "$found_file" && "$target" == ".cursorrules" ]]; then
    found_file="$TPL_DOCS/.cursorrules"
  fi

  if [[ -n "$found_file" && -f "$found_file" ]]; then
    has_product=$(grep -c 'PRODUCT\.md' "$found_file" 2>/dev/null || true)
    if [[ "$has_product" -gt 0 ]]; then
      pass "$target — 引用了 PRODUCT.md"
    else
      fail "$target — 未引用 PRODUCT.md"
    fi
  fi
done

echo ""

# ─── Check 5: "相关文件" section in docs/ ───
echo "📎 相关文件区块检查（docs/ 下每个文件必须有「相关文件」表格）"
while IFS= read -r f; do
  name="${f#$TPL_DOCS/}"
  has_related=$(grep -c '## 相关文件' "$f" 2>/dev/null || true)
  if [[ "$has_related" -gt 0 ]]; then
    pass "$name"
  else
    fail "$name — 缺「## 相关文件」区块"
  fi
done < <(find "$TPL_DOCS/docs" -maxdepth 1 -name "*.md" 2>/dev/null)

echo ""

# ─── Check 6: Low-assumption technical templates ───
echo "🧭 低假设技术模板检查（FRONTEND/BACKEND 不默认推荐具体技术栈）"
tech_default_patterns='例如：|React /|Vue /|Svelte /|Vanilla JS|Vite /|Webpack|Next\.js|Nuxt|Redux|Zustand|React Query|SWR|Apollo|React Hook Form|Formik|Tailwind CSS|CSS Modules|Styled Components|shadcn/ui|Radix|Ant Design|Lucide|Heroicons|Node\.js /|Python /|Go /|Java|Express /|NestJS|FastAPI|Django|Gin|Node 20\+|Python 3\.11\+|RESTful /|GraphQL|tRPC|gRPC|Swagger|OpenAPI|Postman|PostgreSQL /|MySQL|Redis /|MongoDB|Prisma|Drizzle|SQLAlchemy|GORM|AWS S3|JWT /|OAuth2\.0|OIDC|RBAC'
for f in "$TPL_DOCS/docs/FRONTEND.md" "$TPL_DOCS/docs/BACKEND.md"; do
  name="${f#$TPL_DOCS/}"
  if [[ ! -f "$f" ]]; then
    continue
  fi
  if grep -Eq "$tech_default_patterns" "$f"; then
    fail "$name — 不应在模板里默认列具体主流技术栈"
  else
    pass "$name — 未写死具体技术栈"
  fi
done

echo ""

# ─── Check 7: index.html template sync ───
echo "🔄 index.html 同步检查"
if diff -q "$REPO_ROOT/index.html" "$TPL_PROJECT/index.html" >/dev/null 2>&1; then
  pass "index.html 与 templates/project/index.html 一致"
else
  fail "index.html 与 templates/project/index.html 不一致，需要同步"
fi

echo ""

# ─── Summary ───
echo "━━━ 检查结果 ━━━"
echo "  ✅ 通过: $PASS"
echo "  ❌ 失败: $FAIL"
echo "  ⚠️  警告: $WARN"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  echo "❌ 有 $FAIL 个问题需要修复"
  exit 1
else
  echo "✅ 模板质量检查通过"
  exit 0
fi
