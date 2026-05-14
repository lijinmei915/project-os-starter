#!/usr/bin/env bash
set -euo pipefail

target="${1:-.}"

if [ ! -d "$target" ]; then
  echo "ERROR: target directory not found: $target"
  exit 2
fi

cd "$target"

if [ ! -d ".claude" ]; then
  echo "ERROR: missing source runtime directory: .claude"
  exit 2
fi

mkdir -p templates/project/.claude

sync_dir() {
  source_path="$1"
  template_path="$2"

  if [ ! -d "$source_path" ]; then
    echo "ERROR: missing source directory: $source_path"
    exit 2
  fi

  rm -rf "$template_path"
  mkdir -p "$template_path"
  cp -R "$source_path/." "$template_path/"
  echo "synced directory: $template_path"
}

sync_file() {
  source_path="$1"
  template_path="$2"

  if [ ! -f "$source_path" ]; then
    echo "ERROR: missing source file: $source_path"
    exit 2
  fi

  mkdir -p "$(dirname "$template_path")"
  cp "$source_path" "$template_path"
  echo "synced file: $template_path"
}

sync_dir ".claude/commands" "templates/project/.claude/commands"
sync_dir ".claude/hooks" "templates/project/.claude/hooks"
sync_dir ".claude/skills" "templates/project/.claude/skills"
sync_file ".claude/project.json" "templates/project/.claude/project.json"
sync_dir "adapters" "templates/project/adapters"
sync_dir "docs/design" "templates/project/docs/design"
sync_file "docs/DOCUMENTATION.md" "templates/project/docs/DOCUMENTATION.md"
sync_file "INSTALL.md" "templates/project/INSTALL.md"
sync_file "scripts/check-runtime.sh" "templates/project/scripts/check-runtime.sh"
sync_file "scripts/install-adapter.sh" "templates/project/scripts/install-adapter.sh"

echo "template runtime sync complete"
