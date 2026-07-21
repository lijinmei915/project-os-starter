import assert from "node:assert/strict";
import test from "node:test";

import { executePatchApplyWorkflow } from "../src/lib/patch-apply-executor.js";

function createHarness(overrides = {}) {
  const calls = [];
  const progress = [];
  const persistTask = async (task, options) => {
    calls.push({ id: "persist", options, task });
    return task;
  };
  return {
    calls,
    input: {
      applyPatch: async () => ({ message: "patch applied", success: true }),
      now: () => "2026-07-14T09:00:00.000Z",
      onCheckStart: (check) => calls.push({ check, id: "check-start" }),
      onProgress: (event) => progress.push(event),
      persistTask,
      runCheck: async (check) => ({ id: check.id, label: check.label, success: true }),
      task: { id: "task-1", plan: {}, status: "waiting approval" },
      writeRunSummary: async (task) => {
        calls.push({ id: "summary", task });
        return ".omnidesk/evidence/desktop-summary.md";
      },
      ...overrides,
    },
    progress,
  };
}

test("executes and durably persists an Apply workflow without checks", async () => {
  const harness = createHarness();
  const result = await executePatchApplyWorkflow(harness.input);

  assert.equal(result.success, true);
  assert.equal(result.task.status, "done");
  assert.equal(result.task.applyResult.success, true);
  assert.equal(result.task.runSummary, ".omnidesk/evidence/desktop-summary.md");
  assert.deepEqual(harness.calls.filter((call) => call.id === "persist").map((call) => call.options), [
    { durable: true },
    { durable: true },
  ]);
  assert.equal(harness.progress[0].outcome, "running");
  assert.equal(harness.progress.at(-1).outcome, "succeeded");
});

test("persists failed verification runs without treating Apply as failed", async () => {
  const checks = [
    { id: "runtime", label: "Runtime 检查" },
    { id: "docs", label: "文档检查" },
  ];
  const harness = createHarness({
    checks,
    runCheck: async (check) => ({ id: check.id, label: check.label, success: check.id === "runtime" }),
    task: { id: "task-2", plan: {}, runs: [{ id: "prior", success: true }], status: "waiting approval" },
  });
  const result = await executePatchApplyWorkflow(harness.input);

  assert.equal(result.success, false);
  assert.equal(result.error, undefined);
  assert.equal(result.task.applyResult.success, true);
  assert.equal(result.task.status, "repair pending");
  assert.equal(result.task.repair.remaining, 2);
  assert.equal(result.task.verificationSummary, "自动验证有失败项");
  assert.deepEqual(result.task.runs.map((run) => run.id), ["runtime", "docs", "prior"]);
  assert.deepEqual(harness.calls.filter((call) => call.id === "check-start").map((call) => call.check.id), ["runtime", "docs"]);
});

test("persists an Apply command exception as a failed applyResult", async () => {
  const harness = createHarness({
    applyPatch: async () => { throw new Error("git apply --check failed"); },
    task: { id: "task-3", status: "waiting approval" },
  });
  const result = await executePatchApplyWorkflow(harness.input);

  assert.equal(result.success, false);
  assert.equal(result.error, "git apply --check failed");
  assert.equal(result.task.status, "repair pending");
  assert.deepEqual(result.task.applyResult, {
    finishedAt: "2026-07-14T09:00:00.000Z",
    message: "git apply --check failed",
    success: false,
  });
});

test("keeps successful Apply evidence when a verification command throws", async () => {
  const harness = createHarness({
    checks: [{ id: "runtime", label: "Runtime 检查" }],
    runCheck: async () => { throw new Error("verification disconnected"); },
    task: { id: "task-4", status: "waiting approval" },
  });
  const result = await executePatchApplyWorkflow(harness.input);

  assert.equal(result.success, false);
  assert.equal(result.task.applyResult.success, true);
  assert.equal(result.task.status, "repair pending");
  assert.equal(result.task.verificationSummary, "verification disconnected");
});

test("exhausts the bounded repair budget after the second failed attempt", async () => {
  const harness = createHarness({
    checks: [{ id: "runtime", label: "Runtime 检查" }],
    runCheck: async () => ({ id: "runtime", label: "Runtime 检查", output: "still failing", success: false }),
    task: { id: "task-repair-limit", repair: { attempt: 2 }, status: "waiting repair approval" },
  });
  const result = await executePatchApplyWorkflow(harness.input);
  assert.equal(result.success, false);
  assert.equal(result.task.status, "repair failed");
  assert.equal(result.task.repair.remaining, 0);
  assert.equal(result.task.repair.phase, "failed");
});
