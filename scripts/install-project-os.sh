#!/usr/bin/env bash
set -euo pipefail

target="."
source_root="${PROJECT_OS_SOURCE:-}"
profile=""
upgrade=0
include_design=0
include_skills=0
include_adapters=0
target_set=0

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/install-project-os.sh [target] [--profile core|product|full]

Profiles:
  core     AGENTS.md, PROJECT.md, HANDOFF.md, check scripts
  product  core + README/INSTALL + AI engineering governance docs
  full     product + design docs + Claude runtime + adapters

Options:
  --upgrade        Upgrade an existing install; skip files modified since last install
  --with-design    Add docs/DESIGN_STANDARDS.md and docs/design/
  --with-skills    Add .claude skills, commands, and project config
  --with-adapters  Add adapters/ and scripts/install-adapter.sh
  -h, --help       Show this help

Examples:
  bash scripts/install-project-os.sh . --profile core
  bash scripts/install-project-os.sh . --profile product --with-design
  bash scripts/install-project-os.sh . --profile full
  bash scripts/install-project-os.sh . --profile core --upgrade
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
    --upgrade)
      upgrade=1
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
  echo "1. 新项目 / 只需基础 AI 协作规范 -> core"
  echo "2. 有产品规划和治理文档需求的项目 -> product"
  echo "3. 需要完整 AI 工具能力（skills / hooks / adapters）-> full"
  echo "4. 不确定，先装最小集合 -> core"
  read -r -p "这个项目是？ [1/2/3/4] " choice || choice=""

  case "$choice" in
    2)
      profile="product"
      ;;
    3)
      profile="full"
      ;;
    *)
      profile="core"
      ;;
  esac

  if ask_yes_no "需要设计规范？ [y/N]" "N"; then
    include_design=1
  fi
  if ask_yes_no "需要 Claude skills / hooks？ [y/N]" "N"; then
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
checksums_file="$target_abs/.project-os/checksums"

installed=0
skipped=0
backed_up=0
documentation_installed=0

if [ "$source_abs" = "$target_abs" ]; then
  log "source and target are the same directory"
  log "nothing to install; run 'bash scripts/check-runtime.sh .' to check this Project OS repo"
  exit 0
fi

md5_file() {
  if command -v md5sum >/dev/null 2>&1; then
    md5sum "$1" 2>/dev/null | cut -d' ' -f1
  else
    md5 -q "$1" 2>/dev/null
  fi
}

stored_md5() {
  relative_path="$1"
  [ -f "$checksums_file" ] && grep -F "  $relative_path" "$checksums_file" | head -1 | cut -d' ' -f1 || echo ""
}

record_md5() {
  relative_path="$1"
  dest="$target_abs/$relative_path"
  [ -f "$dest" ] || return
  m="$(md5_file "$dest")"
  [ -n "$m" ] || return
  mkdir -p "$(dirname "$checksums_file")"
  if [ -f "$checksums_file" ]; then
    tmp="$(mktemp)"
    grep -Fv "  $relative_path" "$checksums_file" > "$tmp" || true
    mv "$tmp" "$checksums_file"
  fi
  printf '%s  %s\n' "$m" "$relative_path" >> "$checksums_file"
}

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

  if [ "$upgrade" -eq 1 ] && [ -f "$dest" ]; then
    stored="$(stored_md5 "$relative_path")"
    current="$(md5_file "$dest")"
    if [ -z "$stored" ] || [ "$stored" != "$current" ]; then
      skipped=$((skipped + 1))
      log "skip (modified): $relative_path"
      return
    fi
  fi

  backup_existing "$relative_path"
  mkdir -p "$(dirname "$dest")"
  cp "$source_path" "$dest"
  installed=$((installed + 1))
  log "installed file: $relative_path"
  record_md5 "$relative_path"
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
  install_file ".env.example"
  install_file "AGENTS.md"
  install_file "PROJECT.md"
  install_file "HANDOFF.md"
  install_file "scripts/check-runtime.sh"
  install_file "scripts/check-secrets.sh"
  install_file "scripts/check-ai-project.sh"
  install_file "scripts/ai-project.sh"
  install_file "scripts/recommend-next.sh"
  install_file "scripts/add-project-docs.sh"
  install_file "scripts/build-project-graph.sh"
  install_file "scripts/check-frontend.sh"
  install_file "scripts/check-backend.sh"
  install_file "scripts/check-testing.sh"
  install_file "scripts/check-design.sh"
  install_file "scripts/sync-ai-rules.sh"
  install_file "scripts/auto-reflect.sh"
  install_file "scripts/optimize-rules.sh"
  install_file "schemas/ai-project-score.schema.json"
  install_file "schemas/ai-project-score.v0.2.json"
  install_file "schemas/ai-project-report.schema.json"
  install_file "schemas/ai-project-report.v0.1.json"
  install_file "index.html"
  install_file "kit"
  install_dir ".ai"
  install_dir "templates/project-docs"
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
  install_file "docs/NAMING.md"
  install_file "docs/ROUTING.md"
  install_file "docs/ARCHITECTURE.md"
  install_file "docs/ENVIRONMENT.md"
  install_file "docs/TESTING.md"
  install_file "docs/RUNBOOK.md"
  install_file "docs/CHANGELOG.md"
  install_file "docs/DECISIONS.md"
  install_file "docs/LESSONS.md"
  install_file "docs/FRONTEND.md"
  install_file "docs/BACKEND.md"
  install_file "docs/AUTO_GROWTH.md"
}

