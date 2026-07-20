import assert from "node:assert/strict";
import test from "node:test";

import { executeGuardedCheckCommand, executeTaskGuardedCheckWorkflow } from "../src/lib/guarded-check-executor.js";

const runtimeCheck = {
  command: "bash scripts/check-runtime.sh .",
  id: "runtime",
  label: "基础检查",
};

test("preserves a successful guarded command result and feedback", async () => {
  const commandResult = { command: runtimeCheck.command, id: "runtime", output: "0 warnings", success: true };
  const execution = await executeGuardedCheckCommand({
    check: runtimeCheck,
    runCheck: async (checkId) => {
      assert.equal(checkId, "runtime");
      return commandResult;
    },
  });

  assert.equal(execution.result, commandResult);
  assert.equal(execution.feedback, "基础检查 通过。");
  assert.equal(execution.error, undefined);
});

test("normalizes a guarded command exception without changing the allowlisted command", async () => {
  const execution = await executeGuardedCheckCommand({
    check: runtimeCheck,
    runCheck: async () => { throw new Error("runner disconnected"); },
  });

  assert.equal(execution.error, "runner disconnected");
  assert.deepEqual(execution.result, {
    code: null,
    command: runtimeCheck.command,
    id: "runtime",
    label: "基础检查",
    output: "runner disconnected",
    success: false,
  });
});

test("rejects an unregistered check before invoking the runner", async () => {
  let runnerCalls = 0;
  const execution = await executeGuardedCheckCommand({
    check: null,
    runCheck: async () => {
      runnerCalls += 1;
    },
  });

  assert.equal(runnerCalls, 0);
  assert.equal(execution.error, "未注册的受控检查。");
  assert.equal(execution.result.success, false);
});

test("persists a successful task check and returns its conversation update", async () => {
  const persisted = [];
  const workflow = await executeTaskGuardedCheckWorkflow({
    check: runtimeCheck,
    executeCheck: async () => ({ id: "runtime", output: "passed", success: true }),
    now: () => "2026-07-14T10:00:00.000Z",
    persistTask: async (task) => {
      persisted.push(task);
      return task;
    },
    task: { id: "task-1", requestId: "request-1", runs: [{ id: "prior" }], status: "running" },
  });

  assert.equal(workflow.task.status, "done");
  assert.deepEqual(workflow.task.runs.map((run) => run.id), ["runtime", "prior"]);
  assert.equal(workflow.task.runs[0].finishedAt, "2026-07-14T10:00:00.000Z");
  assert.equal(persisted.length, 1);
  assert.deepEqual(workflow.conversationUpdate, {
    events: [{ detail: "passed", id: "check-runtime", label: "基础检查", status: "done" }],
    outcome: "succeeded",
    requestId: "request-1",
    text: "基础检查 已通过。",
  });
});

test("persists a failed task check and projects a failed conversation outcome", async () => {
  const workflow = await executeTaskGuardedCheckWorkflow({
    check: runtimeCheck,
    executeCheck: async () => ({ id: "runtime", output: "1 warning", success: false }),
    now: () => "2026-07-14T10:01:00.000Z",
    persistTask: async (task) => task,
    task: { id: "task-2", requestId: "request-2", status: "running" },
  });

  assert.equal(workflow.task.status, "failed");
  assert.equal(workflow.conversationUpdate.outcome, "failed");
  assert.equal(workflow.conversationUpdate.events[0].status, "failed");
});

test("still executes a direct check when no task is available", async () => {
  let executions = 0;
  const workflow = await executeTaskGuardedCheckWorkflow({
    check: runtimeCheck,
    executeCheck: async () => {
      executions += 1;
      return { id: "runtime", success: true };
    },
    now: () => "unused",
    persistTask: async () => assert.fail("missing tasks must not be persisted"),
    task: null,
  });

  assert.equal(executions, 1);
  assert.equal(workflow.task, null);
  assert.equal(workflow.conversationUpdate, null);
});
