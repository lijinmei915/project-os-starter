import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { addConversationConfirmationHandler } from "../src/lib/conversation-confirmation-handler.js";

test("submission wires the imported execution-ready event factory into confirmation handling", async () => {
  const source = await readFile(new URL("../src/components/workbench/use-conversation-submission.js", import.meta.url), "utf8");
  assert.match(source, /executionReadyEvents:\s*executionReadyAgentEvents/);
  assert.doesNotMatch(source, /\n\s+executionReadyEvents,\n\s+handlers:/);
  assert.match(source, /isTauri:\s*Boolean\(isTauri\)/);
  assert.doesNotMatch(source, /isTauri\(\)/);
});

test("confirms an active task and projects execution through injected adapters", async () => {
  const updates = [];
  const handlers = {};
  addConversationConfirmationHandler({
    activeProjectGoalTitle: "目标",
    clearSubmittedInput: () => {},
    executePendingPatchApply: async () => true,
    executionReadyEvents: () => [{ label: "执行" }],
    handlers,
    onChatTurnsChange: (turns) => updates.push(turns),
    onRunChatAction: async () => true,
    pendingAction: { id: "pending-1", nextAction: { checkId: "runtime", id: "run-check", label: "运行基础检查" }, taskId: "task-1", type: "confirm-active-task" },
    projectExecutionEvent: (turns, event) => turns.map((turn) => ({ ...turn, ...event })),
    requestBaseTurns: [{ id: "assistant-1", pendingAction: { id: "pending-1" }, requestId: "request-1", role: "assistant" }],
    requestId: "request-1",
    resolveStageGoalTurn: (turn) => turn,
    userTurn: { id: "user-1" },
  });
  assert.equal(await handlers["confirm-action"](), true);
  assert.equal(updates[0][0].outcome, "awaiting-confirmation");
  assert.equal(updates[0][0].resolvedActionId, "pending-1");
  assert.equal(updates[0][0].actions[0].label, "运行基础检查");
});

test("confirms a recommended plan through the injected controlled executor", async () => {
  const handlers = {};
  const pendingAction = { id: "recommend-1", task: "运行一轮基础检查", type: "generate-plan" };
  let received = null;
  addConversationConfirmationHandler({
    clearSubmittedInput: () => {},
    executePendingPatchApply: async () => true,
    executePendingPlan: async (action) => { received = action; return true; },
    executionReadyEvents: () => [],
    handlers,
    onChatTurnsChange: () => {},
    onRunChatAction: async () => true,
    pendingAction,
    projectExecutionEvent: (turns) => turns,
    requestBaseTurns: [],
    requestId: "request-1",
    resolveStageGoalTurn: (turn) => turn,
    userTurn: { id: "user-1" },
  });
  assert.equal(await handlers["confirm-action"](), true);
  assert.deepEqual(received, pendingAction);
});

test("confirms an executable recommendation through the controlled Agent executor", async () => {
  const handlers = {};
  const pendingAction = { id: "recommend-agent-1", task: "推进当前任务摘要", type: "start-agent" };
  let received = null;
  addConversationConfirmationHandler({
    clearSubmittedInput: () => {},
    executePendingAgent: async (action) => { received = action; return true; },
    executePendingPatchApply: async () => true,
    executionReadyEvents: () => [],
    handlers,
    onChatTurnsChange: () => {},
    onRunChatAction: async () => true,
    pendingAction,
    projectExecutionEvent: (turns) => turns,
    requestBaseTurns: [],
    requestId: "request-agent-1",
    resolveStageGoalTurn: (turn) => turn,
    userTurn: { id: "user-agent-1" },
  });
  assert.equal(await handlers["confirm-action"](), true);
  assert.deepEqual(received, pendingAction);
});
