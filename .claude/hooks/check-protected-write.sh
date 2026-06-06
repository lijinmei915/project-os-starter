#!/usr/bin/env bash
# PreToolUse — AI 文件写入门禁 v1.0
# 规则来源：.ai/safety/write-policy.json（不再硬编码，由契约文件驱动）
# 三类边界：forbidden(硬拦截) / protected(需确认+自动备份) / readonly(软提醒)
# 解锁 protected：用户确认后 touch /tmp/project_write_confirmed

inp=$(cat)
fp=$(echo "$inp" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[[ -z "$fp" ]] && exit 0

# 找 write-policy.json
policy=""
for candidate in \
  ".ai/safety/write-policy.json" \
  "$(git rev-parse --show-toplevel 2>/dev/null)/.ai/safety/write-policy.json"
do
  [ -f "$candidate" ] && policy="$candidate" && break
done

# 没有契约文件：硬编码兜底
if [ -z "$policy" ]; then
  if [[ "$fp" =~ /memory/ ]] || [[ "$fp" =~ /docs/ ]] || [[ "$fp" =~ \.md$ ]]; then
    if [ ! -f /tmp/project_write_confirmed ]; then
      echo "⚠️  拦截：准备写入保护文件 → $fp（未找到 write-policy.json，使用默认规则）" >&2
      echo "请先告知用户要改什么，确认后执行：touch /tmp/project_write_confirmed" >&2
      exit 2
    fi
  fi
  exit 0
fi

# 用 python3 做 glob 模式匹配
match_result=$(python3 - "$fp" "$policy" <<'PY'
import json, sys, fnmatch, os
fp   = sys.argv[1]
pol  = json.load(open(sys.argv[2], encoding="utf-8"))
fp_n = fp.lstrip('./')

def matches(fp, patterns):
    for pat in patterns:
        pat_n = pat.lstrip('./')
        if fnmatch.fnmatch(fp_n, pat_n): return True
        if fnmatch.fnmatch(os.path.basename(fp_n), pat_n): return True
    return False

policies = pol.get("policies", {})
if matches(fp, policies.get("forbidden", {}).get("patterns", [])):
    print("forbidden")
elif matches(fp, policies.get("protected", {}).get("patterns", [])):
    print("protected")
elif matches(fp, policies.get("readonly", {}).get("patterns", [])):
    print("readonly")
else:
    print("allowed")
PY
)

case "$match_result" in
  forbidden)
    echo "🚫 禁止：$fp 属于禁区，不允许任何写入。" >&2
    echo "如需修改规则，请编辑 .ai/safety/write-policy.json 的 forbidden 列表。" >&2
    exit 2
    ;;
  protected)
    if [ -f /tmp/project_write_confirmed ]; then
      # 已确认：写入前自动备份原文件
      if [ -f "$fp" ]; then
        backup_dir=".project-os/backups"
        mkdir -p "$backup_dir"
        ts="$(date +%Y%m%d_%H%M%S)"
        safe_name="$(echo "$fp" | tr '/' '_')"
        cp "$fp" "$backup_dir/${safe_name}.${ts}.bak" 2>/dev/null || true
      fi
      exit 0
    else
      echo "⚠️  需要确认：准备写入受保护文件 → $fp" >&2
      echo "" >&2
      echo "请先告诉用户：要改这个文件的什么内容、为什么改。" >&2
      echo "得到用户明确同意后，执行以下命令解锁，然后重试：" >&2
      echo "  touch /tmp/project_write_confirmed" >&2
      exit 2
    fi
    ;;
  readonly)
    echo "💡 提醒：$fp 是系统生成物，建议通过对应脚本生成而非直接修改。" >&2
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
