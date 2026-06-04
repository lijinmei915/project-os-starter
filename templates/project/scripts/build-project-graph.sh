#!/usr/bin/env bash
set -euo pipefail

target="."
stdout=0
stale_days=90

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/build-project-graph.sh [target] [--stdout]

Builds a lightweight Project OS knowledge graph:
  - file nodes
  - document/script/schema/template layers
  - markdown/script/json references
  - .ai/rules symlink mappings

Output:
  .project-os/graph/project-graph.json
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --stdout)
      stdout=1
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

graph_dir=".project-os/graph"
graph_file="$graph_dir/project-graph.json"
tmp_dir="$(mktemp -d)"
files_file="$tmp_dir/files.txt"
nodes_file="$tmp_dir/nodes.tsv"
edges_file="$tmp_dir/edges.tsv"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

mkdir -p "$graph_dir"
: > "$files_file"
: > "$nodes_file"
: > "$edges_file"

add_file() {
  path="${1#./}"
  if [ -e "$path" ]; then
    printf '%s\n' "$path" >> "$files_file"
  fi
}

json_escape() {
  printf '%s' "$1" | awk 'BEGIN { ORS = "" } {
    gsub(/\\/, "\\\\")
    gsub(/"/, "\\\"")
    gsub(/\t/, "\\t")
    gsub(/\r/, "\\r")
    printf "%s", $0
  }'
}

