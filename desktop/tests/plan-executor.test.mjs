import assert from "node:assert/strict";
import test from "node:test";

import { executeReadonlyPlanWorkflow } from "../src/lib/plan-executor.js";

function timeoutError(message = "计划生成等待超时") {
  const error = new Error(message);
  error.code = "REQUEST_TIMEOUT";
  return error;
}

function createHarness(overrides = {}) {
  const calls = [];
  const progress = [];
  const commandInput = { attachments: [], task: "拆解任务" };
  return {
    calls,
    input: {
      buildLocalPlan: (input) => ({ source: "local", task: input.task }),
      commandInput,
      createTask: (plan) => ({ id: "task-1", plan, requestTrace: { persistedAt: "persisted" } }),
      generateRemotePlan: async (args) => {
        calls.push({ args, id: "remote" });
        return { source: "remote" };
      },
      isActive: () => true,
      onProgress: (event) => progress.push(event),
      persistTask: async (task, options) => {
        calls.push({ id: "persist", options, task });
        return task;
      },
      remote: false,
      requestId: "request-1",
      ...overrides,
    },
    progress,
  };
}

test("persists a local read-only plan without invoking the remote provider", async () => {
  const harness = createHarness();
  const result = await executeReadonlyPlanWorkflow(harness.input);

  assert.equal(result.status, "succeeded");
  assert.equal(result.task.plan.source, "local");
  assert.equal(result.persistedAt, "persisted");
  assert.deepEqual(harness.calls.map((call) => call.id), ["persist"]);
  assert.deepEqual(harness.calls[0].options, { durable: true });
  assert.deepEqual(harness.progress.map((event) => event.stage), ["context", "generate", "persist"]);
});

test("lets the Rust Runtime own the remote planning deadline", async () => {
  const harness = createHarness({ remote: true });
  const result = await executeReadonlyPlanWorkflow(harness.input);

  assert.equal(result.task.plan.source, "remote");
  assert.deepEqual(harness.calls.map((call) => call.id), ["remote", "persist"]);
});

test("does not hide a Runtime timeout behind a local plan", async () => {
  const harness = createHarness({
    remote: true,
    generateRemotePlan: async () => { throw timeoutError(); },
  });
  const result = await executeReadonlyPlanWorkflow(harness.input);

  assert.equal(result.status, "timed-out");
  assert.equal(result.error, "计划生成等待超时");
  assert.equal(harness.calls.some((call) => call.id === "persist"), false);
});

test("retries an old backend with the legacy task argument and attachment note", async () => {
  let attempt = 0;
  const remoteCalls = [];
  const harness = createHarness({
    commandInput: { attachments: [{ name: "screen.png" }], task: "修改按钮" },
    generateRemotePlan: async (args) => {
      remoteCalls.push(args);
      attempt += 1;
      if (attempt === 1) throw new Error("generate_readonly_plan missing required key task");
      return { source: "legacy-remote" };
    },
    remote: true,
  });
  const result = await executeReadonlyPlanWorkflow(harness.input);

  assert.equal(result.status, "succeeded");
  assert.equal(result.task.plan.source, "legacy-remote");
  assert.deepEqual(remoteCalls[0], { input: harness.input.commandInput });
  assert.match(remoteCalls[1].task, /修改按钮/);
  assert.match(remoteCalls[1].task, /screen\.png/);
});

test("rejects a late plan result before task persistence", async () => {
  let active = true;
  let persistCalls = 0;
  const harness = createHarness({
    generateRemotePlan: async () => {
      active = false;
      return { source: "late" };
    },
    isActive: () => active,
    persistTask: async () => {
      persistCalls += 1;
    },
    remote: true,
  });
  const result = await executeReadonlyPlanWorkflow(harness.input);

  assert.equal(result.status, "cancelled");
  assert.equal(persistCalls, 0);
});

test("returns a timed-out terminal outcome when the legacy retry times out", async () => {
  let attempt = 0;
  const harness = createHarness({
    generateRemotePlan: async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("generate_readonly_plan missing required key task");
      throw timeoutError();
    },
    remote: true,
  });
  const result = await executeReadonlyPlanWorkflow(harness.input);

  assert.equal(result.status, "timed-out");
  assert.equal(result.error, "计划生成等待超时");
});

test("returns a failed terminal outcome for a non-compatible provider error", async () => {
  const harness = createHarness({
    generateRemotePlan: async () => { throw new Error("provider disconnected"); },
    remote: true,
  });
  const result = await executeReadonlyPlanWorkflow(harness.input);

  assert.equal(result.status, "failed");
  assert.equal(result.error, "provider disconnected");
});
