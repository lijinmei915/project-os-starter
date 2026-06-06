#!/usr/bin/env bash

# score-to-todo.sh
# Phase 1 · 治理闭环:把体检评分的缺口(GAP)回流成可执行 todo + AI 修复 prompt。
# 逻辑:读最新 ai-project-report.json → 合并 context/maturity 缺口 → 按分值(优先级)排序
#       → 写 gaps-todo.md → 输出给 AI 的 prompt,让 AI 把缺口转成具体修复步骤或判定不适用。
# 顺带:报告「反思新鲜度」(距上次 LESSONS.md 更新多久),作为定时反思的轻量提醒。
# 设计:沿用 auto-reflect / kb-just-ask 的「脚本备料 + AI 决策」模式。

set -euo pipefail

report_json=".project-os/reports/ai-project-report.json"
todo_file=".project-os/reports/gaps-todo.md"

if [ ! -f "$report_json" ]; then
  echo "ERROR: 体检报告不存在。请先运行: bash scripts/check-ai-project.sh . --write-report"
  exit 1
fi

# 反思新鲜度:距上次 LESSONS.md 改动的提交数
reflect_hint="(无 git 历史)"
if git rev-parse --git-dir >/dev/null 2>&1; then
  last_commit="$(git log -1 --format=%cr -- docs/LESSONS.md 2>/dev/null || true)"
  commits_since="$(git rev-list --count HEAD -- docs/LESSONS.md 2>/dev/null || echo '?')"
  total_commits="$(git rev-list --count HEAD 2>/dev/null || echo '?')"
  if [ -n "$last_commit" ]; then
    reflect_hint="LESSONS.md 上次更新:$last_commit;此后全仓共有改动需复盘的提交可由 auto-reflect 抓取"
  fi
fi

# 生成 todo 清单 + AI prompt
python3 - "$report_json" "$todo_file" "$reflect_hint" <<'PY'
import json, sys, datetime

report_path, todo_path, reflect_hint = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(report_path, encoding="utf-8"))

gaps = []
for g in d.get("contextGaps", []):
    gaps.append({**g, "kind": "上下文完整度"})
for g in d.get("maturityGaps", []):
    gaps.append({**g, "kind": "工程成熟度"})

# 按可得分值降序 = 修复优先级(补回来收益最大的排前面)
gaps.sort(key=lambda x: x.get("max", 0), reverse=True)

scores = d.get("scores", {})
ctx = scores.get("context", {})
mat = scores.get("maturity", {})

# 写 markdown todo 清单
lines = []
lines.append("# 体检缺口待办清单 (gaps-todo)")
lines.append("")
lines.append(f"> 生成时间:{datetime.datetime.now().isoformat(timespec='seconds')}")
lines.append(f"> 来源:`{report_path}`(由 check-ai-project.sh 评分回流)")
lines.append("")
lines.append(f"- 上下文完整度:**{ctx.get('score','?')}/{ctx.get('max','?')}** — {ctx.get('status','')}")
lines.append(f"- 工程成熟度:**{mat.get('score','?')}/{mat.get('max','?')}** — {mat.get('status','')}")
lines.append(f"- 反思新鲜度:{reflect_hint}")
lines.append("")
if not gaps:
    lines.append("✅ 当前无缺口,评分已满。")
else:
    lines.append(f"## 待办({len(gaps)} 项,按补回收益降序)")
    lines.append("")
    for i, g in enumerate(gaps, 1):
        pts = g.get("max", 0)
        lines.append(f"- [ ] **+{pts}分** [{g.get('kind','')}·{g.get('section','')}] {g.get('label','')}")
    lines.append("")

open(todo_path, "w", encoding="utf-8").write("\n".join(lines) + "\n")

# stdout:给 AI 的 prompt
print("🔁 [SCORE-TO-TODO · 评分回流]")
print("")
print(f"待办清单已写入:{todo_path}")
print("")
print("\n".join(lines))
print("## 你的任务")
print("1. 逐条把上面的缺口转成**具体可执行的修复步骤**(改哪个文件/跑什么命令)。")
print("2. 如果某条缺口**不适用本项目**(例如本仓是 Shell 项目,Lint/Test/npm 类缺口属评分模型对非 JS 项目的误报),直接标注「不适用 + 原因」,不要机械催促。")
print("3. 按「补回收益降序」给出建议处理顺序,标出哪些值得现在做、哪些可延后。")
print("4. 若反思新鲜度偏旧,提醒用户运行 `bash scripts/auto-reflect.sh` 沉淀近期改动。")
print("")
print("💡 立即开始分析并给出修复计划,不要等待用户进一步确认。")
PY
