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
sync_dir "schemas" "templates/project/schemas"
sync_file ".env.example" "templates/project/.env.example"
sync_file "index.html" "templates/project/index.html"
sync_dir "templates/project-docs" "templates/project/templates/project-docs"
sync_dir "docs/design" "templates/project/docs/design"
# docs/DOCUMENTATION.md is intentionally different: root is kit-specific, template is generic.
# sync_file "docs/DOCUMENTATION.md" "templates/project/docs/DOCUMENTATION.md"
sync_file "INSTALL.md" "templates/project/INSTALL.md"
sync_file "scripts/check-runtime.sh" "templates/project/scripts/check-runtime.sh"
sync_file "scripts/check-secrets.sh" "templates/project/scripts/check-secrets.sh"
sync_file "scripts/check-ai-project.sh" "templates/project/scripts/check-ai-project.sh"
sync_file "scripts/ai-project.sh" "templates/project/scripts/ai-project.sh"
sync_file "scripts/add-project-docs.sh" "templates/project/scripts/add-project-docs.sh"
sync_file "scripts/install-adapter.sh" "templates/project/scripts/install-adapter.sh"
sync_file "scripts/build-project-graph.sh" "templates/project/scripts/build-project-graph.sh"

echo "template runtime sync complete"
