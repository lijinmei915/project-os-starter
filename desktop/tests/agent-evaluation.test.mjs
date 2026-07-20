import assert from "node:assert/strict";
import test from "node:test";
import { summarizeAgentEvaluation, validateAgentEvaluationResults } from "../src/agent-runtime/evaluation.js";

test("reports incomplete evaluation honestly and aggregates completed evidence", () => {
  const report = summarizeAgentEvaluation({
    generatedAt: "2026-07-19T00:00:00Z",
    cases: [{ id: "a", expected: ["patch", "check"] }, { id: "b", expected: ["rejected"] }],
    results: [{ caseId: "a", success: true, patchApplicable: true, checksPassed: true, recovered: false, approvalCount: 1, durationMs: 200, costUsd: 0.02, execution: { executor: "hermes-acp", fixture: "/tmp/a", executedAt: "2026-07-19T00:00:00Z", tracePath: "/tmp/a/trace.json" } }]
  });
  assert.equal(report.status, "incomplete");
  assert.equal(report.totals.missing, 1);
  assert.equal(report.metrics.taskSuccessRate, 1);
  assert.equal(report.metrics.approvalCount, 1);
  assert.equal(report.metrics.totalCostUsd, 0.02);
  assert.equal(report.metrics.patchApplicableRate, 1);
});

test("rejects evaluation records without executor evidence or with duplicate cases", () => {
  const result = { caseId: "a", success: true, patchApplicable: true, checksPassed: true, recovered: false, approvalCount: 0, durationMs: 1, costUsd: 0 };
  assert.throws(() => validateAgentEvaluationResults({ cases: [{ id: "a" }], results: [result] }), /真实执行证据/);
  result.execution = { executor: "hermes-acp", fixture: "/tmp/a", executedAt: "now", tracePath: "/tmp/trace" };
  assert.throws(() => validateAgentEvaluationResults({ cases: [{ id: "a" }], results: [result, result] }), /重复/);
});

test("accepts Gateway evidence for deterministic safety cases", () => {
  const result = { caseId: "unsafe-path", success: true, patchApplicable: false, checksPassed: true, recovered: false, approvalCount: 0, durationMs: 1, costUsd: 0, execution: { executor: "omnidesk-tool-gateway", fixture: "/tmp/a", executedAt: "now", tracePath: "/tmp/trace" } };
  assert.equal(validateAgentEvaluationResults({ cases: [{ id: "unsafe-path" }], results: [result] }).length, 1);
});

test("accepts local Runtime evidence for state-machine recovery cases", () => {
  const result = { caseId: "interrupted-run", success: true, patchApplicable: false, checksPassed: true, recovered: true, approvalCount: 0, durationMs: 1, costUsd: 0, execution: { executor: "omnidesk-runtime", fixture: "/tmp/a", executedAt: "now", tracePath: "/tmp/trace" } };
  assert.equal(validateAgentEvaluationResults({ cases: [{ id: "interrupted-run" }], results: [result] }).length, 1);
});
