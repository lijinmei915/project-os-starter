import assert from "node:assert/strict";
import test from "node:test";

import { executePatchDraftWorkflow } from "../src/lib/patch-draft-executor.js";

test("durably persists a generated Patch Draft in waiting approval state", async () => {
  const calls = [];
  const patchDraft = { diff: "--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n" };
  const result = await executePatchDraftWorkflow({
    generatePatch: async (task) => {
      calls.push({ id: "generate", task });
      return patchDraft;
    },
    persistTask: async (task, options) => {
      calls.push({ id: "persist", options, task });
      return { ...task, persisted: true };
    },
    task: { id: "task-1", status: "running" },
  });

  assert.equal(result.success, true);
  assert.equal(result.task.status, "waiting approval");
  assert.equal(result.task.patchDraft, patchDraft);
  assert.equal(result.task.persisted, true);
  assert.deepEqual(calls[1].options, { durable: true });
});

test("keeps a repair draft on the source task and waits for a separate approval", async () => {
  const task = { id: "repair-1", repair: { attempt: 1, phase: "pending" }, status: "repair pending" };
  const result = await executePatchDraftWorkflow({
    generatePatch: async () => ({ allowedFiles: ["src/a.js"], diff: "--- a/src/a.js\n+++ b/src/a.js\n@@ -1 +1 @@\n-old\n+new\n", files: ["src/a.js"] }),
    persistTask: async (value) => value,
    task,
  });
  assert.equal(result.success, true);
  assert.equal(result.task.status, "waiting repair approval");
  assert.equal(result.task.repair.attempt, 1);
  assert.equal(result.task.executionEvidence.at(-1).kind, "draft");
});

test("keeps a validation-only task out of the approval state", async () => {
  const result = await executePatchDraftWorkflow({
    generatePatch: async () => ({
      diff: "",
      failureReason: "任务计划明确不修改工程文件；当前应先运行检查。",
      notApplicable: true,
    }),
    persistTask: async (task) => task,
    task: { id: "check-1", status: "planned" },
  });

  assert.equal(result.success, false);
  assert.equal(result.error, "任务计划明确不修改工程文件；当前应先运行检查。");
  assert.equal(result.task.status, "planned");
  assert.equal(result.task.executionEvidence.at(-1).status, "not-applicable");
  assert.match(result.feedback, /未生成文件改动/);
});

test("rejects a generated Patch Draft when the request was superseded", async () => {
  let active = true;
  let persistCalls = 0;
  const result = await executePatchDraftWorkflow({
    generatePatch: async () => {
      active = false;
      return { diff: "late diff" };
    },
    isActive: () => active,
    persistTask: async () => {
      persistCalls += 1;
    },
    task: { id: "task-2", status: "running" },
  });

  assert.equal(result.cancelled, true);
  assert.equal(result.success, false);
  assert.equal(result.feedback, "改动草稿请求已被新方向取代。");
  assert.equal(persistCalls, 0);
});

test("settles a late Patch Draft error as cancellation without persisting", async () => {
  let active = true;
  let persistCalls = 0;
  const result = await executePatchDraftWorkflow({
    generatePatch: async () => {
      active = false;
      throw new Error("provider disconnected");
    },
    isActive: () => active,
    persistTask: async () => {
      persistCalls += 1;
    },
    task: { id: "task-3", status: "running" },
  });

  assert.equal(result.cancelled, true);
  assert.equal(result.error, undefined);
  assert.equal(persistCalls, 0);
});

test("returns an active Patch Draft generation error without changing the task", async () => {
  const task = { id: "task-4", status: "running" };
  const result = await executePatchDraftWorkflow({
    generatePatch: async () => { throw new Error("invalid provider response"); },
    isActive: () => true,
    persistTask: async () => assert.fail("failed drafts must not be persisted"),
    task,
  });

  assert.equal(result.success, false);
  assert.equal(result.error, "invalid provider response");
  assert.equal(result.task, task);
});