install_design_docs() {
  install_documentation_doc
  install_file "docs/DESIGN_STANDARDS.md"
  install_dir "docs/design"
}

install_full_docs() {
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
[ "$upgrade" -eq 1 ] && log "mode: upgrade"

# Fix 5: check template sync before installing
if [ -f "$source_abs/scripts/check-template-sync.sh" ]; then
  sync_out="$(bash "$source_abs/scripts/check-template-sync.sh" "$source_abs" 2>/dev/null || true)"
  if printf '%s\n' "$sync_out" | grep -q '^WARN:'; then
    log "WARNING: source templates may be out of sync with runtime"
    printf '%s\n' "$sync_out"
    log "consider running: bash scripts/sync-templates.sh ."
  fi
fi

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
  if ! grep -q '\.project-os/backups/' "$target_abs/.gitignore"; then
    printf '.project-os/backups/\n' >> "$target_abs/.gitignore"
    log "updated .gitignore: added .project-os/backups/"
  fi
  if ! grep -q '\.project-os/reports/' "$target_abs/.gitignore"; then
    printf '.project-os/reports/\n' >> "$target_abs/.gitignore"
    log "updated .gitignore: added .project-os/reports/"
  fi
else
  printf '.DS_Store\n.project-os/backups/\n.project-os/reports/\n' > "$target_abs/.gitignore"
  log "created .gitignore"
fi

# Write version record
version_val="$(cat "$source_abs/VERSION" 2>/dev/null || echo "unknown")"
version_file="$target_abs/.project-os/version"
mkdir -p "$(dirname "$version_file")"
printf 'version=%s\ninstalled=%s\nprofile=%s\n' \
  "$version_val" \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$profile" > "$version_file"

# Write machine-readable state (only on fresh install, not upgrade)
state_file="$target_abs/.project-os/state.json"
if [ "$upgrade" -eq 0 ] && [ ! -f "$state_file" ]; then
  cat > "$state_file" <<'STATE'
{
  "name": "",
  "description": "",
  "phase": "init",
  "stage": "",
  "status": {
    "done": [],
    "doing": [],
    "blocked": [],
    "next": []
  }
}
STATE
  log "created .project-os/state.json — fill in name, phase, stage, status"
fi

# 自动建立 AI 规则映射
if [ -f "$target_abs/scripts/sync-ai-rules.sh" ]; then
  bash "$target_abs/scripts/sync-ai-rules.sh" "$target_abs" > /dev/null 2>&1
  log "auto-synced AI rules to .ai/rules/"
fi

log "installed items: $installed"

if [ "$upgrade" -eq 1 ] && [ "$skipped" -gt 0 ]; then
  log "skipped (modified by user): $skipped — delete specific files and re-run to force-update"
fi

if [ "$backed_up" -gt 0 ]; then
  log "backed up existing items: $backed_up"
  log "backup location: $backup_root"
fi

log "version: $version_val"
log "next: run 'bash scripts/check-runtime.sh .'"
