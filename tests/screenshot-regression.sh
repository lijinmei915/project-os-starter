#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
html_file="$root/.project-os/reports/ai-project-report.html"
screenshot_dir="$root/tests/screenshots"
baseline_dir="$screenshot_dir/baseline"
current_dir="$screenshot_dir/current"
diff_dir="$screenshot_dir/diff"
legacy_screenshot_file="$screenshot_dir/ai-project-report.png"
visual_diff_script="$root/tests/visual-diff.mjs"

log() {
  printf '[screenshot] %s\n' "$*"
}

assert_contains() {
  file="$1"
  pattern="$2"
  if ! grep -q "$pattern" "$file"; then
    echo "ERROR: expected pattern not found in $file: $pattern"
    exit 1
  fi
}

find_browser() {
  if [ -n "${CHROME_BIN:-}" ] && [ -x "$CHROME_BIN" ]; then
    printf '%s\n' "$CHROME_BIN"
    return 0
  fi

  for candidate in \
    google-chrome \
    google-chrome-stable \
    chromium \
    chromium-browser; do
    if command -v "$candidate" >/dev/null 2>&1; then
      command -v "$candidate"
      return 0
    fi
  done

  mac_chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  if [ "${ALLOW_LOCAL_BROWSER_SCREENSHOT:-}" = "1" ] && [ -x "$mac_chrome" ]; then
    printf '%s\n' "$mac_chrome"
    return 0
  fi

  return 1
}

capture_viewport() {
  browser="$1"
  viewport_name="$2"
  viewport_size="$3"
  output_file="$4"
  timeout_seconds="${BROWSER_SCREENSHOT_TIMEOUT:-30}"

  rm -f "$output_file"
  log "capture $viewport_name screenshot with $browser"

  if run_with_timeout "$timeout_seconds" "$browser" \
    --headless=new \
    --disable-gpu \
    --no-sandbox \
    --screenshot="$output_file" \
    --window-size="$viewport_size" \
    "file://$html_file" >/dev/null 2>&1; then
    :
  elif run_with_timeout "$timeout_seconds" "$browser" \
      --headless \
      --disable-gpu \
      --no-sandbox \
      --screenshot="$output_file" \
      --window-size="$viewport_size" \
      "file://$html_file" >/dev/null 2>&1; then
    :
  else
    log "$viewport_name browser capture failed"
    return 1
  fi

  if [ ! -s "$output_file" ]; then
    echo "ERROR: screenshot was created but empty: $output_file"
    exit 1
  fi

  log "screenshot saved: $output_file"
}

run_with_timeout() {
  timeout_seconds="$1"
  shift

  "$@" &
  pid="$!"
  elapsed=0

  while kill -0 "$pid" 2>/dev/null; do
    if [ "$elapsed" -ge "$timeout_seconds" ]; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      return 124
    fi

    sleep 1
    elapsed=$((elapsed + 1))
  done

  wait "$pid"
}

compare_or_update_baseline() {
  viewport_name="$1"
  current_file="$2"
  baseline_file="$baseline_dir/ai-project-report-$viewport_name.png"
  diff_file="$diff_dir/ai-project-report-$viewport_name.diff.png"

  if [ "${UPDATE_VISUAL_BASELINE:-}" = "1" ]; then
    cp "$current_file" "$baseline_file"
    log "baseline updated: $baseline_file"
    return 0
  fi

  if [ ! -f "$baseline_file" ]; then
    if [ "${VISUAL_DIFF_STRICT:-}" = "1" ]; then
      echo "ERROR: missing visual baseline: $baseline_file"
      echo "Hint: run UPDATE_VISUAL_BASELINE=1 ALLOW_LOCAL_BROWSER_SCREENSHOT=1 bash tests/screenshot-regression.sh"
      exit 1
    fi
    log "missing $viewport_name baseline; skipped visual diff"
    return 0
  fi

  if ! command -v node >/dev/null 2>&1; then
    if [ "${VISUAL_DIFF_STRICT:-}" = "1" ]; then
      echo "ERROR: node is required for visual diff"
      exit 1
    fi
    log "node not found; skipped $viewport_name visual diff"
    return 0
  fi

  node "$visual_diff_script" "$baseline_file" "$current_file" "$diff_file"
}

log "generate report"
bash "$root/scripts/check-ai-project.sh" "$root" --write-report --html >/dev/null

if [ ! -f "$html_file" ]; then
  echo "ERROR: report HTML not found: $html_file"
  exit 1
fi

log "check report markers"
assert_contains "$html_file" "AI 项目工程助手"
assert_contains "$html_file" "当前报告"
assert_contains "$html_file" "上下文完整度"
assert_contains "$html_file" "工程成熟度"
assert_contains "$html_file" "kitProjectSwitch"
assert_contains "$html_file" "data-component=\"SectionHeading\""
assert_contains "$html_file" "data-component\", \"RequiredMaterialItem"
assert_contains "$html_file" "function renderRequiredMaterialItem"

mkdir -p "$baseline_dir" "$current_dir" "$diff_dir"

if browser="$(find_browser)"; then
  for viewport in "desktop:1280,1600" "mobile:390,1400"; do
    viewport_name="${viewport%%:*}"
    viewport_size="${viewport#*:}"
    current_file="$current_dir/ai-project-report-$viewport_name.png"

    if capture_viewport "$browser" "$viewport_name" "$viewport_size" "$current_file"; then
      if [ "$viewport_name" = "desktop" ]; then
        cp "$current_file" "$legacy_screenshot_file"
      fi
      compare_or_update_baseline "$viewport_name" "$current_file"
    elif [ "${VISUAL_DIFF_STRICT:-}" = "1" ]; then
      echo "ERROR: strict visual diff requested but $viewport_name screenshot capture failed"
      exit 1
    fi
  done
else
  if [ "${VISUAL_DIFF_STRICT:-}" = "1" ]; then
    echo "ERROR: strict visual diff requested but browser was not found"
    exit 1
  fi
  log "browser not found; skipped bitmap capture and visual diff after marker checks"
fi

log "passed"
