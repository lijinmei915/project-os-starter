import assert from "node:assert/strict";
import test from "node:test";
import { executePatchApplyWorkflow } from "../src/lib/patch-apply-executor.js";
import { executePatchDraftWorkflow } from "../src/lib/patch-draft-executor.js";

test("keeps patch, approval, failed check, repair, and final verification on one task timeline", async () => {
  const saved = [];
  const persistTask = async (task) => {
    saved.push(task);
    return task;
  };
  const initial = await executePatchDraftWorkflow({
    generatePatch: async () => ({ allowedFiles: ["src/example.js"], diff: "--- a/src/example.js\n+++ b/src/example.js\n@@ -1 +1 @@\n-old\n+new\n" }),
    persistTask,
    task: { id: "task-production-loop", plan: {}, status: "running" },
  });
  assert.equal(initial.task.status, "waiting approval");

  const failedCheck = await executePatchApplyWorkflow({
    applyPatch: async () => ({ success: true }),
    checks: [{ id: "test", label: "测试" }],
    now: () => "2026-07-20T00:00:00.000Z",
    persistTask,
    runCheck: async () => ({ id: "test", label: "测试", output: "expected true", success: false }),
    task: initial.task,
    writeRunSummary: async () => ".project-os/runs/desktop-summary.md",
  });
  assert.equal(failedCheck.task.status, "repair pending");
  assert.equal(failedCheck.task.repair.remaining, 2);

  const repair = await executePatchDraftWorkflow({
    generatePatch: async () => ({ allowedFiles: ["src/example.js"], diff: "--- a/src/example.js\n+++ b/src/example.js\n@@ -1 +1 @@\n-new\n+fixed\n" }),
    persistTask,
    task: { ...failedCheck.task, repair: { ...failedCheck.task.repair, attempt: 1 } },
  });
  assert.equal(repair.task.status, "waiting repair approval");

  const completed = await executePatchApplyWorkflow({
    applyPatch: async () => ({ success: true }),
    checks: [{ id: "test", label: "测试" }],
    now: () => "2026-07-20T00:01:00.000Z",
    persistTask,
    runCheck: async () => ({ id: "test", label: "测试", success: true }),
    task: repair.task,
    writeRunSummary: async () => ".project-os/runs/desktop-summary.md",
  });
  assert.equal(completed.task.status, "done");
  assert.deepEqual(
    completed.task.executionEvidence.map((entry) => [entry.kind, entry.status]),
    [["draft", "ready"], ["apply", "succeeded"], ["check", "failed"], ["draft", "ready"], ["apply", "succeeded"], ["check", "succeeded"]],
  );
  assert.ok(saved.length >= 6);
});