layer_for() {
  case "$1" in
    AGENTS.md|PROJECT.md|HANDOFF.md|README.md|INSTALL.md|PRODUCT.md) printf 'root-doc' ;;
    docs/*) printf 'docs' ;;
    scripts/*|kit) printf 'scripts' ;;
    schemas/*) printf 'schemas' ;;
    templates/*) printf 'templates' ;;
    adapters/*) printf 'adapters' ;;
    .ai/*) printf 'ai-assets' ;;
    .agents/*) printf 'agent-skills' ;;
    .claude/*) printf 'claude-runtime' ;;
    tests/*) printf 'tests' ;;
    index.html) printf 'report-page' ;;
    *) printf 'other' ;;
  esac
}

kind_for() {
  case "$1" in
    *.md) printf 'markdown' ;;
    *.sh|kit) printf 'shell' ;;
    *.json) printf 'json' ;;
    *.html) printf 'html' ;;
    *.ts) printf 'typescript' ;;
    *.mjs) printf 'javascript' ;;
    *) printf 'file' ;;
  esac
}

is_template() {
  case "$1" in
    templates/*) printf 'true' ;;
    *) printf 'false' ;;
  esac
}

is_ssot() {
  case "$1" in
    AGENTS.md|PROJECT.md|HANDOFF.md|docs/DOCUMENTATION.md|docs/NAMING.md|docs/ARCHITECTURE.md|docs/ENVIRONMENT.md|docs/TESTING.md|docs/RUNBOOK.md|docs/DECISIONS.md|docs/LESSONS.md|schemas/*.json) printf 'true' ;;
    *) printf 'false' ;;
  esac
}

# --- Frontmatter parsing ---
# 从 .md 文件最顶部的 --- YAML --- 块提取一个字段的值。
# 用法: fm_field <file> <field>
fm_field() {
  file="$1"
  field="$2"
  case "$file" in
    *.md) ;;
    *) return 0 ;;
  esac
  [ "$(head -1 "$file" 2>/dev/null)" = "---" ] || return 0
  awk -v key="$field" '
    NR==1 && $0=="---" { infm=1; next }
    infm && $0=="---" { exit }
    infm {
      line=$0
      sub(/^[ \t]+/, "", line)
      if (index(line, key ":") == 1) {
        val=substr(line, length(key)+2)
        sub(/^[ \t]+/, "", val)
        sub(/[ \t]+$/, "", val)
        print val
        exit
      }
    }
  ' "$file" 2>/dev/null
}

# 计算 last_verified 距今天数；输出 stale 标记 true/false。
# 用法: compute_stale <last_verified-date>
compute_stale() {
  lv="$1"
  [ -n "$lv" ] || { printf 'false'; return 0; }
  lv_epoch="$(date -j -f '%Y-%m-%d' "$lv" '+%s' 2>/dev/null || date -d "$lv" '+%s' 2>/dev/null || echo '')"
  [ -n "$lv_epoch" ] || { printf 'false'; return 0; }
  now_epoch="$(date '+%s')"
  diff_days=$(( (now_epoch - lv_epoch) / 86400 ))
  if [ "$diff_days" -gt "$stale_days" ]; then
    printf 'true'
  else
    printf 'false'
  fi
}

resolve_link() {
  link_path="$1"
  raw_target="$(readlink "$link_path" 2>/dev/null || true)"
  [ -n "$raw_target" ] || return 0

  case "$raw_target" in
    /*)
      abs_target="$raw_target"
      ;;
    *)
      link_dir="$(dirname "$link_path")"
      target_dir="$(dirname "$raw_target")"
      target_base="$(basename "$raw_target")"
      abs_dir="$(cd "$link_dir" 2>/dev/null && cd "$target_dir" 2>/dev/null && pwd -P)" || return 0
      abs_target="$abs_dir/$target_base"
      ;;
  esac

  root_abs="$(pwd -P)"
  case "$abs_target" in
    "$root_abs"/*)
      printf '%s\n' "${abs_target#$root_abs/}"
      ;;
  esac
}

add_edge() {
  source="$1"
  target_path="$2"
  edge_type="$3"
  [ -n "$source" ] || return 0
  [ -n "$target_path" ] || return 0
  [ "$source" = "$target_path" ] && return 0
  printf '%s\t%s\t%s\n' "$source" "$target_path" "$edge_type" >> "$edges_file"
}

for file in README.md INSTALL.md AGENTS.md PROJECT.md HANDOFF.md PRODUCT.md index.html kit; do
  add_file "$file"
done

for dir in docs scripts schemas adapters .ai .agents .claude templates tests; do
  if [ -d "$dir" ]; then
    find "$dir" \( -type f -o -type l \) \( \
      -name '*.md' -o \
      -name '*.sh' -o \
      -name '*.json' -o \
      -name '*.html' -o \
      -name '*.ts' -o \
      -name '*.mjs' -o \
      -name 'kit' \
    \) -print >> "$files_file"
  fi
done

sort -u "$files_file" -o "$files_file"

while IFS= read -r file; do
  [ -n "$file" ] || continue

  kind="$(kind_for "$file")"
  layer="$(layer_for "$file")"
  template_flag="$(is_template "$file")"
  ssot_flag="$(is_ssot "$file")"
  executable_flag="false"
  if [ -x "$file" ]; then
    executable_flag="true"
  fi

  # --- Frontmatter 元数据 (机读) ---
  arch_layer="$(fm_field "$file" "layer")"
  doc_type="$(fm_field "$file" "type")"
  last_verified="$(fm_field "$file" "last_verified")"
  stale_flag="$(compute_stale "$last_verified")"

  # 无 frontmatter 时按文件类型/路径派生架构层，让架构图能完整显示
  if [ -z "$arch_layer" ]; then
    case "$file" in
      scripts/*|kit|.ai/skills/*) arch_layer="skills" ;;
      README.md|INSTALL.md|adapters/*|index.html) arch_layer="entry" ;;
      schemas/*) arch_layer="knowledge" ;;
    esac
  fi

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$file" "$kind" "$layer" "$template_flag" "$ssot_flag" "$executable_flag" \
    "$arch_layer" "$doc_type" "$last_verified" "$stale_flag" >> "$nodes_file"

  # --- depends_on 声明式依赖边 ---
  deps_raw="$(fm_field "$file" "depends_on")"
  if [ -n "$deps_raw" ]; then
    deps_clean="$(printf '%s' "$deps_raw" | tr -d '[]' | tr ',' '\n')"
    printf '%s\n' "$deps_clean" | while IFS= read -r dep; do
      dep="$(printf '%s' "$dep" | sed 's/^[ \t]*//;s/[ \t]*$//')"
      [ -n "$dep" ] || continue
      if [ -e "$dep" ]; then
        add_edge "$file" "$dep" "declares_dependency"
      fi
    done
  fi

  if [ -L "$file" ]; then
    resolved="$(resolve_link "$file")"
    if [ -n "$resolved" ] && [ -e "$resolved" ]; then
      add_edge "$file" "$resolved" "maps_to"
    fi
  fi

  if [ -f "$file" ]; then
    {
      grep -Eo '([[:alnum:]_.-]+/)*[[:alnum:]_.-]+\.(md|sh|json|html|ts|mjs)' "$file" 2>/dev/null || true
    } | sort -u | while IFS= read -r ref; do
      ref="${ref#./}"
      if [ -e "$ref" ]; then
        add_edge "$file" "$ref" "references"
      fi
    done
  fi
