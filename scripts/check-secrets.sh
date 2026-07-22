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
    if [ "${OMNIDESK_ALLOW_EMPTY_PROVIDER_KEYS:-${PROJECT_OS_ALLOW_EMPTY_PROVIDER_KEYS:-0}}" = "1" ]; then
      echo "OK: DEEPSEEK_API_KEY missing; pure local scan mode enabled"
    else
      warn ".env.local exists but DEEPSEEK_API_KEY is missing"
    fi
  elif [ -z "$key_value" ]; then
    if [ "${OMNIDESK_ALLOW_EMPTY_PROVIDER_KEYS:-${PROJECT_OS_ALLOW_EMPTY_PROVIDER_KEYS:-0}}" = "1" ]; then
      echo "OK: DEEPSEEK_API_KEY empty; pure local scan mode enabled"
    else
      warn "DEEPSEEK_API_KEY is empty in .env.local"
    fi
  else
    echo "OK: DEEPSEEK_API_KEY is set locally"
  fi
else
  if [ "${OMNIDESK_ALLOW_EMPTY_PROVIDER_KEYS:-${PROJECT_OS_ALLOW_EMPTY_PROVIDER_KEYS:-0}}" = "1" ]; then
    echo "OK: .env.local not found; pure local scan mode enabled"
  else
    warn ".env.local not found; copy .env.example to .env.local when you need provider keys"
  fi
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git grep -n -E '(^|[^A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}([^A-Za-z0-9_-]|$)|DEEPSEEK_API_KEY=[^[:space:]#]+' -- \
    ':!*.png' ':!*.jpg' ':!*.jpeg' ':!*.gif' ':!*.webp' \
    ':!scripts/check-secrets.sh' \
    >"$secret_scan_tmp" 2>/dev/null; then
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
