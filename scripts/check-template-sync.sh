#!/usr/bin/env bash
set -u

target="${1:-.}"

if [ ! -d "$target" ]; then
  echo "ERROR: target directory not found: $target"
  exit 2
fi

cd "$target" || exit 2

warnings=0

warn() {
  warnings=$((warnings + 1))
  echo "WARN: $*"
}

compare_path() {
  source_path="$1"
  template_path="$2"

  if [ ! -e "$source_path" ]; then
    warn "missing source runtime path: $source_path"
    return
  fi

  if [ ! -e "$template_path" ]; then
    warn "missing template runtime path: $template_path"
    return
  fi

  if ! diff -qr "$source_path" "$template_path" >/dev/null 2>&1; then
    warn "template runtime out of sync: $template_path (source: $source_path)"
  fi
}

if [ ! -d "templates/project" ]; then
  exit 0
fi

compare_path ".claude/commands" "templates/project/.claude/commands"
compare_path ".claude/hooks" "templates/project/.claude/hooks"
compare_path ".claude/skills" "templates/project/.claude/skills"
compare_path ".claude/project.json" "templates/project/.claude/project.json"
compare_path "adapters" "templates/project/adapters"
compare_path "docs/design" "templates/project/docs/design"
compare_path "docs/DOCUMENTATION.md" "templates/project/docs/DOCUMENTATION.md"
compare_path "INSTALL.md" "templates/project/INSTALL.md"
compare_path "scripts/check-runtime.sh" "templates/project/scripts/check-runtime.sh"
compare_path "scripts/install-adapter.sh" "templates/project/scripts/install-adapter.sh"

if [ "$warnings" -gt 0 ]; then
  echo "Run: bash scripts/sync-templates.sh"
fi

exit 0
