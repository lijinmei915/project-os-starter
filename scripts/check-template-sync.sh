#!/usr/bin/env bash
set -u

target="."
strict=0

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/check-template-sync.sh [target] [--strict]

Checks whether source runtime files are in sync with templates/project.

Options:
  --strict  Exit 1 when any sync warning is found
  -h, --help  Show this help
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --strict)
      strict=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "ERROR: unknown option: $1"
      usage
      exit 2
      ;;
    *)
      if [ "$target" != "." ]; then
        echo "ERROR: unexpected argument: $1"
        usage
        exit 2
      fi
      target="$1"
      shift
      ;;
  esac
done

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

# .claude/commands and .claude/skills are intentionally different:
# source repo has full /os routing; template only ships generic skills.
# compare_path ".claude/commands" "templates/project/.claude/commands"
compare_path ".claude/hooks" "templates/project/.claude/hooks"
# compare_path ".claude/skills" "templates/project/.claude/skills"
compare_path ".claude/project.json" "templates/project/.claude/project.json"
# adapters are intentionally different: root has kit-specific routing, template is generic.
# compare_path "adapters" "templates/project/adapters"
compare_path "schemas" "templates/project/schemas"
compare_path ".env.example" "templates/project/.env.example"
compare_path "index.html" "templates/project/index.html"
compare_path "templates/project-docs" "templates/project/templates/project-docs"
compare_path "docs/data/doc-structure.manifest.json" "templates/project/docs/data/doc-structure.manifest.json"
compare_path "docs/design" "templates/project/docs/design"
# docs/DOCUMENTATION.md is intentionally different: root is kit-specific, template is generic.
# compare_path "docs/DOCUMENTATION.md" "templates/project/docs/DOCUMENTATION.md"
compare_path "INSTALL.md" "templates/project/INSTALL.md"
compare_path "scripts/check-runtime.sh" "templates/project/scripts/check-runtime.sh"
compare_path "scripts/check-all.sh" "templates/project/scripts/check-all.sh"
compare_path "scripts/check-frontmatter.sh" "templates/project/scripts/check-frontmatter.sh"
compare_path "scripts/check-file-contracts.sh" "templates/project/scripts/check-file-contracts.sh"
compare_path "scripts/check-doc-structure.sh" "templates/project/scripts/check-doc-structure.sh"
compare_path "scripts/check-secrets.sh" "templates/project/scripts/check-secrets.sh"
compare_path "scripts/check-ai-project.sh" "templates/project/scripts/check-ai-project.sh"
compare_path "scripts/project-runner.sh" "templates/project/scripts/project-runner.sh"
compare_path "scripts/ai-project.sh" "templates/project/scripts/ai-project.sh"
compare_path "scripts/exec" "templates/project/scripts/exec"
compare_path "scripts/validate" "templates/project/scripts/validate"
compare_path "scripts/cleanup" "templates/project/scripts/cleanup"
compare_path "scripts/prune-project-os-artifacts.sh" "templates/project/scripts/prune-project-os-artifacts.sh"
compare_path "scripts/build-project-os-cli.sh" "templates/project/scripts/build-project-os-cli.sh"
compare_path "scripts/recommend-next.sh" "templates/project/scripts/recommend-next.sh"
compare_path "scripts/add-project-docs.sh" "templates/project/scripts/add-project-docs.sh"
compare_path "scripts/build-project-graph.sh" "templates/project/scripts/build-project-graph.sh"
compare_path "scripts/install-adapter.sh" "templates/project/scripts/install-adapter.sh"

if [ "$warnings" -gt 0 ]; then
  echo "Run: bash scripts/sync-templates.sh"
  if [ "$strict" -eq 1 ]; then
    exit 1
  fi
fi

exit 0
