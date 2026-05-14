#!/usr/bin/env bash
set -euo pipefail

target="."
source_root="${PROJECT_OS_SOURCE:-}"
profile=""
include_design=0
include_skills=0
include_adapters=0
target_set=0

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/install-project-os.sh [target] [--profile core|product|full]

Profiles:
  core     AGENTS.md, PROJECT.md, HANDOFF.md, scripts/check-runtime.sh
  product  core + README/INSTALL + lightweight governance docs
  full     product + design docs + Claude runtime + adapters

Options:
  --with-design    Add docs/DESIGN_STANDARDS.md and docs/design/
  --with-skills    Add .claude skills, commands, and project config
  --with-adapters  Add adapters/ and scripts/install-adapter.sh
  -h, --help       Show this help

Examples:
  bash scripts/install-project-os.sh . --profile core
  bash scripts/install-project-os.sh . --profile product --with-design
  bash scripts/install-project-os.sh . --profile full
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
    --with-design)
      include_design=1
      shift
      ;;
    --with-skills)
      include_skills=1
      shift
      ;;
    --with-adapters)
      include_adapters=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
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

if [ "$#" -gt 0 ]; then
  if [ "$target_set" -eq 1 ]; then
    echo "ERROR: unexpected argument: $1"
    usage
    exit 2
  fi
  target="$1"
fi

log() {
  echo "Project OS installer: $*"
}

ask_yes_no() {
  prompt="$1"
  default="$2"
  answer=""

  read -r -p "$prompt " answer || answer=""
  if [ -z "$answer" ]; then
    answer="$default"
  fi

  case "$answer" in
    y|Y|yes|YES|Yes)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

choose_interactive_profile() {
  choice=""

  echo "Project OS installer: choose install profile"
  echo "1. 纯工具库 / 轻量项目 -> core"
  echo "2. 产品项目 -> product"
  echo "3. 不确定 -> core"
  read -r -p "这个项目是？ [1/2/3] " choice || choice=""

  case "$choice" in
    2)
      profile="product"
      ;;
    *)
      profile="core"
      ;;
  esac

  if ask_yes_no "需要设计规范？ [y/N]" "N"; then
    include_design=1
  fi
  if ask_yes_no "需要复杂 AI flows / skills？ [y/N]" "N"; then
    include_skills=1
  fi
  if ask_yes_no "需要跨 AI 工具 adapters？ [y/N]" "N"; then
    include_adapters=1
  fi
}

if [ -z "$profile" ]; then
  if [ -t 0 ] && [ -t 1 ]; then
    choose_interactive_profile
  else
    profile="core"
  fi
fi

case "$profile" in
  core|product|full)
    ;;
  *)
    echo "ERROR: unknown profile: $profile"
    usage
    exit 2
    ;;
esac

if [ -z "$source_root" ]; then
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source_root="$(cd "$script_dir/.." && pwd)"
fi

if [ ! -d "$target" ]; then
  echo "ERROR: target directory not found: $target"
  exit 2
fi

if [ ! -d "$source_root" ]; then
  echo "ERROR: source directory not found: $source_root"
  exit 2
fi

target_abs="$(cd "$target" && pwd)"
source_abs="$(cd "$source_root" && pwd)"
timestamp="$(date +%Y%m%d-%H%M%S)"
backup_root="$target_abs/.project-os/backups/$timestamp"
template_root="$source_abs/templates/project"

installed=0
backed_up=0
documentation_installed=0

if [ "$source_abs" = "$target_abs" ]; then
  log "source and target are the same directory"
  log "nothing to install; run 'bash scripts/check-runtime.sh .' to check this Project OS repo"
  exit 0
fi

backup_existing() {
  relative_path="$1"
  dest="$target_abs/$relative_path"

  if [ -e "$dest" ] || [ -L "$dest" ]; then
    backup_dest="$backup_root/$relative_path"
    mkdir -p "$(dirname "$backup_dest")"
    cp -R "$dest" "$backup_dest"
    backed_up=$((backed_up + 1))
  fi
}

copy_file_from() {
  source_path="$1"
  relative_path="$2"
  dest="$target_abs/$relative_path"

  if [ ! -f "$source_path" ]; then
    log "skip missing source file: $source_path"
    return
  fi

  backup_existing "$relative_path"
  mkdir -p "$(dirname "$dest")"
  cp "$source_path" "$dest"
  installed=$((installed + 1))
  log "installed file: $relative_path"
}

copy_dir_from() {
  source_path="$1"
  relative_path="$2"
  dest="$target_abs/$relative_path"

  if [ ! -d "$source_path" ]; then
    log "skip missing source directory: $source_path"
    return
  fi

  backup_existing "$relative_path"
  mkdir -p "$dest"
  cp -R "$source_path/." "$dest/"
  installed=$((installed + 1))
  log "installed directory: $relative_path"
}

install_file() {
  relative_path="$1"
  copy_file_from "$template_root/$relative_path" "$relative_path"
}

install_dir() {
  relative_path="$1"
  copy_dir_from "$template_root/$relative_path" "$relative_path"
}

install_core() {
  install_file "AGENTS.md"
  install_file "PROJECT.md"
  install_file "HANDOFF.md"
  install_file "scripts/check-runtime.sh"
}

install_documentation_doc() {
  if [ "$documentation_installed" -eq 0 ]; then
    install_file "docs/DOCUMENTATION.md"
    documentation_installed=1
  fi
}

install_product_docs() {
  install_file "README.md"
  install_file "INSTALL.md"
  install_documentation_doc
  install_file "docs/CHANGELOG.md"
  install_file "docs/DECISIONS.md"
  install_file "docs/LESSONS.md"
}

install_design_docs() {
  install_documentation_doc
  install_file "docs/DESIGN_STANDARDS.md"
  install_dir "docs/design"
}

install_full_docs() {
  install_file "docs/TESTING.md"
  install_file "docs/PRODUCT_PLAN.md"
  install_file "docs/CODE_STRUCTURE.md"
}

install_claude_runtime() {
  install_file ".claude/project.json"
  install_dir ".claude/skills"
  install_dir ".claude/commands"
}

install_claude_hooks() {
  install_dir ".claude/hooks"
}

install_adapter_runtime() {
  install_dir "adapters"
  install_file "scripts/install-adapter.sh"
}

log "source: $source_abs"
log "target: $target_abs"
log "profile: $profile"

install_core

case "$profile" in
  product)
    install_product_docs
    ;;
  full)
    include_design=1
    include_skills=1
    include_adapters=1
    install_product_docs
    install_full_docs
    install_claude_hooks
    ;;
esac

if [ "$include_design" -eq 1 ]; then
  install_design_docs
fi

if [ "$include_skills" -eq 1 ]; then
  install_claude_runtime
fi

if [ "$include_adapters" -eq 1 ]; then
  install_adapter_runtime
fi

if [ -f "$target_abs/.gitignore" ]; then
  if ! grep -q '^\.DS_Store$' "$target_abs/.gitignore"; then
    printf '\n.DS_Store\n' >> "$target_abs/.gitignore"
    log "updated .gitignore: added .DS_Store"
  fi
else
  printf '.DS_Store\n' > "$target_abs/.gitignore"
  log "created .gitignore"
fi

log "installed items: $installed"

if [ "$backed_up" -gt 0 ]; then
  log "backed up existing items: $backed_up"
  log "backup location: $backup_root"
fi

log "next: run 'bash scripts/check-runtime.sh .'"
