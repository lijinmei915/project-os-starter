import assert from "node:assert/strict";
import test from "node:test";

import { buildDirectAgentTaskPlan, prepareDirectAgentTask } from "../src/lib/direct-agent-task.js";

test("builds a deterministic Agent task without asking a Provider for a plan", () => {
  const plan = buildDirectAgentTaskPlan({ task: "检查当前项目还有哪些风险" }, { projectName: "OmniDesk" });
  assert.equal(plan.mode, "agent-task");
  assert.equal(plan.summary, "检查当前项目还有哪些风险");
  assert.equal(plan.projectName, "OmniDesk");
  assert.match(plan.trace[0], /DIRECT_AGENT_ENTRY/);
  assert.match(plan.guardrails.join(" "), /分别获得批准/);
});

test("persists the local task before returning it to the Agent executor", async () => {
  const calls = [];
  const result = await prepareDirectAgentTask({
    commandInput: { task: "审查当前改动" },
    createTask: (input) => ({ id: "task-direct", title: input.task }),
    isActive: () => true,
    persistTask: async (task, options) => {
      calls.push({ options, task });
      return { ...task, persisted: true };
    },
    requestId: "request-direct",
  });
  assert.equal(result.status, "succeeded");
  assert.equal(result.task.persisted, true);
  assert.deepEqual(calls[0].options, { durable: true });
});

test("does not persist or start a task after its request was cancelled", async () => {
  let persisted = false;
  const result = await prepareDirectAgentTask({
    commandInput: { task: "分析模块" },
    createTask: () => ({ id: "task-cancelled" }),
    isActive: () => false,
    persistTask: async () => { persisted = true; },
    requestId: "request-cancelled",
  });
  assert.equal(result.status, "cancelled");
  assert.equal(persisted, false);
});
