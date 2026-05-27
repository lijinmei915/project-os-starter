#!/usr/bin/env bash
set -euo pipefail

target="${1:-.}"

if [ ! -d "$target" ]; then
  echo "ERROR: target directory not found: $target"
  exit 2
fi

cd "$target"

warnings=0
errors=0
secret_scan_tmp="$(mktemp)"

cleanup() {
  rm -f "$secret_scan_tmp"
}
trap cleanup EXIT

warn() {
  warnings=$((warnings + 1))
  echo "WARN: $*"
}

error() {
  errors=$((errors + 1))
  echo "ERROR: $*"
}

if [ -f ".env.local" ]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if ! git check-ignore -q ".env.local"; then
      error ".env.local is not ignored by git"
    fi
  fi

  key_line="$(grep -E '^DEEPSEEK_API_KEY=' ".env.local" | tail -1 || true)"
  key_value="${key_line#DEEPSEEK_API_KEY=}"
  if [ -z "$key_line" ]; then
    warn ".env.local exists but DEEPSEEK_API_KEY is missing"
  elif [ -z "$key_value" ]; then
    warn "DEEPSEEK_API_KEY is empty in .env.local"
  else
    echo "OK: DEEPSEEK_API_KEY is set locally"
  fi
else
  warn ".env.local not found; copy .env.example to .env.local when you need provider keys"
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git grep -n -E 'sk-[A-Za-z0-9_-]{20,}|DEEPSEEK_API_KEY=[^[:space:]#]+' -- ':!*.png' ':!*.jpg' ':!*.jpeg' ':!*.gif' ':!*.webp' >"$secret_scan_tmp" 2>/dev/null; then
    cat "$secret_scan_tmp"
    error "possible secret found in tracked files"
  else
    echo "OK: no obvious provider keys found in tracked files"
  fi
fi

if [ "$errors" -gt 0 ]; then
  echo "Result: failed with $errors error(s), $warnings warning(s)."
  exit 1
fi

echo "Result: completed with $warnings warning(s)."