done < "$files_file"

sort -u "$edges_file" -o "$edges_file"

node_count="$(wc -l < "$nodes_file" | tr -d ' ')"
edge_count="$(wc -l < "$edges_file" | tr -d ' ')"
stale_count="$(awk -F'\t' '$10=="true"' "$nodes_file" | wc -l | tr -d ' ')"
generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
project_path="$(pwd)"
tmp_json="$tmp_dir/project-graph.json"

{
  printf '{\n'
  printf '  "schemaVersion": "project-graph.v0.2",\n'
  printf '  "generatedAt": "%s",\n' "$(json_escape "$generated_at")"
  printf '  "projectPath": "%s",\n' "$(json_escape "$project_path")"
  printf '  "staleDays": %s,\n' "$stale_days"
  printf '  "summary": {\n'
  printf '    "nodeCount": %s,\n' "$node_count"
  printf '    "edgeCount": %s,\n' "$edge_count"
  printf '    "staleCount": %s\n' "$stale_count"
  printf '  },\n'
  printf '  "nodes": [\n'
  first=1
  awk -F'\t' '
    function esc(s) {
      gsub(/\\/, "\\\\", s); gsub(/"/, "\\\"", s)
      gsub(/\t/, "\\t", s); gsub(/\r/, "\\r", s)
      return s
    }
    {
      if (NR > 1) printf ",\n"
      stale = ($10 == "true") ? "true" : "false"
      printf "    {\"id\":\"%s\",\"kind\":\"%s\",\"layer\":\"%s\",\"template\":%s,\"ssot\":%s,\"executable\":%s,\"archLayer\":\"%s\",\"docType\":\"%s\",\"lastVerified\":\"%s\",\"stale\":%s}", \
        esc($1), esc($2), esc($3), $4, $5, $6, esc($7), esc($8), esc($9), stale
    }
  ' "$nodes_file"
  printf '\n  ],\n'
  printf '  "edges": [\n'
  first=1
  while IFS="$(printf '\t')" read -r source target_path edge_type; do
    if [ "$first" -eq 0 ]; then
      printf ',\n'
    fi
    first=0
    printf '    {"source":"%s","target":"%s","type":"%s"}' \
      "$(json_escape "$source")" \
      "$(json_escape "$target_path")" \
      "$(json_escape "$edge_type")"
  done < "$edges_file"
  printf '\n  ]\n'
  printf '}\n'
} > "$tmp_json"

if [ "$stdout" -eq 1 ]; then
  cat "$tmp_json"
else
  mv "$tmp_json" "$graph_file"
  echo "Project graph written: $graph_file"
  echo "Nodes: $node_count"
  echo "Edges: $edge_count"
  # 额外输出一份给架构图页面读取（纳入 git，非 gitignore 的本地生成物）
  if [ -d "docs" ]; then
    mkdir -p "docs/data"
    cp "$graph_file" "docs/data/project-graph.json"
    echo "Page copy written: docs/data/project-graph.json"
  fi
fi
