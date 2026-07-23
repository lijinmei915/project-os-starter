import assert from "node:assert/strict";
import test from "node:test";
import {
  actionLabel,
  governanceFileHealthLabel,
  governanceFileHealthSummary,
  governanceFileStatusLabel,
  governanceStatusSummaryText,
  statusLabel,
} from "../src/lib/governance-presentation.js";

test("maps workspace and governance state to stable user labels", () => {
  assert.equal(statusLabel("needs-review"), "待审阅");
  assert.equal(actionLabel("keep-readonly"), "仅预览");
  assert.equal(governanceFileStatusLabel("generated"), "生成记录");
  assert.equal(governanceFileHealthLabel("ignored"), "规则/目录");
});

test("summarizes explicit and inferred governance file health", () => {
  const summary = governanceFileHealthSummary([
    { fileStatuses: [{ status: "found" }, { status: "changed" }, { status: "missing" }] },
    { files: ["docs/", "AGENTS.md"] },
  ]);
  assert.deepEqual(summary, {
    found: 2,
    missing: 1,
    changed: 1,
    stale: 0,
    generated: 0,
    ignored: 1,
    total: 5,
    riskCount: 2,
    status: "watch",
    label: "2 项需关注",
  });
  assert.equal(governanceStatusSummaryText(summary), "2 found / 1 changed / 1 missing / 1 ignored");
  assert.equal(governanceStatusSummaryText(null, 3), "3 个文件");
});
