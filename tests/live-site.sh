#!/usr/bin/env bash
set -u

# Live site smoke test for the deployed GitHub Pages URL.
# Verifies: HTTP status, key HTML markers, asset loadability.
# Browser-level functional tests should be run separately.

URL="${LIVE_SITE_URL:-https://lijinmei915.github.io/project-os-starter/}"

pass=0
fail=0

log_pass() { printf '\033[32m✓\033[0m %s\n' "$1"; pass=$((pass+1)); }
log_fail() { printf '\033[31m✗\033[0m %s\n' "$1"; fail=$((fail+1)); }

assert_status_200() {
  local desc="$1"
  local url="$2"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
  if [ "$code" = "200" ]; then
    log_pass "$desc → 200"
  else
    log_fail "$desc → $code (expected 200)"
  fi
}

assert_contains() {
  local desc="$1"
  local url="$2"
  local pattern="$3"
  if curl -sS "$url" | grep -q "$pattern"; then
    log_pass "$desc"
  else
    log_fail "$desc (pattern not found: $pattern)"
  fi
}

assert_not_contains() {
  local desc="$1"
  local url="$2"
  local pattern="$3"
  if ! curl -sS "$url" | grep -q "$pattern"; then
    log_pass "$desc"
  else
    log_fail "$desc (unexpected pattern found: $pattern)"
  fi
}

echo "=== Live site smoke test ==="
echo "Target: $URL"
echo ""

# 1. HTTP basics
echo "-- HTTP --"
assert_status_200 "root path returns 200" "$URL"
assert_status_200 "explicit index.html returns 200" "${URL}index.html"

# 2. Page identity markers
echo ""
echo "-- Page markers --"
assert_contains "page title is AI 项目工程完整度报告" "$URL" "AI 项目工程完整度报告"
assert_contains "kit UI present (AI 项目工程助手)" "$URL" "AI 项目工程助手"
assert_contains "two-tab switcher present" "$URL" "kitProjectSwitch"
assert_contains "new project tab labeled 创建新项目" "$URL" "创建新项目"
assert_contains "old project tab labeled 接手老项目" "$URL" "接手老项目"

# 3. Standalone analysis features
echo ""
echo "-- Standalone analysis features --"
assert_contains "analyze button present (kitAnalyzeBtn)" "$URL" "kitAnalyzeBtn"
assert_contains "zip drop zone present (kitZipZone)" "$URL" "kitZipZone"
assert_contains "directory picker present (kitDirectoryInput)" "$URL" "kitDirectoryInput"
assert_contains "results target present (kitOldResults)" "$URL" "kitOldResults"
assert_contains "JSZip CDN script tag present" "$URL" "jszip.min.js"
assert_contains "browser analysis engine (runChecks fn) present" "$URL" "async function runChecks"
assert_contains "meaningfulLines fn present" "$URL" "function meaningfulLines"

# 4. No leftover template placeholders
echo ""
echo "-- Standalone cleanliness --"
assert_not_contains "no leftover {{CONTEXT_SCORE}} placeholder" "$URL" "{{CONTEXT_SCORE}}"
assert_not_contains "no leftover {{GENERATED_AT}} placeholder" "$URL" "{{GENERATED_AT}}"
assert_not_contains "no leftover {{MODULE_GRID}} placeholder" "$URL" "{{MODULE_GRID}}"
assert_not_contains "no leftover {{TARGET_HTML}} placeholder" "$URL" "{{TARGET_HTML}}"

# 5. JSZip CDN reachable
echo ""
echo "-- Asset reachability --"
assert_status_200 "JSZip CDN reachable" "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"

# Summary
echo ""
echo "=== Result: $pass passed, $fail failed ==="
[ "$fail" -eq 0 ] || exit 1
