#!/usr/bin/env bash
set -euo pipefail

target="."
profile="product"
force=0
target_set=0

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/add-project-docs.sh [target] [--profile product|design|all] [--force]

Adds optional AI engineering document templates to a project.
Existing files are skipped by default.

Profiles:
  product  Add docs/DOCUMENTATION, NAMING, ARCHITECTURE, ENVIRONMENT,
           TESTING, RUNBOOK, CHANGELOG, DECISIONS, and LESSONS
  design   Add docs/DESIGN_STANDARDS
  all      Add product + design docs

Options:
  --force  Back up and overwrite existing files
  -h, --help  Show this help

Examples:
  bash scripts/add-project-docs.sh .
  bash scripts/add-project-docs.sh . --profile all
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile)
      if [ "$#" -lt 2 ]; then
        echo "ERROR: --profile requires a value"
        exit 2
      fi
      profile="$2"
      shift 2
      ;;
    --profile=*)
      profile="${1#--profile=}"
      shift
      ;;
    --force)
      force=1
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
      if [ "$target_set" -eq 1 ]; then
        echo "ERROR: unexpected argument: $1"
        usage
        exit 2
      fi
      target="$1"
      target_set=1
      shift
      ;;
  esac
done

case "$profile" in
  product|design|all)
    ;;
  *)
    echo "ERROR: unknown profile: $profile"
    usage
    exit 2
    ;;
esac

if [ ! -d "$target" ]; then
  echo "ERROR: target directory not found: $target"
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_root="$(cd "$script_dir/.." && pwd)"
target_abs="$(cd "$target" && pwd)"
timestamp="$(date +%Y%m%d-%H%M%S)"
backup_root="$target_abs/.project-os/backups/add-docs-$timestamp"
template_root="${PROJECT_OS_DOC_TEMPLATE_DIR:-}"

if [ -z "$template_root" ]; then
  if [ -d "$source_root/templates/project-docs/docs" ]; then
    template_root="$source_root/templates/project-docs"
  elif [ -d "$source_root/templates/project/docs" ]; then
    template_root="$source_root/templates/project"
  else
    echo "ERROR: document templates not found"
    echo "Expected: templates/project-docs/docs"
    exit 2
  fi
fi

installed=0
skipped=0
backed_up=0

log() {
  echo "Project OS docs: $*"
}

copy_doc() {
  relative_path="$1"
  source_path="$template_root/$relative_path"
  dest="$target_abs/$relative_path"

  if [ ! -f "$source_path" ]; then
    log "skip missing template: $relative_path"
    return
  fi

  if [ -e "$dest" ] && [ "$force" -eq 0 ]; then
    skipped=$((skipped + 1))
    log "skip existing: $relative_path"
    return
  fi

  if [ -e "$dest" ]; then
    backup_dest="$backup_root/$relative_path"
    mkdir -p "$(dirname "$backup_dest")"
    cp "$dest" "$backup_dest"
    backed_up=$((backed_up + 1))
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$source_path" "$dest"
  installed=$((installed + 1))
  log "installed: $relative_path"
}

install_product_docs() {
  copy_doc ".env.example"
  copy_doc "docs/DOCUMENTATION.md"
  copy_doc "docs/NAMING.md"
  copy_doc "docs/ARCHITECTURE.md"
  copy_doc "docs/ENVIRONMENT.md"
  copy_doc "docs/TESTING.md"
  copy_doc "docs/RUNBOOK.md"
  copy_doc "docs/CHANGELOG.md"
  copy_doc "docs/DECISIONS.md"
  copy_doc "docs/LESSONS.md"
}

install_design_docs() {
  copy_doc "docs/DESIGN_STANDARDS.md"
}

case "$profile" in
  product)
    install_product_docs
    ;;
  design)
    install_design_docs
    ;;
  all)
    install_product_docs
    install_design_docs
    ;;
esac

log "completed: installed=$installed skipped=$skipped backed_up=$backed_up"
log "next: bash scripts/ai-project.sh report ."
