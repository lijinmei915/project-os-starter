import assert from "node:assert/strict";
import test from "node:test";
import { createConversationActionController } from "../src/lib/conversation-action-controller.js";

function createController(overrides = {}) {
  return createConversationActionController({
    activeTaskId: "task-1",
    applySnapshot: () => {},
    beginActionFeedback: () => {},
    confirmWorkspaceGoal: async () => ({ goals: { goals: [{ id: "goal-1", parentProjectGoalId: "project-goal" }] } }),
    createWorkspaceGoal: async () => ({ goals: { activeGoalId: "goal-1" } }),
    executeGuardedCheck: async () => true,
    executePatchApply: async () => true,
    executePatchDraft: async () => true,
    executeRegisteredConversationAction: async (action, actions) => actions[action.type](action),
    finishActionFeedback: () => {},
    generatePlan: async () => ({ status: "succeeded" }),
    markTaskWaiting: async () => true,
    runGuardedCheck: async () => true,
    selectEngineeringFile: () => {},
    selectTask: () => {},
    setError: () => {},
    setSelectedEngineeringFile: () => {},
    stopPlanGeneration: () => {},
    taskStatuses: { running: "running" },
    tasks: [{ id: "task-1", status: "planned" }],
    topicPayloadFromOutline: () => ({ id: "task-list" }),
    ...overrides,
  });
}

test("confirms a created stage goal before applying the result snapshot", async () => {
  const snapshots = [];
  const runChatAction = createController({ applySnapshot: (snapshot) => snapshots.push(snapshot) });
  assert.equal(await runChatAction({ type: "create-stage-goal", title: "收口任务执行" }), true);
  assert.equal(snapshots.length, 1);
});

test("routes task-bound checks through the injected Task workflow", async () => {
  const calls = [];
  const runChatAction = createController({ runGuardedCheck: async (...args) => calls.push(args) });
  await runChatAction({ checkId: "runtime", taskId: "task-1", type: "run-check" });
  assert.deepEqual(calls, [["task-1", "runtime"]]);
});

test("does not start a task when the model is unavailable", async () => {
  let started = false;
  const runChatAction = createController({
    markTaskWaiting: async () => { started = true; return true; },
    onEnsureModelAvailable: async () => false,
  });
  assert.equal(await runChatAction({ taskId: "task-1", type: "confirm-active-task" }), false);
  assert.equal(started, false);
});

test("starts a conversation-bound Hermes run before changing the task status", async () => {
  const calls = [];
  const runChatAction = createController({
    markTaskWaiting: async () => { calls.push("task-status"); return true; },
    onEnsureModelAvailable: async () => true,
    startHermesAgent: async (task) => { calls.push(`agent:${task.id}`); return true; },
  });
  assert.equal(await runChatAction({ taskId: "task-1", type: "confirm-active-task" }), true);
  assert.deepEqual(calls, ["agent:task-1", "task-status"]);
});

test("keeps the task unchanged when Hermes cannot start", async () => {
  let statusChanged = false;
  const runChatAction = createController({
    markTaskWaiting: async () => { statusChanged = true; return true; },
    onEnsureModelAvailable: async () => true,
    startHermesAgent: async () => false,
  });
  assert.equal(await runChatAction({ taskId: "task-1", type: "confirm-active-task" }), false);
  assert.equal(statusChanged, false);
});

test("routes a failed task to the repair-task workflow", async () => {
  const calls = [];
  const runChatAction = createController({ createRepairTask: async (taskId) => { calls.push(taskId); return true; } });
  assert.equal(await runChatAction({ taskId: "task-1", type: "create-repair-task" }), true);
  assert.deepEqual(calls, ["task-1"]);
});
