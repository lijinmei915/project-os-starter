#!/usr/bin/env bash
set -euo pipefail

target="."
stdout=0

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

  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$file" "$kind" "$layer" "$template_flag" "$ssot_flag" "$executable_flag" >> "$nodes_file"

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
generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
project_path="$(pwd)"
tmp_json="$tmp_dir/project-graph.json"

{
  printf '{\n'
  printf '  "schemaVersion": "project-graph.v0.1",\n'
  printf '  "generatedAt": "%s",\n' "$(json_escape "$generated_at")"
  printf '  "projectPath": "%s",\n' "$(json_escape "$project_path")"
  printf '  "summary": {\n'
  printf '    "nodeCount": %s,\n' "$node_count"
  printf '    "edgeCount": %s\n' "$edge_count"
  printf '  },\n'
  printf '  "nodes": [\n'
  first=1
  while IFS="$(printf '\t')" read -r id kind layer template_flag ssot_flag executable_flag; do
    if [ "$first" -eq 0 ]; then
      printf ',\n'
    fi
    first=0
    printf '    {"id":"%s","kind":"%s","layer":"%s","template":%s,"ssot":%s,"executable":%s}' \
      "$(json_escape "$id")" \
      "$(json_escape "$kind")" \
      "$(json_escape "$layer")" \
      "$template_flag" \
      "$ssot_flag" \
      "$executable_flag"
  done < "$nodes_file"
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
fi
