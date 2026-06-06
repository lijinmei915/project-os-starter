#!/usr/bin/env bash

# build-repo-map.sh
# Phase 3 · 代码理解:对项目代码文件做符号提取，输出 repo-map.json。
# 让 build-project-graph.sh 从"只扫文件名"升级到"知道每个文件定义了什么函数、调用了什么"。
# 参考 Aider Repo Map 思路，零外部依赖实现 (shell/python/js)。
#
# 用法: bash scripts/build-repo-map.sh [target] [--stdout]
# 输出: .project-os/graph/repo-map.json  +  docs/data/repo-map.json

set -euo pipefail

target="."
stdout=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --stdout) stdout=1; shift ;;
    -*) echo "ERROR: unknown option: $1"; exit 2 ;;
    *) target="$1"; shift ;;
  esac
done

[ -d "$target" ] || { echo "ERROR: directory not found: $target"; exit 2; }
cd "$target" || exit 2

graph_dir=".project-os/graph"
mkdir -p "$graph_dir"
out_file="$graph_dir/repo-map.json"
tmp="$(mktemp)"
extractor="scripts/extract-symbols.py"

[ -f "$extractor" ] || { echo "ERROR: $extractor not found"; exit 1; }

generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 收集要解析的代码文件 (排除生成物和第三方)
files=()
while IFS= read -r f; do
  files+=("$f")
done < <(find . \
  -not -path './.git/*' \
  -not -path './node_modules/*' \
  -not -path './.project-os/*' \
  -not -path './dist/*' \
  \( -name '*.sh' -o -name '*.py' -o -name '*.ts' -o -name '*.mjs' -o -name '*.js' \) \
  | sed 's|^\./||' | sort)

total="${#files[@]}"
echo "Extracting symbols from $total files..." >&2

{
  printf '{\n'
  printf '  "schemaVersion": "repo-map.v0.1",\n'
  printf '  "generatedAt": "%s",\n' "$generated_at"
  printf '  "fileCount": %s,\n' "$total"
  printf '  "files": [\n'

  first=1
  for f in "${files[@]}"; do
    [ -f "$f" ] || continue
    result="$(python3 "$extractor" "$f" 2>/dev/null || echo '{"lang":"unknown","defines":[],"calls":[],"imports":[]}')"

    # 跳过无符号的文件 (减小体积)
    has_symbols="$(printf '%s' "$result" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('yes' if d.get('defines') or d.get('imports') else 'no')
" 2>/dev/null || echo 'no')"
    [ "$has_symbols" = "yes" ] || continue

    if [ "$first" -eq 0 ]; then printf ',\n'; fi
    first=0

    # 转义文件路径
    escaped_f="$(printf '%s' "$f" | sed 's/\\/\\\\/g; s/"/\\"/g')"
    printf '    {"id":"%s",%s}' "$escaped_f" "$(printf '%s' "$result" | python3 -c "
import json,sys
d=json.load(sys.stdin)
parts=[]
parts.append('\"lang\":\"%s\"' % d.get('lang',''))
parts.append('\"defines\":%s' % json.dumps(d.get('defines',[]),ensure_ascii=False))
parts.append('\"calls\":%s' % json.dumps(d.get('calls',[]),ensure_ascii=False))
parts.append('\"imports\":%s' % json.dumps(d.get('imports',[]),ensure_ascii=False))
print(','.join(parts))
" 2>/dev/null)"
  done

  printf '\n  ]\n'
  printf '}\n'
} > "$tmp"

entry_count="$(grep -c '"id"' "$tmp" 2>/dev/null || echo 0)"

if [ "$stdout" -eq 1 ]; then
  cat "$tmp"
  rm -f "$tmp"
else
  mv "$tmp" "$out_file"
  echo "Repo map written: $out_file"
  echo "Files with symbols: $entry_count / $total"
  if [ -d "docs/data" ]; then
    cp "$out_file" "docs/data/repo-map.json"
    echo "Page copy written: docs/data/repo-map.json"
  fi
fi
