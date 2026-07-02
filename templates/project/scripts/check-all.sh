#!/usr/bin/env bash
set -euo pipefail

root="${1:-.}"

if [ ! -d "$root" ]; then
  echo "ERROR: target directory not found: $root"
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run() {
  printf '[check-all] %s\n' "$*"
  "$@"
}

run bash "$script_dir/check-runtime.sh" "$root"
run bash "$script_dir/check-frontmatter.sh" "$root"
run bash "$script_dir/check-file-contracts.sh" "$root"
run bash "$script_dir/check-doc-structure.sh" "$root"
run bash "$script_dir/check-secrets.sh" "$root"

if [ -d "$root/templates/project" ]; then
  run bash "$script_dir/check-template-sync.sh" "$root" --strict
  run bash "$script_dir/check-templates.sh"
fi

echo "[check-all] passed"
