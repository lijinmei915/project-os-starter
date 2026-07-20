import assert from "node:assert/strict";
import test from "node:test";

import { persistPatchApplyFailure } from "../src/lib/patch-apply-failure.js";

test("durably persists an Apply validation failure in applyResult", async () => {
  const calls = [];
  const task = { id: "task-apply-failed", status: "waiting approval" };
  const persisted = await persistPatchApplyFailure({
    finishedAt: "2026-07-14T08:00:00.000Z",
    message: "git apply --check failed",
    persistTask: async (nextTask, options) => {
      calls.push({ nextTask, options });
      return { ...nextTask, persisted: true };
    },
    task,
  });

  assert.deepEqual(calls, [{
    nextTask: {
      applyResult: {
        finishedAt: "2026-07-14T08:00:00.000Z",
        message: "git apply --check failed",
        success: false,
      },
      id: "task-apply-failed",
      status: "failed",
    },
    options: { durable: true },
  }]);
  assert.equal(persisted.persisted, true);
  assert.deepEqual(task, { id: "task-apply-failed", status: "waiting approval" });
});

test("keeps a successful Apply result when post-Apply verification throws", async () => {
  const calls = [];
  const task = {
    applyResult: {
      finishedAt: "2026-07-14T08:00:00.000Z",
      message: "patch applied",
      success: true,
    },
    id: "task-verification-failed",
    status: "running",
  };
  await persistPatchApplyFailure({
    finishedAt: "2026-07-14T08:01:00.000Z",
    message: "runtime check disconnected",
    persistTask: async (nextTask, options) => {
      calls.push({ nextTask, options });
      return nextTask;
    },
    task,
  });

  assert.deepEqual(calls, [{
    nextTask: {
      ...task,
      status: "failed",
      verificationSummary: "runtime check disconnected",
    },
    options: { durable: true },
  }]);
  assert.equal(calls[0].nextTask.applyResult, task.applyResult);
});
